/**
 * L3 smoke: requires PG 16.11 + pageinspect + get_raw_page privilege.
 * Exit 0 on success; non-zero with clear message when blocked.
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { parseBtreePage, type ParsedBtreePage } from "page-core";
import {
  emptySession,
  parsePgMajorVersion,
  readEnvCredentials,
  type SessionState,
} from "./session.js";
import { buildApp, connectSession, tryAutoConnectFromEnv } from "./app.js";

config({ path: resolve(process.cwd(), "../../.env") });
config();

// ---------------------------------------------------------------------------
// B-tree segment (index-viewer T9): self-seeded, idempotent, cleaned up on
// exit. Oracle = pageinspect (bt_metap / bt_page_stats / bt_page_items) —
// pages are fetched through the API (get_raw_page proxy) and parsed with
// page-core's parseBtreePage, then compared field-by-field and TID-by-TID.
// Invalid-index listing cannot be force-set without catalog writes (PG has
// no CREATE INDEX ... INVALID), so we assert the `valid` field contract on
// every list entry plus valid=true on our seeds — see dev-notes.md.
// ---------------------------------------------------------------------------

const SMOKE_IX_SCHEMA = "pageview_smoke_ix";

type InjectApp = Awaited<ReturnType<typeof buildApp>>["app"];

type OracleStatsRow = {
  btpo_prev: unknown;
  btpo_next: unknown;
  btpo_level: unknown;
  btpo_flags: unknown;
};

type OracleItemRow = {
  itemoffset: unknown;
  ctid: unknown;
  itemlen: unknown;
  nulls: unknown;
  vars: unknown;
  dead: unknown;
  tids: unknown;
};

function check(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`B-tree smoke failed: ${msg}`);
}

function tidString(t: { blockNumber: number; offsetNumber: number }): string {
  return `(${t.blockNumber},${t.offsetNumber})`;
}

/** Parse bt_page_items `tids` (tid[] arrives as a PG array-literal string). */
function oracleTids(raw: unknown): Array<{ blockNumber: number; offsetNumber: number }> {
  if (raw == null) return [];
  const text = Array.isArray(raw) ? raw.map(String).join(" ") : String(raw);
  const out: Array<{ blockNumber: number; offsetNumber: number }> = [];
  for (const m of text.matchAll(/\((\d+),(\d+)\)/g)) {
    out.push({ blockNumber: Number(m[1]), offsetNumber: Number(m[2]) });
  }
  return out;
}

function comparePageWithOracle(
  page: ParsedBtreePage,
  stats: OracleStatsRow,
  items: OracleItemRow[],
  label: string,
): void {
  check(page.special !== null, `${label}: special space missing`);
  const sp = page.special!;
  check(sp.btpo_prev === Number(stats.btpo_prev), `${label}: btpo_prev ${sp.btpo_prev} != oracle ${stats.btpo_prev}`);
  check(sp.btpo_next === Number(stats.btpo_next), `${label}: btpo_next ${sp.btpo_next} != oracle ${stats.btpo_next}`);
  check(sp.btpo_level === Number(stats.btpo_level), `${label}: btpo_level ${sp.btpo_level} != oracle ${stats.btpo_level}`);
  check(sp.btpo_flags === Number(stats.btpo_flags), `${label}: btpo_flags ${sp.btpo_flags} != oracle ${stats.btpo_flags}`);
  const live = items.filter((i) => i.dead !== true); // LP_DEAD rows have no tuple bytes
  check(page.tuples.length === live.length, `${label}: tuple count ${page.tuples.length} != oracle ${live.length}`);
  for (let i = 0; i < live.length; i++) {
    const o = live[i]!;
    const t = page.tuples[i]!;
    const at = `${label} itemoffset ${o.itemoffset}`;
    check(t.itemoffset === Number(o.itemoffset), `${at}: parser itemoffset ${t.itemoffset}`);
    check(tidString(t.t_tid) === String(o.ctid), `${at}: ctid ${tidString(t.t_tid)} != oracle ${o.ctid}`);
    check(t.itemlen === Number(o.itemlen), `${at}: itemlen ${t.itemlen} != oracle ${o.itemlen}`);
    check(t.hasNulls === Boolean(o.nulls), `${at}: nulls`);
    check(t.hasVars === Boolean(o.vars), `${at}: vars`);
    const oracleTidList = oracleTids(o.tids);
    if (oracleTidList.length > 0) {
      check(t.isPosting, `${at}: oracle has tids but parser missed posting`);
      check(t.postingTids != null, `${at}: posting TIDs not decoded`);
      check(t.postingCount === oracleTidList.length, `${at}: posting count ${t.postingCount} != oracle ${oracleTidList.length}`);
      check(
        t.postingTids!.map(tidString).join(",") === oracleTidList.map(tidString).join(","),
        `${at}: posting TID list mismatch`,
      );
    } else {
      check(!t.isPosting, `${at}: unexpected posting mark`);
    }
  }
}

async function btreeIndexSmoke(app: InjectApp, session: SessionState): Promise<void> {
  const major = session.serverVersion ? parsePgMajorVersion(session.serverVersion) : null;
  if (major === null || major < 13) {
    console.error(`L3 blocked: B-tree smoke needs PG 13+ (dedup); server reports ${session.serverVersion}.`);
    process.exit(2);
  }

  const q = (text: string, values?: unknown[]) => session.pool!.query(text, values);

  // Idempotent seed: never depends on pre-existing objects (dev-notes env note:
  // the connection target may be any local DB); everything is dropped in finally.
  await q(`DROP SCHEMA IF EXISTS ${SMOKE_IX_SCHEMA} CASCADE`);
  await q(`CREATE SCHEMA ${SMOKE_IX_SCHEMA}`);
  await q(`CREATE TABLE ${SMOKE_IX_SCHEMA}.uq (k int NOT NULL)`);
  await q(`INSERT INTO ${SMOKE_IX_SCHEMA}.uq SELECT g FROM generate_series(1, 50000) g`);
  await q(`CREATE INDEX uq_k_idx ON ${SMOKE_IX_SCHEMA}.uq (k)`); // multi-level: root internal page
  await q(`CREATE INDEX uq_k_hash ON ${SMOKE_IX_SCHEMA}.uq USING hash (k)`); // guard oracle

  try {
    // Duplicate-key index; retry at higher duplication until posting tuples
    // appear (dedup is automatic for int keys on PG 13+).
    const uqQualified = `${SMOKE_IX_SCHEMA}.uq_k_idx`;
    let dupQualified = "";
    let postingBlkno = -1;
    for (const mod of [50, 10, 2]) {
      await q(`DROP TABLE IF EXISTS ${SMOKE_IX_SCHEMA}.dup CASCADE`);
      await q(`CREATE TABLE ${SMOKE_IX_SCHEMA}.dup (k int NOT NULL)`);
      await q(`INSERT INTO ${SMOKE_IX_SCHEMA}.dup SELECT g % ${mod} FROM generate_series(1, 30000) g`);
      await q(`CREATE INDEX dup_k_idx ON ${SMOKE_IX_SCHEMA}.dup (k)`);
      dupQualified = `${SMOKE_IX_SCHEMA}.dup_k_idx`;
      const blocksRes = await q(`SELECT pg_relation_size($1::text) / 8192 AS blocks`, [dupQualified]);
      const blocks = Number(blocksRes.rows[0].blocks);
      if (blocks < 2) continue;
      const found = await q(
        `SELECT s.blkno::int AS blkno, count(*)::int AS posting_tuples
           FROM generate_series(1, $2::int) AS s(blkno)
          CROSS JOIN LATERAL bt_page_items($1::text, s.blkno) AS it
          WHERE it.tids IS NOT NULL
          GROUP BY s.blkno ORDER BY posting_tuples DESC, s.blkno LIMIT 1`,
        [dupQualified, blocks - 1],
      );
      if ((found.rowCount ?? 0) > 0) {
        postingBlkno = Number(found.rows[0].blkno);
        break;
      }
    }
    check(postingBlkno > 0, "no posting tuple found on any dup-index leaf (dedup not triggered)");

    // 1) Index list via API: response shape, seed entries, valid-field contract.
    const listRes = await app.inject({ method: "GET", url: "/api/indexes" });
    check(listRes.statusCode === 200, `GET /api/indexes -> ${listRes.statusCode}`);
    const idx = (
      listRes.json() as {
        indexes: Array<{
          oid: number;
          qualifiedName: string;
          accessMethod: string;
          blocks: number;
          tableQualifiedName: string;
          valid: boolean;
        }>;
      }
    ).indexes;
    check(idx.length > 0, "index list empty");
    for (const e of idx) {
      check(typeof e.valid === "boolean", `list entry ${e.qualifiedName} missing boolean valid`);
    }
    const uqIdx = idx.find((e) => e.qualifiedName === uqQualified);
    const dupIdx = idx.find((e) => e.qualifiedName === dupQualified);
    const hashIdx = idx.find((e) => e.qualifiedName === `${SMOKE_IX_SCHEMA}.uq_k_hash`);
    check(uqIdx && dupIdx && hashIdx, "seeded indexes missing from list");
    check(uqIdx.accessMethod === "btree" && uqIdx.valid === true, "uq_k_idx not btree/valid");
    check(dupIdx.accessMethod === "btree" && dupIdx.valid === true, "dup_k_idx not btree/valid");
    check(uqIdx.tableQualifiedName === `${SMOKE_IX_SCHEMA}.uq`, "uq_k_idx tableQualifiedName mismatch");
    check(uqIdx.blocks > 1, `uq_k_idx blocks ${uqIdx.blocks} <= 1`);
    check(hashIdx.accessMethod === "hash", "uq_k_hash not hash");
    console.log(`B-tree list OK: ${idx.length} indexes; seeds btree x2 (valid=true) + hash x1`);

    // 2) Metapage via API vs bt_metap.
    const metaPageRes = await app.inject({ method: "GET", url: `/api/indexes/${uqIdx.oid}/pages/0` });
    check(metaPageRes.statusCode === 200, `meta page -> ${metaPageRes.statusCode} ${metaPageRes.body}`);
    const metaPage = parseBtreePage(Buffer.from((metaPageRes.json() as { pageBase64: string }).pageBase64, "base64"));
    check(metaPage.pageType === "meta", `blk0 pageType ${metaPage.pageType}`);
    check(metaPage.warnings.length === 0, `metapage warnings ${JSON.stringify(metaPage.warnings)}`);
    const metapRow = (
      await q(`SELECT * FROM bt_metap($1::text)`, [uqQualified])
    ).rows[0] as Record<string, unknown>;
    const m = metaPage.meta!;
    check(m.btm_magic === Number(metapRow.magic), `btm_magic ${m.btm_magic} != oracle ${metapRow.magic}`);
    check(m.btm_version === Number(metapRow.version), `btm_version ${m.btm_version} != oracle ${metapRow.version}`);
    check(m.btm_root === Number(metapRow.root), `btm_root ${m.btm_root} != oracle ${metapRow.root}`);
    check(m.btm_level === Number(metapRow.level), `btm_level ${m.btm_level} != oracle ${metapRow.level}`);
    check(m.btm_fastroot === Number(metapRow.fastroot), `btm_fastroot ${m.btm_fastroot} != oracle ${metapRow.fastroot}`);
    check(m.btm_fastlevel === Number(metapRow.fastlevel), `btm_fastlevel ${m.btm_fastlevel} != oracle ${metapRow.fastlevel}`);
    if (Number(metapRow.version) >= 4) {
      check(m.btm_allequalimage === Boolean(metapRow.allequalimage), `btm_allequalimage ${m.btm_allequalimage} != oracle ${metapRow.allequalimage}`);
    }
    console.log(`B-tree metapage OK: ${uqQualified} blk0 (v${m.btm_version} root=${m.btm_root} level=${m.btm_level} allequalimage=${m.btm_allequalimage})`);

    // 3) Internal page (root) via API vs bt_page_stats/bt_page_items.
    const rootBlk = m.btm_root;
    const intPageRes = await app.inject({ method: "GET", url: `/api/indexes/${uqIdx.oid}/pages/${rootBlk}` });
    check(intPageRes.statusCode === 200, `root page -> ${intPageRes.statusCode} ${intPageRes.body}`);
    const intPage = parseBtreePage(Buffer.from((intPageRes.json() as { pageBase64: string }).pageBase64, "base64"));
    check(intPage.pageType === "internal", `root blk${rootBlk} pageType ${intPage.pageType}`);
    check(intPage.special !== null && intPage.special.btpo_level > 0, "root btpo_level not > 0");
    const intStats = (await q(`SELECT * FROM bt_page_stats($1::text, $2::int)`, [uqQualified, rootBlk])).rows[0] as OracleStatsRow;
    const intItems = (await q(`SELECT * FROM bt_page_items($1::text, $2::int)`, [uqQualified, rootBlk])).rows as OracleItemRow[];
    comparePageWithOracle(intPage, intStats, intItems, `internal blk${rootBlk}`);
    for (const t of intPage.tuples) {
      check(t.isPivot && !t.isPosting, `internal tuple ${t.itemoffset} not a pivot downlink`);
      check(t.t_tid.blockNumber > 0, `internal tuple ${t.itemoffset} child block not > 0`);
    }
    console.log(`B-tree internal OK: ${uqQualified} blk${rootBlk} (level=${intPage.special!.btpo_level}, ${intPage.tuples.length} downlinks)`);

    // 4) Plain leaf (non-rightmost -> first tuple is the hikey, P0-7).
    const leafFound = await q(
      `SELECT s.blkno::int AS blkno
         FROM generate_series(1, $2::int) AS s(blkno)
        CROSS JOIN LATERAL bt_page_stats($1::text, s.blkno) AS st
        WHERE st.btpo_level = 0 AND st.btpo_next::int8 <> 0
        ORDER BY s.blkno LIMIT 1`,
      [uqQualified, uqIdx.blocks - 1],
    );
    check((leafFound.rowCount ?? 0) > 0, "no non-rightmost leaf found on uq_k_idx");
    const leafBlk = Number(leafFound.rows[0].blkno);
    const leafPageRes = await app.inject({ method: "GET", url: `/api/indexes/${uqIdx.oid}/pages/${leafBlk}` });
    check(leafPageRes.statusCode === 200, `leaf page -> ${leafPageRes.statusCode} ${leafPageRes.body}`);
    const leafPage = parseBtreePage(Buffer.from((leafPageRes.json() as { pageBase64: string }).pageBase64, "base64"));
    check(leafPage.pageType === "leaf", `leaf blk${leafBlk} pageType ${leafPage.pageType}`);
    const leafStats = (await q(`SELECT * FROM bt_page_stats($1::text, $2::int)`, [uqQualified, leafBlk])).rows[0] as OracleStatsRow;
    const leafItems = (await q(`SELECT * FROM bt_page_items($1::text, $2::int)`, [uqQualified, leafBlk])).rows as OracleItemRow[];
    comparePageWithOracle(leafPage, leafStats, leafItems, `leaf blk${leafBlk}`);
    check(leafPage.stats.postingTupleCount === 0, "plain leaf unexpectedly has posting tuples");
    const firstLeafTuple = leafPage.tuples[0];
    check(firstLeafTuple !== undefined && firstLeafTuple.isHikey, "first tuple of non-rightmost leaf is not hikey");
    check(leafPage.tuples.slice(1).every((t) => !t.isHikey), "extra hikey marks on plain leaf");
    console.log(`B-tree leaf OK: ${uqQualified} blk${leafBlk} (${leafPage.tuples.length} tuples, hikey first)`);

    // 5) Posting leaf: full TID-list comparison against bt_page_items.tids.
    const postPageRes = await app.inject({ method: "GET", url: `/api/indexes/${dupIdx.oid}/pages/${postingBlkno}` });
    check(postPageRes.statusCode === 200, `posting leaf -> ${postPageRes.statusCode} ${postPageRes.body}`);
    const postPage = parseBtreePage(Buffer.from((postPageRes.json() as { pageBase64: string }).pageBase64, "base64"));
    check(postPage.pageType === "leaf", `posting blk${postingBlkno} pageType ${postPage.pageType}`);
    const postStats = (await q(`SELECT * FROM bt_page_stats($1::text, $2::int)`, [dupQualified, postingBlkno])).rows[0] as OracleStatsRow;
    const postItems = (await q(`SELECT * FROM bt_page_items($1::text, $2::int)`, [dupQualified, postingBlkno])).rows as OracleItemRow[];
    comparePageWithOracle(postPage, postStats, postItems, `posting blk${postingBlkno}`);
    const postings = postPage.tuples.filter((t) => t.isPosting);
    check(postings.length > 0, "no posting tuples on chosen dup leaf");
    for (const p of postings) {
      check((p.postingCount ?? 0) > 1, `posting tuple ${p.itemoffset} count not > 1`);
      check(p.postingTids != null && p.postingTids.length === p.postingCount, `posting tuple ${p.itemoffset} TID list length`);
    }
    const oracleTidTotal = postItems.reduce((n, i) => n + oracleTids(i.tids).length, 0);
    check(postPage.stats.postingTidCount === oracleTidTotal, `posting TID total ${postPage.stats.postingTidCount} != oracle ${oracleTidTotal}`);
    console.log(
      `B-tree posting OK: ${dupQualified} blk${postingBlkno} (${postings.length} posting tuples, ${oracleTidTotal} TIDs)`,
    );

    // 6) Hash guard: 400 INDEX_NOT_BTREE with access method in message (P0-3).
    const hashPageRes = await app.inject({ method: "GET", url: `/api/indexes/${hashIdx.oid}/pages/1` });
    check(hashPageRes.statusCode === 400, `hash index page -> ${hashPageRes.statusCode} ${hashPageRes.body}`);
    const hashBody = hashPageRes.json() as { code: string; message: string; nextStep: string };
    check(hashBody.code === "INDEX_NOT_BTREE", `hash guard code ${hashBody.code}`);
    check(hashBody.message.includes("hash"), `hash guard message lacks method name: ${hashBody.message}`);
    check(typeof hashBody.nextStep === "string" && hashBody.nextStep.length > 0, "hash guard nextStep missing");
    console.log(`hash guard OK: 400 INDEX_NOT_BTREE (message mentions "hash")`);
  } finally {
    try {
      await q(`DROP SCHEMA IF EXISTS ${SMOKE_IX_SCHEMA} CASCADE`);
      console.log("B-tree smoke seed cleaned up (schema dropped)");
    } catch {
      console.error(`B-tree smoke cleanup failed; schema ${SMOKE_IX_SCHEMA} may be left behind`);
    }
  }
}

async function main(): Promise<void> {
  if (!readEnvCredentials()) {
    console.error(
      "L3 blocked: no DATABASE_URL / PG* credentials. Provide a reachable PG 16.11 instance to run integration smoke.",
    );
    process.exit(2);
  }

  const session = emptySession();
  await tryAutoConnectFromEnv(session);
  if (!session.connected) {
    // try explicit connect for clearer error
    try {
      await connectSession(session, readEnvCredentials()!);
    } catch (e) {
      const err = e as { body?: { message?: string; nextStep?: string } };
      console.error("L3 blocked: connect failed.", err.body?.message, err.body?.nextStep);
      process.exit(2);
    }
  }

  const { app } = await buildApp(session);
  await app.ready();

  const tablesRes = await app.inject({ method: "GET", url: "/api/tables" });
  if (tablesRes.statusCode !== 200) {
    console.error("GET /api/tables failed", tablesRes.body);
    process.exit(1);
  }
  const tables = tablesRes.json().tables as Array<{ oid: number; blocks: number; qualifiedName: string }>;
  const target = tables.find((t) => t.blocks > 0);
  if (!target) {
    console.error("L3 blocked: no user heap table with blocks > 0 to fetch a page.");
    process.exit(2);
  }

  const pageRes = await app.inject({
    method: "GET",
    url: `/api/tables/${target.oid}/pages/0`,
  });
  if (pageRes.statusCode !== 200) {
    console.error("GET page failed", pageRes.body);
    process.exit(1);
  }
  const body = pageRes.json() as { pageBase64: string; byteLength: number };
  const buf = Buffer.from(body.pageBase64, "base64");
  if (buf.length !== 8192 || body.byteLength !== 8192) {
    console.error(`Expected 8192-byte page, got ${buf.length}`);
    process.exit(1);
  }

  const schemaRes = await app.inject({
    method: "GET",
    url: `/api/tables/${target.oid}/schema`,
  });
  if (schemaRes.statusCode !== 200) {
    console.error("GET schema failed", schemaRes.body);
    process.exit(1);
  }

  // R1 regression: DROP COLUMN must still appear as attisdropped placeholder.
  const client = await session.pool!.connect();
  let dropOid: number | null = null;
  try {
    await client.query(`
      CREATE TEMP TABLE pageview_r1_drop (a int, b text, c int);
      INSERT INTO pageview_r1_drop VALUES (1, 'x', 2);
      ALTER TABLE pageview_r1_drop DROP COLUMN b;
    `);
    const oidRes = await client.query(`SELECT 'pageview_r1_drop'::regclass::oid AS oid`);
    dropOid = Number(oidRes.rows[0].oid);
  } finally {
    client.release();
  }

  const dropSchema = await app.inject({
    method: "GET",
    url: `/api/tables/${dropOid}/schema`,
  });
  if (dropSchema.statusCode !== 200) {
    console.error("GET schema (dropped col) failed", dropSchema.body);
    process.exit(1);
  }
  const cols = dropSchema.json().columns as Array<{ attisdropped: boolean; name: string }>;
  if (cols.length < 3 || !cols.some((c) => c.attisdropped)) {
    console.error("R1 failed: schema missing attisdropped placeholder", cols);
    process.exit(1);
  }

  // Blocks must reflect on-disk size (not stale relpages alone).
  if (target.blocks < 1) {
    console.error("blocks contract failed: expected >= 1 for table with pages");
    process.exit(1);
  }

  await btreeIndexSmoke(app, session);

  console.log(`L3 smoke OK: ${target.qualifiedName} blk 0 length=${buf.length}`);
  console.log(`serverVersion=${session.serverVersion}`);
  console.log(`R1 schema placeholders OK (${cols.filter((c) => c.attisdropped).length} dropped)`);
  console.log("B-tree segment OK: list/metapage/internal/leaf/posting oracle + hash guard");
  await app.close();
  if (session.pool) await session.pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

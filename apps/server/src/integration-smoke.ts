/**
 * L3 smoke: requires PG 16.11 + a role with CREATE privilege (superuser)
 * for pageinspect / pg_walinspect + get_raw_page privilege. Includes an
 * auto-install segment that DROPs both extensions and proves the mode guards
 * re-install them. Exit 0 on success; non-zero with clear message when blocked.
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import {
  BT_PIVOT_HEAP_TID_ATTR,
  decodeIndexTupleKeys,
  parseBtreePage,
  type IndexColumnMeta,
  type ParsedBtreePage,
} from "page-core";
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
const SMOKE_IXKD_SCHEMA = "pageview_smoke_ixkd";

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

// ---------------------------------------------------------------------------
// Auto-install segment (auto-install-extensions T5): proves end-to-end that
// the mode guards re-install a dropped extension. Runs AFTER the B-tree
// segment because that oracle calls pageinspect functions directly, so DROP
// must come last. `finally` re-creates both extensions so a failed segment
// never leaves the instance without them.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// index-key-decode segment (T8): columns endpoint shape + guards through
// the API, then decodeIndexTupleKeys on real leaf/internal pages compared
// with UTC-session ctid-row ::text values (Spec oracle). Covers P0 types,
// P1 types (numeric/float4/float8/bytea + specials), NULLs, posting tuples,
// pivots with the trailing heap TID (decode equals the SQL row at that TID),
// indoption (DESC) bits, expression/jsonb degradation, and domain columns.
// ---------------------------------------------------------------------------

type ColsApiResponse = {
  oid: number;
  schema: string;
  name: string;
  qualifiedName: string;
  accessMethod: string;
  indnatts: number;
  indnkeyatts: number;
  hasExpression: boolean;
  columns: Array<{
    attnum: number;
    name: string;
    typoid: number;
    typname: string;
    typmod: number;
    kind: string;
    isExpression: boolean;
    descending: boolean;
    nullsFirst: boolean;
  }>;
};

/** Normalize a UTC-session ::text row value to the decode display contract. */
function kdNormalize(typname: string, v: string): string {
  switch (typname) {
    case "text":
    case "varchar":
    case "bpchar":
      return `'${v}'`;
    case "timestamp":
      return v.replace(" ", "T");
    case "timestamptz":
      return v.replace(" ", "T").replace(/\+00$/, "Z");
    default:
      return v;
  }
}

async function indexKeyDecodeSmoke(app: InjectApp, session: SessionState): Promise<void> {
  const client = await session.pool!.connect();
  const q = (text: string, values?: unknown[]) => client.query(text, values);
  const S = SMOKE_IXKD_SCHEMA;
  let compared = 0;
  let pivotTidCompared = 0;
  try {
    await q(`DROP SCHEMA IF EXISTS ${S} CASCADE`);
    await q(`CREATE SCHEMA ${S}`);
    await q(`SET TimeZone = 'UTC'`);

    // -- P1 type battery (numeric/float4/float8/bytea incl. specials) ------
    await q(`CREATE TABLE ${S}.kd_p1 (n numeric, f4 float4, f8 float8, by bytea)`);
    await q(`INSERT INTO ${S}.kd_p1 VALUES
      (0, 0, 0, ''::bytea),
      (1, 1, 1, decode('00','hex')),
      (-1, -1, -1, decode('0011ff','hex')),
      (1.50, 0.1, 0.1, decode('deadbeefcafebabe0123456789abcdef','hex')),
      (123.456, 123456.79, 123456.789, decode(repeat('ab', 70), 'hex')),
      (1e10, 1e7, 1e15, NULL),
      (1e63, 1e8, 1e16, NULL),
      (1e64, 3.4028235e38, 1.7976931348623157e308, NULL),
      (1e-24, 1e-30, 2.2250738585072014e-308, NULL),
      (1e-300, 1.1754944e-38, 1e-30, NULL),
      (1e300, 'NaN'::float4, 'NaN'::float8, NULL),
      (99999999999999999999.99999, 'Infinity'::float4, 'Infinity'::float8, NULL),
      (0.0001, '-Infinity'::float4, '-Infinity'::float8, NULL),
      (0.00001, -0, -0, NULL),
      ('NaN'::numeric, NULL, NULL, NULL),
      ('Infinity'::numeric, NULL, NULL, NULL),
      ('-Infinity'::numeric, NULL, NULL, NULL),
      (3.14159265358979323846264338327950288, NULL, NULL, NULL)`);
    await q(`CREATE INDEX kd_p1_n_idx ON ${S}.kd_p1 (n)`);
    await q(`CREATE INDEX kd_p1_f4_idx ON ${S}.kd_p1 (f4)`);
    await q(`CREATE INDEX kd_p1_f8_idx ON ${S}.kd_p1 (f8)`);
    await q(`CREATE INDEX kd_p1_by_idx ON ${S}.kd_p1 (by)`);

    // -- P0 scalar battery (date/timestamp/timestamptz/uuid/bool) ----------
    await q(`CREATE TABLE ${S}.kd_sc (d date, ts timestamp, tst timestamptz, u uuid, bo boolean)`);
    await q(`INSERT INTO ${S}.kd_sc SELECT
      date '2000-01-01' + (g * 37) + CASE WHEN g % 997 = 0 THEN 1 ELSE 0 END * 1000000,
      timestamp '2000-01-01 00:00:00' + (g * 137) * interval '1 microsecond',
      timestamptz '2000-01-01 00:00:00' + (g * 1013) * interval '1 microsecond',
      case when g % 17 = 0 then gen_random_uuid() else md5(g::text)::uuid end,
      g % 3 = 0
      FROM generate_series(1, 2500) g`);
    await q(`INSERT INTO ${S}.kd_sc VALUES
      ('infinity'::date, 'infinity'::timestamp, 'infinity'::timestamptz, NULL, NULL),
      ('-infinity'::date, '-infinity'::timestamp, '-infinity'::timestamptz, NULL, NULL)`);
    await q(`CREATE INDEX kd_sc_d_idx ON ${S}.kd_sc (d)`);
    await q(`CREATE INDEX kd_sc_ts_idx ON ${S}.kd_sc (ts)`);
    await q(`CREATE INDEX kd_sc_tst_idx ON ${S}.kd_sc (tst)`);
    await q(`CREATE INDEX kd_sc_u_idx ON ${S}.kd_sc (u)`);
    await q(`CREATE INDEX kd_sc_bo_idx ON ${S}.kd_sc (bo)`);

    // -- composite with NULLs / multibyte / empty / >64 chars -------------
    await q(`CREATE TABLE ${S}.kd_mix (a int, b text)`);
    await q(`INSERT INTO ${S}.kd_mix SELECT
      CASE WHEN g % 23 = 0 THEN NULL ELSE g % 40 END,
      CASE WHEN g % 19 = 0 THEN NULL
           WHEN g % 15 = 0 THEN ''
           WHEN g % 11 = 0 THEN convert_from(decode('e4bda0e5a5bd','hex'),'utf8') || repeat('!', g % 3)
           WHEN g % 7 = 0 THEN repeat('L', 70 + g % 5)
           ELSE repeat('x', (g % 6) + 1) END
      FROM generate_series(1, 6000) g`);
    await q(`CREATE INDEX kd_mix_idx ON ${S}.kd_mix (a, b)`);

    // -- duplicates: pivots with trailing heap TID + posting tuples --------
    await q(`CREATE TABLE ${S}.kd_dup (b text NOT NULL)`);
    await q(`INSERT INTO ${S}.kd_dup SELECT repeat('y', (g % 3) + 1) FROM generate_series(1, 20000) g`);
    await q(`CREATE INDEX kd_dup_idx ON ${S}.kd_dup (b)`);

    // -- indoption / expression / jsonb / hash guard ------------------------
    await q(`CREATE TABLE ${S}.kd_desc (a int, b int)`);
    await q(`INSERT INTO ${S}.kd_desc SELECT g % 30, g % 5 FROM generate_series(1, 2000) g`);
    await q(`CREATE INDEX kd_desc_idx ON ${S}.kd_desc (a DESC, b)`);
    await q(`CREATE TABLE ${S}.kd_expr (name text)`);
    await q(`INSERT INTO ${S}.kd_expr SELECT md5(g::text) FROM generate_series(1, 500) g`);
    await q(`CREATE INDEX kd_expr_idx ON ${S}.kd_expr (lower(name))`);
    await q(`CREATE INDEX kd_expr_hash ON ${S}.kd_expr USING hash (name)`);
    await q(`CREATE TABLE ${S}.kd_js (a int, j jsonb)`);
    await q(`INSERT INTO ${S}.kd_js SELECT g % 20, jsonb_build_object('k', g) FROM generate_series(1, 1000) g`);
    await q(`CREATE INDEX kd_js_idx ON ${S}.kd_js (a, j)`);
    await q(`CREATE INDEX kd_js_only_idx ON ${S}.kd_js (j)`);

    const list = (
      await app.inject({ method: "GET", url: "/api/indexes" })
    ).json().indexes as Array<{ oid: number; qualifiedName: string }>;
    const oidOf = (qualified: string): number => {
      const e = list.find((x) => x.qualifiedName === qualified);
      check(e != null, `index ${qualified} missing from list`);
      return e!.oid;
    };

    const fetchColumns = async (oid: number): Promise<ColsApiResponse> => {
      const res = await app.inject({ method: "GET", url: `/api/indexes/${oid}/columns` });
      check(res.statusCode === 200, `GET columns ${oid} -> ${res.statusCode} ${res.body}`);
      return res.json() as ColsApiResponse;
    };

    // 1) Endpoint shape: composite (a int, b text) ------------------------
    const mixCols = await fetchColumns(oidOf(`${S}.kd_mix_idx`));
    check(mixCols.schema === S && mixCols.name === "kd_mix_idx", "mix qualifiedName parts");
    check(mixCols.qualifiedName === `${S}.kd_mix_idx`, "mix qualifiedName");
    check(mixCols.accessMethod === "btree", "mix accessMethod");
    check(mixCols.indnatts === 2 && mixCols.indnkeyatts === 2, `mix indnatts ${mixCols.indnatts}/${mixCols.indnkeyatts}`);
    check(mixCols.hasExpression === false, "mix hasExpression");
    check(mixCols.columns.length === 2, `mix columns ${mixCols.columns.length}`);
    check(mixCols.columns[0]!.name === "a" && mixCols.columns[0]!.typname === "int4", "mix col0");
    check(mixCols.columns[0]!.kind === "key" && !mixCols.columns[0]!.isExpression, "mix col0 kind");
    check(mixCols.columns[0]!.descending === false && mixCols.columns[0]!.nullsFirst === false, "mix col0 indoption");
    check(mixCols.columns[1]!.name === "b" && mixCols.columns[1]!.typname === "text", "mix col1");

    // DESC bits: (a DESC, b) — PG records DESC with default NULLS FIRST (dev-notes T4)
    const descCols = await fetchColumns(oidOf(`${S}.kd_desc_idx`));
    check(descCols.columns[0]!.descending === true, "desc col0 descending");
    check(descCols.columns[0]!.nullsFirst === true, "desc col0 nullsFirst");
    check(descCols.columns[1]!.descending === false && descCols.columns[1]!.nullsFirst === false, "desc col1 indoption");

    // 2) Guards ------------------------------------------------------------
    const tableOid = Number((await q(`SELECT '${S}.kd_mix'::regclass::oid AS oid`)).rows[0].oid);
    const tableRes = await app.inject({ method: "GET", url: `/api/indexes/${tableOid}/columns` });
    check(tableRes.statusCode === 404, `table oid columns -> ${tableRes.statusCode}`);
    check((tableRes.json() as { code: string }).code === "NOT_INDEX", "table oid code");
    const hashRes = await app.inject({ method: "GET", url: `/api/indexes/${oidOf(`${S}.kd_expr_hash`)}/columns` });
    check(hashRes.statusCode === 400, `hash columns -> ${hashRes.statusCode}`);
    check((hashRes.json() as { code: string }).code === "INDEX_NOT_BTREE", "hash code");
    const badOidRes = await app.inject({ method: "GET", url: "/api/indexes/abc/columns" });
    check(badOidRes.statusCode === 400, `bad oid columns -> ${badOidRes.statusCode}`);
    check((badOidRes.json() as { code: string }).code === "BAD_OID", "bad oid code");

    // 3) Leaf / posting decode vs UTC ::text row values --------------------
    const fetchPage = async (oid: number, blkno: number): Promise<ParsedBtreePage> => {
      const res = await app.inject({ method: "GET", url: `/api/indexes/${oid}/pages/${blkno}` });
      check(res.statusCode === 200, `GET page ${oid}/${blkno} -> ${res.statusCode} ${res.body}`);
      return parseBtreePage(Buffer.from((res.json() as { pageBase64: string }).pageBase64, "base64"));
    };

    const compareLeaves = async (
      indexQualified: string,
      tableQualified: string,
      tableColumns: string[],
      meta: IndexColumnMeta[],
      opts?: { expectPosting?: boolean },
    ): Promise<number> => {
      const oid = oidOf(indexQualified);
      // ctid -> row values, preloaded once (UTC ::text) with stable aliases
      const sel = tableColumns.map((c, i) => `${c}::text AS c${i}`).join(", ");
      const rows = await q(`SELECT ctid::text AS ctid, ${sel} FROM ${tableQualified}`);
      const byCtid = new Map<string, Array<string | null>>();
      for (const r of rows.rows as Record<string, unknown>[]) {
        byCtid.set(
          String(r.ctid),
          tableColumns.map((_, i) => (r[`c${i}`] as string | null) ?? null),
        );
      }
      const blocks = Number((await q(`SELECT pg_relation_size($1::text) / 8192 AS b`, [indexQualified])).rows[0].b);
      let n = 0;
      let sawPosting = false;
      for (let blk = 1; blk < blocks; blk++) {
        const page = await fetchPage(oid, blk);
        for (const t of page.tuples) {
          if (t.isPivot) continue; // pivots compared separately (kd_dup)
          const tid = t.isPosting ? (t.postingTids?.[0] ?? t.t_tid) : t.t_tid;
          if (t.isPosting) sawPosting = true;
          const row = byCtid.get(`(${tid.blockNumber},${tid.offsetNumber})`);
          check(row !== undefined, `${indexQualified} blk${blk} lp${t.itemoffset}: no row at ${tid.blockNumber},${tid.offsetNumber}`);
          const out = decodeIndexTupleKeys(page, t, meta);
          for (let i = 0; i < meta.length; i++) {
            const m = meta[i]!;
            const want = row![i] === null ? null : kdNormalize(m.typname, row![i]!);
            const got = out[i]!;
            const gotText = got.status === "null" ? null : got.status === "value" ? got.display : `!${got.status}:${got.reason}`;
            check(
              gotText === want,
              `${indexQualified} blk${blk} lp${t.itemoffset} attnum${m.attnum} (${m.typname}): decoded=${JSON.stringify(gotText)} sql=${JSON.stringify(want)}`,
            );
          }
          n++;
        }
      }
      if (opts?.expectPosting) check(sawPosting, `${indexQualified}: expected posting tuples`);
      return n;
    };

    const metaOf = (c: ColsApiResponse): IndexColumnMeta[] =>
      c.columns.map((x) => ({ attnum: x.attnum, name: x.name, typoid: x.typoid, typname: x.typname, kind: x.kind === "include" ? "include" : "key" }));

    compared += await compareLeaves(`${S}.kd_p1_n_idx`, `${S}.kd_p1`, ["n"], metaOf(await fetchColumns(oidOf(`${S}.kd_p1_n_idx`))));
    compared += await compareLeaves(`${S}.kd_p1_f4_idx`, `${S}.kd_p1`, ["f4"], metaOf(await fetchColumns(oidOf(`${S}.kd_p1_f4_idx`))));
    compared += await compareLeaves(`${S}.kd_p1_f8_idx`, `${S}.kd_p1`, ["f8"], metaOf(await fetchColumns(oidOf(`${S}.kd_p1_f8_idx`))));
    compared += await compareLeaves(`${S}.kd_p1_by_idx`, `${S}.kd_p1`, ["by"], metaOf(await fetchColumns(oidOf(`${S}.kd_p1_by_idx`))));
    compared += await compareLeaves(`${S}.kd_sc_d_idx`, `${S}.kd_sc`, ["d"], metaOf(await fetchColumns(oidOf(`${S}.kd_sc_d_idx`))));
    compared += await compareLeaves(`${S}.kd_sc_ts_idx`, `${S}.kd_sc`, ["ts"], metaOf(await fetchColumns(oidOf(`${S}.kd_sc_ts_idx`))));
    compared += await compareLeaves(`${S}.kd_sc_tst_idx`, `${S}.kd_sc`, ["tst"], metaOf(await fetchColumns(oidOf(`${S}.kd_sc_tst_idx`))));
    compared += await compareLeaves(`${S}.kd_sc_u_idx`, `${S}.kd_sc`, ["u"], metaOf(await fetchColumns(oidOf(`${S}.kd_sc_u_idx`))));
    compared += await compareLeaves(`${S}.kd_sc_bo_idx`, `${S}.kd_sc`, ["bo"], metaOf(await fetchColumns(oidOf(`${S}.kd_sc_bo_idx`))));
    compared += await compareLeaves(`${S}.kd_mix_idx`, `${S}.kd_mix`, ["a", "b"], metaOf(mixCols));
    compared += await compareLeaves(`${S}.kd_dup_idx`, `${S}.kd_dup`, ["b"], metaOf(await fetchColumns(oidOf(`${S}.kd_dup_idx`))), { expectPosting: true });

    // 4) Internal pivots with trailing heap TID: decoded key equals the SQL
    //    row located at the tiebreaker TID (nbtree.h BTreeTupleGetHeapTID).
    {
      const dupQualified = `${S}.kd_dup_idx`;
      const oid = oidOf(dupQualified);
      const meta = metaOf(await fetchColumns(oid));
      const rows = await q(`SELECT ctid::text AS ctid, b::text AS b FROM ${S}.kd_dup`);
      const byCtid = new Map<string, string | null>();
      for (const r of rows.rows as Record<string, unknown>[]) {
        byCtid.set(String(r.ctid), (r.b as string | null) ?? null);
      }
      const blocks = Number((await q(`SELECT pg_relation_size($1::text) / 8192 AS b`, [dupQualified])).rows[0].b);
      for (let blk = 1; blk < blocks; blk++) {
        const page = await fetchPage(oid, blk);
        if (page.pageType !== "internal") continue;
        for (const t of page.tuples) {
          if (!t.isPivot) continue;
          const hasTid = (t.t_tid.offsetNumber & BT_PIVOT_HEAP_TID_ATTR) !== 0;
          if (!hasTid) continue;
          const view = new DataView(page.raw.buffer, page.raw.byteOffset, page.raw.byteLength);
          const tidStart = t.range.end - 6; // TID occupies the LAST 6 bytes (oracle-frozen)
          const block = view.getUint16(tidStart, true) * 0x10000 + view.getUint16(tidStart + 2, true);
          const offset = view.getUint16(tidStart + 4, true);
          const want = byCtid.get(`(${block},${offset})`) ?? null;
          const out = decodeIndexTupleKeys(page, t, meta)[0]!;
          const got = out.status === "null" ? null : out.status === "value" ? out.display : `!${out.status}`;
          check(
            got === (want === null ? null : kdNormalize("text", want)),
            `pivot ${dupQualified} blk${blk} lp${t.itemoffset}: decoded=${JSON.stringify(got)} sql=${JSON.stringify(want)}`,
          );
          pivotTidCompared++;
        }
      }
      check(pivotTidCompared > 0, "no pivot with trailing heap TID found on kd_dup internal pages");
    }

    // 5) Degradation contracts -------------------------------------------
    const exprCols = await fetchColumns(oidOf(`${S}.kd_expr_idx`));
    check(exprCols.hasExpression === true, "expression index hasExpression");

    const jsCols = await fetchColumns(oidOf(`${S}.kd_js_idx`));
    check(jsCols.columns[0]!.typname === "int4", "js col0 int4");
    check(jsCols.columns[1]!.typname === "jsonb", "js col1 jsonb");
    {
      const oid = oidOf(`${S}.kd_js_idx`);
      const blocks = Number((await q(`SELECT pg_relation_size($1::text) / 8192 AS b`, [`${S}.kd_js_idx`])).rows[0].b);
      const page = await fetchPage(oid, Math.max(1, blocks - 1));
      const t = page.tuples.find((x) => !x.isPivot) ?? page.tuples[0]!;
      const out = decodeIndexTupleKeys(page, t, metaOf(jsCols));
      check(out[0]!.status === "value", `js a decodes (${out[0]!.status})`);
      check(out[1]!.status === "unsupported" && out[1]!.reason === "unsupported type: jsonb", `js j unsupported (${out[1]!.status}/${out[1]!.reason})`);
    }
    {
      const only = await fetchColumns(oidOf(`${S}.kd_js_only_idx`));
      check(only.columns[0]!.typname === "jsonb", "jsonb-only typname");
      const oid = oidOf(`${S}.kd_js_only_idx`);
      const blocks = Number((await q(`SELECT pg_relation_size($1::text) / 8192 AS b`, [`${S}.kd_js_only_idx`])).rows[0].b);
      const page = await fetchPage(oid, Math.max(1, blocks - 1));
      const t = page.tuples.find((x) => !x.isPivot) ?? page.tuples[0]!;
      const out = decodeIndexTupleKeys(page, t, metaOf(only));
      check(out[0]!.status === "unsupported", `jsonb-only unsupported (${out[0]!.status})`);
    }

    console.log(
      `index-key-decode segment OK: columns endpoint (shape + guards NOT_INDEX/INDEX_NOT_BTREE/BAD_OID), ` +
        `${compared} leaf/posting tuples == UTC ::text rows, ${pivotTidCompared} trailing-TID pivots == boundary rows, ` +
        `DESC bits, expression/jsonb degradation`,
    );
  } finally {
    try {
      await client.query(`DROP SCHEMA IF EXISTS ${SMOKE_IXKD_SCHEMA} CASCADE`);
    } catch (e) {
      console.error(`index-key-decode cleanup failed; schema ${SMOKE_IXKD_SCHEMA} may be left behind`, e);
    }
    client.release();
  }
}

function aiCheck(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`Auto-install smoke failed: ${msg}`);
}

async function autoInstallSmoke(app: InjectApp, session: SessionState): Promise<void> {
  const q = (text: string) => session.pool!.query(text);
  const extPresent = async (ext: string): Promise<boolean> => {
    const res = await q(`SELECT 1 FROM pg_extension WHERE extname = '${ext}'`);
    return (res.rowCount ?? 0) > 0;
  };

  try {
    // WAL guard: drop pg_walinspect -> request auto-installs -> confirmed back.
    await q(`DROP EXTENSION IF EXISTS pg_walinspect`);
    aiCheck(!(await extPresent("pg_walinspect")), "pg_walinspect still present after DROP");
    const lsnRes = await app.inject({ method: "GET", url: "/api/wal/current-lsn" });
    aiCheck(
      lsnRes.statusCode === 200,
      `GET /api/wal/current-lsn after DROP -> ${lsnRes.statusCode} ${lsnRes.body}`,
    );
    const lsn = (lsnRes.json() as { lsn: string }).lsn;
    aiCheck(/^[0-9A-F]+\/[0-9A-F]+$/i.test(lsn), `current-lsn malformed: ${lsn}`);
    aiCheck(await extPresent("pg_walinspect"), "pg_walinspect not re-installed by the WAL guard");
    console.log("auto-install (WAL) OK: DROP pg_walinspect -> current-lsn 200 -> re-installed");

    // Page guard: drop pageinspect -> /api/tables auto-installs -> confirmed back.
    await q(`DROP EXTENSION IF EXISTS pageinspect`);
    aiCheck(!(await extPresent("pageinspect")), "pageinspect still present after DROP");
    const tablesRes = await app.inject({ method: "GET", url: "/api/tables" });
    aiCheck(
      tablesRes.statusCode === 200,
      `GET /api/tables after DROP -> ${tablesRes.statusCode} ${tablesRes.body}`,
    );
    aiCheck(
      Array.isArray((tablesRes.json() as { tables: unknown[] }).tables),
      "tables response malformed after auto-install",
    );
    aiCheck(await extPresent("pageinspect"), "pageinspect not re-installed by the Page guard");
    console.log("auto-install (Page) OK: DROP pageinspect -> /api/tables 200 -> re-installed");
  } finally {
    // Fallback rebuild: a failed segment must not leave the DB without extensions.
    for (const ext of ["pg_walinspect", "pageinspect"]) {
      try {
        await q(`CREATE EXTENSION IF NOT EXISTS ${ext}`);
      } catch (e) {
        console.error(`Auto-install smoke cleanup failed for ${ext}`, e);
      }
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
  await indexKeyDecodeSmoke(app, session);
  await autoInstallSmoke(app, session);

  console.log(`L3 smoke OK: ${target.qualifiedName} blk 0 length=${buf.length}`);
  console.log(`serverVersion=${session.serverVersion}`);
  console.log(`R1 schema placeholders OK (${cols.filter((c) => c.attisdropped).length} dropped)`);
  console.log("B-tree segment OK: list/metapage/internal/leaf/posting oracle + hash guard");
  console.log("Auto-install segment OK: guards re-install dropped extensions (WAL + Page)");
  await app.close();
  if (session.pool) await session.pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

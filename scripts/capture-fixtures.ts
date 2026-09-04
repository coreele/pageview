#!/usr/bin/env tsx
/**
 * Capture real PG 16.11 heap page fixtures via get_raw_page.
 *
 * Prerequisites (manual — this script NEVER runs CREATE EXTENSION):
 *   1. PostgreSQL 16.11 with pageinspect already enabled
 *   2. Role that can call pageinspect.get_raw_page
 *   3. Env: DATABASE_URL or PG* keys
 *
 * Usage:
 *   pnpm exec tsx scripts/capture-fixtures.ts --rel schema.table --blkno 0 --out packages/page-core/fixtures/name
 *
 * Usage (B-tree index page + pageinspect oracle):
 *   pnpm exec tsx scripts/capture-fixtures.ts --index schema.index --blkno 0 --out packages/page-core/fixtures/btree-meta
 *   --index captures the raw page (.bin/.base64.txt/.meta.json) plus an .oracle.json
 *   holding bt_metap (blkno 0 only), bt_page_stats, bt_page_items output, and — for
 *   blkno > 0 — the index-key-decode oracle: indexColumns (pg_attribute/pg_index
 *   metadata mirroring GET /api/indexes/:oid/columns) and tableRows (owning table
 *   row values per tuple TID, UTC session, ::text casts).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import pg from "pg";
import "dotenv/config";

function usage(): never {
  console.error(
    "Usage: capture-fixtures.ts --rel schema.table --blkno N --out packages/page-core/fixtures/<name>\n" +
      "       capture-fixtures.ts --index schema.index --blkno N --out packages/page-core/fixtures/<name>",
  );
  process.exit(1);
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function splitQualified(rel: string): [string, string] {
  return rel.includes(".") ? (rel.split(".", 2) as [string, string]) : ["public", rel];
}

/** Query with error capture: pageinspect rejects metapages for stats/items. */
async function tryQuery(
  client: pg.Client,
  sql: string,
  params: unknown[],
): Promise<{ rows: Record<string, unknown>[]; error: string | null }> {
  try {
    const res = await client.query(sql, params);
    return { rows: res.rows as Record<string, unknown>[], error: null };
  } catch (e) {
    const err = e as { message?: string };
    return { rows: [], error: err.message ?? String(e) };
  }
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Index column metadata + owning-table row values for the decode oracle
 * (design §6.2). The two SQL statements intentionally mirror INDEX_META_SQL /
 * INDEX_COLUMNS_SQL in apps/server/src/catalog.ts — keep them in sync.
 */
async function captureIndexColumnsOracle(
  client: pg.Client,
  idxSchema: string,
  idxName: string,
  items: Record<string, unknown>[],
  pageType: string | null,
): Promise<{
  indexColumns: Record<string, unknown>;
  tableRows: Array<Record<string, unknown>>;
}> {
  const rel = await client.query(
    `SELECT c.oid, x.indrelid, tn.nspname AS table_schema, tc.relname AS table_name
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_index x ON x.indexrelid = c.oid
       JOIN pg_class tc ON tc.oid = x.indrelid
       JOIN pg_namespace tn ON tn.oid = tc.relnamespace
      WHERE n.nspname = $1 AND c.relname = $2`,
    [idxSchema, idxName],
  );
  if (rel.rowCount === 0 || rel.rowCount == null) {
    throw new Error(`Index ${idxSchema}.${idxName} not found or not an index`);
  }
  const idxOid = Number(rel.rows[0]!.oid);
  const indrelid = Number(rel.rows[0]!.indrelid);
  const tableQualified = `${rel.rows[0]!.table_schema}.${rel.rows[0]!.table_name}`;

  const metaRes = await client.query(
    `SELECT x.indnatts, x.indnkeyatts, x.indkey::text AS indkey, x.indoption::text AS indoption
       FROM pg_index x
      WHERE x.indexrelid = $1`,
    [idxOid],
  );
  const colsRes = await client.query(
    `SELECT a.attnum, a.attname AS name, t.oid AS typoid, t.typname, a.atttypmod AS typmod
       FROM pg_attribute a
       JOIN pg_type t ON t.oid = a.atttypid
      WHERE a.attrelid = $1 AND a.attnum > 0
        AND a.attnum <= (SELECT indnatts FROM pg_index WHERE indexrelid = $1)
      ORDER BY a.attnum`,
    [idxOid],
  );
  const meta = metaRes.rows[0]!;
  const indkey = String(meta.indkey)
    .trim()
    .split(/\s+/)
    .filter((s) => s.length > 0)
    .map(Number);

  // Table column names for the indkey positions (position value 0 = expression).
  const tableCols = await client.query<{ attnum: number | string; attname: string }>(
    `SELECT a.attnum, a.attname FROM pg_attribute a
      WHERE a.attrelid = $1 AND a.attnum > 0
      ORDER BY a.attnum`,
    [indrelid],
  );
  const tableColByAttnum = new Map(
    tableCols.rows.map((r) => [Number(r.attnum), r.attname] as const),
  );

  const indexColumns = {
    oid: idxOid,
    tableQualified,
    indnatts: Number(meta.indnatts),
    indnkeyatts: Number(meta.indnkeyatts),
    indkey,
    indoption: String(meta.indoption).trim(),
    hasExpression: indkey.includes(0),
    columns: colsRes.rows.map((r) => ({
      attnum: Number(r.attnum),
      name: r.name,
      typoid: Number(r.typoid),
      typname: r.typname,
      typmod: Number(r.typmod),
    })),
  };

  // Row-value oracle: UTC session, ::text casts, one row per index tuple.
  // Leaf tuples: htid (or first posting TID) is the heap TID. Pivot tuples:
  // htid is the trailing heap TID (the boundary/firstright row) when stored.
  // A pivot's raw ctid is a downlink / self-reference — never a heap row, so
  // it must not be used to look up rows (hikeys on unique indexes have no
  // trailing TID and thus no row).
  const isLeaf = pageType === "l";
  const selectList = indkey
    .map((attnum, i) =>
      attnum === 0
        ? `NULL AS c${i}`
        : `(t.${quoteIdent(tableColByAttnum.get(attnum)!)})::text AS c${i}`,
    )
    .join(", ");
  await client.query(`SET TimeZone = 'UTC'`);
  const tableRows: Array<Record<string, unknown>> = [];
  for (const item of items) {
    let firstTid: string | null = null;
    if (item.dead !== true) {
      if (typeof item.htid === "string" && item.htid.length > 0) {
        firstTid = item.htid;
      } else if (isLeaf && typeof item.tids === "string") {
        const m = /\((\d+),(\d+)\)/.exec(item.tids);
        if (m) firstTid = `(${m[1]},${m[2]})`;
      }
    }
    let values: Array<string | null> | null = null;
    if (firstTid) {
      const rowRes = await client.query(
        `SELECT ${selectList} FROM ${quoteIdent(String(rel.rows[0]!.table_schema))}.${quoteIdent(
          String(rel.rows[0]!.table_name),
        )} t WHERE t.ctid = $1::tid`,
        [firstTid],
      );
      if (rowRes.rowCount && rowRes.rowCount > 0) {
        const r = rowRes.rows[0]!;
        values = indkey.map((_, i) => (r[`c${i}`] ?? null) as string | null);
      }
    }
    tableRows.push({ itemoffset: item.itemoffset, ctid: item.ctid, htid: item.htid, firstTid, values });
  }
  await client.query(`RESET TimeZone`);

  return { indexColumns, tableRows };
}

async function captureIndex(
  client: pg.Client,
  idxSchema: string,
  idxName: string,
  blkno: number,
  outBase: string,
): Promise<void> {
  const qualified = `${idxSchema}.${idxName}`;
  const pageRes = await client.query(
    `SELECT get_raw_page($1, $2::int) AS page`,
    [qualified, blkno],
  );
  const buf: Buffer = pageRes.rows[0].page;
  if (!Buffer.isBuffer(buf) || buf.length !== 8192) {
    throw new Error(`Unexpected page length ${buf?.length}`);
  }

  // pageinspect oracle: bt_metap only meaningful for the metapage itself;
  // bt_page_stats / bt_page_items reject blkno 0 with 22023 "block 0 is a meta page".
  const metap =
    blkno === 0
      ? await tryQuery(client, `SELECT * FROM bt_metap($1)`, [qualified])
      : { rows: [], error: null };
  const stats = await tryQuery(
    client,
    `SELECT * FROM bt_page_stats($1, $2::int)`,
    [qualified, blkno],
  );
  const items = await tryQuery(
    client,
    `SELECT * FROM bt_page_items($1, $2::int)`,
    [qualified, blkno],
  );

  // Decode oracle (index-key-decode T2): index column metadata + owning table
  // row values, both consumed by tests/btree-oracle.test.ts decode assertions.
  const columnsOracle =
    stats.error === null && items.error === null && blkno !== 0
      ? await captureIndexColumnsOracle(
          client,
          idxSchema,
          idxName,
          items.rows,
          stats.rows[0] ? String(stats.rows[0]!.type) : null,
        )
      : { indexColumns: null, tableRows: null };

  mkdirSync(dirname(outBase), { recursive: true });
  writeFileSync(`${outBase}.bin`, buf);
  writeFileSync(`${outBase}.base64.txt`, buf.toString("base64"));
  writeFileSync(
    `${outBase}.meta.json`,
    JSON.stringify(
      { rel: qualified, blkno, mode: "index", capturedAt: new Date().toISOString() },
      null,
      2,
    ),
  );
  writeFileSync(
    `${outBase}.oracle.json`,
    JSON.stringify(
      {
        index: qualified,
        blkno,
        btMetap: metap.rows[0] ?? null,
        btMetapError: metap.error,
        btPageStats: stats.rows[0] ?? null,
        btPageStatsError: stats.error,
        btPageItems: items.rows,
        btPageItemsError: items.error,
        indexColumns: columnsOracle.indexColumns,
        tableRows: columnsOracle.tableRows,
      },
      null,
      2,
    ),
  );
  console.log(
    `Wrote ${outBase}.{bin,base64.txt,meta.json,oracle.json}` +
      ` (statsError=${JSON.stringify(stats.error)}, itemsError=${JSON.stringify(items.error)})`,
  );
}

async function main(): Promise<void> {
  const rel = arg("--rel");
  const indexRel = arg("--index");
  const blkno = arg("--blkno");
  const out = arg("--out");
  if ((!rel && !indexRel) || (rel && indexRel) || blkno === undefined || !out) usage();

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    host: process.env.PGHOST,
    port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
  });

  await client.connect();
  try {
    const ext = await client.query(
      `SELECT 1 FROM pg_extension WHERE extname = 'pageinspect'`,
    );
    if (ext.rowCount === 0) {
      console.error(
        "pageinspect is not installed. Enable it manually:\n  CREATE EXTENSION pageinspect;\nThis tool will not run CREATE EXTENSION for you.",
      );
      process.exit(2);
    }

    const outBase = resolve(out!);

    if (indexRel) {
      const [idxSchema, idxName] = splitQualified(indexRel);
      await captureIndex(client, idxSchema, idxName, Number(blkno), outBase);
    } else {
      const [schema, name] = splitQualified(rel!);

      const pageRes = await client.query(
        `SELECT get_raw_page($1 || '.' || $2, $3::int) AS page`,
        [schema, name, Number(blkno)],
      );
      const buf: Buffer = pageRes.rows[0].page;
      if (!Buffer.isBuffer(buf) || buf.length !== 8192) {
        throw new Error(`Unexpected page length ${buf?.length}`);
      }

      const schemaRes = await client.query(
        `SELECT a.attnum, a.attname AS name, t.typname, a.attlen, a.attalign, a.attisdropped, t.oid AS typoid
       FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_type t ON t.oid = a.atttypid
       WHERE n.nspname = $1 AND c.relname = $2 AND a.attnum > 0
       ORDER BY a.attnum`,
        [schema, name],
      );

      mkdirSync(dirname(outBase), { recursive: true });
      writeFileSync(`${outBase}.bin`, buf);
      writeFileSync(`${outBase}.base64.txt`, buf.toString("base64"));
      writeFileSync(
        `${outBase}.schema.json`,
        JSON.stringify(
          schemaRes.rows.map((r) => ({
            attnum: r.attnum,
            name: r.name,
            typname: r.typname,
            typlen: r.attlen,
            attlen: r.attlen,
            attalign: r.attalign,
            attisdropped: r.attisdropped,
            typoid: Number(r.typoid),
          })),
          null,
          2,
        ),
      );
      writeFileSync(
        `${outBase}.meta.json`,
        JSON.stringify({ rel: `${schema}.${name}`, blkno: Number(blkno), capturedAt: new Date().toISOString() }, null, 2),
      );
      console.log(`Wrote ${outBase}.{bin,base64.txt,schema.json,meta.json}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

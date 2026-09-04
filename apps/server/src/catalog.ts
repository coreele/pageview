/** Shared catalog SQL / mapping for heap tables (pageinspect viewer). */

export const HEAP_BLOCK_SIZE = 8192;

/**
 * Keep attisdropped rows (atttypid=0). INNER JOIN would drop them and
 * misalign heap tuple decoding.
 */
export const SCHEMA_COLUMNS_SQL = `
SELECT a.attnum,
       a.attname AS name,
       COALESCE(t.typname, 'dropped') AS typname,
       a.attlen,
       a.attalign,
       a.attisdropped,
       COALESCE(t.oid, 0) AS typoid
FROM pg_attribute a
LEFT JOIN pg_type t ON t.oid = a.atttypid
WHERE a.attrelid = $1 AND a.attnum > 0
ORDER BY a.attnum
`;

/** On-disk main-fork blocks — relpages can lag until ANALYZE/VACUUM. */
export const LIST_TABLES_SQL = `
SELECT c.oid::bigint AS oid,
       n.nspname AS schema,
       c.relname AS name,
       (pg_relation_size(c.oid) / ${HEAP_BLOCK_SIZE})::int AS blocks
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
  AND n.nspname NOT LIKE 'pg_temp_%'
  AND n.nspname NOT LIKE 'pg_toast_temp_%'
ORDER BY n.nspname, c.relname
`;

export const PAGE_RELATION_SQL = `
SELECT c.oid,
       c.relkind,
       n.nspname,
       c.relname,
       (pg_relation_size(c.oid) / ${HEAP_BLOCK_SIZE})::int AS blocks
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.oid = $1
`;

/** User indexes (index-viewer): qualified name, access method, blocks, table, validity. */
export const LIST_INDEXES_SQL = `
SELECT i.oid::bigint AS oid,
       n.nspname AS schema,
       i.relname AS name,
       am.amname AS access_method,
       (pg_relation_size(i.oid) / ${HEAP_BLOCK_SIZE})::int AS blocks,
       tbl.oid::bigint AS table_oid,
       tn.nspname AS table_schema,
       tbl.relname AS table_name,
       x.indisvalid AS valid
FROM pg_class i
JOIN pg_namespace n ON n.oid = i.relnamespace
JOIN pg_am am ON am.oid = i.relam
JOIN pg_index x ON x.indexrelid = i.oid
JOIN pg_class tbl ON tbl.oid = x.indrelid
JOIN pg_namespace tn ON tn.oid = tbl.relnamespace
WHERE i.relkind = 'i'
  AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
  AND n.nspname NOT LIKE 'pg_temp_%'
  AND n.nspname NOT LIKE 'pg_toast_temp_%'
ORDER BY n.nspname, i.relname
`;

/** Single lookup for the index page guard chain: relkind, am, name, blocks. */
export const INDEX_RELATION_SQL = `
SELECT c.oid,
       c.relkind,
       am.amname AS access_method,
       n.nspname,
       c.relname,
       (pg_relation_size(c.oid) / ${HEAP_BLOCK_SIZE})::int AS blocks
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_am am ON am.oid = c.relam
WHERE c.oid = $1
`;

/**
 * Index-key-decode: pg_index metadata for GET /api/indexes/:oid/columns.
 * indkey/indoption come back as ::text (e.g. "1 2 3" / "1 0") and are
 * parsed in TS — hasExpression = indkey contains 0; indoption bit 0 = DESC,
 * bit 1 = NULLS FIRST (key columns only; PG records defaults explicitly).
 */
export const INDEX_META_SQL = `
SELECT x.indnatts,
       x.indnkeyatts,
       x.indkey::text AS indkey,
       x.indoption::text AS indoption
FROM pg_index x
WHERE x.indexrelid = $1
`;

/**
 * Index-key-decode: index's own pg_attribute rows (attnum 1..indnatts — the
 * btree storage datum types) JOIN pg_type, ordered by attnum (= decode
 * order). No attisdropped filter: indexes have no dropped placeholders
 * (DROP COLUMN on the table drops the index) — Spec ruling.
 *
 * P1 domains: a domain's pg_attribute row carries the DOMAIN's oid; btree
 * stores and compares the BASE type's datum, so typtype='d' rows are
 * substituted with their typbasetype (oid + typname; response shape
 * unchanged — pure SQL-side resolution).
 */
export const INDEX_COLUMNS_SQL = `
SELECT a.attnum,
       a.attname AS name,
       CASE WHEN t.typtype = 'd' THEN bt.oid ELSE t.oid END AS typoid,
       CASE WHEN t.typtype = 'd' THEN bt.typname ELSE t.typname END AS typname,
       a.atttypmod AS typmod
FROM pg_attribute a
JOIN pg_type t ON t.oid = a.atttypid
LEFT JOIN pg_type bt ON t.typtype = 'd' AND bt.oid = t.typbasetype
WHERE a.attrelid = $1 AND a.attnum > 0
  AND a.attnum <= (SELECT indnatts FROM pg_index WHERE indexrelid = $1)
ORDER BY a.attnum
`;

/** Parsed indkey/indoption ints for the columns response ("1 2 3" → [1,2,3]). */
export function parseIntVector(text: string | null | undefined): number[] {
  if (text == null) return [];
  return String(text)
    .trim()
    .split(/\s+/)
    .filter((s) => s.length > 0)
    .map(Number);
}

export function relationBlocksFromSize(byteLength: number, blockSize = HEAP_BLOCK_SIZE): number {
  return Math.max(0, Math.floor(Number(byteLength) / blockSize));
}

export function mapSchemaColumnRow(r: {
  attnum: number | string;
  name: string;
  typname: string | null;
  attlen: number | string;
  attalign: string;
  attisdropped: boolean;
  typoid: number | string | null;
}): {
  attnum: number;
  name: string;
  typname: string;
  typlen: number;
  attlen: number;
  attalign: string;
  attisdropped: boolean;
  typoid: number;
} {
  const attlen = Number(r.attlen);
  return {
    attnum: Number(r.attnum),
    name: r.name,
    typname: r.typname ?? "dropped",
    typlen: attlen,
    attlen,
    attalign: r.attalign,
    attisdropped: Boolean(r.attisdropped),
    typoid: r.typoid == null ? 0 : Number(r.typoid),
  };
}

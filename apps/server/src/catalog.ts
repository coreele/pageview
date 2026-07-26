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

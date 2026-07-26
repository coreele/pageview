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
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import pg from "pg";
import "dotenv/config";

function usage(): never {
  console.error(
    "Usage: capture-fixtures.ts --rel schema.table --blkno N --out packages/page-core/fixtures/<name>",
  );
  process.exit(1);
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const rel = arg("--rel");
  const blkno = arg("--blkno");
  const out = arg("--out");
  if (!rel || blkno === undefined || !out) usage();

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

    const [schema, name] = rel!.includes(".")
      ? (rel!.split(".", 2) as [string, string])
      : ["public", rel!];

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

    const outBase = resolve(out!);
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
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

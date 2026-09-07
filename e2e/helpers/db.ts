import { createRequire } from "node:module";
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { readEnvCredentials } from "../../apps/server/dist/session.js";

export const repoRoot = process.cwd();
export const seedPath = resolve(repoRoot, "e2e/.seed.json");

const requireFromServer = createRequire(resolve(repoRoot, "apps/server/package.json"));

export type SeedState = {
  heapOid: number;
  heapName: string;
  heapBlocks: number;
  btreeOid: number;
  btreeName: string;
  emptyOid: number;
  emptyName: string;
  hashHeapOid: number;
  hashIndexOid: number;
  hashIndexName: string;
  startLsn: string;
  endLsn: string;
};

function loadDotenv(): void {
  const dotenv = requireFromServer("dotenv") as { config: (opts?: { path?: string }) => void };
  dotenv.config({ path: resolve(repoRoot, ".env") });
  dotenv.config();
}

export function envCredentials(): NonNullable<ReturnType<typeof readEnvCredentials>> {
  loadDotenv();
  const creds = readEnvCredentials();
  if (!creds) {
    throw new Error(
      "E2E blocked: no PG credentials (set DATABASE_URL or PGHOST/PGDATABASE/PGUSER/PGPASSWORD)",
    );
  }
  return creds;
}

function client() {
  loadDotenv();
  const { Client } = requireFromServer("pg") as typeof import("pg");
  const creds = envCredentials();
  return new Client({
    host: creds.host,
    port: creds.port,
    database: creds.database,
    user: creds.user,
    password: creds.password,
  });
}

async function oidOf(c: { query: (q: string) => Promise<{ rows: Array<{ oid: string }> }> }, regclass: string): Promise<number> {
  const r = await c.query(`SELECT ${regclass}::regclass::oid AS oid`);
  const oid = Number(r.rows[0]?.oid);
  if (!Number.isInteger(oid) || oid < 1) {
    throw new Error(`E2E blocked: could not resolve oid for ${regclass}`);
  }
  return oid;
}

export async function seedDatabase(): Promise<SeedState> {
  const c = client();
  try {
    await c.connect();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`E2E blocked: cannot connect to PostgreSQL (${msg})`);
  }
  try {
    await c.query("DROP SCHEMA IF EXISTS pageview_e2e CASCADE");
    await c.query("CREATE SCHEMA pageview_e2e");
    await c.query("CREATE TABLE pageview_e2e.heap_multi (id int, payload text)");
    await c.query(
      "INSERT INTO pageview_e2e.heap_multi SELECT g, md5(g::text) FROM generate_series(1, 3000) g",
    );
    await c.query("CREATE INDEX heap_multi_id_idx ON pageview_e2e.heap_multi USING btree (id)");
    await c.query("CREATE TABLE pageview_e2e.empty_heap (id int)");
    await c.query("CREATE TABLE pageview_e2e.hash_heap (id int)");
    await c.query("INSERT INTO pageview_e2e.hash_heap VALUES (1)");
    await c.query("CREATE INDEX hash_heap_id_idx ON pageview_e2e.hash_heap USING hash (id)");

    const start = await c.query("SELECT pg_current_wal_lsn()::text AS lsn");
    await c.query(
      "INSERT INTO pageview_e2e.heap_multi SELECT g, md5(g::text) FROM generate_series(3001, 3100) g",
    );
    const end = await c.query("SELECT pg_current_wal_lsn()::text AS lsn");

    const heapOid = await oidOf(c, "'pageview_e2e.heap_multi'");
    const btreeOid = await oidOf(c, "'pageview_e2e.heap_multi_id_idx'");
    const emptyOid = await oidOf(c, "'pageview_e2e.empty_heap'");
    const hashHeapOid = await oidOf(c, "'pageview_e2e.hash_heap'");
    const hashIndexOid = await oidOf(c, "'pageview_e2e.hash_heap_id_idx'");
    const rel = await c.query(
      "SELECT relpages::int AS blocks FROM pg_class WHERE oid = $1",
      [heapOid],
    );
    const heapBlocks = Number(rel.rows[0]?.blocks);
    if (!Number.isInteger(heapBlocks) || heapBlocks < 8) {
      throw new Error(
        `E2E blocked: heap_multi has ${heapBlocks} pages (need ≥8 for blk 5→7 nav)`,
      );
    }
    const startLsn = String(start.rows[0]?.lsn ?? "");
    const endLsn = String(end.rows[0]?.lsn ?? "");
    if (!startLsn || !endLsn) {
      throw new Error("E2E blocked: could not capture WAL window LSNs");
    }
    const seed: SeedState = {
      heapOid,
      heapName: "pageview_e2e.heap_multi",
      heapBlocks,
      btreeOid,
      btreeName: "pageview_e2e.heap_multi_id_idx",
      emptyOid,
      emptyName: "pageview_e2e.empty_heap",
      hashHeapOid,
      hashIndexOid,
      hashIndexName: "pageview_e2e.hash_heap_id_idx",
      startLsn,
      endLsn,
    };
    mkdirSync(dirname(seedPath), { recursive: true });
    writeFileSync(seedPath, JSON.stringify(seed, null, 2));
    return seed;
  } finally {
    await c.end();
  }
}

export async function dropSeed(): Promise<void> {
  const c = client();
  try {
    await c.connect();
    await c.query("DROP SCHEMA IF EXISTS pageview_e2e CASCADE");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`E2E teardown: failed to drop pageview_e2e (${msg})`);
  } finally {
    await c.end().catch(() => undefined);
  }
}

export function readSeed(): SeedState {
  return JSON.parse(readFileSync(seedPath, "utf8")) as SeedState;
}

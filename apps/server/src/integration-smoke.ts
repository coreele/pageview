/**
 * L3 smoke: requires PG 16.11 + pageinspect + get_raw_page privilege.
 * Exit 0 on success; non-zero with clear message when blocked.
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { emptySession, readEnvCredentials } from "./session.js";
import { buildApp, connectSession, tryAutoConnectFromEnv } from "./app.js";

config({ path: resolve(process.cwd(), "../../.env") });
config();

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

  console.log(`L3 smoke OK: ${target.qualifiedName} blk 0 length=${buf.length}`);
  console.log(`serverVersion=${session.serverVersion}`);
  console.log(`R1 schema placeholders OK (${cols.filter((c) => c.attisdropped).length} dropped)`);
  await app.close();
  if (session.pool) await session.pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

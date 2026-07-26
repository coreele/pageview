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

  console.log(`L3 smoke OK: ${target.qualifiedName} blk 0 length=${buf.length}`);
  console.log(`serverVersion=${session.serverVersion}`);
  await app.close();
  if (session.pool) await session.pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

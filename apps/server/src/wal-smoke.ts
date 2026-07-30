/**
 * One-shot WAL L3 smoke (not part of package scripts unless promoted later).
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { emptySession, readEnvCredentials } from "./session.js";
import { buildApp, connectSession } from "./app.js";

config({ path: resolve(process.cwd(), "../../.env") });
config();

async function main(): Promise<void> {
  const creds = readEnvCredentials();
  if (!creds) {
    console.error("WAL L3 blocked: no credentials");
    process.exit(2);
  }
  const session = emptySession();
  await connectSession(session, creds);
  const { app } = await buildApp(session);
  await app.ready();

  const lsnRes = await app.inject({ method: "GET", url: "/api/wal/current-lsn" });
  console.log("current-lsn", lsnRes.statusCode, lsnRes.json());
  if (lsnRes.statusCode !== 200) {
    console.error("WAL L3 blocked or failed at current-lsn");
    process.exit(lsnRes.statusCode === 400 ? 2 : 1);
  }

  const { lsn } = lsnRes.json() as { lsn: string };
  const emptyish = await app.inject({
    method: "GET",
    url: `/api/wal/records?startLsn=${encodeURIComponent(lsn)}&endLsn=${encodeURIComponent(lsn)}`,
  });
  const emptyBody = emptyish.json() as { records?: unknown[] };
  console.log("records-point", emptyish.statusCode, emptyBody);

  const oversized = await app.inject({
    method: "GET",
    url: "/api/wal/records?startLsn=0/0&endLsn=1/0",
  });
  const oversizedBody = oversized.json() as { code?: string; records?: unknown; nextStep?: string };
  console.log("r3-oversized", oversized.statusCode, oversizedBody.code, "hasRecords", "records" in oversizedBody);

  await app.close();
  if (session.pool) await session.pool.end();
  const tipOk =
    emptyish.statusCode === 200 &&
    Array.isArray(emptyBody.records) &&
    emptyBody.records.length === 0;
  const r3Ok =
    oversized.statusCode === 400 &&
    oversizedBody.code === "WAL_BATCH_TOO_LARGE" &&
    !("records" in oversizedBody);
  if (!tipOk || !r3Ok) {
    process.exit(1);
  }
  console.log("WAL L3 smoke OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

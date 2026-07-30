import Fastify from "fastify";
import cors from "@fastify/cors";
import pg from "pg";
import {
  LIST_TABLES_SQL,
  PAGE_RELATION_SQL,
  SCHEMA_COLUMNS_SQL,
  mapSchemaColumnRow,
} from "./catalog.js";
import {
  emptySession,
  PAGEINSPECT_NEXT,
  readEnvCredentials,
  requirePageinspect,
  toPublicSession,
  type AppErrorBody,
  type ConnectBody,
  type SessionState,
} from "./session.js";
import {
  classifyWalinspectError,
  fetchCurrentWalLsn,
  fetchRecentWalWindow,
  fetchWalRecords,
  mapWalGateError,
  parseRecentWindowLimit,
  requireWalCapabilities,
} from "./wal.js";

const { Pool } = pg;

function appError(
  statusCode: number,
  code: string,
  message: string,
  nextStep: string,
): { statusCode: number; body: AppErrorBody } {
  return { statusCode, body: { code, message, nextStep } };
}

function mapPgError(e: unknown): { statusCode: number; body: AppErrorBody } {
  const err = e as { code?: string; message?: string; nextStep?: string; errno?: string; reason?: string };
  if (err.code === "PAGEINSPECT_MISSING") {
    return appError(
      400,
      "PAGEINSPECT_MISSING",
      err.message ?? "pageinspect missing",
      err.nextStep ?? PAGEINSPECT_NEXT,
    );
  }
  if (
    err.code === "WALINSPECT_MISSING" ||
    err.code === "PG_VERSION_UNSUPPORTED" ||
    err.code === "WAL_BATCH_TOO_LARGE" ||
    err.code === "BAD_LSN" ||
    err.code === "NOT_CONNECTED"
  ) {
    return mapWalGateError({
      code: err.code,
      message: err.message,
      nextStep: err.nextStep,
      reason: err.reason,
    });
  }
  if (err.code === "28P01" || err.code === "28000") {
    return appError(
      401,
      "AUTH_FAILED",
      err.message ?? "Authentication failed",
      "Check user/password and pg_hba.conf, then retry Connect.",
    );
  }
  if (err.code === "3D000") {
    return appError(
      400,
      "DB_NOT_FOUND",
      err.message ?? "Database does not exist",
      "Create the database or correct the database name, then retry.",
    );
  }
  if (err.code === "ECONNREFUSED" || err.errno === "ECONNREFUSED") {
    return appError(
      503,
      "CONN_REFUSED",
      "Connection refused",
      "Ensure PostgreSQL is running and host/port are correct, then retry.",
    );
  }
  if (err.code === "42501") {
    return appError(
      403,
      "PERMISSION",
      err.message ?? "Permission denied",
      "Use a role with privileges for the requested operation (pageinspect or pg_walinspect), then retry.",
    );
  }
  // Invalid LSN cast / walinspect argument errors
  if (err.code === "22023" || err.code === "22P02") {
    const classified = classifyWalinspectError(err.message ?? "");
    if (classified) {
      return mapWalGateError(classified);
    }
    return appError(
      400,
      "BAD_LSN",
      err.message ?? "Invalid LSN",
      "Enter valid start/end LSN values as XX/YYYYYYYY with start ≤ end, then retry.",
    );
  }
  // pg_walinspect / xlogreader often uses XX000 with a readable message (DEF-1/DEF-2).
  const walClassified = classifyWalinspectError(err.message ?? "");
  if (walClassified) {
    return mapWalGateError(walClassified);
  }
  return appError(
    500,
    "INTERNAL",
    err.message ?? "Unexpected error",
    "Inspect server logs, fix the underlying issue, then retry.",
  );
}

export type Creds = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
};

export async function connectSession(session: SessionState, creds: Creds): Promise<void> {
  if (session.pool) {
    await session.pool.end().catch(() => undefined);
    session.pool = null;
  }
  session.connected = false;
  session.password = creds.password;
  session.host = creds.host;
  session.port = creds.port;
  session.database = creds.database;
  session.user = creds.user;
  session.serverVersion = null;

  const pool = new Pool({
    host: creds.host,
    port: creds.port,
    database: creds.database,
    user: creds.user,
    password: creds.password,
    max: 4,
    connectionTimeoutMillis: 10_000,
  });

  const client = await pool.connect();
  let released = false;
  try {
    const ver = await client.query("SELECT version() AS v");
    session.serverVersion = String(ver.rows[0].v);
    // Connect only checks connectivity + version; extensions are enforced per mode.
    session.pool = pool;
    session.connected = true;
    session.lastError = null;
  } catch (e) {
    // Release before pool.end(); ending while a client is checked out deadlocks.
    client.release();
    released = true;
    await pool.end().catch(() => undefined);
    session.pool = null;
    session.connected = false;
    session.password = null;
    const mapped = mapPgError(e);
    session.lastError = mapped.body;
    const err = new Error(mapped.body.message) as Error & {
      statusCode: number;
      body: AppErrorBody;
    };
    err.statusCode = mapped.statusCode;
    err.body = mapped.body;
    throw err;
  } finally {
    if (!released) client.release();
  }
}

export async function tryAutoConnectFromEnv(session: SessionState): Promise<void> {
  const creds = readEnvCredentials();
  if (!creds) return;
  try {
    await connectSession(session, creds);
  } catch {
    // Keep process up; lastError is on session for /api/session
  }
}

function notConnectedReply(reply: { code: (n: number) => { send: (b: AppErrorBody) => unknown } }) {
  return reply
    .code(401)
    .send(
      appError(401, "NOT_CONNECTED", "Not connected", "Connect via the form or configure env credentials, then retry.")
        .body,
    );
}

export async function buildApp(session: SessionState = emptySession()) {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  app.get("/api/health", async () => ({ ok: true }));

  app.get("/api/session", async () => toPublicSession(session));

  app.post<{ Body: ConnectBody }>("/api/connect", async (req, reply) => {
    try {
      const body = req.body;
      let creds: Creds | null = null;
      if (body && typeof body === "object" && "source" in body && body.source === "env") {
        creds = readEnvCredentials();
        if (!creds) {
          const err = appError(
            400,
            "ENV_INCOMPLETE",
            "Environment connection settings are incomplete",
            "Set DATABASE_URL or PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD, then retry with source=env or use the UI form.",
          );
          session.lastError = err.body;
          return reply.code(err.statusCode).send(err.body);
        }
      } else if (body && typeof body === "object" && "host" in body && "database" in body && "user" in body) {
        creds = {
          host: String(body.host),
          port: Number((body as { port?: number }).port ?? 5432),
          database: String(body.database),
          user: String(body.user),
          password: String((body as { password?: string }).password ?? ""),
        };
      } else {
        const err = appError(
          400,
          "BAD_REQUEST",
          "Invalid connect body",
          'Submit host/port/database/user/password, or { "source": "env" }.',
        );
        return reply.code(err.statusCode).send(err.body);
      }

      await connectSession(session, creds);
      return toPublicSession(session);
    } catch (e) {
      const err = e as { statusCode?: number; body?: AppErrorBody };
      if (err.body && err.statusCode) {
        return reply.code(err.statusCode).send(err.body);
      }
      const mapped = mapPgError(e);
      return reply.code(mapped.statusCode).send(mapped.body);
    }
  });

  app.get("/api/tables", async (_req, reply) => {
    if (!session.connected || !session.pool) {
      return notConnectedReply(reply);
    }
    try {
      await requirePageinspect(session.pool);
      const res = await session.pool.query(LIST_TABLES_SQL);
      return {
        tables: res.rows.map((r) => ({
          oid: Number(r.oid),
          schema: r.schema,
          name: r.name,
          qualifiedName: `${r.schema}.${r.name}`,
          blocks: Number(r.blocks),
        })),
      };
    } catch (e) {
      const mapped = mapPgError(e);
      return reply.code(mapped.statusCode).send(mapped.body);
    }
  });

  app.get<{ Params: { oid: string } }>("/api/tables/:oid/schema", async (req, reply) => {
    if (!session.connected || !session.pool) {
      return notConnectedReply(reply);
    }
    try {
      await requirePageinspect(session.pool);
      const oid = Number(req.params.oid);
      const cls = await session.pool.query(
        `SELECT c.oid, c.relkind, n.nspname, c.relname
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE c.oid = $1`,
        [oid],
      );
      if (cls.rowCount === 0 || cls.rows[0].relkind !== "r") {
        return reply
          .code(404)
          .send(
            appError(404, "NOT_HEAP_TABLE", "Relation is not a user heap table", "Pick a heap user table from the list.")
              .body,
          );
      }
      const cols = await session.pool.query(SCHEMA_COLUMNS_SQL, [oid]);
      return {
        oid,
        schema: cls.rows[0].nspname,
        name: cls.rows[0].relname,
        qualifiedName: `${cls.rows[0].nspname}.${cls.rows[0].relname}`,
        columns: cols.rows.map((r) => mapSchemaColumnRow(r)),
      };
    } catch (e) {
      const mapped = mapPgError(e);
      return reply.code(mapped.statusCode).send(mapped.body);
    }
  });

  app.get<{ Params: { oid: string; blkno: string } }>(
    "/api/tables/:oid/pages/:blkno",
    async (req, reply) => {
      if (!session.connected || !session.pool) {
        return notConnectedReply(reply);
      }
      try {
        await requirePageinspect(session.pool);
        const oid = Number(req.params.oid);
        const blkno = Number(req.params.blkno);
        if (!Number.isInteger(blkno) || blkno < 0) {
          return reply
            .code(400)
            .send(
              appError(
                400,
                "BAD_BLKNO",
                "Invalid block number",
                "Enter a non-negative integer blkno within the relation block count.",
              ).body,
            );
        }

        const cls = await session.pool.query(PAGE_RELATION_SQL, [oid]);
        if (cls.rowCount === 0 || cls.rows[0].relkind !== "r") {
          return reply
            .code(404)
            .send(
              appError(404, "NOT_HEAP_TABLE", "Relation is not a user heap table", "Pick a heap user table from the list.")
                .body,
            );
        }
        const blocks = Number(cls.rows[0].blocks);
        if (blkno >= blocks) {
          return reply
            .code(400)
            .send(
              appError(
                400,
                "BLKNO_OUT_OF_RANGE",
                `Block ${blkno} is out of range (relation has ${blocks} block(s))`,
                `Choose blkno in 0..${Math.max(0, blocks - 1)} or pick another table.`,
              ).body,
            );
        }

        const qualified = `${cls.rows[0].nspname}.${cls.rows[0].relname}`;
        const pageRes = await session.pool.query(`SELECT get_raw_page($1, $2::int) AS page`, [
          qualified,
          blkno,
        ]);
        const buf: Buffer = pageRes.rows[0].page;
        if (!Buffer.isBuffer(buf)) {
          return reply
            .code(500)
            .send(
              appError(500, "BAD_PAGE", "get_raw_page returned unexpected type", "Check pageinspect installation and retry.")
                .body,
            );
        }
        return {
          oid,
          blkno,
          qualifiedName: qualified,
          byteLength: buf.length,
          pageBase64: buf.toString("base64"),
        };
      } catch (e) {
        const mapped = mapPgError(e);
        return reply.code(mapped.statusCode).send(mapped.body);
      }
    },
  );

  app.get("/api/wal/current-lsn", async (_req, reply) => {
    if (!session.connected || !session.pool) {
      return notConnectedReply(reply);
    }
    try {
      await requireWalCapabilities(session.pool, session.serverVersion);
      const lsn = await fetchCurrentWalLsn(session.pool);
      return { lsn };
    } catch (e) {
      const mapped = mapPgError(e);
      return reply.code(mapped.statusCode).send(mapped.body);
    }
  });

  app.get<{ Querystring: { limit?: string } }>(
    "/api/wal/recent-window",
    async (req, reply) => {
      if (!session.connected || !session.pool) {
        return notConnectedReply(reply);
      }
      const parsed = parseRecentWindowLimit(req.query.limit);
      if (!parsed.ok) {
        return reply.code(400).send(
          appError(400, parsed.code, parsed.message, parsed.nextStep).body,
        );
      }
      try {
        await requireWalCapabilities(session.pool, session.serverVersion);
        const window = await fetchRecentWalWindow(session.pool, parsed.limit);
        // Fill helper only — never attach records[]
        return {
          startLsn: window.startLsn,
          endLsn: window.endLsn,
          count: window.count,
        };
      } catch (e) {
        const mapped = mapPgError(e);
        return reply.code(mapped.statusCode).send(mapped.body);
      }
    },
  );

  app.get<{ Querystring: { startLsn?: string; endLsn?: string } }>(
    "/api/wal/records",
    async (req, reply) => {
      if (!session.connected || !session.pool) {
        return notConnectedReply(reply);
      }
      const startLsn = req.query.startLsn?.trim() ?? "";
      const endLsn = req.query.endLsn?.trim() ?? "";
      if (!startLsn || !endLsn) {
        return reply
          .code(400)
          .send(
            appError(
              400,
              "BAD_LSN",
              "startLsn and endLsn are required",
              "Provide both startLsn and endLsn query parameters, then retry.",
            ).body,
          );
      }
      try {
        await requireWalCapabilities(session.pool, session.serverVersion);
        const records = await fetchWalRecords(session.pool, startLsn, endLsn);
        return { records, startLsn, endLsn, count: records.length };
      } catch (e) {
        const mapped = mapPgError(e);
        // Hard error: never attach partial records
        return reply.code(mapped.statusCode).send(mapped.body);
      }
    },
  );

  return { app, session };
}

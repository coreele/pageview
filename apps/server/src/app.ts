import Fastify from "fastify";
import cors from "@fastify/cors";
import pg from "pg";
import {
  emptySession,
  PAGEINSPECT_NEXT,
  readEnvCredentials,
  toPublicSession,
  verifyPageinspect,
  type AppErrorBody,
  type ConnectBody,
  type SessionState,
} from "./session.js";

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
  const err = e as { code?: string; message?: string; nextStep?: string; errno?: string };
  if (err.code === "PAGEINSPECT_MISSING") {
    return appError(
      400,
      "PAGEINSPECT_MISSING",
      err.message ?? "pageinspect missing",
      err.nextStep ?? PAGEINSPECT_NEXT,
    );
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
      "Use a role with privileges to call pageinspect.get_raw_page (often superuser), then retry.",
    );
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
  });

  const client = await pool.connect();
  try {
    const ver = await client.query("SELECT version() AS v");
    session.serverVersion = String(ver.rows[0].v);
    await verifyPageinspect(client);
    session.pool = pool;
    session.connected = true;
    session.lastError = null;
  } catch (e) {
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
    client.release();
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
      return reply
        .code(401)
        .send(
          appError(401, "NOT_CONNECTED", "Not connected", "Connect via the form or configure env credentials, then retry.")
            .body,
        );
    }
    const res = await session.pool.query(
      `SELECT c.oid::bigint AS oid,
              n.nspname AS schema,
              c.relname AS name,
              GREATEST(c.relpages, 0)::int AS blocks
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE c.relkind = 'r'
         AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
         AND n.nspname NOT LIKE 'pg_temp_%'
         AND n.nspname NOT LIKE 'pg_toast_temp_%'
       ORDER BY n.nspname, c.relname`,
    );
    return {
      tables: res.rows.map((r) => ({
        oid: Number(r.oid),
        schema: r.schema,
        name: r.name,
        qualifiedName: `${r.schema}.${r.name}`,
        blocks: Number(r.blocks),
      })),
    };
  });

  app.get<{ Params: { oid: string } }>("/api/tables/:oid/schema", async (req, reply) => {
    if (!session.connected || !session.pool) {
      return reply
        .code(401)
        .send(appError(401, "NOT_CONNECTED", "Not connected", "Connect first, then retry.").body);
    }
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
    const cols = await session.pool.query(
      `SELECT a.attnum, a.attname AS name, t.typname, a.attlen, a.attalign, a.attisdropped, t.oid AS typoid
       FROM pg_attribute a
       JOIN pg_type t ON t.oid = a.atttypid
       WHERE a.attrelid = $1 AND a.attnum > 0
       ORDER BY a.attnum`,
      [oid],
    );
    return {
      oid,
      schema: cls.rows[0].nspname,
      name: cls.rows[0].relname,
      qualifiedName: `${cls.rows[0].nspname}.${cls.rows[0].relname}`,
      columns: cols.rows.map((r) => ({
        attnum: Number(r.attnum),
        name: r.name,
        typname: r.typname,
        typlen: Number(r.attlen),
        attlen: Number(r.attlen),
        attalign: r.attalign,
        attisdropped: Boolean(r.attisdropped),
        typoid: Number(r.typoid),
      })),
    };
  });

  app.get<{ Params: { oid: string; blkno: string } }>(
    "/api/tables/:oid/pages/:blkno",
    async (req, reply) => {
      if (!session.connected || !session.pool) {
        return reply
          .code(401)
          .send(appError(401, "NOT_CONNECTED", "Not connected", "Connect first, then retry.").body);
      }
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

      const cls = await session.pool.query(
        `SELECT c.oid, c.relkind, c.relpages, n.nspname, c.relname
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
      const blocks = Number(cls.rows[0].relpages);
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
      try {
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

  return { app, session };
}

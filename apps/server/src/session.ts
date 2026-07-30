import type { Pool, PoolClient } from "pg";

export type ConnectBody =
  | {
      host: string;
      port: number;
      database: string;
      user: string;
      password: string;
    }
  | { source: "env" };

export type PublicSession = {
  connected: boolean;
  host: string | null;
  port: number | null;
  database: string | null;
  user: string | null;
  serverVersion: string | null;
  error?: AppErrorBody | null;
};

export type AppErrorBody = {
  code: string;
  message: string;
  nextStep: string;
};

export type SessionState = {
  connected: boolean;
  pool: Pool | null;
  host: string | null;
  port: number | null;
  database: string | null;
  user: string | null;
  /** Never serialized to clients */
  password: string | null;
  serverVersion: string | null;
  lastError: AppErrorBody | null;
};

export function emptySession(): SessionState {
  return {
    connected: false,
    pool: null,
    host: null,
    port: null,
    database: null,
    user: null,
    password: null,
    serverVersion: null,
    lastError: null,
  };
}

export function toPublicSession(s: SessionState): PublicSession {
  return {
    connected: s.connected,
    host: s.host,
    port: s.port,
    database: s.database,
    user: s.user,
    serverVersion: s.serverVersion,
    error: s.connected ? null : s.lastError,
  };
}

export function readEnvCredentials(): {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
} | null {
  if (process.env.DATABASE_URL) {
    try {
      const u = new URL(process.env.DATABASE_URL);
      return {
        host: u.hostname || "127.0.0.1",
        port: u.port ? Number(u.port) : 5432,
        database: decodeURIComponent(u.pathname.replace(/^\//, "")) || "postgres",
        user: decodeURIComponent(u.username),
        password: decodeURIComponent(u.password),
      };
    } catch {
      return null;
    }
  }
  const host = process.env.PGHOST;
  const database = process.env.PGDATABASE;
  const user = process.env.PGUSER;
  const password = process.env.PGPASSWORD;
  if (!host || !database || !user || password === undefined) return null;
  return {
    host,
    port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
    database,
    user,
    password,
  };
}

export const PAGEINSPECT_NEXT =
  "Enable pageinspect manually as a superuser: CREATE EXTENSION pageinspect; then retry the Page request. This app will not run CREATE EXTENSION for you.";

export const WALINSPECT_NEXT =
  "Enable pg_walinspect manually as a superuser: CREATE EXTENSION pg_walinspect; then retry. This app will not run CREATE EXTENSION for you.";

export const PG_VERSION_WAL_MIN = 15;

export function parsePgMajorVersion(versionText: string): number | null {
  const m = /PostgreSQL\s+(\d+)/i.exec(versionText);
  if (!m?.[1]) return null;
  return Number(m[1]);
}

export function isWalPgVersionSupported(major: number | null): boolean {
  return major != null && major >= PG_VERSION_WAL_MIN;
}

type GateError = Error & { code: string; nextStep: string };

function gateError(code: string, message: string, nextStep: string): GateError {
  const err = new Error(message) as GateError;
  err.code = code;
  err.nextStep = nextStep;
  return err;
}

export async function verifyPageinspect(client: PoolClient): Promise<void> {
  const ext = await client.query(`SELECT 1 FROM pg_extension WHERE extname = 'pageinspect'`);
  if (ext.rowCount === 0) {
    throw gateError(
      "PAGEINSPECT_MISSING",
      "pageinspect extension is not installed",
      PAGEINSPECT_NEXT,
    );
  }
  // Prove callable without fetching a real page
  await client.query(`SELECT to_regprocedure('pageinspect.get_raw_page(text, int4)') IS NOT NULL AS ok`);
}

export async function verifyWalinspect(client: PoolClient): Promise<void> {
  const ext = await client.query(`SELECT 1 FROM pg_extension WHERE extname = 'pg_walinspect'`);
  if (ext.rowCount === 0) {
    throw gateError(
      "WALINSPECT_MISSING",
      "pg_walinspect extension is not installed",
      WALINSPECT_NEXT,
    );
  }
  await client.query(
    `SELECT to_regprocedure('pg_walinspect.pg_get_wal_records_info(pg_lsn, pg_lsn)') IS NOT NULL AS ok`,
  );
}

/** Require connected + pageinspect for Page-mode routes. */
export async function requirePageinspect(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await verifyPageinspect(client);
  } finally {
    client.release();
  }
}

/** Require connected + PG≥15 + pg_walinspect for WAL routes. */
export async function requireWalCapabilities(
  pool: Pool,
  serverVersion: string | null,
): Promise<void> {
  const major = serverVersion ? parsePgMajorVersion(serverVersion) : null;
  if (!isWalPgVersionSupported(major)) {
    throw gateError(
      "PG_VERSION_UNSUPPORTED",
      `WAL mode requires PostgreSQL ${PG_VERSION_WAL_MIN}+ (server reports: ${serverVersion ?? "unknown"})`,
      `Upgrade to PostgreSQL ${PG_VERSION_WAL_MIN} or newer, enable pg_walinspect, then retry.`,
    );
  }
  const client = await pool.connect();
  try {
    await verifyWalinspect(client);
  } finally {
    client.release();
  }
}

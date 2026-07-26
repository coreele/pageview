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
  "Enable pageinspect manually as a superuser: CREATE EXTENSION pageinspect; then reconnect. This app will not run CREATE EXTENSION for you.";

export async function verifyPageinspect(client: PoolClient): Promise<void> {
  const ext = await client.query(`SELECT 1 FROM pg_extension WHERE extname = 'pageinspect'`);
  if (ext.rowCount === 0) {
    const err = new Error("pageinspect extension is not installed") as Error & {
      code: string;
      nextStep: string;
    };
    err.code = "PAGEINSPECT_MISSING";
    err.nextStep = PAGEINSPECT_NEXT;
    throw err;
  }
  // Prove callable without fetching a real page
  await client.query(`SELECT to_regprocedure('pageinspect.get_raw_page(text, int4)') IS NOT NULL AS ok`);
}

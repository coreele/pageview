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

/** Manual next step when automatic installation of pageinspect failed. */
export const PAGEINSPECT_NEXT =
  "Automatic install failed. Enable pageinspect manually as a superuser: CREATE EXTENSION pageinspect; then retry the Page request.";

/** Manual next step when automatic installation of pg_walinspect failed. */
export const WALINSPECT_NEXT =
  "Automatic install failed. Enable pg_walinspect manually as a superuser: CREATE EXTENSION pg_walinspect; then retry.";

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

async function extensionPresent(client: PoolClient, ext: string): Promise<boolean> {
  const res = await client.query(`SELECT 1 FROM pg_extension WHERE extname = '${ext}'`);
  return (res.rowCount ?? res.rows.length) > 0;
}

type ExtensionGate = {
  /** Extension name used in catalog checks and CREATE EXTENSION. */
  ext: "pageinspect" | "pg_walinspect";
  /** Existing gate error code — the error-code set is unchanged (spec contract). */
  code: "PAGEINSPECT_MISSING" | "WALINSPECT_MISSING";
  /** Callability probe (executed, result ignored — same as pre-auto-install). */
  callableSql: string;
  /** Manual guidance shown only when automatic installation failed. */
  nextStep: string;
};

const PAGEINSPECT_GATE: ExtensionGate = {
  ext: "pageinspect",
  code: "PAGEINSPECT_MISSING",
  callableSql: `SELECT to_regprocedure('pageinspect.get_raw_page(text, int4)') IS NOT NULL AS ok`,
  nextStep: PAGEINSPECT_NEXT,
};

const WALINSPECT_GATE: ExtensionGate = {
  ext: "pg_walinspect",
  code: "WALINSPECT_MISSING",
  callableSql: `SELECT to_regprocedure('pg_walinspect.pg_get_wal_records_info(pg_lsn, pg_lsn)') IS NOT NULL AS ok`,
  nextStep: WALINSPECT_NEXT,
};

/**
 * Guard flow (spec contract): existence check → missing ⇒ one bare
 * `CREATE EXTENSION IF NOT EXISTS <ext>` (no SCHEMA/VERSION, at most one
 * attempt per request) → re-run the same existence + callability checks →
 * pass on success. The installed path issues zero DDL. Concurrent duplicate
 * errors (42710 duplicate_object / 42701 duplicate_column) mean another
 * session won the install race; they are resolved by the authoritative
 * recheck instead of surfacing as spurious failures. Any other install error
 * is converted in place to the existing gate error with the PG reason kept in
 * the message — it must never leak through mapPgError as PERMISSION/INTERNAL.
 */
async function ensureExtension(client: PoolClient, gate: ExtensionGate): Promise<void> {
  if (await extensionPresent(client, gate.ext)) {
    // Installed: same checks as before auto-install, zero DDL.
    await client.query(gate.callableSql);
    return;
  }
  try {
    await client.query(`CREATE EXTENSION IF NOT EXISTS ${gate.ext}`);
  } catch (e) {
    const pgErr = e as { code?: string; message?: string };
    if (pgErr.code !== "42710" && pgErr.code !== "42701") {
      throw gateError(
        gate.code,
        `${gate.ext} extension is missing and automatic installation failed: ${pgErr.message ?? String(e)}`,
        gate.nextStep,
      );
    }
    // Another concurrent session created the extension; the recheck below decides.
  }
  if (!(await extensionPresent(client, gate.ext))) {
    throw gateError(
      gate.code,
      `${gate.ext} extension is missing: automatic installation did not take effect (still absent from pg_extension)`,
      gate.nextStep,
    );
  }
  await client.query(gate.callableSql);
}

export async function verifyPageinspect(client: PoolClient): Promise<void> {
  await ensureExtension(client, PAGEINSPECT_GATE);
}

export async function verifyWalinspect(client: PoolClient): Promise<void> {
  await ensureExtension(client, WALINSPECT_GATE);
}

/** Require connected + pageinspect (auto-installed when missing) for Page-mode routes. */
export async function requirePageinspect(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await verifyPageinspect(client);
  } finally {
    client.release();
  }
}

/**
 * Require connected + PG≥15 + pg_walinspect (auto-installed when missing) for
 * WAL routes. The version gate fires before any pool use: on PG<15 no
 * extension query is sent and pg_walinspect is never installed.
 */
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

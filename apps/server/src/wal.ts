import type { Pool } from "pg";
import {
  BATCH_LIMIT_R1_MAX_RECORDS,
  BATCH_LIMIT_R3_MAX_LSN_SPAN,
  checkBatchRecordCount,
  checkBatchResponseSize,
  checkLsnSpan,
  mapWalinspectRow,
  parseLsn,
  validateLsnRange,
  type WalRecord,
  type WalinspectRow,
} from "wal-core";
import {
  WALINSPECT_NEXT,
  requireWalCapabilities,
  type AppErrorBody,
} from "./session.js";

export const WAL_BATCH_TOO_LARGE_NEXT =
  "Narrow the LSN range (fewer records or shorter span ≤16 MiB), then retry Load. The server never returns a truncated partial batch.";

/** Actionable next step when WAL LSN is past tip, recycled, or otherwise unreadable. */
export const WAL_RANGE_UNAVAILABLE_NEXT =
  "Narrow the LSN range to WAL that still exists on this server: use Fill recent window, then adjust start within retained pg_wal segments (start ≤ end), and retry Load.";

/** Design §4.1 — default Fill window size and initial probe span. */
export const RECENT_WINDOW_DEFAULT_LIMIT = 20;
export const RECENT_WINDOW_INITIAL_SPAN = 64 * 1024;

export type RecentWindow = {
  startLsn: string;
  endLsn: string;
  count: number;
};

export type ParseLimitOk = { ok: true; limit: number };
export type ParseLimitFail = {
  ok: false;
  code: "BAD_LSN";
  reason: string;
  message: string;
  nextStep: string;
};

export type WalGateErr = {
  code: string;
  message?: string;
  nextStep?: string;
  reason?: string;
};

function appError(
  statusCode: number,
  code: string,
  message: string,
  nextStep: string,
): { statusCode: number; body: AppErrorBody } {
  return { statusCode, body: { code, message, nextStep } };
}

/**
 * Tip / future LSN: pg_current_wal_lsn is the write frontier; no complete record
 * starts at or after it, so Fill current (start=end=current) is an empty batch.
 */
export function isTipEmptyBatch(startLsn: string, currentLsn: string): boolean {
  try {
    return parseLsn(startLsn) >= parseLsn(currentLsn);
  } catch {
    return false;
  }
}

/** Map pg_walinspect / xlogreader messages to BAD_LSN (P0-11); null if unrelated. */
export function classifyWalinspectError(message: string): WalGateErr | null {
  const m = message.trim();
  if (!m) return null;

  const tipOrMissing =
    /could not find a valid record after/i.test(m) ||
    /could not read WAL\b/i.test(m) ||
    /could not open file/i.test(m) ||
    /already been removed/i.test(m) ||
    /WAL (start|input) LSN must be less than/i.test(m) ||
    /WAL start LSN must be less than end LSN/i.test(m);

  if (!tipOrMissing) return null;

  return {
    code: "BAD_LSN",
    message: m,
    nextStep: WAL_RANGE_UNAVAILABLE_NEXT,
    reason: "wal_range_unavailable",
  };
}

export function mapWalGateError(err: WalGateErr): { statusCode: number; body: AppErrorBody } {
  switch (err.code) {
    case "NOT_CONNECTED":
      return appError(
        401,
        "NOT_CONNECTED",
        err.message ?? "Not connected",
        err.nextStep ?? "Connect via the form or configure env credentials, then retry.",
      );
    case "PG_VERSION_UNSUPPORTED":
      return appError(
        400,
        "PG_VERSION_UNSUPPORTED",
        err.message ?? "PostgreSQL version does not support WAL mode",
        err.nextStep ?? "Upgrade to PostgreSQL 15 or newer, enable pg_walinspect, then retry.",
      );
    case "WALINSPECT_MISSING":
      return appError(
        400,
        "WALINSPECT_MISSING",
        err.message ?? "pg_walinspect missing",
        err.nextStep ?? WALINSPECT_NEXT,
      );
    case "WAL_BATCH_TOO_LARGE":
      return appError(
        400,
        "WAL_BATCH_TOO_LARGE",
        err.message ??
          `WAL batch exceeds hard limits (reason: ${err.reason ?? "unknown"}). No partial records are returned.`,
        WAL_BATCH_TOO_LARGE_NEXT,
      );
    case "BAD_LSN":
      return appError(
        400,
        "BAD_LSN",
        err.message ?? `Invalid LSN range (${err.reason ?? "unknown"})`,
        err.nextStep ??
          "Enter valid start/end LSN values as XX/YYYYYYYY with start ≤ end, then retry.",
      );
    default:
      return appError(
        500,
        "INTERNAL",
        err.message ?? "Unexpected WAL error",
        "Inspect server logs, fix the underlying issue, then retry.",
      );
  }
}

export async function fetchCurrentWalLsn(pool: Pool): Promise<string> {
  const res = await pool.query<{ lsn: string }>(`SELECT pg_current_wal_lsn()::text AS lsn`);
  return String(res.rows[0]?.lsn ?? "");
}

/** Format bigint LSN as PostgreSQL-style `HI/LO` hex (uppercase, unpadded). */
export function formatLsn(value: bigint): string {
  if (value < 0n) throw new Error("LSN must be non-negative");
  const hi = value >> 32n;
  const lo = value & 0xffffffffn;
  return `${hi.toString(16).toUpperCase()}/${lo.toString(16).toUpperCase()}`;
}

/** `end - span`, clamped to `0/0`. */
export function lsnMinusSpan(endLsn: string, span: bigint): string {
  const end = parseLsn(endLsn);
  const start = end > span ? end - span : 0n;
  return formatLsn(start);
}

export function parseRecentWindowLimit(raw: string | undefined): ParseLimitOk | ParseLimitFail {
  if (raw === undefined || raw.trim() === "") {
    return { ok: true, limit: RECENT_WINDOW_DEFAULT_LIMIT };
  }
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return {
      ok: false,
      code: "BAD_LSN",
      reason: "invalid_limit",
      message: "limit must be a positive integer",
      nextStep: `Provide limit as a positive integer ≤ ${BATCH_LIMIT_R1_MAX_RECORDS} (default ${RECENT_WINDOW_DEFAULT_LIMIT}), then retry.`,
    };
  }
  const limit = Number(trimmed);
  if (!Number.isInteger(limit) || limit < 1 || limit > BATCH_LIMIT_R1_MAX_RECORDS) {
    return {
      ok: false,
      code: "BAD_LSN",
      reason: "invalid_limit",
      message: `limit must be between 1 and ${BATCH_LIMIT_R1_MAX_RECORDS}`,
      nextStep: `Provide limit as a positive integer ≤ ${BATCH_LIMIT_R1_MAX_RECORDS} (default ${RECENT_WINDOW_DEFAULT_LIMIT}), then retry.`,
    };
  }
  return { ok: true, limit };
}

/** Apply §4.1 tail/backfill rules; never attach records[]. */
export function windowFromRecords(
  tip: string,
  records: WalRecord[],
  limit: number,
): RecentWindow {
  if (records.length === 0) {
    return { startLsn: tip, endLsn: tip, count: 0 };
  }
  const slice = records.length > limit ? records.slice(-limit) : records;
  return {
    startLsn: slice[0]!.startLsn,
    endLsn: tip,
    count: slice.length,
  };
}

/**
 * Heuristic expand from ~64KiB until ≥limit records, R3, or 0/0.
 * Uses the same query path as /records (caller injects fetchWalRecords).
 */
export async function resolveRecentWindow(opts: {
  tip: string;
  limit: number;
  queryRecords: (startLsn: string, endLsn: string) => Promise<WalRecord[]>;
  initialSpan?: number;
  maxSpan?: number;
}): Promise<RecentWindow> {
  const {
    tip,
    limit,
    queryRecords,
    initialSpan = RECENT_WINDOW_INITIAL_SPAN,
    maxSpan = BATCH_LIMIT_R3_MAX_LSN_SPAN,
  } = opts;

  let span = BigInt(initialSpan);
  const max = BigInt(maxSpan);
  let lastRecords: WalRecord[] = [];

  for (;;) {
    const start = lsnMinusSpan(tip, span);
    lastRecords = await queryRecords(start, tip);

    if (lastRecords.length >= limit) break;
    if (parseLsn(start) === 0n) break;
    if (span >= max) break;

    const doubled = span * 2n;
    span = doubled > max ? max : doubled;
  }

  return windowFromRecords(tip, lastRecords, limit);
}

export async function fetchRecentWalWindow(
  pool: Pool,
  limit: number,
): Promise<RecentWindow> {
  const tip = await fetchCurrentWalLsn(pool);
  return resolveRecentWindow({
    tip,
    limit,
    queryRecords: (startLsn, endLsn) => fetchWalRecords(pool, startLsn, endLsn),
  });
}

export async function fetchWalRecords(
  pool: Pool,
  startLsn: string,
  endLsn: string,
): Promise<WalRecord[]> {
  const range = validateLsnRange(startLsn, endLsn);
  if (!range.ok) {
    const e = new Error(range.reason) as Error & { code: string; reason: string };
    e.code = range.code;
    e.reason = range.reason;
    throw e;
  }

  const span = checkLsnSpan(startLsn, endLsn);
  if (!span.ok) {
    const e = new Error(span.reason) as Error & { code: string; reason: string };
    e.code = span.code;
    e.reason = span.reason;
    throw e;
  }

  // P1-1 / Fill tip: start at or past current LSN → empty success (no pg_walinspect error).
  const currentLsn = await fetchCurrentWalLsn(pool);
  if (isTipEmptyBatch(startLsn, currentLsn)) {
    return [];
  }

  let res;
  try {
    res = await pool.query(
      `SELECT start_lsn::text AS start_lsn,
              end_lsn::text AS end_lsn,
              prev_lsn::text AS prev_lsn,
              xid::text AS xid,
              resource_manager,
              record_type,
              record_length,
              main_data_length,
              fpi_length,
              description,
              block_ref
       FROM pg_get_wal_records_info($1::pg_lsn, $2::pg_lsn)`,
      [startLsn, endLsn],
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const classified = classifyWalinspectError(msg);
    if (classified) {
      const err = new Error(classified.message ?? msg) as Error & {
        code: string;
        reason?: string;
        nextStep?: string;
      };
      err.code = classified.code;
      err.reason = classified.reason;
      err.nextStep = classified.nextStep;
      throw err;
    }
    throw e;
  }

  const countCheck = checkBatchRecordCount(res.rowCount ?? res.rows.length);
  if (!countCheck.ok) {
    const e = new Error(countCheck.reason) as Error & { code: string; reason: string };
    e.code = countCheck.code;
    e.reason = countCheck.reason;
    throw e;
  }

  const records = res.rows.map((row) => mapWalinspectRow(row as WalinspectRow));
  const sizeCheck = checkBatchResponseSize(records);
  if (!sizeCheck.ok) {
    const e = new Error(sizeCheck.reason) as Error & { code: string; reason: string };
    e.code = sizeCheck.code;
    e.reason = sizeCheck.reason;
    throw e;
  }

  return records;
}

export { requireWalCapabilities };

import type { Pool } from "pg";
import {
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
  "Narrow the LSN range to WAL that still exists on this server: use Fill current LSN, then move start earlier within retained pg_wal segments (start ≤ end), and retry Load.";

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

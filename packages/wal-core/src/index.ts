/** Structured WAL record DTO (Spec field semantics). */
export type WalRecord = {
  startLsn: string;
  endLsn: string | null;
  prevLsn: string | null;
  xid: string | null;
  resourceManager: string;
  recordType: string;
  recordLength: number;
  mainDataLength: number | null;
  fpiLength: number;
  description: string | null;
  blockRef: string | null;
};

/** Raw row shape from pg_get_wal_records_info (snake_case columns). */
export type WalinspectRow = {
  start_lsn: unknown;
  end_lsn?: unknown;
  prev_lsn?: unknown;
  xid?: unknown;
  resource_manager: unknown;
  record_type: unknown;
  record_length: unknown;
  main_data_length?: unknown;
  fpi_length: unknown;
  description?: unknown;
  block_ref?: unknown;
};

export const BATCH_LIMIT_R1_MAX_RECORDS = 2000;
export const BATCH_LIMIT_R2_MAX_BYTES = 2 * 1024 * 1024;
export const BATCH_LIMIT_R3_MAX_LSN_SPAN = 16 * 1024 * 1024;

export type BatchLimitCode = "WAL_BATCH_TOO_LARGE" | "BAD_LSN";

export type BatchCheckOk = { ok: true };
export type BatchCheckFail = {
  ok: false;
  code: BatchLimitCode;
  reason: string;
};
export type BatchCheckResult = BatchCheckOk | BatchCheckFail;

const LSN_RE = /^([0-9A-Fa-f]+)\/([0-9A-Fa-f]+)$/;

function asString(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function asNullableString(v: unknown): string | null {
  if (v == null) return null;
  return String(v);
}

function asNumber(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v !== "" && Number.isFinite(Number(v))) return Number(v);
  if (typeof v === "bigint") return Number(v);
  return fallback;
}

function asNullableNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v !== "" && Number.isFinite(Number(v))) return Number(v);
  if (typeof v === "bigint") return Number(v);
  return null;
}

export function mapWalinspectRow(row: WalinspectRow): WalRecord {
  return {
    startLsn: asString(row.start_lsn),
    endLsn: asNullableString(row.end_lsn),
    prevLsn: asNullableString(row.prev_lsn),
    xid: asNullableString(row.xid),
    resourceManager: asString(row.resource_manager),
    recordType: asString(row.record_type),
    recordLength: asNumber(row.record_length),
    mainDataLength: asNullableNumber(row.main_data_length),
    fpiLength: asNumber(row.fpi_length, 0),
    description: asNullableString(row.description),
    blockRef: asNullableString(row.block_ref),
  };
}

export function hasFpi(record: { fpiLength: number }): boolean {
  return record.fpiLength > 0;
}

export function parseLsn(lsn: string): bigint {
  const m = LSN_RE.exec(lsn.trim());
  if (!m) throw new Error(`Invalid LSN: ${lsn}`);
  const hi = BigInt(`0x${m[1]}`);
  const lo = BigInt(`0x${m[2]}`);
  return (hi << 32n) + lo;
}

export function validateLsnRange(startLsn: string, endLsn: string): BatchCheckResult {
  let start: bigint;
  let end: bigint;
  try {
    start = parseLsn(startLsn);
    end = parseLsn(endLsn);
  } catch {
    return { ok: false, code: "BAD_LSN", reason: "invalid_format" };
  }
  if (start > end) {
    return { ok: false, code: "BAD_LSN", reason: "start_after_end" };
  }
  return { ok: true };
}

export function checkLsnSpan(startLsn: string, endLsn: string): BatchCheckResult {
  const range = validateLsnRange(startLsn, endLsn);
  if (!range.ok) return range;
  const span = parseLsn(endLsn) - parseLsn(startLsn);
  if (span > BigInt(BATCH_LIMIT_R3_MAX_LSN_SPAN)) {
    return { ok: false, code: "WAL_BATCH_TOO_LARGE", reason: "r3_lsn_span" };
  }
  return { ok: true };
}

export function checkBatchRecordCount(count: number): BatchCheckResult {
  if (count > BATCH_LIMIT_R1_MAX_RECORDS) {
    return { ok: false, code: "WAL_BATCH_TOO_LARGE", reason: "r1_record_count" };
  }
  return { ok: true };
}

export function checkBatchResponseSize(records: WalRecord[]): BatchCheckResult {
  const bytes = new TextEncoder().encode(JSON.stringify({ records })).byteLength;
  if (bytes > BATCH_LIMIT_R2_MAX_BYTES) {
    return { ok: false, code: "WAL_BATCH_TOO_LARGE", reason: "r2_response_size" };
  }
  return { ok: true };
}

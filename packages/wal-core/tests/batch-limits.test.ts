import { describe, expect, it } from "vitest";
import {
  BATCH_LIMIT_R1_MAX_RECORDS,
  BATCH_LIMIT_R2_MAX_BYTES,
  BATCH_LIMIT_R3_MAX_LSN_SPAN,
  checkBatchRecordCount,
  checkBatchResponseSize,
  checkLsnSpan,
  parseLsn,
  validateLsnRange,
  type WalRecord,
} from "../src/index.js";

function stubRecord(overrides: Partial<WalRecord> = {}): WalRecord {
  return {
    startLsn: "0/100",
    endLsn: "0/120",
    prevLsn: "0/80",
    xid: "1",
    resourceManager: "Heap",
    recordType: "INSERT",
    recordLength: 40,
    mainDataLength: 10,
    fpiLength: 0,
    description: "x",
    blockRef: null,
    ...overrides,
  };
}

describe("batch limit constants", () => {
  it("exports Design R1/R2/R3 thresholds", () => {
    expect(BATCH_LIMIT_R1_MAX_RECORDS).toBe(2000);
    expect(BATCH_LIMIT_R2_MAX_BYTES).toBe(2 * 1024 * 1024);
    expect(BATCH_LIMIT_R3_MAX_LSN_SPAN).toBe(16 * 1024 * 1024);
  });
});

describe("parseLsn / validateLsnRange", () => {
  it("parses XX/YYYYYYYY into byte-order bigint", () => {
    expect(parseLsn("0/16B3748")).toBe(0x16b3748n);
    expect(parseLsn("1/0")).toBe(0x1_0000_0000n);
  });

  it("rejects invalid LSN or start > end", () => {
    expect(validateLsnRange("bogus", "0/1")).toEqual({
      ok: false,
      code: "BAD_LSN",
      reason: "invalid_format",
    });
    expect(validateLsnRange("0/200", "0/100")).toEqual({
      ok: false,
      code: "BAD_LSN",
      reason: "start_after_end",
    });
    expect(validateLsnRange("0/100", "0/100").ok).toBe(true);
  });
});

describe("R3 LSN span precheck", () => {
  it("passes when span is within 16 MiB", () => {
    const start = "0/0";
    const end = `0/${(16 * 1024 * 1024).toString(16).toUpperCase()}`;
    expect(checkLsnSpan(start, end)).toEqual({ ok: true });
  });

  it("fails when span exceeds 16 MiB", () => {
    const start = "0/0";
    const end = `0/${(16 * 1024 * 1024 + 1).toString(16).toUpperCase()}`;
    const result = checkLsnSpan(start, end);
    expect(result).toEqual({
      ok: false,
      code: "WAL_BATCH_TOO_LARGE",
      reason: "r3_lsn_span",
    });
  });
});

describe("R1 record count", () => {
  it("passes at exactly 2000 records", () => {
    expect(checkBatchRecordCount(2000)).toEqual({ ok: true });
  });

  it("fails above 2000 without returning a truncated array", () => {
    const result = checkBatchRecordCount(2001);
    expect(result).toEqual({
      ok: false,
      code: "WAL_BATCH_TOO_LARGE",
      reason: "r1_record_count",
    });
    expect(result).not.toHaveProperty("records");
  });
});

describe("R2 response size", () => {
  it("passes when serialized JSON is within 2 MiB", () => {
    const records = [stubRecord()];
    expect(checkBatchResponseSize(records).ok).toBe(true);
  });

  it("fails when serialized JSON exceeds 2 MiB", () => {
    const huge = "x".repeat(2 * 1024 * 1024);
    const records = [stubRecord({ description: huge })];
    const result = checkBatchResponseSize(records);
    expect(result).toEqual({
      ok: false,
      code: "WAL_BATCH_TOO_LARGE",
      reason: "r2_response_size",
    });
    expect(result).not.toHaveProperty("records");
  });
});

describe("no truncate API", () => {
  it("does not export truncate/slice helpers for oversize batches", async () => {
    const mod = await import("../src/index.js");
    const names = Object.keys(mod);
    expect(names.some((n) => /truncat|slice.*batch|partial/i.test(n))).toBe(false);
  });
});

import { describe, expect, it, vi } from "vitest";
import { BATCH_LIMIT_R1_MAX_RECORDS, type WalRecord } from "wal-core";
import {
  RECENT_WINDOW_DEFAULT_LIMIT,
  RECENT_WINDOW_INITIAL_SPAN,
  WAL_BATCH_TOO_LARGE_NEXT,
  WAL_RANGE_UNAVAILABLE_NEXT,
  classifyWalinspectError,
  formatLsn,
  isTipEmptyBatch,
  lsnMinusSpan,
  mapWalGateError,
  parseRecentWindowLimit,
  resolveRecentWindow,
  windowFromRecords,
} from "../src/wal.js";

function fakeRecord(startLsn: string): WalRecord {
  return {
    startLsn,
    endLsn: null,
    prevLsn: null,
    xid: null,
    resourceManager: "XLOG",
    recordType: "SWITCH",
    recordLength: 24,
    mainDataLength: 0,
    fpiLength: 0,
    description: null,
    blockRef: null,
  };
}

describe("WAL error mapping", () => {
  it("maps version / extension / batch codes with nextStep", () => {
    expect(mapWalGateError({ code: "NOT_CONNECTED" }).body.code).toBe("NOT_CONNECTED");
    expect(mapWalGateError({ code: "PG_VERSION_UNSUPPORTED" }).body.code).toBe(
      "PG_VERSION_UNSUPPORTED",
    );
    expect(mapWalGateError({ code: "WALINSPECT_MISSING" }).body.nextStep).toMatch(
      /CREATE EXTENSION pg_walinspect/i,
    );
    const tooLarge = mapWalGateError({
      code: "WAL_BATCH_TOO_LARGE",
      reason: "r1_record_count",
    });
    expect(tooLarge.body.code).toBe("WAL_BATCH_TOO_LARGE");
    expect(tooLarge.body.nextStep).toBe(WAL_BATCH_TOO_LARGE_NEXT);
    expect(tooLarge.body).not.toHaveProperty("records");
  });

  it("maps tip / missing-record and removed-segment messages to BAD_LSN with actionable nextStep", () => {
    const tipMiss = classifyWalinspectError(
      "could not find a valid record after 0/16B3748",
    );
    expect(tipMiss).not.toBeNull();
    expect(tipMiss!.code).toBe("BAD_LSN");
    expect(tipMiss!.nextStep).toBe(WAL_RANGE_UNAVAILABLE_NEXT);
    expect(tipMiss!.nextStep).toMatch(/Fill recent window|narrow|retained|pg_wal/i);
    expect(tipMiss!.nextStep).not.toMatch(/Fill current LSN/i);
    expect(tipMiss!.nextStep).not.toMatch(/Inspect server logs/i);

    const removed = classifyWalinspectError(
      'requested WAL segment 000000010000000000000001 has already been removed',
    );
    expect(removed).not.toBeNull();
    expect(removed!.code).toBe("BAD_LSN");
    expect(removed!.nextStep).toBe(WAL_RANGE_UNAVAILABLE_NEXT);

    const unreadable = classifyWalinspectError("could not read WAL at 0/100");
    expect(unreadable).not.toBeNull();
    expect(unreadable!.code).toBe("BAD_LSN");

    const startPast = classifyWalinspectError(
      "WAL start LSN must be less than current LSN",
    );
    expect(startPast).not.toBeNull();
    expect(startPast!.code).toBe("BAD_LSN");

    expect(classifyWalinspectError("totally unrelated boom")).toBeNull();
  });

  it("mapWalGateError preserves BAD_LSN nextStep from classify", () => {
    const classified = classifyWalinspectError(
      "could not find a valid record after 1/0",
    )!;
    const mapped = mapWalGateError(classified);
    expect(mapped.statusCode).toBe(400);
    expect(mapped.body.code).toBe("BAD_LSN");
    expect(mapped.body.nextStep).toBe(WAL_RANGE_UNAVAILABLE_NEXT);
  });
});

describe("tip empty batch (point query at tip)", () => {
  it("treats start at or past current LSN as empty success, not INTERNAL", () => {
    expect(isTipEmptyBatch("0/16B3748", "0/16B3748")).toBe(true);
    expect(isTipEmptyBatch("0/16B3749", "0/16B3748")).toBe(true);
    expect(isTipEmptyBatch("0/16B3747", "0/16B3748")).toBe(false);
    expect(isTipEmptyBatch("1/0", "0/FFFFFFFF")).toBe(true);
    expect(isTipEmptyBatch("not-an-lsn", "0/1")).toBe(false);
  });
});

describe("recent-window helpers (P1-2)", () => {
  it("defaults limit to 20 and rejects non-positive or > R1", () => {
    expect(parseRecentWindowLimit(undefined)).toEqual({
      ok: true,
      limit: RECENT_WINDOW_DEFAULT_LIMIT,
    });
    expect(parseRecentWindowLimit("20")).toEqual({ ok: true, limit: 20 });
    expect(parseRecentWindowLimit("1")).toEqual({ ok: true, limit: 1 });
    expect(parseRecentWindowLimit(String(BATCH_LIMIT_R1_MAX_RECORDS))).toEqual({
      ok: true,
      limit: BATCH_LIMIT_R1_MAX_RECORDS,
    });
    expect(parseRecentWindowLimit("0").ok).toBe(false);
    expect(parseRecentWindowLimit("-1").ok).toBe(false);
    expect(parseRecentWindowLimit("abc").ok).toBe(false);
    expect(parseRecentWindowLimit("20.5").ok).toBe(false);
    expect(parseRecentWindowLimit(String(BATCH_LIMIT_R1_MAX_RECORDS + 1)).ok).toBe(false);
  });

  it("formats LSN and subtracts span clamped to 0/0", () => {
    expect(formatLsn(0x16b3748n)).toBe("0/16B3748");
    expect(formatLsn(0x1_0000_0000n)).toBe("1/0");
    expect(RECENT_WINDOW_INITIAL_SPAN).toBe(64 * 1024);
    expect(lsnMinusSpan("0/20000", 0x10000n)).toBe("0/10000");
    expect(lsnMinusSpan("0/100", 0x10000n)).toBe("0/0");
  });

  it("windowFromRecords: empty → tip/tip/0; ≤limit keeps earliest; >limit takes tail and backfills start", () => {
    const tip = "0/3000";
    expect(windowFromRecords(tip, [], 20)).toEqual({
      startLsn: tip,
      endLsn: tip,
      count: 0,
    });

    const few = [fakeRecord("0/1000"), fakeRecord("0/2000"), fakeRecord("0/2800")];
    expect(windowFromRecords(tip, few, 20)).toEqual({
      startLsn: "0/1000",
      endLsn: tip,
      count: 3,
    });

    const many = Array.from({ length: 25 }, (_, i) =>
      fakeRecord(`0/${(0x1000 + i * 0x10).toString(16).toUpperCase()}`),
    );
    const win = windowFromRecords(tip, many, 20);
    expect(win.count).toBe(20);
    expect(win.endLsn).toBe(tip);
    expect(win.startLsn).toBe(many[5]!.startLsn);
    expect(win).not.toHaveProperty("records");
  });

  it("resolveRecentWindow expands span until ≥limit then takes tail", async () => {
    const tip = "0/100000";
    const calls: string[] = [];
    const queryRecords = vi.fn(async (start: string, end: string) => {
      calls.push(`${start}..${end}`);
      const startN = Number.parseInt(start.split("/")[1]!, 16);
      const tipN = Number.parseInt(tip.split("/")[1]!, 16);
      const span = tipN - startN;
      // denser as window grows: ~1 record per 8KiB
      const n = Math.floor(span / 0x2000);
      return Array.from({ length: n }, (_, i) =>
        fakeRecord(`0/${(startN + (i + 1) * 0x2000).toString(16).toUpperCase()}`),
      );
    });

    const win = await resolveRecentWindow({
      tip,
      limit: 20,
      queryRecords,
    });
    expect(queryRecords.mock.calls.length).toBeGreaterThan(1);
    expect(win.endLsn).toBe(tip);
    expect(win.count).toBe(20);
    expect(win.startLsn).toMatch(/^0\//);
    expect(win).not.toHaveProperty("records");
  });

  it("resolveRecentWindow returns partial count when WAL is sparse within R3", async () => {
    const tip = "0/10000";
    const win = await resolveRecentWindow({
      tip,
      limit: 20,
      queryRecords: async () => [fakeRecord("0/F000"), fakeRecord("0/F800")],
    });
    expect(win).toEqual({ startLsn: "0/F000", endLsn: tip, count: 2 });
  });

  it("resolveRecentWindow propagates query failures (no silent empty success)", async () => {
    const err = Object.assign(new Error("segment removed"), {
      code: "BAD_LSN",
      reason: "wal_range_unavailable",
    });
    await expect(
      resolveRecentWindow({
        tip: "0/10000",
        limit: 20,
        queryRecords: async () => {
          throw err;
        },
      }),
    ).rejects.toMatchObject({ code: "BAD_LSN" });
  });
});

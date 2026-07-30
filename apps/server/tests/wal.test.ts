import { describe, expect, it } from "vitest";
import {
  WAL_BATCH_TOO_LARGE_NEXT,
  WAL_RANGE_UNAVAILABLE_NEXT,
  classifyWalinspectError,
  isTipEmptyBatch,
  mapWalGateError,
} from "../src/wal.js";

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
    expect(tipMiss!.nextStep).toMatch(/Fill current LSN|narrow|retained|pg_wal/i);
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

describe("tip empty batch (Fill current LSN point query)", () => {
  it("treats start at or past current LSN as empty success, not INTERNAL", () => {
    expect(isTipEmptyBatch("0/16B3748", "0/16B3748")).toBe(true);
    expect(isTipEmptyBatch("0/16B3749", "0/16B3748")).toBe(true);
    expect(isTipEmptyBatch("0/16B3747", "0/16B3748")).toBe(false);
    expect(isTipEmptyBatch("1/0", "0/FFFFFFFF")).toBe(true);
    expect(isTipEmptyBatch("not-an-lsn", "0/1")).toBe(false);
  });
});

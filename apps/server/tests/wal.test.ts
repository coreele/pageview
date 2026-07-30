import { describe, expect, it } from "vitest";
import {
  WAL_BATCH_TOO_LARGE_NEXT,
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
});

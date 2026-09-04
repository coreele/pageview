import { describe, expect, it } from "vitest";
import type { IndexColumnsResponse } from "./api";
import {
  cacheAfterColumnsFailure,
  cacheAfterColumnsOk,
  deriveKeyColumnsState,
  emptyColumnsCache,
  shouldFetchColumns,
} from "./indexKeyDetail";

function columnsResponse(overrides?: Partial<IndexColumnsResponse>): IndexColumnsResponse {
  return {
    oid: 24576,
    schema: "public",
    name: "t_a_b_idx",
    qualifiedName: "public.t_a_b_idx",
    accessMethod: "btree",
    indnatts: 3,
    indnkeyatts: 2,
    hasExpression: false,
    columns: [
      {
        attnum: 1,
        name: "a",
        typoid: 23,
        typname: "int4",
        typmod: -1,
        kind: "key",
        isExpression: false,
        descending: false,
        nullsFirst: false,
      },
      {
        attnum: 2,
        name: "b",
        typname: "text",
        typoid: 25,
        typmod: -1,
        kind: "key",
        isExpression: false,
        descending: false,
        nullsFirst: false,
      },
      {
        attnum: 3,
        name: "c",
        typname: "int4",
        typoid: 23,
        typmod: -1,
        kind: "include",
        isExpression: false,
        descending: false,
        nullsFirst: false,
      },
    ],
    ...overrides,
  };
}

describe("indexColumns cache (T5: per-oid cache, success sticky, failure retried)", () => {
  it("treats a cache miss as fetchable", () => {
    expect(shouldFetchColumns(emptyColumnsCache(), 24576)).toBe(true);
  });

  it("does not re-fetch after a success is cached for the oid", () => {
    const cache = cacheAfterColumnsOk(emptyColumnsCache(), 24576, columnsResponse());
    expect(shouldFetchColumns(cache, 24576)).toBe(false);
    // other oids are independent
    expect(shouldFetchColumns(cache, 24577)).toBe(true);
  });

  it("re-fetches after a failure (failures are not sticky, unlike successes)", () => {
    const failed = cacheAfterColumnsFailure(emptyColumnsCache(), 24576, {
      code: "NOT_CONNECTED",
      message: "Not connected",
    });
    expect(shouldFetchColumns(failed, 24576)).toBe(true);
    // but the failure stays visible until the retry resolves
    expect(failed.get(24576)).toEqual({
      status: "failed",
      error: { code: "NOT_CONNECTED", message: "Not connected" },
    });
  });

  it("keeps inputs immutable (cache transitions return new maps)", () => {
    const base = emptyColumnsCache();
    const ok = cacheAfterColumnsOk(base, 1, columnsResponse({ oid: 1 }));
    expect(base.size).toBe(0);
    expect(ok.size).toBe(1);
    const failed = cacheAfterColumnsFailure(ok, 2, { code: "X", message: "y" });
    expect(failed.get(1)?.status).toBe("ok");
    expect(failed.get(2)?.status).toBe("failed");
  });

  it("replaces a stale failed entry when a retry succeeds", () => {
    const failed = cacheAfterColumnsFailure(emptyColumnsCache(), 1, {
      code: "HTTP_500",
      message: "boom",
    });
    const ok = cacheAfterColumnsOk(failed, 1, columnsResponse({ oid: 1 }));
    expect(ok.get(1)).toEqual({ status: "ok", data: columnsResponse({ oid: 1 }) });
  });
});

describe("deriveKeyColumnsState (T5: degradation copy per ui-design frozen table)", () => {
  it("shows the frozen loading line while no entry exists for the oid", () => {
    const state = deriveKeyColumnsState(emptyColumnsCache(), 24576);
    expect(state).toEqual({ kind: "loading", note: "loading column metadata…" });
  });

  it("shows the frozen metadata-unavailable note with the error code on failure", () => {
    const cache = cacheAfterColumnsFailure(emptyColumnsCache(), 24576, {
      code: "NOT_CONNECTED",
      message: "Not connected",
    });
    expect(deriveKeyColumnsState(cache, 24576)).toEqual({
      kind: "note",
      note: "column metadata unavailable (NOT_CONNECTED) — key values not shown (hex only)",
    });
  });

  it("shows the frozen expression-index note when hasExpression is true", () => {
    const cache = cacheAfterColumnsOk(emptyColumnsCache(), 24576, columnsResponse({
      hasExpression: true,
      columns: [
        {
          attnum: 1,
          name: "lower",
          typoid: 25,
          typname: "text",
          typmod: -1,
          kind: "key",
          isExpression: true,
          descending: false,
          nullsFirst: false,
        },
      ],
    }));
    expect(deriveKeyColumnsState(cache, 24576)).toEqual({
      kind: "note",
      note: "expression index — key values not decoded (hex only)",
    });
  });

  it("returns the metadata for decoding when ok and not an expression index", () => {
    const data = columnsResponse();
    const cache = cacheAfterColumnsOk(emptyColumnsCache(), 24576, data);
    expect(deriveKeyColumnsState(cache, 24576)).toEqual({ kind: "columns", data });
  });
});

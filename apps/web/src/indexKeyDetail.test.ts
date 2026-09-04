import { describe, expect, it } from "vitest";
import {
  buildBtreePage,
  decodeIndexTupleKeys,
  parseBtreePage,
  type DecodedKeyColumn,
} from "page-core";
import type { IndexColumnRow, IndexColumnsResponse } from "./api";
import {
  buildKeyValuesSection,
  cacheAfterColumnsFailure,
  cacheAfterColumnsOk,
  deriveKeyColumnsState,
  emptyColumnsCache,
  KEY_VALUE_TRUNCATE_CHARS,
  shouldFetchColumns,
  toIndexColumnMeta,
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

function column(overrides?: Partial<IndexColumnRow>): IndexColumnRow {
  return {
    attnum: 1,
    name: "a",
    typoid: 23,
    typname: "int4",
    typmod: -1,
    kind: "key",
    isExpression: false,
    descending: false,
    nullsFirst: false,
    ...overrides,
  };
}

function decoded(overrides?: Partial<DecodedKeyColumn>): DecodedKeyColumn {
  return {
    attnum: 1,
    name: "a",
    typname: "int4",
    status: "value",
    display: "42",
    ...overrides,
  };
}

describe("toIndexColumnMeta (T6: API metadata -> page-core decode input)", () => {
  it("maps the response columns to decode metadata", () => {
    const rows = [
      column({ attnum: 1, name: "a", typoid: 23, typname: "int4" }),
      column({ attnum: 3, name: "c", typoid: 23, typname: "int4", kind: "include" }),
    ];
    expect(toIndexColumnMeta(rows)).toEqual([
      { attnum: 1, name: "a", typoid: 23, typname: "int4", kind: "key" },
      { attnum: 3, name: "c", typoid: 23, typname: "int4", kind: "include" },
    ]);
  });
});

describe("buildKeyValuesSection (T6: row model per ui-design)", () => {
  it("formats value rows with include badges from metadata", () => {
    const meta = columnsResponse();
    const section = buildKeyValuesSection(
      [
        decoded({ attnum: 1, display: "2" }),
        decoded({ attnum: 2, name: "b", typname: "text", display: "'b037'" }),
        decoded({ attnum: 3, name: "c", display: "1" }),
      ],
      meta,
    );
    expect(section).toEqual({
      kind: "rows",
      rows: [
        { kind: "value", attnum: 1, name: "a", typname: "int4", display: "2", badges: [] },
        {
          kind: "value",
          attnum: 2,
          name: "b",
          typname: "text",
          display: "'b037'",
          badges: [],
        },
        {
          kind: "value",
          attnum: 3,
          name: "c",
          typname: "int4",
          display: "1",
          badges: ["include"],
        },
      ],
    });
  });

  it("renders NULL rows without a value and muted (pivot-truncated tails included)", () => {
    const section = buildKeyValuesSection(
      [
        decoded({ attnum: 1, display: "7" }),
        decoded({ attnum: 3, name: "c", typname: "int4", status: "null", display: undefined }),
      ],
      columnsResponse({ indnkeyatts: 1 }),
    );
    expect(section.kind).toBe("rows");
    if (section.kind !== "rows") return;
    expect(section.rows[1]).toEqual({
      kind: "null",
      attnum: 3,
      name: "c",
      typname: "int4",
      badges: ["include"],
    });
  });

  it("truncates long text-family values at 64 chars with the frozen note", () => {
    const long = "C".repeat(200);
    const section = buildKeyValuesSection(
      [decoded({ attnum: 1, name: "b", typname: "text", display: `'${long}'` })],
      columnsResponse({ columns: [column({ attnum: 1, name: "b", typoid: 25, typname: "text" })] }),
    );
    expect(section.kind).toBe("rows");
    if (section.kind !== "rows") return;
    const row = section.rows[0]!;
    expect(row.kind).toBe("value");
    if (row.kind !== "value") return;
    expect(row.display).toBe(`'${"C".repeat(64)}…'`);
    expect(row.truncation).toEqual({ total: 200 });
    expect(KEY_VALUE_TRUNCATE_CHARS).toBe(64);
  });

  it("does not truncate long non-text displays (e.g. long uuid-less int strings keep full precision)", () => {
    const section = buildKeyValuesSection(
      [decoded({ display: "9".repeat(100) })],
      columnsResponse(),
    );
    expect(section.kind).toBe("rows");
    if (section.kind !== "rows") return;
    const row = section.rows[0]!;
    expect(row.kind === "value" && row.display).toBe("9".repeat(100));
    expect(row.kind === "value" && row.truncation).toBeUndefined();
  });

  it("cuts rows at the first degraded column and surfaces the decoder's later-columns reason", () => {
    const section = buildKeyValuesSection(
      [
        decoded({ attnum: 1, display: "5" }),
        decoded({ attnum: 2, name: "j", typname: "jsonb", status: "unsupported", reason: "unsupported type: jsonb" }),
        decoded({
          attnum: 3,
          name: "c",
          typname: "int4",
          status: "error",
          reason: "column boundaries unknown after unsupported type: jsonb (attnum 2)",
        }),
      ],
      columnsResponse({ columns: [column(), column({ attnum: 2, name: "j", typoid: 3802, typname: "jsonb" }), column({ attnum: 3 })] }),
    );
    expect(section.kind).toBe("rows");
    if (section.kind !== "rows") return;
    expect(section.rows).toHaveLength(2);
    expect(section.rows[1]).toEqual({
      kind: "degraded",
      attnum: 2,
      name: "j",
      typname: "jsonb",
      reason: "unsupported type: jsonb",
      laterNote: "column boundaries unknown after unsupported type: jsonb (attnum 2)",
    });
  });

  it("degrades a single all-unsupported index to an index-level note (hex-only)", () => {
    const section = buildKeyValuesSection(
      [decoded({ attnum: 1, name: "j", typname: "jsonb", status: "unsupported", reason: "unsupported type: jsonb" })],
      columnsResponse({ columns: [column({ attnum: 1, name: "j", typoid: 3802, typname: "jsonb" })] }),
    );
    expect(section).toEqual({ kind: "note", note: "unsupported type: jsonb" });
  });

  it("keeps decode-error rows with the frozen reason wording", () => {
    const section = buildKeyValuesSection(
      [
        decoded({ attnum: 1, name: "b", typname: "text", status: "error", reason: "varlena length exceeds key area" }),
      ],
      columnsResponse({ columns: [column({ attnum: 1, name: "b", typoid: 25, typname: "text" })] }),
    );
    expect(section.kind).toBe("rows");
    if (section.kind !== "rows") return;
    expect(section.rows[0]).toEqual({
      kind: "degraded",
      attnum: 1,
      name: "b",
      typname: "text",
      reason: "decode error: varlena length exceeds key area",
    });
  });

  it("maps decodeIndexTupleKeys output end-to-end from a synthetic page", () => {
    // hikey pivot with two key attributes: int4 42 + text 'hi' (packed varlena)
    const keyBytes = new Uint8Array(8);
    keyBytes.set([42, 0, 0, 0], 0);
    keyBytes[4] = (3 << 1) | 1; // 1B varlena header, total 3
    keyBytes[5] = "h".charCodeAt(0);
    keyBytes[6] = "i".charCodeAt(0);
    const page = parseBtreePage(
      buildBtreePage({
        pageType: "leaf",
        tuples: [{ tidBlock: 0, tidOffset: 0, pivot: true, pivotNKeyAtts: 2, keyBytes }],
      }),
    );
    const tuple = page.tuples[0]!;
    const meta = columnsResponse({ indnkeyatts: 2 });
    const decodedCols = decodeIndexTupleKeys(page, tuple, toIndexColumnMeta(meta.columns));
    const section = buildKeyValuesSection(decodedCols, meta);
    expect(section).toEqual({
      kind: "rows",
      rows: [
        { kind: "value", attnum: 1, name: "a", typname: "int4", display: "42", badges: [], range: { start: tuple.range.start + 8, end: tuple.range.start + 12 } },
        {
          kind: "value",
          attnum: 2,
          name: "b",
          typname: "text",
          display: "'hi'",
          badges: [],
          range: { start: tuple.range.start + 12, end: tuple.range.start + 15 },
        },
        // pivot nkeyatts=2 truncates the include column -> NULL (P0-9)
        { kind: "null", attnum: 3, name: "c", typname: "int4", badges: ["include"] },
      ],
    });
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

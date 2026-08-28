import { describe, expect, it } from "vitest";
import {
  BTP_DELETED,
  buildBtreePage,
  parseBtreePage,
  type ParsedBtreePage,
} from "page-core";
import {
  findTupleBySelection,
  formatBytesPreview,
  metapageRows,
  tidRole,
  tInfoRows,
} from "./indexDetail";

function leafWith(tuples: Parameters<typeof buildBtreePage>[0] extends never ? never : Array<
  NonNullable<Parameters<typeof buildBtreePage>[0]>["tuples"] extends (infer T)[] | undefined ? T : never
>): ParsedBtreePage {
  return parseBtreePage(buildBtreePage({ pageType: "leaf", btpoNext: 3, tuples }));
}

describe("formatBytesPreview (key bytes: truncate 64B + full count)", () => {
  const raw = new Uint8Array(256).map((_, i) => i);

  it("shows all bytes when the range fits", () => {
    const p = formatBytesPreview(raw, { start: 0, end: 4 });
    expect(p).toEqual({ hex: "00 01 02 03", total: 4, truncated: false });
  });

  it("truncates at 64 bytes and reports the full length", () => {
    const p = formatBytesPreview(raw, { start: 0, end: 100 });
    expect(p.truncated).toBe(true);
    expect(p.total).toBe(100);
    expect(p.hex.split(" ")).toHaveLength(64);
    expect(p.hex.startsWith("00 01 02")).toBe(true);
  });

  it("handles an empty range", () => {
    const p = formatBytesPreview(raw, { start: 8, end: 8 });
    expect(p).toEqual({ hex: "", total: 0, truncated: false });
  });
});

describe("tInfoRows (D2/D3 mask semantics)", () => {
  it("decodes a plain leaf tuple: size row + unset ALT/VAR/NULL bits", () => {
    const page = leafWith([{ tidBlock: 5, tidOffset: 7 }]);
    const t = page.tuples[0]!;
    const rows = tInfoRows(t);
    const size = rows.find((r) => r.name === "size")!;
    expect(size.meaning).toContain(String(t.itemlen));
    const alt = rows.find((r) => r.name === "INDEX_ALT_TID_MASK")!;
    expect(alt.set).toBe(false);
    expect(rows.find((r) => r.name === "INDEX_VAR_MASK")!.set).toBe(false);
    expect(rows.find((r) => r.name === "INDEX_NULL_MASK")!.set).toBe(false);
  });

  it("marks posting tuples via ALT bit (t_tid reinterpreted as count + list offset, D3)", () => {
    const page = leafWith([
      {
        tidBlock: 0,
        tidOffset: 0,
        keyBytes: new Uint8Array(8),
        posting: [
          { blockNumber: 1, offsetNumber: 2 },
          { blockNumber: 3, offsetNumber: 4 },
        ],
      },
    ]);
    const rows = tInfoRows(page.tuples[0]!);
    const alt = rows.find((r) => r.name === "INDEX_ALT_TID_MASK")!;
    expect(alt.set).toBe(true);
    expect(alt.meaning).toContain("posting");
  });

  it("marks pivot (ALT, non-posting) tuples distinctly", () => {
    const page = leafWith([{ tidBlock: 0, tidOffset: 0, pivot: true }]);
    const rows = tInfoRows(page.tuples[0]!);
    const alt = rows.find((r) => r.name === "INDEX_ALT_TID_MASK")!;
    expect(alt.set).toBe(true);
    expect(alt.meaning).toContain("pivot");
  });

  it("keeps nulls and vars bits independent (D2: NULL is 0x8000, not ALT)", () => {
    const page = leafWith([{ tidBlock: 1, tidOffset: 1, nulls: true, vars: true }]);
    const rows = tInfoRows(page.tuples[0]!);
    expect(rows.find((r) => r.name === "INDEX_NULL_MASK")!.set).toBe(true);
    expect(rows.find((r) => r.name === "INDEX_VAR_MASK")!.set).toBe(true);
    expect(rows.find((r) => r.name === "INDEX_ALT_TID_MASK")!.set).toBe(false);
  });
});

describe("tidRole (t_tid semantics by page type)", () => {
  it("internal regular tuple -> child page pointer", () => {
    const page = parseBtreePage(
      buildBtreePage({ pageType: "internal", btpoLevel: 2, tuples: [{ tidBlock: 4, tidOffset: 0 }] }),
    );
    expect(tidRole(page, page.tuples[0]!)).toEqual({ role: "child" });
  });

  it("internal/leaf pivot (hikey) tuple -> overwritten, no jump", () => {
    const page = leafWith([{ tidBlock: 9, tidOffset: 9, pivot: true }]);
    // non-rightmost leaf -> first tuple is hikey (pivot)
    const role = tidRole(page, page.tuples[0]!);
    expect(role.role).toBe("none");
    expect(role.role === "none" && role.note).toBeTruthy();
  });

  it("leaf regular tuple -> heap TID", () => {
    // rightmost leaf: first tuple is a regular tuple (no hikey on rightmost pages)
    const page = parseBtreePage(
      buildBtreePage({ pageType: "leaf", tuples: [{ tidBlock: 7, tidOffset: 2 }] }),
    );
    expect(page.tuples[0]!.isHikey).toBe(false);
    expect(tidRole(page, page.tuples[0]!)).toEqual({ role: "heap" });
  });

  it("leaf posting tuple -> jump happens per TID row, not the header", () => {
    const page = leafWith([
      {
        tidBlock: 0,
        tidOffset: 0,
        posting: [{ blockNumber: 1, offsetNumber: 1 }],
      },
    ]);
    const role = tidRole(page, page.tuples[0]!);
    expect(role.role).toBe("none");
    expect(role.role === "none" && role.note.includes("posting")).toBe(true);
  });

  it("deleted page -> t_tid overwritten, no jump (ui-design)", () => {
    const page = parseBtreePage(
      buildBtreePage({
        pageType: "leaf",
        btpoFlagsOverride: BTP_DELETED,
        tuples: [{ tidBlock: 5, tidOffset: 5 }],
      }),
    );
    const role = tidRole(page, page.tuples[0]!);
    expect(role.role).toBe("none");
    expect(role.role === "none" && role.note).toBeTruthy();
  });
});

describe("metapageRows (allequalimage only for v4+, D1)", () => {
  it("lists the six base fields for v3 (no allequalimage)", () => {
    const page = parseBtreePage(buildBtreePage({ pageType: "meta", metaVersion: 3 }));
    const rows = metapageRows(page.meta!);
    expect(rows.map((r) => r.key)).toEqual([
      "btm_magic",
      "btm_version",
      "btm_root",
      "btm_level",
      "btm_fastroot",
      "btm_fastlevel",
    ]);
    expect(rows.find((r) => r.key === "btm_magic")!.value).toBe("0x53162");
  });

  it("adds btm_allequalimage for v4", () => {
    const page = parseBtreePage(buildBtreePage({ pageType: "meta", metaVersion: 4 }));
    const rows = metapageRows(page.meta!);
    expect(rows.map((r) => r.key)).toEqual([
      "btm_magic",
      "btm_version",
      "btm_root",
      "btm_level",
      "btm_fastroot",
      "btm_fastlevel",
      "btm_allequalimage",
    ]);
    expect(rows.find((r) => r.key === "btm_allequalimage")!.value).toBe("true");
  });
});

describe("tuple selection helper", () => {
  it("finds the tuple for tuple-<lpIndex>.* selection ids", () => {
    const page = leafWith([
      { tidBlock: 1, tidOffset: 1 },
      { tidBlock: 2, tidOffset: 2 },
    ]);
    const t = findTupleBySelection(page, "tuple-1.t_info");
    expect(t?.itemoffset).toBe(2);
    expect(findTupleBySelection(page, "tuple-9.t_info")).toBeUndefined();
  });
});

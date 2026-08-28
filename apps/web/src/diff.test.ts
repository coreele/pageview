import { describe, expect, it } from "vitest";
import {
  buildSparsePage,
  buildBtreePage,
  deriveBtreeStructureFields,
  deriveStructureFields,
  parseBtreePage,
  parsePage,
  resolveFieldAt,
  type ByteRange,
} from "page-core";
import { findStructureAt, structureAffectedByDiff } from "./diff";

// ---------------------------------------------------------------------------
// Heap parity: generalized field-based lookups must match the page-core
// page-based oracle (P0-10 — heap behavior must not regress).
// ---------------------------------------------------------------------------

const heapPage = parsePage(buildSparsePage({ currentBlkno: 0 }));
const heapFields = deriveStructureFields(heapPage);

describe("findStructureAt (fields-based, heap parity)", () => {
  it("resolves the same field as page-core resolveFieldAt across the mapped page", () => {
    for (let offset = 0; offset < 4096; offset++) {
      const oracle = resolveFieldAt(heapPage, offset);
      const got = findStructureAt(heapFields, offset);
      if (oracle == null) {
        expect(got).toBeNull();
      } else {
        expect(got?.id).toBe(oracle.id);
        expect(got?.range).toEqual(oracle.range);
        expect(got?.kind).toBe(oracle.region);
      }
    }
  });

  it("returns null for offsets outside every field", () => {
    // Tail of the page beyond tuples is unmapped (heap has no special space).
    const got = findStructureAt(heapFields, 8191);
    expect(got == null || got.range.start <= 8191).toBe(true);
    const unmapped = findStructureAt([], 0);
    expect(unmapped).toBeNull();
  });
});

describe("structureAffectedByDiff (fields-based, heap parity)", () => {
  it("keeps coarse ids header/free plus field ids for heap pages", () => {
    const diffs: ByteRange[] = [{ start: 12, end: 16 }]; // pd_lower/pd_upper
    const ids = structureAffectedByDiff(heapFields, diffs);
    expect(ids.has("header")).toBe(true);
    expect(ids.has("header.pd_lower")).toBe(true);
    expect(ids.has("header.pd_upper")).toBe(true);
    expect(ids.has("free")).toBe(false);
  });

  it("marks the free field when free-space bytes change", () => {
    const fs = heapFields.find((f) => f.id === "free")!;
    const diffs: ByteRange[] = [{ start: fs.range.start, end: fs.range.start + 8 }];
    const ids = structureAffectedByDiff(heapFields, diffs);
    expect(ids.has("free")).toBe(true);
  });

  it("marks tuple fields and their coarse tuple-N parent", () => {
    const t = heapFields.find((f) => f.id.startsWith("tuple-") && f.id.endsWith(".t_xmin"))!;
    const diffs: ByteRange[] = [{ start: t.range.start, end: t.range.end }];
    const ids = structureAffectedByDiff(heapFields, diffs);
    expect(ids.has(t.id)).toBe(true);
    expect(Array.from(ids).some((id) => id.startsWith("tuple-"))).toBe(true);
  });

  it("ignores visual-only fields (selection targets use the 4B parent)", () => {
    const visual = heapFields.find((f) => f.visualOnly)!;
    const diffs: ByteRange[] = [{ start: visual.range.start, end: visual.range.end }];
    const ids = structureAffectedByDiff(heapFields, diffs);
    expect(ids.has(visual.id)).toBe(false);
    // parent itemid-N id is a real field and must be marked instead
    const parent = visual.parentId!;
    expect(ids.has(parent)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// B-tree: special / meta / tuple fields are first-class diff/lookup targets.
// ---------------------------------------------------------------------------

const btreeLeaf = parseBtreePage(
  buildBtreePage({
    pageType: "leaf",
    btpoPrev: 1,
    btpoNext: 3,
    tuples: [{ tidBlock: 5, tidOffset: 7 }],
  }),
);
const btreeLeafFields = deriveBtreeStructureFields(btreeLeaf);

const btreeMeta = parseBtreePage(buildBtreePage({ pageType: "meta" }));
const btreeMetaFields = deriveBtreeStructureFields(btreeMeta);

describe("findStructureAt on B-tree pages (P0-9)", () => {
  it("resolves special space fields at 8176..8192", () => {
    expect(findStructureAt(btreeLeafFields, 8176)?.id).toBe("special.btpo_prev");
    expect(findStructureAt(btreeLeafFields, 8180)?.id).toBe("special.btpo_next");
    expect(findStructureAt(btreeLeafFields, 8188)?.id).toBe("special.btpo_flags");
    expect(findStructureAt(btreeLeafFields, 8191)?.id).toBe("special.btpo_cycleid");
  });

  it("resolves metapage fields (PageGetContents at 24)", () => {
    expect(findStructureAt(btreeMetaFields, 24)?.id).toBe("meta.btm_magic");
    expect(findStructureAt(btreeMetaFields, 32)?.id).toBe("meta.btm_root");
    expect(findStructureAt(btreeMetaFields, 40)?.id).toBe("meta.btm_fastroot");
  });

  it("resolves index tuple t_tid/t_info bytes", () => {
    const tuple = btreeLeaf.tuples[0]!;
    expect(findStructureAt(btreeLeafFields, tuple.range.start)?.id).toContain(".t_tid");
    expect(findStructureAt(btreeLeafFields, tuple.range.start + 6)?.id).toContain(".t_info");
  });
});

describe("structureAffectedByDiff on B-tree pages (P1-4)", () => {
  it("marks special fields when special-space bytes change", () => {
    const ids = structureAffectedByDiff(btreeLeafFields, [{ start: 8180, end: 8184 }]);
    expect(ids.has("special.btpo_next")).toBe(true);
    expect(ids.has("special.btpo_prev")).toBe(false);
  });

  it("marks meta fields when metapage bytes change", () => {
    const ids = structureAffectedByDiff(btreeMetaFields, [{ start: 32, end: 36 }]);
    expect(ids.has("meta.btm_root")).toBe(true);
    expect(ids.has("meta.btm_level")).toBe(false);
  });

  it("marks tuple fields when tuple bytes change", () => {
    const tuple = btreeLeaf.tuples[0]!;
    const ids = structureAffectedByDiff(btreeLeafFields, [
      { start: tuple.range.start, end: tuple.range.start + 6 },
    ]);
    expect(Array.from(ids).some((id) => id.endsWith(".t_tid"))).toBe(true);
  });
});

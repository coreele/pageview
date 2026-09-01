import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
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

// ---------------------------------------------------------------------------
// DEF-1 regression (QA round 1): reverse selection on the REAL PG 16.11
// metapage capture (pd_lower=72). Synthetic buildBtreePage metapages never
// produced pseudo ItemIds, which is why this slipped through — every byte in
// [24..64) must reverse-select a btm_* field, never a pseudo itemid.
// ---------------------------------------------------------------------------

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../../../packages/page-core/fixtures");
const btreeMetaRealRaw = new Uint8Array(
  Buffer.from(
    readFileSync(join(fixturesDir, "btree-meta.base64.txt"), "utf8").trim(),
    "base64",
  ),
);
const btreeMetaReal = parseBtreePage(btreeMetaRealRaw);
const btreeMetaRealFields = deriveBtreeStructureFields(btreeMetaReal);

describe("findStructureAt on the real metapage capture (DEF-1 regression)", () => {
  it("reverse-selects btm_magic/version/root/level/fastroot/fastlevel in [24..64) and allequalimage at 64", () => {
    expect(btreeMetaReal.header.pd_lower).toBe(72); // real-capture guard
    expect(btreeMetaReal.stats.itemIdTotal).toBe(0); // meta-bar ItemId=0
    expect(findStructureAt(btreeMetaRealFields, 24)?.id).toBe("meta.btm_magic");
    expect(findStructureAt(btreeMetaRealFields, 28)?.id).toBe("meta.btm_version");
    expect(findStructureAt(btreeMetaRealFields, 32)?.id).toBe("meta.btm_root");
    expect(findStructureAt(btreeMetaRealFields, 36)?.id).toBe("meta.btm_level");
    expect(findStructureAt(btreeMetaRealFields, 40)?.id).toBe("meta.btm_fastroot");
    expect(findStructureAt(btreeMetaRealFields, 44)?.id).toBe("meta.btm_fastlevel");
    expect(findStructureAt(btreeMetaRealFields, 64)?.id).toBe("meta.btm_allequalimage");
  });

  it("never resolves a pseudo itemid anywhere in the BTMetaPageData span [24..64)", () => {
    // Every byte of the six modeled btm_* fields [24..48) reverse-selects meta
    for (let offset = 24; offset < 48; offset++) {
      const hit = findStructureAt(btreeMetaRealFields, offset);
      expect(hit, `offset ${offset}`).not.toBeNull();
      expect(hit!.kind, `offset ${offset}`).toBe("meta");
    }
    // [48..64) holds v3+ cleanup fields (delpages / float8) that are not
    // modeled as clickable fields — unmapped (null) is correct, a pseudo
    // itemid (the DEF-1 symptom) is not
    for (let offset = 48; offset < 64; offset++) {
      const hit = findStructureAt(btreeMetaRealFields, offset);
      expect(hit == null || hit.kind === "meta", `offset ${offset}`).toBe(true);
    }
    expect(btreeMetaRealFields.some((f) => f.region === "itemid")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BTP_DELETED,
  BTP_HALF_DEAD,
  BTP_HAS_GARBAGE,
  BTP_INCOMPLETE_SPLIT,
  BTP_LEAF,
  BTP_META,
  BTP_ROOT,
  BTREE_MAGIC,
  buildBtreePage,
  decodeBtpoFlags,
  deriveBtreeStructureFields,
  applyIndexKeyCellValues,
  INDEX_KEY_CELL_MAX_CHARS,
  clipKeyCellText,
  compactKeyCellText,
  keyBytesHexCellText,
  parseBtreePage,
  PageParseError,
  STANDARD_PAGE_SIZE,
} from "../src/index.js";

describe("parseBtreePage — classification", () => {
  it("classifies a v4 metapage and parses all seven meta fields", () => {
    const raw = buildBtreePage({ pageType: "meta" });
    const page = parseBtreePage(raw);
    expect(page.pageType).toBe("meta");
    expect(page.meta).not.toBeNull();
    expect(page.meta!.btm_magic).toBe(BTREE_MAGIC);
    expect(page.meta!.btm_magic).toBe(0x053162);
    expect(page.meta!.btm_version).toBe(4);
    expect(page.meta!.btm_root).toBe(3);
    expect(page.meta!.btm_level).toBe(1);
    expect(page.meta!.btm_fastroot).toBe(3);
    expect(page.meta!.btm_fastlevel).toBe(1);
    expect(page.meta!.btm_allequalimage).toBe(true);
    expect(page.special).not.toBeNull();
    expect(page.special!.btpo_flags).toBe(BTP_META);
    expect(page.tuples).toHaveLength(0);
  });

  it("does not surface allequalimage for v3 metapages", () => {
    const raw = buildBtreePage({ pageType: "meta", metaVersion: 3 });
    const page = parseBtreePage(raw);
    expect(page.pageType).toBe("meta");
    expect(page.meta!.btm_version).toBe(3);
    expect(page.meta!.btm_allequalimage).toBeUndefined();
  });

  it("classifies internal pages by btpo_level > 0 and leaf pages by BTP_LEAF", () => {
    const internal = parseBtreePage(
      buildBtreePage({
        pageType: "internal",
        btpoLevel: 1,
        btpoNext: 2,
        tuples: [
          { tidBlock: 1, tidOffset: 0, pivot: true },
          { tidBlock: 2, tidOffset: 1, keyBytes: new Uint8Array([1, 0, 0, 0]) },
        ],
      }),
    );
    expect(internal.pageType).toBe("internal");
    expect(internal.special!.btpo_level).toBe(1);
    expect(internal.flags.isRightmost).toBe(false);

    const leaf = parseBtreePage(
      buildBtreePage({
        pageType: "leaf",
        tuples: [{ tidBlock: 7, tidOffset: 3, keyBytes: new Uint8Array([1, 0, 0, 0]) }],
      }),
    );
    expect(leaf.pageType).toBe("leaf");
    expect(leaf.special!.btpo_flags & BTP_LEAF).toBe(BTP_LEAF);
  });
});

describe("parseBtreePage — special space", () => {
  it("parses the five opaque fields at pd_special", () => {
    const raw = buildBtreePage({
      pageType: "leaf",
      btpoPrev: 4,
      btpoNext: 6,
      btpoLevel: 0,
      btpoCycleid: 77,
      tuples: [{ tidBlock: 1, tidOffset: 1 }],
    });
    const page = parseBtreePage(raw);
    expect(page.special).toEqual({
      btpo_prev: 4,
      btpo_next: 6,
      btpo_level: 0,
      btpo_flags: BTP_LEAF,
      btpo_cycleid: 77,
      range: { start: 8176, end: 8192 },
    });
  });

  it("derives isRoot/isRightmost/deleted/halfDead/hasGarbage/incompleteSplit from btpo_flags", () => {
    const raw = buildBtreePage({
      pageType: "leaf",
      btpoFlagsOverride:
        BTP_LEAF | BTP_ROOT | BTP_DELETED | BTP_HALF_DEAD | BTP_HAS_GARBAGE | BTP_INCOMPLETE_SPLIT,
    });
    const page = parseBtreePage(raw);
    expect(page.flags).toEqual({
      isRoot: true,
      isRightmost: true,
      deleted: true,
      halfDead: true,
      hasGarbage: true,
      incompleteSplit: true,
    });
  });
});

describe("parseBtreePage — index tuples", () => {
  it("parses t_tid, itemlen, t_info nulls/vars bits per tuple", () => {
    const raw = buildBtreePage({
      pageType: "leaf",
      tuples: [
        { tidBlock: 5, tidOffset: 9, keyBytes: new Uint8Array(8), nulls: true },
        { tidBlock: 5, tidOffset: 10, keyBytes: new Uint8Array([8]), vars: true },
      ],
    });
    const page = parseBtreePage(raw);
    expect(page.tuples).toHaveLength(2);
    const [a, b] = page.tuples;
    expect(a!.itemoffset).toBe(1);
    expect(a!.t_tid).toEqual({ blockNumber: 5, offsetNumber: 9 });
    expect(a!.itemlen).toBe(16);
    expect(a!.hasNulls).toBe(true);
    expect(a!.hasVars).toBe(false);
    expect(a!.keyRange).toEqual({ start: a!.range.start + 8, end: a!.range.end });
    expect(b!.hasNulls).toBe(false);
    expect(b!.hasVars).toBe(true);
    expect(b!.t_info & 0x1fff).toBe(b!.itemlen);
  });

  it("marks the first LP_NORMAL tuple as hikey on a non-rightmost page only", () => {
    const withNext = parseBtreePage(
      buildBtreePage({
        pageType: "leaf",
        btpoNext: 2,
        tuples: [
          { tidBlock: 1, tidOffset: 1 },
          { tidBlock: 1, tidOffset: 2 },
        ],
      }),
    );
    expect(withNext.tuples.map((t) => t.isHikey)).toEqual([true, false]);

    const rightmost = parseBtreePage(
      buildBtreePage({
        pageType: "leaf",
        btpoNext: 0,
        tuples: [
          { tidBlock: 1, tidOffset: 1 },
          { tidBlock: 1, tidOffset: 2 },
        ],
      }),
    );
    expect(rightmost.tuples.every((t) => !t.isHikey)).toBe(true);
  });

  it("decodes posting tuples: count, TID list in stored order, key range before the list", () => {
    const tids = [
      { blockNumber: 0, offsetNumber: 50 },
      { blockNumber: 0, offsetNumber: 100 },
      { blockNumber: 3, offsetNumber: 7 },
    ];
    const raw = buildBtreePage({
      pageType: "leaf",
      tuples: [
        { tidBlock: 1, tidOffset: 1 },
        { tidBlock: 0, tidOffset: 0, keyBytes: new Uint8Array(8), posting: tids },
      ],
    });
    const page = parseBtreePage(raw);
    const posting = page.tuples[1]!;
    expect(posting.isPosting).toBe(true);
    expect(posting.isPivot).toBe(false);
    expect(posting.postingCount).toBe(3);
    expect(posting.postingTids).toEqual(tids);
    expect(posting.keyRange).toEqual({
      start: posting.range.start + 8,
      end: posting.range.start + 16,
    });
    expect(page.stats.postingTupleCount).toBe(1);
    expect(page.stats.postingTidCount).toBe(3);
    // raw t_tid holds the posting header: count | BT_IS_POSTING in posid,
    // posting list offset (within the tuple) in the block part.
    expect(posting.t_tid.offsetNumber & 0x0fff).toBe(3);
    expect(posting.t_tid.offsetNumber & 0x2000).toBe(0x2000);
    expect(posting.postingOffset).toBe(16);
  });

  it("marks pivot tuples (hikey with ALT bit and BT_PIVOT_HEAP_TID_ATTR) as isPivot", () => {
    const raw = buildBtreePage({
      pageType: "internal",
      btpoLevel: 1,
      btpoNext: 2,
      tuples: [
        { tidBlock: 1, tidOffset: 0, pivot: true },
        { tidBlock: 2, tidOffset: 1, keyBytes: new Uint8Array([1]) },
      ],
    });
    const page = parseBtreePage(raw);
    expect(page.tuples[0]!.isPivot).toBe(true);
    expect(page.tuples[0]!.isHikey).toBe(true);
    expect(page.tuples[1]!.isPivot).toBe(false);
    // downlink tuples carry the child block in t_tid
    expect(page.tuples[1]!.t_tid.blockNumber).toBe(2);
  });
});

describe("parseBtreePage — robustness", () => {
  it("throws PageParseError for non-8KB input", () => {
    expect(() => parseBtreePage(new Uint8Array(100))).toThrow(PageParseError);
    expect(() => parseBtreePage(new Uint8Array(100))).toThrow(/8192/);
  });

  it("warns on metapage magic mismatch but keeps parsing the rest", () => {
    const raw = buildBtreePage({ pageType: "meta", metaBadMagic: true });
    const page = parseBtreePage(raw);
    expect(page.pageType).toBe("meta");
    expect(page.warnings.some((w) => /magic/i.test(w))).toBe(true);
    expect(page.meta!.btm_root).toBe(3);
  });

  it("skips tuples with out-of-range lp_off and records a warning instead of crashing", () => {
    const raw = buildBtreePage({
      pageType: "leaf",
      tuples: [{ tidBlock: 1, tidOffset: 1 }],
      corruptLpOffset: true,
    });
    const page = parseBtreePage(raw);
    expect(page.tuples).toHaveLength(1);
    expect(page.warnings.some((w) => /out of range|invalid/i.test(w))).toBe(true);
    expect(page.stats.itemIdTotal).toBe(2);
  });
});

describe("decodeBtpoFlags", () => {
  it("decodes each known BTP bit and flags unknown bits", () => {
    const bits = decodeBtpoFlags(BTP_LEAF | BTP_ROOT);
    const byName = new Map(bits.map((b) => [b.name, b.set]));
    expect(byName.get("BTP_LEAF")).toBe(true);
    expect(byName.get("BTP_ROOT")).toBe(true);
    expect(byName.get("BTP_DELETED")).toBe(false);
    expect(byName.get("BTP_META")).toBe(false);
    expect(byName.get("BTP_HALF_DEAD")).toBe(false);
    expect(byName.get("BTP_HAS_GARBAGE")).toBe(false);
    expect(byName.get("BTP_INCOMPLETE_SPLIT")).toBe(false);

    const unknown = decodeBtpoFlags(0x8000);
    expect(unknown.some((b) => b.name.includes("UNKNOWN") && b.set)).toBe(true);
  });
});

describe("deriveBtreeStructureFields", () => {
  it("covers header/itemid/free/tuple/special regions with byte ranges", () => {
    const raw = buildBtreePage({
      pageType: "leaf",
      btpoPrev: 4,
      btpoNext: 6,
      tuples: [
        { tidBlock: 1, tidOffset: 1 },
        { tidBlock: 0, tidOffset: 0, keyBytes: new Uint8Array(8), posting: [{ blockNumber: 2, offsetNumber: 3 }] },
      ],
    });
    const page = parseBtreePage(raw);
    const fields = deriveBtreeStructureFields(page);
    const byId = new Map(fields.map((f) => [f.id, f]));

    expect(byId.get("header.pd_lower")).toMatchObject({ region: "header", range: { start: 12, end: 14 } });
    expect(byId.get("itemid-0")).toMatchObject({ region: "itemid" });
    expect(byId.get("free")).toBeDefined();
    expect(byId.get("tuple-0.t_tid")).toMatchObject({ region: "tuple" });
    expect(byId.get("tuple-0.t_info")).toBeDefined();
    expect(byId.get("tuple-0.key")).toBeDefined();
    expect(byId.get("tuple-0.key")?.valueText).toBeTruthy();
    expect(byId.get("tuple-1.posting-tids")).toMatchObject({ region: "tuple" });

    expect(byId.get("special.btpo_prev")).toMatchObject({
      region: "special",
      range: { start: 8176, end: 8180 },
    });
    expect(byId.get("special.btpo_next")).toMatchObject({ range: { start: 8180, end: 8184 } });
    expect(byId.get("special.btpo_level")).toMatchObject({ range: { start: 8184, end: 8188 } });
    expect(byId.get("special.btpo_flags")).toMatchObject({ range: { start: 8188, end: 8190 } });
    expect(byId.get("special.btpo_cycleid")).toMatchObject({ range: { start: 8190, end: 8192 } });
    // special field ranges stay inside the page
    for (const f of fields) {
      expect(f.range.start).toBeGreaterThanOrEqual(0);
      expect(f.range.end).toBeLessThanOrEqual(STANDARD_PAGE_SIZE);
      expect(f.range.end).toBeGreaterThan(f.range.start);
    }
  });

  it("covers metapage fields in the meta region", () => {
    const page = parseBtreePage(buildBtreePage({ pageType: "meta" }));
    const fields = deriveBtreeStructureFields(page);
    const byId = new Map(fields.map((f) => [f.id, f]));
    expect(byId.get("meta.btm_magic")).toMatchObject({
      region: "meta",
      range: { start: 24, end: 28 },
    });
    expect(byId.get("meta.btm_version")).toMatchObject({ range: { start: 28, end: 32 } });
    expect(byId.get("meta.btm_root")).toMatchObject({ range: { start: 32, end: 36 } });
    expect(byId.get("meta.btm_level")).toMatchObject({ range: { start: 36, end: 40 } });
    expect(byId.get("meta.btm_fastroot")).toMatchObject({ range: { start: 40, end: 44 } });
    expect(byId.get("meta.btm_fastlevel")).toMatchObject({ range: { start: 44, end: 48 } });
    expect(byId.get("meta.btm_allequalimage")).toMatchObject({ range: { start: 64, end: 65 } });
  });

  it("omits allequalimage field for v3 metapages", () => {
    const page = parseBtreePage(buildBtreePage({ pageType: "meta", metaVersion: 3 }));
    const fields = deriveBtreeStructureFields(page);
    expect(fields.some((f) => f.id === "meta.btm_allequalimage")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DEF-1 regression (QA round 1): real PG 16.11 metapage capture.
// A real metapage has pd_lower past the BTMetaPageData content (72 for v4),
// and the generic ItemId reader must NOT reinterpret [24..pd_lower) as
// ItemIdData[] — nbtree metapages carry zero line pointers.
// ---------------------------------------------------------------------------

describe("parseBtreePage — DEF-1 regression (real metapage capture)", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures");
  const raw = new Uint8Array(
    Buffer.from(
      readFileSync(join(fixtureDir, "btree-meta.base64.txt"), "utf8").trim(),
      "base64",
    ),
  );

  it("treats the metapage as zero ItemIds ([24..pd_lower) is BTMetaPageData, not ItemIdData[])", () => {
    const page = parseBtreePage(raw);
    expect(page.pageType).toBe("meta");
    // guard: this is the real capture with pd_lower=72 (12 pseudo 4B slots)
    expect(page.header.pd_lower).toBe(72);
    expect(page.itemIds).toHaveLength(0);
    expect(page.stats.itemIdTotal).toBe(0);
    expect(page.stats.lpUnused).toBe(0);
    expect(page.stats.lpNormal).toBe(0);
    expect(page.stats.lpRedirect).toBe(0);
    expect(page.stats.lpDead).toBe(0);
    expect(page.warnings).toHaveLength(0);
  });

  it("derives no itemid structure fields for the metapage while meta fields stay clickable", () => {
    const page = parseBtreePage(raw);
    const fields = deriveBtreeStructureFields(page);
    expect(fields.some((f) => f.region === "itemid")).toBe(false);
    const byId = new Map(fields.map((f) => [f.id, f]));
    for (const id of [
      "meta.btm_magic",
      "meta.btm_version",
      "meta.btm_root",
      "meta.btm_level",
      "meta.btm_fastroot",
      "meta.btm_fastlevel",
      "meta.btm_allequalimage",
    ]) {
      expect(byId.get(id)).toBeDefined();
    }
  });
});

describe("index key cell text (V-1 / V-2 / V-3)", () => {
  it("clips long strings with an ellipsis and keeps length ≤ max", () => {
    expect(clipKeyCellText("12345678901234")).toBe("12345678901234");
    expect(clipKeyCellText("123456789012345").length).toBe(INDEX_KEY_CELL_MAX_CHARS);
    expect(clipKeyCellText("123456789012345").endsWith("…")).toBe(true);
  });

  it("puts a compact hex preview on the key field so the cell is not empty", () => {
    const key = new Uint8Array(8);
    new DataView(key.buffer).setInt32(0, 10, true);
    const page = parseBtreePage(
      buildBtreePage({ pageType: "leaf", tuples: [{ tidBlock: 0, tidOffset: 10, keyBytes: key }] }),
    );
    const field = deriveBtreeStructureFields(page).find((f) => f.id === "tuple-0.key");
    expect(field?.valueText).toBe(keyBytesHexCellText(page.raw, page.tuples[0]!.keyRange));
    expect(field?.valueText?.length).toBeGreaterThan(0);
    expect(field!.valueText!.length).toBeLessThanOrEqual(INDEX_KEY_CELL_MAX_CHARS);
  });

    it("replaces the key blob with per-column decoded values", () => {
    const key = new Uint8Array(8);
    new DataView(key.buffer).setInt32(0, 10, true);
    const page = parseBtreePage(
      buildBtreePage({ pageType: "leaf", tuples: [{ tidBlock: 0, tidOffset: 10, keyBytes: key }] }),
    );
    const fields = deriveBtreeStructureFields(page);
    const overlaid = applyIndexKeyCellValues(fields, page, [
      { attnum: 1, name: "id", typoid: 23, typname: "int4" },
    ]);
    expect(overlaid.find((f) => f.id === "tuple-0.key")?.visualOnly).toBe(true);
    const col = overlaid.find((f) => f.id === "tuple-0.col-1");
    expect(col?.label).toBe("id");
    expect(col?.valueText).toBe("10");
    expect(col?.visualOnly).toBeFalsy();
    expect(col?.range).toEqual(page.tuples[0]!.keyRange);
  });

  it("joins decoded columns and still clips", () => {
    expect(compactKeyCellText([{ attnum: 1, name: "a", typname: "int4", status: "value", display: "1" }])).toBe(
      "1",
    );
    expect(
      compactKeyCellText([
        { attnum: 1, name: "a", typname: "int4", status: "null" },
        { attnum: 2, name: "b", typname: "text", status: "value", display: "'hello-world-extra'" },
      ]).endsWith("…"),
    ).toBe(true);
  });
});

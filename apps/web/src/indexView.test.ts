import { describe, expect, it } from "vitest";
import { buildBtreePage, parseBtreePage, BTP_HAS_GARBAGE, BTP_INCOMPLETE_SPLIT, BTP_ROOT } from "page-core";
import type { IndexRow } from "./api";
import {
  canLoadIndex,
  filterIndexesByTable,
  formatIndexOption,
  indexOptionTitle,
  indexSelectionSurvives,
  levelText,
  nonBtreeHint,
  pageTypeBadge,
} from "./indexView";

function idx(overrides: Partial<IndexRow> = {}): IndexRow {
  return {
    oid: 24576,
    schema: "public",
    name: "orders_oid_idx",
    qualifiedName: "public.orders_oid_idx",
    accessMethod: "btree",
    blocks: 12,
    tableOid: 16384,
    tableQualifiedName: "public.orders",
    valid: true,
    ...overrides,
  };
}

describe("index option text (four elements: qualifiedName, am, blocks, table)", () => {
  it("formats a valid B-tree option", () => {
    expect(formatIndexOption(idx())).toBe(
      "public.orders_oid_idx (btree · 12 blk · → public.orders)",
    );
  });

  it("prefixes non-B-tree options with ✕ and keeps the same tail format", () => {
    const hash = idx({
      name: "orders_hash_idx",
      qualifiedName: "public.orders_hash_idx",
      accessMethod: "hash",
      blocks: 3,
    });
    expect(formatIndexOption(hash)).toBe(
      "✕ public.orders_hash_idx (hash · 3 blk · → public.orders)",
    );
  });

  it("suffixes invalid indexes with a badge marker (still selectable)", () => {
    expect(formatIndexOption(idx({ valid: false }))).toBe(
      "public.orders_oid_idx (btree · 12 blk · → public.orders) · invalid",
    );
  });

  it("combines ✕ prefix and invalid suffix when both apply", () => {
    const hash = idx({ accessMethod: "hash", valid: false, blocks: 1 });
    expect(formatIndexOption(hash)).toBe(
      "✕ public.orders_oid_idx (hash · 1 blk · → public.orders) · invalid",
    );
  });
});

describe("index option titles", () => {
  it("explains the B-tree-only restriction with the access method name", () => {
    expect(indexOptionTitle(idx({ accessMethod: "hash" }))).toBe(
      "hash: only B-tree index pages are supported",
    );
  });

  it("explains indisvalid=false is still loadable", () => {
    expect(indexOptionTitle(idx({ valid: false }))).toBe(
      "indisvalid=false; loadable for inspection only",
    );
  });

  it("keeps a neutral title for loadable B-tree indexes", () => {
    expect(indexOptionTitle(idx())).toBe("public.orders_oid_idx · → public.orders");
  });
});

describe("load gating (P0-2: selectable but never loadable)", () => {
  it("allows null selection and any B-tree index, rejects non-B-tree", () => {
    expect(canLoadIndex(null)).toBe(false);
    expect(canLoadIndex(idx())).toBe(true);
    expect(canLoadIndex(idx({ accessMethod: "gin" }))).toBe(false);
    expect(canLoadIndex(idx({ accessMethod: "hash" }))).toBe(false);
  });

  it("keeps invalid (indisvalid=false) B-tree indexes loadable", () => {
    expect(canLoadIndex(idx({ valid: false }))).toBe(true);
  });

  it("renders the inline hint with the access method name and next step", () => {
    expect(nonBtreeHint(idx({ accessMethod: "hash" }))).toBe(
      "hash index page parsing is not supported — B-tree only. Pick a B-tree index or switch back to a table.",
    );
    expect(nonBtreeHint(null)).toBeNull();
    expect(nonBtreeHint(idx())).toBeNull();
  });
});

describe("table filter (change-2 annex 2: All tables vs tableOid match)", () => {
  const others = idx({
    oid: 24577,
    name: "customers_pkey",
    qualifiedName: "public.customers_pkey",
    blocks: 5,
    tableOid: 16400,
    tableQualifiedName: "public.customers",
  });

  it("returns the full list when no table is selected (All tables)", () => {
    expect(filterIndexesByTable([idx(), others], null)).toEqual([idx(), others]);
  });

  it("keeps only indexes of the selected table (tableOid match)", () => {
    expect(filterIndexesByTable([idx(), others], 16384)).toEqual([idx()]);
    expect(filterIndexesByTable([idx(), others], 16400)).toEqual([others]);
  });

  it("yields an empty list when the table has no indexes", () => {
    expect(filterIndexesByTable([idx(), others], 99999)).toEqual([]);
  });
});

describe("selection survival (change-2 annex 2 rule 1 reset predicate)", () => {
  it("null selection always survives (nothing to reset)", () => {
    expect(indexSelectionSurvives(null, [])).toBe(true);
    expect(indexSelectionSurvives(null, [idx()])).toBe(true);
  });

  it("survives when the selected index stays in the filtered list", () => {
    expect(indexSelectionSurvives(24576, [idx()])).toBe(true);
  });

  it("does not survive when the filter drops the selected index", () => {
    expect(indexSelectionSurvives(24576, [])).toBe(false);
    expect(
      indexSelectionSurvives(
        24576,
        [idx({ oid: 24577, tableOid: 16400, tableQualifiedName: "public.customers" })],
      ),
    ).toBe(false);
  });
});

describe("filtered option text drops the owning-table suffix", () => {
  it("keeps the suffix by default (browse-all state, P0-1)", () => {
    expect(formatIndexOption(idx())).toBe(
      "public.orders_oid_idx (btree · 12 blk · → public.orders)",
    );
  });

  it("drops the suffix in the filtered state", () => {
    expect(formatIndexOption(idx(), { omitTableSuffix: true })).toBe(
      "public.orders_oid_idx (btree · 12 blk)",
    );
  });

  it("keeps the ✕ prefix and invalid suffix in the filtered state", () => {
    expect(
      formatIndexOption(idx({ accessMethod: "hash", valid: false, blocks: 1 }), {
        omitTableSuffix: true,
      }),
    ).toBe("✕ public.orders_oid_idx (hash · 1 blk) · invalid");
  });
});

describe("filtered option title drops the owning-table suffix", () => {
  it("keeps a neutral title without the suffix in the filtered state", () => {
    expect(indexOptionTitle(idx(), { omitTableSuffix: true })).toBe(
      "public.orders_oid_idx",
    );
  });

  it("keeps non-B-tree / invalid titles unchanged in the filtered state", () => {
    expect(indexOptionTitle(idx({ accessMethod: "hash" }), { omitTableSuffix: true })).toBe(
      "hash: only B-tree index pages are supported",
    );
    expect(indexOptionTitle(idx({ valid: false }), { omitTableSuffix: true })).toBe(
      "indisvalid=false; loadable for inspection only",
    );
  });
});

describe("page type badge (meta / internal·LN / leaf + status chips)", () => {
  it("badges metapage without chips", () => {
    const page = parseBtreePage(buildBtreePage({ pageType: "meta" }));
    expect(pageTypeBadge(page)).toEqual({ text: "meta", chips: [] });
  });

  it("badges internal pages with their level", () => {
    const page = parseBtreePage(buildBtreePage({ pageType: "internal", btpoLevel: 2 }));
    expect(pageTypeBadge(page)).toEqual({ text: "internal·L2", chips: ["root"] });
  });

  it("badges leaf pages", () => {
    const page = parseBtreePage(buildBtreePage({ pageType: "leaf" }));
    expect(pageTypeBadge(page)).toEqual({ text: "leaf", chips: [] });
  });

  it("derives P1-2 status chips from btpo_flags", () => {
    const page = parseBtreePage(
      buildBtreePage({ pageType: "internal", btpoFlagsOverride: BTP_ROOT | BTP_HAS_GARBAGE | BTP_INCOMPLETE_SPLIT }),
    );
    expect(pageTypeBadge(page)).toEqual({
      text: "internal·L1",
      chips: ["root", "garbage", "split-unfinished"],
    });
  });

  it("levels display: meta is em-dash, others show the level", () => {
    expect(levelText(parseBtreePage(buildBtreePage({ pageType: "meta" })))).toBe("—");
    expect(levelText(parseBtreePage(buildBtreePage({ pageType: "internal", btpoLevel: 2 })))).toBe("2");
    expect(levelText(parseBtreePage(buildBtreePage({ pageType: "leaf" })))).toBe("0");
  });
});

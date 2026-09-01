import { describe, expect, it } from "vitest";
import { buildBtreePage, parseBtreePage, BTP_HAS_GARBAGE, BTP_INCOMPLETE_SPLIT, BTP_ROOT } from "page-core";
import type { IndexRow } from "./api";
import {
  canLoadIndex,
  formatIndexOption,
  indexOptionTitle,
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

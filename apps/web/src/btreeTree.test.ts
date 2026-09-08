import { describe, expect, it } from "vitest";
import { BTP_HAS_GARBAGE, BTP_ROOT, buildBtreePage, parseBtreePage } from "page-core";
import {
  EMPTY_BTREE_TREE,
  HEAP_BLOCK_LIST_CAP,
  fetchKey,
  heapBlockListRange,
  markLoading,
  pendingFetches,
  putError,
  putReady,
  ensureTableExpanded,
  resetBtreeTree,
  retryNode,
  seedCurrentPage,
  setTreeCollapsed,
  tableNameClickCollapses,
  indexNameClickCollapses,
  toggleExpanded,
  toggleIndexExpanded,
  toggleIndexSectionCollapsed,
  toggleTableExpanded,
  toggleTableSectionCollapsed,
  treeChromeVisible,
  treeKindTokens,
  visibleHeapBlockList,
  visibleIndexCatalog,
  visibleTableCatalog,
  visibleTree,
  withPathExpansion,
} from "./btreeTree";

const OID = 24576;
const OID2 = 24580;

const meta = parseBtreePage(buildBtreePage({ pageType: "meta", metaRoot: 3 }));
const root = parseBtreePage(
  buildBtreePage({
    pageType: "internal",
    btpoLevel: 1,
    tuples: [
      { tidBlock: 10, tidOffset: 1, pivot: true },
      { tidBlock: 11, tidOffset: 1, pivot: true },
      { tidBlock: 12, tidOffset: 1, pivot: true },
    ],
  }),
);
const leaf11 = parseBtreePage(buildBtreePage({ pageType: "leaf" }));
const leaf99 = parseBtreePage(buildBtreePage({ pageType: "leaf" }));

const rangeError = {
  code: "BLKNO_OUT_OF_RANGE",
  message: "block 3 is out of range",
  nextStep: "Pick another block.",
};

function openedAtLeaf() {
  let s = setTreeCollapsed(EMPTY_BTREE_TREE, false);
  s = seedCurrentPage(s, OID, 11, leaf11);
  s = putReady(s, OID, 0, meta);
  s = putReady(s, OID, 3, root);
  return withPathExpansion(s, OID, 11);
}

describe("treeChromeVisible", () => {
  it("is true for table kind even with no page (P0-1)", () => {
    expect(treeChromeVisible({ relationKind: "table", pageKind: undefined })).toBe(true);
    expect(treeChromeVisible({ relationKind: "table", pageKind: "heap" })).toBe(true);
  });

  it("is true for index kind even with no page (P0-7)", () => {
    expect(treeChromeVisible({ relationKind: "index", pageKind: undefined })).toBe(true);
    expect(treeChromeVisible({ relationKind: "index", pageKind: "heap" })).toBe(true);
    expect(treeChromeVisible({ relationKind: "index", pageKind: "btree" })).toBe(true);
  });
});

describe("pendingFetches (P0-1 / P0-5)", () => {
  it("requests nothing while collapsed", () => {
    let s = seedCurrentPage(EMPTY_BTREE_TREE, OID, 11, leaf11);
    expect(pendingFetches(s)).toEqual([]);
  });

  it("on open fetches meta then root, not every leaf", () => {
    let s = setTreeCollapsed(EMPTY_BTREE_TREE, false);
    s = seedCurrentPage(s, OID, 11, leaf11);
    expect(pendingFetches(s)).toEqual([{ oid: OID, blkno: 0 }]);
    s = putReady(s, OID, 0, meta);
    expect(pendingFetches(s)).toEqual([{ oid: OID, blkno: 3 }]);
    s = putReady(s, OID, 3, root);
    s = withPathExpansion(s, OID, 11);
    expect(pendingFetches(s)).toEqual([]);
    const { rows } = visibleTree(s, OID, 11);
    expect(rows.map((r) => r.blkno)).toEqual([0, 3, 10, 11, 12]);
    expect(rows.find((r) => r.blkno === 11)?.current).toBe(true);
  });

  it("does not refetch ready or in-flight blocks", () => {
    let s = setTreeCollapsed(EMPTY_BTREE_TREE, false);
    s = toggleIndexExpanded(s, OID);
    s = markLoading(s, [{ oid: OID, blkno: 0 }]);
    expect(pendingFetches(s)).toEqual([]);
  });
});

describe("visibleTree (P0-4 / P0-6 / P1-2)", () => {
  it("auto-expands the path to the current leaf", () => {
    const { rows, orphan } = visibleTree(openedAtLeaf(), OID, 11);
    expect(orphan).toBeNull();
    expect(rows.every((r) => r.role === "page")).toBe(true);
    expect(rows.find((r) => r.blkno === 0)?.expanded).toBe(true);
    expect(rows.find((r) => r.blkno === 3)?.expanded).toBe(true);
    expect(rows.find((r) => r.blkno === 11)?.current).toBe(true);
  });

  it("keeps the tree open conceptually after selecting another leaf (P0-6)", () => {
    const s = openedAtLeaf();
    expect(s.collapsed).toBe(false);
    const { rows } = visibleTree(s, OID, 12);
    expect(rows.find((r) => r.blkno === 12)?.current).toBe(true);
  });

  it("shows an orphan warning row when the current page is unreachable", () => {
    let s = setTreeCollapsed(EMPTY_BTREE_TREE, false);
    s = putReady(s, OID, 0, meta);
    s = putReady(s, OID, 3, root);
    s = seedCurrentPage(s, OID, 99, leaf99);
    s = withPathExpansion(s, OID, 99);
    const { rows, orphan } = visibleTree(s, OID, 99);
    expect(orphan?.blkno).toBe(99);
    expect(orphan?.current).toBe(true);
    expect(rows.some((r) => r.blkno === 99)).toBe(false);
  });

  it("keeps slices isolated so two indexes can share blkno 0", () => {
    let s = setTreeCollapsed(EMPTY_BTREE_TREE, false);
    s = putReady(s, OID, 0, meta);
    s = putReady(s, OID2, 0, meta);
    s = toggleIndexExpanded(s, OID);
    s = toggleIndexExpanded(s, OID2);
    expect(pendingFetches(s).map(fetchKey).sort()).toEqual(["24576:3", "24580:3"]);
  });
});

describe("visibleHeapBlockList (P0-9 / P0-10)", () => {
  it("lists every heap block and highlights the current one", () => {
    const { rows, orphan, emptyHint } = visibleHeapBlockList(5, 2);
    expect(orphan).toBeNull();
    expect(emptyHint).toBeNull();
    expect(rows.map((r) => r.blkno)).toEqual([0, 1, 2, 3, 4]);
    expect(rows.every((r) => r.role === "page" && !r.expandable && r.depth === 0)).toBe(true);
    expect(rows.find((r) => r.blkno === 2)?.current).toBe(true);
    expect(rows.filter((r) => r.current)).toHaveLength(1);
  });

  it("shows an empty-relation hint when blocks is 0", () => {
    const { rows, emptyHint } = visibleHeapBlockList(0, null);
    expect(rows).toEqual([]);
    expect(emptyHint).toBe("Empty relation (0 blocks)");
  });

  it("windows a large relation around the current block", () => {
    const { start, end, clipped } = heapBlockListRange(3000, 1500);
    expect(clipped).toBe(true);
    expect(end - start).toBe(HEAP_BLOCK_LIST_CAP);
    expect(start).toBeLessThanOrEqual(1500);
    expect(end).toBeGreaterThan(1500);

    const { rows, emptyHint } = visibleHeapBlockList(3000, 1500);
    expect(rows).toHaveLength(HEAP_BLOCK_LIST_CAP);
    expect(rows[0]?.blkno).toBe(start);
    expect(rows.at(-1)?.blkno).toBe(end - 1);
    expect(rows.find((r) => r.blkno === 1500)?.current).toBe(true);
    expect(emptyHint).toBe(`Showing blk ${start}–${end - 1} of 3000`);
  });

  it("pins the window to the start or end of the relation", () => {
    expect(heapBlockListRange(3000, 0)).toEqual({
      start: 0,
      end: HEAP_BLOCK_LIST_CAP,
      clipped: true,
    });
    expect(heapBlockListRange(3000, 2999)).toEqual({
      start: 3000 - HEAP_BLOCK_LIST_CAP,
      end: 3000,
      clipped: true,
    });
  });
});

const CATALOG = [
  { oid: 16384, qualifiedName: "public.orders", blocks: 5 },
  { oid: 16385, qualifiedName: "public.empty", blocks: 0 },
  { oid: 16386, qualifiedName: "public.events", blocks: 3 },
];

describe("visibleTableCatalog (P0-1 / P0-4 / P0-7)", () => {
  it("lists tables with no children when none are expanded", () => {
    const { rows, emptyHint, orphan } = visibleTableCatalog(CATALOG, null, null, []);
    expect(orphan).toBeNull();
    expect(emptyHint).toBeNull();
    expect(rows.map((r) => r.key)).toEqual(["table:16384", "table:16385", "table:16386"]);
    expect(rows.every((r) => r.role === "table" && r.depth === 0 && !r.expanded)).toBe(true);
    expect(rows.find((r) => r.indexOid === 16384)?.expandable).toBe(true);
    expect(rows.find((r) => r.indexOid === 16385)?.expandable).toBe(false);
    expect(rows.find((r) => r.indexOid === 16384)?.blockCount).toBe(5);
  });

  it("expands the selected table's heap window and highlights the loaded blk (P0-7)", () => {
    const { rows } = visibleTableCatalog(CATALOG, 16384, 2, [16384]);
    expect(rows.find((r) => r.key === "table:16384")?.current).toBe(true);
    expect(rows.find((r) => r.key === "table:16384")?.expanded).toBe(true);
    const blks = rows.filter((r) => r.role === "page");
    expect(blks.map((r) => r.blkno)).toEqual([0, 1, 2, 3, 4]);
    expect(blks.every((r) => r.depth === 1 && r.indexOid === 16384)).toBe(true);
    expect(blks.find((r) => r.blkno === 2)?.current).toBe(true);
    expect(blks.find((r) => r.blkno === 2)?.key).toBe("heap:16384:2");
  });

  it("lists a 0-block table with no children (P0-4)", () => {
    const { rows, emptyHint } = visibleTableCatalog(CATALOG, 16385, null, [16385]);
    expect(rows.filter((r) => r.role === "page")).toEqual([]);
    expect(rows.find((r) => r.key === "table:16385")?.current).toBe(true);
    expect(emptyHint).toBeNull();
  });

  it("shows no-tables hint when the catalog is empty (P0-1)", () => {
    const { rows, emptyHint } = visibleTableCatalog([], null, null, []);
    expect(rows).toEqual([]);
    expect(emptyHint).toBe("no user heap tables");
  });

  it("windows a large selected table around the loaded block", () => {
    const huge = [{ oid: 1, qualifiedName: "public.huge", blocks: 3000 }];
    const { rows, emptyHint } = visibleTableCatalog(huge, 1, 1500, [1]);
    const blks = rows.filter((r) => r.role === "page");
    expect(blks).toHaveLength(HEAP_BLOCK_LIST_CAP);
    expect(blks.find((r) => r.blkno === 1500)?.current).toBe(true);
    expect(emptyHint).toMatch(/^Showing blk \d+–\d+ of 3000$/);
  });

  it("ensureTableExpanded replaces the expanded set with the selected oid", () => {
    let s = toggleTableExpanded(EMPTY_BTREE_TREE, 16386);
    s = ensureTableExpanded(s, 16384);
    expect(s.expandedTableOids).toEqual([16384]);
  });

  it("collapses when the label of the selected expanded table is clicked again", () => {
    expect(tableNameClickCollapses(16384, 16384, [16384])).toBe(true);
    expect(tableNameClickCollapses(16384, 16384, [])).toBe(false);
    expect(tableNameClickCollapses(16384, 16386, [16386])).toBe(false);
    expect(tableNameClickCollapses(null, 16384, [16384])).toBe(false);
  });
});

describe("expand / error / reset (P0-2 / P0-7 / P1-3)", () => {
  it("collapse flag is independent of cache (P0-2)", () => {
    let s = openedAtLeaf();
    s = setTreeCollapsed(s, true);
    expect(s.collapsed).toBe(true);
    expect(s.slices[OID]?.cache[11]?.status).toBe("ready");
    expect(pendingFetches(s)).toEqual([]);
    s = setTreeCollapsed(s, false);
    expect(s.collapsed).toBe(false);
  });

  it("retry drops the error so the block is fetched again", () => {
    let s = setTreeCollapsed(EMPTY_BTREE_TREE, false);
    s = toggleIndexExpanded(s, OID);
    s = putError(s, OID, 0, rangeError);
    expect(pendingFetches(s)).toEqual([]);
    s = retryNode(s, OID, 0);
    expect(pendingFetches(s)).toEqual([{ oid: OID, blkno: 0 }]);
  });

  it("reset clears cache and returns to collapsed (P0-7)", () => {
    expect(resetBtreeTree()).toEqual(EMPTY_BTREE_TREE);
  });

  it("toggleExpanded on an unfetched child queues that page only", () => {
    let s = openedAtLeaf();
    s = toggleExpanded(s, OID, 10);
    expect(pendingFetches(s)).toEqual([{ oid: OID, blkno: 10 }]);
    expect(pendingFetches(s).some((f) => f.blkno === 12)).toBe(false);
  });
});

describe("flag chips pass through (P1-1)", () => {
  it("ready internal rows expose garbage chip", () => {
    const dirty = parseBtreePage(
      buildBtreePage({
        pageType: "internal",
        btpoFlagsOverride: BTP_ROOT | BTP_HAS_GARBAGE,
        tuples: [{ tidBlock: 10, tidOffset: 1, pivot: true }],
      }),
    );
    let s = setTreeCollapsed(EMPTY_BTREE_TREE, false);
    s = putReady(s, OID, 0, meta);
    s = putReady(s, OID, 3, dirty);
    s = withPathExpansion(s, OID, 0);
    const row = visibleTree(s, OID, 0).rows.find((r) => r.blkno === 3);
    expect(row?.chips).toContain("garbage");
  });
});

describe("treeKindTokens (V-1)", () => {
  it("splits page type, level, and root into separate tokens", () => {
    expect(
      treeKindTokens({
        role: "page",
        expandable: false,
        pageType: "leaf",
        level: 0,
        isRoot: true,
        status: "ready",
      }),
    ).toEqual(["leaf", "L0", "root"]);
  });

  it("labels a metapage as meta only", () => {
    expect(
      treeKindTokens({
        role: "page",
        expandable: true,
        pageType: "meta",
        level: null,
        isRoot: false,
        status: "ready",
      }),
    ).toEqual(["meta"]);
  });

  it("hides kind on heap-ready and loading unknown rows", () => {
    expect(
      treeKindTokens({
        role: "page",
        expandable: false,
        pageType: "unknown",
        level: null,
        isRoot: false,
        status: "ready",
      }),
    ).toEqual([]);
    expect(
      treeKindTokens({
        role: "page",
        expandable: false,
        pageType: "unknown",
        level: null,
        isRoot: false,
        status: "loading",
      }),
    ).toEqual([]);
  });

  it("labels a table node with its block count (P0-1)", () => {
    expect(
      treeKindTokens({
        role: "table",
        expandable: true,
        pageType: "unknown",
        level: null,
        isRoot: false,
        status: "ready",
        blockCount: 12,
      }),
    ).toEqual(["12 blk"]);
  });

  it("labels a btree index with btree and block count", () => {
    expect(
      treeKindTokens({
        role: "index",
        expandable: true,
        pageType: "unknown",
        level: null,
        isRoot: false,
        status: "ready",
        blockCount: 4,
        accessMethod: "btree",
        valid: true,
      }),
    ).toEqual(["btree", "4 blk"]);
  });

  it("labels a non-btree index with its access method (P0-5)", () => {
    expect(
      treeKindTokens({
        role: "index",
        expandable: false,
        pageType: "unknown",
        level: null,
        isRoot: false,
        status: "ready",
        blockCount: 1,
        accessMethod: "hash",
        valid: true,
      }),
    ).toEqual(["hash"]);
  });
});

const INDEXES = [
  {
    oid: 24576,
    qualifiedName: "public.tb_pkey",
    accessMethod: "btree",
    blocks: 2,
    valid: true,
  },
  {
    oid: 24577,
    qualifiedName: "public.tb_hash",
    accessMethod: "hash",
    blocks: 1,
    valid: true,
  },
];

describe("visibleIndexCatalog (P0-2 / P0-4 / P0-5)", () => {
  it("lists the provided indexes and not others (P0-2)", () => {
    const { rows, emptyHint } = visibleIndexCatalog(INDEXES, EMPTY_BTREE_TREE, null, null);
    expect(emptyHint).toBeNull();
    expect(rows.map((r) => r.key)).toEqual(["index:24576", "index:24577"]);
    expect(rows.find((r) => r.indexOid === 24576)?.expandable).toBe(true);
    expect(rows.find((r) => r.indexOid === 24577)?.expandable).toBe(false);
  });

  it("nests btree pages under an expanded index (P0-4)", () => {
    let s = setTreeCollapsed(EMPTY_BTREE_TREE, false);
    s = toggleIndexExpanded(s, 24576);
    s = putReady(s, 24576, 0, meta);
    const { rows } = visibleIndexCatalog(INDEXES, s, 24576, 0);
    expect(rows.find((r) => r.key === "index:24576")?.current).toBe(true);
    expect(rows.find((r) => r.key === "index:24576")?.expanded).toBe(true);
    const pages = rows.filter((r) => r.role === "page");
    expect(pages[0]?.blkno).toBe(0);
    expect(pages[0]?.depth).toBe(1);
    expect(pages[0]?.current).toBe(true);
  });

  it("does not nest children under a hash index (P0-5)", () => {
    let s = toggleIndexExpanded(EMPTY_BTREE_TREE, 24577);
    const { rows } = visibleIndexCatalog(INDEXES, s, 24577, null);
    expect(rows.filter((r) => r.role === "page")).toEqual([]);
  });

  it("uses the no-indexes-for-table hint when the filtered list is empty (P0-2)", () => {
    const { rows, emptyHint } = visibleIndexCatalog([], EMPTY_BTREE_TREE, null, null, "No indexes for this table");
    expect(rows).toEqual([]);
    expect(emptyHint).toBe("No indexes for this table");
  });
});

describe("catalog section collapse (P0-6)", () => {
  it("toggles only the named section", () => {
    let s = toggleIndexSectionCollapsed(EMPTY_BTREE_TREE);
    expect(s.indexSectionCollapsed).toBe(true);
    expect(s.tableSectionCollapsed).toBe(false);
    s = toggleTableSectionCollapsed(s);
    expect(s.tableSectionCollapsed).toBe(true);
    expect(s.indexSectionCollapsed).toBe(true);
  });

  it("skips btree fetches while the index section is collapsed", () => {
    let s = setTreeCollapsed(EMPTY_BTREE_TREE, false);
    s = toggleIndexExpanded(s, OID);
    expect(pendingFetches(s)).toEqual([{ oid: OID, blkno: 0 }]);
    s = toggleIndexSectionCollapsed(s);
    expect(pendingFetches(s)).toEqual([]);
  });

  it("collapses when the label of the selected expanded index is clicked again", () => {
    expect(indexNameClickCollapses(24576, 24576, [24576])).toBe(true);
    expect(indexNameClickCollapses(24576, 24576, [])).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { BTP_HAS_GARBAGE, BTP_ROOT, buildBtreePage, parseBtreePage } from "page-core";
import {
  EMPTY_BTREE_TREE,
  autoExpandLoneBtree,
  fetchKey,
  markLoading,
  pendingFetches,
  putError,
  putReady,
  resetBtreeTree,
  retryNode,
  seedCurrentPage,
  setTreeCollapsed,
  toggleExpanded,
  toggleIndexExpanded,
  treeChromeVisible,
  treeRootsForTable,
  visibleTree,
  withPathExpansion,
} from "./btreeTree";
import type { IndexRowLike } from "./indexView";

const OID = 24576;
const OID2 = 24580;

const idx = (over: Partial<IndexRowLike> = {}): IndexRowLike => ({
  oid: OID,
  name: "t16_pkey",
  qualifiedName: "public.t16_pkey",
  accessMethod: "btree",
  blocks: 2,
  tableOid: 16384,
  tableQualifiedName: "public.t16",
  valid: true,
  ...over,
});

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
  it("is true for btree and heap page views (P0-3 / P0-9)", () => {
    expect(treeChromeVisible("btree")).toBe(true);
    expect(treeChromeVisible("heap")).toBe(true);
    expect(treeChromeVisible(undefined)).toBe(false);
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
    const { rows } = visibleTree(s, [idx()], OID, 11);
    expect(rows.filter((r) => r.role === "page").map((r) => r.blkno)).toEqual([0, 3, 10, 11, 12]);
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
    const { rows, orphan } = visibleTree(openedAtLeaf(), [idx()], OID, 11);
    expect(orphan).toBeNull();
    expect(rows.find((r) => r.role === "index")?.title).toBe("t16_pkey");
    expect(rows.find((r) => r.blkno === 0)?.expanded).toBe(true);
    expect(rows.find((r) => r.blkno === 3)?.expanded).toBe(true);
    expect(rows.find((r) => r.blkno === 11)?.current).toBe(true);
  });

  it("keeps the tree open conceptually after selecting another leaf (P0-6)", () => {
    const s = openedAtLeaf();
    expect(s.collapsed).toBe(false);
    const { rows } = visibleTree(s, [idx()], OID, 12);
    expect(rows.find((r) => r.blkno === 12)?.current).toBe(true);
  });

  it("shows an orphan warning row when the current page is unreachable", () => {
    let s = setTreeCollapsed(EMPTY_BTREE_TREE, false);
    s = putReady(s, OID, 0, meta);
    s = putReady(s, OID, 3, root);
    s = seedCurrentPage(s, OID, 99, leaf99);
    s = withPathExpansion(s, OID, 99);
    const { rows, orphan } = visibleTree(s, [idx()], OID, 99);
    expect(orphan?.blkno).toBe(99);
    expect(orphan?.current).toBe(true);
    expect(rows.some((r) => r.blkno === 99)).toBe(false);
  });
});

describe("table-mode forest (P0-9 / P0-10)", () => {
  it("lists each index as a root; heap current highlights nothing", () => {
    const other = idx({ oid: OID2, name: "t16_k_idx" });
    let s = setTreeCollapsed(EMPTY_BTREE_TREE, false);
    s = autoExpandLoneBtree(s, [idx(), other]);
    expect(s.expandedIndexOids).toEqual([]);
    const { rows } = visibleTree(s, [idx(), other], null, 5);
    expect(rows.map((r) => r.title)).toEqual(["t16_pkey", "t16_k_idx"]);
    expect(rows.every((r) => !r.current)).toBe(true);
  });

  it("auto-expands a lone btree and then fetches only that index", () => {
    let s = setTreeCollapsed(EMPTY_BTREE_TREE, false);
    s = autoExpandLoneBtree(s, [idx()]);
    expect(s.expandedIndexOids).toEqual([OID]);
    expect(pendingFetches(s)).toEqual([{ oid: OID, blkno: 0 }]);
  });

  it("does not expand a hash index", () => {
    const hash = idx({ accessMethod: "hash", name: "t16_hash" });
    const { rows } = visibleTree(setTreeCollapsed(EMPTY_BTREE_TREE, false), [hash], null, null);
    expect(rows[0]?.expandable).toBe(false);
    expect(visibleTree(setTreeCollapsed(EMPTY_BTREE_TREE, false), [hash], null, null).emptyHint).toBe(
      "No B-tree indexes for this table",
    );
  });

  it("keeps slices isolated so two indexes can share blkno 0", () => {
    let s = setTreeCollapsed(EMPTY_BTREE_TREE, false);
    s = putReady(s, OID, 0, meta);
    s = putReady(s, OID2, 0, meta);
    s = toggleIndexExpanded(s, OID);
    s = toggleIndexExpanded(s, OID2);
    expect(pendingFetches(s).map(fetchKey).sort()).toEqual(["24576:3", "24580:3"]);
  });

  it("treeRootsForTable filters to the current table", () => {
    const other = idx({ oid: OID2, tableOid: 16400, name: "other_pkey" });
    expect(treeRootsForTable([idx(), other], 16384).map((i) => i.oid)).toEqual([OID]);
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
    const row = visibleTree(s, [idx()], OID, 0).rows.find((r) => r.blkno === 3);
    expect(row?.chips).toContain("garbage");
  });
});

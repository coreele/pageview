import { describe, expect, it } from "vitest";
import { BTP_HAS_GARBAGE, BTP_ROOT, buildBtreePage, parseBtreePage } from "page-core";
import {
  EMPTY_BTREE_TREE,
  markLoading,
  pendingFetches,
  putError,
  putReady,
  resetBtreeTree,
  retryNode,
  seedCurrentPage,
  setTreeCollapsed,
  toggleExpanded,
  treeChromeVisible,
  visibleTree,
  withPathExpansion,
} from "./btreeTree";

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

function openedAtLeaf(): ReturnType<typeof withPathExpansion> {
  let s = setTreeCollapsed(EMPTY_BTREE_TREE, false);
  s = seedCurrentPage(s, 11, leaf11);
  s = putReady(s, 0, meta);
  s = putReady(s, 3, root);
  return withPathExpansion(s, 11);
}

describe("treeChromeVisible (P0-3)", () => {
  it("is true only for btree page views", () => {
    expect(treeChromeVisible("btree")).toBe(true);
    expect(treeChromeVisible("heap")).toBe(false);
    expect(treeChromeVisible(undefined)).toBe(false);
  });
});

describe("pendingFetches (P0-1 / P0-5)", () => {
  it("requests nothing while collapsed", () => {
    let s = seedCurrentPage(EMPTY_BTREE_TREE, 11, leaf11);
    expect(pendingFetches(s)).toEqual([]);
  });

  it("on open fetches meta then root, not every leaf", () => {
    let s = setTreeCollapsed(EMPTY_BTREE_TREE, false);
    s = seedCurrentPage(s, 11, leaf11);
    expect(pendingFetches(s)).toEqual([0]);
    s = putReady(s, 0, meta);
    expect(pendingFetches(s).sort((a, b) => a - b)).toEqual([3]);
    s = putReady(s, 3, root);
    s = withPathExpansion(s, 11);
    expect(pendingFetches(s)).toEqual([]);
    const { rows } = visibleTree(s, 11);
    expect(rows.map((r) => r.blkno)).toEqual([0, 3, 10, 11, 12]);
    expect(rows.find((r) => r.blkno === 11)?.current).toBe(true);
  });

  it("does not refetch ready or in-flight blocks", () => {
    let s = setTreeCollapsed(EMPTY_BTREE_TREE, false);
    s = markLoading(s, [0]);
    expect(pendingFetches(s)).toEqual([]);
  });
});

describe("visibleTree (P0-4 / P0-6 / P1-2)", () => {
  it("auto-expands the path to the current leaf", () => {
    const { rows, orphan } = visibleTree(openedAtLeaf(), 11);
    expect(orphan).toBeNull();
    expect(rows.find((r) => r.blkno === 0)?.expanded).toBe(true);
    expect(rows.find((r) => r.blkno === 3)?.expanded).toBe(true);
    expect(rows.find((r) => r.blkno === 11)?.current).toBe(true);
    expect(rows.find((r) => r.blkno === 10)?.current).toBe(false);
  });

  it("keeps the tree open conceptually after selecting another leaf (P0-6)", () => {
    const s = openedAtLeaf();
    expect(s.collapsed).toBe(false);
    const { rows } = visibleTree(s, 12);
    expect(rows.find((r) => r.blkno === 12)?.current).toBe(true);
  });

  it("shows an orphan warning row when the current page is unreachable", () => {
    let s = setTreeCollapsed(EMPTY_BTREE_TREE, false);
    s = putReady(s, 0, meta);
    s = putReady(s, 3, root);
    s = seedCurrentPage(s, 99, leaf99);
    s = withPathExpansion(s, 99);
    const { rows, orphan } = visibleTree(s, 99);
    expect(orphan?.blkno).toBe(99);
    expect(orphan?.current).toBe(true);
    expect(rows.some((r) => r.blkno === 99)).toBe(false);
  });
});

describe("expand / error / reset (P0-2 / P0-7 / P1-3)", () => {
  it("collapse flag is independent of cache (P0-2)", () => {
    let s = openedAtLeaf();
    s = setTreeCollapsed(s, true);
    expect(s.collapsed).toBe(true);
    expect(s.cache[11]?.status).toBe("ready");
    expect(pendingFetches(s)).toEqual([]);
    s = setTreeCollapsed(s, false);
    expect(s.collapsed).toBe(false);
  });

  it("retry drops the error so the block is fetched again", () => {
    let s = setTreeCollapsed(EMPTY_BTREE_TREE, false);
    s = putError(s, 0, rangeError);
    expect(pendingFetches(s)).toEqual([]);
    s = retryNode(s, 0);
    expect(pendingFetches(s)).toEqual([0]);
  });

  it("reset clears cache and returns to collapsed (P0-7)", () => {
    expect(resetBtreeTree()).toEqual(EMPTY_BTREE_TREE);
    expect(treeChromeVisible("btree")).toBe(true);
  });

  it("toggleExpanded on an unfetched child queues that page only", () => {
    let s = openedAtLeaf();
    s = toggleExpanded(s, 10);
    expect(pendingFetches(s)).toEqual([10]);
    expect(pendingFetches(s)).not.toContain(12);
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
    s = putReady(s, 0, meta);
    s = putReady(s, 3, dirty);
    s = withPathExpansion(s, 0);
    const row = visibleTree(s, 0).rows.find((r) => r.blkno === 3);
    expect(row?.chips).toContain("garbage");
  });
});

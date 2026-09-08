/**
 * Session state for the optional B-tree tree panel (btree-tree-view).
 * One slice per index oid so table-mode can show a forest without blkno clashes.
 * Fetch I/O stays in App.
 */
import {
  btreeDownlinks,
  btreeTreeNodeSummary,
  pathFromCache,
  type BtreeTreeChip,
  type ParsedBtreePage,
} from "page-core";
import type { AppError } from "./api";
import { filterIndexesByTable, isBtreeIndex, type IndexRowLike } from "./indexView";

export type CachedTreePage =
  | { status: "loading" }
  | { status: "ready"; page: ParsedBtreePage }
  | { status: "error"; error: AppError };

export type IndexTreeSlice = {
  cache: Record<number, CachedTreePage>;
  expanded: number[];
};

export type BtreeTreeState = {
  collapsed: boolean;
  slices: Record<number, IndexTreeSlice>;
  expandedIndexOids: number[];
};

export type TreeRow = {
  key: string;
  indexOid: number;
  blkno: number | null;
  role: "index" | "page";
  title: string;
  depth: number;
  pageType: "meta" | "internal" | "leaf" | "unknown";
  level: number | null;
  isRoot: boolean;
  chips: BtreeTreeChip[];
  expandable: boolean;
  expanded: boolean;
  current: boolean;
  status: "idle" | "loading" | "ready" | "error";
  error?: AppError;
};

export type TreeFetch = { oid: number; blkno: number };

export type VisibleTree = {
  rows: TreeRow[];
  orphan: TreeRow | null;
  emptyHint: string | null;
};

const EMPTY_SLICE: IndexTreeSlice = { cache: {}, expanded: [] };

export const EMPTY_BTREE_TREE: BtreeTreeState = {
  collapsed: true,
  slices: {},
  expandedIndexOids: [],
};

export const EMPTY_VISIBLE_TREE: VisibleTree = { rows: [], orphan: null, emptyHint: null };

export function resetBtreeTree(): BtreeTreeState {
  return { collapsed: true, slices: {}, expandedIndexOids: [] };
}

export function treeChromeVisible(pageKind: string | undefined): boolean {
  return pageKind === "btree" || pageKind === "heap";
}

export function setTreeCollapsed(state: BtreeTreeState, collapsed: boolean): BtreeTreeState {
  return { ...state, collapsed };
}

function sliceOf(state: BtreeTreeState, oid: number): IndexTreeSlice {
  return state.slices[oid] ?? EMPTY_SLICE;
}

function putSlice(state: BtreeTreeState, oid: number, slice: IndexTreeSlice): BtreeTreeState {
  return { ...state, slices: { ...state.slices, [oid]: slice } };
}

export function ensureIndexExpanded(state: BtreeTreeState, oid: number): BtreeTreeState {
  if (state.expandedIndexOids.includes(oid)) return state;
  return { ...state, expandedIndexOids: [...state.expandedIndexOids, oid] };
}

export function toggleIndexExpanded(state: BtreeTreeState, oid: number): BtreeTreeState {
  const has = state.expandedIndexOids.includes(oid);
  return {
    ...state,
    expandedIndexOids: has
      ? state.expandedIndexOids.filter((id) => id !== oid)
      : [...state.expandedIndexOids, oid],
  };
}

export function seedCurrentPage(
  state: BtreeTreeState,
  oid: number,
  blkno: number,
  page: ParsedBtreePage,
): BtreeTreeState {
  const slice = sliceOf(state, oid);
  return ensureIndexExpanded(
    putSlice(state, oid, {
      ...slice,
      cache: { ...slice.cache, [blkno]: { status: "ready", page } },
    }),
    oid,
  );
}

export function markLoading(state: BtreeTreeState, fetches: TreeFetch[]): BtreeTreeState {
  if (fetches.length === 0) return state;
  let next = state;
  for (const { oid, blkno } of fetches) {
    const slice = sliceOf(next, oid);
    const rec = slice.cache[blkno];
    if (rec?.status === "ready") continue;
    next = putSlice(next, oid, {
      ...slice,
      cache: { ...slice.cache, [blkno]: { status: "loading" } },
    });
  }
  return next;
}

export function putReady(
  state: BtreeTreeState,
  oid: number,
  blkno: number,
  page: ParsedBtreePage,
): BtreeTreeState {
  const slice = sliceOf(state, oid);
  return putSlice(state, oid, {
    ...slice,
    cache: { ...slice.cache, [blkno]: { status: "ready", page } },
  });
}

export function putError(
  state: BtreeTreeState,
  oid: number,
  blkno: number,
  error: AppError,
): BtreeTreeState {
  const slice = sliceOf(state, oid);
  return putSlice(state, oid, {
    ...slice,
    cache: { ...slice.cache, [blkno]: { status: "error", error } },
  });
}

export function retryNode(state: BtreeTreeState, oid: number, blkno: number): BtreeTreeState {
  const slice = sliceOf(state, oid);
  const cache = { ...slice.cache };
  delete cache[blkno];
  return putSlice(state, oid, { ...slice, cache });
}

export function toggleExpanded(state: BtreeTreeState, oid: number, blkno: number): BtreeTreeState {
  const slice = sliceOf(state, oid);
  const has = slice.expanded.includes(blkno);
  return putSlice(state, oid, {
    ...slice,
    expanded: has ? slice.expanded.filter((b) => b !== blkno) : [...slice.expanded, blkno],
  });
}

function readyMap(cache: Record<number, CachedTreePage>): Map<number, ParsedBtreePage> {
  const pages = new Map<number, ParsedBtreePage>();
  for (const [key, rec] of Object.entries(cache)) {
    if (rec.status === "ready") pages.set(Number(key), rec.page);
  }
  return pages;
}

function readyPage(slice: IndexTreeSlice, blkno: number): ParsedBtreePage | null {
  const rec = slice.cache[blkno];
  return rec?.status === "ready" ? rec.page : null;
}

export function pendingFetches(state: BtreeTreeState): TreeFetch[] {
  if (state.collapsed) return [];
  const need: TreeFetch[] = [];
  for (const oid of state.expandedIndexOids) {
    const slice = sliceOf(state, oid);
    const want = new Set<number>([0, ...slice.expanded]);
    const meta = readyPage(slice, 0);
    if (meta?.meta) want.add(meta.meta.btm_root);
    for (const blkno of want) {
      if (!slice.cache[blkno]) need.push({ oid, blkno });
    }
  }
  return need;
}

export function fetchKey(fetch: TreeFetch): string {
  return `${fetch.oid}:${fetch.blkno}`;
}

export function withPathExpansion(
  state: BtreeTreeState,
  oid: number,
  currentBlkno: number,
): BtreeTreeState {
  const slice = sliceOf(state, oid);
  const { path } = pathFromCache(readyMap(slice.cache), currentBlkno);
  const expanded = new Set(slice.expanded);
  for (const blk of path) {
    const page = readyPage(slice, blk);
    if (!page || page.pageType === "leaf") continue;
    expanded.add(blk);
  }
  return ensureIndexExpanded(putSlice(state, oid, { ...slice, expanded: [...expanded] }), oid);
}

export function autoExpandLoneBtree(state: BtreeTreeState, roots: IndexRowLike[]): BtreeTreeState {
  const btrees = roots.filter(isBtreeIndex);
  if (btrees.length !== 1) return state;
  return ensureIndexExpanded(state, btrees[0]!.oid);
}

function childrenOf(slice: IndexTreeSlice, blkno: number): number[] {
  const page = readyPage(slice, blkno);
  return page ? btreeDownlinks(page) : [];
}

function pageRow(
  slice: IndexTreeSlice,
  oid: number,
  blkno: number,
  depth: number,
  currentOid: number | null,
  currentBlkno: number | null,
): TreeRow {
  const rec = slice.cache[blkno];
  const expanded = slice.expanded.includes(blkno);
  const current = currentOid === oid && currentBlkno === blkno;
  const base = {
    key: `${oid}:${blkno}`,
    indexOid: oid,
    blkno,
    role: "page" as const,
    title: "",
    depth,
    current,
    expanded,
  };
  if (!rec) {
    return {
      ...base,
      pageType: "unknown",
      level: null,
      isRoot: false,
      chips: [],
      expandable: true,
      status: "idle",
    };
  }
  if (rec.status === "loading") {
    return {
      ...base,
      pageType: "unknown",
      level: null,
      isRoot: false,
      chips: [],
      expandable: false,
      status: "loading",
    };
  }
  if (rec.status === "error") {
    return {
      ...base,
      pageType: "unknown",
      level: null,
      isRoot: false,
      chips: [],
      expandable: false,
      status: "error",
      error: rec.error,
    };
  }
  const summary = btreeTreeNodeSummary(rec.page);
  return {
    ...base,
    pageType: summary.pageType,
    level: summary.level,
    isRoot: summary.isRoot,
    chips: summary.chips,
    expandable: rec.page.pageType !== "leaf",
    status: "ready",
  };
}

export function visibleTree(
  state: BtreeTreeState,
  roots: IndexRowLike[],
  currentOid: number | null,
  currentBlkno: number | null,
): VisibleTree {
  const listed = new Set<string>();
  const rows: TreeRow[] = [];

  const walkPages = (oid: number, blkno: number, depth: number): void => {
    const slice = sliceOf(state, oid);
    const row = pageRow(slice, oid, blkno, depth, currentOid, currentBlkno);
    rows.push(row);
    listed.add(row.key);
    if (!slice.expanded.includes(blkno)) return;
    for (const child of childrenOf(slice, blkno)) {
      walkPages(oid, child, depth + 1);
    }
  };

  for (const idx of roots) {
    const btree = isBtreeIndex(idx);
    const expanded = state.expandedIndexOids.includes(idx.oid);
    rows.push({
      key: `${idx.oid}:index`,
      indexOid: idx.oid,
      blkno: null,
      role: "index",
      title: idx.name ?? idx.qualifiedName,
      depth: 0,
      pageType: "unknown",
      level: null,
      isRoot: false,
      chips: [],
      expandable: btree,
      expanded,
      current: currentOid === idx.oid && currentBlkno == null,
      status: btree ? "ready" : "idle",
    });
    if (btree && expanded) {
      const slice = sliceOf(state, idx.oid);
      if (slice.cache[0] || readyMap(slice.cache).has(0)) {
        walkPages(idx.oid, 0, 1);
      }
    }
  }

  let orphan: TreeRow | null = null;
  if (currentOid != null && currentBlkno != null) {
    const slice = sliceOf(state, currentOid);
    const { orphan: isOrphan } = pathFromCache(readyMap(slice.cache), currentBlkno);
    const key = `${currentOid}:${currentBlkno}`;
    if (isOrphan && !listed.has(key)) {
      orphan = pageRow(slice, currentOid, currentBlkno, 0, currentOid, currentBlkno);
    }
  }

  let emptyHint: string | null = null;
  if (roots.length === 0) {
    emptyHint = "No indexes for this table";
  } else if (!roots.some(isBtreeIndex)) {
    emptyHint = "No B-tree indexes for this table";
  }

  return { rows, orphan, emptyHint };
}

export function treeRootsForTable(
  indexes: IndexRowLike[],
  tableOid: number | null,
): IndexRowLike[] {
  return filterIndexesByTable(indexes, tableOid);
}

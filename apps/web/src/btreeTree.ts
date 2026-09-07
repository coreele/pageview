/**
 * Session state for the optional B-tree tree panel (btree-tree-view).
 * Fetch I/O stays in App; this module decides what to fetch and what to render.
 */
import {
  btreeDownlinks,
  btreeTreeNodeSummary,
  pathFromCache,
  type BtreeTreeChip,
  type ParsedBtreePage,
} from "page-core";
import type { AppError } from "./api";

export type CachedTreePage =
  | { status: "loading" }
  | { status: "ready"; page: ParsedBtreePage }
  | { status: "error"; error: AppError };

export type BtreeTreeState = {
  collapsed: boolean;
  cache: Record<number, CachedTreePage>;
  expanded: number[];
};

export type TreeRow = {
  blkno: number;
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

export const EMPTY_BTREE_TREE: BtreeTreeState = {
  collapsed: true,
  cache: {},
  expanded: [],
};

export function resetBtreeTree(): BtreeTreeState {
  return { collapsed: true, cache: {}, expanded: [] };
}

export function treeChromeVisible(pageKind: string | undefined): boolean {
  return pageKind === "btree";
}

export function setTreeCollapsed(state: BtreeTreeState, collapsed: boolean): BtreeTreeState {
  return { ...state, collapsed };
}

export function seedCurrentPage(
  state: BtreeTreeState,
  blkno: number,
  page: ParsedBtreePage,
): BtreeTreeState {
  return {
    ...state,
    cache: { ...state.cache, [blkno]: { status: "ready", page } },
  };
}

export function markLoading(state: BtreeTreeState, blknos: number[]): BtreeTreeState {
  if (blknos.length === 0) return state;
  const cache = { ...state.cache };
  for (const blk of blknos) {
    const rec = cache[blk];
    if (rec?.status === "ready") continue;
    cache[blk] = { status: "loading" };
  }
  return { ...state, cache };
}

export function putReady(state: BtreeTreeState, blkno: number, page: ParsedBtreePage): BtreeTreeState {
  return { ...state, cache: { ...state.cache, [blkno]: { status: "ready", page } } };
}

export function putError(state: BtreeTreeState, blkno: number, error: AppError): BtreeTreeState {
  return { ...state, cache: { ...state.cache, [blkno]: { status: "error", error } } };
}

export function retryNode(state: BtreeTreeState, blkno: number): BtreeTreeState {
  const cache = { ...state.cache };
  delete cache[blkno];
  return { ...state, cache };
}

export function toggleExpanded(state: BtreeTreeState, blkno: number): BtreeTreeState {
  const has = state.expanded.includes(blkno);
  return {
    ...state,
    expanded: has ? state.expanded.filter((b) => b !== blkno) : [...state.expanded, blkno],
  };
}

function readyMap(cache: Record<number, CachedTreePage>): Map<number, ParsedBtreePage> {
  const pages = new Map<number, ParsedBtreePage>();
  for (const [key, rec] of Object.entries(cache)) {
    if (rec.status === "ready") pages.set(Number(key), rec.page);
  }
  return pages;
}

function readyPage(state: BtreeTreeState, blkno: number): ParsedBtreePage | null {
  const rec = state.cache[blkno];
  return rec?.status === "ready" ? rec.page : null;
}

/** Blocks that must be fetched while the panel is open (not error, not in-flight). */
export function pendingFetches(state: BtreeTreeState): number[] {
  if (state.collapsed) return [];
  const want = new Set<number>([0, ...state.expanded]);
  const meta = readyPage(state, 0);
  if (meta?.meta) want.add(meta.meta.btm_root);
  const need: number[] = [];
  for (const blk of want) {
    const rec = state.cache[blk];
    if (!rec) need.push(blk);
  }
  return need;
}

export function withPathExpansion(state: BtreeTreeState, currentBlkno: number): BtreeTreeState {
  const { path } = pathFromCache(readyMap(state.cache), currentBlkno);
  const expanded = new Set(state.expanded);
  for (const blk of path) {
    const page = readyPage(state, blk);
    if (!page || page.pageType === "leaf") continue;
    expanded.add(blk);
  }
  return { ...state, expanded: [...expanded] };
}

function childrenOf(state: BtreeTreeState, blkno: number): number[] {
  const page = readyPage(state, blkno);
  return page ? btreeDownlinks(page) : [];
}

function rowFor(
  state: BtreeTreeState,
  blkno: number,
  depth: number,
  currentBlkno: number,
): TreeRow {
  const rec = state.cache[blkno];
  const expanded = state.expanded.includes(blkno);
  if (!rec) {
    return {
      blkno,
      depth,
      pageType: "unknown",
      level: null,
      isRoot: false,
      chips: [],
      expandable: true,
      expanded,
      current: blkno === currentBlkno,
      status: "idle",
    };
  }
  if (rec.status === "loading") {
    return {
      blkno,
      depth,
      pageType: "unknown",
      level: null,
      isRoot: false,
      chips: [],
      expandable: false,
      expanded,
      current: blkno === currentBlkno,
      status: "loading",
    };
  }
  if (rec.status === "error") {
    return {
      blkno,
      depth,
      pageType: "unknown",
      level: null,
      isRoot: false,
      chips: [],
      expandable: false,
      expanded,
      current: blkno === currentBlkno,
      status: "error",
      error: rec.error,
    };
  }
  const summary = btreeTreeNodeSummary(rec.page);
  const expandable = rec.page.pageType !== "leaf";
  return {
    blkno,
    depth,
    pageType: summary.pageType,
    level: summary.level,
    isRoot: summary.isRoot,
    chips: summary.chips,
    expandable,
    expanded,
    current: blkno === currentBlkno,
    status: "ready",
  };
}

export type VisibleTree = {
  rows: TreeRow[];
  orphan: TreeRow | null;
};

export function visibleTree(state: BtreeTreeState, currentBlkno: number): VisibleTree {
  const pages = readyMap(state.cache);
  const { orphan } = pathFromCache(pages, currentBlkno);
  const rows: TreeRow[] = [];
  const listed = new Set<number>();

  const walk = (blkno: number, depth: number): void => {
    rows.push(rowFor(state, blkno, depth, currentBlkno));
    listed.add(blkno);
    if (!state.expanded.includes(blkno)) return;
    for (const child of childrenOf(state, blkno)) {
      walk(child, depth + 1);
    }
  };

  if (state.cache[0] || pages.has(0)) walk(0, 0);

  let orphanRow: TreeRow | null = null;
  if (orphan && !listed.has(currentBlkno)) {
    orphanRow = rowFor(state, currentBlkno, 0, currentBlkno);
  }

  return { rows, orphan: orphanRow };
}

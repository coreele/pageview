/**
 * Pure B-tree topology helpers for the optional tree panel (btree-tree-view).
 * Does not parse pages; callers pass already-parsed ParsedBtreePage values.
 */
import type { BtreePageType, ParsedBtreePage } from "./btree.js";

export type BtreeTreeChip = "deleted" | "half-dead" | "garbage" | "incomplete-split";

export type BtreeTreeNodeSummary = {
  pageType: BtreePageType;
  /** meta: null; otherwise btpo_level */
  level: number | null;
  isRoot: boolean;
  chips: BtreeTreeChip[];
};

export type PathFromCacheResult = {
  /** Walk from blk 0 if reachable; otherwise [0] when meta is cached, else []. */
  path: number[];
  /** True when target is not on a parent-chain that reaches metapage 0. */
  orphan: boolean;
};

/** Child block numbers in on-page order. Hikey tuples are not downlinks. */
export function btreeDownlinks(page: ParsedBtreePage): number[] {
  if (page.pageType === "meta" && page.meta) {
    const root = page.meta.btm_root;
    const fast = page.meta.btm_fastroot;
    if (fast !== root) return [root, fast];
    return [root];
  }
  if (page.pageType === "internal") {
    return page.tuples.filter((t) => !t.isHikey).map((t) => t.t_tid.blockNumber);
  }
  return [];
}

export function btreeTreeNodeSummary(page: ParsedBtreePage): BtreeTreeNodeSummary {
  const chips: BtreeTreeChip[] = [];
  if (page.flags.deleted) chips.push("deleted");
  if (page.flags.halfDead) chips.push("half-dead");
  if (page.flags.hasGarbage) chips.push("garbage");
  if (page.flags.incompleteSplit) chips.push("incomplete-split");
  return {
    pageType: page.pageType,
    level: page.pageType === "meta" ? null : (page.special?.btpo_level ?? 0),
    isRoot: page.flags.isRoot,
    chips,
  };
}

/**
 * Reconstruct a path to `target` using only cached pages' downlinks.
 * Parent map prefers the first parent encountered; callers should visit
 * metapage then `btm_root` before other blocks so the root spine wins.
 */
export function pathFromCache(
  pages: ReadonlyMap<number, ParsedBtreePage>,
  target: number,
): PathFromCacheResult {
  const parent = new Map<number, number>();
  const visitOrder = [...pages.keys()].sort((a, b) => {
    if (a === 0) return -1;
    if (b === 0) return 1;
    const meta = pages.get(0)?.meta;
    if (meta) {
      if (a === meta.btm_root) return -1;
      if (b === meta.btm_root) return 1;
    }
    return a - b;
  });
  for (const blk of visitOrder) {
    const page = pages.get(blk);
    if (!page) continue;
    for (const child of btreeDownlinks(page)) {
      if (!parent.has(child)) parent.set(child, blk);
    }
  }

  if (target === 0) {
    return pages.has(0) ? { path: [0], orphan: false } : { path: [], orphan: true };
  }

  const rev: number[] = [];
  const seen = new Set<number>();
  let cur: number | undefined = target;
  while (cur !== undefined && !seen.has(cur)) {
    seen.add(cur);
    rev.push(cur);
    if (cur === 0) {
      return { path: rev.slice().reverse(), orphan: false };
    }
    cur = parent.get(cur);
  }

  return { path: pages.has(0) ? [0] : [], orphan: true };
}

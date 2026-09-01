/**
 * Same-index block navigation helpers (index-viewer T8, P1-1). The P1-3 heap
 * TID jump moved into the read-only HeapPeekOverlay (change-4 annex 4) — it
 * no longer switches the relation kind in place, so no table-list guard
 * remains here.
 */
import { P_NONE } from "page-core";

export type SiblingNav = {
  /** Left sibling block, or null when btpo_prev == P_NONE. */
  prev: number | null;
  /** Right sibling block, or null when btpo_next == P_NONE. */
  next: number | null;
  /** "leftmost" annotation when prev is P_NONE. */
  prevNote: string | null;
  /** "rightmost" annotation when next is P_NONE. */
  nextNote: string | null;
};

export function siblingNav(special: { btpo_prev: number; btpo_next: number }): SiblingNav {
  return {
    prev: special.btpo_prev !== P_NONE ? special.btpo_prev : null,
    next: special.btpo_next !== P_NONE ? special.btpo_next : null,
    prevNote: special.btpo_prev === P_NONE ? "leftmost" : null,
    nextNote: special.btpo_next === P_NONE ? "rightmost" : null,
  };
}

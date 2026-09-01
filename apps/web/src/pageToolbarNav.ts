import { siblingNav } from "./blockNav";

export type PageNavTargets = {
  prev: number | null;
  next: number | null;
};

export function heapPageNav(loadedBlkno: number, blocks: number): PageNavTargets {
  if (blocks <= 0) {
    return { prev: null, next: null };
  }
  return {
    prev: loadedBlkno > 0 ? loadedBlkno - 1 : null,
    next: loadedBlkno < blocks - 1 ? loadedBlkno + 1 : null,
  };
}

export function btreePageNav(
  special: { btpo_prev: number; btpo_next: number } | null | undefined,
): PageNavTargets {
  if (!special) {
    return { prev: null, next: null };
  }
  const nav = siblingNav(special);
  return { prev: nav.prev, next: nav.next };
}

export function toolbarNavEnabled(
  hasPage: boolean,
  loading: boolean,
  oid: number | null,
): boolean {
  return hasPage && !loading && oid != null;
}

export function navButtonTitle(
  kind: "heap" | "btree",
  dir: "prev" | "next",
  target: number | null,
): string {
  if (target != null) {
    return `blk ${target}`;
  }
  if (kind === "heap") {
    return dir === "prev" ? "first block" : "last block";
  }
  return dir === "prev" ? "leftmost" : "rightmost";
}

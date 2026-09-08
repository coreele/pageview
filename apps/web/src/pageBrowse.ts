export type PageBrowseMode = "tree" | "single";

export function pageBrowseMode(treeCollapsed: boolean): PageBrowseMode {
  return treeCollapsed ? "single" : "tree";
}

/** Tree catalog page-row click: load, refresh current page, or ignore while loading. */
export function pageRowClickAction(opts: {
  loading: boolean;
  isCurrentDisplayed: boolean;
}): "ignore" | "load" | "refresh" {
  if (opts.loading) return "ignore";
  if (opts.isCurrentDisplayed) return "refresh";
  return "load";
}

export function isCurrentDisplayedPage(opts: {
  rowOid: number;
  rowBlkno: number;
  heapRow: boolean;
  relationKind: "table" | "index";
  selectedOid: number | null;
  selectedIndexOid: number | null;
  loadedBlkno: number | null;
  pageKind: "heap" | "btree" | undefined;
}): boolean {
  if (opts.loadedBlkno !== opts.rowBlkno) return false;
  if (opts.heapRow) {
    return (
      opts.relationKind === "table" &&
      opts.pageKind === "heap" &&
      opts.selectedOid === opts.rowOid
    );
  }
  return (
    opts.relationKind === "index" &&
    opts.pageKind === "btree" &&
    opts.selectedIndexOid === opts.rowOid
  );
}

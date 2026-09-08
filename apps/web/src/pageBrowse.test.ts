import { describe, expect, it } from "vitest";
import { isCurrentDisplayedPage, pageBrowseMode, pageRowClickAction } from "./pageBrowse";

describe("pageBrowseMode", () => {
  it("maps collapsed tree to single (P0-1 / P0-2)", () => {
    expect(pageBrowseMode(false)).toBe("tree");
    expect(pageBrowseMode(true)).toBe("single");
  });
});

describe("pageRowClickAction (P0-3 / P0-4)", () => {
  it("ignores clicks while a page load is in flight", () => {
    expect(pageRowClickAction({ loading: true, isCurrentDisplayed: false })).toBe("ignore");
    expect(pageRowClickAction({ loading: true, isCurrentDisplayed: true })).toBe("ignore");
  });

  it("refreshes the currently displayed block", () => {
    expect(pageRowClickAction({ loading: false, isCurrentDisplayed: true })).toBe("refresh");
  });

  it("loads a different or unloaded block", () => {
    expect(pageRowClickAction({ loading: false, isCurrentDisplayed: false })).toBe("load");
  });
});

describe("isCurrentDisplayedPage", () => {
  const heap = {
    rowOid: 10,
    rowBlkno: 0,
    heapRow: true,
    relationKind: "table" as const,
    selectedOid: 10,
    selectedIndexOid: null,
    loadedBlkno: 0,
    pageKind: "heap" as const,
  };

  it("matches the open heap page", () => {
    expect(isCurrentDisplayedPage(heap)).toBe(true);
    expect(isCurrentDisplayedPage({ ...heap, rowBlkno: 1 })).toBe(false);
    expect(isCurrentDisplayedPage({ ...heap, pageKind: "btree" })).toBe(false);
  });

  it("matches the open btree page (P0-5)", () => {
    expect(
      isCurrentDisplayedPage({
        rowOid: 20,
        rowBlkno: 3,
        heapRow: false,
        relationKind: "index",
        selectedOid: 10,
        selectedIndexOid: 20,
        loadedBlkno: 3,
        pageKind: "btree",
      }),
    ).toBe(true);
  });
});

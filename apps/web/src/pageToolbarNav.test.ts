import { describe, expect, it } from "vitest";
import { buildBtreePage, parseBtreePage } from "page-core";
import { siblingNav } from "./blockNav";
import {
  btreePageNav,
  heapPageNav,
  navButtonTitle,
  toolbarNavEnabled,
} from "./pageToolbarNav";

describe("heapPageNav", () => {
  it("middle page: prev and next are blkno ± 1", () => {
    expect(heapPageNav(4, 10)).toEqual({ prev: 3, next: 5 });
  });

  it("first block disables prev", () => {
    expect(heapPageNav(0, 10)).toEqual({ prev: null, next: 1 });
  });

  it("last block disables next", () => {
    expect(heapPageNav(9, 10)).toEqual({ prev: 8, next: null });
  });

  it("single-block relation disables both", () => {
    expect(heapPageNav(0, 1)).toEqual({ prev: null, next: null });
  });

  it("zero blocks disables both", () => {
    expect(heapPageNav(0, 0)).toEqual({ prev: null, next: null });
  });
});

describe("btreePageNav", () => {
  it("uses siblingNav targets, not blkno ± 1", () => {
    const page = parseBtreePage(buildBtreePage({ pageType: "leaf", btpoPrev: 1, btpoNext: 9 }));
    expect(btreePageNav(page.special)).toEqual({ prev: 1, next: 9 });
    expect(siblingNav(page.special!).next).toBe(9);
  });

  it("P_NONE siblings are null (rightmost/leftmost)", () => {
    const page = parseBtreePage(buildBtreePage({ pageType: "leaf" }));
    expect(btreePageNav(page.special)).toEqual({ prev: null, next: null });
  });

  it("missing special disables both", () => {
    expect(btreePageNav(null)).toEqual({ prev: null, next: null });
    expect(btreePageNav(undefined)).toEqual({ prev: null, next: null });
  });
});

describe("toolbarNavEnabled", () => {
  it("matches Refresh: needs loaded page, not loading, oid present", () => {
    expect(toolbarNavEnabled(true, false, 12345)).toBe(true);
    expect(toolbarNavEnabled(false, false, 12345)).toBe(false);
    expect(toolbarNavEnabled(true, true, 12345)).toBe(false);
    expect(toolbarNavEnabled(true, false, null)).toBe(false);
  });
});

describe("navButtonTitle", () => {
  it("shows target blk when set", () => {
    expect(navButtonTitle("heap", "next", 3)).toBe("blk 3");
    expect(navButtonTitle("btree", "prev", 7)).toBe("blk 7");
  });

  it("heap disabled copy is first/last block", () => {
    expect(navButtonTitle("heap", "prev", null)).toBe("first block");
    expect(navButtonTitle("heap", "next", null)).toBe("last block");
  });

  it("btree disabled copy is leftmost/rightmost", () => {
    expect(navButtonTitle("btree", "prev", null)).toBe("leftmost");
    expect(navButtonTitle("btree", "next", null)).toBe("rightmost");
  });
});

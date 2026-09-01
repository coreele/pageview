import { describe, expect, it } from "vitest";
import { buildBtreePage, parseBtreePage } from "page-core";
import { siblingNav } from "./blockNav";

describe("siblingNav (P1-1: btpo_prev/next, P_NONE disabled + labeled)", () => {
  it("returns clickable sibling blocks when both are set", () => {
    const page = parseBtreePage(buildBtreePage({ pageType: "leaf", btpoPrev: 1, btpoNext: 3 }));
    expect(siblingNav(page.special!)).toEqual({
      prev: 1,
      next: 3,
      prevNote: null,
      nextNote: null,
    });
  });

  it("P_NONE (0) siblings are null and labeled leftmost/rightmost", () => {
    const page = parseBtreePage(buildBtreePage({ pageType: "leaf" }));
    expect(siblingNav(page.special!)).toEqual({
      prev: null,
      next: null,
      prevNote: "leftmost",
      nextNote: "rightmost",
    });
  });

  it("labels only the missing side", () => {
    const page = parseBtreePage(buildBtreePage({ pageType: "leaf", btpoPrev: 2 }));
    expect(siblingNav(page.special!)).toEqual({
      prev: 2,
      next: null,
      prevNote: null,
      nextNote: "rightmost",
    });
  });
});

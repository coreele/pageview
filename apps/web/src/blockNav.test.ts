import { describe, expect, it } from "vitest";
import { buildBtreePage, parseBtreePage } from "page-core";
import { heapJumpError, resolveJumpTable, siblingNav } from "./blockNav";
import type { TableRow } from "./api";

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

describe("resolveJumpTable (P1-3 target-table visibility)", () => {
  const tables: TableRow[] = [
    { oid: 16384, schema: "public", name: "orders", qualifiedName: "public.orders", blocks: 5 },
    { oid: 16390, schema: "public", name: "items", qualifiedName: "public.items", blocks: 2 },
  ];

  it("finds the owning table by oid", () => {
    expect(resolveJumpTable(tables, 16390)?.qualifiedName).toBe("public.items");
  });

  it("returns null for tables hidden from the list (system schema / dropped)", () => {
    expect(resolveJumpTable(tables, 99999)).toBeNull();
  });
});

describe("heapJumpError (readable feedback, never silent)", () => {
  it("is a full {code,message,nextStep} error shape naming the table", () => {
    const err = heapJumpError(99999, "public.orders");
    expect(err.code).toBe("TABLE_NOT_LISTED");
    expect(err.message).toContain("99999");
    expect(err.message).toContain("public.orders");
    expect(err.nextStep.length).toBeGreaterThan(0);
  });

  it("works without the qualified name", () => {
    const err = heapJumpError(1);
    expect(err.code).toBe("TABLE_NOT_LISTED");
    expect(err.message).toContain("1");
  });
});

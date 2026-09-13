import { describe, expect, it } from "vitest";
import type { TableRow } from "./api";
import { canLoadIndex, type IndexRowLike } from "./indexView";
import { formatTableOption, shouldAutoLoadRelation } from "./relationSelect";

function table(overrides: Partial<TableRow> = {}): TableRow {
  return {
    oid: 16384,
    schema: "public",
    name: "users",
    qualifiedName: "public.users",
    blocks: 12,
    ...overrides,
  };
}

function index(overrides: Partial<IndexRowLike> = {}): IndexRowLike {
  return {
    oid: 16385,
    qualifiedName: "public.users_pkey",
    accessMethod: "btree",
    blocks: 3,
    tableOid: 16384,
    tableQualifiedName: "public.users",
    valid: true,
    ...overrides,
  };
}

describe("formatTableOption (P0-1)", () => {
  it("renders qualified name, oid and block count", () => {
    expect(formatTableOption(table())).toBe("public.users (oid 16384 · 12 blk)");
  });

  it("keeps a long qualified name intact (native select truncates visually)", () => {
    const long = table({
      qualifiedName: "analytics.some_extremely_long_relation_name_for_wide_columns",
      oid: 4294967295,
      blocks: 0,
    });
    expect(formatTableOption(long)).toBe(
      "analytics.some_extremely_long_relation_name_for_wide_columns (oid 4294967295 · 0 blk)",
    );
  });

  it("renders a zero-block table with 0 blk", () => {
    expect(formatTableOption(table({ blocks: 0 }))).toBe("public.users (oid 16384 · 0 blk)");
  });
});

describe("shouldAutoLoadRelation (P0-2 / P0-13)", () => {
  it("auto-loads only when the relation has at least one block", () => {
    expect(shouldAutoLoadRelation(1)).toBe(true);
    expect(shouldAutoLoadRelation(12)).toBe(true);
  });

  it("never auto-loads a zero-block relation", () => {
    expect(shouldAutoLoadRelation(0)).toBe(false);
  });
});

describe("index auto-load gate (P0-5 / P0-6)", () => {
  it("requires both a B-tree index and blocks > 0", () => {
    const btree = index();
    const hash = index({ accessMethod: "hash" });
    const emptyBtree = index({ blocks: 0 });
    expect(canLoadIndex(btree) && shouldAutoLoadRelation(btree.blocks)).toBe(true);
    expect(canLoadIndex(hash) && shouldAutoLoadRelation(hash.blocks)).toBe(false);
    expect(canLoadIndex(emptyBtree) && shouldAutoLoadRelation(emptyBtree.blocks)).toBe(false);
  });
});

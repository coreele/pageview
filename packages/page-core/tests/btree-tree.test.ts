import { describe, expect, it } from "vitest";
import {
  BTP_DELETED,
  BTP_HAS_GARBAGE,
  BTP_HALF_DEAD,
  BTP_INCOMPLETE_SPLIT,
  BTP_LEAF,
  BTP_ROOT,
  btreeDownlinks,
  btreeTreeNodeSummary,
  buildBtreePage,
  parseBtreePage,
  pathFromCache,
} from "../src/index.js";

function pages(entries: Array<[number, ReturnType<typeof parseBtreePage>]>): Map<number, ReturnType<typeof parseBtreePage>> {
  return new Map(entries);
}

describe("btreeDownlinks", () => {
  it("meta lists root then fastroot when they differ", () => {
    const meta = parseBtreePage(
      buildBtreePage({ pageType: "meta", metaRoot: 3, metaFastRoot: 9 }),
    );
    expect(btreeDownlinks(meta)).toEqual([3, 9]);
  });

  it("meta lists a single child when root equals fastroot", () => {
    const meta = parseBtreePage(buildBtreePage({ pageType: "meta", metaRoot: 3 }));
    expect(btreeDownlinks(meta)).toEqual([3]);
  });

  it("internal skips hikey and keeps downlink order", () => {
    const internal = parseBtreePage(
      buildBtreePage({
        pageType: "internal",
        btpoLevel: 1,
        btpoNext: 99,
        tuples: [
          { tidBlock: 1, tidOffset: 0, pivot: true },
          { tidBlock: 10, tidOffset: 1, pivot: true },
          { tidBlock: 11, tidOffset: 1, pivot: true },
          { tidBlock: 12, tidOffset: 1, pivot: true },
        ],
      }),
    );
    expect(internal.tuples[0]!.isHikey).toBe(true);
    expect(btreeDownlinks(internal)).toEqual([10, 11, 12]);
  });

  it("rightmost internal keeps every tuple as a downlink", () => {
    const internal = parseBtreePage(
      buildBtreePage({
        pageType: "internal",
        btpoLevel: 1,
        tuples: [
          { tidBlock: 10, tidOffset: 1, pivot: true },
          { tidBlock: 11, tidOffset: 1, pivot: true },
        ],
      }),
    );
    expect(internal.tuples[0]!.isHikey).toBe(false);
    expect(btreeDownlinks(internal)).toEqual([10, 11]);
  });

  it("leaf has no index children", () => {
    const leaf = parseBtreePage(
      buildBtreePage({
        pageType: "leaf",
        tuples: [{ tidBlock: 7, tidOffset: 3 }],
      }),
    );
    expect(btreeDownlinks(leaf)).toEqual([]);
  });
});

describe("btreeTreeNodeSummary (P1-1)", () => {
  it("meta has null level and no root chip from BTP_META alone", () => {
    const meta = parseBtreePage(buildBtreePage({ pageType: "meta" }));
    expect(btreeTreeNodeSummary(meta)).toEqual({
      pageType: "meta",
      level: null,
      isRoot: false,
      chips: [],
    });
  });

  it("internal root reports level and flag chips", () => {
    const internal = parseBtreePage(
      buildBtreePage({
        pageType: "internal",
        btpoLevel: 2,
        btpoFlagsOverride: BTP_ROOT | BTP_HAS_GARBAGE | BTP_INCOMPLETE_SPLIT,
      }),
    );
    expect(btreeTreeNodeSummary(internal)).toEqual({
      pageType: "internal",
      level: 2,
      isRoot: true,
      chips: ["garbage", "incomplete-split"],
    });
  });

  it("leaf reports deleted and half-dead chips", () => {
    const leaf = parseBtreePage(
      buildBtreePage({
        pageType: "leaf",
        btpoFlagsOverride: BTP_LEAF | BTP_DELETED | BTP_HALF_DEAD,
      }),
    );
    expect(btreeTreeNodeSummary(leaf).chips).toEqual(["deleted", "half-dead"]);
  });
});

describe("pathFromCache", () => {
  it("P0-4 height-2: meta → root internal → leaf", () => {
    const meta = parseBtreePage(buildBtreePage({ pageType: "meta", metaRoot: 3 }));
    const root = parseBtreePage(
      buildBtreePage({
        pageType: "internal",
        btpoLevel: 1,
        tuples: [
          { tidBlock: 10, tidOffset: 1, pivot: true },
          { tidBlock: 11, tidOffset: 1, pivot: true },
          { tidBlock: 12, tidOffset: 1, pivot: true },
        ],
      }),
    );
    const leaf = parseBtreePage(buildBtreePage({ pageType: "leaf" }));
    const cache = pages([
      [0, meta],
      [3, root],
      [11, leaf],
    ]);
    expect(pathFromCache(cache, 11)).toEqual({ path: [0, 3, 11], orphan: false });
  });

  it("target meta is just [0]", () => {
    const meta = parseBtreePage(buildBtreePage({ pageType: "meta" }));
    expect(pathFromCache(pages([[0, meta]]), 0)).toEqual({ path: [0], orphan: false });
  });

  it("P1-2 orphan when the current leaf is not a cached downlink", () => {
    const meta = parseBtreePage(buildBtreePage({ pageType: "meta", metaRoot: 3 }));
    const root = parseBtreePage(
      buildBtreePage({
        pageType: "internal",
        tuples: [{ tidBlock: 10, tidOffset: 1, pivot: true }],
      }),
    );
    const stray = parseBtreePage(buildBtreePage({ pageType: "leaf" }));
    const result = pathFromCache(
      pages([
        [0, meta],
        [3, root],
        [99, stray],
      ]),
      99,
    );
    expect(result).toEqual({ path: [0], orphan: true });
  });

  it("prefers the root spine over fastroot when both are cached", () => {
    const meta = parseBtreePage(
      buildBtreePage({ pageType: "meta", metaRoot: 3, metaFastRoot: 4 }),
    );
    const root = parseBtreePage(
      buildBtreePage({
        pageType: "internal",
        tuples: [{ tidBlock: 20, tidOffset: 1, pivot: true }],
      }),
    );
    const fast = parseBtreePage(
      buildBtreePage({
        pageType: "internal",
        tuples: [{ tidBlock: 20, tidOffset: 1, pivot: true }],
      }),
    );
    const leaf = parseBtreePage(buildBtreePage({ pageType: "leaf" }));
    expect(
      pathFromCache(
        pages([
          [0, meta],
          [4, fast],
          [3, root],
          [20, leaf],
        ]),
        20,
      ),
    ).toEqual({ path: [0, 3, 20], orphan: false });
  });
});

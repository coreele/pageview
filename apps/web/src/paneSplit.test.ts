import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SPLIT,
  GUTTER_PX,
  HEX_MIN_PX,
  STRUCTURE_MIN_PX,
  TREE_MIN_PX,
  dragHex,
  dragTree,
  pageSplitTemplate,
} from "./paneSplit";

describe("pageSplitTemplate", () => {
  it("inserts gutters between open panes", () => {
    const g = `${GUTTER_PX}px`;
    expect(pageSplitTemplate(DEFAULT_PAGE_SPLIT, true, true)).toBe(
      `${DEFAULT_PAGE_SPLIT.treePx}px ${g} minmax(0, 1fr) ${g} ${DEFAULT_PAGE_SPLIT.hexPx}px`,
    );
    expect(pageSplitTemplate(DEFAULT_PAGE_SPLIT, true, false)).toBe(
      `${DEFAULT_PAGE_SPLIT.treePx}px ${g} minmax(0, 1fr)`,
    );
    expect(pageSplitTemplate(DEFAULT_PAGE_SPLIT, false, true)).toBe(
      `minmax(0, 1fr) ${g} ${DEFAULT_PAGE_SPLIT.hexPx}px`,
    );
    expect(pageSplitTemplate(DEFAULT_PAGE_SPLIT, false, false)).toBe("minmax(0, 1fr)");
  });
});

describe("dragTree / dragHex", () => {
  const box = 1200;

  it("grows the tree to the right without dropping below the min", () => {
    const next = dragTree(DEFAULT_PAGE_SPLIT, 80, box, true);
    expect(next.treePx).toBe(DEFAULT_PAGE_SPLIT.treePx + 80);
    expect(next.hexPx).toBe(DEFAULT_PAGE_SPLIT.hexPx);
    expect(dragTree(DEFAULT_PAGE_SPLIT, -400, box, true).treePx).toBe(TREE_MIN_PX);
  });

  it("dragging the hex gutter right shrinks hex", () => {
    const next = dragHex(DEFAULT_PAGE_SPLIT, 50, box, true);
    expect(next.hexPx).toBe(DEFAULT_PAGE_SPLIT.hexPx - 50);
    expect(dragHex(DEFAULT_PAGE_SPLIT, 800, box, true).hexPx).toBe(HEX_MIN_PX);
  });

  it("leaves room for the structure pane", () => {
    const tight = dragTree({ treePx: 400, hexPx: 400 }, 200, 900, true);
    const gutters = GUTTER_PX * 2;
    expect(tight.treePx + tight.hexPx + gutters + STRUCTURE_MIN_PX).toBeLessThanOrEqual(900);
  });
});

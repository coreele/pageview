import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_PAGE_SPLIT,
  GUTTER_PX,
  HEX_MAX_PX,
  HEX_MIN_PX,
  STRUCTURE_MIN_PX,
  TREE_MIN_PX,
  dragHex,
  dragTree,
  hexDragStart,
  pageSplitTemplate,
} from "./paneSplit";

const pinned = { treePx: 220, hexPx: 360 };

describe("pageSplitTemplate", () => {
  it("shares leftover space equally until the hex pane is dragged", () => {
    const g = `${GUTTER_PX}px`;
    expect(pageSplitTemplate(DEFAULT_PAGE_SPLIT, true, true)).toBe(
      `${DEFAULT_PAGE_SPLIT.treePx}px ${g} minmax(0, 1fr) ${g} minmax(0, 1fr)`,
    );
    expect(pageSplitTemplate(pinned, true, true)).toBe(
      `${pinned.treePx}px ${g} minmax(0, 1fr) ${g} ${pinned.hexPx}px`,
    );
    expect(pageSplitTemplate(DEFAULT_PAGE_SPLIT, false, true)).toBe(
      `minmax(0, 1fr) ${g} minmax(0, 1fr)`,
    );
  });
});

describe("dragTree / dragHex", () => {
  const box = 1200;

  it("grows the tree to the right without dropping below the min", () => {
    const next = dragTree(pinned, 80, box, true);
    expect(next.treePx).toBe(pinned.treePx + 80);
    expect(next.hexPx).toBe(pinned.hexPx);
    expect(dragTree(pinned, -400, box, true).treePx).toBe(TREE_MIN_PX);
  });

  it("dragging the hex gutter right shrinks hex", () => {
    const next = dragHex(pinned, 50, box, true);
    expect(next.hexPx).toBe(pinned.hexPx - 50);
    expect(dragHex(pinned, 800, box, true).hexPx).toBe(HEX_MIN_PX);
  });

  it("allows hex to grow past the old 720px cap", () => {
    const next = dragHex({ treePx: 220, hexPx: 700 }, -400, 2000, true);
    expect(next.hexPx).toBeGreaterThan(720);
    expect(next.hexPx).toBeLessThanOrEqual(HEX_MAX_PX);
  });

  it("leaves room for the structure pane", () => {
    const tight = dragTree({ treePx: 400, hexPx: 400 }, 200, 900, true);
    const gutters = GUTTER_PX * 2;
    expect((tight.treePx ?? 0) + (tight.hexPx ?? 0) + gutters + STRUCTURE_MIN_PX).toBeLessThanOrEqual(
      900,
    );
  });

  it("pins hex to the measured width before the first drag", () => {
    expect(hexDragStart(DEFAULT_PAGE_SPLIT, 640)).toEqual({ treePx: 220, hexPx: 640 });
  });
});

const srcDir = dirname(fileURLToPath(import.meta.url));

describe("split gutter grip (gutter-grip V-1 / V-2)", () => {
  const css = readFileSync(join(srcDir, "styles.css"), "utf8");
  const after = css.match(/\.split-gutter::after\s*\{[^}]+\}/)?.[0] ?? "";
  const hover = css.match(/\.split-gutter:hover::after[\s\S]*?\{[^}]+\}/)?.[0] ?? "";

  it("uses a short centered bar instead of a full-height strip (V-1)", () => {
    expect(after).toMatch(/height:\s*2\.5rem/);
    expect(after).toMatch(/translate\(-50%,\s*-50%\)/);
    expect(after).not.toMatch(/bottom:\s*0\.45rem/);
  });

  it("keeps hover and focus quieter than solid accent (V-2)", () => {
    expect(hover).toMatch(
      /background:\s*color-mix\(in srgb, var\(--accent\) 40%, var\(--border\)\)/,
    );
    expect(hover).not.toMatch(/background:\s*var\(--accent\)\s*;/);
  });
});

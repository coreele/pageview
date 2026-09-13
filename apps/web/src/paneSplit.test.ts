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

  function block(re: RegExp): string {
    return css.match(re)?.[0] ?? "";
  }

  function baseBlock(selector: string): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
  }

  // Wide-layout media bodies: the closing brace sits at column 0, inner rules are indented,
  // so a lazy match to the first `\n}` yields exactly one `@media (min-width: 960px)` block.
  function wideMediaBodies(): string[] {
    const bodies: string[] = [];
    const re = /@media \(min-width: 960px\)\s*\{([\s\S]*?)\n\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(css)) !== null) bodies.push(m[1] ?? "");
    return bodies;
  }

  const wideMedia = wideMediaBodies();

  function inWideMedia(snippet: string): boolean {
    return snippet !== "" && wideMedia.some((body) => body.includes(snippet));
  }

  function wideBlock(selector: string): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`);
    for (const body of wideMedia) {
      const m = body.match(re);
      if (m) return m[1] ?? "";
    }
    return "";
  }

  const after = block(/\.split-gutter::after\s*\{[^}]+\}/);
  const hover = block(/\.split-gutter:hover::after[\s\S]*?\{[^}]+\}/);
  const focus = block(/\.split-gutter:focus-visible\s*\{[^}]+\}/);
  const dragging = block(/html\.is-split-dragging\s+\.split-gutter::after\s*\{[^}]+\}/);
  const wideOverride = block(
    /\.main-paged \.pane-tree,\s*\.main-paged \.pane-structure > \.structure-diagram,\s*\.main-paged \.pane-hex > \.hex\s*\{[^}]+\}/,
  );

  it("draws a full-height 1px centered line instead of a pill (V-1)", () => {
    expect(after).toMatch(/width:\s*1px/);
    expect(after).toMatch(/top:\s*0\s*;/);
    expect(after).toMatch(/bottom:\s*0\s*;/);
    expect(after).toMatch(/left:\s*50%/);
    expect(after).toMatch(/transform:\s*translateX\(-50%\)/);
    expect(after).toMatch(/background:\s*var\(--border\)/);
    expect(after).not.toMatch(/height:/);
    expect(after).not.toMatch(/border-radius/);
  });

  it("highlights hover and focus with a 2px accent mix, not solid accent (V-2)", () => {
    expect(hover).toMatch(/width:\s*2px/);
    expect(hover).toMatch(
      /background:\s*color-mix\(in srgb, var\(--accent\) 55%, var\(--border\)\)/,
    );
    expect(hover).not.toMatch(/background:\s*var\(--accent\)\s*;/);
    expect(focus).toMatch(/outline:\s*none/);
  });

  it("uses solid accent only while dragging", () => {
    expect(dragging).toMatch(/width:\s*2px/);
    expect(dragging).toMatch(/background:\s*var\(--accent\)\s*;/);
  });

  it("strips card chrome only in the wide paged scope (V-3)", () => {
    expect(wideOverride).not.toBe("");
    expect(inWideMedia(wideOverride)).toBe(true);
    expect(wideOverride).toMatch(/border:\s*0\s*;/);
    expect(wideOverride).toMatch(/border-radius:\s*0\s*;/);
    expect(wideOverride).toMatch(/box-shadow:\s*none\s*;/);
    expect(baseBlock(".pane-tree")).toMatch(/border:\s*1px solid var\(--border\)/);
    expect(baseBlock(".structure-diagram")).toMatch(/border:\s*1px solid var\(--border\)/);
    expect(baseBlock(".hex")).toMatch(/border:\s*1px solid var\(--border\)/);
  });

  it("drops the .main outer whitespace only in the wide paged scope (V-8)", () => {
    const mainPaged = wideBlock(".main-paged");
    expect(mainPaged).not.toBe("");
    expect(mainPaged).toMatch(/padding:\s*0\s*;/);
    expect(baseBlock(".main")).toMatch(/padding:\s*var\(--space-6\)/);
  });

  it("puts wide gutters and panes on one flat surface (V-10)", () => {
    const wideGutter = wideBlock(".main-paged .split-gutter");
    expect(wideGutter).not.toBe("");
    expect(wideGutter).toMatch(/background:\s*var\(--surface\)/);

    expect(wideOverride).not.toBe("");
    expect(inWideMedia(wideOverride)).toBe(true);
    expect(wideOverride).toMatch(/background:\s*var\(--surface\)/);

    expect(baseBlock(".split-gutter")).toMatch(/background:\s*transparent/);
    expect(baseBlock(".pane-tree")).toMatch(/background:\s*var\(--surface\)/);
    expect(baseBlock(".structure-diagram")).toMatch(/background:\s*var\(--diagram-bg\)/);
    expect(baseBlock(".hex")).toMatch(/background:\s*var\(--diagram-bg\)/);
  });
});

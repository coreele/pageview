import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = dirname(fileURLToPath(import.meta.url));

describe("tree nav expander (V-2)", () => {
  it("does not use unicode carets or bullets in the panel", () => {
    const text = readFileSync(join(srcDir, "BtreeTreePanel.tsx"), "utf8");
    expect(text).not.toMatch(/[▾▸•]/);
  });

  it("draws a CSS caret and leaf dot", () => {
    const css = readFileSync(join(srcDir, "styles.css"), "utf8");
    expect(css).toMatch(/\.btree-tree-expander::before/);
    expect(css).toMatch(/\.btree-tree-expander--leaf::before/);
  });
});

describe("tree nav current row (V-3)", () => {
  it("stretches the row and uses an inset accent bar when current", () => {
    const css = readFileSync(join(srcDir, "styles.css"), "utf8");
    expect(css).toMatch(/\.btree-tree-row\s*\{[^}]*width:\s*100%/);
    expect(css).toMatch(
      /\.btree-tree-row\[data-current="true"\]\s*\{[^}]*box-shadow:\s*inset 2px 0 0 var\(--accent\)/,
    );
  });
});

describe("tree nav expander spacing (V-4)", () => {
  it("keeps the caret/dot slot tight against the blk label", () => {
    const css = readFileSync(join(srcDir, "styles.css"), "utf8");
    expect(css).toMatch(/\.btree-tree-row\s*\{[^}]*gap:\s*0/);
    expect(css).toMatch(/\.btree-tree-expander\s*\{[^}]*width:\s*0\.85rem/);
    expect(css).toMatch(/\.btree-tree-label\s*\{[^}]*padding-left:\s*0\.1rem/);
  });
});

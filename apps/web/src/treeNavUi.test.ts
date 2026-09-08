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

  it("draws a CSS caret on section headers and type icons on rows", () => {
    const css = readFileSync(join(srcDir, "styles.css"), "utf8");
    expect(css).toMatch(/\.tree-section-head \.btree-tree-expander::before/);
    expect(css).toMatch(/\.btree-tree-row\[data-role="table"\] \.btree-tree-expander::before/);
    expect(css).toMatch(/\.btree-tree-row\[data-role="index"\] \.btree-tree-expander::before/);
    expect(css).toMatch(/\.btree-tree-row\[data-role="page"\] \.btree-tree-expander::before/);
  });
});

describe("tree nav current row (V-3)", () => {
  it("stretches the row and highlights current text without a fill", () => {
    const css = readFileSync(join(srcDir, "styles.css"), "utf8");
    expect(css).toMatch(/\.btree-tree-row\s*\{[^}]*width:\s*100%/);
    expect(css).toMatch(
      /\.btree-tree-row\[data-current="true"\] \.btree-tree-blk\s*\{[^}]*color:\s*var\(--accent\)/,
    );
    expect(css).not.toMatch(
      /\.btree-tree-row\[data-current="true"\][^{]*\{[^}]*background:/,
    );
  });
});

describe("tree nav expander spacing (V-4)", () => {
  it("keeps the caret/dot slot tight against the blk label", () => {
    const css = readFileSync(join(srcDir, "styles.css"), "utf8");
    expect(css).toMatch(/\.btree-tree-row\s*\{[^}]*gap:\s*0/);
    expect(css).toMatch(/\.btree-tree-expander\s*\{[^}]*width:\s*0\.95rem/);
    expect(css).toMatch(/\.btree-tree-label\s*\{[^}]*padding-left:\s*0\.1rem/);
  });
});

describe("tree nav hierarchy (table-tree-nav)", () => {
  it("indents nested rows and draws a guide rail", () => {
    const css = readFileSync(join(srcDir, "styles.css"), "utf8");
    expect(css).toMatch(/--tree-indent:\s*1\.25rem/);
    expect(css).toMatch(
      /\.btree-tree-row\[data-depth\]:not\(\[data-depth="0"\]\)::before/,
    );
  });

  it("keeps selected table and block rows tight, without a fill", () => {
    const css = readFileSync(join(srcDir, "styles.css"), "utf8");
    expect(css).toMatch(/\.btree-tree-row\s*\{[^}]*margin:\s*0/);
    expect(css).toMatch(/\.btree-tree-row\s*\{[^}]*min-height:\s*1\.4rem/);
    expect(css).not.toMatch(
      /\.btree-tree-row\[data-current="true"\]\[data-role="table"\][^{]*\{[^}]*background:/,
    );
  });

  it("marks role and depth on each row", () => {
    const text = readFileSync(join(srcDir, "BtreeTreePanel.tsx"), "utf8");
    expect(text).toMatch(/data-role=\{row\.role\}/);
    expect(text).toMatch(/data-depth=\{row\.depth\}/);
  });

  it("renders collapsible table and index sections", () => {
    const text = readFileSync(join(srcDir, "BtreeTreePanel.tsx"), "utf8");
    expect(text).toMatch(/data-section=\{id\}/);
    expect(text).toMatch(/title="TABLE"/);
    expect(text).toMatch(/title="INDEX"/);
    const css = readFileSync(join(srcDir, "styles.css"), "utf8");
    expect(css).toMatch(/\.tree-section\s*\{[^}]*max-height:\s*50%/);
    expect(css).toMatch(/\.tree-section-title\s*\{[^}]*text-transform:\s*uppercase/);
    expect(css).toMatch(/\.tree-section \+ \.tree-section\s*\{[^}]*border-top:/);
  });
});

describe("index-tree-nav chrome (P0-3)", () => {
  it("does not keep table or index dropdowns in App", () => {
    const text = readFileSync(join(srcDir, "App.tsx"), "utf8");
    expect(text).not.toMatch(/className="index-select"/);
    expect(text).not.toMatch(/className="table-select"/);
  });
});

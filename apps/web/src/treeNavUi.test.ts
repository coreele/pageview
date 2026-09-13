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
    const glyphs = Object.fromEntries(
      [...css.matchAll(/\[data-role="(index|page)"\] \.btree-tree-expander::before \{\s*--tree-glyph:\s*url\("([^"]+)"\)/g)].map(
        (m) => [m[1], m[2]],
      ),
    );
    expect(glyphs.index).toMatch(/^data:image\/svg\+xml,/);
    expect(glyphs.page).toMatch(/^data:image\/svg\+xml,/);
    expect(glyphs.index).not.toEqual(glyphs.page);
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
  it("keeps table and index dropdowns only inside the single-mode toolbar (P0-1 / P0-11)", () => {
    const text = readFileSync(join(srcDir, "App.tsx"), "utf8");
    const singleGuard = text.indexOf('browseMode === "single" && (');
    const tableSelect = text.indexOf('className="table-select"');
    const indexSelect = text.indexOf('className="index-select"');
    expect(singleGuard).toBeGreaterThan(-1);
    expect(tableSelect).toBeGreaterThan(singleGuard);
    expect(indexSelect).toBeGreaterThan(singleGuard);
  });

  it("renders loading, empty and select placeholders and disables during page load (P0-12)", () => {
    const text = readFileSync(join(srcDir, "App.tsx"), "utf8");
    expect(text).toMatch(/Loading tables…/);
    expect(text).toMatch(/No tables/);
    expect(text).toMatch(/select a table…/);
    expect(text).toMatch(/Loading indexes…/);
    expect(text).toMatch(/No user indexes \(system schemas excluded\)/);
    expect(text).toMatch(/select an index…/);
    expect(text).toMatch(/loadState === "loading-page"/);
  });

  it("auto-loads blk 0 for loadable picks only (P0-2 / P0-5 / P0-6 / P0-13)", () => {
    const text = readFileSync(join(srcDir, "App.tsx"), "utf8");
    expect(text).toMatch(/loadBlk\(oid, 0\)/);
    expect(text).toMatch(/loadIndexBlk\(oid, 0\)/);
    expect(text).toMatch(/shouldAutoLoadRelation\(t\.blocks\)/);
    expect(text).toMatch(/canLoadIndex\(idx\) && shouldAutoLoadRelation\(idx\.blocks\)/);
  });
});

describe("index-tree-nav catalog (P0-2)", () => {
  it("feeds the full index list to the catalog and does not filter by table", () => {
    const text = readFileSync(join(srcDir, "App.tsx"), "utf8");
    expect(text).toMatch(/visibleIndexCatalog\(\s*indexes,/);
    expect(text).not.toMatch(/filterIndexesByTable/);
  });
});

describe("page browse mode (drop-load-refresh)", () => {
  it("keeps a Tree chrome toggle and hides Load row while Tree is on (P0-1 / P0-2)", () => {
    const text = readFileSync(join(srcDir, "App.tsx"), "utf8");
    expect(text).toMatch(/chromeToggleClass\(!btreeTree\.collapsed\)/);
    expect(text).toMatch(/browseMode === "single" && \(/);
    expect(text).toMatch(/className="chrome-controls"/);
    expect(text).not.toMatch(/>\s*Single\s*</);
    expect(text).not.toMatch(/"Single"/);
    expect(text).not.toMatch(/Open Tree to pick a table or index/);
  });

  it("refreshes the current tree page row (P0-3 / P0-5)", () => {
    const text = readFileSync(join(srcDir, "App.tsx"), "utf8");
    expect(text).toMatch(/pageRowClickAction/);
    expect(text).toMatch(/loadBlk\(row\.indexOid, row\.blkno, \{ refresh: true \}\)/);
    expect(text).toMatch(/loadIndexBlk\(row\.indexOid, row\.blkno, \{ refresh: true \}\)/);
  });

  it("keeps WAL Load without a Tree toggle (P0-7)", () => {
    const text = readFileSync(join(srcDir, "App.tsx"), "utf8");
    const walBlock = text.slice(
      text.indexOf("{!connected ?"),
      text.indexOf('aria-label="WAL context"'),
    );
    expect(walBlock.length).toBeGreaterThan(0);
    expect(walBlock).toMatch(/"Load"/);
    expect(walBlock).toContain("recent 20");
    expect(walBlock).not.toMatch(/chromeToggleClass/);
    expect(walBlock).not.toMatch(/\bTree\b/);
    expect(text).toMatch(/mode === "page" && showTableTreeToggle &&/);
  });
});

/** @vitest-environment happy-dom */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  composeExportRoot,
  exportCaption,
  exportFileName,
  exportTargetKind,
  isExportShortcut,
  sanitizeExportName,
} from "./exportStructure";

const srcDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(srcDir, "../../..");

describe("exportCaption (P0-2)", () => {
  it("includes qualified name, kind, and blkno", () => {
    expect(exportCaption({ qualifiedName: "public.items", kind: "heap", blkno: 0 })).toBe(
      "public.items  ·  heap  ·  blk 0",
    );
    expect(exportCaption({ qualifiedName: "public.orders_pkey", kind: "index", blkno: 3 })).toBe(
      "public.orders_pkey  ·  index  ·  blk 3",
    );
  });
});

describe("exportFileName (P0-3)", () => {
  it("sanitizes the relation name and uses kind_blk", () => {
    expect(exportFileName({ qualifiedName: "public.items", kind: "heap", blkno: 0 })).toBe(
      "public.items_heap_blk0.png",
    );
    expect(exportFileName({ qualifiedName: 'schema."Odd Name!"', kind: "index", blkno: 12 })).toBe(
      "schema._Odd_Name_index_blk12.png",
    );
  });

  it("falls back to page when the name is only punctuation", () => {
    expect(sanitizeExportName("!!!")).toBe("page");
    expect(exportFileName({ qualifiedName: "@@@", kind: "heap", blkno: 1 })).toBe("page_heap_blk1.png");
  });
});

describe("isExportShortcut (P0-6)", () => {
  it("matches Ctrl/Meta+Shift+C", () => {
    expect(isExportShortcut({ key: "c", shiftKey: true, ctrlKey: true, metaKey: false })).toBe(true);
    expect(isExportShortcut({ key: "C", shiftKey: true, ctrlKey: false, metaKey: true })).toBe(true);
    expect(isExportShortcut({ key: "c", shiftKey: false, ctrlKey: true, metaKey: false })).toBe(false);
    expect(isExportShortcut({ key: "c", shiftKey: true, ctrlKey: false, metaKey: false })).toBe(false);
  });
});

describe("exportTargetKind (P0-7 / P1-1)", () => {
  it("prefers a ready overlay over the main page", () => {
    expect(
      exportTargetKind({ overlayPresent: true, overlayPageReady: true, mainPageReady: true }),
    ).toBe("overlay");
  });

  it("exports nothing while the overlay is open but not ready", () => {
    expect(
      exportTargetKind({ overlayPresent: true, overlayPageReady: false, mainPageReady: true }),
    ).toBe("none");
  });

  it("uses the main page when no overlay is present", () => {
    expect(
      exportTargetKind({ overlayPresent: false, overlayPageReady: false, mainPageReady: true }),
    ).toBe("main");
    expect(
      exportTargetKind({ overlayPresent: false, overlayPageReady: false, mainPageReady: false }),
    ).toBe("none");
  });
});

describe("composeExportRoot (P0-2)", () => {
  it("adds a caption and strips detail / probe, expanding the flow", () => {
    const source = document.createElement("div");
    source.className = "structure structure-diagram";
    source.setAttribute("data-export-structure", "main");
    source.innerHTML = `
      <span class="structure-char-probe">000</span>
      <div class="diagram-legend"><span class="legend-chip">header</span></div>
      <div class="structure-flow" style="overflow:auto;max-height:40px">
        <div class="structure-row">row</div>
      </div>
      <div class="selection-detail-wrap"><div class="panel">detail</div></div>
    `;
    document.documentElement.setAttribute("data-theme", "dark");
    const wrap = composeExportRoot(source, "public.items  ·  heap  ·  blk 0");
    expect(wrap.getAttribute("data-theme")).toBe("dark");
    expect(wrap.querySelector(".export-structure-caption")?.textContent).toBe(
      "public.items  ·  heap  ·  blk 0",
    );
    expect(wrap.querySelector(".selection-detail-wrap")).toBeNull();
    expect(wrap.querySelector(".structure-char-probe")).toBeNull();
    expect(wrap.querySelector("[data-export-structure]")).toBeNull();
    const flow = wrap.querySelector(".structure-flow") as HTMLElement;
    expect(flow.style.overflow).toBe("visible");
    expect(flow.style.maxHeight).toBe("none");
    expect(wrap.querySelector(".diagram-legend")).not.toBeNull();
  });
});

describe("chrome Export placement (P0-1)", () => {
  it("places Export first in chrome-actions, before Tree, Detail, and Hex", () => {
    const app = readFileSync(join(srcDir, "App.tsx"), "utf8");
    const start = app.indexOf('className="chrome-actions"');
    const end = app.indexOf("chrome-theme", start);
    const actions = app.slice(start, end);
    const exp = actions.indexOf("Export structure diagram as PNG");
    const tree = actions.indexOf("btree-tree-panel");
    const detail = actions.indexOf("selection-detail-panel");
    const hex = actions.indexOf("hex-panel");
    expect(exp).toBeGreaterThan(-1);
    expect(tree).toBeGreaterThan(exp);
    expect(detail).toBeGreaterThan(tree);
    expect(hex).toBeGreaterThan(detail);
  });

  it("does not show Export in the WAL-only Detail branch", () => {
    const app = readFileSync(join(srcDir, "App.tsx"), "utf8");
    expect(app).toMatch(/mode === "page" && pageView && \(/);
    expect(app).toMatch(/aria-label="Export structure diagram as PNG"/);
  });
});

describe("overlay Export (P0-7 / P1-1)", () => {
  it("renders Export in the peek header and disables it unless open", () => {
    const overlay = readFileSync(join(srcDir, "HeapPeekOverlay.tsx"), "utf8");
    expect(overlay).toMatch(/aria-label="Export structure diagram as PNG"/);
    expect(overlay).toMatch(/disabled=\{state\.status !== "open"/);
    expect(overlay).toMatch(/exportAnchor="overlay"/);
  });
});

describe("README export (docs)", () => {
  it("mentions Export PNG in both languages", () => {
    const en = readFileSync(join(repoRoot, "README.md"), "utf8");
    const zh = readFileSync(join(repoRoot, "README.zh-CN.md"), "utf8");
    expect(en).toMatch(/Export.*PNG/i);
    expect(zh).toMatch(/导出.*PNG/);
  });
});

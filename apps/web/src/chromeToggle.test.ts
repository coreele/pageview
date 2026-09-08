import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { chromeToggleClass, themeToggleLabel } from "./chromeToggle";

const srcDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(srcDir, "../../..");

describe("chromeToggleClass (V-1)", () => {
  it("marks an open pane with --on", () => {
    expect(chromeToggleClass(true)).toBe("chrome-toggle chrome-toggle--on");
    expect(chromeToggleClass(false)).toBe("chrome-toggle");
  });
});

describe("chrome toggle copy (V-2)", () => {
  it("does not switch Show/Collapse or Theme: labels in App", () => {
    const app = readFileSync(join(srcDir, "App.tsx"), "utf8");
    expect(app).not.toMatch(/Show detail|Show hex|Show tree/);
    expect(app).not.toMatch(/Collapse detail|Collapse hex|Collapse tree/);
    expect(app).not.toMatch(/Theme:/);
  });
});

describe("theme glyph (V-3)", () => {
  it("exposes sun and moon marks and a next-theme label", () => {
    const glyph = readFileSync(join(srcDir, "ThemeGlyph.tsx"), "utf8");
    expect(glyph).toContain('data-theme-icon="sun"');
    expect(glyph).toContain('data-theme-icon="moon"');
    expect(themeToggleLabel("light")).toBe("Switch to dark theme");
    expect(themeToggleLabel("dark")).toBe("Switch to light theme");
  });
});

describe("chrome toggle CSS (V-1)", () => {
  it("paints the on state with the accent mix used by mode-btn.active", () => {
    const css = readFileSync(join(srcDir, "styles.css"), "utf8");
    expect(css).toMatch(
      /\.chrome-toggle--on\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--accent\) 18%/,
    );
  });
});

describe("chrome-actions order (chrome-order V-1)", () => {
  it("places Tree before Detail and Hex", () => {
    const app = readFileSync(join(srcDir, "App.tsx"), "utf8");
    const start = app.indexOf('className="chrome-actions"');
    const end = app.indexOf("chrome-theme", start);
    const actions = app.slice(start, end);
    const tree = actions.indexOf("btree-tree-panel");
    const detail = actions.indexOf("selection-detail-panel");
    const hex = actions.indexOf("hex-panel");
    expect(tree).toBeGreaterThan(-1);
    expect(detail).toBeGreaterThan(tree);
    expect(hex).toBeGreaterThan(detail);
  });
});

describe("dark theme button fill (chrome-order V-2)", () => {
  it("uses the same accent mix as chrome-toggle--on", () => {
    const css = readFileSync(join(srcDir, "styles.css"), "utf8");
    expect(css).toMatch(
      /\[data-theme="dark"\] \.chrome-theme\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--accent\) 18%/,
    );
  });
});

describe("README tree toggle (V-docs)", () => {
  it("describes the Tree chrome toggle without Show/Collapse or a Single label", () => {
    const en = readFileSync(join(repoRoot, "README.md"), "utf8");
    const zh = readFileSync(join(repoRoot, "README.zh-CN.md"), "utf8");
    expect(en).toMatch(/Tree/);
    expect(en).not.toMatch(/Tree \| Single/);
    expect(zh).not.toMatch(/Tree \| Single/);
    expect(en).not.toMatch(/Show tree \/ Collapse tree/);
    expect(zh).not.toMatch(/Show tree \/ Collapse tree/);
  });
});

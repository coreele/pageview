import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(srcDir, "styles.css"), "utf8");

function rootTokens(): Record<string, string> {
  const block = css.match(/:root\s*\{([^}]*)\}/);
  const tokens: Record<string, string> = {};
  if (!block) return tokens;
  const body = block[1] ?? "";
  for (const m of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    const name = m[1];
    const value = m[2];
    if (name && value) tokens[name] = value.trim();
  }
  return tokens;
}

function blockFor(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  return block ? (block[1] ?? "") : "";
}

const radiusDecls = [...css.matchAll(/border-radius:\s*([^;]+);/g)].map((m) => (m[1] ?? "").trim());

describe("design tokens (V-1)", () => {
  const tokens = rootTokens();

  it("defines the radius tokens with exact values", () => {
    expect(tokens["--radius-xs"]).toBe("2px");
    expect(tokens["--radius-sm"]).toBe("4px");
    expect(tokens["--radius-md"]).toBe("6px");
    expect(tokens["--radius-lg"]).toBe("8px");
    expect(tokens["--radius-pill"]).toBe("999px");
    expect(tokens["--radius-circle"]).toBe("50%");
  });

  it("defines the spacing tokens with exact values", () => {
    expect(tokens["--space-1"]).toBe("0.15rem");
    expect(tokens["--space-2"]).toBe("0.25rem");
    expect(tokens["--space-3"]).toBe("0.35rem");
    expect(tokens["--space-4"]).toBe("0.45rem");
    expect(tokens["--space-5"]).toBe("0.5rem");
    expect(tokens["--space-6"]).toBe("0.6rem");
    expect(tokens["--space-7"]).toBe("0.75rem");
  });
});

describe("border-radius contract (V-2)", () => {
  const token = /^var\(--radius-[a-z]+\)$/;
  const zero = /^(0|0\s+0|0\s+0\s+0\s+0)$/;
  const zeroTail = /^0\s+0\s+var\(--radius-[a-z]+\)\s+var\(--radius-[a-z]+\)$/;
  const zeroHead = /^var\(--radius-[a-z]+\)\s+var\(--radius-[a-z]+\)\s+0\s+0$/;

  it("finds the full set of border-radius declarations", () => {
    expect(radiusDecls.length).toBeGreaterThan(40);
  });

  it("tokenizes every border-radius, keeping structural zeros", () => {
    for (const value of radiusDecls) {
      const ok = token.test(value) || zero.test(value) || zeroTail.test(value) || zeroHead.test(value);
      expect(ok, `un-tokenized border-radius: ${value}`).toBe(true);
    }
  });

  it("removes raw px / rem radius and the old pill / circle literals", () => {
    for (const value of radiusDecls) {
      expect(value, `raw radius literal: ${value}`).not.toMatch(/\d+(\.\d+)?(px|rem)/);
      expect(value, `raw pill literal: ${value}`).not.toContain("999px");
      expect(value, `raw circle literal: ${value}`).not.toContain("50%");
    }
  });
});

describe("module spacing contract (V-3)", () => {
  it("tightens tree section padding and drops the old value", () => {
    expect(blockFor(".pane-tree")).toMatch(/padding:\s*var\(--space-3\)\s+var\(--space-2\);/);
    expect(blockFor(".tree-section-head")).toMatch(/padding:\s*var\(--space-2\)\s+var\(--space-1\);/);
    expect(css).not.toMatch(/padding:\s*0\.4rem 0\.3rem;/);
    expect(css).not.toMatch(/padding:\s*0\.28rem 0\.2rem;/);
  });

  it("tightens chrome and main spacing and drops the old values", () => {
    expect(blockFor(".chrome-meta")).toMatch(
      /padding:\s*var\(--space-3\)\s+var\(--space-6\)\s+var\(--space-3\);/,
    );
    expect(blockFor(".main")).toMatch(/padding:\s*var\(--space-6\);/);
    expect(blockFor(".panel")).toMatch(/padding:\s*var\(--space-6\);/);
    expect(blockFor(".chrome")).toMatch(/column-gap:\s*var\(--space-5\);/);
    expect(css).not.toMatch(/padding:\s*0\.35rem 0\.75rem 0\.4rem;/);
    expect(css).not.toMatch(/padding:\s*0\.75rem;/);
  });

  it("tightens structure, WAL and heap surfaces and drops the old values", () => {
    expect(blockFor(".structure-diagram")).toMatch(
      /padding:\s*var\(--space-5\)\s+var\(--space-5\)\s+var\(--space-6\);/,
    );
    expect(blockFor(".wal-list-pane")).toMatch(
      /padding:\s*var\(--space-3\)\s+var\(--space-4\)\s+var\(--space-5\);/,
    );
    expect(blockFor(".heap-peek-backdrop")).toMatch(/padding:\s*var\(--space-6\);/);
    expect(css).not.toMatch(/padding:\s*0\.65rem 0\.7rem 0\.75rem;/);
    expect(css).not.toMatch(/padding:\s*0\.45rem 0\.5rem 0\.55rem;/);
  });
});

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { flagMarkClass } from "./FlagMark";

const srcDir = dirname(fileURLToPath(import.meta.url));

describe("flagMarkClass (V-1)", () => {
  it("distinguishes set from unset", () => {
    expect(flagMarkClass(true)).toBe("flag-mark flag-mark--set");
    expect(flagMarkClass(false)).toBe("flag-mark flag-mark--unset");
  });
});

describe("flag mark CSS (V-1)", () => {
  it("sets a 0.62rem disc, larger than a glyph bullet", () => {
    const css = readFileSync(join(srcDir, "styles.css"), "utf8");
    expect(css).toMatch(/\.flag-mark\s*\{[^}]*width:\s*0\.62rem/);
    expect(css).toMatch(/\.flag-mark--set\s*\{[^}]*background:\s*var\(--text\)/);
  });
});

describe("flag lists drop unicode discs (V-2)", () => {
  it("does not use ● or ○ in the three flag surfaces", () => {
    for (const name of ["StructureMap.tsx", "IndexTupleDetail.tsx", "InfomaskBitStrip.tsx"]) {
      const text = readFileSync(join(srcDir, name), "utf8");
      expect(text, name).not.toMatch(/[●○]/);
      expect(text, name).toContain("<FlagMark");
    }
  });
});

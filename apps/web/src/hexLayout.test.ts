import { describe, expect, it } from "vitest";
import { buildHexLayout, presentationRowForOffset } from "./hexLayout";

const BPR = 32;

describe("buildHexLayout", () => {
  it("emits continuous cell rows when free is empty (end <= start)", () => {
    const layout = buildHexLayout({
      rawLength: 64,
      freeRange: { start: 40, end: 40 },
      bytesPerRow: BPR,
    });
    expect(layout.rows).toHaveLength(2);
    expect(layout.rows.every((r) => r.parts.every((p) => p.kind === "cells"))).toBe(true);
    expect(layout.rows.some((r) => r.parts.some((p) => p.kind === "break"))).toBe(false);
    expect(presentationRowForOffset(layout, 0)).toBe(0);
    expect(presentationRowForOffset(layout, 33)).toBe(1);
  });

  it("inserts a single free break and keeps non-free as cells", () => {
    // free [64, 192) — aligned, spans 4 page rows → one break
    const layout = buildHexLayout({
      rawLength: 256,
      freeRange: { start: 64, end: 192 },
      bytesPerRow: BPR,
    });
    const breaks = layout.rows.flatMap((r) => r.parts.filter((p) => p.kind === "break"));
    expect(breaks).toHaveLength(1);
    expect(breaks[0]).toMatchObject({
      kind: "break",
      range: { start: 64, end: 192 },
      bytes: 128,
    });
    // Expanded free would be 4 rows; presentation must be much smaller
    expect(layout.rows.length).toBeLessThan(4 + 2 + 2); // free rows + before + after upper bound
    expect(layout.rows.length).toBe(2 + 1 + 2); // 64B before (2) + break + 64B after (2)
  });

  it("keeps same-row cells before and after unaligned free", () => {
    // free [100, 200): mid-row start and end
    const layout = buildHexLayout({
      rawLength: 256,
      freeRange: { start: 100, end: 200 },
      bytesPerRow: BPR,
    });
    const breakRow = layout.rows.find((r) => r.parts.some((p) => p.kind === "break"));
    expect(breakRow).toBeDefined();
    const parts = breakRow!.parts;
    expect(parts[0]).toMatchObject({ kind: "cells", startOffset: 96, length: 4 });
    expect(parts[1]).toMatchObject({
      kind: "break",
      range: { start: 100, end: 200 },
      bytes: 100,
    });
    expect(parts[2]).toMatchObject({ kind: "cells", startOffset: 200, length: 24 });
  });

  it("maps offsets in free to the break presentation row", () => {
    const layout = buildHexLayout({
      rawLength: 256,
      freeRange: { start: 64, end: 192 },
      bytesPerRow: BPR,
    });
    const breakRowIndex = layout.rows.findIndex((r) =>
      r.parts.some((p) => p.kind === "break"),
    );
    expect(presentationRowForOffset(layout, 64)).toBe(breakRowIndex);
    expect(presentationRowForOffset(layout, 191)).toBe(breakRowIndex);
    expect(presentationRowForOffset(layout, 0)).toBe(0);
    expect(presentationRowForOffset(layout, 192)).toBe(breakRowIndex + 1);
  });

  it("does not collapse non-free regions (only free becomes a break)", () => {
    const layout = buildHexLayout({
      rawLength: 96,
      freeRange: { start: 32, end: 64 },
      bytesPerRow: BPR,
    });
    const cellBytes = layout.rows
      .flatMap((r) => r.parts)
      .filter((p) => p.kind === "cells")
      .reduce((n, p) => n + (p.kind === "cells" ? p.length : 0), 0);
    expect(cellBytes).toBe(64); // 32 before + 32 after; free not counted as cells
    expect(layout.rows.flatMap((r) => r.parts).filter((p) => p.kind === "break")).toHaveLength(1);
  });

  it("labels non-break rows with absolute page offsets (≥4 hex digits worth)", () => {
    const layout = buildHexLayout({
      rawLength: 256,
      freeRange: { start: 100, end: 200 },
      bytesPerRow: BPR,
    });
    for (const row of layout.rows) {
      expect(row.labelOffset).toBeGreaterThanOrEqual(0);
      expect(row.labelOffset.toString(16).padStart(4, "0").length).toBeGreaterThanOrEqual(4);
    }
    expect(layout.rows[0]!.labelOffset).toBe(0);
  });
});

import type { ByteRange, StructureField } from "page-core";

export function rangesOverlap(a: ByteRange, b: ByteRange): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Field-level hit at offset over a pre-derived field list (heap or B-tree).
 * Most specific (smallest-span) non-visual field wins; null when unmapped.
 */
export function findStructureAt(
  fields: StructureField[],
  offset: number,
): { kind: StructureField["region"]; id: string; range: ByteRange } | null {
  let best: StructureField | null = null;
  let bestSpan = Number.POSITIVE_INFINITY;
  for (const f of fields) {
    if (f.visualOnly) continue;
    if (offset >= f.range.start && offset < f.range.end) {
      const span = f.range.end - f.range.start;
      if (span < bestSpan) {
        best = f;
        bestSpan = span;
      }
    }
  }
  if (!best) return null;
  return { kind: best.region, id: best.id, range: best.range };
}

/** Byte-level diff between two pages of equal length. */
export function diffByteRanges(prev: Uint8Array, next: Uint8Array): ByteRange[] {
  const ranges: ByteRange[] = [];
  let start: number | null = null;
  const len = Math.min(prev.length, next.length);
  for (let i = 0; i < len; i++) {
    if (prev[i] !== next[i]) {
      if (start === null) start = i;
    } else if (start !== null) {
      ranges.push({ start, end: i });
      start = null;
    }
  }
  if (start !== null) ranges.push({ start, end: len });
  return ranges;
}

/**
 * Field ids whose ranges overlap any diff range. Region-coarse compat ids
 * ("header", "free") are emitted alongside field ids so existing consumers
 * (HexDump freeDiff, structure-map region shading) keep working for both
 * heap and B-tree field lists.
 */
export function structureAffectedByDiff(
  fields: StructureField[],
  diffs: ByteRange[],
): Set<string> {
  const ids = new Set<string>();
  for (const f of fields) {
    if (f.visualOnly) continue;
    if (diffs.some((d) => rangesOverlap(d, f.range))) {
      ids.add(f.id);
      if (f.region === "header") ids.add("header");
    }
  }
  return ids;
}

import type { ByteRange, ParsedPage } from "page-core";
import { deriveStructureFields, resolveFieldAt } from "page-core";

export function rangesOverlap(a: ByteRange, b: ByteRange): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Field-level hit at offset; falls back to single-byte when unmapped. */
export function findStructureAt(
  page: ParsedPage,
  offset: number,
): { kind: string; id: string; range: ByteRange } | null {
  const hit = resolveFieldAt(page, offset);
  if (hit) {
    return { kind: hit.region, id: hit.id, range: hit.range };
  }
  return null;
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

export function structureAffectedByDiff(
  page: ParsedPage,
  diffs: ByteRange[],
): Set<string> {
  const ids = new Set<string>();
  const check = (id: string, range: ByteRange) => {
    if (diffs.some((d) => rangesOverlap(d, range))) ids.add(id);
  };
  // Coarse ids (compat) + field-level ids for diagram cells
  check("header", page.header.range);
  check("free", page.freeSpace.range);
  for (const item of page.itemIds) check(`itemid-${item.index}`, item.range);
  for (const t of page.tuples) check(`tuple-${t.itemIndex}`, t.range);
  for (const f of deriveStructureFields(page)) {
    if (f.visualOnly) continue;
    check(f.id, f.range);
  }
  return ids;
}

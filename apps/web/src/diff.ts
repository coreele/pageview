import type { ByteRange, ParsedPage } from "page-core";

export function rangesOverlap(a: ByteRange, b: ByteRange): boolean {
  return a.start < b.end && b.start < a.end;
}

export function findStructureAt(page: ParsedPage, offset: number): { kind: string; id: string; range: ByteRange } | null {
  if (offset >= page.header.range.start && offset < page.header.range.end) {
    return { kind: "header", id: "header", range: page.header.range };
  }
  for (const item of page.itemIds) {
    if (offset >= item.range.start && offset < item.range.end) {
      return { kind: "itemid", id: `itemid-${item.index}`, range: item.range };
    }
  }
  if (offset >= page.freeSpace.range.start && offset < page.freeSpace.range.end) {
    return { kind: "free", id: "free", range: page.freeSpace.range };
  }
  for (const t of page.tuples) {
    if (offset >= t.range.start && offset < t.range.end) {
      return { kind: "tuple", id: `tuple-${t.itemIndex}`, range: t.range };
    }
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
  check("header", page.header.range);
  check("free", page.freeSpace.range);
  for (const item of page.itemIds) check(`itemid-${item.index}`, item.range);
  for (const t of page.tuples) check(`tuple-${t.itemIndex}`, t.range);
  return ids;
}

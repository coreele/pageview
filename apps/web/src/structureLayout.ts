import { STRUCTURE_BYTES_PER_ROW, type ByteRange, type StructureField } from "page-core";
import type { HexPresentationRow } from "./hexLayout";

export type LayoutSegment = {
  field: StructureField;
  row: number;
  colStart: number;
  colEnd: number;
};

export function segmentsForCellPart(
  segments: LayoutSegment[],
  startOffset: number,
  length: number,
): LayoutSegment[] {
  const end = startOffset + length;
  const row = Math.floor(startOffset / STRUCTURE_BYTES_PER_ROW);
  return segments.filter((seg) => {
    if (seg.row !== row) return false;
    const segStart = row * STRUCTURE_BYTES_PER_ROW + seg.colStart;
    const segEnd = row * STRUCTURE_BYTES_PER_ROW + seg.colEnd;
    return segStart < end && segEnd > startOffset;
  });
}

/** One 32-column lane in physical column order. Tuples on a row do not overlap. */
export function groupSegmentsIntoLanes(segments: LayoutSegment[]): LayoutSegment[][] {
  if (segments.length === 0) return [[]];
  return [
    [...segments].sort(
      (a, b) => a.colStart - b.colStart || a.colEnd - b.colEnd || a.field.id.localeCompare(b.field.id),
    ),
  ];
}

export function freeBreakColumns(
  range: ByteRange,
  presRow: HexPresentationRow,
): { colStart: number; colEnd: number } {
  const breakIdx = presRow.parts.findIndex(
    (p) => p.kind === "break" && p.range.start === range.start && p.range.end === range.end,
  );
  const leading = breakIdx > 0 ? presRow.parts[breakIdx - 1] : undefined;
  const trailing = breakIdx >= 0 ? presRow.parts[breakIdx + 1] : undefined;

  const colStart =
    leading?.kind === "cells"
      ? (leading.startOffset % STRUCTURE_BYTES_PER_ROW) + leading.length
      : range.start % STRUCTURE_BYTES_PER_ROW;
  const colEnd =
    trailing?.kind === "cells"
      ? trailing.startOffset % STRUCTURE_BYTES_PER_ROW
      : STRUCTURE_BYTES_PER_ROW;
  return { colStart, colEnd };
}

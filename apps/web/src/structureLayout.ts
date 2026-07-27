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

function tupleLaneKey(fieldId: string): string | null {
  const match = /^tuple-(\d+)/.exec(fieldId);
  return match ? `tuple-${match[1]}` : null;
}

function laneSortKey(lane: LayoutSegment[]): number {
  return Math.min(...lane.map((seg) => seg.colStart));
}

/** Split packed physical rows so each tuple gets its own lane. */
export function groupSegmentsIntoLanes(segments: LayoutSegment[]): LayoutSegment[][] {
  if (segments.length === 0) return [[]];

  const nonTuple: LayoutSegment[] = [];
  const byTuple = new Map<string, LayoutSegment[]>();
  for (const seg of segments) {
    const key = tupleLaneKey(seg.field.id);
    if (!key) {
      nonTuple.push(seg);
      continue;
    }
    const lane = byTuple.get(key);
    if (lane) lane.push(seg);
    else byTuple.set(key, [seg]);
  }

  if (byTuple.size <= 1) return [segments];

  const lanes: LayoutSegment[][] = [];
  if (nonTuple.length > 0) lanes.push(nonTuple);
  lanes.push(...byTuple.values());
  return lanes.sort((a, b) => laneSortKey(a) - laneSortKey(b));
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

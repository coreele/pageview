export type ByteRange = { start: number; end: number };

export type HexCellsPart = {
  kind: "cells";
  /** Absolute page offset of the first byte in this segment. */
  startOffset: number;
  length: number;
};

export type HexBreakPart = {
  kind: "break";
  range: ByteRange;
  bytes: number;
};

export type HexRowPart = HexCellsPart | HexBreakPart;

export type HexPresentationRow = {
  rowIndex: number;
  /** Absolute page offset used for the row label (≥4 hex digits). */
  labelOffset: number;
  parts: HexRowPart[];
};

export type HexLayout = {
  rows: HexPresentationRow[];
};

function pushCellRows(
  rows: HexPresentationRow[],
  from: number,
  to: number,
  bytesPerRow: number,
): void {
  let offset = from;
  while (offset < to) {
    const rowBase = Math.floor(offset / bytesPerRow) * bytesPerRow;
    const rowEnd = Math.min(rowBase + bytesPerRow, to);
    rows.push({
      rowIndex: rows.length,
      labelOffset: rowBase,
      parts: [{ kind: "cells", startOffset: rowBase, length: rowEnd - rowBase }],
    });
    offset = rowEnd;
  }
}

/**
 * Build hex presentation rows with non-empty free collapsed to a single break.
 * Unaligned free keeps leading/trailing non-free cells on the same row only
 * when free start/end are in that same physical row.
 */
export function buildHexLayout(args: {
  rawLength: number;
  freeRange: ByteRange;
  bytesPerRow?: number;
}): HexLayout {
  const { rawLength, freeRange } = args;
  const bytesPerRow = args.bytesPerRow ?? 32;
  const rows: HexPresentationRow[] = [];

  if (rawLength <= 0) return { rows };

  if (freeRange.end <= freeRange.start) {
    pushCellRows(rows, 0, rawLength, bytesPerRow);
    return { rows };
  }

  const freeStart = Math.max(0, Math.min(freeRange.start, rawLength));
  const freeEnd = Math.max(freeStart, Math.min(freeRange.end, rawLength));
  if (freeEnd <= freeStart) {
    pushCellRows(rows, 0, rawLength, bytesPerRow);
    return { rows };
  }

  // Cells before the page-aligned row that contains freeStart
  const startRowBase = Math.floor(freeStart / bytesPerRow) * bytesPerRow;
  pushCellRows(rows, 0, startRowBase, bytesPerRow);

  const endRowBase = Math.floor(freeEnd / bytesPerRow) * bytesPerRow;
  const endRowEnd = Math.min(endRowBase + bytesPerRow, rawLength);

  const leadingLen = freeStart - startRowBase;
  // When freeEnd is row-aligned, trailing belongs to subsequent full rows — not the break row.
  const trailingLen = freeEnd > endRowBase ? endRowEnd - freeEnd : 0;
  const samePhysicalRow = startRowBase === endRowBase;

  const breakParts: HexRowPart[] = [];
  if (leadingLen > 0) {
    breakParts.push({ kind: "cells", startOffset: startRowBase, length: leadingLen });
  }
  breakParts.push({
    kind: "break",
    range: { start: freeStart, end: freeEnd },
    bytes: freeEnd - freeStart,
  });
  if (samePhysicalRow && trailingLen > 0) {
    breakParts.push({ kind: "cells", startOffset: freeEnd, length: trailingLen });
  }

  rows.push({
    rowIndex: rows.length,
    labelOffset: leadingLen > 0 ? startRowBase : freeStart,
    parts: breakParts,
  });

  const afterStart = samePhysicalRow && trailingLen > 0 ? endRowEnd : freeEnd;
  pushCellRows(rows, afterStart, rawLength, bytesPerRow);

  return { rows };
}

/** Presentation row index for an absolute page offset (clamped). */
export function presentationRowForOffset(layout: HexLayout, offset: number): number {
  if (layout.rows.length === 0) return 0;

  for (const row of layout.rows) {
    for (const part of row.parts) {
      if (part.kind === "break") {
        if (offset >= part.range.start && offset < part.range.end) {
          return row.rowIndex;
        }
      } else if (offset >= part.startOffset && offset < part.startOffset + part.length) {
        return row.rowIndex;
      }
    }
  }

  // Past end / gaps: nearest preceding row by label
  let best = layout.rows[0]!.rowIndex;
  for (const row of layout.rows) {
    if (row.labelOffset <= offset) best = row.rowIndex;
  }
  return best;
}

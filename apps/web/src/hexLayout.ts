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
  /** When set, selection/highlight uses this span (e.g. full free on a tail segment). */
  selectRange?: ByteRange;
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
 * when free start/end are in that same physical row. Cross-row free with a
 * mid-row end emits a tail break row for the remaining free bytes.
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
  const needsEndRowFreeTail =
    !samePhysicalRow && freeEnd > endRowBase && freeEnd % bytesPerRow !== 0;

  if (needsEndRowFreeTail) {
    const tailParts: HexRowPart[] = [
      {
        kind: "break",
        range: { start: endRowBase, end: freeEnd },
        bytes: freeEnd - endRowBase,
        selectRange: { start: freeStart, end: freeEnd },
      },
    ];
    const tailCellsLen = endRowEnd - freeEnd;
    if (tailCellsLen > 0) {
      tailParts.push({ kind: "cells", startOffset: freeEnd, length: tailCellsLen });
    }
    rows.push({
      rowIndex: rows.length,
      labelOffset: endRowBase,
      parts: tailParts,
    });
    pushCellRows(rows, endRowEnd, rawLength, bytesPerRow);
  } else {
    pushCellRows(rows, afterStart, rawLength, bytesPerRow);
  }

  return { rows };
}

/** Presentation row index for an absolute page offset (clamped). */
export function presentationRowForOffset(layout: HexLayout, offset: number): number {
  if (layout.rows.length === 0) return 0;

  // Prefer concrete cell rows over collapsed free break when both match.
  for (const row of layout.rows) {
    for (const part of row.parts) {
      if (
        part.kind === "cells" &&
        offset >= part.startOffset &&
        offset < part.startOffset + part.length
      ) {
        return row.rowIndex;
      }
    }
  }

  let bestBreakRow: number | null = null;
  let bestBreakSpan = Infinity;
  for (const row of layout.rows) {
    for (const part of row.parts) {
      if (part.kind === "break" && offset >= part.range.start && offset < part.range.end) {
        const span = part.range.end - part.range.start;
        if (span < bestBreakSpan) {
          bestBreakSpan = span;
          bestBreakRow = row.rowIndex;
        }
      }
    }
  }
  if (bestBreakRow !== null) return bestBreakRow;

  // Past end / gaps: nearest preceding row by label
  let best = layout.rows[0]!.rowIndex;
  for (const row of layout.rows) {
    if (row.labelOffset <= offset) best = row.rowIndex;
  }
  return best;
}

import { PAGE_HEADER_SIZE } from "./parse.js";
import type { ByteRange, ParsedPage } from "./types.js";

export const STRUCTURE_BYTES_PER_ROW = 32;

export type StructureFieldRegion = "header" | "itemid" | "free" | "tuple";

export type StructureField = {
  id: string;
  label: string;
  fullLabel: string;
  range: ByteRange;
  region: StructureFieldRegion;
  parentId?: string;
  /** Visual-only (e.g. ItemId off|flag|len); selection uses parent 4B range */
  visualOnly?: boolean;
  /** Optional single-line primary display; absent → always label mode */
  valueText?: string;
};

export type RowSegment = {
  fieldId: string;
  row: number;
  colStart: number;
  colEnd: number;
  range: ByteRange;
};

export type CellMetrics = {
  charWidthPx: number;
  byteColWidthPx: number;
  cellPaddingXPx: number;
  cellBorderXPx: number;
};

export type CellContentChoice =
  | { mode: "value"; showLabel: boolean }
  | { mode: "label" };

function field(
  partial: Omit<StructureField, "fullLabel"> & { fullLabel?: string },
): StructureField {
  return {
    ...partial,
    fullLabel: partial.fullLabel ?? partial.label,
  };
}

function hex0x(n: number): string {
  return `0x${n.toString(16)}`;
}

function columnValueText(col: {
  null: boolean;
  display: string;
  toasted?: boolean;
}): string {
  if (col.null) return "NULL";
  return `${col.display}${col.toasted ? " [TOASTed]" : ""}`;
}

/**
 * Derive clickable structure-diagram fields from a parsed page.
 * Does not mutate `page` or change parse/decode semantics.
 */
export function deriveStructureFields(page: ParsedPage): StructureField[] {
  const out: StructureField[] = [];
  const [lsnHi, lsnLo] = page.header.pd_lsn.split("/");

  out.push(
    field({
      id: "header.pd_lsn.xlogid",
      label: "xlogid",
      fullLabel: "pd_lsn.xlogid",
      range: { start: 0, end: 4 },
      region: "header",
      valueText: lsnHi,
    }),
    field({
      id: "header.pd_lsn.xrecoff",
      label: "xrecoff",
      fullLabel: "pd_lsn.xrecoff",
      range: { start: 4, end: 8 },
      region: "header",
      valueText: lsnLo,
    }),
    field({
      id: "header.pd_checksum",
      label: "checksum",
      fullLabel: "pd_checksum",
      range: { start: 8, end: 10 },
      region: "header",
      valueText: hex0x(page.header.pd_checksum),
    }),
    field({
      id: "header.pd_flags",
      label: "flags",
      fullLabel: "pd_flags",
      range: { start: 10, end: 12 },
      region: "header",
      valueText: hex0x(page.header.pd_flags),
    }),
    field({
      id: "header.pd_lower",
      label: "lower",
      fullLabel: "pd_lower",
      range: { start: 12, end: 14 },
      region: "header",
      valueText: String(page.header.pd_lower),
    }),
    field({
      id: "header.pd_upper",
      label: "upper",
      fullLabel: "pd_upper",
      range: { start: 14, end: 16 },
      region: "header",
      valueText: String(page.header.pd_upper),
    }),
    field({
      id: "header.pd_special",
      label: "special",
      fullLabel: "pd_special",
      range: { start: 16, end: 18 },
      region: "header",
      valueText: String(page.header.pd_special),
    }),
    field({
      id: "header.pd_pagesize_version",
      label: "psz/ver",
      fullLabel: "pd_pagesize_version",
      range: { start: 18, end: 20 },
      region: "header",
      valueText: `${page.header.pageSize}/${page.header.pageVersion}`,
    }),
    field({
      id: "header.pd_prune_xid",
      label: "prune_xid",
      fullLabel: "pd_prune_xid",
      range: { start: 20, end: PAGE_HEADER_SIZE },
      region: "header",
      valueText: String(page.header.pd_prune_xid),
    }),
  );

  for (const item of page.itemIds) {
    const parentId = `itemid-${item.index}`;
    out.push(
      field({
        id: parentId,
        label: `ItemId[${item.index}]`,
        fullLabel: `ItemId[${item.index}] ${item.status} off=${item.offset} len=${item.length}`,
        range: item.range,
        region: "itemid",
        valueText: `off=${item.offset} len=${item.length}`,
      }),
      field({
        id: `${parentId}.off`,
        label: "off",
        fullLabel: `ItemId[${item.index}].lp_off`,
        range: item.range,
        region: "itemid",
        parentId,
        visualOnly: true,
        valueText: String(item.offset),
      }),
      field({
        id: `${parentId}.flag`,
        label: "flag",
        fullLabel: `ItemId[${item.index}].lp_flags (${item.status})`,
        range: item.range,
        region: "itemid",
        parentId,
        visualOnly: true,
        valueText: hex0x(item.flags),
      }),
      field({
        id: `${parentId}.len`,
        label: "len",
        fullLabel: `ItemId[${item.index}].lp_len`,
        range: item.range,
        region: "itemid",
        parentId,
        visualOnly: true,
        valueText: String(item.length),
      }),
    );
  }

  if (page.freeSpace.bytes > 0 || page.freeSpace.range.end > page.freeSpace.range.start) {
    out.push(
      field({
        id: "free",
        label: "free space",
        fullLabel: `free space [${page.freeSpace.range.start}..${page.freeSpace.range.end}) · ${page.freeSpace.bytes} bytes`,
        range: page.freeSpace.range,
        region: "free",
      }),
    );
  }

  for (const t of page.tuples) {
    const base = t.range.start;
    const prefix = `tuple-${t.itemIndex}`;
    out.push(
      field({
        id: `${prefix}.t_xmin`,
        label: "xmin",
        fullLabel: `tuple lp[${t.itemIndex}].t_xmin`,
        range: { start: base, end: base + 4 },
        region: "tuple",
        valueText: String(t.header.t_xmin),
      }),
      field({
        id: `${prefix}.t_xmax`,
        label: "xmax",
        fullLabel: `tuple lp[${t.itemIndex}].t_xmax`,
        range: { start: base + 4, end: base + 8 },
        region: "tuple",
        valueText: String(t.header.t_xmax),
      }),
      field({
        id: `${prefix}.t_cid`,
        label: "cid",
        fullLabel: `tuple lp[${t.itemIndex}].t_cid`,
        range: { start: base + 8, end: base + 12 },
        region: "tuple",
        valueText: String(t.header.t_cid),
      }),
      field({
        id: `${prefix}.t_ctid`,
        label: "ctid",
        fullLabel: `tuple lp[${t.itemIndex}].t_ctid`,
        range: { start: base + 12, end: base + 18 },
        region: "tuple",
        valueText: `(${t.header.t_ctid.blockNumber},${t.header.t_ctid.offsetNumber})`,
      }),
      field({
        id: `${prefix}.t_infomask2`,
        label: "infomask2",
        fullLabel: `tuple lp[${t.itemIndex}].t_infomask2`,
        range: { start: base + 18, end: base + 20 },
        region: "tuple",
        valueText: hex0x(t.header.t_infomask2),
      }),
      field({
        id: `${prefix}.t_infomask`,
        label: "infomask",
        fullLabel: `tuple lp[${t.itemIndex}].t_infomask`,
        range: { start: base + 20, end: base + 22 },
        region: "tuple",
        valueText: hex0x(t.header.t_infomask),
      }),
      field({
        id: `${prefix}.t_hoff`,
        label: "hoff",
        fullLabel: `tuple lp[${t.itemIndex}].t_hoff`,
        range: { start: base + 22, end: base + 23 },
        region: "tuple",
        valueText: String(t.header.t_hoff),
      }),
    );

    if (t.header.t_hoff > 23) {
      out.push(
        field({
          id: `${prefix}.nullbitmap`,
          label: "nullbits",
          fullLabel: `tuple lp[${t.itemIndex}] null bitmap / header pad`,
          range: { start: base + 23, end: base + t.header.t_hoff },
          region: "tuple",
        }),
      );
    }

    const colFields = (t.columns ?? [])
      .filter((col) => col.range && col.range.end > col.range.start)
      .map((col) => ({ col, range: col.range! }))
      .sort((a, b) => a.range.start - b.range.start);

    if (colFields.length > 0) {
      // Fold MAXALIGN padding into the following column. A sibling "data" cell
      // on the same 32B row overlaps a/b in CSS grid and paints a second row
      // of "data" under the values.
      let cursor = t.dataRange.start;
      for (const { col, range } of colFields) {
        const visualStart = Math.min(range.start, Math.max(cursor, t.dataRange.start));
        if (range.end <= visualStart) continue;
        out.push(
          field({
            id: `${prefix}.col-${col.attnum}`,
            label: col.name,
            fullLabel: `tuple lp[${t.itemIndex}].${col.name} (#${col.attnum} ${col.typeName})`,
            range: { start: visualStart, end: range.end },
            region: "tuple",
            valueText: columnValueText(col),
          }),
        );
        cursor = Math.max(cursor, range.end);
      }
    } else if (t.dataRange.end > t.dataRange.start) {
      out.push(
        field({
          id: `${prefix}.data`,
          label: "data",
          fullLabel: `tuple lp[${t.itemIndex}] user data`,
          range: t.dataRange,
          region: "tuple",
        }),
      );
    }
  }

  return out;
}

/** Most specific non-visual field containing `offset`, or null. */
export function resolveFieldAt(page: ParsedPage, offset: number): StructureField | null {
  const fields = deriveStructureFields(page).filter((f) => !f.visualOnly);
  let best: StructureField | null = null;
  let bestSpan = Number.POSITIVE_INFINITY;
  for (const f of fields) {
    if (offset >= f.range.start && offset < f.range.end) {
      const span = f.range.end - f.range.start;
      if (span < bestSpan) {
        best = f;
        bestSpan = span;
      }
    }
  }
  return best;
}

export function splitFieldIntoRowSegments(
  field: Pick<StructureField, "id" | "range">,
  bytesPerRow: number = STRUCTURE_BYTES_PER_ROW,
): RowSegment[] {
  const { start, end } = field.range;
  if (end <= start) return [];
  const segments: RowSegment[] = [];
  let cursor = start;
  while (cursor < end) {
    const row = Math.floor(cursor / bytesPerRow);
    const rowStart = row * bytesPerRow;
    const rowEnd = rowStart + bytesPerRow;
    const segEnd = Math.min(end, rowEnd);
    segments.push({
      fieldId: field.id,
      row,
      colStart: cursor - rowStart,
      colEnd: segEnd - rowStart,
      range: { start: cursor, end: segEnd },
    });
    cursor = segEnd;
  }
  return segments;
}

/** Resolve selection target for an ItemId visual child → parent 4B field. */
export function selectionTargetForField(
  fields: StructureField[],
  fieldId: string,
): StructureField | null {
  const f = fields.find((x) => x.id === fieldId);
  if (!f) return null;
  if (f.visualOnly && f.parentId) {
    return fields.find((x) => x.id === f.parentId) ?? f;
  }
  return f;
}

/**
 * Characters that fit in a field cell of `spanBytes` columns (DOM-agnostic).
 * Deducts padding/border and a 1-character safety margin.
 */
export function cellCapacityChars(spanBytes: number, metrics: CellMetrics): number {
  if (spanBytes <= 0 || metrics.charWidthPx <= 0) return 0;
  const contentPx =
    spanBytes * metrics.byteColWidthPx - metrics.cellPaddingXPx - metrics.cellBorderXPx;
  const raw = Math.floor(contentPx / metrics.charWidthPx);
  return Math.max(0, raw - 1);
}

/**
 * Choose value vs label mode from character budget.
 * `label` should already be the abbreviated form used in the cell.
 */
export function chooseCellContent(args: {
  label: string;
  valueText?: string;
  capacityChars: number;
}): CellContentChoice {
  const { label, valueText, capacityChars } = args;
  if (valueText == null || valueText.length > capacityChars) {
    return { mode: "label" };
  }
  return { mode: "value", showLabel: label.length <= capacityChars };
}

/**
 * Hex scroll geometry: target scrollTop for placing first highlighted row near
 * `anchorRatio` from the top, or null when that row is already fully visible.
 *
 * `rowGapPx` / `paddingTopPx` must match the scroll container's CSS flex gap and
 * padding-top so row Y matches layout (DEF-001: naive `row * height` under-scrolls).
 */
export function computeHexScrollTarget(args: {
  firstRow: number;
  lastRow: number;
  rowHeightPx: number;
  containerHeightPx: number;
  contentHeightPx: number;
  currentScrollTop: number;
  anchorRatio?: number;
  /** Vertical gap between hex rows (e.g. `.hex { gap: 1px }`). Default 0. */
  rowGapPx?: number;
  /** Content inset above the first row (e.g. `.hex` padding-top). Default 0. */
  paddingTopPx?: number;
}): number | null {
  const {
    firstRow,
    lastRow,
    rowHeightPx,
    containerHeightPx,
    contentHeightPx,
    currentScrollTop,
    anchorRatio = 1 / 3,
    rowGapPx = 0,
    paddingTopPx = 0,
  } = args;

  if (rowHeightPx <= 0 || containerHeightPx <= 0) return null;

  const stride = rowHeightPx + Math.max(0, rowGapPx);
  const inset = Math.max(0, paddingTopPx);
  const rangeTop = inset + firstRow * stride;
  const rangeBottom = inset + lastRow * stride + rowHeightPx;
  const firstRowBottom = rangeTop + rowHeightPx;
  const viewBottom = currentScrollTop + containerHeightPx;

  if (rangeTop >= currentScrollTop && firstRowBottom <= viewBottom) {
    return null;
  }

  const maxScroll = Math.max(0, contentHeightPx - containerHeightPx);
  let target = rangeTop - anchorRatio * containerHeightPx;
  target = Math.min(Math.max(target, 0), maxScroll);

  const rangeHeight = rangeBottom - rangeTop;
  if (rangeHeight <= containerHeightPx) {
    const minToShowBottom = rangeBottom - containerHeightPx;
    const maxToKeepTop = rangeTop;
    target = Math.min(Math.max(target, minToShowBottom), maxToKeepTop);
    target = Math.min(Math.max(target, 0), maxScroll);
  }

  return target;
}

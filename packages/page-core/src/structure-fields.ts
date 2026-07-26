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
};

export type RowSegment = {
  fieldId: string;
  row: number;
  colStart: number;
  colEnd: number;
  range: ByteRange;
};

function field(
  partial: Omit<StructureField, "fullLabel"> & { fullLabel?: string },
): StructureField {
  return {
    ...partial,
    fullLabel: partial.fullLabel ?? partial.label,
  };
}

/**
 * Derive clickable structure-diagram fields from a parsed page.
 * Does not mutate `page` or change parse/decode semantics.
 */
export function deriveStructureFields(page: ParsedPage): StructureField[] {
  const out: StructureField[] = [];

  out.push(
    field({
      id: "header.pd_lsn.xlogid",
      label: "xlogid",
      fullLabel: "pd_lsn.xlogid",
      range: { start: 0, end: 4 },
      region: "header",
    }),
    field({
      id: "header.pd_lsn.xrecoff",
      label: "xrecoff",
      fullLabel: "pd_lsn.xrecoff",
      range: { start: 4, end: 8 },
      region: "header",
    }),
    field({
      id: "header.pd_checksum",
      label: "checksum",
      fullLabel: "pd_checksum",
      range: { start: 8, end: 10 },
      region: "header",
    }),
    field({
      id: "header.pd_flags",
      label: "flags",
      fullLabel: "pd_flags",
      range: { start: 10, end: 12 },
      region: "header",
    }),
    field({
      id: "header.pd_lower",
      label: "pd_lower",
      range: { start: 12, end: 14 },
      region: "header",
    }),
    field({
      id: "header.pd_upper",
      label: "pd_upper",
      range: { start: 14, end: 16 },
      region: "header",
    }),
    field({
      id: "header.pd_special",
      label: "special",
      fullLabel: "pd_special",
      range: { start: 16, end: 18 },
      region: "header",
    }),
    field({
      id: "header.pd_pagesize_version",
      label: "pagesize/ver",
      fullLabel: "pd_pagesize_version",
      range: { start: 18, end: 20 },
      region: "header",
    }),
    field({
      id: "header.pd_prune_xid",
      label: "prune_xid",
      fullLabel: "pd_prune_xid",
      range: { start: 20, end: PAGE_HEADER_SIZE },
      region: "header",
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
      }),
      field({
        id: `${parentId}.off`,
        label: "off",
        fullLabel: `ItemId[${item.index}].lp_off`,
        range: item.range,
        region: "itemid",
        parentId,
        visualOnly: true,
      }),
      field({
        id: `${parentId}.flag`,
        label: "flag",
        fullLabel: `ItemId[${item.index}].lp_flags (${item.status})`,
        range: item.range,
        region: "itemid",
        parentId,
        visualOnly: true,
      }),
      field({
        id: `${parentId}.len`,
        label: "len",
        fullLabel: `ItemId[${item.index}].lp_len`,
        range: item.range,
        region: "itemid",
        parentId,
        visualOnly: true,
      }),
    );
    void ITEM_ID_SIZE;
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
      }),
      field({
        id: `${prefix}.t_xmax`,
        label: "xmax",
        fullLabel: `tuple lp[${t.itemIndex}].t_xmax`,
        range: { start: base + 4, end: base + 8 },
        region: "tuple",
      }),
      field({
        id: `${prefix}.t_cid`,
        label: "cid",
        fullLabel: `tuple lp[${t.itemIndex}].t_cid`,
        range: { start: base + 8, end: base + 12 },
        region: "tuple",
      }),
      field({
        id: `${prefix}.t_ctid`,
        label: "ctid",
        fullLabel: `tuple lp[${t.itemIndex}].t_ctid`,
        range: { start: base + 12, end: base + 18 },
        region: "tuple",
      }),
      field({
        id: `${prefix}.t_infomask2`,
        label: "infomask2",
        fullLabel: `tuple lp[${t.itemIndex}].t_infomask2`,
        range: { start: base + 18, end: base + 20 },
        region: "tuple",
      }),
      field({
        id: `${prefix}.t_infomask`,
        label: "infomask",
        fullLabel: `tuple lp[${t.itemIndex}].t_infomask`,
        range: { start: base + 20, end: base + 22 },
        region: "tuple",
      }),
      field({
        id: `${prefix}.t_hoff`,
        label: "hoff",
        fullLabel: `tuple lp[${t.itemIndex}].t_hoff`,
        range: { start: base + 22, end: base + 23 },
        region: "tuple",
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

    const covered = new Set<string>();
    if (t.columns) {
      for (const col of t.columns) {
        if (!col.range || col.range.end <= col.range.start) continue;
        const id = `${prefix}.col-${col.attnum}`;
        covered.add(`${col.range.start}:${col.range.end}`);
        out.push(
          field({
            id,
            label: col.name,
            fullLabel: `tuple lp[${t.itemIndex}].${col.name} (#${col.attnum} ${col.typeName})`,
            range: col.range,
            region: "tuple",
          }),
        );
      }
    }

    // Remaining user data not covered by column ranges
    if (t.dataRange.end > t.dataRange.start) {
      const dataKey = `${t.dataRange.start}:${t.dataRange.end}`;
      if (!covered.has(dataKey) && (!t.columns || t.columns.length === 0)) {
        out.push(
          field({
            id: `${prefix}.data`,
            label: "data",
            fullLabel: `tuple lp[${t.itemIndex}] user data`,
            range: t.dataRange,
            region: "tuple",
          }),
        );
      } else if (t.columns && t.columns.length > 0) {
        // Fill gaps in data range not covered by columns
        const colRanges = t.columns
          .filter((c) => c.range && c.range.end > c.range.start)
          .map((c) => c.range!)
          .sort((a, b) => a.start - b.start);
        let cursor = t.dataRange.start;
        let gapIndex = 0;
        for (const r of colRanges) {
          if (r.start > cursor) {
            out.push(
              field({
                id: `${prefix}.data-gap-${gapIndex++}`,
                label: "data",
                fullLabel: `tuple lp[${t.itemIndex}] padding/unknown data`,
                range: { start: cursor, end: r.start },
                region: "tuple",
              }),
            );
          }
          cursor = Math.max(cursor, r.end);
        }
        if (cursor < t.dataRange.end) {
          out.push(
            field({
              id: `${prefix}.data-gap-${gapIndex}`,
              label: "data",
              fullLabel: `tuple lp[${t.itemIndex}] trailing data`,
              range: { start: cursor, end: t.dataRange.end },
              region: "tuple",
            }),
          );
        }
      }
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

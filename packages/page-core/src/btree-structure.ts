/**
 * Structure-field derivation for B-tree index pages — same shape as the heap
 * `deriveStructureFields` so the structure map / hex linkage / diff can consume
 * both without branching on page kind (design §3).
 */
import type { ParsedBtreePage, BtreeIndexTuple } from "./btree.js";
import type { StructureField } from "./structure-fields.js";
import { PAGE_HEADER_SIZE } from "./parse.js";

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

function tidText(t: { blockNumber: number; offsetNumber: number }): string {
  return `(${t.blockNumber},${t.offsetNumber})`;
}

function headerFields(page: ParsedBtreePage, out: StructureField[]): void {
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
}

function itemIdFields(page: ParsedBtreePage, out: StructureField[]): void {
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
}

function tupleMarkerText(t: BtreeIndexTuple): string {
  const marks: string[] = [];
  if (t.isHikey) marks.push("hikey");
  if (t.isPosting) marks.push(`posting ×${t.postingCount ?? "?"}`);
  else if (t.isPivot) marks.push("pivot");
  return marks.length > 0 ? ` · ${marks.join(" · ")}` : "";
}

function tupleFields(page: ParsedBtreePage, out: StructureField[]): void {
  for (const t of page.tuples) {
    const prefix = `tuple-${t.lpIndex}`;
    const base = t.range.start;
    out.push(
      field({
        id: `${prefix}.t_tid`,
        label: "t_tid",
        fullLabel: `itup lp[${t.lpIndex}].t_tid`,
        range: { start: base, end: base + 6 },
        region: "tuple",
        valueText: tidText(t.t_tid),
      }),
      field({
        id: `${prefix}.t_info`,
        label: "t_info",
        fullLabel: `itup lp[${t.lpIndex}].t_info`,
        range: { start: base + 6, end: base + 8 },
        region: "tuple",
        valueText: hex0x(t.t_info),
      }),
    );
    if (t.keyRange.end > t.keyRange.start) {
      out.push(
        field({
          id: `${prefix}.key`,
          label: "key",
          fullLabel: `itup lp[${t.lpIndex}] key bytes${tupleMarkerText(t)}`,
          range: t.keyRange,
          region: "tuple",
        }),
      );
    }
    if (t.isPosting && t.postingTids) {
      const tidsStart = t.range.start + (t.postingOffset ?? 0);
      out.push(
        field({
          id: `${prefix}.posting-tids`,
          label: `tids×${t.postingCount}`,
          fullLabel: `itup lp[${t.lpIndex}] posting list (${t.postingCount} heap TIDs)`,
          range: { start: tidsStart, end: tidsStart + t.postingCount! * 6 },
          region: "tuple",
        }),
      );
    }
  }
}

function specialFields(page: ParsedBtreePage, out: StructureField[]): void {
  const sp = page.special;
  if (!sp) return;
  const s = sp.range.start;
  out.push(
    field({
      id: "special.btpo_prev",
      label: "btpo_prev",
      fullLabel: "special.btpo_prev (left sibling block)",
      range: { start: s, end: s + 4 },
      region: "special",
      valueText: String(sp.btpo_prev),
    }),
    field({
      id: "special.btpo_next",
      label: "btpo_next",
      fullLabel: "special.btpo_next (right sibling block)",
      range: { start: s + 4, end: s + 8 },
      region: "special",
      valueText: String(sp.btpo_next),
    }),
    field({
      id: "special.btpo_level",
      label: "btpo_level",
      fullLabel: "special.btpo_level",
      range: { start: s + 8, end: s + 12 },
      region: "special",
      valueText: String(sp.btpo_level),
    }),
    field({
      id: "special.btpo_flags",
      label: "btpo_flags",
      fullLabel: "special.btpo_flags",
      range: { start: s + 12, end: s + 14 },
      region: "special",
      valueText: hex0x(sp.btpo_flags),
    }),
    field({
      id: "special.btpo_cycleid",
      label: "btpo_cycleid",
      fullLabel: "special.btpo_cycleid",
      range: { start: s + 14, end: s + 16 },
      region: "special",
      valueText: String(sp.btpo_cycleid),
    }),
  );
}

function metaFields(page: ParsedBtreePage, out: StructureField[]): void {
  const m = page.meta;
  if (!m) return;
  const c = 24; // PageGetContents of the metapage
  out.push(
    field({
      id: "meta.btm_magic",
      label: "btm_magic",
      fullLabel: "metapage.btm_magic",
      range: { start: c, end: c + 4 },
      region: "meta",
      valueText: hex0x(m.btm_magic),
    }),
    field({
      id: "meta.btm_version",
      label: "btm_version",
      fullLabel: "metapage.btm_version",
      range: { start: c + 4, end: c + 8 },
      region: "meta",
      valueText: String(m.btm_version),
    }),
    field({
      id: "meta.btm_root",
      label: "btm_root",
      fullLabel: "metapage.btm_root (root block)",
      range: { start: c + 8, end: c + 12 },
      region: "meta",
      valueText: String(m.btm_root),
    }),
    field({
      id: "meta.btm_level",
      label: "btm_level",
      fullLabel: "metapage.btm_level",
      range: { start: c + 12, end: c + 16 },
      region: "meta",
      valueText: String(m.btm_level),
    }),
    field({
      id: "meta.btm_fastroot",
      label: "btm_fastroot",
      fullLabel: "metapage.btm_fastroot (fast root block)",
      range: { start: c + 16, end: c + 20 },
      region: "meta",
      valueText: String(m.btm_fastroot),
    }),
    field({
      id: "meta.btm_fastlevel",
      label: "btm_fastlevel",
      fullLabel: "metapage.btm_fastlevel",
      range: { start: c + 20, end: c + 24 },
      region: "meta",
      valueText: String(m.btm_fastlevel),
    }),
  );
  if (m.btm_allequalimage !== undefined) {
    out.push(
      field({
        id: "meta.btm_allequalimage",
        label: "aei",
        fullLabel: "metapage.btm_allequalimage",
        range: { start: c + 40, end: c + 41 },
        region: "meta",
        valueText: m.btm_allequalimage ? "true" : "false",
      }),
    );
  }
}

/**
 * Derive clickable structure-diagram fields from a parsed B-tree page.
 * Does not mutate `page`. Same-field ids as heap pages for the shared
 * header/itemid/free regions.
 */
export function deriveBtreeStructureFields(page: ParsedBtreePage): StructureField[] {
  const out: StructureField[] = [];
  headerFields(page, out);
  itemIdFields(page, out);
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
  tupleFields(page, out);
  specialFields(page, out);
  metaFields(page, out);
  return out;
}

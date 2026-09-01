/**
 * Pure input-side + meta-bar helpers for the index (B-tree) relation kind.
 * UI strings are frozen against ui-design.md (index-viewer); keep verbatim.
 */
import type { ParsedBtreePage } from "page-core";

/** Structural subset of api.IndexRow (keeps helpers unit-testable). */
export type IndexRowLike = {
  oid: number;
  qualifiedName: string;
  accessMethod: string;
  blocks: number;
  tableOid: number;
  tableQualifiedName: string;
  valid: boolean;
};

export function isBtreeIndex(idx: IndexRowLike | null): boolean {
  return idx != null && idx.accessMethod === "btree";
}

/** P0-2: non-B-tree indexes stay selectable but Load must never fire. */
export function canLoadIndex(idx: IndexRowLike | null): boolean {
  return isBtreeIndex(idx);
}

/** Change-2 annex 2: null ("All tables") keeps the full list; otherwise tableOid match. */
export function filterIndexesByTable(
  indexes: IndexRowLike[],
  tableOid: number | null,
): IndexRowLike[] {
  if (tableOid == null) return indexes;
  return indexes.filter((i) => i.tableOid === tableOid);
}

/**
 * Change-2 annex 2 rule 1: does the current index selection survive the new
 * (filtered) list? false => reset the selection along with the page view.
 */
export function indexSelectionSurvives(
  selectedIndexOid: number | null,
  filtered: IndexRowLike[],
): boolean {
  if (selectedIndexOid == null) return true;
  return filtered.some((i) => i.oid === selectedIndexOid);
}

/** Options drop the "→ owning table" suffix while filtering by one table (annex 2 rule 5). */
export type IndexOptionMode = { omitTableSuffix?: boolean };

export function formatIndexOption(idx: IndexRowLike, mode?: IndexOptionMode): string {
  const table = mode?.omitTableSuffix ? "" : ` · → ${idx.tableQualifiedName}`;
  const tail = `${idx.qualifiedName} (${idx.accessMethod} · ${idx.blocks} blk${table})`;
  const prefix = isBtreeIndex(idx) ? "" : "✕ ";
  const suffix = idx.valid ? "" : " · invalid";
  return `${prefix}${tail}${suffix}`;
}

export function indexOptionTitle(idx: IndexRowLike, mode?: IndexOptionMode): string {
  if (!isBtreeIndex(idx)) return `${idx.accessMethod}: only B-tree index pages are supported`;
  if (!idx.valid) return "indisvalid=false; loadable for inspection only";
  return mode?.omitTableSuffix
    ? idx.qualifiedName
    : `${idx.qualifiedName} · → ${idx.tableQualifiedName}`;
}

export function nonBtreeHint(idx: IndexRowLike | null): string | null {
  if (idx == null || isBtreeIndex(idx)) return null;
  return `${idx.accessMethod} index page parsing is not supported — B-tree only. Pick a B-tree index or switch back to a table.`;
}

/** Page-type badge text + P1-2 status chips derived from btpo_flags. */
export function pageTypeBadge(page: ParsedBtreePage): { text: string; chips: string[] } {
  const text =
    page.pageType === "meta"
      ? "meta"
      : page.pageType === "internal"
        ? `internal·L${page.special?.btpo_level ?? 0}`
        : "leaf";
  const chips: string[] = [];
  if (page.flags.isRoot) chips.push("root");
  if (page.flags.deleted) chips.push("deleted");
  if (page.flags.halfDead) chips.push("half-dead");
  if (page.flags.hasGarbage) chips.push("garbage");
  if (page.flags.incompleteSplit) chips.push("split-unfinished");
  return { text, chips };
}

export function levelText(page: ParsedBtreePage): string {
  if (page.pageType === "meta") return "—";
  return String(page.special?.btpo_level ?? 0);
}

/**
 * Pure input-side + meta-bar helpers for the index (B-tree) relation kind.
 * UI strings are frozen against ui-design.md (index-viewer); keep verbatim.
 */
import type { ParsedBtreePage } from "page-core";

/** Structural subset of api.IndexRow (keeps helpers unit-testable). */
export type IndexRowLike = {
  qualifiedName: string;
  accessMethod: string;
  blocks: number;
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

export function formatIndexOption(idx: IndexRowLike): string {
  const tail = `${idx.qualifiedName} (${idx.accessMethod} · ${idx.blocks} blk · → ${idx.tableQualifiedName})`;
  const prefix = isBtreeIndex(idx) ? "" : "✕ ";
  const suffix = idx.valid ? "" : " · invalid";
  return `${prefix}${tail}${suffix}`;
}

export function indexOptionTitle(idx: IndexRowLike): string {
  if (!isBtreeIndex(idx)) return `${idx.accessMethod}: only B-tree index pages are supported`;
  if (!idx.valid) return "indisvalid=false; loadable for inspection only";
  return `${idx.qualifiedName} · → ${idx.tableQualifiedName}`;
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

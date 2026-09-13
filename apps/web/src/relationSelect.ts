/**
 * Pure helpers for the single-mode relation picker (spec: single-relation-select).
 * Kept dependency-light so the option text and the auto-load gate are unit-testable.
 */
import type { TableRow } from "./api";

/** Spec §2: `<qualifiedName> (oid <oid> · <blocks> blk)`. */
export function formatTableOption(t: TableRow): string {
  return `${t.qualifiedName} (oid ${t.oid} · ${t.blocks} blk)`;
}

/** Spec §2/§3: only relations with at least one block auto-load on pick. */
export function shouldAutoLoadRelation(blocks: number): boolean {
  return blocks > 0;
}

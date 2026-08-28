/**
 * Block navigation + heap-jump helpers (index-viewer T8, P1-1/P1-3).
 * Same-index navigation loads via loadIndexBlk; heap TID jumps switch the
 * relation kind to the owning table (design §3 jumpToHeap).
 */
import { P_NONE } from "page-core";
import type { AppError, TableRow } from "./api";

export type SiblingNav = {
  /** Left sibling block, or null when btpo_prev == P_NONE. */
  prev: number | null;
  /** Right sibling block, or null when btpo_next == P_NONE. */
  next: number | null;
  /** "leftmost" annotation when prev is P_NONE. */
  prevNote: string | null;
  /** "rightmost" annotation when next is P_NONE. */
  nextNote: string | null;
};

export function siblingNav(special: { btpo_prev: number; btpo_next: number }): SiblingNav {
  return {
    prev: special.btpo_prev !== P_NONE ? special.btpo_prev : null,
    next: special.btpo_next !== P_NONE ? special.btpo_next : null,
    prevNote: special.btpo_prev === P_NONE ? "leftmost" : null,
    nextNote: special.btpo_next === P_NONE ? "rightmost" : null,
  };
}

/** Owning-table lookup for P1-3 jumps; null when hidden from the table list. */
export function resolveJumpTable(tables: TableRow[], tableOid: number): TableRow | null {
  return tables.find((t) => t.oid === tableOid) ?? null;
}

/** Readable feedback when the jump target table is not listed (never silent). */
export function heapJumpError(tableOid: number, tableQualifiedName?: string): AppError {
  const where = tableQualifiedName ? `（所属表 ${tableQualifiedName}）` : "";
  return {
    code: "TABLE_NOT_LISTED",
    message: `目标表不在表列表中：oid ${tableOid}${where}；可能位于系统 schema 或已被删除`,
    nextStep: "请切换到表并手动选择目标表。",
  };
}

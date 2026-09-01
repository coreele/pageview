/**
 * Pure detail-panel helpers for B-tree index pages (index-viewer T7).
 * Bit semantics follow the oracle-frozen constants in page-core/btree.ts
 * (dev-notes D1–D4): ALT=0x2000, VAR=0x4000, NULL=0x8000 (D2);
 * posting = ALT + ip_posid BT_IS_POSTING (D3); allequalimage @64, v4+ only (D1).
 */
import {
  INDEX_ALT_TID_MASK,
  INDEX_NULL_MASK,
  INDEX_VAR_MASK,
  type BtreeIndexTuple,
  type BtreeMetapage,
  type ByteRange,
  type ParsedBtreePage,
} from "page-core";

export type BytePreview = { hex: string; total: number; truncated: boolean };

const KEY_PREVIEW_BYTES = 64;

/** Key-byte preview: 64-byte truncation + full length (ui-design detail panel). */
export function formatBytesPreview(
  raw: Uint8Array,
  range: ByteRange,
  maxBytes: number = KEY_PREVIEW_BYTES,
): BytePreview {
  const total = Math.max(0, Math.min(range.end, raw.length) - range.start);
  const shown = Math.min(total, maxBytes);
  const parts: string[] = [];
  for (let i = 0; i < shown; i++) {
    parts.push(raw[range.start + i]!.toString(16).padStart(2, "0"));
  }
  return { hex: parts.join(" "), total, truncated: total > shown };
}

export type TInfoRow = { name: string; set: boolean; meaning: string };

/** t_info presented as "value + semantic rows" (size / ALT / VAR / NULL, D2/D3). */
export function tInfoRows(t: BtreeIndexTuple): TInfoRow[] {
  return [
    {
      name: "size",
      set: true,
      meaning: `IndexTupleSize = ${t.itemlen} B (t_info & 0x1fff)`,
    },
    {
      name: "INDEX_ALT_TID_MASK",
      set: (t.t_info & INDEX_ALT_TID_MASK) !== 0,
      meaning: t.isPosting
        ? "set — posting list: t_tid reinterpreted as TID count + list offset"
        : t.isPivot
          ? "set — pivot tuple: t_tid reinterpreted as pivot metadata (heap TID + attribute bits)"
          : "unset — t_tid is a plain pointer",
    },
    {
      name: "INDEX_VAR_MASK",
      set: (t.t_info & INDEX_VAR_MASK) !== 0 || t.hasVars,
      meaning: "variable-length key columns present (vars)",
    },
    {
      name: "INDEX_NULL_MASK",
      set: (t.t_info & INDEX_NULL_MASK) !== 0 || t.hasNulls,
      meaning: "key contains NULLs (nulls bitmap present)",
    },
  ];
}

export type TidRole =
  | { role: "child" }
  | { role: "heap" }
  | { role: "none"; note: string };

/** t_tid semantics by page type (P0-6/P1-3); overwritten fields never jump. */
export function tidRole(page: ParsedBtreePage, t: BtreeIndexTuple): TidRole {
  if (page.flags.deleted || page.flags.halfDead) {
    return {
      role: "none",
      note: "deleted / half-dead page: t_tid bytes are reused (non-pointer); jump disabled",
    };
  }
  if (t.isPosting) {
    return {
      role: "none",
      note: "posting tuple: t_tid encodes TID count and list offset; use the TID list rows below to jump",
    };
  }
  if (t.isPivot) {
    return {
      role: "none",
      note: "pivot tuple (e.g. hikey): t_tid is pivot metadata, not a jumpable pointer",
    };
  }
  if (page.pageType === "internal") return { role: "child" };
  if (page.pageType === "leaf") return { role: "heap" };
  return { role: "none", note: "no index tuples on metapage" };
}

export type MetapageRow = { key: string; value: string };

/** Six base fields; btm_allequalimage only when parsed (v4+, D1). */
export function metapageRows(meta: BtreeMetapage): MetapageRow[] {
  const rows: MetapageRow[] = [
    { key: "btm_magic", value: `0x${meta.btm_magic.toString(16)}` },
    { key: "btm_version", value: String(meta.btm_version) },
    { key: "btm_root", value: String(meta.btm_root) },
    { key: "btm_level", value: String(meta.btm_level) },
    { key: "btm_fastroot", value: String(meta.btm_fastroot) },
    { key: "btm_fastlevel", value: String(meta.btm_fastlevel) },
  ];
  if (meta.btm_allequalimage !== undefined) {
    rows.push({ key: "btm_allequalimage", value: String(meta.btm_allequalimage) });
  }
  return rows;
}

/** Resolve the selected B-tree index tuple from a `tuple-<lpIndex>.*` selection id. */
export function findTupleBySelection(
  page: ParsedBtreePage,
  selectedId: string | null,
): BtreeIndexTuple | undefined {
  if (!selectedId) return undefined;
  const m = /^tuple-(\d+)(?:\.|$)/.exec(selectedId);
  if (!m) return undefined;
  const lp = Number(m[1]);
  return page.tuples.find((t) => t.lpIndex === lp);
}

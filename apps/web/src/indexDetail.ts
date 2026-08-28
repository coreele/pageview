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
        ? "set — posting list：t_tid 重释为 TID 数 + 列表偏移（D3）"
        : t.isPivot
          ? "set — pivot 元组：t_tid 重释为 pivot 元数据（heap TID + 属性位）"
          : "unset — t_tid 为普通指针",
    },
    {
      name: "INDEX_VAR_MASK",
      set: (t.t_info & INDEX_VAR_MASK) !== 0 || t.hasVars,
      meaning: "可变长度键列存在（vars）",
    },
    {
      name: "INDEX_NULL_MASK",
      set: (t.t_info & INDEX_NULL_MASK) !== 0 || t.hasNulls,
      meaning: "键含 NULL（nulls 位图存在）",
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
      note: "deleted / half-dead 页：t_tid 字段被复用（非指针语义），不可跳转",
    };
  }
  if (t.isPosting) {
    return {
      role: "none",
      note: "posting 元组：t_tid 编码 TID 数与列表偏移，跳转请使用下方 TID 列表行",
    };
  }
  if (t.isPivot) {
    return {
      role: "none",
      note: "pivot 元组（如 hikey）：t_tid 为 pivot 元数据，非可跳转指针",
    };
  }
  if (page.pageType === "internal") return { role: "child" };
  if (page.pageType === "leaf") return { role: "heap" };
  return { role: "none", note: "metapage 无 index tuple" };
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

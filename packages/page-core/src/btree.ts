/**
 * B-tree index page parsing (PostgreSQL 16 nbtree layout).
 *
 * Self-contained module per design decision A: shares the physical page base
 * (PageHeaderData / ItemIdData / 8KB) with the heap parser, but never imports
 * heap tuple decoding. Layout constants are frozen against real captures ×
 * pageinspect oracle (see fixtures/btree-*.oracle.json and dev-notes.md);
 * authoritative cross-check: access/itup.h + access/nbtree.h (PG 16).
 */
import type { ByteRange, FlagBit, ItemId, ItemPointer, PageHeader } from "./types.js";
import {
  ITEM_ID_SIZE,
  PAGE_HEADER_SIZE,
  STANDARD_PAGE_SIZE,
  PageParseError,
  parseHeader,
  readItemId,
} from "./parse.js";
import { LP_DEAD, LP_NORMAL, LP_REDIRECT, LP_UNUSED } from "./flags.js";

// ---------------------------------------------------------------------------
// Frozen layout constants (oracle-verified; deviations from design §4 noted
// in workflow/docs/features/index-viewer/dev-notes.md)
// ---------------------------------------------------------------------------

/** BTREE_MAGIC (nbtree.h) — 0x053162 = 340322. */
export const BTREE_MAGIC = 0x053162;
/** Current btree on-disk version (v4 = heapkeyspace + dedup, PG 13+). */
export const BTREE_VERSION = 4;

/** BTPageOpaqueData size in bytes. */
export const BTREE_SPECIAL_SIZE = 16;
/** btpo_* offsets within the special space (at pd_special). */
export const BTPO_PREV_OFF = 0; // u32
export const BTPO_NEXT_OFF = 4; // u32
export const BTPO_LEVEL_OFF = 8; // u32
export const BTPO_FLAGS_OFF = 12; // u16
export const BTPO_CYCLEID_OFF = 14; // u16

/** PageGetContents of the metapage starts at MAXALIGN(PageHeaderSize) = 24. */
export const BTREE_METAPAGE_CONTENT_OFFSET = 24;
/** BTMetaPageData (PG 16) offsets relative to content start. */
export const BTM_MAGIC_OFF = 0; // u32
export const BTM_VERSION_OFF = 4; // u32
export const BTM_ROOT_OFF = 8; // u32 BlockNumber
export const BTM_LEVEL_OFF = 12; // u32
export const BTM_FASTROOT_OFF = 16; // u32 BlockNumber
export const BTM_FASTLEVEL_OFF = 20; // u32
// v3+ cleanup fields: btm_last_cleanup_num_delpages u32 @24 (abs 48) and
// btm_last_cleanup_num_heap_tuples float8 @28 (abs 56; 8-aligned, so abs 52–55 pad).
// D1 deviation: btm_allequalimage sits at abs 64 (design §4 expected 60).
export const BTM_ALLEQUALIMAGE_OFF = 40; // 1 byte bool; abs 64; v4+ only

/** IndexTupleData: t_tid (6B ItemPointerData) + t_info (u16). */
export const INDEX_TID_SIZE = 6;
export const INDEX_INFO_SIZE = 2;
export const INDEX_TUPLE_HEADER_SIZE = INDEX_TID_SIZE + INDEX_INFO_SIZE; // 8

/** t_info masks (itup.h). */
export const INDEX_SIZE_MASK = 0x1fff;
export const INDEX_ALT_TID_MASK = 0x2000; // t_tid reinterpreted (pivot or posting)
export const INDEX_VAR_MASK = 0x4000;
export const INDEX_NULL_MASK = 0x8000;

/** Pivot/posting status bits stored in t_tid.ip_posid (nbtree.h). */
export const BT_OFFSET_MASK = 0x0fff;
export const BT_STATUS_OFFSET_MASK = 0xf000;
export const BT_PIVOT_HEAP_TID_ATTR = 0x1000;
export const BT_IS_POSTING = 0x2000;

/** BTP_* bits in btpo_flags (nbtree.h). */
export const BTP_LEAF = 0x01;
export const BTP_ROOT = 0x02;
export const BTP_DELETED = 0x04;
export const BTP_META = 0x08;
export const BTP_HALF_DEAD = 0x10;
export const BTP_HAS_GARBAGE = 0x40;
export const BTP_INCOMPLETE_SPLIT = 0x80;
export const BTP_VALID_FLAG_BITS =
  BTP_LEAF | BTP_ROOT | BTP_DELETED | BTP_META | BTP_HALF_DEAD | BTP_HAS_GARBAGE | BTP_INCOMPLETE_SPLIT;

/** P_NONE: btpo_prev/next == 0 means no sibling. */
export const P_NONE = 0;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BtreePageType = "meta" | "internal" | "leaf";

export type BtreeSpecialSpace = {
  btpo_prev: number;
  btpo_next: number;
  btpo_level: number;
  btpo_flags: number;
  btpo_cycleid: number;
  range: ByteRange;
};

export type BtreeMetapage = {
  btm_magic: number;
  btm_version: number;
  btm_root: number;
  btm_level: number;
  btm_fastroot: number;
  btm_fastlevel: number;
  /** Only parsed for btm_version >= 4 (v3 pages predate dedup). */
  btm_allequalimage?: boolean;
};

export type BtreeIndexTuple = {
  /** 1-based, matches pageinspect bt_page_items.itemoffset. */
  itemoffset: number;
  /** 0-based ItemId slot index. */
  lpIndex: number;
  range: ByteRange;
  /** Raw t_tid (for pivot/posting tuples this is the reinterpreted field; matches bt_page_items.ctid). */
  t_tid: ItemPointer;
  t_info: number;
  /** IndexTupleSize == t_info & INDEX_SIZE_MASK (matches bt_page_items.itemlen). */
  itemlen: number;
  hasNulls: boolean;
  hasVars: boolean;
  isPivot: boolean;
  isPosting: boolean;
  isHikey: boolean;
  /** For posting tuples: TID array start offset within the tuple (from ip_blkid). */
  postingOffset?: number;
  postingCount?: number;
  /** TIDs in stored order — identical to bt_page_items.tids output. */
  postingTids?: ItemPointer[];
  keyRange: ByteRange;
};

export type BtreePageFlags = {
  isRoot: boolean;
  isRightmost: boolean;
  deleted: boolean;
  halfDead: boolean;
  hasGarbage: boolean;
  incompleteSplit: boolean;
};

export type BtreePageStats = {
  pageSize: number;
  pd_lower: number;
  pd_upper: number;
  freeBytes: number;
  itemIdTotal: number;
  lpUnused: number;
  lpNormal: number;
  lpRedirect: number;
  lpDead: number;
  tupleCount: number;
  postingTupleCount: number;
  postingTidCount: number;
};

export type ParsedBtreePage = {
  kind: "btree";
  pageType: BtreePageType;
  header: PageHeader;
  itemIds: ItemId[];
  freeSpace: { range: ByteRange; bytes: number };
  tuples: BtreeIndexTuple[];
  special: BtreeSpecialSpace | null;
  meta: BtreeMetapage | null;
  flags: BtreePageFlags;
  stats: BtreePageStats;
  warnings: string[];
  raw: Uint8Array;
};

// ---------------------------------------------------------------------------
// btpo_flags decoding
// ---------------------------------------------------------------------------

const BTP_FLAG_DEFS: Array<{ bit: number; name: string; meaning: string }> = [
  { bit: BTP_LEAF, name: "BTP_LEAF", meaning: "Leaf page (no child pages)" },
  { bit: BTP_ROOT, name: "BTP_ROOT", meaning: "Root page (has no parent)" },
  { bit: BTP_DELETED, name: "BTP_DELETED", meaning: "Page has been deleted from the tree" },
  { bit: BTP_META, name: "BTP_META", meaning: "Metapage (block 0)" },
  { bit: BTP_HALF_DEAD, name: "BTP_HALF_DEAD", meaning: "Empty, awaiting deletion (still in tree)" },
  { bit: BTP_HAS_GARBAGE, name: "BTP_HAS_GARBAGE", meaning: "Page has LP_DEAD item pointers" },
  { bit: BTP_INCOMPLETE_SPLIT, name: "BTP_INCOMPLETE_SPLIT", meaning: "Right sibling's downlink is missing" },
];

export function decodeBtpoFlags(value: number): FlagBit[] {
  const bits = BTP_FLAG_DEFS.map((d) => ({
    bit: d.bit,
    name: d.name,
    meaning: d.meaning,
    set: (value & d.bit) !== 0,
  }));
  const extra = value & ~BTP_VALID_FLAG_BITS;
  if (extra !== 0) {
    bits.push({
      bit: extra,
      name: "BTP_FLAGS_UNKNOWN",
      meaning: `Reserved/unknown bits set: 0x${extra.toString(16)}`,
      set: true,
    });
  }
  return bits;
}

// ---------------------------------------------------------------------------
// parseBtreePage
// ---------------------------------------------------------------------------

function readU16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function readU32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

function readItemPointer(view: DataView, offset: number): ItemPointer {
  const bi_hi = readU16(view, offset);
  const bi_lo = readU16(view, offset + 2);
  const posid = readU16(view, offset + 4);
  return { blockNumber: (bi_hi << 16) | bi_lo, offsetNumber: posid };
}

/**
 * Parse an 8KB B-tree index page (raw bytes from get_raw_page on an index).
 * Abnormal content (magic mismatch, out-of-range pointers) degrades to
 * `warnings`; only non-8KB input throws PageParseError.
 */
export function parseBtreePage(raw: Uint8Array): ParsedBtreePage {
  const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  if (bytes.length !== STANDARD_PAGE_SIZE) {
    throw new PageParseError(
      `Unsupported page size ${bytes.length}; only standard ${STANDARD_PAGE_SIZE}-byte pages are supported.`,
    );
  }
  const header = parseHeader(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const warnings: string[] = [];

  // ItemId array (same physical layout as heap pages)
  const itemIds: ItemId[] = [];
  {
    let offset = PAGE_HEADER_SIZE;
    let index = 0;
    while (offset + ITEM_ID_SIZE <= header.pd_lower) {
      itemIds.push(readItemId(view, offset, index));
      offset += ITEM_ID_SIZE;
      index += 1;
    }
  }

  const freeBytes = Math.max(0, header.pd_upper - header.pd_lower);

  // Special space (BTPageOpaqueData)
  let special: BtreeSpecialSpace | null = null;
  const sp = header.pd_special;
  if (sp >= PAGE_HEADER_SIZE && sp + BTREE_SPECIAL_SIZE <= STANDARD_PAGE_SIZE) {
    special = {
      btpo_prev: readU32(view, sp + BTPO_PREV_OFF),
      btpo_next: readU32(view, sp + BTPO_NEXT_OFF),
      btpo_level: readU32(view, sp + BTPO_LEVEL_OFF),
      btpo_flags: readU16(view, sp + BTPO_FLAGS_OFF),
      btpo_cycleid: readU16(view, sp + BTPO_CYCLEID_OFF),
      range: { start: sp, end: sp + BTREE_SPECIAL_SIZE },
    };
  } else {
    warnings.push(`Invalid pd_special ${sp}; special space unreadable.`);
  }

  // Page classification (design §4 / nbtree P_ISMETA semantics)
  const isMeta = special !== null && (special.btpo_flags & BTP_META) !== 0;
  let pageType: BtreePageType;
  if (isMeta) {
    pageType = "meta";
  } else if (special !== null && special.btpo_level > 0) {
    pageType = "internal";
  } else {
    pageType = "leaf";
  }

  // Metapage content (BTMetaPageData at PageGetContents)
  let meta: BtreeMetapage | null = null;
  if (isMeta) {
    const c = BTREE_METAPAGE_CONTENT_OFFSET;
    const m: BtreeMetapage = {
      btm_magic: readU32(view, c + BTM_MAGIC_OFF),
      btm_version: readU32(view, c + BTM_VERSION_OFF),
      btm_root: readU32(view, c + BTM_ROOT_OFF),
      btm_level: readU32(view, c + BTM_LEVEL_OFF),
      btm_fastroot: readU32(view, c + BTM_FASTROOT_OFF),
      btm_fastlevel: readU32(view, c + BTM_FASTLEVEL_OFF),
    };
    if (m.btm_magic !== BTREE_MAGIC) {
      warnings.push(
        `Metapage magic mismatch: got 0x${m.btm_magic.toString(16)}, expected 0x${BTREE_MAGIC.toString(16)}.`,
      );
    }
    if (m.btm_version > BTREE_VERSION) {
      warnings.push(`Unknown btm_version ${m.btm_version}; fields past v${BTREE_VERSION} are not interpreted.`);
    }
    if (m.btm_version >= 4) {
      m.btm_allequalimage = bytes[c + BTM_ALLEQUALIMAGE_OFF] !== 0;
    }
    meta = m;
  }

  // Index tuples from LP_NORMAL items (skip metapages: their content is
  // BTMetaPageData, not tuples)
  const tuples: BtreeIndexTuple[] = [];
  if (pageType !== "meta") {
    for (const item of itemIds) {
      if (item.flags !== LP_NORMAL || item.length === 0) continue;
      const end = item.offset + item.length;
      if (
        item.offset < PAGE_HEADER_SIZE ||
        item.offset + INDEX_TUPLE_HEADER_SIZE > end ||
        end > STANDARD_PAGE_SIZE
      ) {
        warnings.push(
          `ItemId[${item.index}] points at [${item.offset}..${end}) which is out of range; tuple skipped.`,
        );
        continue;
      }
      const t_tid = readItemPointer(view, item.offset);
      const t_info = readU16(view, item.offset + INDEX_TID_SIZE);
      const itemlen = t_info & INDEX_SIZE_MASK;
      const altTid = (t_info & INDEX_ALT_TID_MASK) !== 0;
      const isPosting = altTid && (t_tid.offsetNumber & BT_IS_POSTING) !== 0;
      const isPivot = altTid && !isPosting;

      const tuple: BtreeIndexTuple = {
        itemoffset: item.index + 1,
        lpIndex: item.index,
        range: { start: item.offset, end },
        t_tid,
        t_info,
        itemlen,
        hasNulls: (t_info & INDEX_NULL_MASK) !== 0,
        hasVars: (t_info & INDEX_VAR_MASK) !== 0,
        isPivot,
        isPosting,
        isHikey: false,
        keyRange: { start: item.offset + INDEX_TUPLE_HEADER_SIZE, end },
      };

      if (isPosting) {
        const postingOffset = t_tid.blockNumber; // ip_blkid = posting list offset within tuple
        const count = t_tid.offsetNumber & BT_OFFSET_MASK;
        tuple.postingOffset = postingOffset;
        tuple.postingCount = count;
        tuple.keyRange = {
          start: tuple.range.start + INDEX_TUPLE_HEADER_SIZE,
          end: tuple.range.start + postingOffset,
        };
        const tidsStart = tuple.range.start + postingOffset;
        if (tidsStart > tuple.range.end || tidsStart + count * 6 > tuple.range.end) {
          warnings.push(
            `ItemId[${item.index}] posting list [${tidsStart}..${tidsStart + count * 6}) exceeds tuple end ${tuple.range.end}; TIDs not decoded.`,
          );
        } else {
          const tids: ItemPointer[] = [];
          for (let i = 0; i < count; i++) {
            tids.push(readItemPointer(view, tidsStart + i * 6));
          }
          tuple.postingTids = tids;
        }
      }

      tuples.push(tuple);
    }
  }

  // Hikey: first LP_NORMAL tuple on a non-rightmost page (spec contract)
  const isRightmost = special === null || special.btpo_next === P_NONE;
  if (pageType !== "meta" && !isRightmost && tuples.length > 0) {
    tuples[0]!.isHikey = true;
  }

  const flags: BtreePageFlags = {
    isRoot: special !== null && (special.btpo_flags & BTP_ROOT) !== 0,
    isRightmost,
    deleted: special !== null && (special.btpo_flags & BTP_DELETED) !== 0,
    halfDead: special !== null && (special.btpo_flags & BTP_HALF_DEAD) !== 0,
    hasGarbage: special !== null && (special.btpo_flags & BTP_HAS_GARBAGE) !== 0,
    incompleteSplit: special !== null && (special.btpo_flags & BTP_INCOMPLETE_SPLIT) !== 0,
  };

  const postings = tuples.filter((t) => t.isPosting);
  const stats: BtreePageStats = {
    pageSize: header.pageSize,
    pd_lower: header.pd_lower,
    pd_upper: header.pd_upper,
    freeBytes,
    itemIdTotal: itemIds.length,
    lpUnused: itemIds.filter((i) => i.flags === LP_UNUSED).length,
    lpNormal: itemIds.filter((i) => i.flags === LP_NORMAL).length,
    lpRedirect: itemIds.filter((i) => i.flags === LP_REDIRECT).length,
    lpDead: itemIds.filter((i) => i.flags === LP_DEAD).length,
    tupleCount: tuples.length,
    postingTupleCount: postings.length,
    postingTidCount: postings.reduce((n, t) => n + (t.postingCount ?? 0), 0),
  };

  return {
    kind: "btree",
    pageType,
    header,
    itemIds,
    freeSpace: { range: { start: header.pd_lower, end: header.pd_upper }, bytes: freeBytes },
    tuples,
    special,
    meta,
    flags,
    stats,
    warnings,
    raw: bytes,
  };
}

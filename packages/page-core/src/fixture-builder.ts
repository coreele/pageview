/**
 * Build a minimal valid 8KB heap page for Vitest fixtures (PG 16 layout).
 * Not a full PG page writer — enough for header / ItemId / free / tuple tests.
 */
import {
  HEAP_HASNULL,
  HEAP_HASVARWIDTH,
  HEAP_HOT_UPDATED,
  HEAP_ONLY_TUPLE,
  HEAP_XMIN_COMMITTED,
  HEAP_XMAX_INVALID,
  LP_NORMAL,
  LP_REDIRECT,
  LP_UNUSED,
} from "./flags.js";
import { ITEM_ID_SIZE, PAGE_HEADER_SIZE, STANDARD_PAGE_SIZE } from "./parse.js";
import {
  BTP_LEAF,
  BTP_META,
  BTP_ROOT,
  BT_IS_POSTING,
  BT_OFFSET_MASK,
  BT_PIVOT_HEAP_TID_ATTR,
  BTREE_MAGIC,
  BTREE_METAPAGE_CONTENT_OFFSET,
  BTREE_SPECIAL_SIZE,
  INDEX_ALT_TID_MASK,
  INDEX_NULL_MASK,
  INDEX_VAR_MASK,
  P_NONE,
} from "./btree.js";

function writeU16(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >> 8) & 0xff;
}

function writeU32(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >> 8) & 0xff;
  buf[offset + 2] = (value >> 16) & 0xff;
  buf[offset + 3] = (value >> 24) & 0xff;
}

function writeItemId(buf: Uint8Array, offset: number, lpOff: number, flags: number, lpLen: number): void {
  const word = (lpOff & 0x7fff) | ((flags & 0x3) << 15) | ((lpLen & 0x7fff) << 17);
  writeU32(buf, offset, word);
}

function writeItemPointer(buf: Uint8Array, offset: number, block: number, pos: number): void {
  writeU16(buf, offset, (block >>> 16) & 0xffff);
  writeU16(buf, offset + 2, block & 0xffff);
  writeU16(buf, offset + 4, pos);
}

export type BuiltTuple = {
  xmin: number;
  xmax?: number;
  ctidBlock: number;
  ctidOffset: number;
  natts: number;
  infomask?: number;
  infomask2Extra?: number;
  /** user payload after header (already includes null bitmap padding into t_hoff) */
  payload: Uint8Array;
  hoff?: number;
};

function packTuple(t: BuiltTuple): Uint8Array {
  const hoff = t.hoff ?? 24;
  const body = new Uint8Array(hoff + t.payload.length);
  writeU32(body, 0, t.xmin);
  writeU32(body, 4, t.xmax ?? 0);
  writeU32(body, 8, 0);
  writeItemPointer(body, 12, t.ctidBlock, t.ctidOffset);
  const infomask2 = (t.natts & 0x07ff) | (t.infomask2Extra ?? 0);
  writeU16(body, 18, infomask2);
  writeU16(
    body,
    20,
    t.infomask ?? (HEAP_XMIN_COMMITTED | HEAP_XMAX_INVALID | HEAP_HASVARWIDTH),
  );
  body[22] = hoff;
  body.set(t.payload, hoff);
  return body;
}

export function buildSparsePage(options?: {
  currentBlkno?: number;
  withRedirect?: boolean;
  withHot?: boolean;
  crossBlockCtid?: boolean;
}): Uint8Array {
  const page = new Uint8Array(STANDARD_PAGE_SIZE);
  const blk = options?.currentBlkno ?? 0;

  // pd_pagesize_version: size/256 in high byte, version 4 low
  const pagesizeVersion = ((STANDARD_PAGE_SIZE / 256) << 8) | 4;
  writeU16(page, 18, pagesizeVersion);
  writeU16(page, 16, STANDARD_PAGE_SIZE); // pd_special at end

  const tuples: Uint8Array[] = [];

  // Tuple 1: int4 42 + text "hi" — simple common types
  // null bitmap none; hoff=24; int4 at 24; text short varlena
  const payload1 = new Uint8Array(8);
  writeU32(payload1, 0, 42);
  // short varlena text "hi": len=((2+1)<<1)|1 = 7, then bytes
  payload1[4] = (3 << 1) | 1;
  payload1[5] = "h".charCodeAt(0);
  payload1[6] = "i".charCodeAt(0);
  payload1[7] = 0;

  tuples.push(
    packTuple({
      xmin: 100,
      ctidBlock: options?.crossBlockCtid ? blk + 1 : blk,
      ctidOffset: options?.crossBlockCtid ? 1 : 1,
      natts: 2,
      infomask: HEAP_XMIN_COMMITTED | HEAP_XMAX_INVALID | HEAP_HASVARWIDTH,
      payload: payload1,
      hoff: 24,
    }),
  );

  if (options?.withHot) {
    const payload2 = new Uint8Array(4);
    writeU32(payload2, 0, 99);
    tuples.push(
      packTuple({
        xmin: 101,
        ctidBlock: blk,
        ctidOffset: 1,
        natts: 1,
        infomask: HEAP_XMIN_COMMITTED | HEAP_XMAX_INVALID,
        infomask2Extra: HEAP_ONLY_TUPLE | HEAP_HOT_UPDATED,
        payload: payload2,
        hoff: 24,
      }),
    );
  }

  // Place tuples from the end of the page
  let upper = STANDARD_PAGE_SIZE;
  const placements: Array<{ off: number; len: number }> = [];
  for (let i = tuples.length - 1; i >= 0; i--) {
    const t = tuples[i]!;
    upper -= t.length;
    // align to MAXALIGN 8
    upper = upper & ~7;
    page.set(t, upper);
    placements.unshift({ off: upper, len: t.length });
  }

  let itemCount = placements.length;
  if (options?.withRedirect) {
    itemCount += 1;
  }
  // optional unused slot
  const includeUnused = true;
  if (includeUnused) itemCount += 1;

  const pd_lower = PAGE_HEADER_SIZE + itemCount * ITEM_ID_SIZE;
  writeU16(page, 12, pd_lower);
  writeU16(page, 14, upper);

  let idOff = PAGE_HEADER_SIZE;
  let lineNo = 0;
  if (includeUnused) {
    writeItemId(page, idOff, 0, LP_UNUSED, 0);
    idOff += ITEM_ID_SIZE;
    lineNo++;
  }
  if (options?.withRedirect) {
    // redirect to first real tuple's line number (1-based OffsetNumber)
    const target = includeUnused ? 2 : 1;
    writeItemId(page, idOff, target, LP_REDIRECT, 0);
    idOff += ITEM_ID_SIZE;
    lineNo++;
  }
  for (const p of placements) {
    writeItemId(page, idOff, p.off, LP_NORMAL, p.len);
    idOff += ITEM_ID_SIZE;
    lineNo++;
  }
  void lineNo;

  return page;
}

export function buildEmptyishPage(): Uint8Array {
  const page = new Uint8Array(STANDARD_PAGE_SIZE);
  const pagesizeVersion = ((STANDARD_PAGE_SIZE / 256) << 8) | 4;
  writeU16(page, 18, pagesizeVersion);
  writeU16(page, 16, STANDARD_PAGE_SIZE);
  writeU16(page, 12, PAGE_HEADER_SIZE);
  writeU16(page, 14, STANDARD_PAGE_SIZE);
  return page;
}

// ---------------------------------------------------------------------------
// B-tree synthetic page builder (PG 16 nbtree layout; constants frozen vs
// pageinspect oracle — see btree.ts and fixtures/btree-*.oracle.json)
// ---------------------------------------------------------------------------

export type BuiltBtreeTuple = {
  tidBlock: number;
  tidOffset: number;
  /** key payload after the 8B IndexTupleData header (default 8 zero bytes) */
  keyBytes?: Uint8Array;
  nulls?: boolean;
  vars?: boolean;
  /** set INDEX_ALT_TID_MASK (pivot tuple, e.g. hikey/minus-inf downlink) */
  pivot?: boolean;
  /** posting list tuple (leaf): tidBlock/tidOffset ignored — the header encodes count + list offset */
  posting?: Array<{ blockNumber: number; offsetNumber: number }>;
  /**
   * index-key-decode: pivot with an explicit nkeyatts (ip_posid = nkeyatts,
   * direct per nbtree.h BTreeTupleSetNAtts). tidBlock is the downlink child
   * block; tidOffset is ignored.
   */
  pivotNKeyAtts?: number;
  /**
   * index-key-decode: trailing heap TID tiebreaker for pivots — sets
   * BT_PIVOT_HEAP_TID_ATTR and appends 6 packed bytes after the keys.
   */
  pivotHeapTid?: { blockNumber: number; offsetNumber: number };
  /**
   * index-key-decode: attnums considered PRESENT (non-NULL). Writes the
   * inverted index null bitmap (fixed 4B allocation, data at MAXALIGN(12)=16)
   * and sets INDEX_NULL_MASK.
   */
  presentAttnums?: number[];
};

export type BuildBtreePageOptions = {
  pageType?: "meta" | "internal" | "leaf";
  btpoPrev?: number;
  btpoNext?: number;
  btpoLevel?: number;
  /** replaces the computed btpo_flags (e.g. to test derived flags) */
  btpoFlagsOverride?: number;
  btpoCycleid?: number;
  metaVersion?: number;
  metaBadMagic?: boolean;
  metaRoot?: number;
  metaLevel?: number;
  metaFastRoot?: number;
  metaFastLevel?: number;
  metaAllequalimage?: boolean;
  tuples?: BuiltBtreeTuple[];
  /** append one LP_NORMAL ItemId pointing outside the page (warning case) */
  corruptLpOffset?: boolean;
};

function maxalign8(n: number): number {
  return (n + 7) & ~7;
}

function packIndexTuple(t: BuiltBtreeTuple): { body: Uint8Array } {
  const key = t.keyBytes ?? new Uint8Array(8);
  const dataIndex = t.presentAttnums !== undefined ? 16 : 8; // MAXALIGN(8+4)=16 with bitmap
  if (t.posting) {
    const postingOffset = dataIndex + key.length;
    const body = new Uint8Array(maxalign8(postingOffset + t.posting.length * 6));
    // t_tid reinterpreted: ip_blkid = posting list offset within the tuple,
    // ip_posid = TID count | BT_IS_POSTING (nbtree.h BTreeTupleSetPosting)
    writeU16(body, 0, (postingOffset >>> 16) & 0xffff);
    writeU16(body, 2, postingOffset & 0xffff);
    writeU16(body, 4, (t.posting.length | BT_IS_POSTING) & 0xffff);
    let o = postingOffset;
    for (const tid of t.posting) {
      writeU16(body, o, (tid.blockNumber >>> 16) & 0xffff);
      writeU16(body, o + 2, tid.blockNumber & 0xffff);
      writeU16(body, o + 4, tid.offsetNumber);
      o += 6;
    }
    let info = body.length | INDEX_ALT_TID_MASK;
    if (t.nulls || t.presentAttnums !== undefined) info |= INDEX_NULL_MASK;
    if (t.vars) info |= INDEX_VAR_MASK;
    writeU16(body, 6, info);
    writeInvertedBitmap(body, t.presentAttnums);
    body.set(key, dataIndex);
    return { body };
  }
  const heapTid = t.pivotHeapTid;
  const tail = heapTid ? 6 : 0;
  const body = new Uint8Array(
    t.pivotNKeyAtts !== undefined || t.presentAttnums !== undefined
      ? maxalign8(dataIndex + key.length + tail)
      : 8 + key.length,
  );
  let posid = 0;
  let altTid = false;
  if (t.pivotNKeyAtts !== undefined) {
    posid = t.pivotNKeyAtts & BT_OFFSET_MASK;
    if (heapTid) posid |= BT_PIVOT_HEAP_TID_ATTR;
    altTid = true;
  } else {
    posid = t.tidOffset;
    altTid = t.pivot === true;
  }
  writeU16(body, 0, (t.tidBlock >>> 16) & 0xffff);
  writeU16(body, 2, t.tidBlock & 0xffff);
  writeU16(body, 4, posid);
  let info = body.length;
  if (altTid) info |= INDEX_ALT_TID_MASK;
  if (t.nulls || t.presentAttnums !== undefined) info |= INDEX_NULL_MASK;
  if (t.vars) info |= INDEX_VAR_MASK;
  writeU16(body, 6, info);
  writeInvertedBitmap(body, t.presentAttnums);
  body.set(key, dataIndex);
  if (heapTid) {
    const o = dataIndex + key.length;
    writeU16(body, o, (heapTid.blockNumber >>> 16) & 0xffff);
    writeU16(body, o + 2, heapTid.blockNumber & 0xffff);
    writeU16(body, o + 4, heapTid.offsetNumber);
  }
  return { body };
}

/** Inverted index null bitmap: bits SET for present (non-NULL) attnums. */
function writeInvertedBitmap(body: Uint8Array, presentAttnums?: number[]): void {
  if (presentAttnums === undefined) return;
  for (const attnum of presentAttnums) {
    const idx = 8 + ((attnum - 1) >> 3);
    body[idx] = (body[idx] ?? 0) | (1 << ((attnum - 1) & 7));
  }
}

export function buildBtreePage(options?: BuildBtreePageOptions): Uint8Array {
  const o = options ?? {};
  const pageType = o.pageType ?? "leaf";
  const page = new Uint8Array(STANDARD_PAGE_SIZE);

  const pagesizeVersion = ((STANDARD_PAGE_SIZE / 256) << 8) | 4;
  writeU16(page, 18, pagesizeVersion);
  writeU16(page, 16, STANDARD_PAGE_SIZE - BTREE_SPECIAL_SIZE); // pd_special

  let nItems = 0;
  let upper = STANDARD_PAGE_SIZE - BTREE_SPECIAL_SIZE;
  const placements: Array<{ off: number; len: number }> = [];

  if (pageType !== "meta") {
    for (let i = (o.tuples ?? []).length - 1; i >= 0; i--) {
      const { body } = packIndexTuple((o.tuples ?? [])[i]!);
      upper -= body.length;
      upper &= ~7; // MAXALIGN
      page.set(body, upper);
      placements.unshift({ off: upper, len: body.length });
    }
    nItems = placements.length + (o.corruptLpOffset ? 1 : 0);
  }

  const pdLower =
    pageType === "meta"
      ? // Real PG 16 metapages set pd_lower past the BTMetaPageData content
        // (v4 sizeof incl. padding = 48 → pd_lower = 24+48 = 72, oracle-frozen
        // from fixtures/btree-meta; v3 struct is 40 bytes → 64). This mirrors
        // the real layout so synthetic tests cannot hide DEF-1-style bugs.
        PAGE_HEADER_SIZE + (o.metaVersion && o.metaVersion < 4 ? 40 : 48)
      : PAGE_HEADER_SIZE + nItems * ITEM_ID_SIZE;
  writeU16(page, 12, pdLower);
  writeU16(page, 14, pageType === "meta" ? STANDARD_PAGE_SIZE - BTREE_SPECIAL_SIZE : upper);

  let idOff = PAGE_HEADER_SIZE;
  for (const p of placements) {
    writeItemId(page, idOff, p.off, LP_NORMAL, p.len);
    idOff += ITEM_ID_SIZE;
  }
  if (o.corruptLpOffset) {
    writeItemId(page, idOff, 9000, LP_NORMAL, 16);
    idOff += ITEM_ID_SIZE;
  }

  // special space at pd_special (8176)
  const sp = STANDARD_PAGE_SIZE - BTREE_SPECIAL_SIZE;
  writeU32(page, sp + 0, o.btpoPrev ?? P_NONE);
  writeU32(page, sp + 4, o.btpoNext ?? P_NONE);
  writeU32(page, sp + 8, o.btpoLevel ?? (pageType === "internal" ? 1 : 0));
  let flags: number;
  if (o.btpoFlagsOverride !== undefined) {
    flags = o.btpoFlagsOverride;
  } else if (pageType === "meta") {
    flags = BTP_META;
  } else if (pageType === "internal") {
    flags = BTP_ROOT;
  } else {
    flags = BTP_LEAF;
  }
  writeU16(page, sp + 12, flags);
  writeU16(page, sp + 14, o.btpoCycleid ?? 0);

  if (pageType === "meta") {
    const c = BTREE_METAPAGE_CONTENT_OFFSET;
    writeU32(page, c + 0, o.metaBadMagic ? 0xdeadbeef : BTREE_MAGIC);
    writeU32(page, c + 4, o.metaVersion ?? 4);
    writeU32(page, c + 8, o.metaRoot ?? 3);
    writeU32(page, c + 12, o.metaLevel ?? 1);
    writeU32(page, c + 16, o.metaFastRoot ?? o.metaRoot ?? 3);
    writeU32(page, c + 20, o.metaFastLevel ?? 1);
    const version = o.metaVersion ?? 4;
    if (version >= 4 && o.metaAllequalimage !== false) {
      page[c + 40] = 1; // btm_allequalimage (abs 64)
    }
  }

  return page;
}

export const SPARSE_SCHEMA = [
  {
    attnum: 1,
    name: "id",
    typname: "int4",
    typlen: 4,
    attlen: 4,
    attalign: "i",
    attisdropped: false,
  },
  {
    attnum: 2,
    name: "label",
    typname: "text",
    typlen: -1,
    attlen: -1,
    attalign: "i",
    attisdropped: false,
  },
];

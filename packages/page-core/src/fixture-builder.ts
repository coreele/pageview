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

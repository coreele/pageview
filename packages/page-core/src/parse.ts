import {
  HEAP_HASNULL,
  HEAP_HOT_UPDATED,
  HEAP_NATTS_MASK,
  HEAP_ONLY_TUPLE,
  LP_DEAD,
  LP_NORMAL,
  LP_REDIRECT,
  LP_STATUS_NAMES,
  LP_UNUSED,
} from "./flags.js";
import type {
  HeapTuple,
  HeapTupleHeader,
  ItemId,
  LpStatus,
  PageHeader,
  PageStats,
  ParsedPage,
} from "./types.js";

export const PAGE_HEADER_SIZE = 24;
export const ITEM_ID_SIZE = 4;
export const STANDARD_PAGE_SIZE = 8192;

export class PageParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PageParseError";
  }
}

function readU16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function readU32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

function readItemId(view: DataView, offset: number, index: number): ItemId {
  const word = view.getUint32(offset, true);
  const lp_off = word & 0x7fff;
  const lp_flags = (word >> 15) & 0x3;
  const lp_len = (word >> 17) & 0x7fff;
  const status = (LP_STATUS_NAMES[lp_flags] ?? "UNUSED") as LpStatus;
  const item: ItemId = {
    index,
    offset: lp_off,
    length: lp_len,
    flags: lp_flags,
    status,
    range: { start: offset, end: offset + ITEM_ID_SIZE },
  };
  if (lp_flags === LP_REDIRECT) {
    item.redirectOffset = lp_off;
  }
  return item;
}

function parseHeader(bytes: Uint8Array): PageHeader {
  if (bytes.length !== STANDARD_PAGE_SIZE) {
    throw new PageParseError(
      `Unsupported page size ${bytes.length}; only standard ${STANDARD_PAGE_SIZE}-byte pages are supported.`,
    );
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const pd_lsn_hi = readU32(view, 0);
  const pd_lsn_lo = readU32(view, 4);
  const pd_checksum = readU16(view, 8);
  const pd_flags = readU16(view, 10);
  const pd_lower = readU16(view, 12);
  const pd_upper = readU16(view, 14);
  const pd_special = readU16(view, 16);
  const pd_pagesize_version = readU16(view, 18);
  const pageSize = (pd_pagesize_version >> 8) * 256;
  const pageVersion = pd_pagesize_version & 0xff;
  const pd_prune_xid = readU32(view, 20);

  if (pageSize !== STANDARD_PAGE_SIZE) {
    throw new PageParseError(
      `Unsupported pd_pagesize_version page size ${pageSize}; only ${STANDARD_PAGE_SIZE} is supported.`,
    );
  }

  return {
    pd_lsn: `${pd_lsn_hi.toString(16).padStart(8, "0")}/${pd_lsn_lo.toString(16).padStart(8, "0")}`,
    pd_checksum,
    pd_flags,
    pd_lower,
    pd_upper,
    pd_special,
    pd_pagesize_version,
    pageSize,
    pageVersion,
    pd_prune_xid,
    range: { start: 0, end: PAGE_HEADER_SIZE },
  };
}

function parseTupleHeader(
  bytes: Uint8Array,
  start: number,
  length: number,
): HeapTupleHeader {
  if (length < 23) {
    throw new PageParseError(`Tuple at ${start} too short (${length})`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const t_xmin = readU32(view, start);
  const t_xmax = readU32(view, start + 4);
  const t_cid = readU32(view, start + 8);
  const bi_hi = readU16(view, start + 12);
  const bi_lo = readU16(view, start + 14);
  const offsetNumber = readU16(view, start + 16);
  const t_infomask2 = readU16(view, start + 18);
  const t_infomask = readU16(view, start + 20);
  const t_hoff = bytes[start + 22]!;
  const blockNumber = (bi_hi << 16) | bi_lo;

  return {
    t_xmin,
    t_xmax,
    t_cid,
    t_ctid: { blockNumber, offsetNumber },
    t_infomask,
    t_infomask2,
    t_hoff,
    natts: t_infomask2 & HEAP_NATTS_MASK,
    range: { start, end: start + t_hoff },
  };
}

export function parsePage(raw: Uint8Array): ParsedPage {
  const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  const header = parseHeader(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const itemIds: ItemId[] = [];
  let offset = PAGE_HEADER_SIZE;
  let index = 0;
  while (offset + ITEM_ID_SIZE <= header.pd_lower) {
    itemIds.push(readItemId(view, offset, index));
    offset += ITEM_ID_SIZE;
    index += 1;
  }

  const freeBytes = Math.max(0, header.pd_upper - header.pd_lower);
  const freeSpace = {
    range: { start: header.pd_lower, end: header.pd_upper },
    bytes: freeBytes,
  };

  const tuples: HeapTuple[] = [];
  for (const item of itemIds) {
    if (item.flags !== LP_NORMAL || item.length === 0) continue;
    if (item.offset < header.pd_upper || item.offset + item.length > bytes.length) {
      continue;
    }
    const headerParsed = parseTupleHeader(bytes, item.offset, item.length);
    const hotUpdated = (headerParsed.t_infomask2 & HEAP_HOT_UPDATED) !== 0;
    const heapOnlyTuple = (headerParsed.t_infomask2 & HEAP_ONLY_TUPLE) !== 0;
    // Cross-block if ctid points to a different block than implied by being on this page —
    // callers supply currentBlkno when decoding chains; here we mark if offset looks self-referential
    // by comparing only when we know block. Default: treat as cross-block if ctid block differs from
    // a sentinel; page-core leaves block identity to UI. We set ctidCrossBlock when t_ctid.block
    // is non-zero and HOT/updated suggests a forward pointer — UI compares against current blkno.
    tuples.push({
      itemIndex: item.index,
      range: { start: item.offset, end: item.offset + item.length },
      header: headerParsed,
      dataRange: {
        start: item.offset + headerParsed.t_hoff,
        end: item.offset + item.length,
      },
      hotUpdated,
      heapOnlyTuple,
      ctidCrossBlock: false,
    });
  }

  const stats: PageStats = {
    pageSize: header.pageSize,
    pd_lower: header.pd_lower,
    pd_upper: header.pd_upper,
    freeBytes,
    itemIdTotal: itemIds.length,
    lpUnused: itemIds.filter((i) => i.status === "UNUSED" || i.flags === LP_UNUSED).length,
    lpNormal: itemIds.filter((i) => i.status === "NORMAL").length,
    lpRedirect: itemIds.filter((i) => i.status === "REDIRECT").length,
    lpDead: itemIds.filter((i) => i.status === "DEAD" || i.flags === LP_DEAD).length,
    tupleCount: tuples.length,
  };

  // Fix UNUSED counting: empty slots with LP_UNUSED
  stats.lpUnused = itemIds.filter((i) => i.flags === LP_UNUSED).length;
  stats.lpDead = itemIds.filter((i) => i.flags === LP_DEAD).length;

  return {
    header,
    itemIds,
    freeSpace,
    tuples,
    stats,
    raw: bytes,
  };
}

/** Annotate tuples with cross-block ctid relative to currentBlkno. */
export function annotateCtidBlocks(page: ParsedPage, currentBlkno: number): ParsedPage {
  return {
    ...page,
    tuples: page.tuples.map((t) => ({
      ...t,
      ctidCrossBlock: t.header.t_ctid.blockNumber !== currentBlkno,
    })),
  };
}

export function isNullBitSet(infomask: number, nullBitmap: Uint8Array, attIndex0: number): boolean {
  if ((infomask & HEAP_HASNULL) === 0) return false;
  const byte = nullBitmap[attIndex0 >> 3] ?? 0;
  return (byte & (1 << (attIndex0 & 0x07))) === 0;
}

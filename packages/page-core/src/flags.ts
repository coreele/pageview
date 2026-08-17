import type { FlagBit } from "./types.js";

/** ItemId lp_flags */
export const LP_UNUSED = 0;
export const LP_NORMAL = 1;
export const LP_REDIRECT = 2;
export const LP_DEAD = 3;

export const LP_STATUS_NAMES = ["UNUSED", "NORMAL", "REDIRECT", "DEAD"] as const;

/** t_infomask bits (PostgreSQL 16) */
export const HEAP_HASNULL = 0x0001;
export const HEAP_HASVARWIDTH = 0x0002;
export const HEAP_HASEXTERNAL = 0x0004;
export const HEAP_HASOID_OLD = 0x0008;
export const HEAP_XMAX_KEYSHR_LOCK = 0x0010;
export const HEAP_COMBOCID = 0x0020;
export const HEAP_XMAX_EXCL_LOCK = 0x0040;
export const HEAP_XMAX_LOCK_ONLY = 0x0080;
export const HEAP_XMIN_COMMITTED = 0x0100;
export const HEAP_XMIN_INVALID = 0x0200;
export const HEAP_XMAX_COMMITTED = 0x0400;
export const HEAP_XMAX_INVALID = 0x0800;
export const HEAP_XMAX_IS_MULTI = 0x1000;
export const HEAP_UPDATED = 0x2000;
export const HEAP_MOVED_OFF = 0x4000;
export const HEAP_MOVED_IN = 0x8000;

/** t_infomask2 */
export const HEAP_NATTS_MASK = 0x07ff;
export const HEAP_KEYS_UPDATED = 0x2000;
export const HEAP_HOT_UPDATED = 0x4000;
export const HEAP_ONLY_TUPLE = 0x8000;

const INFOMASK_DEFS: Array<{ bit: number; name: string; meaning: string }> = [
  { bit: HEAP_HASNULL, name: "HEAP_HASNULL", meaning: "Has null bitmap" },
  { bit: HEAP_HASVARWIDTH, name: "HEAP_HASVARWIDTH", meaning: "Has variable-width attribute(s)" },
  { bit: HEAP_HASEXTERNAL, name: "HEAP_HASEXTERNAL", meaning: "Has external stored attribute(s)" },
  { bit: HEAP_HASOID_OLD, name: "HEAP_HASOID_OLD", meaning: "Has OID (legacy)" },
  { bit: HEAP_XMAX_KEYSHR_LOCK, name: "HEAP_XMAX_KEYSHR_LOCK", meaning: "xmax is a key-shared locker" },
  { bit: HEAP_COMBOCID, name: "HEAP_COMBOCID", meaning: "t_cid is a combo CID" },
  { bit: HEAP_XMAX_EXCL_LOCK, name: "HEAP_XMAX_EXCL_LOCK", meaning: "xmax is exclusive locker" },
  { bit: HEAP_XMAX_LOCK_ONLY, name: "HEAP_XMAX_LOCK_ONLY", meaning: "xmax, if valid, is only a locker" },
  { bit: HEAP_XMIN_COMMITTED, name: "HEAP_XMIN_COMMITTED", meaning: "t_xmin committed" },
  { bit: HEAP_XMIN_INVALID, name: "HEAP_XMIN_INVALID", meaning: "t_xmin invalid/aborted" },
  { bit: HEAP_XMAX_COMMITTED, name: "HEAP_XMAX_COMMITTED", meaning: "t_xmax committed" },
  { bit: HEAP_XMAX_INVALID, name: "HEAP_XMAX_INVALID", meaning: "t_xmax invalid/aborted" },
  { bit: HEAP_XMAX_IS_MULTI, name: "HEAP_XMAX_IS_MULTI", meaning: "t_xmax is a MultiXactId" },
  { bit: HEAP_UPDATED, name: "HEAP_UPDATED", meaning: "This is an updated tuple" },
  { bit: HEAP_MOVED_OFF, name: "HEAP_MOVED_OFF", meaning: "Moved to another place (pre-9.0 VACUUM FULL)" },
  { bit: HEAP_MOVED_IN, name: "HEAP_MOVED_IN", meaning: "Moved from another place (pre-9.0 VACUUM FULL)" },
];

const INFOMASK2_DEFS: Array<{ bit: number; name: string; meaning: string }> = [
  { bit: HEAP_KEYS_UPDATED, name: "HEAP_KEYS_UPDATED", meaning: "Tuple was updated and key columns changed" },
  { bit: HEAP_HOT_UPDATED, name: "HEAP_HOT_UPDATED", meaning: "Tuple was HOT-updated" },
  { bit: HEAP_ONLY_TUPLE, name: "HEAP_ONLY_TUPLE", meaning: "This is a heap-only tuple (HOT)" },
];

export function decodeInfomask(value: number): FlagBit[] {
  return INFOMASK_DEFS.map((d) => ({
    bit: d.bit,
    name: d.name,
    meaning: d.meaning,
    set: (value & d.bit) !== 0,
  }));
}

export function decodeInfomask2(value: number): FlagBit[] {
  const natts = value & HEAP_NATTS_MASK;
  const bits = INFOMASK2_DEFS.map((d) => ({
    bit: d.bit,
    name: d.name,
    meaning: d.meaning,
    set: (value & d.bit) !== 0,
  }));
  return [
    {
      bit: HEAP_NATTS_MASK,
      name: "HEAP_NATTS",
      meaning: `Number of attributes: ${natts}`,
      set: natts > 0,
    },
    ...bits,
  ];
}

export function decodeItemIdFlags(flags: number): FlagBit[] {
  const names = ["LP_UNUSED", "LP_NORMAL", "LP_REDIRECT", "LP_DEAD"];
  return [0, 1, 2, 3].map((f) => ({
    bit: f,
    name: names[f]!,
    meaning: `ItemId state ${names[f]}`,
    set: flags === f,
  }));
}

/** PageHeaderData.pd_flags (bufpage.h) */
export const PD_HAS_FREE_LINES = 0x0001;
export const PD_PAGE_FULL = 0x0002;
export const PD_ALL_VISIBLE = 0x0004;
export const PD_VALID_FLAG_BITS = 0x0007;

const PD_FLAGS_DEFS: Array<{ bit: number; name: string; meaning: string }> = [
  {
    bit: PD_HAS_FREE_LINES,
    name: "PD_HAS_FREE_LINES",
    meaning: "Unused line pointers exist (LP_UNUSED)",
  },
  {
    bit: PD_PAGE_FULL,
    name: "PD_PAGE_FULL",
    meaning: "Not enough free space for a new tuple",
  },
  {
    bit: PD_ALL_VISIBLE,
    name: "PD_ALL_VISIBLE",
    meaning: "All tuples on this page are visible to everyone (VM all-visible)",
  },
];

export function decodePdFlags(value: number): FlagBit[] {
  const bits = PD_FLAGS_DEFS.map((d) => ({
    bit: d.bit,
    name: d.name,
    meaning: d.meaning,
    set: (value & d.bit) !== 0,
  }));
  const extra = value & ~PD_VALID_FLAG_BITS;
  if (extra !== 0) {
    bits.push({
      bit: extra,
      name: "PD_FLAGS_UNKNOWN",
      meaning: `Reserved/unknown bits set: 0x${extra.toString(16)}`,
      set: true,
    });
  }
  return bits;
}

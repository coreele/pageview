/**
 * Index tuple key decoding (index-key-decode, design §3 — plan A).
 *
 * Pure function layer symmetric to heap decode.ts: takes the parsed B-tree
 * page, one index tuple, and index column metadata (pg_attribute of the index
 * + pg_index), and decodes the key-area bytes per column. `parseBtreePage`
 * stays schema-agnostic; this module never imports heap decoding.
 *
 * Layout rules frozen against PG 16.11 real captures + server headers
 * (itup.h / nbtree.h); deviations from design §3 are recorded in
 * workflow/archive/2026/index-key-decode/dev-notes.md:
 *   - null bitmap allocates a FIXED sizeof(IndexAttributeBitMapData) = 4 bytes
 *     (INDEX_MAX_KEYS = 32), attribute data starts at MAXALIGN(8+4) = 16
 *   - bitmap bits are INVERTED vs heap: set = value present, clear = NULL
 *   - fixed-length by-value columns ARE attalign-aligned; varlenas are packed
 *   - pivot nkeyatts = ip_posid & BT_OFFSET_MASK (direct read, no -1);
 *     minus-infinity pivots have posid == 0 (no key attributes, no TID)
 *   - the trailing 6B heap TID (pivot tiebreaker) is gated by the
 *     BT_PIVOT_HEAP_TID_ATTR bit in ip_posid
 */
import type { ByteRange } from "./types.js";
import type { BtreeIndexTuple, ParsedBtreePage } from "./btree.js";
import {
  BT_OFFSET_MASK,
  BT_PIVOT_HEAP_TID_ATTR,
  INDEX_TUPLE_HEADER_SIZE,
} from "./btree.js";

// ---------------------------------------------------------------------------
// Frozen layout constants (oracle-verified; see module doc + dev-notes.md)
// ---------------------------------------------------------------------------

/** sizeof(IndexAttributeBitMapData) — does NOT vary with indnatts (itup.h). */
export const INDEX_NULL_BITMAP_BYTES = 4;
/** MAXALIGN(sizeof(IndexTupleData) + bitmap) on 64-bit platforms. */
export const INDEX_NULL_DATA_OFFSET = 16;
/** ItemPointerData size of a pivot's trailing heap TID tiebreaker. */
export const INDEX_PIVOT_HEAP_TID_BYTES = 6;

// ---------------------------------------------------------------------------
// Public types (Spec "data / state" output model subset)
// ---------------------------------------------------------------------------

export type IndexColumnMeta = {
  attnum: number;
  name: string;
  /** pg_type OID of the btree storage datum type. */
  typoid: number;
  typname: string;
  /** key vs INCLUDE column (informational; INCLUDE cols decode identically). */
  kind?: "key" | "include";
};

export type DecodedKeyColumnStatus = "value" | "null" | "unsupported" | "error";

export type DecodedKeyColumn = {
  attnum: number;
  name: string;
  typname: string;
  status: DecodedKeyColumnStatus;
  /** Full-precision value string (no display truncation — that is UI-level). */
  display?: string;
  /** Set for unsupported/error columns. */
  reason?: string;
  /** Byte range consumed by this column (value bytes, alignment excluded). */
  range?: ByteRange;
};

// ---------------------------------------------------------------------------
// typoid strategy table (design §2) — the single mapping point
// ---------------------------------------------------------------------------

type FixedSpec = { align: 1 | 2 | 4 | 8; len: 1 | 2 | 4 | 8 | 16; read: (b: Uint8Array, v: DataView, o: number) => string };
type VarlenaSpec = { varlena: true; read: (content: Uint8Array) => string };
type ColumnSpec = FixedSpec | VarlenaSpec;

const INT4_MIN = -0x80000000;
const INT4_MAX = 0x7fffffff;
const INT64_MIN = -(2n ** 63n);
const INT64_MAX = 2n ** 63n - 1n;
const USEC_PER_DAY = 86_400_000_000n;
const PG_EPOCH_TO_UNIX_DAYS = 10_957n; // 1970-01-01 → 2000-01-01

/** Howard Hinnant's civil_from_days (proleptic Gregorian), BigInt arithmetic. */
function civilFromDays(daysSinceEpoch: bigint): { y: bigint; m: bigint; d: bigint } {
  const z = daysSinceEpoch + 719468n;
  const era = (z >= 0n ? z : z - 146096n) / 146097n;
  const doe = z - era * 146097n; // [0, 146096]
  const yoe = (doe - doe / 1460n + doe / 36524n - doe / 146096n) / 365n; // [0, 399]
  const y = yoe + era * 400n;
  const doy = doe - (365n * yoe + yoe / 4n - yoe / 100n); // [0, 365]
  const mp = (5n * doy + 2n) / 153n; // [0, 11]
  const d = doy - (153n * mp + 2n) / 5n + 1n; // [1, 31]
  const m = mp < 10n ? mp + 3n : mp - 9n; // [1, 12]
  return { y: m <= 2n ? y + 1n : y, m, d };
}

const pad4 = (n: bigint): string => {
  const s = n.toString();
  return n >= 0n ? s.padStart(4, "0") : `-${(-n).toString().padStart(4, "0")}`;
};
const pad2 = (n: bigint): string => n.toString().padStart(2, "0");

/** date: int32 days since 2000-01-01; ±INT32 extremes are ±infinity. */
function formatDate(v: DataView, o: number): string {
  const days = v.getInt32(o, true);
  if (days === INT4_MAX) return "infinity";
  if (days === INT4_MIN) return "-infinity";
  const { y, m, d } = civilFromDays(BigInt(days) + PG_EPOCH_TO_UNIX_DAYS);
  return `${pad4(y)}-${pad2(m)}-${pad2(d)}`;
}

/** timestamp/timestamptz: int64 µs since 2000-01-01; ±INT64 extremes are ±infinity. */
function formatTimestamp(v: DataView, o: number, withZ: boolean): string {
  const us = v.getBigInt64(o, true);
  if (us === INT64_MAX) return "infinity";
  if (us === INT64_MIN) return "-infinity";
  const days = us / USEC_PER_DAY; // BigInt division truncates toward 0 — floor for the sign-adjusted value below
  const dayStart = days * USEC_PER_DAY;
  let rem = us - dayStart; // may be negative when us < 0 and not on a day boundary
  let day = days;
  if (rem < 0n) {
    rem += USEC_PER_DAY;
    day -= 1n;
  }
  const secs = rem / 1_000_000n;
  const micros = rem % 1_000_000n;
  const h = secs / 3600n;
  const mi = (secs / 60n) % 60n;
  const s = secs % 60n;
  const { y, m, d } = civilFromDays(day + PG_EPOCH_TO_UNIX_DAYS);
  // PG ::text convention: the fraction drops trailing zeros (and the dot
  // entirely when zero) — oracle-compared against UTC-session ::text.
  const frac = micros === 0n ? "" : `.${micros.toString().padStart(6, "0").replace(/0+$/, "")}`;
  return `${pad4(y)}-${pad2(m)}-${pad2(d)}T${pad2(h)}:${pad2(mi)}:${pad2(s)}${frac}${withZ ? "Z" : ""}`;
}

/** UTF-8 decode with `\xNN` escapes for undecodable bytes (Spec value contract). */
function decodeUtf8WithEscapes(bytes: Uint8Array): string {
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    try {
      return out + new TextDecoder("utf-8", { fatal: true }).decode(bytes.slice(i));
    } catch {
      // find the longest decodable prefix from i, escape the first bad byte
      let lo = 0;
      let hi = bytes.length - i;
      let good = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        try {
          new TextDecoder("utf-8", { fatal: true }).decode(bytes.slice(i, i + mid));
          good = mid;
          lo = mid + 1;
        } catch {
          hi = mid - 1;
        }
      }
      if (good === 0) {
        out += `\\x${bytes[i]!.toString(16).padStart(2, "0")}`;
        i += 1;
      } else {
        out += new TextDecoder("utf-8", { fatal: true }).decode(bytes.slice(i, i + good));
        i += good;
      }
    }
  }
  return out;
}

const hex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

// ---------------------------------------------------------------------------
// P1: numeric / float4 / float8 / bytea (formats frozen against PG 16.11
// real index pages — see dev-notes T7 probe evidence)
// ---------------------------------------------------------------------------

/**
 * PG float text conventions (float4out/float8out → Ryu to_chars, PG 16
 * source-verified): specials Infinity/-Infinity/NaN; fixed-point notation
 * while -4 <= exp10 <= 5 (float4, f2s.c) / 14 (float8, d2s.c) — thresholds
 * chosen to match printf defaults; otherwise d.ddde±NN with a 2+ digit
 * exponent. -0 keeps its sign.
 */
function formatPgFloat(value: number, maxPlainExp: number): string {
  if (Number.isNaN(value)) return "NaN";
  if (value === Infinity) return "Infinity";
  if (value === -Infinity) return "-Infinity";
  const neg = value < 0 || Object.is(value, -0);
  const a = Math.abs(value);
  if (a === 0) return neg ? "-0" : "0";

  let digits = "";
  let exp = 0;
  for (let p = 1; p <= 17; p++) {
    const se = a.toExponential(p - 1);
    if (Number(se) === a || (maxPlainExp <= 5 && Math.fround(Number(se)) === a)) {
      const [mant, e] = se.split("e");
      digits = mant!.replace(".", "").replace(/0+$/, "") || "0";
      exp = Number(e);
      break;
    }
  }
  if (digits === "") digits = String(a); // unreachable safety net

  let out: string;
  if (exp >= -4 && exp <= maxPlainExp) {
    if (exp >= 0) {
      out =
        digits.length > exp + 1
          ? `${digits.slice(0, exp + 1)}.${digits.slice(exp + 1)}`
          : digits + "0".repeat(exp + 1 - digits.length);
    } else {
      out = `0.${"0".repeat(-exp - 1)}${digits}`;
    }
  } else {
    const mant = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits;
    out = `${mant}e${exp < 0 ? "-" : "+"}${String(Math.abs(exp)).padStart(2, "0")}`;
  }
  return (neg ? "-" : "") + out;
}

/** Decode PG numeric varlena content (base-10000 digits) to exact text. */
function formatNumeric(content: Uint8Array): string {
  if (content.length < 2) return "NaN"; // malformed; defensive
  const v = new DataView(content.buffer, content.byteOffset, content.byteLength);
  const w0 = v.getUint16(0, true);
  switch (w0 & 0xf000) {
    case 0xc000:
      return "NaN";
    case 0xd000:
      return "Infinity";
    case 0xf000:
      return "-Infinity";
    default:
      break;
  }
  const signBits = w0 & 0xc000;

  let neg: boolean;
  let dscale: number;
  let weight: number;
  let digitStart: number;
  if (signBits === 0x8000) {
    // short format: sign bit 0x2000; dscale bits 7-12; weight bits 0-6
    // (biased: stored >= 64 decodes as stored - 128, range [-64, 63])
    neg = (w0 & 0x2000) !== 0;
    dscale = (w0 >> 7) & 0x3f;
    const stored = w0 & 0x7f;
    weight = stored >= 64 ? stored - 128 : stored;
    digitStart = 2;
  } else {
    // long format: sign_dscale (0x4000 = negative), int16 weight, digits
    neg = signBits === 0x4000;
    dscale = w0 & 0x3fff;
    weight = content.length >= 4 ? v.getInt16(2, true) : 0;
    digitStart = 4;
  }

  const n = Math.max(0, Math.floor((content.length - digitStart) / 2));
  const digits: number[] = [];
  for (let i = 0; i < n; i++) digits.push(v.getUint16(digitStart + i * 2, true));

  const pad4 = (d: number): string => String(d).padStart(4, "0");
  let intStr: string;
  let fracStr: string;
  if (n === 0) {
    intStr = "0";
    fracStr = "0".repeat(dscale);
  } else {
    if (weight < 0) {
      intStr = "0";
    } else {
      const intCount = Math.min(n, weight + 1);
      const parts: string[] = [];
      for (let i = 0; i < intCount; i++) parts.push(i === 0 ? String(digits[i]!) : pad4(digits[i]!));
      if (weight >= n) parts.push("0".repeat(4 * (weight - n + 1)));
      intStr = parts.join("");
    }
    // Fraction groups: digit i (i > weight) covers decimal places
    // [4*(i-weight-1)+1 .. 4*(i-weight)]; groups before the first stored
    // digit are implicit zeros (leading empty groups for negative weights).
    const firstFracIdx = Math.max(0, weight + 1);
    const leadingEmptyGroups = firstFracIdx - weight - 1;
    let fracFull = "0000".repeat(Math.max(0, leadingEmptyGroups));
    for (let i = firstFracIdx; i < n; i++) fracFull += pad4(digits[i]!);
    fracStr = fracFull.slice(0, dscale).padEnd(dscale, "0");
  }
  return `${neg ? "-" : ""}${intStr}${dscale > 0 ? `.${fracStr}` : ""}`;
}

/** Fixed-length decoders (little-endian Datum memcpy). */
const FIXED_SPECS: Record<number, FixedSpec> = {
  16: { align: 1, len: 1, read: (b, _v, o) => (b[o]! !== 0 ? "true" : "false") }, // bool
  20: { align: 8, len: 8, read: (_b, v, o) => v.getBigInt64(o, true).toString() }, // int8
  21: { align: 2, len: 2, read: (_b, v, o) => v.getInt16(o, true).toString() }, // int2
  23: { align: 4, len: 4, read: (_b, v, o) => v.getInt32(o, true).toString() }, // int4
  700: { align: 4, len: 4, read: (_b, v, o) => formatPgFloat(v.getFloat32(o, true), 5) }, // float4
  701: { align: 8, len: 8, read: (_b, v, o) => formatPgFloat(v.getFloat64(o, true), 14) }, // float8
  1082: { align: 4, len: 4, read: (_b, v, o) => formatDate(v, o) }, // date
  1114: { align: 8, len: 8, read: (_b, v, o) => formatTimestamp(v, o, false) }, // timestamp
  1184: { align: 8, len: 8, read: (_b, v, o) => formatTimestamp(v, o, true) }, // timestamptz
  2950: {
    align: 1,
    len: 16,
    read: (b, _v, o) => {
      const h = hex(b.slice(o, o + 16));
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    },
  }, // uuid
};

const VARLENA_SPECS: Record<number, VarlenaSpec> = {
  17: { varlena: true, read: (c) => `\\x${hex(c)}` }, // bytea
  25: { varlena: true, read: (c) => `'${decodeUtf8WithEscapes(c)}'` }, // text
  1042: { varlena: true, read: (c) => `'${decodeUtf8WithEscapes(c)}'` }, // bpchar
  1043: { varlena: true, read: (c) => `'${decodeUtf8WithEscapes(c)}'` }, // varchar
  1700: { varlena: true, read: formatNumeric }, // numeric
};

/** typoid → column spec; the single policy table (no typname heuristics). */
export const KEY_COLUMN_SPECS: Record<number, ColumnSpec> = {
  ...FIXED_SPECS,
  ...VARLENA_SPECS,
};

// ---------------------------------------------------------------------------
// Stepping helpers
// ---------------------------------------------------------------------------

function alignTo(offset: number, align: number): number {
  const rem = offset % align;
  return rem === 0 ? offset : offset + (align - rem);
}

type VarlenaRead =
  | { ok: true; start: number; contentStart: number; end: number }
  | { ok: false; reason: string };

/**
 * Varlena step at `offset`: 1B short header ((b&1)=1, total b>>1) or 4B
 * uncompressed header (low 2 bits 00, total w>>2). Compressed/external tags
 * (low 2 bits 10) must not appear in index keys — defensive error.
 */
function readVarlenaAt(raw: Uint8Array, offset: number, limit: number): VarlenaRead {
  if (offset >= limit) return { ok: false, reason: "no bytes for varlena header" };
  const first = raw[offset]!;
  if ((first & 0x01) === 0x01) {
    const total = first >> 1; // includes the 1B header
    if (total < 1) return { ok: false, reason: "invalid 1-byte varlena header" };
    const end = offset + total;
    if (end > limit) return { ok: false, reason: "varlena length exceeds key area" };
    return { ok: true, start: offset, contentStart: offset + 1, end };
  }
  if ((first & 0x03) === 0x00) {
    if (offset + 4 > limit) return { ok: false, reason: "no bytes for 4-byte varlena header" };
    const word = new DataView(raw.buffer, raw.byteOffset, raw.byteLength).getUint32(offset, true);
    const total = word >>> 2; // includes the 4B header
    if (total < 4) return { ok: false, reason: "invalid 4-byte varlena header" };
    const end = offset + total;
    if (end > limit) return { ok: false, reason: "varlena length exceeds key area" };
    return { ok: true, start: offset, contentStart: offset + 4, end };
  }
  return { ok: false, reason: "compressed/external varlena in index key" };
}

// ---------------------------------------------------------------------------
// decodeIndexTupleKeys
// ---------------------------------------------------------------------------

/**
 * Decode one index tuple's key attributes per the column metadata.
 * Degradations are local: NULL bitmap / pivot truncation → status "null";
 * unknown typoid → "unsupported" (and following columns become "error"
 * because their boundaries are unknown); structural byte errors → "error"
 * with subsequent columns degraded.
 */
export function decodeIndexTupleKeys(
  page: ParsedBtreePage,
  tuple: BtreeIndexTuple,
  columns: IndexColumnMeta[],
): DecodedKeyColumn[] {
  const raw = page.raw;
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const base = tuple.range.start;
  const sorted = [...columns].sort((a, b) => a.attnum - b.attnum);
  const indnatts = sorted.length;

  const hasNulls = tuple.hasNulls;
  const bitmapStart = base + INDEX_TUPLE_HEADER_SIZE;
  const dataStart = base + (hasNulls ? INDEX_NULL_DATA_OFFSET : INDEX_TUPLE_HEADER_SIZE);

  // key-area end: pivot tuples may carry a trailing 6B heap TID tiebreaker;
  // posting tuples end at the posting list (parse already computed that).
  let nkeyatts = indnatts;
  let keyEnd = tuple.range.end;
  if (tuple.isPivot) {
    nkeyatts = tuple.t_tid.offsetNumber & BT_OFFSET_MASK;
    const hasTrailingTid = (tuple.t_tid.offsetNumber & BT_PIVOT_HEAP_TID_ATTR) !== 0;
    keyEnd = tuple.range.end - (hasTrailingTid ? INDEX_PIVOT_HEAP_TID_BYTES : 0);
  } else if (tuple.isPosting) {
    keyEnd = tuple.keyRange.end;
  }

  const out: DecodedKeyColumn[] = [];
  let offset = dataStart;
  let degrade: string | null = null;

  for (const col of sorted) {
    if (degrade !== null) {
      out.push({ ...colName(col), status: "error", reason: degrade });
      continue;
    }
    // pivot suffix truncation (also covers minus-infinity: nkeyatts == 0)
    if (tuple.isPivot && col.attnum > nkeyatts) {
      out.push({ ...colName(col), status: "null" });
      continue;
    }
    // inverted NULL bitmap: bit CLEAR means NULL
    if (hasNulls) {
      const idx = (col.attnum - 1) >> 3;
      const byte = idx < INDEX_NULL_BITMAP_BYTES ? (raw[bitmapStart + idx] ?? 0) : 0;
      if ((byte & (1 << ((col.attnum - 1) & 7))) === 0) {
        out.push({ ...colName(col), status: "null" });
        continue;
      }
    }

    const spec = KEY_COLUMN_SPECS[col.typoid];
    if (spec === undefined) {
      out.push({
        ...colName(col),
        status: "unsupported",
        reason: `unsupported type: ${col.typname}`,
      });
      degrade = `column boundaries unknown after unsupported type: ${col.typname} (attnum ${col.attnum})`;
      continue;
    }

    if ("varlena" in spec) {
      const r = readVarlenaAt(raw, offset, keyEnd);
      if (!r.ok) {
        out.push({ ...colName(col), status: "error", reason: r.reason });
        degrade = `cannot step past previous decode error (${col.typname}, attnum ${col.attnum})`;
        continue;
      }
      const display = spec.read(raw.slice(r.contentStart, r.end));
      out.push({ ...colName(col), status: "value", display, range: { start: r.start, end: r.end } });
      offset = r.end;
      continue;
    }

    const colStart = spec.align > 1 ? alignTo(offset, spec.align) : offset;
    if (colStart + spec.len > keyEnd) {
      out.push({
        ...colName(col),
        status: "error",
        reason: `insufficient key bytes for ${col.typname} (need ${spec.len}, key area ends at ${keyEnd})`,
      });
      degrade = `cannot step past previous decode error (${col.typname}, attnum ${col.attnum})`;
      continue;
    }
    const display = spec.read(raw, view, colStart);
    out.push({ ...colName(col), status: "value", display, range: { start: colStart, end: colStart + spec.len } });
    offset = colStart + spec.len;
  }

  return out;
}

function colName(col: IndexColumnMeta): { attnum: number; name: string; typname: string } {
  return { attnum: col.attnum, name: col.name, typname: col.typname };
}

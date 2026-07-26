import { HEAP_HASNULL, HEAP_HASEXTERNAL } from "./flags.js";
import { isNullBitSet } from "./parse.js";
import type { ByteRange, ColumnMeta, DecodedColumn, HeapTuple, ParsedPage } from "./types.js";

function alignOffset(offset: number, align: string): number {
  const a =
    align === "c" ? 1 : align === "s" ? 2 : align === "i" ? 4 : align === "d" ? 8 : 1;
  const rem = offset % a;
  return rem === 0 ? offset : offset + (a - rem);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function readVarlena(
  data: Uint8Array,
  offset: number,
): { value: Uint8Array; next: number; toasted: boolean; external: boolean } {
  if (offset >= data.length) {
    return { value: new Uint8Array(), next: offset, toasted: false, external: false };
  }
  const first = data[offset]!;
  // 1-byte header short varlena
  if ((first & 0x01) === 0x01) {
    const len = first >> 1;
    const start = offset + 1;
    const end = start + Math.max(0, len - 1);
    return {
      value: data.slice(start, Math.min(end, data.length)),
      next: offset + len,
      toasted: false,
      external: false,
    };
  }
  // 4-byte header
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const rawLen = view.getUint32(offset, true);
  // TOAST pointer: external bit in varlena header (0x02 in length word for uncompressed external)
  const external = (rawLen & 0x02) !== 0 || (rawLen & 0x01) === 0 && (rawLen & 0x02) !== 0;
  // PostgreSQL: VARATT_IS_EXTERNAL when (hdr & 0x01)==0 && (hdr & 0x02)!=0 for little-endian 4byte
  const isExternal = (first & 0x03) === 0x02 || ((rawLen & 0x03) === 0x02);
  if (isExternal) {
    // toast pointer is typically 18 bytes total
    const toastLen = 18;
    return {
      value: data.slice(offset, Math.min(offset + toastLen, data.length)),
      next: offset + toastLen,
      toasted: true,
      external: true,
    };
  }
  const len = rawLen >> 2;
  const start = offset + 4;
  const end = offset + len;
  return {
    value: data.slice(start, Math.min(end, data.length)),
    next: end,
    toasted: false,
    external: false,
  };
}

function decodeScalar(
  typname: string,
  bytes: Uint8Array,
  offset: number,
  attlen: number,
): { display: string; value: unknown; next: number; rawHex?: string; toasted?: boolean } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const t = typname.toLowerCase();

  if (attlen > 0 && offset + attlen > bytes.length) {
    const slice = bytes.slice(offset);
    return { display: toHex(slice), value: slice, next: bytes.length, rawHex: toHex(slice) };
  }

  switch (t) {
    case "bool":
    case "boolean": {
      const v = bytes[offset] !== 0;
      return { display: String(v), value: v, next: offset + 1 };
    }
    case "int2":
    case "smallint": {
      const v = view.getInt16(offset, true);
      return { display: String(v), value: v, next: offset + 2 };
    }
    case "int4":
    case "integer":
    case "oid": {
      const v = view.getInt32(offset, true);
      return { display: String(v), value: v, next: offset + 4 };
    }
    case "int8":
    case "bigint": {
      const v = view.getBigInt64(offset, true);
      return { display: v.toString(), value: v.toString(), next: offset + 8 };
    }
    case "float4":
    case "real": {
      const v = view.getFloat32(offset, true);
      return { display: String(v), value: v, next: offset + 4 };
    }
    case "float8":
    case "double precision": {
      const v = view.getFloat64(offset, true);
      return { display: String(v), value: v, next: offset + 8 };
    }
    case "uuid": {
      const b = bytes.slice(offset, offset + 16);
      const h = toHex(b);
      const uuid = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
      return { display: uuid, value: uuid, next: offset + 16 };
    }
    case "date": {
      // days since 2000-01-01
      const days = view.getInt32(offset, true);
      const epoch = Date.UTC(2000, 0, 1) + days * 86400000;
      const display = new Date(epoch).toISOString().slice(0, 10);
      return { display, value: display, next: offset + 4 };
    }
    case "timestamp":
    case "timestamptz": {
      const usec = view.getBigInt64(offset, true);
      const ms = Number(usec / 1000n) + Date.UTC(2000, 0, 1);
      const display = new Date(ms).toISOString();
      return { display, value: display, next: offset + 8 };
    }
    case "text":
    case "varchar":
    case "bpchar":
    case "bytea":
    case "numeric": {
      const v = readVarlena(bytes, offset);
      if (v.toasted || v.external) {
        return {
          display: "TOASTed",
          value: null,
          next: v.next,
          toasted: true,
          rawHex: toHex(v.value),
        };
      }
      if (t === "bytea" || t === "numeric") {
        const hex = toHex(v.value);
        return {
          display: t === "bytea" ? `\\x${hex}` : hex,
          value: hex,
          next: v.next,
          rawHex: hex,
        };
      }
      const text = new TextDecoder().decode(v.value);
      return { display: text, value: text, next: v.next };
    }
    default: {
      if (attlen > 0) {
        const slice = bytes.slice(offset, offset + attlen);
        const hex = toHex(slice);
        return { display: hex, value: hex, next: offset + attlen, rawHex: hex };
      }
      const v = readVarlena(bytes, offset);
      if (v.toasted || v.external) {
        return { display: "TOASTed", value: null, next: v.next, toasted: true };
      }
      const hex = toHex(v.value);
      return { display: hex, value: hex, next: v.next, rawHex: hex };
    }
  }
}

export function decodeTupleColumns(
  page: ParsedPage,
  tuple: HeapTuple,
  columns: ColumnMeta[],
): DecodedColumn[] {
  const data = page.raw;
  const start = tuple.range.start;
  const hoff = tuple.header.t_hoff;
  const infomask = tuple.header.t_infomask;
  const nullBitmapStart = start + 23;
  const nullBitmapLen = Math.max(0, hoff - 23);
  const nullBitmap = data.slice(nullBitmapStart, nullBitmapStart + nullBitmapLen);

  let offset = start + hoff;
  const out: DecodedColumn[] = [];

  // attnum order; include dropped as placeholders
  const sorted = [...columns].sort((a, b) => a.attnum - b.attnum);

  for (let i = 0; i < sorted.length; i++) {
    const col = sorted[i]!;
    if (col.attisdropped) {
      out.push({
        attnum: col.attnum,
        name: col.name,
        typeName: col.typname,
        dropped: true,
        null: true,
        value: null,
        display: "(dropped)",
      });
      // Dropped columns still occupy alignment slots in the tuple in PG —
      // we still need to skip their storage if present. Use attlen/align.
      if (!isNullBitSet(infomask, nullBitmap, i)) {
        offset = alignOffset(offset, col.attalign);
        if (col.attlen > 0) {
          offset += col.attlen;
        } else {
          const v = readVarlena(data, offset);
          offset = v.next;
        }
      }
      continue;
    }

    if (isNullBitSet(infomask, nullBitmap, i)) {
      out.push({
        attnum: col.attnum,
        name: col.name,
        typeName: col.typname,
        dropped: false,
        null: true,
        value: null,
        display: "NULL",
      });
      continue;
    }

    offset = alignOffset(offset, col.attalign);
    const rangeStart = offset;
    try {
      const decoded = decodeScalar(col.typname, data, offset, col.attlen);
      offset = decoded.next;
      const range: ByteRange = { start: rangeStart, end: offset };
      out.push({
        attnum: col.attnum,
        name: col.name,
        typeName: col.typname,
        dropped: false,
        null: false,
        value: decoded.value,
        display: decoded.display,
        rawHex: decoded.rawHex,
        toasted: decoded.toasted,
        range,
      });
    } catch {
      const slice = data.slice(offset, Math.min(offset + 32, tuple.range.end));
      out.push({
        attnum: col.attnum,
        name: col.name,
        typeName: col.typname,
        dropped: false,
        null: false,
        value: null,
        display: toHex(slice),
        rawHex: toHex(slice),
        range: { start: offset, end: offset + slice.length },
      });
      break;
    }
  }

  // Mark external toast at tuple level if HEAP_HASEXTERNAL
  if ((infomask & HEAP_HASEXTERNAL) !== 0) {
    for (const c of out) {
      if (!c.null && !c.dropped && c.toasted === undefined && c.typeName.match(/text|varchar|bytea|numeric/i)) {
        // leave as-is; individual decode may have marked TOASTed
      }
    }
  }

  void HEAP_HASNULL;
  return out;
}

export function decodePageTuples(page: ParsedPage, columns: ColumnMeta[]): ParsedPage {
  return {
    ...page,
    tuples: page.tuples.map((t) => ({
      ...t,
      columns: decodeTupleColumns(page, t, columns),
    })),
  };
}

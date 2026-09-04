/**
 * decodeIndexTupleKeys — synthetic layout tests (index-key-decode T3).
 *
 * Byte layout frozen against PG 16.11 real captures + server headers
 * (itup.h / nbtree.h); deviations from design §3 are recorded in
 * workflow/docs/features/index-key-decode/dev-notes.md:
 *   - null bitmap allocates a fixed 4B (INDEX_MAX_KEYS), data starts at
 *     MAXALIGN(8+4)=16 when INDEX_NULL_MASK is set
 *   - bitmap bits are INVERTED vs heap: set = value present, clear = NULL
 *   - fixed-length by-value columns are attalign-aligned; varlenas are packed
 *   - pivot nkeyatts = ip_posid & BT_OFFSET_MASK (direct); minus-infinity = 0
 *   - trailing 6B heap TID presence is the BT_PIVOT_HEAP_TID_ATTR bit
 */
import { describe, expect, it } from "vitest";
import {
  buildBtreePage,
  parseBtreePage,
  decodeIndexTupleKeys,
  type IndexColumnMeta,
} from "../src/index.js";

function page1(tuple: Parameters<typeof buildBtreePage>[0]["tuples"]): ReturnType<typeof parseBtreePage> {
  return parseBtreePage(buildBtreePage({ pageType: "leaf", tuples: tuple }));
}

function col(attnum: number, name: string, typoid: number, typname: string): IndexColumnMeta {
  return { attnum, name, typoid, typname };
}

describe("decodeIndexTupleKeys — P0 scalar types (single-column leaves)", () => {
  it("bool: 1 byte, true/false", () => {
    const page = page1([{ tidBlock: 0, tidOffset: 1, keyBytes: new Uint8Array([1]) }]);
    const out = decodeIndexTupleKeys(page, page.tuples[0]!, [col(1, "v", 16, "bool")]);
    expect(out[0]!.status).toBe("value");
    expect(out[0]!.display).toBe("true");
    const page0 = page1([{ tidBlock: 0, tidOffset: 1, keyBytes: new Uint8Array([0]) }]);
    const out0 = decodeIndexTupleKeys(page0, page0.tuples[0]!, [col(1, "v", 16, "bool")]);
    expect(out0[0]!.display).toBe("false");
  });

  it("int2/int4: signed little-endian decimals", () => {
    const be = (n: number, len: number): Uint8Array => {
      const b = new Uint8Array(len);
      new DataView(b.buffer).setInt16(0, n, true);
      if (len === 4) new DataView(b.buffer).setInt32(0, n, true);
      return b;
    };
    const page = page1([{ tidBlock: 0, tidOffset: 1, keyBytes: be(-1234, 2) }]);
    expect(decodeIndexTupleKeys(page, page.tuples[0]!, [col(1, "s", 21, "int2")])[0]!.display).toBe("-1234");
    const page4 = page1([{ tidBlock: 0, tidOffset: 1, keyBytes: be(-100000, 4) }]);
    expect(decodeIndexTupleKeys(page4, page4.tuples[0]!, [col(1, "i", 23, "int4")])[0]!.display).toBe("-100000");
  });

  it("int8: BigInt decimal beyond Number precision", () => {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setBigInt64(0, 9007199254740993n, true);
    const page = page1([{ tidBlock: 0, tidOffset: 1, keyBytes: b }]);
    expect(decodeIndexTupleKeys(page, page.tuples[0]!, [col(1, "b", 20, "int8")])[0]!.display).toBe("9007199254740993");
  });

  it("text/varchar/bpchar: 1B varlena header, single-quoted, embedded quotes not escaped", () => {
    // short varlena "hi": header (3<<1)|1 = 7
    const key = new Uint8Array([0x07, 0x68, 0x69]);
    for (const [oid, tn] of [
      [25, "text"],
      [1043, "varchar"],
      [1042, "bpchar"],
    ] as const) {
      const page = page1([{ tidBlock: 0, tidOffset: 1, keyBytes: key }]);
      const out = decodeIndexTupleKeys(page, page.tuples[0]!, [col(1, "s", oid, tn)]);
      expect(out[0]!.display).toBe("'hi'");
    }
    // with an embedded single quote: it's O'Brien
    const ob = new TextEncoder().encode("O'Brien");
    const q = new Uint8Array(1 + ob.length);
    q[0] = ((1 + ob.length) << 1) | 1;
    q.set(ob, 1);
    const pageQ = page1([{ tidBlock: 0, tidOffset: 1, keyBytes: q }]);
    expect(decodeIndexTupleKeys(pageQ, pageQ.tuples[0]!, [col(1, "s", 25, "text")])[0]!.display).toBe("'O'Brien'");
  });

  it("text: invalid UTF-8 bytes escape as \\xNN", () => {
    const payload = new Uint8Array([0x61, 0xff, 0xfe, 0x62]); // a \xff \xfe b
    const key = new Uint8Array(1 + payload.length);
    key[0] = ((1 + payload.length) << 1) | 1;
    key.set(payload, 1);
    const page = page1([{ tidBlock: 0, tidOffset: 1, keyBytes: key }]);
    expect(decodeIndexTupleKeys(page, page.tuples[0]!, [col(1, "s", 25, "text")])[0]!.display).toBe("'a\\xff\\xfeb'");
  });

  it("date: days since 2000-01-01 incl. leap day, BC-era and ±infinity sentinels", () => {
    const mk = (n: number): Uint8Array => {
      const b = new Uint8Array(4);
      new DataView(b.buffer).setInt32(0, n, true);
      return b;
    };
    const cases: Array<[number, string]> = [
      [0, "2000-01-01"],
      [59, "2000-02-29"],
      [-1, "1999-12-31"],
      [-730119, "0001-01-01"],
      [8932, "2024-06-15"],
      [0x7fffffff, "infinity"],
      [-0x80000000, "-infinity"],
    ];
    for (const [days, want] of cases) {
      const page = page1([{ tidBlock: 0, tidOffset: 1, keyBytes: mk(days) }]);
      expect(decodeIndexTupleKeys(page, page.tuples[0]!, [col(1, "d", 1082, "date")])[0]!.display).toBe(want);
    }
  });

  it("timestamp: microsecond precision without timezone suffix", () => {
    const mk = (us: bigint): Uint8Array => {
      const b = new Uint8Array(8);
      new DataView(b.buffer).setBigInt64(0, us, true);
      return b;
    };
    const cases: Array<[bigint, string]> = [
      [0n, "2000-01-01T00:00:00"],
      [-1n, "1999-12-31T23:59:59.999999"],
      [1n, "2000-01-01T00:00:00.000001"],
      [770529923456123n, "2024-06-01T04:05:23.456123"],
      [0x7fffffffffffffffn, "infinity"],
      [-0x8000000000000000n, "-infinity"],
    ];
    for (const [us, want] of cases) {
      const page = page1([{ tidBlock: 0, tidOffset: 1, keyBytes: mk(us) }]);
      expect(decodeIndexTupleKeys(page, page.tuples[0]!, [col(1, "ts", 1114, "timestamp")])[0]!.display).toBe(want);
    }
  });

  it("timestamptz: same encoding with fixed Z suffix", () => {
    const mk = (us: bigint): Uint8Array => {
      const b = new Uint8Array(8);
      new DataView(b.buffer).setBigInt64(0, us, true);
      return b;
    };
    const page = page1([{ tidBlock: 0, tidOffset: 1, keyBytes: mk(770529923456123n) }]);
    expect(decodeIndexTupleKeys(page, page.tuples[0]!, [col(1, "t", 1184, "timestamptz")])[0]!.display).toBe(
      "2024-06-01T04:05:23.456123Z",
    );
  });

  it("uuid: lowercase hyphenated 8-4-4-4-12", () => {
    const key = Uint8Array.from([0xde, 0xad, 0xbe, 0xef, 0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0, 0x12, 0x34, 0x56, 0x78]);
    const page = page1([{ tidBlock: 0, tidOffset: 1, keyBytes: key }]);
    expect(decodeIndexTupleKeys(page, page.tuples[0]!, [col(1, "u", 2950, "uuid")])[0]!.display).toBe(
      "deadbeef-1234-5678-9abc-def012345678",
    );
  });
});

describe("decodeIndexTupleKeys — stepping (frozen rules)", () => {
  const cols: IndexColumnMeta[] = [
    col(1, "s", 21, "int2"),
    col(2, "t", 25, "text"),
    col(3, "b", 20, "int8"),
  ];

  function key(st: number, text: string, big: bigint): Uint8Array {
    // int2 at 0..2; varlena packed at 2 (NOT aligned); int8 aligned to 8
    const t = new TextEncoder().encode(text);
    const varlena = 1 + t.length;
    const int8off = Math.ceil((2 + varlena) / 8) * 8;
    const buf = new Uint8Array(int8off + 8);
    new DataView(buf.buffer).setInt16(0, st, true);
    buf[2] = (varlena << 1) | 1;
    buf.set(t, 3);
    new DataView(buf.buffer).setBigInt64(int8off, big, true);
    return buf;
  }

  it("multi-column: varlena packed after int2, int8 attalign 'd'-aligned; ranges reported", () => {
    const k = key(7, "xy", 42n);
    const page = page1([{ tidBlock: 0, tidOffset: 1, keyBytes: k }]);
    const t = page.tuples[0]!;
    const out = decodeIndexTupleKeys(page, t, cols);
    expect(out.map((c) => c.display)).toEqual(["7", "'xy'", "42"]);
    const base = t.range.start + 8;
    expect(out[0]!.range).toEqual({ start: base, end: base + 2 });
    expect(out[1]!.range).toEqual({ start: base + 2, end: base + 5 });
    expect(out[2]!.range).toEqual({ start: base + 8, end: base + 16 });
  });

  it("NULL bitmap: inverted bits, fixed 4B allocation, data starts at 16", () => {
    // (s int2 NULL, t text 'xy', b int8 NULL): bitmap byte0 = 0b00000100 (only attnum2 set)
    const t = new TextEncoder().encode("xy");
    const varlena = 1 + t.length;
    const buf = new Uint8Array(3 + varlena);
    buf[0] = (varlena << 1) | 1;
    buf.set(t, 1);
    const page = page1([
      { tidBlock: 0, tidOffset: 1, keyBytes: buf, nullAttnums: [] as number[], nulls: true },
    ]);
    // builder writes inverted bitmap: pass explicit non-null attnums
    const page2 = page1([
      { tidBlock: 0, tidOffset: 1, keyBytes: buf, presentAttnums: [2] },
    ]);
    void page;
    const tuple = page2.tuples[0]!;
    expect(tuple.hasNulls).toBe(true);
    const out = decodeIndexTupleKeys(page2, tuple, cols);
    expect(out[0]!.status).toBe("null");
    expect(out[1]!.display).toBe("'xy'");
    expect(out[1]!.range).toEqual({ start: tuple.range.start + 16, end: tuple.range.start + 16 + 3 });
    expect(out[2]!.status).toBe("null");
  });

  it("9-column index: second bitmap byte (attnum 9 NULL)", () => {
    const cols9: IndexColumnMeta[] = Array.from({ length: 9 }, (_, i) => col(i + 1, `c${i + 1}`, 16, "bool"));
    const key = new Uint8Array([1, 0, 1, 0, 1, 0, 1, 0]); // 8 bools
    const page = page1([
      { tidBlock: 0, tidOffset: 1, keyBytes: key, presentAttnums: [1, 2, 3, 4, 5, 6, 7, 8] }, // attnum 9 NULL
    ]);
    const out = decodeIndexTupleKeys(page, page.tuples[0]!, cols9);
    expect(out[0]!.display).toBe("true");
    expect(out[7]!.display).toBe("false");
    expect(out[8]!.status).toBe("null");
  });

  it("posting tuple: keys decoded from keyRange (TID list excluded)", () => {
    const k = new Uint8Array(4);
    new DataView(k.buffer).setInt32(0, 77, true);
    const page = page1([
      {
        tidBlock: 0,
        tidOffset: 0,
        keyBytes: k,
        posting: [
          { blockNumber: 3, offsetNumber: 7 },
          { blockNumber: 3, offsetNumber: 9 },
        ],
      },
    ]);
    const out = decodeIndexTupleKeys(page, page.tuples[0]!, [col(1, "a", 23, "int4")]);
    expect(out[0]!.display).toBe("77");
  });

  it("pivot with trailing heap TID: TID bytes excluded from key area", () => {
    const k = new Uint8Array(4);
    new DataView(k.buffer).setInt32(0, 262, true);
    const page = page1([
      { tidBlock: 2, tidOffset: 0, keyBytes: k, pivotNKeyAtts: 1, pivotHeapTid: { blockNumber: 116, offsetNumber: 135 } },
    ]);
    const out = decodeIndexTupleKeys(page, page.tuples[0]!, [col(1, "a", 23, "int4")]);
    expect(out[0]!.display).toBe("262");
    expect(out[0]!.range!.end).toBeLessThanOrEqual(page.tuples[0]!.range.end - 6);
  });

  it("pivot suffix truncation: attnum > nkeyatts columns are null (INCLUDE cols included)", () => {
    const cols3: IndexColumnMeta[] = [
      col(1, "a", 23, "int4"),
      col(2, "b", 25, "text"),
      col(3, "c", 23, "int4"),
    ];
    const k = new Uint8Array(4);
    new DataView(k.buffer).setInt32(0, 5, true);
    const page = page1([{ tidBlock: 2, tidOffset: 0, keyBytes: k, pivotNKeyAtts: 1 }]);
    const out = decodeIndexTupleKeys(page, page.tuples[0]!, cols3);
    expect(out[0]!.display).toBe("5");
    expect(out[1]!.status).toBe("null");
    expect(out[2]!.status).toBe("null");
  });

  it("minus-infinity pivot (posid==0): all columns null", () => {
    const page = page1([
      { tidBlock: 1, tidOffset: 0, keyBytes: new Uint8Array(0), pivot: true },
    ]);
    const out = decodeIndexTupleKeys(page, page.tuples[0]!, [
      col(1, "a", 23, "int4"),
      col(2, "b", 25, "text"),
    ]);
    expect(out.every((c) => c.status === "null")).toBe(true);
  });

  it("4B varlena header (>127B total) steps by w>>2", () => {
    const payload = new TextEncoder().encode("C".repeat(200));
    const key = new Uint8Array(4 + payload.length);
    new DataView(key.buffer).setUint32(0, (4 + payload.length) << 2, true);
    key.set(payload, 4);
    const page = page1([{ tidBlock: 0, tidOffset: 1, keyBytes: key }]);
    const out = decodeIndexTupleKeys(page, page.tuples[0]!, [col(1, "s", 25, "text")]);
    expect(out[0]!.display).toBe(`'${"C".repeat(200)}'`);
  });
});

describe("decodeIndexTupleKeys — degradation", () => {
  it("unsupported typoid: column unsupported, following columns degrade", () => {
    const cols: IndexColumnMeta[] = [
      col(1, "a", 23, "int4"),
      col(2, "j", 3802, "jsonb"),
      col(3, "b", 20, "int8"),
    ];
    const k = new Uint8Array(8);
    new DataView(k.buffer).setInt32(0, 1, true);
    const page = page1([{ tidBlock: 0, tidOffset: 1, keyBytes: k }]);
    const out = decodeIndexTupleKeys(page, page.tuples[0]!, cols);
    expect(out[0]!.display).toBe("1");
    expect(out[1]!.status).toBe("unsupported");
    expect(out[1]!.reason).toBe("unsupported type: jsonb");
    expect(out[2]!.status).toBe("error");
    expect(out[2]!.reason).toMatch(/jsonb/);
  });

  it("compressed/external varlena tag: column error, later columns degrade", () => {
    const key = new Uint8Array([0x02, 0x00, 0x00, 0x00, 1, 2, 3, 4]);
    const cols: IndexColumnMeta[] = [col(1, "s", 25, "text"), col(2, "a", 23, "int4")];
    const page = page1([{ tidBlock: 0, tidOffset: 1, keyBytes: key }]);
    const out = decodeIndexTupleKeys(page, page.tuples[0]!, cols);
    expect(out[0]!.status).toBe("error");
    expect(out[0]!.reason).toMatch(/compress|external/i);
    expect(out[1]!.status).toBe("error");
  });

  it("truncated tuple: insufficient bytes → error and subsequent degrade", () => {
    const k = new Uint8Array(2); // int4 needs 4
    const cols: IndexColumnMeta[] = [col(1, "a", 23, "int4"), col(2, "b", 21, "int2")];
    const page = page1([{ tidBlock: 0, tidOffset: 1, keyBytes: k }]);
    const out = decodeIndexTupleKeys(page, page.tuples[0]!, cols);
    expect(out[0]!.status).toBe("error");
    expect(out[0]!.reason).toMatch(/insufficient|truncat/i);
    expect(out[1]!.status).toBe("error");
  });

  it("varlena length overrun → error", () => {
    const key = new Uint8Array([0x19, 0x61]); // claims 12 total, only 2 present
    const page = page1([{ tidBlock: 0, tidOffset: 1, keyBytes: key }]);
    const out = decodeIndexTupleKeys(page, page.tuples[0]!, [col(1, "s", 25, "text")]);
    expect(out[0]!.status).toBe("error");
  });

  it("trailing pad ≤7B after last column is tolerated", () => {
    const k = new Uint8Array(4 + 3); // int4 + 3 pad
    new DataView(k.buffer).setInt32(0, 9, true);
    const page = page1([{ tidBlock: 0, tidOffset: 1, keyBytes: k }]);
    const out = decodeIndexTupleKeys(page, page.tuples[0]!, [col(1, "a", 23, "int4")]);
    expect(out[0]!.display).toBe("9");
  });
});

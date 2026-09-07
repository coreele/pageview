import { describe, expect, it } from "vitest";
import { buildUrlState, parseUrlState, type UrlState } from "./urlState";

function st(overrides: Partial<UrlState> = {}): UrlState {
  return {
    mode: "page",
    kind: "table",
    table: null,
    index: null,
    blkno: null,
    startLsn: null,
    endLsn: null,
    ...overrides,
  };
}

const NEXT_STEP =
  "Fix or remove the URL parameters in the address bar, then reload. The app stays usable on the default view.";

describe("parseUrlState — valid values", () => {
  it("empty search yields the all-default state", () => {
    for (const search of ["", "?"]) {
      const res = parseUrlState(search);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.state).toEqual(st());
    }
  });

  it("explicit defaults equal implicit defaults", () => {
    const res = parseUrlState("?mode=page&kind=table");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.state).toEqual(st());
  });

  it("accepts search with or without the leading question mark", () => {
    const a = parseUrlState("mode=wal&startLsn=0/1&endLsn=0/2");
    const b = parseUrlState("?mode=wal&startLsn=0/1&endLsn=0/2");
    expect(a).toEqual(b);
    expect(a.ok && a.state.mode).toBe("wal");
  });

  it("parses oid boundaries 1 and 4294967295 (BAD_OID parity)", () => {
    const res = parseUrlState("?mode=page&kind=table&table=1&index=4294967295");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.state.table).toBe(1);
      expect(res.state.index).toBe(4294967295);
    }
  });

  it("parses blkno 0 and leaves the upper bound to the object layer (BAD_BLKNO parity)", () => {
    const res = parseUrlState("?mode=page&kind=table&table=16384&blkno=0");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.state.blkno).toBe(0);
    const big = parseUrlState("?mode=page&kind=table&table=16384&blkno=8589934592");
    expect(big.ok).toBe(true);
  });

  it("parses LSNs case-insensitively and trims surrounding whitespace (wal-core LSN_RE parity)", () => {
    const res = parseUrlState("?mode=wal&startLsn=0%2F16b3748&endLsn=%20ABC%2Fdef%20");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.state.startLsn).toBe("0/16b3748");
      expect(res.state.endLsn).toBe("ABC/def");
    }
  });

  it("ignores unknown parameter names (forward compatibility)", () => {
    const withFoo = parseUrlState("?foo=1&mode=wal");
    const withoutFoo = parseUrlState("?mode=wal");
    expect(withFoo).toEqual(withoutFoo);
  });

  it("mode=wal discards kind (P1: kind ignored under wal, even an invalid one)", () => {
    const res = parseUrlState("?mode=wal&kind=index");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.state.kind).toBe("table");
    const badKind = parseUrlState("?mode=wal&kind=xyz");
    expect(badKind.ok).toBe(true);
  });

  it("first occurrence wins for repeated parameter names", () => {
    const res = parseUrlState("?mode=wal&mode=page&table=5&table=7");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.state.mode).toBe("wal");
      expect(res.state.table).toBe(5);
    }
  });
});

describe("parseUrlState — invalid values (BAD_URL_PARAM, frozen copy)", () => {
  const cases: Array<[string, string]> = [
    ["?mode=xyz", 'Invalid URL parameter mode="xyz" (expected "page" or "wal")'],
    ["?mode=page&kind=x", 'Invalid URL parameter kind="x" (expected "table" or "index")'],
    ["?table=abc", 'Invalid URL parameter table="abc" (expected an integer in 1..4294967295)'],
    ["?table=-1", 'Invalid URL parameter table="-1" (expected an integer in 1..4294967295)'],
    ["?table=0", 'Invalid URL parameter table="0" (expected an integer in 1..4294967295)'],
    ["?table=4294967296", 'Invalid URL parameter table="4294967296" (expected an integer in 1..4294967295)'],
    ["?table=", 'Invalid URL parameter table="" (expected an integer in 1..4294967295)'],
    ["?table=1.5", 'Invalid URL parameter table="1.5" (expected an integer in 1..4294967295)'],
    ["?index=abc", 'Invalid URL parameter index="abc" (expected an integer in 1..4294967295)'],
    ["?blkno=-1", 'Invalid URL parameter blkno="-1" (expected a non-negative integer)'],
    ["?blkno=1.5", 'Invalid URL parameter blkno="1.5" (expected a non-negative integer)'],
    ["?startLsn=ZZ", 'Invalid URL parameter startLsn="ZZ" (expected an LSN like 0/16B3748)'],
    ["?startLsn=0x1", 'Invalid URL parameter startLsn="0x1" (expected an LSN like 0/16B3748)'],
    ["?startLsn=2", 'Invalid URL parameter startLsn="2" (expected an LSN like 0/16B3748)'],
    ["?endLsn=ZZ", 'Invalid URL parameter endLsn="ZZ" (expected an LSN like 0/16B3748)'],
  ];
  for (const [search, message] of cases) {
    it(`${search} -> BAD_URL_PARAM with frozen message`, () => {
      const res = parseUrlState(search);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe("BAD_URL_PARAM");
        expect(res.error.message).toBe(message);
        expect(res.error.nextStep).toBe(NEXT_STEP);
      }
    });
  }

  it("checks parameters in a fixed order (mode, kind, table, index, blkno, LSNs)", () => {
    const a = parseUrlState("?table=abc&mode=xyz");
    expect(!a.ok && a.error.message.startsWith('Invalid URL parameter mode=')).toBe(true);
    const b = parseUrlState("?blkno=-1&table=abc");
    expect(!b.ok && b.error.message.startsWith('Invalid URL parameter table=')).toBe(true);
    const c = parseUrlState("?startLsn=ZZ&blkno=-1");
    expect(!c.ok && c.error.message.startsWith('Invalid URL parameter blkno=')).toBe(true);
  });
});

describe("buildUrlState — canonical output", () => {
  it("all-default state builds the empty string (bare URL)", () => {
    expect(buildUrlState(st())).toBe("");
  });

  it("P0-1: table view with a loaded block", () => {
    expect(buildUrlState(st({ table: 16384, blkno: 5 }))).toBe(
      "?mode=page&kind=table&table=16384&blkno=5",
    );
  });

  it("blkno is not encoded while unloaded (Load-success commit point only)", () => {
    expect(buildUrlState(st({ table: 16384 }))).toBe("?mode=page&kind=table&table=16384");
  });

  it("P0-2: index view (fixed order mode,kind,table,index,blkno; blkno 0 encoded when loaded)", () => {
    expect(buildUrlState(st({ kind: "index", table: 16384, index: 24576, blkno: 0 }))).toBe(
      "?mode=page&kind=index&table=16384&index=24576&blkno=0",
    );
  });

  it("kind=index without an index selection omits the index param", () => {
    expect(buildUrlState(st({ kind: "index", table: 16384 }))).toBe(
      "?mode=page&kind=index&table=16384",
    );
  });

  it("index is filtered out when kind=table", () => {
    expect(buildUrlState(st({ kind: "table", table: 16384, index: 24576, blkno: 2 }))).toBe(
      "?mode=page&kind=table&table=16384&blkno=2",
    );
  });

  it("P0-3: WAL view encodes the LSN pair (URLSearchParams / -> %2F)", () => {
    expect(buildUrlState(st({ mode: "wal", startLsn: "0/16B3748", endLsn: "0/16B4000" }))).toBe(
      "?mode=wal&startLsn=0%2F16B3748&endLsn=0%2F16B4000",
    );
  });

  it("bare wal mode without loaded LSNs encodes only mode=wal", () => {
    expect(buildUrlState(st({ mode: "wal" }))).toBe("?mode=wal");
  });

  it("page->wal filters all page params (P1 canonical form)", () => {
    expect(
      buildUrlState(
        st({ mode: "wal", kind: "index", table: 5, index: 7, blkno: 3, startLsn: "0/1", endLsn: "0/2" }),
      ),
    ).toBe("?mode=wal&startLsn=0%2F1&endLsn=0%2F2");
  });

  it("single LSN encodes alone", () => {
    expect(buildUrlState(st({ mode: "wal", startLsn: "0/1" }))).toBe("?mode=wal&startLsn=0%2F1");
  });
});

describe("round-trip: parse(build(s)) === s", () => {
  const canonical: UrlState[] = [
    st(),
    st({ table: 16384 }),
    st({ table: 1, blkno: 0 }),
    st({ table: 4294967295, blkno: 4294967295 }),
    st({ kind: "index", table: 16384, index: 24576, blkno: 0 }),
    st({ kind: "index", table: 16384 }),
    st({ mode: "wal" }),
    st({ mode: "wal", startLsn: "0/16B3748", endLsn: "0/16B4000" }),
    st({ mode: "wal", startLsn: "ABC/def", endLsn: "ABC/def0" }),
    st({ mode: "wal", startLsn: "0/1" }),
  ];
  for (const s of canonical) {
    it(`${JSON.stringify(s)} survives build -> parse`, () => {
      const res = parseUrlState(buildUrlState(s));
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.state).toEqual(s);
    });
  }

  it("accepts both %2F and raw / LSN forms (copy/paste round-trip, M8)", () => {
    const encoded = parseUrlState("?mode=wal&startLsn=0%2F16B3748&endLsn=0%2F16B4000");
    const raw = parseUrlState("?mode=wal&startLsn=0/16B3748&endLsn=0/16B4000");
    expect(encoded).toEqual(raw);
    expect(encoded.ok && encoded.state.startLsn).toBe("0/16B3748");
  });
});

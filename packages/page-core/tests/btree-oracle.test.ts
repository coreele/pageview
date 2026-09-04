import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BTREE_MAGIC, parseBtreePage, decodeIndexTupleKeys, type IndexColumnMeta } from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "../fixtures");

type OracleTid = string; // "(block,offset)"

type OracleItem = {
  itemoffset: number;
  ctid: OracleTid;
  itemlen: number;
  nulls: boolean | null;
  vars: boolean | null;
  /** postgres array literal, e.g. `{"(0,50)","(0,100)"}` */
  tids: string | null;
};

type Oracle = {
  index: string;
  blkno: number;
  btMetap: Record<string, unknown> | null;
  btMetapError: string | null;
  btPageStats: Record<string, unknown> | null;
  btPageStatsError: string | null;
  btPageItems: OracleItem[];
  btPageItemsError: string | null;
  indexColumns?: OracleIndexColumns | null;
  tableRows?: OracleTableRow[] | null;
};

function loadScene(name: string): { raw: Uint8Array; oracle: Oracle } {
  const bin = join(fixturesDir, `${name}.bin`);
  const oraclePath = join(fixturesDir, `${name}.oracle.json`);
  if (!existsSync(bin) || !existsSync(oraclePath)) {
    throw new Error(`Fixture ${name} missing — run scripts/capture-fixtures.ts --index (see fixtures README)`);
  }
  return {
    raw: new Uint8Array(readFileSync(bin)),
    oracle: JSON.parse(readFileSync(oraclePath, "utf8")) as Oracle,
  };
}

function parseTid(tid: OracleTid): { blockNumber: number; offsetNumber: number } {
  const m = /^\((\d+),(\d+)\)$/.exec(tid);
  if (!m) throw new Error(`Unparseable tid ${tid}`);
  return { blockNumber: Number(m[1]), offsetNumber: Number(m[2]) };
}

/** Parse a postgres tid[] array literal into TIDs. */
function parseTidArrayLiteral(lit: string): Array<{ blockNumber: number; offsetNumber: number }> {
  const out: Array<{ blockNumber: number; offsetNumber: number }> = [];
  for (const m of lit.matchAll(/\((\d+),(\d+)\)/g)) {
    out.push({ blockNumber: Number(m[1]), offsetNumber: Number(m[2]) });
  }
  return out;
}

function tidString(t: { blockNumber: number; offsetNumber: number }): string {
  return `(${t.blockNumber},${t.offsetNumber})`;
}

function expectFieldsMatchOracle(page: ReturnType<typeof parseBtreePage>, oracle: Oracle): void {
  const stats = oracle.btPageStats!;
  expect(page.special).not.toBeNull();
  expect(page.special!.btpo_prev).toBe(Number(stats.btpo_prev));
  expect(page.special!.btpo_next).toBe(Number(stats.btpo_next));
  expect(page.special!.btpo_level).toBe(Number(stats.btpo_level));
  expect(page.special!.btpo_flags).toBe(Number(stats.btpo_flags));
  expect(page.special!.btpo_cycleid).toBe(0); // no concurrent VACUUM splits in fixtures

  expect(page.tuples.length).toBe(oracle.btPageItems.length);
  for (let i = 0; i < oracle.btPageItems.length; i++) {
    const o = oracle.btPageItems[i]!;
    const t = page.tuples[i]!;
    expect(t.itemoffset).toBe(o.itemoffset);
    expect(tidString(t.t_tid)).toBe(o.ctid);
    expect(t.itemlen).toBe(o.itemlen);
    expect(t.hasNulls).toBe(Boolean(o.nulls));
    expect(t.hasVars).toBe(Boolean(o.vars));
    if (o.tids != null) {
      const oracleTids = parseTidArrayLiteral(o.tids);
      expect(t.isPosting).toBe(true);
      expect(t.postingCount).toBe(oracleTids.length);
      expect(t.postingTids!.map(tidString)).toEqual(oracleTids.map(tidString));
    } else {
      expect(t.isPosting).toBe(false);
      expect(t.postingTids).toBeUndefined();
    }
  }
}

describe("btree oracle fixtures (PG 16.11 real captures)", () => {
  it("btree-meta: parsed metapage equals bt_metap; pageinspect rejects stats/items on metapages", () => {
    const { raw, oracle } = loadScene("btree-meta");
    const page = parseBtreePage(raw);

    expect(page.pageType).toBe("meta");
    expect(oracle.btPageStats).toBeNull();
    expect(oracle.btPageItemsError).toMatch(/block 0 is a meta page/i);

    const m = oracle.btMetap!;
    expect(page.meta!.btm_magic).toBe(Number(m.magic));
    expect(page.meta!.btm_magic).toBe(BTREE_MAGIC);
    expect(page.meta!.btm_version).toBe(Number(m.version));
    expect(page.meta!.btm_root).toBe(Number(m.root));
    expect(page.meta!.btm_level).toBe(Number(m.level));
    expect(page.meta!.btm_fastroot).toBe(Number(m.fastroot));
    expect(page.meta!.btm_fastlevel).toBe(Number(m.fastlevel));
    expect(page.meta!.btm_allequalimage).toBe(Boolean(m.allequalimage));
    // metapage carries only placeholder (UNUSED) line pointers — no index tuples
    expect(page.tuples).toHaveLength(0);
    expect(page.warnings).toHaveLength(0);
  });

  it("btree-internal: root internal page matches bt_page_stats/bt_page_items", () => {
    const { raw, oracle } = loadScene("btree-internal");
    const page = parseBtreePage(raw);
    expect(page.pageType).toBe("internal");
    expect(page.special!.btpo_level).toBeGreaterThan(0);
    expectFieldsMatchOracle(page, oracle);
    // captured root is the rightmost page (btpo_next=0): per P0-7 its first
    // tuple carries NO hikey mark — the real-world rightmost counterexample
    const first = page.tuples[0]!;
    expect(page.special!.btpo_next).toBe(0);
    expect(page.flags.isRightmost).toBe(true);
    expect(page.tuples.every((t) => !t.isHikey)).toBe(true);
    // ...but it is still the minus-infinity pivot downlink: ALT bit, no posting
    expect(first.isPivot).toBe(true);
    expect(first.isPosting).toBe(false);
    // every internal tuple is a pivot downlink: child block in t_tid > 0
    for (const t of page.tuples) {
      expect(t.isPivot).toBe(true);
      expect(t.isPosting).toBe(false);
      expect(t.t_tid.blockNumber).toBeGreaterThan(0);
    }
  });

  it("btree-leaf: plain leaf matches oracle with no posting tuples", () => {
    const { raw, oracle } = loadScene("btree-leaf");
    const page = parseBtreePage(raw);
    expect(page.pageType).toBe("leaf");
    expectFieldsMatchOracle(page, oracle);
    expect(page.stats.postingTupleCount).toBe(0);
    // non-rightmost leaf (btpo_next=2): first tuple is the hikey
    expect(page.special!.btpo_next).toBe(2);
    expect(page.tuples[0]!.isHikey).toBe(true);
    expect(page.tuples.slice(1).every((t) => !t.isHikey)).toBe(true);
  });

  it("btree-posting: dedup leaf matches oracle incl. full posting TID lists", () => {
    const { raw, oracle } = loadScene("btree-posting");
    const page = parseBtreePage(raw);
    expect(page.pageType).toBe("leaf");
    expectFieldsMatchOracle(page, oracle);

    const postings = page.tuples.filter((t) => t.isPosting);
    expect(postings.length).toBeGreaterThan(0);
    for (const p of postings) {
      expect(p.postingCount).toBeGreaterThan(1);
      expect(p.postingTids).toHaveLength(p.postingCount);
    }
    const oraclePostingTids = oracle.btPageItems
      .filter((i) => i.tids != null)
      .flatMap((i) => parseTidArrayLiteral(i.tids!));
    const parsedPostingTids = postings.flatMap((p) => p.postingTids!);
    expect(parsedPostingTids).toEqual(oraclePostingTids);
  });
});

// ---------------------------------------------------------------------------
// index-key-decode T3: decode oracle — decoded key values must equal the
// owning-table row values (UTC session ::text) captured alongside each page.
// ---------------------------------------------------------------------------

type OracleIndexColumns = {
  oid: number;
  indnatts: number;
  indnkeyatts: number;
  indkey: number[];
  indoption: string;
  hasExpression: boolean;
  columns: Array<{ attnum: number; name: string; typoid: number; typname: string; typmod: number }>;
};

type OracleTableRow = {
  itemoffset: number;
  ctid: string;
  htid: string | null;
  firstTid: string | null;
  values: Array<string | null> | null;
};

function loadIndexScene(name: string): {
  page: ReturnType<typeof parseBtreePage>;
  ic: OracleIndexColumns;
  rows: Map<number, OracleTableRow>;
} {
  const { raw, oracle } = loadScene(name);
  const ic = oracle.indexColumns ?? null;
  if (!ic) throw new Error(`Fixture ${name} has no indexColumns oracle`);
  return {
    page: parseBtreePage(raw),
    ic,
    rows: new Map((oracle.tableRows ?? [])?.map((r) => [Number(r.itemoffset), r]) ?? []),
  };
}

function metaFromOracle(ic: OracleIndexColumns): IndexColumnMeta[] {
  return ic.columns.map((c) => ({
    attnum: c.attnum,
    name: c.name,
    typoid: c.typoid,
    typname: c.typname,
    kind: c.attnum <= ic.indnkeyatts ? "key" : "include",
  }));
}

/** Normalize a UTC-session ::text row value to the Spec display convention. */
function normalizeText(typname: string, v: string): string {
  switch (typname) {
    case "bool":
      // UTC-session ::text of bool is already 'true'/'false' (also accept psql t/f)
      return v === "t" ? "true" : v === "f" ? "false" : v.toLowerCase();
    case "int2":
    case "int4":
    case "int8":
    case "date":
    case "uuid":
      return typname === "uuid" ? v.toLowerCase() : v;
    case "timestamp":
      return v.replace(" ", "T");
    case "timestamptz":
      return v.replace(" ", "T").replace(/\+00$/, "Z");
    default:
      return `'${v}'`; // text family
  }
}

/** Assert every tuple with a captured row value decodes to that row's values. */
function expectDecodeMatchesRows(
  name: string,
  opts?: { skipAttnums?: number[] },
): void {
  const { page, ic, rows } = loadIndexScene(name);
  if (ic.hasExpression) throw new Error(`${name}: expression index — hex-only, no decode expected`);
  const meta = metaFromOracle(ic);
  const skip = new Set(opts?.skipAttnums ?? []);
  let compared = 0;
  for (const t of page.tuples) {
    const row = rows.get(t.itemoffset);
    if (!row || !row.values) continue;
    const out = decodeIndexTupleKeys(page, t, meta);
    for (let i = 0; i < meta.length; i++) {
      const m = meta[i]!;
      const want = row.values[i];
      const got = out[i]!;
      if (skip.has(m.attnum)) continue;
      if (want === null) {
        expect([got.status, got.display], `${name} itemoffset ${t.itemoffset} attnum ${m.attnum}`).toEqual([
          "null",
          undefined,
        ]);
      } else {
        expect(
          [got.status, got.display],
          `${name} itemoffset ${t.itemoffset} attnum ${m.attnum} (${m.typname})`,
        ).toEqual(["value", normalizeText(m.typname, want)]);
      }
    }
    compared++;
  }
  expect(compared, `${name}: no oracle rows compared`).toBeGreaterThan(0);
}

describe("index-key decode oracle (idx-* real captures)", () => {
  it("idx-composite: (a,b) INCLUDE (c) leaf values equal ctid row values", () => {
    expectDecodeMatchesRows("idx-composite");
  });

  it("idx-composite hikey: suffix-truncated b/c are null; a equals the firstright key (max page a + 1 for the sequential seed)", () => {
    const { page, ic } = loadIndexScene("idx-composite");
    const meta = metaFromOracle(ic);
    const hikey = page.tuples[0]!;
    expect(hikey.isHikey).toBe(true);
    const out = decodeIndexTupleKeys(page, hikey, meta);
    expect(out[1]!.status).toBe("null");
    expect(out[2]!.status).toBe("null");
    const maxA = Math.max(
      ...page.tuples
        .filter((t) => !t.isHikey && !t.isPivot)
        .map((t) => Number(decodeIndexTupleKeys(page, t, meta)[0]!.display)),
    );
    // hikey is the firstright boundary key — NOT present on this page
    expect(Number(out[0]!.display)).toBe(maxA + 1);
  });

  it("idx-composite-internal: pivots keep a (nkeyatts=1), b/c truncated null, values increasing", () => {
    const { page, ic } = loadIndexScene("idx-composite-internal");
    const meta = metaFromOracle(ic);
    let prev = -Infinity;
    let first = true;
    for (const t of page.tuples) {
      expect(t.isPivot).toBe(true);
      const out = decodeIndexTupleKeys(page, t, meta);
      if (first) {
        // minus-infinity downlink: posid == 0, no key attributes
        expect(t.t_tid.offsetNumber & 0x0fff).toBe(0);
        expect(out.every((c) => c.status === "null")).toBe(true);
        first = false;
        continue;
      }
      expect(out[0]!.status).toBe("value");
      expect(out[1]!.status).toBe("null");
      expect(out[2]!.status).toBe("null");
      const a = Number(out[0]!.display);
      expect(a).toBeGreaterThan(prev);
      prev = a;
    }
  });

  it("idx-posting-internal: trailing-heap-TID pivots equal boundary rows", () => {
    const { page, ic, rows } = loadIndexScene("idx-posting-internal");
    const meta = metaFromOracle(ic);
    let compared = 0;
    for (const t of page.tuples) {
      const row = rows.get(t.itemoffset);
      if (!row || !row.values) continue;
      const out = decodeIndexTupleKeys(page, t, meta);
      expect(out[0]!.status).toBe("value");
      expect(out[0]!.display).toBe(row.values[0]);
      compared++;
    }
    expect(compared).toBeGreaterThan(0);
  });

  it("idx-align: varied text lengths + NULL combos (alignment rules)", () => {
    expectDecodeMatchesRows("idx-align");
  });

  it("idx-desc: DESC column bytes decode plain", () => {
    expectDecodeMatchesRows("idx-desc");
  });

  it("idx-bool: posting tuples decode from keyRange", () => {
    expectDecodeMatchesRows("idx-bool");
  });

  it("idx-date: days since epoch incl. ±infinity", () => {
    expectDecodeMatchesRows("idx-date");
  });

  it("idx-timestamp: microsecond precision", () => {
    expectDecodeMatchesRows("idx-timestamp");
  });

  it("idx-timestamptz: UTC rendering with Z", () => {
    expectDecodeMatchesRows("idx-timestamptz");
  });

  it("idx-uuid: lowercase hyphenated", () => {
    expectDecodeMatchesRows("idx-uuid");
  });

  it("idx-null / idx-null2: NULL columns via inverted bitmap", () => {
    expectDecodeMatchesRows("idx-null");
    expectDecodeMatchesRows("idx-null2");
  });

  it("idx-text: short, quoted, control chars, multibyte, 4B headers", () => {
    expectDecodeMatchesRows("idx-text");
  });

  it("idx-jsonb: int4 column decodes, jsonb column degrades as unsupported", () => {
    const { page, ic, rows } = loadIndexScene("idx-jsonb");
    const meta = metaFromOracle(ic);
    let compared = 0;
    for (const t of page.tuples) {
      const row = rows.get(t.itemoffset);
      if (!row || !row.values) continue;
      const out = decodeIndexTupleKeys(page, t, meta);
      expect(out[0]).toMatchObject({ status: "value", display: row.values[0] });
      expect(out[1]!.status).toBe("unsupported");
      expect(out[1]!.reason).toBe("unsupported type: jsonb");
      compared++;
    }
    expect(compared).toBeGreaterThan(0);
  });

  it("idx-expr: metadata marks expression index (hex-only contract)", () => {
    const { ic } = loadIndexScene("idx-expr");
    expect(ic.hasExpression).toBe(true);
    expect(ic.indkey).toContain(0);
    expect(ic.columns[0]!.typname).toBe("text");
  });
});

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BTREE_MAGIC, parseBtreePage } from "../src/index.js";

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

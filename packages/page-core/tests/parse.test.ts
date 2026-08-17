import { describe, expect, it, beforeAll } from "vitest";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  annotateCtidBlocks,
  buildEmptyishPage,
  buildSparsePage,
  decodeInfomask,
  decodePdFlags,
  decodePageTuples,
  PageParseError,
  parsePage,
  SPARSE_SCHEMA,
  STANDARD_PAGE_SIZE,
} from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "../fixtures");

beforeAll(() => {
  mkdirSync(fixturesDir, { recursive: true });
  const raw = buildSparsePage({ withRedirect: true, withHot: true, crossBlockCtid: true });
  writeFileSync(join(fixturesDir, "sparse.bin"), raw);
  writeFileSync(join(fixturesDir, "sparse.base64.txt"), Buffer.from(raw).toString("base64"));
  writeFileSync(join(fixturesDir, "sparse.schema.json"), JSON.stringify(SPARSE_SCHEMA, null, 2));
  writeFileSync(
    join(fixturesDir, "sparse.meta.json"),
    JSON.stringify(
      {
        source: "synthetic-buildSparsePage",
        note: "Replace with PG 16.11 get_raw_page capture when available",
        withRedirect: true,
        withHot: true,
        crossBlockCtid: true,
      },
      null,
      2,
    ),
  );
});

describe("parsePage", () => {
  it("rejects non-8192 page length", () => {
    expect(() => parsePage(new Uint8Array(100))).toThrow(PageParseError);
    expect(() => parsePage(new Uint8Array(100))).toThrow(/8192/);
  });

  it("rejects mismatched pd_pagesize_version size", () => {
    const page = buildSparsePage();
    page[19] = 64;
    expect(() => parsePage(page)).toThrow(/Unsupported/);
  });

  it("parses sparse page header, ItemIds, free space, and stats", () => {
    const raw = buildSparsePage({ withRedirect: true, withHot: true });
    const page = parsePage(raw);

    expect(page.header.pageSize).toBe(STANDARD_PAGE_SIZE);
    expect(page.header.pd_lower).toBeGreaterThan(24);
    expect(page.header.pd_upper).toBeLessThan(STANDARD_PAGE_SIZE);
    expect(page.freeSpace.bytes).toBe(page.header.pd_upper - page.header.pd_lower);
    expect(page.freeSpace.range.start).toBe(page.header.pd_lower);
    expect(page.freeSpace.range.end).toBe(page.header.pd_upper);

    expect(page.stats.itemIdTotal).toBe(page.itemIds.length);
    expect(
      page.stats.lpUnused + page.stats.lpNormal + page.stats.lpRedirect + page.stats.lpDead,
    ).toBe(page.stats.itemIdTotal);
    expect(page.stats.tupleCount).toBe(page.stats.lpNormal);
    expect(page.stats.freeBytes).toBe(page.freeSpace.bytes);

    expect(page.itemIds.find((i) => i.status === "REDIRECT")).toBeDefined();
    expect(page.tuples.length).toBeGreaterThanOrEqual(1);
    expect(page.tuples.find((t) => t.heapOnlyTuple || t.hotUpdated)).toBeDefined();
  });

  it("marks cross-block ctid via annotateCtidBlocks", () => {
    const raw = buildSparsePage({ crossBlockCtid: true, currentBlkno: 0 });
    const page = annotateCtidBlocks(parsePage(raw), 0);
    expect(page.tuples.some((t) => t.ctidCrossBlock)).toBe(true);
    expect(page.tuples[0]!.header.t_ctid.blockNumber).toBe(1);
  });

  it("handles empty page with no ItemIds", () => {
    const page = parsePage(buildEmptyishPage());
    expect(page.itemIds).toHaveLength(0);
    expect(page.tuples).toHaveLength(0);
    expect(page.stats.freeBytes).toBe(STANDARD_PAGE_SIZE - 24);
  });
});

describe("decode + flags", () => {
  it("decodes common columns from sparse fixture", () => {
    const raw = buildSparsePage();
    const page = decodePageTuples(parsePage(raw), SPARSE_SCHEMA);
    expect(page.tuples.length).toBeGreaterThanOrEqual(1);
    const cols = page.tuples[0]!.columns!;
    expect(cols[0]!.name).toBe("id");
    expect(cols[0]!.display).toBe("42");
    expect(cols[1]!.name).toBe("label");
    expect(cols[1]!.display).toBe("hi");
  });

  it("treats dropped columns as placeholders", () => {
    const raw = buildSparsePage();
    const withDroppedMeta = decodePageTuples(parsePage(raw), [
      SPARSE_SCHEMA[0]!,
      {
        attnum: 2,
        name: "gone",
        typname: "text",
        typlen: -1,
        attlen: -1,
        attalign: "i",
        attisdropped: true,
      },
    ]);
    const dropped = withDroppedMeta.tuples[0]!.columns!.find((c) => c.dropped);
    expect(dropped?.display).toBe("(dropped)");
  });

  it("exports infomask bit names", () => {
    const bits = decodeInfomask(0x0100 | 0x0800);
    expect(bits.find((b) => b.name === "HEAP_XMIN_COMMITTED")?.set).toBe(true);
  });

  it("decodes pd_flags including PD_ALL_VISIBLE", () => {
    const allUnset = decodePdFlags(0x0);
    expect(allUnset.filter((b) => b.set)).toHaveLength(0);
    expect(allUnset.some((b) => b.name === "PD_FLAGS_UNKNOWN")).toBe(false);

    const bits = decodePdFlags(0x4);
    expect(bits.find((b) => b.name === "PD_ALL_VISIBLE")?.set).toBe(true);
    expect(bits.find((b) => b.name === "PD_HAS_FREE_LINES")?.set).toBe(false);
    expect(bits.find((b) => b.name === "PD_PAGE_FULL")?.set).toBe(false);
    expect(bits.some((b) => b.name === "PD_FLAGS_UNKNOWN")).toBe(false);

    const mixed = decodePdFlags(0x5);
    expect(mixed.filter((b) => b.set).map((b) => b.name)).toEqual([
      "PD_HAS_FREE_LINES",
      "PD_ALL_VISIBLE",
    ]);

    const unknown = decodePdFlags(0x14);
    expect(unknown.find((b) => b.name === "PD_ALL_VISIBLE")?.set).toBe(true);
    expect(unknown.find((b) => b.name === "PD_FLAGS_UNKNOWN")?.set).toBe(true);
  });

  it("unknown type yields hex without failing page", () => {
    const raw = buildSparsePage();
    const schema = [
      {
        attnum: 1,
        name: "id",
        typname: "mystery_type",
        typlen: 4,
        attlen: 4,
        attalign: "i",
        attisdropped: false,
      },
      SPARSE_SCHEMA[1]!,
    ];
    const page = decodePageTuples(parsePage(raw), schema);
    const col = page.tuples[0]!.columns![0]!;
    expect(col.rawHex || col.display).toMatch(/[0-9a-f]/i);
  });
});

describe("on-disk fixtures", () => {
  it("loads sparse.bin and matches stats consistency", () => {
    const binPath = join(fixturesDir, "sparse.bin");
    expect(existsSync(binPath)).toBe(true);
    const raw = new Uint8Array(readFileSync(binPath));
    const page = parsePage(raw);
    expect(page.stats.itemIdTotal).toBe(
      page.stats.lpUnused + page.stats.lpNormal + page.stats.lpRedirect + page.stats.lpDead,
    );
    expect(page.stats.tupleCount).toBe(page.tuples.length);
  });
});

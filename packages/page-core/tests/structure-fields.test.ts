import { describe, expect, it } from "vitest";
import {
  buildEmptyishPage,
  buildSparsePage,
  cellCapacityChars,
  chooseCellContent,
  computeHexScrollTarget,
  decodePageTuples,
  deriveStructureFields,
  parsePage,
  resolveFieldAt,
  splitFieldIntoRowSegments,
  STRUCTURE_BYTES_PER_ROW,
  SPARSE_SCHEMA,
} from "../src/index.js";

describe("deriveStructureFields", () => {
  it("emits header subfields with exact byte ranges", () => {
    const page = parsePage(buildSparsePage());
    const fields = deriveStructureFields(page);
    const byId = Object.fromEntries(fields.map((f) => [f.id, f]));

    expect(byId["header.pd_lsn.xlogid"]?.range).toEqual({ start: 0, end: 4 });
    expect(byId["header.pd_lsn.xrecoff"]?.range).toEqual({ start: 4, end: 8 });
    expect(byId["header.pd_checksum"]?.range).toEqual({ start: 8, end: 10 });
    expect(byId["header.pd_flags"]?.range).toEqual({ start: 10, end: 12 });
    expect(byId["header.pd_lower"]?.range).toEqual({ start: 12, end: 14 });
    expect(byId["header.pd_upper"]?.range).toEqual({ start: 14, end: 16 });
    expect(byId["header.pd_special"]?.range).toEqual({ start: 16, end: 18 });
    expect(byId["header.pd_pagesize_version"]?.range).toEqual({ start: 18, end: 20 });
    expect(byId["header.pd_prune_xid"]?.range).toEqual({ start: 20, end: 24 });
  });

  it("emits ItemId slots with full 4B range and visual thirds sharing parent", () => {
    const page = parsePage(buildSparsePage({ withRedirect: true }));
    const fields = deriveStructureFields(page);
    const item = page.itemIds[0]!;
    const slot = fields.find((f) => f.id === `itemid-${item.index}`);
    expect(slot?.range).toEqual(item.range);
    expect(slot?.range.end - slot!.range.start).toBe(4);

    const thirds = fields.filter((f) => f.parentId === `itemid-${item.index}`);
    expect(thirds.map((f) => f.label).sort()).toEqual(["flag", "len", "off"].sort());
    for (const t of thirds) {
      expect(t.visualOnly).toBe(true);
      expect(t.range).toEqual(item.range);
    }
  });

  it("emits free space and tuple header / data fields", () => {
    const raw = buildSparsePage({ withHot: true });
    const page = decodePageTuples(parsePage(raw), SPARSE_SCHEMA);
    const fields = deriveStructureFields(page);
    const free = fields.find((f) => f.id === "free");
    expect(free?.range).toEqual(page.freeSpace.range);

    const t = page.tuples[0]!;
    const base = t.range.start;
    const byId = Object.fromEntries(fields.map((f) => [f.id, f]));
    expect(byId[`tuple-${t.itemIndex}.t_xmin`]?.range).toEqual({ start: base, end: base + 4 });
    expect(byId[`tuple-${t.itemIndex}.t_xmax`]?.range).toEqual({ start: base + 4, end: base + 8 });
    expect(byId[`tuple-${t.itemIndex}.t_cid`]?.range).toEqual({ start: base + 8, end: base + 12 });
    expect(byId[`tuple-${t.itemIndex}.t_ctid`]?.range).toEqual({ start: base + 12, end: base + 18 });
    expect(byId[`tuple-${t.itemIndex}.t_infomask2`]?.range).toEqual({
      start: base + 18,
      end: base + 20,
    });
    expect(byId[`tuple-${t.itemIndex}.t_infomask`]?.range).toEqual({
      start: base + 20,
      end: base + 22,
    });
    expect(byId[`tuple-${t.itemIndex}.t_hoff`]?.range).toEqual({ start: base + 22, end: base + 23 });

    const col = t.columns?.find((c) => !c.null && c.range);
    if (col?.range) {
      expect(byId[`tuple-${t.itemIndex}.col-${col.attnum}`]?.range).toEqual(col.range);
    }
  });

  it("does not mutate parsePage semantics (same ranges after derive)", () => {
    const raw = buildSparsePage();
    const a = parsePage(raw);
    const b = parsePage(raw);
    deriveStructureFields(a);
    expect(a.header.range).toEqual(b.header.range);
    expect(a.freeSpace.range).toEqual(b.freeSpace.range);
    expect(a.itemIds.map((i) => i.range)).toEqual(b.itemIds.map((i) => i.range));
    expect(a.tuples.map((t) => t.range)).toEqual(b.tuples.map((t) => t.range));
  });
});

describe("resolveFieldAt", () => {
  it("returns most specific header field", () => {
    const page = parsePage(buildSparsePage());
    const hit = resolveFieldAt(page, 12);
    expect(hit?.id).toBe("header.pd_lower");
    expect(hit?.range).toEqual({ start: 12, end: 14 });
  });

  it("returns ItemId slot (4B) not visual-only thirds", () => {
    const page = parsePage(buildSparsePage());
    const item = page.itemIds.find((i) => i.status === "NORMAL") ?? page.itemIds[0]!;
    const hit = resolveFieldAt(page, item.range.start + 1);
    expect(hit?.id).toBe(`itemid-${item.index}`);
    expect(hit?.range).toEqual(item.range);
    expect(hit?.visualOnly).toBeFalsy();
  });

  it("returns free and tuple subfields", () => {
    const page = parsePage(buildSparsePage());
    const freeHit = resolveFieldAt(page, page.freeSpace.range.start);
    expect(freeHit?.id).toBe("free");

    const t = page.tuples[0]!;
    const xmin = resolveFieldAt(page, t.range.start);
    expect(xmin?.id).toBe(`tuple-${t.itemIndex}.t_xmin`);
    expect(xmin?.range).toEqual({ start: t.range.start, end: t.range.start + 4 });
  });

  it("maps free space on emptyish page", () => {
    const page = parsePage(buildEmptyishPage());
    expect(resolveFieldAt(page, 100)?.id).toBe("free");
  });
});

describe("splitFieldIntoRowSegments", () => {
  it("splits a multi-row field into 32B row segments", () => {
    expect(STRUCTURE_BYTES_PER_ROW).toBe(32);
    const segments = splitFieldIntoRowSegments(
      {
        id: "free",
        label: "free",
        fullLabel: "free space",
        range: { start: 20, end: 70 },
        region: "free",
      },
      STRUCTURE_BYTES_PER_ROW,
    );
    expect(segments).toEqual([
      { fieldId: "free", row: 0, colStart: 20, colEnd: 32, range: { start: 20, end: 32 } },
      { fieldId: "free", row: 1, colStart: 0, colEnd: 32, range: { start: 32, end: 64 } },
      { fieldId: "free", row: 2, colStart: 0, colEnd: 6, range: { start: 64, end: 70 } },
    ]);
  });
});

describe("StructureField.valueText", () => {
  it("formats header, ItemId, and tuple primary values", () => {
    const raw = buildSparsePage({ withHot: true });
    const page = decodePageTuples(parsePage(raw), SPARSE_SCHEMA);
    const byId = Object.fromEntries(deriveStructureFields(page).map((f) => [f.id, f]));
    const [lsnHi, lsnLo] = page.header.pd_lsn.split("/");
    const item = page.itemIds.find((i) => i.status === "NORMAL") ?? page.itemIds[0]!;
    const t = page.tuples[0]!;

    expect(byId["header.pd_lsn.xlogid"]?.valueText).toBe(lsnHi);
    expect(byId["header.pd_lsn.xrecoff"]?.valueText).toBe(lsnLo);
    expect(byId["header.pd_checksum"]?.valueText).toBe(`0x${page.header.pd_checksum.toString(16)}`);
    expect(byId["header.pd_flags"]?.valueText).toBe(`0x${page.header.pd_flags.toString(16)}`);
    expect(byId["header.pd_lower"]?.valueText).toBe(String(page.header.pd_lower));
    expect(byId["header.pd_upper"]?.valueText).toBe(String(page.header.pd_upper));
    expect(byId["header.pd_special"]?.valueText).toBe(String(page.header.pd_special));
    expect(byId["header.pd_pagesize_version"]?.valueText).toBe(
      `${page.header.pageSize}/${page.header.pageVersion}`,
    );
    expect(byId["header.pd_prune_xid"]?.valueText).toBe(String(page.header.pd_prune_xid));

    expect(byId[`itemid-${item.index}`]?.valueText).toBe(
      `off=${item.offset} len=${item.length}`,
    );
    expect(byId[`itemid-${item.index}.off`]?.valueText).toBe(String(item.offset));
    expect(byId[`itemid-${item.index}.flag`]?.valueText).toBe(`0x${item.flags.toString(16)}`);
    expect(byId[`itemid-${item.index}.len`]?.valueText).toBe(String(item.length));

    expect(byId[`tuple-${t.itemIndex}.t_xmin`]?.valueText).toBe(String(t.header.t_xmin));
    expect(byId[`tuple-${t.itemIndex}.t_xmax`]?.valueText).toBe(String(t.header.t_xmax));
    expect(byId[`tuple-${t.itemIndex}.t_cid`]?.valueText).toBe(String(t.header.t_cid));
    expect(byId[`tuple-${t.itemIndex}.t_ctid`]?.valueText).toBe(
      `(${t.header.t_ctid.blockNumber},${t.header.t_ctid.offsetNumber})`,
    );
    expect(byId[`tuple-${t.itemIndex}.t_infomask`]?.valueText).toBe(
      `0x${t.header.t_infomask.toString(16)}`,
    );
    expect(byId[`tuple-${t.itemIndex}.t_infomask2`]?.valueText).toBe(
      `0x${t.header.t_infomask2.toString(16)}`,
    );
    expect(byId[`tuple-${t.itemIndex}.t_hoff`]?.valueText).toBe(String(t.header.t_hoff));

    const col = t.columns?.find((c) => !c.dropped && c.range);
    if (col) {
      const expected = col.null
        ? "NULL"
        : `${col.display}${col.toasted ? " [TOASTed]" : ""}`;
      expect(byId[`tuple-${t.itemIndex}.col-${col.attnum}`]?.valueText).toBe(expected);
    }
  });

  it("omits valueText for free / nullbits / data fields", () => {
    const page = decodePageTuples(parsePage(buildSparsePage()), SPARSE_SCHEMA);
    const fields = deriveStructureFields(page);
    const free = fields.find((f) => f.id === "free");
    expect(free?.valueText).toBeUndefined();
    for (const f of fields) {
      if (
        f.label === "nullbits" ||
        f.label === "data" ||
        f.id.endsWith(".nullbitmap") ||
        f.id.includes(".data")
      ) {
        expect(f.valueText).toBeUndefined();
      }
    }
  });
});

describe("cellCapacityChars / chooseCellContent", () => {
  const metrics = {
    charWidthPx: 7,
    byteColWidthPx: 14,
    cellPaddingXPx: 2,
    cellBorderXPx: 0,
  };

  it("subtracts padding, border, and 1-char safety margin", () => {
    // usable = 2 * 14 - 2 - 0 = 26px → floor(26/7)=3 → minus 1 safety → 2
    expect(cellCapacityChars(2, metrics)).toBe(2);
    expect(cellCapacityChars(1, metrics)).toBe(0);
  });

  it("chooses value+label, value-only, or label mode", () => {
    expect(
      chooseCellContent({ label: "xmin", valueText: "42", capacityChars: 5 }),
    ).toEqual({ mode: "value", showLabel: true });
    expect(
      chooseCellContent({ label: "infomask2", valueText: "0xabc", capacityChars: 5 }),
    ).toEqual({ mode: "value", showLabel: false });
    expect(
      chooseCellContent({ label: "xmin", valueText: "123456", capacityChars: 5 }),
    ).toEqual({ mode: "label" });
    expect(chooseCellContent({ label: "free", capacityChars: 20 })).toEqual({
      mode: "label",
    });
  });
});

describe("computeHexScrollTarget", () => {
  const base = {
    rowHeightPx: 20,
    containerHeightPx: 200,
    contentHeightPx: 5120,
    anchorRatio: 1 / 3,
  };

  it("scrolls down toward top-third anchor", () => {
    const target = computeHexScrollTarget({
      ...base,
      firstRow: 100,
      lastRow: 100,
      currentScrollTop: 0,
    });
    expect(target).toBeCloseTo(2000 - 200 / 3, 5);
  });

  it("scrolls upward when range is above viewport", () => {
    const target = computeHexScrollTarget({
      ...base,
      firstRow: 2,
      lastRow: 2,
      currentScrollTop: 800,
    });
    expect(target).toBe(0);
  });

  it("returns null when first row is already fully visible", () => {
    expect(
      computeHexScrollTarget({
        ...base,
        firstRow: 2,
        lastRow: 2,
        currentScrollTop: 0,
      }),
    ).toBeNull();
  });

  it("clamps to content end near page bottom", () => {
    const maxScroll = 5120 - 200;
    const target = computeHexScrollTarget({
      ...base,
      firstRow: 250,
      lastRow: 255,
      currentScrollTop: 0,
    });
    expect(target).toBe(maxScroll);
  });

  it("keeps multi-row range visible when it fits", () => {
    const target = computeHexScrollTarget({
      ...base,
      firstRow: 10,
      lastRow: 14,
      currentScrollTop: 0,
    });
    // ideal places first row at 1/3; whole 5-row range still fits
    expect(target).toBeCloseTo(200 - 200 / 3, 5);
  });

  it("anchors first row when range taller than container", () => {
    const target = computeHexScrollTarget({
      ...base,
      firstRow: 10,
      lastRow: 30,
      currentScrollTop: 0,
    });
    expect(target).toBeCloseTo(200 - 200 / 3, 5);
  });
});

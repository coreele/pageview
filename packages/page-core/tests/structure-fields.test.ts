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
  type DecodedColumn,
  type ParsedPage,
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
      const drawn = byId[`tuple-${t.itemIndex}.col-${col.attnum}`]?.range;
      expect(drawn?.end).toBe(col.range.end);
      expect(drawn!.start).toBe(col.range.start);
    }

    const drawnCols = fields
      .filter((f) => f.id.startsWith(`tuple-${t.itemIndex}.col-`))
      .map((f) => f.range)
      .sort((a, b) => a.start - b.start);
    for (const r of drawnCols) {
      expect(r.start).toBeGreaterThanOrEqual(t.dataRange.start);
    }
    for (let i = 1; i < drawnCols.length; i++) {
      expect(drawnCols[i]!.start).toBeGreaterThanOrEqual(drawnCols[i - 1]!.end);
    }

    expect(
      fields.some((f) => f.id.startsWith(`tuple-${t.itemIndex}.data`)),
    ).toBe(false);
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

function storedCol(
  attnum: number,
  name: string,
  typeName: string,
  start: number,
  end: number,
  display: string,
): DecodedColumn {
  return {
    attnum,
    name,
    typeName,
    dropped: false,
    null: false,
    value: display,
    display,
    range: { start, end },
  };
}

function pageWithTupleColumns(
  columns: DecodedColumn[],
  dataRangeEnd?: number,
): { page: ParsedPage; t: ParsedPage["tuples"][0] } {
  const page0 = parsePage(buildSparsePage());
  const t0 = page0.tuples[0]!;
  const t = {
    ...t0,
    columns,
    dataRange: {
      start: t0.dataRange.start,
      end: dataRangeEnd ?? t0.dataRange.end,
    },
  };
  const page: ParsedPage = { ...page0, tuples: [t, ...page0.tuples.slice(1)] };
  return { page, t };
}

describe("column range vs MAXALIGN holes (column-align-pad)", () => {
  it("P0-1/P0-3/P0-5: col range equals decoded; holes have no field", () => {
    const d = parsePage(buildSparsePage()).tuples[0]!.dataRange.start;
    const dataEnd = d + 8;
    // id 2B, name 2B, 1B hole, price 3B, 1B trailing — fits 8B user data
    const { page, t } = pageWithTupleColumns(
      [
        storedCol(1, "id", "int4", d, d + 2, "1"),
        storedCol(2, "name", "text", d + 2, d + 4, "ab"),
        storedCol(3, "price", "float4", d + 5, d + 7, "1"),
      ],
      dataEnd,
    );
    const fields = deriveStructureFields(page);
    const prefix = `tuple-${t.itemIndex}`;
    const byId = Object.fromEntries(fields.map((f) => [f.id, f]));

    expect(byId[`${prefix}.col-1`]?.range).toEqual({ start: d, end: d + 2 });
    expect(byId[`${prefix}.col-2`]?.range).toEqual({ start: d + 2, end: d + 4 });
    expect(byId[`${prefix}.col-3`]?.range).toEqual({ start: d + 5, end: d + 7 });

    const tupleFields = fields.filter((f) => f.id.startsWith(`${prefix}.`) && !f.visualOnly);
    expect(tupleFields.some((f) => /\.pad-/.test(f.id))).toBe(false);
    expect(tupleFields.some((f) => f.id.startsWith(`${prefix}.data`))).toBe(false);

    expect(resolveFieldAt(page, d + 4)).toBeNull();
    expect(resolveFieldAt(page, d + 7)).toBeNull();
  });

  it("P0-2: price span stays 4B when name length differs", () => {
    const d = parsePage(buildSparsePage()).tuples[0]!.dataRange.start;
    const apple = pageWithTupleColumns([
      storedCol(1, "id", "int4", d, d + 2, "1"),
      storedCol(2, "name", "text", d + 2, d + 3, "a"),
      storedCol(3, "price", "float4", d + 4, d + 8, "1.25"),
    ]);
    const banana = pageWithTupleColumns([
      storedCol(1, "id", "int4", d, d + 2, "2"),
      storedCol(2, "name", "text", d + 2, d + 4, "ab"),
      storedCol(3, "price", "float4", d + 4, d + 8, "0.5"),
    ]);
    const applePrice = deriveStructureFields(apple.page).find(
      (f) => f.id === `tuple-${apple.t.itemIndex}.col-3`,
    );
    const bananaPrice = deriveStructureFields(banana.page).find(
      (f) => f.id === `tuple-${banana.t.itemIndex}.col-3`,
    );
    expect(applePrice?.range).toEqual({ start: d + 4, end: d + 8 });
    expect(bananaPrice?.range).toEqual({ start: d + 4, end: d + 8 });
    expect(applePrice!.range.end - applePrice!.range.start).toBe(4);
    expect(bananaPrice!.range.end - bananaPrice!.range.start).toBe(4);
  });

  it("P1-1: NULL column does not swallow following column's leading hole", () => {
    const d = parsePage(buildSparsePage()).tuples[0]!.dataRange.start;
    const { page, t } = pageWithTupleColumns([
      storedCol(1, "id", "int4", d, d + 2, "5"),
      {
        attnum: 2,
        name: "name",
        typeName: "text",
        dropped: false,
        null: true,
        value: null,
        display: "NULL",
      },
      storedCol(3, "x", "float8", d + 4, d + 8, "1"),
    ]);
    const drawn = deriveStructureFields(page).find(
      (f) => f.id === `tuple-${t.itemIndex}.col-3`,
    );
    expect(drawn?.range).toEqual({ start: d + 4, end: d + 8 });
    expect(resolveFieldAt(page, d + 2)).toBeNull();
    expect(resolveFieldAt(page, d + 3)).toBeNull();
  });

  it("P0-7: no decoded columns keeps whole data field", () => {
    const page = parsePage(buildSparsePage());
    const t = page.tuples[0]!;
    expect(t.columns).toBeUndefined();
    const fields = deriveStructureFields(page);
    const data = fields.find((f) => f.id === `tuple-${t.itemIndex}.data`);
    expect(data?.range).toEqual(t.dataRange);
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

  it("DEF-001: includes rowGap and paddingTop so high-offset rows land in view", () => {
    // Mirrors .hex CSS: padding-top ~7px, gap 1px between flex rows.
    const rowHeightPx = 20;
    const rowGapPx = 1;
    const paddingTopPx = 7;
    const paddingBottomPx = 7;
    const rowCount = 256;
    const containerHeightPx = 200;
    const contentHeightPx =
      paddingTopPx +
      rowCount * rowHeightPx +
      (rowCount - 1) * rowGapPx +
      paddingBottomPx;
    const firstRow = 255;
    const stride = rowHeightPx + rowGapPx;
    const rangeTop = paddingTopPx + firstRow * stride;
    const naiveRangeTop = firstRow * rowHeightPx;
    const maxScroll = contentHeightPx - containerHeightPx;

    const target = computeHexScrollTarget({
      firstRow,
      lastRow: firstRow,
      rowHeightPx,
      rowGapPx,
      paddingTopPx,
      containerHeightPx,
      contentHeightPx,
      currentScrollTop: 0,
      anchorRatio: 1 / 3,
    });

    expect(target).toBe(Math.min(Math.max(rangeTop - containerHeightPx / 3, 0), maxScroll));
    // Gap+padding error at page end exceeds one viewport — naive Y under-scrolls.
    expect(rangeTop - naiveRangeTop).toBeGreaterThan(containerHeightPx);
    const naiveTarget = Math.min(
      Math.max(naiveRangeTop - containerHeightPx / 3, 0),
      maxScroll,
    );
    expect(target).toBeGreaterThan(naiveTarget);
  });

  it("DEF-001: visibility check uses gap-aware row band", () => {
    const rowHeightPx = 20;
    const rowGapPx = 1;
    const paddingTopPx = 7;
    // Gap-aware row 100: [2107, 2127]. Viewport [2100, 2300] covers it → null.
    expect(
      computeHexScrollTarget({
        firstRow: 100,
        lastRow: 100,
        rowHeightPx,
        rowGapPx,
        paddingTopPx,
        containerHeightPx: 200,
        contentHeightPx: 6000,
        currentScrollTop: 2100,
      }),
    ).toBeNull();
    // Viewport [2000, 2100] covers naive Y (2000..2020) but not gap-aware band → must scroll.
    expect(
      computeHexScrollTarget({
        firstRow: 100,
        lastRow: 100,
        rowHeightPx,
        rowGapPx,
        paddingTopPx,
        containerHeightPx: 100,
        contentHeightPx: 6000,
        currentScrollTop: 2000,
      }),
    ).not.toBeNull();
    expect(
      computeHexScrollTarget({
        firstRow: 100,
        lastRow: 100,
        rowHeightPx,
        containerHeightPx: 100,
        contentHeightPx: 6000,
        currentScrollTop: 2000,
      }),
    ).toBeNull();
  });
});

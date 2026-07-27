import { describe, expect, it } from "vitest";
import type { StructureField } from "page-core";
import type { HexPresentationRow } from "./hexLayout";
import { freeBreakColumns, groupSegmentsIntoLanes } from "./structureLayout";

function field(id: string, region: StructureField["region"] = "tuple"): StructureField {
  return {
    id,
    label: id,
    fullLabel: id,
    range: { start: 0, end: 1 },
    region,
  };
}

function seg(
  id: string,
  row: number,
  colStart: number,
  colEnd: number,
  region: StructureField["region"] = "tuple",
) {
  return { field: field(id, region), row, colStart, colEnd };
}

describe("groupSegmentsIntoLanes", () => {
  it("returns a single lane for one tuple", () => {
    const segments = [seg("tuple-1.t_xmin", 10, 0, 4), seg("tuple-1.t_xmax", 10, 4, 8)];
    expect(groupSegmentsIntoLanes(segments)).toEqual([segments]);
  });

  it("splits multiple tuples into ordered lanes", () => {
    const tuple3 = [seg("tuple-3.a", 12, 0, 22)];
    const tuple2 = [seg("tuple-2.t_xmin", 12, 24, 28), seg("tuple-2.t_xmax", 12, 28, 32)];
    expect(groupSegmentsIntoLanes([...tuple3, ...tuple2])).toEqual([tuple3, tuple2]);
  });

  it("keeps non-tuple segments in their own lane when tuples split", () => {
    const item = [seg("itemid-0", 1, 28, 32, "itemid")];
    const tuple3 = [seg("tuple-3.a", 12, 0, 22)];
    const tuple2 = [seg("tuple-2.t_xmin", 12, 24, 28)];
    expect(groupSegmentsIntoLanes([...item, ...tuple3, ...tuple2])).toEqual([tuple3, tuple2, item]);
  });
});

describe("freeBreakColumns", () => {
  const presRow = (parts: HexPresentationRow["parts"]): HexPresentationRow => ({
    rowIndex: 0,
    labelOffset: 32,
    parts,
  });

  it("spans from leading cells to trailing cells on the same break row", () => {
    const columns = freeBreakColumns(
      { start: 100, end: 120 },
      presRow([
        { kind: "cells", startOffset: 96, length: 4 },
        { kind: "break", range: { start: 100, end: 120 }, bytes: 20 },
        { kind: "cells", startOffset: 120, length: 8 },
      ]),
    );
    expect(columns).toEqual({ colStart: 4, colEnd: 24 });
  });

  it("spans to the row end when there is no trailing cells part", () => {
    const columns = freeBreakColumns(
      { start: 40, end: 8040 },
      presRow([
        { kind: "cells", startOffset: 32, length: 8 },
        { kind: "break", range: { start: 40, end: 8040 }, bytes: 8000 },
      ]),
    );
    expect(columns).toEqual({ colStart: 8, colEnd: 32 });
  });

  it("starts at the free offset when the break row has no leading cells", () => {
    const columns = freeBreakColumns(
      { start: 64, end: 192 },
      presRow([{ kind: "break", range: { start: 64, end: 192 }, bytes: 128 }]),
    );
    expect(columns).toEqual({ colStart: 0, colEnd: 32 });
  });
});

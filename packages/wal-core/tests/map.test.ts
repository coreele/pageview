import { describe, expect, it } from "vitest";
import { hasFpi, mapWalinspectRow, type WalinspectRow } from "../src/index.js";

describe("mapWalinspectRow", () => {
  const sample: WalinspectRow = {
    start_lsn: "0/16B3748",
    end_lsn: "0/16B3780",
    prev_lsn: "0/16B3700",
    xid: "12345",
    resource_manager: "Heap",
    record_type: "INSERT",
    record_length: 56,
    main_data_length: 24,
    fpi_length: 0,
    description: "insert: ...",
    block_ref: "blkref #0: rel 1663/16384/16385 fork main blk 0",
  };

  it("maps SQL row fields to DTO with Spec semantics", () => {
    const dto = mapWalinspectRow(sample);
    expect(dto.startLsn).toBe("0/16B3748");
    expect(dto.endLsn).toBe("0/16B3780");
    expect(dto.prevLsn).toBe("0/16B3700");
    expect(dto.xid).toBe("12345");
    expect(dto.resourceManager).toBe("Heap");
    expect(dto.recordType).toBe("INSERT");
    expect(dto.recordLength).toBe(56);
    expect(dto.mainDataLength).toBe(24);
    expect(dto.fpiLength).toBe(0);
    expect(dto.description).toBe("insert: ...");
    expect(dto.blockRef).toBe("blkref #0: rel 1663/16384/16385 fork main blk 0");
  });

  it("coerces null optional fields and numeric xid", () => {
    const dto = mapWalinspectRow({
      start_lsn: "0/1",
      end_lsn: null,
      prev_lsn: null,
      xid: 42,
      resource_manager: "XLOG",
      record_type: "CHECKPOINT_SHUTDOWN",
      record_length: 100,
      main_data_length: null,
      fpi_length: 8192,
      description: null,
      block_ref: null,
    });
    expect(dto.endLsn).toBeNull();
    expect(dto.prevLsn).toBeNull();
    expect(dto.xid).toBe("42");
    expect(dto.mainDataLength).toBeNull();
    expect(dto.fpiLength).toBe(8192);
    expect(dto.description).toBeNull();
    expect(dto.blockRef).toBeNull();
  });
});

describe("hasFpi", () => {
  it("is true only when fpi_length > 0", () => {
    expect(hasFpi({ fpiLength: 0 })).toBe(false);
    expect(hasFpi({ fpiLength: 8192 })).toBe(true);
  });
});

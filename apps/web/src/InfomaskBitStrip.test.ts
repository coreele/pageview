import { describe, expect, it } from "vitest";
import { decodeInfomask, decodeInfomask2 } from "page-core";
import { formatInfomaskHex } from "./InfomaskBitStrip";

describe("formatInfomaskHex", () => {
  it("matches Selection detail hex convention (0x + unpadded lowercase)", () => {
    expect(formatInfomaskHex("t_infomask", 0x800)).toBe("t_infomask=0x800");
    expect(formatInfomaskHex("t_infomask2", 0x2)).toBe("t_infomask2=0x2");
    expect(formatInfomaskHex("t_infomask", 0)).toBe("t_infomask=0x0");
    expect(formatInfomaskHex("pd_flags", 0x4)).toBe("pd_flags=0x4");
  });
});

describe("infomask bit strip consumes decode order/set", () => {
  it("preserves decodeInfomask order and set flags for a sample value", () => {
    const bits = decodeInfomask(0x800);
    expect(bits.map((b) => b.name)).toEqual(decodeInfomask(0x800).map((b) => b.name));
    expect(bits.filter((b) => b.set).map((b) => b.name)).toEqual(["HEAP_XMAX_INVALID"]);
  });

  it("returns HEAP_NATTS as first entry, set when natts > 0", () => {
    const bits = decodeInfomask2(0x2);
    expect(bits[0]?.name).toBe("HEAP_NATTS");
    expect(bits[0]?.set).toBe(true);
    expect(bits[0]?.meaning).toContain("2");
  });

  it("marks HEAP_NATTS unset when natts is 0", () => {
    const bits = decodeInfomask2(0);
    expect(bits[0]?.name).toBe("HEAP_NATTS");
    expect(bits[0]?.set).toBe(false);
    expect(bits.slice(1).every((b) => !b.set)).toBe(true);
  });
});

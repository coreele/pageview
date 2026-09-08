/** @vitest-environment happy-dom */

import { describe, expect, it, vi } from "vitest";
import { CLIPBOARD_DENIED_NOTICE, exportStructurePng } from "./exportStructurePng";

function mountMainRoot(): void {
  const el = document.createElement("div");
  el.className = "structure structure-diagram";
  el.setAttribute("data-export-structure", "main");
  el.innerHTML = `<div class="structure-flow"><div class="structure-row">row</div></div>`;
  document.body.appendChild(el);
}

describe("exportStructurePng (P0-3 / P0-4 / P0-5 / P1-2)", () => {
  it("downloads and copies when rasterize succeeds", async () => {
    mountMainRoot();
    const blob = new Blob(["png"], { type: "image/png" });
    const download = vi.fn();
    const writeClipboard = vi.fn().mockResolvedValue(undefined);
    const rasterize = vi.fn().mockResolvedValue(blob);
    const result = await exportStructurePng({
      target: "main",
      caption: "public.items  ·  heap  ·  blk 0",
      fileName: "public.items_heap_blk0.png",
      rasterize,
      writeClipboard,
      download,
    });
    expect(result).toEqual({ ok: true, clipboard: true });
    expect(download).toHaveBeenCalledWith(blob, "public.items_heap_blk0.png");
    expect(writeClipboard).toHaveBeenCalledWith(blob);
    expect(document.querySelector("[data-export-capture]")).toBeNull();
  });

  it("still downloads when clipboard write is denied (P0-5)", async () => {
    mountMainRoot();
    const blob = new Blob(["png"], { type: "image/png" });
    const download = vi.fn();
    const result = await exportStructurePng({
      target: "main",
      caption: "public.items  ·  heap  ·  blk 0",
      fileName: "public.items_heap_blk0.png",
      rasterize: async () => blob,
      writeClipboard: async () => {
        throw new Error("denied");
      },
      download,
    });
    expect(result).toEqual({ ok: true, clipboard: false });
    expect(download).toHaveBeenCalledOnce();
    expect(CLIPBOARD_DENIED_NOTICE).toMatch(/downloaded/i);
  });

  it("returns EXPORT_FAILED without downloading when rasterize throws (P1-2)", async () => {
    mountMainRoot();
    const download = vi.fn();
    const result = await exportStructurePng({
      target: "main",
      caption: "public.items  ·  heap  ·  blk 0",
      fileName: "public.items_heap_blk0.png",
      rasterize: async () => {
        throw new Error("boom");
      },
      writeClipboard: async () => undefined,
      download,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("EXPORT_FAILED");
    expect(download).not.toHaveBeenCalled();
  });

  it("fails when the target root is missing", async () => {
    document.body.replaceChildren();
    const result = await exportStructurePng({
      target: "overlay",
      caption: "x",
      fileName: "x.png",
      rasterize: async () => new Blob(["png"]),
      download: vi.fn(),
    });
    expect(result.ok).toBe(false);
  });
});

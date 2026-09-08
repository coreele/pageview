import type { AppError } from "./api";
import {
  composeExportRoot,
  EXPORT_ROOT_SELECTOR,
  type ExportTargetKind,
} from "./exportStructure";

export type RasterizeFn = (el: HTMLElement) => Promise<Blob>;
export type WriteClipboardFn = (blob: Blob) => Promise<void>;
export type DownloadFn = (blob: Blob, fileName: string) => void;

export type ExportPngResult =
  | { ok: true; clipboard: boolean }
  | { ok: false; error: AppError };

export const EXPORT_NO_TARGET: AppError = {
  code: "EXPORT_FAILED",
  message: "Nothing to export.",
  nextStep: "Load a heap or index page, then try Export again.",
};

export const EXPORT_RASTER_FAILED: AppError = {
  code: "EXPORT_FAILED",
  message: "Could not render the structure diagram as a PNG.",
  nextStep: "Try again, or capture the pane with the system screenshot.",
};

export const CLIPBOARD_DENIED_NOTICE =
  "Clipboard write was denied. The PNG was downloaded instead.";

function defaultDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function defaultWriteClipboard(blob: Blob): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

export async function defaultRasterize(el: HTMLElement): Promise<Blob> {
  const { domToBlob } = await import("modern-screenshot");
  const blob = await domToBlob(el, { type: "image/png", scale: 2 });
  if (!blob || blob.size === 0) {
    throw new Error("empty png");
  }
  return blob;
}

export function resolveExportRoot(target: Exclude<ExportTargetKind, "none">): HTMLElement | null {
  return document.querySelector(EXPORT_ROOT_SELECTOR[target]);
}

export async function exportStructurePng(opts: {
  target: Exclude<ExportTargetKind, "none">;
  caption: string;
  fileName: string;
  rasterize?: RasterizeFn;
  writeClipboard?: WriteClipboardFn;
  download?: DownloadFn;
}): Promise<ExportPngResult> {
  const source = resolveExportRoot(opts.target);
  if (!source) {
    return { ok: false, error: EXPORT_NO_TARGET };
  }

  const capture = composeExportRoot(source, opts.caption);
  capture.style.position = "fixed";
  capture.style.left = "-100000px";
  capture.style.top = "0";
  capture.style.zIndex = "-1";
  document.body.appendChild(capture);

  try {
    const blob = await (opts.rasterize ?? defaultRasterize)(capture);
    (opts.download ?? defaultDownload)(blob, opts.fileName);
    let clipboard = true;
    try {
      await (opts.writeClipboard ?? defaultWriteClipboard)(blob);
    } catch {
      clipboard = false;
    }
    return { ok: true, clipboard };
  } catch {
    return { ok: false, error: EXPORT_RASTER_FAILED };
  } finally {
    capture.remove();
  }
}

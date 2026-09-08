export type ExportPageKind = "heap" | "index";

export type ExportTargetKind = "overlay" | "main" | "none";

export const EXPORT_ROOT_SELECTOR = {
  overlay: '[data-export-structure="overlay"]',
  main: '[data-export-structure="main"]',
} as const;

export function exportCaption(opts: {
  qualifiedName: string;
  kind: ExportPageKind;
  blkno: number;
}): string {
  return `${opts.qualifiedName}  ·  ${opts.kind}  ·  blk ${opts.blkno}`;
}

export function sanitizeExportName(raw: string): string {
  const s = raw
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return s || "page";
}

export function exportFileName(opts: {
  qualifiedName: string;
  kind: ExportPageKind;
  blkno: number;
}): string {
  return `${sanitizeExportName(opts.qualifiedName)}_${opts.kind}_blk${opts.blkno}.png`;
}

export function isExportShortcut(e: {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}): boolean {
  return e.shiftKey && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c";
}

export function exportTargetKind(opts: {
  overlayPresent: boolean;
  overlayPageReady: boolean;
  mainPageReady: boolean;
}): ExportTargetKind {
  if (opts.overlayPresent) {
    return opts.overlayPageReady ? "overlay" : "none";
  }
  return opts.mainPageReady ? "main" : "none";
}

export function composeExportRoot(source: HTMLElement, caption: string): HTMLElement {
  const theme = document.documentElement.getAttribute("data-theme") || "light";
  const wrap = document.createElement("div");
  wrap.className = "export-structure-capture";
  wrap.setAttribute("data-theme", theme);
  wrap.setAttribute("data-export-capture", "true");

  const title = document.createElement("div");
  title.className = "export-structure-caption mono";
  title.textContent = caption;

  const clone = source.cloneNode(true) as HTMLElement;
  clone.removeAttribute("data-export-structure");
  clone.querySelectorAll(".selection-detail-wrap, .structure-char-probe").forEach((el) => {
    el.remove();
  });
  const flow = clone.querySelector(".structure-flow");
  if (flow instanceof HTMLElement) {
    flow.style.overflow = "visible";
    flow.style.maxHeight = "none";
    flow.style.height = "auto";
    flow.style.flex = "none";
  }
  clone.style.overflow = "visible";
  clone.style.maxHeight = "none";
  clone.style.height = "auto";
  const width = source.getBoundingClientRect().width;
  clone.style.width = `${Math.max(width, 480)}px`;

  wrap.append(title, clone);
  return wrap;
}

const STORAGE_KEY = "pg-page-viewer.split.v2";

export const GUTTER_PX = 10;
export const TREE_MIN_PX = 168;
export const TREE_MAX_PX = 480;
export const HEX_MIN_PX = 240;
export const HEX_MAX_PX = 1600;
export const STRUCTURE_MIN_PX = 280;

export type PageSplitState = {
  treePx: number;
  /** Pixel width after the user drags; `null` shares leftover space equally with the structure pane. */
  hexPx: number | null;
};

export const DEFAULT_PAGE_SPLIT: PageSplitState = { treePx: 220, hexPx: null };

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function pageSplitTemplate(
  split: PageSplitState,
  treeOpen: boolean,
  hexOpen: boolean,
): string {
  const g = `${GUTTER_PX}px`;
  const hexCol =
    split.hexPx == null ? "minmax(0, 1fr)" : `${split.hexPx}px`;
  if (treeOpen && hexOpen) {
    return `${split.treePx}px ${g} minmax(0, 1fr) ${g} ${hexCol}`;
  }
  if (treeOpen) return `${split.treePx}px ${g} minmax(0, 1fr)`;
  if (hexOpen) return `minmax(0, 1fr) ${g} ${hexCol}`;
  return "minmax(0, 1fr)";
}

export function hexDragStart(split: PageSplitState, measuredHexPx: number): PageSplitState {
  return { ...split, hexPx: split.hexPx ?? measuredHexPx };
}

export function dragTree(
  start: PageSplitState,
  dx: number,
  containerPx: number,
  hexOpen: boolean,
): PageSplitState {
  const gutters = GUTTER_PX * (1 + (hexOpen ? 1 : 0));
  const hexReserve = hexOpen ? (start.hexPx ?? HEX_MIN_PX) : 0;
  const maxTree = Math.min(TREE_MAX_PX, containerPx - gutters - hexReserve - STRUCTURE_MIN_PX);
  return { ...start, treePx: clamp(start.treePx + dx, TREE_MIN_PX, Math.max(TREE_MIN_PX, maxTree)) };
}

export function dragHex(
  start: PageSplitState,
  dx: number,
  containerPx: number,
  treeOpen: boolean,
): PageSplitState {
  const current = start.hexPx ?? HEX_MIN_PX;
  const gutters = GUTTER_PX * (1 + (treeOpen ? 1 : 0));
  const treePx = treeOpen ? start.treePx : 0;
  const maxHex = Math.min(HEX_MAX_PX, containerPx - gutters - treePx - STRUCTURE_MIN_PX);
  return { ...start, hexPx: clamp(current - dx, HEX_MIN_PX, Math.max(HEX_MIN_PX, maxHex)) };
}

export function loadStoredSplit(): PageSplitState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PageSplitState>;
    if (typeof parsed.treePx !== "number" || !Number.isFinite(parsed.treePx)) return null;
    const treePx = clamp(parsed.treePx, TREE_MIN_PX, TREE_MAX_PX);
    if (parsed.hexPx == null) return { treePx, hexPx: null };
    if (typeof parsed.hexPx !== "number" || !Number.isFinite(parsed.hexPx)) return { treePx, hexPx: null };
    return { treePx, hexPx: clamp(parsed.hexPx, HEX_MIN_PX, HEX_MAX_PX) };
  } catch {
    return null;
  }
}

export function storeSplit(split: PageSplitState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(split));
  } catch {
    /* ignore quota / private mode */
  }
}

export { STORAGE_KEY };

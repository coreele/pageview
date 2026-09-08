const STORAGE_KEY = "pg-page-viewer.split";

export const GUTTER_PX = 10;
export const TREE_MIN_PX = 168;
export const TREE_MAX_PX = 480;
export const HEX_MIN_PX = 240;
export const HEX_MAX_PX = 720;
export const STRUCTURE_MIN_PX = 280;

export type PageSplitState = {
  treePx: number;
  hexPx: number;
};

export const DEFAULT_PAGE_SPLIT: PageSplitState = { treePx: 220, hexPx: 360 };

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function pageSplitTemplate(
  split: PageSplitState,
  treeOpen: boolean,
  hexOpen: boolean,
): string {
  const g = `${GUTTER_PX}px`;
  if (treeOpen && hexOpen) {
    return `${split.treePx}px ${g} minmax(0, 1fr) ${g} ${split.hexPx}px`;
  }
  if (treeOpen) return `${split.treePx}px ${g} minmax(0, 1fr)`;
  if (hexOpen) return `minmax(0, 1fr) ${g} ${split.hexPx}px`;
  return "minmax(0, 1fr)";
}

export function dragTree(
  start: PageSplitState,
  dx: number,
  containerPx: number,
  hexOpen: boolean,
): PageSplitState {
  const gutters = GUTTER_PX * (1 + (hexOpen ? 1 : 0));
  const hexPx = hexOpen ? start.hexPx : 0;
  const maxTree = Math.min(TREE_MAX_PX, containerPx - gutters - hexPx - STRUCTURE_MIN_PX);
  return { ...start, treePx: clamp(start.treePx + dx, TREE_MIN_PX, Math.max(TREE_MIN_PX, maxTree)) };
}

export function dragHex(
  start: PageSplitState,
  dx: number,
  containerPx: number,
  treeOpen: boolean,
): PageSplitState {
  const gutters = GUTTER_PX * (1 + (treeOpen ? 1 : 0));
  const treePx = treeOpen ? start.treePx : 0;
  const maxHex = Math.min(HEX_MAX_PX, containerPx - gutters - treePx - STRUCTURE_MIN_PX);
  return { ...start, hexPx: clamp(start.hexPx - dx, HEX_MIN_PX, Math.max(HEX_MIN_PX, maxHex)) };
}

export function loadStoredSplit(): PageSplitState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PageSplitState>;
    if (typeof parsed.treePx !== "number" || typeof parsed.hexPx !== "number") return null;
    if (!Number.isFinite(parsed.treePx) || !Number.isFinite(parsed.hexPx)) return null;
    return {
      treePx: clamp(parsed.treePx, TREE_MIN_PX, TREE_MAX_PX),
      hexPx: clamp(parsed.hexPx, HEX_MIN_PX, HEX_MAX_PX),
    };
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

/** Canonical query builder mirroring apps/web/src/urlState.ts buildUrlState / defaultUrlState. */

export type UrlState = {
  mode: "page" | "wal";
  kind: "table" | "index";
  table: number | null;
  index: number | null;
  blkno: number | null;
  startLsn: string | null;
  endLsn: string | null;
};

export function defaultUrlState(): UrlState {
  return {
    mode: "page",
    kind: "table",
    table: null,
    index: null,
    blkno: null,
    startLsn: null,
    endLsn: null,
  };
}

export function isDefaultUrlState(state: UrlState): boolean {
  const d = defaultUrlState();
  return (Object.keys(d) as Array<keyof UrlState>).every((k) => state[k] === d[k]);
}

export function buildUrlState(state: UrlState): string {
  if (isDefaultUrlState(state)) return "";
  const params = new URLSearchParams();
  if (state.mode === "wal") {
    params.set("mode", "wal");
    if (state.startLsn != null) params.set("startLsn", state.startLsn);
    if (state.endLsn != null) params.set("endLsn", state.endLsn);
  } else {
    params.set("mode", "page");
    params.set("kind", state.kind);
    if (state.table != null) params.set("table", String(state.table));
    if (state.kind === "index" && state.index != null) {
      params.set("index", String(state.index));
    }
    if (state.blkno != null) params.set("blkno", String(state.blkno));
  }
  return `?${params.toString()}`;
}

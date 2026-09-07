/**
 * url-deeplink (design decision 1): pure URL codec for the 7 view parameters.
 * No DOM, no React — everything here is node-testable.
 *
 * PUBLIC CONTRACT: the parameter names below (`mode`, `kind`, `table`, `index`,
 * `blkno`, `startLsn`, `endLsn`) are part of the published URL schema (Spec:
 * renaming or changing semantics requires backward compatibility — old-name
 * aliases or tolerant mapping). Unknown parameter names are ignored without
 * error (forward compatibility); only invalid values of known names produce
 * `BAD_URL_PARAM`.
 *
 * Validation mirrors the existing server contracts exactly (no extra
 * tightening): `table`/`index` follow `parseOidParam` (`Number(raw)`,
 * `Number.isInteger`, `1..4294967295`); `blkno` follows `BAD_BLKNO`
 * (integer >= 0, upper bound left to the object layer's `BLKNO_OUT_OF_RANGE`);
 * LSNs follow wal-core `LSN_RE` (`^([0-9A-Fa-f]+)/([0-9A-Fa-f]+)$` after
 * trim). LSNs are format-checked only — start<=end and existence are answered
 * by the existing Load-time `BAD_LSN` contract.
 */
import type { AppError } from "./api";
import { canLoadIndex, filterIndexesByTable, type IndexRowLike } from "./indexView";

export type UrlState = {
  mode: "page" | "wal";
  kind: "table" | "index";
  /** Table-mode selection oid, or the index-mode table filter oid. */
  table: number | null;
  /** Selected index oid (meaningful only with kind="index"). */
  index: number | null;
  /** Page-mode block number; null = not loaded (not encoded). */
  blkno: number | null;
  /** WAL range LSNs; null = not loaded (not encoded). */
  startLsn: string | null;
  endLsn: string | null;
};

export type ParseResult = { ok: true; state: UrlState } | { ok: false; error: AppError };

/** Structural subset of api.TableRow needed by the restore planner. */
export type RestoreTableRef = { oid: number; blocks: number };

/** Everything the restore planner needs from the App (kept structural so the App passes its live state). */
export type RestoreCtx = {
  connected: boolean;
  tablesFetched: boolean;
  tables: readonly RestoreTableRef[];
  indexesFetched: boolean;
  indexes: readonly IndexRowLike[];
};

/** What the restore effect should do for a pending UrlState (design decision 3). */
export type RestoreAction =
  | { type: "wait" }
  | { type: "load-table"; oid: number; blkno: number }
  | { type: "load-index"; oid: number; blkno: number }
  | { type: "load-wal"; startLsn: string; endLsn: string }
  | { type: "none" };

const OID_MAX = 4294967295;
/** wal-core LSN_RE (packages/wal-core/src/index.ts), applied after trim. */
const LSN_RE = /^([0-9A-Fa-f]+)\/([0-9A-Fa-f]+)$/;

const BAD_URL_PARAM_NEXT_STEP =
  "Fix or remove the URL parameters in the address bar, then reload. The app stays usable on the default view.";

function badParam(name: string, raw: string, expected: string): AppError {
  return {
    code: "BAD_URL_PARAM",
    message: `Invalid URL parameter ${name}="${raw}" (expected ${expected})`,
    nextStep: BAD_URL_PARAM_NEXT_STEP,
  };
}

/** BAD_OID parity: Number(raw), integer, 1..4294967295 (accepts "1e3" etc. like the server). */
function parseOid(name: string, raw: string): number | AppError {
  const oid = Number(raw);
  if (Number.isInteger(oid) && oid >= 1 && oid <= OID_MAX) return oid;
  return badParam(name, raw, `an integer in 1..${OID_MAX}`);
}

/** BAD_BLKNO parity: integer >= 0; upper bound is the object layer's job. */
function parseBlkno(raw: string): number | AppError {
  const blkno = Number(raw);
  if (Number.isInteger(blkno) && blkno >= 0) return blkno;
  return badParam("blkno", raw, "a non-negative integer");
}

/** wal-core LSN_RE parity: trim, then X/Y hex on both sides. */
function parseLsn(name: string, raw: string): string | AppError {
  const trimmed = raw.trim();
  if (LSN_RE.test(trimmed)) return trimmed;
  return badParam(name, raw, "an LSN like 0/16B3748");
}

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

/**
 * Parse a query string (with or without the leading "?"). Known parameters are
 * validated per the server contracts above; unknown names are ignored; the
 * first occurrence of a repeated name wins; `mode=wal` discards `kind`
 * (Spec P1: kind is only effective in page mode).
 */
export function parseUrlState(search: string): ParseResult {
  const params = new URLSearchParams(search);
  const state = defaultUrlState();

  const mode = params.get("mode");
  if (mode != null) {
    if (mode !== "page" && mode !== "wal") {
      return { ok: false, error: badParam("mode", mode, '"page" or "wal"') };
    }
    state.mode = mode;
  }

  // kind is dropped under mode=wal (ignored, not validated — Spec P1).
  if (state.mode === "page") {
    const kind = params.get("kind");
    if (kind != null) {
      if (kind !== "table" && kind !== "index") {
        return { ok: false, error: badParam("kind", kind, '"table" or "index"') };
      }
      state.kind = kind;
    }
  }

  const table = params.get("table");
  if (table != null) {
    const parsed = parseOid("table", table);
    if (typeof parsed !== "number") return { ok: false, error: parsed };
    state.table = parsed;
  }

  const index = params.get("index");
  if (index != null) {
    const parsed = parseOid("index", index);
    if (typeof parsed !== "number") return { ok: false, error: parsed };
    state.index = parsed;
  }

  const blkno = params.get("blkno");
  if (blkno != null) {
    const parsed = parseBlkno(blkno);
    if (typeof parsed !== "number") return { ok: false, error: parsed };
    state.blkno = parsed;
  }

  const startLsn = params.get("startLsn");
  if (startLsn != null) {
    const parsed = parseLsn("startLsn", startLsn);
    if (typeof parsed !== "string") return { ok: false, error: parsed };
    state.startLsn = parsed;
  }

  const endLsn = params.get("endLsn");
  if (endLsn != null) {
    const parsed = parseLsn("endLsn", endLsn);
    if (typeof parsed !== "string") return { ok: false, error: parsed };
    state.endLsn = parsed;
  }

  return { ok: true, state };
}

/**
 * Canonical query string for a state: "" for the all-default state (bare URL),
 * otherwise mode,kind,table?,index?,blkno? in page mode (index only under
 * kind=index, blkno only when loaded — including 0) and mode,startLsn?,endLsn?
 * in wal mode (all page params filtered out). Fixed parameter order is for
 * stable tests/diffs only, not a contract. URLSearchParams serialization
 * encodes the LSN "/" as %2F; parsing accepts both forms.
 */
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

/**
 * Pure restore planner (design decision 3): decides what the restore effect
 * should do for a pending deep-link state. All wait/guard/drop judgements
 * live here and are unit-tested; the App only executes the action.
 *
 * - `wait`: not connected yet (P0-7), or the list the decision needs is not
 *   fetched (page+table needs tablesFetched, page+index needs indexesFetched).
 * - `load-table`: missing blkno defaults to 0; a listed 0-block table stays a
 *   no-load (existing empty-relation guard); an unlisted oid still loads so
 *   the server answers NOT_HEAP_TABLE (P0-9).
 * - `load-index`: reuses filterIndexesByTable/canLoadIndex — an index listed
 *   under a different table than the filter is dropped silently (runtime
 *   indexSelectionSurvives semantics), a listed non-B-tree never loads
 *   (guard), an unlisted oid still loads so the client answers NOT_INDEX.
 * - `load-wal`: both LSNs present; start<=end is Load's existing BAD_LSN job.
 * - `none`: input-side restoration only (missing table/index, single LSN,
 *   guards, inconsistent filter).
 */
export function planRestoreActions(state: UrlState, ctx: RestoreCtx): RestoreAction {
  if (!ctx.connected) return { type: "wait" };
  if (state.mode === "wal") {
    if (state.startLsn != null && state.endLsn != null) {
      return { type: "load-wal", startLsn: state.startLsn, endLsn: state.endLsn };
    }
    return { type: "none" };
  }
  if (state.kind === "table") {
    if (!ctx.tablesFetched) return { type: "wait" };
    if (state.table == null) return { type: "none" };
    const table = ctx.tables.find((t) => t.oid === state.table) ?? null;
    if (table != null && table.blocks === 0) return { type: "none" };
    return { type: "load-table", oid: state.table, blkno: state.blkno ?? 0 };
  }
  if (!ctx.indexesFetched) return { type: "wait" };
  if (state.index == null) return { type: "none" };
  const index = ctx.indexes.find((i) => i.oid === state.index) ?? null;
  if (index != null) {
    const filtered = filterIndexesByTable([...ctx.indexes], state.table);
    if (!filtered.some((i) => i.oid === state.index)) return { type: "none" };
    if (!canLoadIndex(index)) return { type: "none" };
  }
  return { type: "load-index", oid: state.index, blkno: state.blkno ?? 0 };
}

/**
 * Pure derivation helpers for the index tuple key-values section
 * (index-key-decode). T5 part: per-oid column-metadata cache transitions and
 * the degradation state machine (copy strings frozen in ui-design.md).
 * T6 adds the per-column row model on top of these.
 */
import type { AppError, IndexColumnsResponse } from "./api";

// ---------------------------------------------------------------------------
// Per-oid column metadata cache (design §5)
// ---------------------------------------------------------------------------

export type IndexColumnsEntry =
  | { status: "ok"; data: IndexColumnsResponse }
  | { status: "failed"; error: { code: string; message: string } };

export type IndexColumnsCache = ReadonlyMap<number, IndexColumnsEntry>;

export function emptyColumnsCache(): IndexColumnsCache {
  return new Map();
}

/**
 * Whether a Load should fetch the metadata for `oid`: successes are sticky
 * (same-oid block navigation / Refresh never re-requests); failures are not
 * (the next Load retries automatically).
 */
export function shouldFetchColumns(cache: IndexColumnsCache, oid: number): boolean {
  const entry = cache.get(oid);
  return entry === undefined || entry.status === "failed";
}

export function cacheAfterColumnsOk(
  cache: IndexColumnsCache,
  oid: number,
  data: IndexColumnsResponse,
): IndexColumnsCache {
  return new Map(cache).set(oid, { status: "ok", data });
}

export function cacheAfterColumnsFailure(
  cache: IndexColumnsCache,
  oid: number,
  error: { code: string; message: string },
): IndexColumnsCache {
  return new Map(cache).set(oid, { status: "failed", error });
}

// ---------------------------------------------------------------------------
// Key-values section state (ui-design state table; frozen copy)
// ---------------------------------------------------------------------------

export type KeyColumnsState =
  | { kind: "loading"; note: string }
  | { kind: "note"; note: string }
  | { kind: "columns"; data: IndexColumnsResponse };

export const KEY_COLUMNS_LOADING_NOTE = "loading column metadata…";
export const KEY_COLUMNS_EXPRESSION_NOTE = "expression index — key values not decoded (hex only)";

export function keyColumnsUnavailableNote(code: string): string {
  return `column metadata unavailable (${code}) — key values not shown (hex only)`;
}

/**
 * Metadata status for the key-values section of one index oid. Rendering-only
 * concern (App injects it into the detail panel); never blocks page loading.
 */
export function deriveKeyColumnsState(cache: IndexColumnsCache, oid: number | null): KeyColumnsState | null {
  if (oid === null) return null;
  const entry = cache.get(oid);
  if (entry === undefined) return { kind: "loading", note: KEY_COLUMNS_LOADING_NOTE };
  if (entry.status === "failed") {
    return { kind: "note", note: keyColumnsUnavailableNote(entry.error.code) };
  }
  if (entry.data.hasExpression) {
    return { kind: "note", note: KEY_COLUMNS_EXPRESSION_NOTE };
  }
  return { kind: "columns", data: entry.data };
}

/** Narrow an unknown fetch rejection to the {code,message} pair for the cache. */
export function columnsErrorOf(e: unknown): { code: string; message: string } {
  const err = e as Partial<AppError> | null;
  const code = typeof err?.code === "string" && err.code.length > 0 ? err.code : "UNKNOWN";
  const message = typeof err?.message === "string" ? err.message : "request failed";
  return { code, message };
}

/**
 * Pure derivation helpers for the index tuple key-values section
 * (index-key-decode). T5 part: per-oid column-metadata cache transitions and
 * the degradation state machine (copy strings frozen in ui-design.md).
 * T6 adds the per-column row model on top of these.
 */
import type { ByteRange, DecodedKeyColumn, IndexColumnMeta } from "page-core";
import type { AppError, IndexColumnRow, IndexColumnsResponse } from "./api";

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

// ---------------------------------------------------------------------------
// Row model (T6; ui-design key-values block, copy frozen)
// ---------------------------------------------------------------------------

/** Display-layer truncation for text-family values (mirror of hex 64B). */
export const KEY_VALUE_TRUNCATE_CHARS = 64;

const TEXT_FAMILY_TYPNAMES = new Set(["text", "varchar", "bpchar"]);

/** API metadata -> page-core decode input (design §5 web thin layer). */
export function toIndexColumnMeta(columns: IndexColumnRow[]): IndexColumnMeta[] {
  return columns.map((c) => ({
    attnum: c.attnum,
    name: c.name,
    typoid: c.typoid,
    typname: c.typname,
    kind: c.kind,
  }));
}

export type KeyRow =
  | {
      kind: "value";
      attnum: number;
      name: string;
      typname: string;
      /** Truncated display (quotes kept for text family). */
      display: string;
      badges: string[];
      /** Set when the text-family display was truncated at 64 chars. */
      truncation?: { total: number };
      /** Value byte range (P1 hex highlight). */
      range?: ByteRange;
    }
  | { kind: "null"; attnum: number; name: string; typname: string; badges: string[] }
  | {
      kind: "degraded";
      attnum: number;
      name: string;
      typname: string;
      /** Frozen wording: `unsupported type: {typname}` / `decode error: {reason}`. */
      reason: string;
      /** Decoder explanation for the columns hidden after this row (if any). */
      laterNote?: string;
    };

export type KeyValuesSection =
  | { kind: "loading"; note: string }
  | { kind: "note"; note: string }
  | { kind: "rows"; rows: KeyRow[] };

function badgesFor(meta: IndexColumnsResponse, attnum: number): string[] {
  const col = meta.columns.find((c) => c.attnum === attnum);
  return col && col.kind === "include" ? ["include"] : [];
}

/**
 * decodeIndexTupleKeys output -> display rows (Spec value contract is applied
 * upstream; this handles truncation, badges and degradation cuts). Rows stop
 * at the first degraded column — later column boundaries are unknowable, so
 * the first degraded row carries the decoder's later-columns explanation.
 */
export function buildKeyValuesSection(
  decoded: DecodedKeyColumn[],
  meta: IndexColumnsResponse,
): KeyValuesSection {
  // single all-unsupported index (e.g. pure jsonb): index-level hex-only note
  if (decoded.length > 0 && decoded.every((c) => c.status === "unsupported")) {
    return { kind: "note", note: `unsupported type: ${decoded[0]!.typname}` };
  }

  const rows: KeyRow[] = [];
  for (let i = 0; i < decoded.length; i++) {
    const col = decoded[i]!;
    if (col.status === "value") {
      const badges = badgesFor(meta, col.attnum);
      if (TEXT_FAMILY_TYPNAMES.has(col.typname)) {
        const content =
          col.display != null && col.display.startsWith("'") && col.display.endsWith("'") && col.display.length >= 2
            ? col.display.slice(1, -1)
            : (col.display ?? "");
        if (content.length > KEY_VALUE_TRUNCATE_CHARS) {
          rows.push({
            kind: "value",
            attnum: col.attnum,
            name: col.name,
            typname: col.typname,
            display: `'${content.slice(0, KEY_VALUE_TRUNCATE_CHARS)}…'`,
            badges,
            truncation: { total: content.length },
            range: col.range,
          });
          continue;
        }
      }
      rows.push({
        kind: "value",
        attnum: col.attnum,
        name: col.name,
        typname: col.typname,
        display: col.display ?? "",
        badges,
        range: col.range,
      });
      continue;
    }
    if (col.status === "null") {
      rows.push({
        kind: "null",
        attnum: col.attnum,
        name: col.name,
        typname: col.typname,
        badges: badgesFor(meta, col.attnum),
      });
      continue;
    }
    // degraded (unsupported / error): frozen reason + cut; surface the
    // decoder's explanation for the columns that can no longer be stepped.
    const later = decoded[i + 1];
    rows.push({
      kind: "degraded",
      attnum: col.attnum,
      name: col.name,
      typname: col.typname,
      reason:
        col.status === "unsupported"
          ? `unsupported type: ${col.typname}`
          : `decode error: ${col.reason ?? "unknown"}`,
      laterNote: later?.status === "error" ? (later.reason ?? undefined) : undefined,
    });
    break;
  }
  return { kind: "rows", rows };
}

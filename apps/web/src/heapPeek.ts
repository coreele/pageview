/**
 * Heap peek overlay state (index-viewer change-4 annex 4, P1-3 revision):
 * clicking a leaf/posting heap TID opens a near-fullscreen read-only overlay
 * on the current page instead of switching the relation in place. Pure state
 * slice — opening or closing never touches the main index view state
 * (P0-12 semantics preserved, change-4 point 3).
 */
import type { ParsedPage } from "page-core";
import type { AppError, IndexRow, SchemaResponse } from "./api";

export type HeapPeekRequest = {
  tableOid: number;
  tableQualifiedName: string;
  blkno: number;
};

/** Build a peek request from the owning index row + target block (TID-row click). */
export function heapPeekRequest(
  index: Pick<IndexRow, "tableOid" | "tableQualifiedName">,
  blkno: number,
): HeapPeekRequest {
  return { tableOid: index.tableOid, tableQualifiedName: index.tableQualifiedName, blkno };
}

export type HeapPeekState =
  | { status: "closed" }
  | { status: "loading"; request: HeapPeekRequest }
  | { status: "open"; request: HeapPeekRequest; page: ParsedPage; schema: SchemaResponse }
  | { status: "error"; request: HeapPeekRequest; error: AppError };

export type HeapPeekAction =
  | { type: "loaded"; page: ParsedPage; schema: SchemaResponse }
  | { type: "error"; error: AppError }
  | { type: "close" };

/** Overlay opens as loading with the captured request (annex-4 trigger). */
export function heapPeekInitial(request: HeapPeekRequest): HeapPeekState {
  return { status: "loading", request };
}

export function heapPeekReducer(state: HeapPeekState, action: HeapPeekAction): HeapPeekState {
  switch (action.type) {
    case "loaded":
      return state.status === "loading"
        ? { status: "open", request: state.request, page: action.page, schema: action.schema }
        : state;
    case "error":
      return state.status === "loading"
        ? { status: "error", request: state.request, error: action.error }
        : state;
    case "close":
      return { status: "closed" };
  }
}

/** Overlay title bar text (annex-4 copy table): `{tableQualifiedName} · blk {N}`. */
export function overlayTitle(request: HeapPeekRequest): string {
  return `${request.tableQualifiedName} · blk ${request.blkno}`;
}

/** Loading copy (annex-4 copy table): `Loading blk {N}…`. */
export function loadingText(blkno: number): string {
  return `Loading blk ${blkno}…`;
}

/**
 * App-level wiring slot: `null` = closed; a TID-row click opens (or re-opens)
 * it with a fresh nonce so the overlay remounts with a pristine slice. These
 * helpers carry no main-view fields — the main index view is never an input.
 */
export type HeapPeekSlot = { request: HeapPeekRequest; nonce: number } | null;

export function openHeapPeekSlot(request: HeapPeekRequest, nonce: number): HeapPeekSlot {
  return { request, nonce };
}

export function closeHeapPeekSlot(): HeapPeekSlot {
  return null;
}

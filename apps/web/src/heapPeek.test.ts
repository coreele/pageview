import { describe, expect, it } from "vitest";
import { buildSparsePage, parsePage } from "page-core";
import type { AppError, IndexRow, SchemaResponse } from "./api";
import {
  closeHeapPeekSlot,
  heapPeekInitial,
  heapPeekReducer,
  heapPeekRequest,
  loadingText,
  openHeapPeekSlot,
  overlayTitle,
  type HeapPeekState,
} from "./heapPeek";

// Change-4 annex 4 (P1-3 revision): clicking a leaf/posting heap TID opens a
// near-fullscreen read-only heap peek overlay instead of switching the relation
// kind in place. These tests pin the pure state slice the overlay consumes.

const owner: Pick<IndexRow, "tableOid" | "tableQualifiedName"> = {
  tableOid: 16384,
  tableQualifiedName: "public.orders",
};

const schema: SchemaResponse = {
  oid: 16384,
  schema: "public",
  name: "orders",
  qualifiedName: "public.orders",
  columns: [],
};

const page = parsePage(buildSparsePage({ currentBlkno: 7 }));

const rangeError: AppError = {
  code: "BLKNO_OUT_OF_RANGE",
  message: "block 999 is out of range for this relation",
  nextStep: "Pick a blkno below the relation block count.",
};

describe("heapPeekRequest (TID-row click target)", () => {
  it("builds {tableOid, tableQualifiedName, blkno} from the owning index row", () => {
    expect(heapPeekRequest(owner, 7)).toEqual({
      tableOid: 16384,
      tableQualifiedName: "public.orders",
      blkno: 7,
    });
  });
});

describe("heapPeekReducer (open / close / error paths, annex-4 rules)", () => {
  it("opens as loading with the request retained (overlay open on TID-row click)", () => {
    expect(heapPeekInitial(heapPeekRequest(owner, 7))).toEqual({
      status: "loading",
      request: heapPeekRequest(owner, 7),
    });
  });

  it("loaded → open with the parsed page and schema attached", () => {
    const state = heapPeekReducer(heapPeekInitial(heapPeekRequest(owner, 7)), {
      type: "loaded",
      page,
      schema,
    });
    expect(state.status).toBe("open");
    expect(state).toMatchObject({ request: heapPeekRequest(owner, 7), schema });
  });

  it("endpoint errors land in an error state that keeps the request (title stays renderable)", () => {
    const state = heapPeekReducer(heapPeekInitial(heapPeekRequest(owner, 999)), {
      type: "error",
      error: rangeError,
    });
    expect(state).toEqual({ status: "error", request: heapPeekRequest(owner, 999), error: rangeError });
  });

  it("close (Esc / ✕ / backdrop click — equivalent) returns to closed from every state", () => {
    const loading: HeapPeekState = heapPeekInitial(heapPeekRequest(owner, 7));
    const open: HeapPeekState = heapPeekReducer(loading, { type: "loaded", page, schema });
    const errored: HeapPeekState = heapPeekReducer(loading, { type: "error", error: rangeError });
    for (const from of [loading, open, errored]) {
      expect(heapPeekReducer(from, { type: "close" })).toEqual({ status: "closed" });
    }
  });

  it("ignores stale responses after leaving the loading state (no clobber)", () => {
    const open: HeapPeekState = heapPeekReducer(heapPeekInitial(heapPeekRequest(owner, 7)), {
      type: "loaded",
      page,
      schema,
    });
    expect(heapPeekReducer(open, { type: "error", error: rangeError })).toBe(open);

    const errored: HeapPeekState = heapPeekReducer(heapPeekInitial(heapPeekRequest(owner, 7)), {
      type: "error",
      error: rangeError,
    });
    expect(heapPeekReducer(errored, { type: "loaded", page, schema })).toBe(errored);

    const closed: HeapPeekState = { status: "closed" };
    expect(heapPeekReducer(closed, { type: "loaded", page, schema })).toBe(closed);
    expect(heapPeekReducer(closed, { type: "error", error: rangeError })).toBe(closed);
  });
});

describe("overlay copy (annex-4 English copy table)", () => {
  it("title bar is `{tableQualifiedName} · blk {N}`", () => {
    expect(overlayTitle(heapPeekRequest(owner, 7))).toBe("public.orders · blk 7");
  });

  it("loading text is `Loading blk {N}…`", () => {
    expect(loadingText(7)).toBe("Loading blk 7…");
  });
});

describe("App wiring model (change-4 point 3: main view zero impact)", () => {
  it("a TID-row click opens a slot keyed by a fresh nonce; close clears it", () => {
    const first = openHeapPeekSlot(heapPeekRequest(owner, 7), 1);
    expect(first).toEqual({ request: heapPeekRequest(owner, 7), nonce: 1 });

    // Re-opening the same target gets a fresh nonce (remount → fresh slice).
    expect(openHeapPeekSlot(heapPeekRequest(owner, 7), 2)).toEqual({
      request: heapPeekRequest(owner, 7),
      nonce: 2,
    });

    expect(closeHeapPeekSlot()).toBeNull();
  });

  it("the slot carries no main-view state (page/selection/highlight/diff stay in App)", () => {
    const slot = openHeapPeekSlot(heapPeekRequest(owner, 7), 1);
    expect(Object.keys(slot!)).toEqual(["request", "nonce"]);
  });
});

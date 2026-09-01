import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  annotateCtidBlocks,
  decodePageTuples,
  deriveStructureFields,
  PageParseError,
  parsePage,
  type ByteRange,
  type ParsedPage,
  type StructureField,
} from "page-core";
import { fetchPage, fetchSchema, type AppError } from "./api";
import { HexDump } from "./HexDump";
import { HeapDetail, StructureMap } from "./StructureMap";
import { findStructureAt } from "./diff";
import { heapPeekInitial, heapPeekReducer, loadingText, overlayTitle, type HeapPeekRequest } from "./heapPeek";

type Props = {
  /** Peek target (owning table + block) captured at open time. */
  request: HeapPeekRequest;
  /** Trigger element captured at open time — focus is returned on close (annex-4 rule 2). */
  triggerRef: RefObject<HTMLElement | null>;
  /** Esc / ✕ / backdrop click — all equivalent close paths (annex-4 rule 1). */
  onClose: () => void;
};

const EMPTY_DIFF_IDS: Set<string> = new Set();

/**
 * Read-only heap page peek overlay (index-viewer change-4 annex 4, P1-3
 * revision). Owns an independent state slice (schema+page fetched by
 * tableOid+blkno, endpoint errors rendered inside); never mutates the main
 * index view. No Load/blkno input/Refresh/diff/secondary jumps (annex-4
 * rule 3): the shared tri-pane renders the heap page, selection+hex linkage
 * stay local, and ctid cross-block buttons are not rendered (HeapDetail
 * omits onLoadCrossBlock here).
 */
export function HeapPeekOverlay({ request, triggerRef, onClose }: Props) {
  const [state, dispatch] = useReducer(heapPeekReducer, request, heapPeekInitial);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<ByteRange | null>(null);
  const [hexLocate, setHexLocate] = useState<{ offset: number; nonce: number } | null>(null);
  const hexLocateNonceRef = useRef(0);
  const hexLocateHandledNonceRef = useRef(0);

  // Annex-4 rule 2: lock body scroll while the overlay is up.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Annex-4 rule 1: Esc closes (equivalent to ✕ / backdrop click).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Annex-4 rule 2: initial focus on ✕; focus returns to the trigger on close.
  useEffect(() => {
    closeBtnRef.current?.focus();
    return () => {
      triggerRef.current?.focus();
    };
  }, [triggerRef]);

  // Change-4 point 4: fetch schema + raw page by tableOid+blkno directly —
  // no table-list precheck; endpoint errors render inside the overlay.
  useEffect(() => {
    if (state.status !== "loading") return;
    let cancelled = false;
    (async () => {
      try {
        const [schema, rawPage] = await Promise.all([
          fetchSchema(request.tableOid),
          fetchPage(request.tableOid, request.blkno),
        ]);
        const bytes = Uint8Array.from(atob(rawPage.pageBase64), (c) => c.charCodeAt(0));
        let parsed: ParsedPage;
        try {
          parsed = decodePageTuples(
            annotateCtidBlocks(parsePage(bytes), request.blkno),
            schema.columns.map((c) => ({
              attnum: c.attnum,
              name: c.name,
              typname: c.typname,
              typlen: c.typlen,
              attlen: c.attlen,
              attalign: c.attalign,
              attisdropped: c.attisdropped,
            })),
          );
        } catch (pe) {
          if (pe instanceof PageParseError) {
            if (!cancelled) {
              dispatch({
                type: "error",
                error: {
                  code: "UNSUPPORTED_PAGE",
                  message: pe.message,
                  nextStep: "Use a standard 8KB BLCKSZ PostgreSQL instance, or pick another relation.",
                },
              });
            }
            return;
          }
          throw pe;
        }
        if (!cancelled) dispatch({ type: "loaded", page: parsed, schema });
      } catch (e) {
        if (!cancelled) dispatch({ type: "error", error: e as AppError });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.status, request]);

  const fields = useMemo<StructureField[] | null>(
    () => (state.status === "open" ? deriveStructureFields(state.page) : null),
    [state],
  );

  const selectByteRange = (id: string, range: ByteRange, origin: "structure" | "hex") => {
    const rangeChanged =
      !highlight || highlight.start !== range.start || highlight.end !== range.end;
    setSelectedId(id);
    setHighlight(range);
    if (origin === "hex") return;
    if (!rangeChanged) return;
    hexLocateNonceRef.current += 1;
    setHexLocate({ offset: range.start, nonce: hexLocateNonceRef.current });
  };

  if (state.status === "closed") return null;

  const title = overlayTitle(request);

  return (
    <div className="heap-peek-backdrop" onClick={onClose}>
      <div
        className="heap-peek-overlay"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="heap-peek-header">
          <span className="heap-peek-title mono" title={title}>
            {title}
          </span>
          <button
            ref={closeBtnRef}
            type="button"
            className="heap-peek-close"
            aria-label="Close"
            title="Close"
            onClick={onClose}
          >
            ✕ Close
          </button>
        </div>
        <div className="heap-peek-body">
          {state.status === "loading" && (
            <div className="muted heap-peek-status">
              <span className="spinner" /> {loadingText(request.blkno)}
            </div>
          )}
          {state.status === "error" && (
            <div className="panel error-panel" role="alert">
              <div>
                <strong>{state.error.code}</strong>: {state.error.message}
              </div>
              <div className="next">Next: {state.error.nextStep}</div>
            </div>
          )}
          {state.status === "open" && (
            <div className="main-split heap-peek-split">
              <section className="pane pane-structure" aria-label="Heap page structure">
                <StructureMap
                  raw={state.page.raw}
                  freeRange={state.page.freeSpace.range}
                  fields={fields ?? []}
                  selectedId={selectedId}
                  highlight={highlight}
                  diffIds={EMPTY_DIFF_IDS}
                  detailOpen
                  onSelect={(id, range) => selectByteRange(id, range, "structure")}
                  emptyStateText={
                    state.page.tuples.length === 0
                      ? "No NORMAL tuples on this page. Free space dominates; structure is still browsable."
                      : null
                  }
                  renderDetail={() => (
                    <HeapDetail
                      page={state.page}
                      selectedId={selectedId}
                      currentBlkno={request.blkno}
                    />
                  )}
                />
              </section>
              <section className="pane pane-hex" aria-label="Hex dump panel">
                <HexDump
                  raw={state.page.raw}
                  freeRange={state.page.freeSpace.range}
                  freeDiff={false}
                  highlight={highlight}
                  locate={hexLocate}
                  locateHandledNonceRef={hexLocateHandledNonceRef}
                  onSelectOffset={(offset) => {
                    if (!fields) return;
                    const hit = findStructureAt(fields, offset);
                    if (hit) {
                      selectByteRange(hit.id, hit.range, "hex");
                    } else {
                      selectByteRange(`byte-${offset}`, { start: offset, end: offset + 1 }, "hex");
                    }
                  }}
                />
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

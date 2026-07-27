import { useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import {
  computeHexScrollTarget,
  STRUCTURE_BYTES_PER_ROW,
  type ByteRange,
} from "page-core";
import { buildHexLayout, presentationRowForOffset } from "./hexLayout";
import { freeBreakColumns } from "./structureLayout";

type HexLocate = { offset: number; nonce: number };

type Props = {
  raw: Uint8Array;
  freeRange: ByteRange;
  freeDiff?: boolean;
  highlight: ByteRange | null;
  locate: HexLocate | null;
  /** Survives HexDump unmount so manual re-expand does not re-scroll. */
  locateHandledNonceRef: MutableRefObject<number>;
  onSelectOffset: (offset: number) => void;
};

function toHexByte(b: number): string {
  return b.toString(16).padStart(2, "0");
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function rangesOverlap(a: ByteRange, b: ByteRange): boolean {
  return a.start < b.end && b.start < a.end;
}

export function HexDump({
  raw,
  freeRange,
  freeDiff = false,
  highlight,
  locate,
  locateHandledNonceRef,
  onSelectOffset,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [locateRow, setLocateRow] = useState<number | null>(null);
  const [announce, setAnnounce] = useState("");
  const bytesPerRow = STRUCTURE_BYTES_PER_ROW;

  const layout = useMemo(
    () =>
      buildHexLayout({
        rawLength: raw.length,
        freeRange,
        bytesPerRow,
      }),
    [raw.length, freeRange.start, freeRange.end, bytesPerRow],
  );

  useEffect(() => {
    if (!locate) return;
    if (locateHandledNonceRef.current === locate.nonce) return;
    locateHandledNonceRef.current = locate.nonce;

    const el = containerRef.current;
    if (!el) return;

    const rowEls = el.querySelectorAll(".hex-row");
    const firstRowEl = rowEls[0] as HTMLElement | undefined;
    const secondRowEl = rowEls[1] as HTMLElement | undefined;
    const rowHeightPx = firstRowEl?.getBoundingClientRect().height || 20;
    const styles = getComputedStyle(el);
    // Content Y of first row (= padding-top when rows are the first in-flow flex items).
    const paddingTopPx = firstRowEl
      ? firstRowEl.getBoundingClientRect().top -
        el.getBoundingClientRect().top +
        el.scrollTop -
        el.clientTop
      : parseFloat(styles.paddingTop) || 0;
    // Sibling delta cancels shared offsetParent; fallback to computed flex gap.
    const measuredGap =
      firstRowEl && secondRowEl
        ? secondRowEl.getBoundingClientRect().top -
          firstRowEl.getBoundingClientRect().top -
          rowHeightPx
        : NaN;
    const rowGapPx = Number.isFinite(measuredGap)
      ? Math.max(0, measuredGap)
      : parseFloat(styles.rowGap) || parseFloat(styles.gap) || 0;

    const firstRow = presentationRowForOffset(layout, locate.offset);
    const lastRow = highlight
      ? presentationRowForOffset(
          layout,
          Math.max(highlight.end, locate.offset + 1) - 1,
        )
      : firstRow;

    const target = computeHexScrollTarget({
      firstRow,
      lastRow,
      rowHeightPx,
      rowGapPx,
      paddingTopPx,
      containerHeightPx: el.clientHeight,
      contentHeightPx: el.scrollHeight,
      currentScrollTop: el.scrollTop,
      anchorRatio: 1 / 3,
    });

    if (target != null) {
      el.scrollTo({
        top: target,
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    }

    setLocateRow(firstRow);
    const offHex = locate.offset.toString(16).padStart(4, "0");
    setAnnounce(`hex scrolled to 0x${offHex}`);
    const clear = window.setTimeout(() => {
      setLocateRow(null);
      setAnnounce("");
    }, prefersReducedMotion() ? 400 : 700);
    return () => window.clearTimeout(clear);
    // Scroll only when nonce advances (ref survives unmount). highlight/layout read from render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- P0-12 nonce contract
  }, [locate?.nonce]);

  const rows: ReactNode[] = [];
  for (const row of layout.rows) {
    const cells: ReactNode[] = [];
    for (const part of row.parts) {
      if (part.kind === "break") {
        const selectRange = part.selectRange ?? part.range;
        const isTail = part.selectRange != null;
        const { colStart, colEnd } = freeBreakColumns(part.range, row);
        const selected =
          highlight != null && rangesOverlap(highlight, selectRange) ? " selected" : "";
        const hl = highlight != null && rangesOverlap(highlight, selectRange) ? " hl" : "";
        const diff = freeDiff ? " diff" : "";
        cells.push(
          <button
            key={`break-${part.range.start}-${part.range.end}`}
            type="button"
            className={`hex-free-break free-break${selected}${hl}${diff}`}
            style={{ gridColumn: `${colStart + 1} / ${colEnd + 1}` }}
            aria-label={
              isTail
                ? `free space continuation [${part.range.start}..${part.range.end})`
                : `free space [${selectRange.start}..${selectRange.end}) ${part.bytes} bytes`
            }
            onClick={() => onSelectOffset(selectRange.start)}
          >
            {!isTail ? (
              <span className="free-break-label mono">
                free space [{selectRange.start}..{selectRange.end}) · {part.bytes} bytes
              </span>
            ) : null}
          </button>,
        );
        continue;
      }
      for (let j = 0; j < part.length; j++) {
        const off = part.startOffset + j;
        const hl =
          highlight && off >= highlight.start && off < highlight.end ? "hl" : undefined;
        cells.push(
          <button
            key={off}
            type="button"
            className={`hex-cell${hl ? ` ${hl}` : ""}`}
            onClick={() => onSelectOffset(off)}
          >
            {toHexByte(raw[off]!)}
          </button>,
        );
      }
    }
    const offsetLabel = row.labelOffset.toString(16).padStart(4, "0");
    rows.push(
      <div
        key={`row-${row.rowIndex}-${row.labelOffset}`}
        className={`hex-row${locateRow === row.rowIndex ? " locate-flash" : ""}`}
        role="row"
      >
        <span className="hex-offset mono muted">{offsetLabel}</span>
        <div className="hex-row-grid">{cells}</div>
      </div>,
    );
  }

  return (
    <div className="hex" aria-label="Hex dump" ref={containerRef}>
      <div className="sr-only" aria-live="polite">
        {announce}
      </div>
      {rows}
    </div>
  );
}

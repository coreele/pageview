import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import {
  computeHexScrollTarget,
  STRUCTURE_BYTES_PER_ROW,
  type ByteRange,
} from "page-core";

type HexLocate = { offset: number; nonce: number };

type Props = {
  raw: Uint8Array;
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

export function HexDump({
  raw,
  highlight,
  locate,
  locateHandledNonceRef,
  onSelectOffset,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [locateRow, setLocateRow] = useState<number | null>(null);
  const [announce, setAnnounce] = useState("");
  const rows: ReactNode[] = [];
  const bytesPerRow = STRUCTURE_BYTES_PER_ROW;

  useEffect(() => {
    if (!locate) return;
    if (locateHandledNonceRef.current === locate.nonce) return;
    locateHandledNonceRef.current = locate.nonce;

    const el = containerRef.current;
    if (!el) return;

    const firstRowEl = el.querySelector(".hex-row") as HTMLElement | null;
    const rowHeightPx = firstRowEl?.getBoundingClientRect().height || 20;
    const firstRow = Math.floor(locate.offset / bytesPerRow);
    const lastRow = highlight
      ? Math.floor((Math.max(highlight.end, locate.offset + 1) - 1) / bytesPerRow)
      : firstRow;

    const target = computeHexScrollTarget({
      firstRow,
      lastRow,
      rowHeightPx,
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
    // Scroll only when nonce advances (ref survives unmount). highlight read from render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- P0-12 nonce contract
  }, [locate?.nonce]);

  for (let i = 0; i < raw.length; i += bytesPerRow) {
    const offsetLabel = i.toString(16).padStart(4, "0");
    const rowIndex = i / bytesPerRow;
    const cells: ReactNode[] = [];
    for (let j = 0; j < bytesPerRow && i + j < raw.length; j++) {
      const off = i + j;
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
    rows.push(
      <div
        key={i}
        className={`hex-row${locateRow === rowIndex ? " locate-flash" : ""}`}
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

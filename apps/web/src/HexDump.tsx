import type { ReactNode } from "react";
import type { ByteRange } from "page-core";
import { STRUCTURE_BYTES_PER_ROW } from "page-core";

type Props = {
  raw: Uint8Array;
  highlight: ByteRange | null;
  onSelectOffset: (offset: number) => void;
};

function toHexByte(b: number): string {
  return b.toString(16).padStart(2, "0");
}

export function HexDump({ raw, highlight, onSelectOffset }: Props) {
  const rows: ReactNode[] = [];
  const bytesPerRow = STRUCTURE_BYTES_PER_ROW;
  for (let i = 0; i < raw.length; i += bytesPerRow) {
    const offsetLabel = i.toString(16).padStart(4, "0");
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
      <div key={i} className="hex-row" role="row">
        <span className="hex-offset mono muted">{offsetLabel}</span>
        <div className="hex-row-grid">{cells}</div>
      </div>,
    );
  }
  return (
    <div className="hex" aria-label="Hex dump">
      {rows}
    </div>
  );
}

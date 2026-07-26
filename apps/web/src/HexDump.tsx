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
        <span
          key={off}
          className={hl}
          role="button"
          tabIndex={0}
          onClick={() => onSelectOffset(off)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelectOffset(off);
            }
          }}
        >
          {toHexByte(raw[off]!)}
          {j < bytesPerRow - 1 ? " " : ""}
        </span>,
      );
    }
    rows.push(
      <div key={i}>
        <span className="muted">{offsetLabel}: </span>
        {cells}
      </div>,
    );
  }
  return (
    <div className="hex" aria-label="Hex dump">
      {rows}
    </div>
  );
}

import { useId, useState } from "react";
import type { FlagBit } from "page-core";

export function formatInfomaskHex(label: string, value: number): string {
  return `${label}=0x${value.toString(16)}`;
}

type Props = {
  label: string;
  value: number;
  bits: FlagBit[];
};

export function InfomaskBitStrip({ label, value, bits }: Props) {
  const tipId = useId();
  const refId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [refOpen, setRefOpen] = useState(false);

  const activeIndex = hoverIndex ?? focusIndex;
  const active = activeIndex != null ? bits[activeIndex] ?? null : null;

  return (
    <div className="infomask-bit-strip" aria-label={`${label} bits`}>
      <div className="infomask-bit-strip__toolbar">
        <div className="infomask-bit-strip__hex muted">{formatInfomaskHex(label, value)}</div>
        <div className="infomask-bit-strip__bits" role="list" aria-describedby={active ? tipId : undefined}>
          {bits.map((b, i) => (
            <span
              key={b.name}
              role="listitem"
              tabIndex={0}
              className={`infomask-bit${b.set ? " is-set" : " is-unset"}`}
              aria-label={`${b.name}: ${b.meaning}${b.set ? " (set)" : " (unset)"}`}
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
              onFocus={() => setFocusIndex(i)}
              onBlur={() => setFocusIndex(null)}
            />
          ))}
        </div>
        <button
          type="button"
          className="infomask-bit-strip__help"
          aria-expanded={refOpen}
          aria-controls={refId}
          aria-label={`Show all ${label} bit meanings`}
          onClick={() => setRefOpen((open) => !open)}
        >
          ?
        </button>
      </div>
      {active && (
        <div id={tipId} className="infomask-bit-strip__tip" aria-live="polite">
          <span className="infomask-bit-strip__tip-name">{active.name}</span>
          <span className="infomask-bit-strip__tip-sep"> — </span>
          <span className="infomask-bit-strip__tip-meaning">{active.meaning}</span>
          <span className={`infomask-bit-strip__tip-state${active.set ? " is-set" : ""}`}>
            {active.set ? "set" : "unset"}
          </span>
        </div>
      )}
      {refOpen && (
        <div id={refId} className="infomask-bit-strip__ref" role="region" aria-label={`${label} full bit reference`}>
          <ul className="infomask-bit-strip__ref-list">
            {bits.map((b) => (
              <li key={b.name} className={b.set ? "is-set" : "is-unset"}>
                <span className="infomask-bit-strip__ref-mark" aria-hidden="true">
                  {b.set ? "●" : "○"}
                </span>
                <span className="infomask-bit-strip__ref-name">{b.name}</span>
                <span className="infomask-bit-strip__tip-sep"> — </span>
                <span className="infomask-bit-strip__ref-meaning">{b.meaning}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="infomask-bit-strip__ref-close" onClick={() => setRefOpen(false)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}

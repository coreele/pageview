import { useId, useState } from "react";
import type { FlagBit } from "page-core";

export function formatInfomaskHex(label: string, value: number): string {
  return `${label}=0x${value.toString(16)}`;
}

type StripProps = {
  label: string;
  value: number;
  bits: FlagBit[];
  selectedIndex: number | null;
  tipId?: string;
  onSelect: (index: number | null) => void;
  refOpen: boolean;
  onToggleRef: () => void;
  refId: string;
};

/** Single field toolbar (hex + bits + ?). Tip/ref render in the parent pair. */
export function InfomaskBitStrip({
  label,
  value,
  bits,
  selectedIndex,
  tipId,
  onSelect,
  refOpen,
  onToggleRef,
  refId,
}: StripProps) {
  return (
    <div className="infomask-bit-strip" aria-label={`${label} bits`}>
      <div className="infomask-bit-strip__toolbar">
        <div className="infomask-bit-strip__hex muted">{formatInfomaskHex(label, value)}</div>
        <div className="infomask-bit-strip__row">
          <div
            className="infomask-bit-strip__bits"
            role="list"
            aria-describedby={selectedIndex != null && tipId ? tipId : undefined}
          >
            {bits.map((b, i) => (
              <button
                key={b.name}
                type="button"
                role="listitem"
                className={`infomask-bit${b.set ? " is-set" : " is-unset"}${selectedIndex === i ? " is-active" : ""}${b.name === "HEAP_NATTS" ? " is-natts-wide" : ""}`}
                aria-label={`${b.name}: ${b.meaning}${b.set ? " (set)" : " (unset)"}`}
                aria-pressed={selectedIndex === i}
                title={`${b.name} — ${b.meaning}`}
                onClick={() => onSelect(selectedIndex === i ? null : i)}
              />
            ))}
          </div>
          <button
            type="button"
            className="infomask-bit-strip__help"
            aria-expanded={refOpen}
            aria-controls={refId}
            aria-label={`Show all ${label} bit meanings`}
            onClick={onToggleRef}
          >
            ?
          </button>
        </div>
      </div>
    </div>
  );
}

type PairProps = {
  infomask: number;
  infomask2: number;
  bits: FlagBit[];
  bits2: FlagBit[];
};

type Active = { field: "infomask2" | "infomask"; index: number };

export function InfomaskBitPair({ infomask, infomask2, bits, bits2 }: PairProps) {
  const tipId = useId();
  const refId2 = useId();
  const refId1 = useId();
  const [active, setActive] = useState<Active | null>(null);
  const [refField, setRefField] = useState<"infomask2" | "infomask" | null>(null);

  const activeBits = active?.field === "infomask2" ? bits2 : bits;
  const activeBit = active ? activeBits[active.index] ?? null : null;
  const refBits = refField === "infomask2" ? bits2 : refField === "infomask" ? bits : null;
  const refLabel = refField === "infomask2" ? "t_infomask2" : "t_infomask";
  const refId = refField === "infomask2" ? refId2 : refId1;

  return (
    <div className="infomask-bit-pair" aria-label="Tuple infomask bits">
      <div className="infomask-bit-pair__strips">
        <InfomaskBitStrip
          label="t_infomask2"
          value={infomask2}
          bits={bits2}
          selectedIndex={active?.field === "infomask2" ? active.index : null}
          tipId={tipId}
          onSelect={(index) => setActive(index == null ? null : { field: "infomask2", index })}
          refOpen={refField === "infomask2"}
          onToggleRef={() => setRefField((f) => (f === "infomask2" ? null : "infomask2"))}
          refId={refId2}
        />
        <div className="infomask-bit-pair__sep" aria-hidden="true" />
        <InfomaskBitStrip
          label="t_infomask"
          value={infomask}
          bits={bits}
          selectedIndex={active?.field === "infomask" ? active.index : null}
          tipId={tipId}
          onSelect={(index) => setActive(index == null ? null : { field: "infomask", index })}
          refOpen={refField === "infomask"}
          onToggleRef={() => setRefField((f) => (f === "infomask" ? null : "infomask"))}
          refId={refId1}
        />
      </div>
      {activeBit && (
        <div id={tipId} className="infomask-bit-pair__tip" aria-live="polite">
          <div className="infomask-bit-pair__tip-main">
            <span className="infomask-bit-strip__tip-name">{activeBit.name}</span>
            <span className="infomask-bit-strip__tip-sep"> — </span>
            <span className="infomask-bit-strip__tip-meaning">{activeBit.meaning}</span>
          </div>
          <span className={`infomask-bit-strip__tip-state${activeBit.set ? " is-set" : ""}`}>
            {activeBit.set ? "set" : "unset"}
          </span>
        </div>
      )}
      {refBits && (
        <div id={refId} className="infomask-bit-pair__ref" role="region" aria-label={`${refLabel} full bit reference`}>
          <ul className="infomask-bit-strip__ref-list">
            {refBits.map((b) => (
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
          <button type="button" className="infomask-bit-strip__ref-close" onClick={() => setRefField(null)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}

/** One infomask-style strip (hex + bit squares + ?) with tip/ref. */
export function FlagBitStripSolo({
  label,
  value,
  bits,
}: {
  label: string;
  value: number;
  bits: FlagBit[];
}) {
  const tipId = useId();
  const refId = useId();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [refOpen, setRefOpen] = useState(false);
  const activeBit = selectedIndex != null ? bits[selectedIndex] ?? null : null;

  return (
    <div className="infomask-bit-pair" aria-label={`${label} bits`}>
      <div className="infomask-bit-pair__strips">
        <InfomaskBitStrip
          label={label}
          value={value}
          bits={bits}
          selectedIndex={selectedIndex}
          tipId={tipId}
          onSelect={setSelectedIndex}
          refOpen={refOpen}
          onToggleRef={() => setRefOpen((o) => !o)}
          refId={refId}
        />
      </div>
      {activeBit && (
        <div id={tipId} className="infomask-bit-pair__tip" aria-live="polite">
          <div className="infomask-bit-pair__tip-main">
            <span className="infomask-bit-strip__tip-name">{activeBit.name}</span>
            <span className="infomask-bit-strip__tip-sep"> — </span>
            <span className="infomask-bit-strip__tip-meaning">{activeBit.meaning}</span>
          </div>
          <span className={`infomask-bit-strip__tip-state${activeBit.set ? " is-set" : ""}`}>
            {activeBit.set ? "set" : "unset"}
          </span>
        </div>
      )}
      {refOpen && (
        <div id={refId} className="infomask-bit-pair__ref" role="region" aria-label={`${label} full bit reference`}>
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

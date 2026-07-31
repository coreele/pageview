import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { WalRecordDto } from "./api";

export type WalPhase = "idle" | "loading" | "loaded" | "error";

const emptyNewLsns = new Set<string>();

export type WalViewProps = {
  phase: WalPhase;
  records: WalRecordDto[];
  /** start_lsn values new vs previous Load (empty on first Load). */
  newLsns?: Set<string>;
  detailOpen?: boolean;
};

export function WalView({ phase, records, newLsns, detailOpen = true }: WalViewProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const highlighted = newLsns ?? emptyNewLsns;

  useEffect(() => {
    setSelectedKey(null);
  }, [records]);

  const recordKey = (r: WalRecordDto, i: number) => `${r.startLsn}::${i}`;

  const selected = records.find((r, i) => recordKey(r, i) === selectedKey) ?? null;

  const onListKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (records.length === 0) return;
    const idx = selectedKey
      ? records.findIndex((r, i) => recordKey(r, i) === selectedKey)
      : -1;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(records.length - 1, Math.max(0, idx + 1));
      setSelectedKey(recordKey(records[next]!, next));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.max(0, idx <= 0 ? 0 : idx - 1);
      setSelectedKey(recordKey(records[next]!, next));
    } else if (e.key === "Enter" && idx >= 0) {
      e.preventDefault();
      setSelectedKey(recordKey(records[idx]!, idx));
    }
  };

  return (
    <div className={`wal-layout${detailOpen ? "" : " wal-layout--detail-collapsed"}`}>
      <div className="wal-main">
        <section
          className="wal-list-pane"
          aria-label="WAL records"
          tabIndex={0}
          ref={listRef}
          onKeyDown={onListKeyDown}
        >
          {phase === "idle" && (
            <div className="panel muted">
              Recent LSN range is prefilled — press Load, or use recent 20 to refresh and load.
            </div>
          )}
          {phase === "loading" && (
            <div className="panel muted">
              <span className="spinner" /> Loading WAL records…
            </div>
          )}
          {phase === "loaded" && records.length === 0 && (
            <div className="panel muted">
              Empty batch: no WAL records in this LSN range. Adjust the interval and Load again.
            </div>
          )}
          {phase === "loaded" && records.length > 0 && (
            <>
              <div className="wal-record-header wal-record-grid" aria-hidden="true">
                <span className="wal-col">start_lsn</span>
                <span className="wal-col">xid</span>
                <span className="wal-col">resource</span>
                <span className="wal-col">type</span>
                <span className="wal-col">len_record</span>
                <span className="wal-col">len_main</span>
                <span className="wal-col">len_fpi</span>
                <span className="wal-col">description</span>
                <span className="wal-col">block_ref</span>
              </div>
              <ul className="wal-record-list" role="listbox" aria-label="WAL record list">
                {records.map((r, i) => {
                  const key = recordKey(r, i);
                  const selectedRow = key === selectedKey;
                  const isNew = highlighted.has(r.startLsn);
                  return (
                    <li key={key} role="option" aria-selected={selectedRow}>
                      <div
                        className={`wal-record-row wal-record-grid${selectedRow ? " selected" : ""}${isNew ? " diff" : ""}`}
                        tabIndex={0}
                        title={isNew ? "New since previous Load" : undefined}
                        onClick={() => setSelectedKey(key)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedKey(key);
                          }
                        }}
                      >
                        <span
                          className="wal-col wal-lsn mono"
                          title={r.endLsn ? `end ${r.endLsn}` : undefined}
                        >
                          {r.startLsn}
                        </span>
                        <span className="wal-col wal-xid mono">{r.xid ?? "—"}</span>
                        <span className="wal-col wal-rm">{r.resourceManager}</span>
                        <span className="wal-col wal-type">{r.recordType}</span>
                        <span className="wal-col wal-len mono">{r.recordLength}</span>
                        <span className="wal-col wal-main-len mono">{r.mainDataLength ?? "—"}</span>
                        <span className="wal-col wal-fpi-len mono">{r.fpiLength}</span>
                        <span className="wal-col wal-desc" title={r.description ?? undefined}>
                          {r.description ?? "—"}
                        </span>
                        <span className="wal-col wal-block-ref mono" title={r.blockRef ?? undefined}>
                          {r.blockRef ?? "—"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {phase === "error" && (
            <div className="panel muted">WAL load failed — see the error panel above.</div>
          )}
        </section>

        {detailOpen && (
          <section
            id="wal-detail-panel"
            className="wal-detail-pane"
            aria-label="WAL record detail"
          >
            {selected ? (
              <div className="wal-detail-summary">
                <div>
                  <span className="label">start LSN</span>{" "}
                  <span className="mono">{selected.startLsn}</span>
                </div>
                <div>
                  <span className="label">end LSN</span>{" "}
                  <span className="mono">{selected.endLsn ?? "—"}</span>
                </div>
                <div>
                  <span className="label">prev LSN</span>{" "}
                  <span className="mono">{selected.prevLsn ?? "—"}</span>
                </div>
                <div>
                  <span className="label">RM / type</span>{" "}
                  {selected.resourceManager} / {selected.recordType}
                </div>
                <div>
                  <span className="label">lengths</span> record {selected.recordLength}
                  {selected.mainDataLength != null ? `, main ${selected.mainDataLength}` : ""}, FPI{" "}
                  {selected.fpiLength}
                </div>
                {selected.description && (
                  <div>
                    <span className="label">description</span> {selected.description}
                  </div>
                )}
                {selected.blockRef && (
                  <div>
                    <span className="label">block_ref</span>{" "}
                    <span className="mono">{selected.blockRef}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="panel muted">Select a record to see its summary.</div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

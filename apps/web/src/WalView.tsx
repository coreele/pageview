import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import { hasFpi } from "wal-core";
import {
  fetchCurrentWalLsn,
  fetchWalRecords,
  type AppError,
  type WalRecordDto,
} from "./api";

export type WalViewProps = {
  connected: boolean;
  onError: (err: AppError | null) => void;
  onRangeMeta: (meta: { startLsn: string; endLsn: string; count: number } | null) => void;
};

type WalPhase = "idle" | "loading" | "loaded" | "error";

export function WalView({ connected, onError, onRangeMeta }: WalViewProps) {
  const [startLsn, setStartLsn] = useState("");
  const [endLsn, setEndLsn] = useState("");
  const [phase, setPhase] = useState<WalPhase>("idle");
  const [records, setRecords] = useState<WalRecordDto[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [expandedFpi, setExpandedFpi] = useState<Set<string>>(() => new Set());
  const [fillingLsn, setFillingLsn] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const recordKey = (r: WalRecordDto, i: number) => `${r.startLsn}::${i}`;

  const selected = records.find((r, i) => recordKey(r, i) === selectedKey) ?? null;

  const onFillCurrentLsn = async () => {
    if (!connected) return;
    setFillingLsn(true);
    onError(null);
    try {
      const lsn = await fetchCurrentWalLsn();
      setStartLsn(lsn);
      setEndLsn(lsn);
    } catch (e) {
      onError(e as AppError);
    } finally {
      setFillingLsn(false);
    }
  };

  const onLoad = useCallback(async () => {
    if (!connected) {
      onError({
        code: "NOT_CONNECTED",
        message: "Not connected",
        nextStep: "Connect first, then load a WAL range.",
      });
      return;
    }
    const start = startLsn.trim();
    const end = endLsn.trim();
    if (!start || !end) {
      onError({
        code: "BAD_LSN",
        message: "start LSN and end LSN are required",
        nextStep: "Enter both LSN values (or use Fill current LSN), then press Load.",
      });
      setPhase("error");
      return;
    }
    setPhase("loading");
    onError(null);
    setSelectedKey(null);
    setExpandedFpi(new Set());
    try {
      const data = await fetchWalRecords(start, end);
      setRecords(data.records);
      setPhase("loaded");
      onRangeMeta({ startLsn: data.startLsn, endLsn: data.endLsn, count: data.count });
    } catch (e) {
      setRecords([]);
      setPhase("error");
      onRangeMeta(null);
      onError(e as AppError);
    }
  }, [connected, startLsn, endLsn, onError, onRangeMeta]);

  const toggleFpi = (key: string) => {
    setExpandedFpi((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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

  const canLoad = connected && phase !== "loading";

  return (
    <div className="wal-layout">
      <aside className="wal-nav" aria-label="WAL query">
        <label className="control wal-field">
          <span className="control-label">start LSN</span>
          <input
            className="mono"
            value={startLsn}
            onChange={(e) => setStartLsn(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void onLoad();
              }
            }}
            placeholder="0/16B3748"
            disabled={!connected || phase === "loading"}
            required
          />
        </label>
        <label className="control wal-field">
          <span className="control-label">end LSN</span>
          <input
            className="mono"
            value={endLsn}
            onChange={(e) => setEndLsn(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void onLoad();
              }
            }}
            placeholder="0/16B4000"
            disabled={!connected || phase === "loading"}
            required
          />
        </label>
        <div className="wal-nav-actions">
          <button
            type="button"
            disabled={!connected || fillingLsn || phase === "loading"}
            onClick={() => void onFillCurrentLsn()}
          >
            {fillingLsn ? (
              <>
                <span className="spinner" /> Filling…
              </>
            ) : (
              "Fill current LSN"
            )}
          </button>
          <button
            className="primary"
            type="button"
            disabled={!canLoad}
            onClick={() => void onLoad()}
          >
            {phase === "loading" ? (
              <>
                <span className="spinner" /> Load
              </>
            ) : (
              "Load"
            )}
          </button>
        </div>
        <p className="muted wal-hint">
          Enter a start/end LSN range, then Load. Filling current LSN does not auto-load.
        </p>
      </aside>

      <div className="wal-main">
        <section
          className="wal-list-pane"
          aria-label="WAL records"
          tabIndex={0}
          ref={listRef}
          onKeyDown={onListKeyDown}
        >
          {phase === "idle" && (
            <div className="panel muted">Enter start and end LSN, then press Load.</div>
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
            <ul className="wal-record-list" role="listbox" aria-label="WAL record list">
              {records.map((r, i) => {
                const key = recordKey(r, i);
                const selectedRow = key === selectedKey;
                const fpi = hasFpi(r);
                const fpiOpen = expandedFpi.has(key);
                return (
                  <li key={key} role="option" aria-selected={selectedRow}>
                    <div
                      className={`wal-record-row${selectedRow ? " selected" : ""}`}
                      tabIndex={0}
                      onClick={() => setSelectedKey(key)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedKey(key);
                        }
                      }}
                    >
                      <span className="wal-col wal-lsn mono" title={`end ${r.endLsn ?? "—"} · prev ${r.prevLsn ?? "—"}`}>
                        {r.startLsn}
                        {(r.endLsn || r.prevLsn) && (
                          <span className="wal-lsn-sub muted">
                            {r.endLsn ? ` → ${r.endLsn}` : ""}
                            {r.prevLsn ? ` · prev ${r.prevLsn}` : ""}
                          </span>
                        )}
                      </span>
                      <span className="wal-col wal-rm">
                        <strong>{r.resourceManager}</strong>
                        <span className="muted"> · {r.recordType}</span>
                      </span>
                      <span className="wal-col wal-len mono">
                        len {r.recordLength}
                        {r.mainDataLength != null ? ` · main ${r.mainDataLength}` : ""}
                      </span>
                      <span className="wal-col wal-xid mono">{r.xid ?? "—"}</span>
                      <span
                        className="wal-col wal-desc"
                        title={[r.description, r.blockRef].filter(Boolean).join("\n") || undefined}
                      >
                        {r.description || r.blockRef || "—"}
                      </span>
                      {fpi && (
                        <button
                          type="button"
                          className="wal-col wal-fpi"
                          aria-expanded={fpiOpen}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFpi(key);
                          }}
                        >
                          <span className="wal-fpi-chip">
                            FPI · {r.fpiLength} bytes {fpiOpen ? "▾" : "▸"}
                          </span>
                          {fpiOpen && (
                            <span className="wal-fpi-meta muted">
                              Full page image metadata only — length {r.fpiLength}
                              {r.blockRef ? `; ${r.blockRef}` : ""}. Raw FPI bytes are not rendered.
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {phase === "error" && (
            <div className="panel muted">WAL load failed — see the error panel above.</div>
          )}
        </section>

        <section className="wal-detail-pane" aria-label="WAL record detail and hex placeholder">
          {selected ? (
            <>
              <div className="wal-detail-summary">
                <div>
                  <span className="label">start LSN</span>{" "}
                  <span className="mono">{selected.startLsn}</span>
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
              <div className="wal-hex-placeholder panel">
                <strong>Hex / raw bytes</strong>
                <p>
                  WAL v1 does not provide raw byte hex dumps. Records come from{" "}
                  <code>pg_walinspect</code> structured fields only — this app will not forge a
                  byte stream from metadata.
                </p>
              </div>
            </>
          ) : (
            <div className="panel muted">
              Select a record to see its summary. Hex dump is unavailable in WAL v1.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

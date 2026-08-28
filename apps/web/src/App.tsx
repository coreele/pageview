import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  annotateCtidBlocks,
  decodePageTuples,
  PageParseError,
  parsePage,
  parseBtreePage,
  type ByteRange,
  type ParsedBtreePage,
  type ParsedPage,
} from "page-core";
import {
  connect,
  fetchIndexPage,
  fetchPage,
  fetchRecentWalWindow,
  fetchSchema,
  fetchWalRecords,
  getSession,
  listIndexes,
  listTables,
  type AppError,
  type IndexRow,
  type PublicSession,
  type SchemaResponse,
  type TableRow,
  type WalRecordDto,
} from "./api";
import { HexDump } from "./HexDump";
import { StructureMap } from "./StructureMap";
import { WalView, type WalPhase } from "./WalView";
import { diffByteRanges, findStructureAt, structureAffectedByDiff } from "./diff";
import {
  canLoadIndex,
  formatIndexOption,
  indexOptionTitle,
  levelText,
  nonBtreeHint,
  pageTypeBadge,
} from "./indexView";
import { applyTheme, readSystemTheme, storeTheme, type Theme } from "./theme";

type LoadState = "idle" | "connecting" | "loading-tables" | "loading-indexes" | "loading-page";
type AppMode = "page" | "wal";
/** Page-mode relation kind (index-viewer): default "table" keeps the heap path untouched. */
type RelationKind = "table" | "index";
/** Single page-model union driving the tri-pane area (design §3). */
type PageView =
  | { kind: "heap"; page: ParsedPage }
  | { kind: "btree"; page: ParsedBtreePage; index: IndexRow };

export function App() {
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.dataset.theme as Theme) || readSystemTheme(),
  );
  const [mode, setMode] = useState<AppMode>("page");
  const [walRangeMeta, setWalRangeMeta] = useState<{
    startLsn: string;
    endLsn: string;
    count: number;
  } | null>(null);
  const [walStartLsn, setWalStartLsn] = useState("");
  const [walEndLsn, setWalEndLsn] = useState("");
  const [walPhase, setWalPhase] = useState<WalPhase>("idle");
  const [walFilling, setWalFilling] = useState(false);
  const [walRecords, setWalRecords] = useState<WalRecordDto[]>([]);
  const [walNewLsns, setWalNewLsns] = useState<Set<string>>(() => new Set());
  const [session, setSession] = useState<PublicSession | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState<AppError | null>(null);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [selectedOid, setSelectedOid] = useState<number | null>(null);
  const [blkno, setBlkno] = useState(0);
  const [schema, setSchema] = useState<SchemaResponse | null>(null);
  const [pageView, setPageView] = useState<PageView | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<ByteRange | null>(null);
  const [prevRaw, setPrevRaw] = useState<Uint8Array | null>(null);
  const [diffIds, setDiffIds] = useState<Set<string>>(new Set());
  const [hexCollapsed, setHexCollapsed] = useState(false);
  const [detailCollapsed, setDetailCollapsed] = useState(false);
  const [hexLocate, setHexLocate] = useState<{ offset: number; nonce: number } | null>(null);
  const hexLocateNonceRef = useRef(0);
  const hexLocateHandledNonceRef = useRef(0);

  // index-viewer: relation kind + index list state (design §3)
  const [relationKind, setRelationKind] = useState<RelationKind>("table");
  const [indexes, setIndexes] = useState<IndexRow[]>([]);
  const [selectedIndexOid, setSelectedIndexOid] = useState<number | null>(null);
  const [indexesFetched, setIndexesFetched] = useState(false);

  const [form, setForm] = useState({
    host: "127.0.0.1",
    port: "5432",
    database: "postgres",
    user: "postgres",
    password: "",
  });

  const selectedTable = useMemo(
    () => tables.find((t) => t.oid === selectedOid) ?? null,
    [tables, selectedOid],
  );
  const selectedIndex = useMemo(
    () => indexes.find((i) => i.oid === selectedIndexOid) ?? null,
    [indexes, selectedIndexOid],
  );
  const heapPage = pageView?.kind === "heap" ? pageView.page : null;
  const btreePage = pageView?.kind === "btree" ? pageView.page : null;

  const toggleTheme = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
    storeTheme(next);
  };

  /** P0-12 clearing semantics: page / selection / highlight / diff / hex-locate. */
  const resetPageView = useCallback(() => {
    setPageView(null);
    setSelectedId(null);
    setHighlight(null);
    setPrevRaw(null);
    setDiffIds(new Set());
    setHexLocate(null);
  }, []);

  const refreshTables = useCallback(async () => {
    setLoadState("loading-tables");
    setError(null);
    try {
      const rows = await listTables();
      setTables(rows);
    } catch (e) {
      setError(e as AppError);
    } finally {
      setLoadState("idle");
    }
  }, []);

  const refreshIndexes = useCallback(async () => {
    setLoadState("loading-indexes");
    setError(null);
    try {
      const rows = await listIndexes();
      setIndexes(rows);
      setIndexesFetched(true);
    } catch (e) {
      setError(e as AppError);
    } finally {
      setLoadState("idle");
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const s = await getSession();
        setSession(s);
        if (s.connected) {
          await refreshTables();
        } else if (s.error) {
          setError(s.error);
        }
      } catch (e) {
        setError(e as AppError);
      }
    })();
  }, [refreshTables]);

  const onConnect = async (e: FormEvent) => {
    e.preventDefault();
    setLoadState("connecting");
    setError(null);
    try {
      const s = await connect({
        host: form.host,
        port: Number(form.port),
        database: form.database,
        user: form.user,
        password: form.password,
      });
      // Clear password from React state after submit (P0-10) — never persist
      setForm((f) => ({ ...f, password: "" }));
      setSession(s);
      resetPageView();
      setSchema(null);
      setSelectedOid(null);
      // New database: drop stale index-list state (index-viewer).
      setIndexes([]);
      setSelectedIndexOid(null);
      setIndexesFetched(false);
      await refreshTables();
    } catch (err) {
      setError(err as AppError);
      setSession((prev) =>
        prev
          ? { ...prev, connected: false }
          : {
              connected: false,
              host: null,
              port: null,
              database: null,
              user: null,
              serverVersion: null,
            },
      );
    } finally {
      setLoadState("idle");
    }
  };

  const loadBlk = async (oid: number, block: number, opts?: { refresh?: boolean }) => {
    setLoadState("loading-page");
    setError(null);
    try {
      const [sch, rawPage] = await Promise.all([fetchSchema(oid), fetchPage(oid, block)]);
      setSchema(sch);
      const bytes = Uint8Array.from(atob(rawPage.pageBase64), (c) => c.charCodeAt(0));
      let parsed: ParsedPage;
      try {
        parsed = decodePageTuples(
          annotateCtidBlocks(parsePage(bytes), block),
          sch.columns.map((c) => ({
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
        const parseErr = pe instanceof PageParseError ? pe : null;
        if (parseErr) {
          setPageView(null);
          setError({
            code: "UNSUPPORTED_PAGE",
            message: parseErr.message,
            nextStep: "Use a standard 8KB BLCKSZ PostgreSQL instance, or pick another relation.",
          });
          return;
        }
        throw pe;
      }

      if (opts?.refresh && prevRaw && prevRaw.length === bytes.length) {
        const diffs = diffByteRanges(prevRaw, bytes);
        setDiffIds(structureAffectedByDiff(parsed, diffs));
      } else {
        setDiffIds(new Set());
      }
      setPrevRaw(bytes);
      setPageView({ kind: "heap", page: parsed });
      setBlkno(block);
      setSelectedId(null);
      setHighlight(null);
      setHexLocate(null);
    } catch (err) {
      setError(err as AppError);
      if (!opts?.refresh) setPageView(null);
    } finally {
      setLoadState("idle");
    }
  };

  /**
   * index-viewer: load one B-tree index page. Raw page only — no /schema call
   * (Spec: index pages never fetch table column schema).
   */
  const loadIndexBlk = async (oid: number, block: number, opts?: { refresh?: boolean }) => {
    const index = indexes.find((x) => x.oid === oid) ?? null;
    if (!index) {
      setError({
        code: "NOT_INDEX",
        message: "Selected index is no longer in the index list",
        nextStep: "Switch the relation kind once to refresh the list, then pick an index again.",
      });
      return;
    }
    setLoadState("loading-page");
    setError(null);
    try {
      const rawPage = await fetchIndexPage(oid, block);
      const bytes = Uint8Array.from(atob(rawPage.pageBase64), (c) => c.charCodeAt(0));
      let parsed: ParsedBtreePage;
      try {
        parsed = parseBtreePage(bytes);
      } catch (pe) {
        const parseErr = pe instanceof PageParseError ? pe : null;
        if (parseErr) {
          setPageView(null);
          setError({
            code: "UNSUPPORTED_PAGE",
            message: parseErr.message,
            nextStep: "Use a standard 8KB BLCKSZ PostgreSQL instance, or pick another relation.",
          });
          return;
        }
        throw pe;
      }
      // Byte diff highlight for index pages lands with the tri-pane rendering (T6).
      setDiffIds(new Set());
      setPrevRaw(bytes);
      setPageView({ kind: "btree", page: parsed, index });
      setBlkno(block);
      setSelectedId(null);
      setHighlight(null);
      setHexLocate(null);
    } catch (err) {
      setError(err as AppError);
      if (!opts?.refresh) setPageView(null);
    } finally {
      setLoadState("idle");
    }
  };

  const onSelectTable = async (oid: number) => {
    setSelectedOid(oid);
    setPageView(null);
    setDiffIds(new Set());
    const t = tables.find((x) => x.oid === oid);
    if (t && t.blocks === 0) {
      setError(null);
      setSchema(null);
      return;
    }
    setBlkno(0);
  };

  /** P0-12: switching relation clears page/selection/highlight/diff; blkno resets to 0 (metapage). */
  const onSelectIndex = (oid: number) => {
    setSelectedIndexOid(oid);
    resetPageView();
    setSchema(null);
    setBlkno(0);
  };

  const onSwitchRelationKind = (kind: RelationKind) => {
    if (kind === relationKind) return;
    setRelationKind(kind);
    resetPageView();
    setSchema(null);
  };

  const selectByteRange = (id: string, range: ByteRange, origin: "structure" | "hex") => {
    const rangeChanged =
      !highlight || highlight.start !== range.start || highlight.end !== range.end;
    setSelectedId(id);
    setHighlight(range);
    if (origin === "hex") return;
    if (!rangeChanged) return;
    if (hexCollapsed) setHexCollapsed(false);
    hexLocateNonceRef.current += 1;
    setHexLocate({
      offset: range.start,
      nonce: hexLocateNonceRef.current,
    });
  };

  const onSelectStructure = (id: string, range: ByteRange) => {
    selectByteRange(id, range, "structure");
  };

  const onHexSelect = (offset: number) => {
    if (!heapPage) return;
    const hit = findStructureAt(heapPage, offset);
    if (hit) {
      selectByteRange(hit.id, hit.range, "hex");
    } else {
      selectByteRange(`byte-${offset}`, { start: offset, end: offset + 1 }, "hex");
    }
  };

  const connected = Boolean(session?.connected);
  const canLoad =
    relationKind === "table" &&
    selectedOid != null &&
    (selectedTable?.blocks ?? 0) > 0 &&
    loadState !== "loading-page";

  const triggerLoad = () => {
    if (canLoad && selectedOid != null) void loadBlk(selectedOid, blkno);
  };

  // P0-2: non-B-tree indexes can be selected but never load (no request is sent).
  const canLoadIndexBlk =
    relationKind === "index" &&
    selectedIndexOid != null &&
    canLoadIndex(selectedIndex) &&
    loadState !== "loading-page";

  const triggerLoadIndex = () => {
    if (canLoadIndexBlk && selectedIndexOid != null) {
      void loadIndexBlk(selectedIndexOid, blkno);
    }
  };

  const canWalLoad = connected && walPhase !== "loading" && !walFilling;

  const applyWalLoadResult = useCallback(
    (data: { records: WalRecordDto[]; startLsn: string; endLsn: string; count: number }) => {
      const prevKeys = new Set(walRecords.map((r) => r.startLsn));
      const newLsns =
        prevKeys.size === 0
          ? new Set<string>()
          : new Set(
              data.records
                .filter((r) => !prevKeys.has(r.startLsn))
                .map((r) => r.startLsn),
            );
      setWalNewLsns(newLsns);
      setWalRecords(data.records);
      setWalPhase("loaded");
      setWalRangeMeta({ startLsn: data.startLsn, endLsn: data.endLsn, count: data.count });
    },
    [walRecords],
  );

  // Prefill recent ~20 window when entering WAL (connected). Does not auto-Load.
  useEffect(() => {
    if (!connected || mode !== "wal") return;
    let cancelled = false;
    (async () => {
      setWalFilling(true);
      try {
        const window = await fetchRecentWalWindow(20);
        if (cancelled) return;
        setWalStartLsn(window.startLsn);
        setWalEndLsn(window.endLsn);
      } catch (e) {
        if (!cancelled) setError(e as AppError);
      } finally {
        if (!cancelled) setWalFilling(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connected, mode]);

  // index-viewer: lazily fetch the index list when the index kind is first
  // entered on this connection (ui-design flow 2; retry on re-entry after failure).
  useEffect(() => {
    if (!connected || mode !== "page" || relationKind !== "index" || indexesFetched) return;
    void refreshIndexes();
  }, [connected, mode, relationKind, indexesFetched, refreshIndexes]);

  const onWalLoad = async () => {
    if (!connected) {
      setError({
        code: "NOT_CONNECTED",
        message: "Not connected",
        nextStep: "Connect first, then load a WAL range.",
      });
      return;
    }
    const start = walStartLsn.trim();
    const end = walEndLsn.trim();
    if (!start || !end) {
      setError({
        code: "BAD_LSN",
        message: "start LSN and end LSN are required",
        nextStep: "Enter both LSN values (or use recent 20), then press Load.",
      });
      setWalPhase("error");
      return;
    }
    setWalPhase("loading");
    setError(null);
    try {
      const data = await fetchWalRecords(start, end);
      applyWalLoadResult(data);
    } catch (e) {
      setWalRecords([]);
      setWalNewLsns(new Set());
      setWalPhase("error");
      setWalRangeMeta(null);
      setError(e as AppError);
    }
  };

  /** Fill recent ~20 window and Load in one step. */
  const onWalRecent20 = async () => {
    if (!connected) return;
    setWalFilling(true);
    setWalPhase("loading");
    setError(null);
    try {
      const window = await fetchRecentWalWindow(20);
      setWalStartLsn(window.startLsn);
      setWalEndLsn(window.endLsn);
      const data = await fetchWalRecords(window.startLsn, window.endLsn);
      applyWalLoadResult(data);
    } catch (e) {
      setWalRecords([]);
      setWalNewLsns(new Set());
      setWalPhase("error");
      setWalRangeMeta(null);
      setError(e as AppError);
    } finally {
      setWalFilling(false);
    }
  };

  const connSummary =
    connected && session
      ? `${session.host}:${session.port} / ${session.database} / ${session.user}`
      : "";
  const connTitle =
    connected && session
      ? `${connSummary}\n${session.serverVersion ?? ""}`.trim()
      : undefined;

  const statusLabel =
    loadState === "connecting" ? "connecting…" : connected ? "connected" : "disconnected";

  const indexBadge = btreePage ? pageTypeBadge(btreePage) : null;
  const indexHint = nonBtreeHint(selectedIndex);

  return (
    <div className="app">
      <header className="chrome" aria-label="Application chrome">
        <h1 className="chrome-title">pg-page-viewer</h1>
        <div className="mode-switch" role="group" aria-label="View mode">
          <button
            type="button"
            className={mode === "page" ? "mode-btn active" : "mode-btn"}
            aria-pressed={mode === "page"}
            onClick={() => {
              setMode("page");
              setError(null);
            }}
          >
            Page
          </button>
          <button
            type="button"
            className={mode === "wal" ? "mode-btn active" : "mode-btn"}
            aria-pressed={mode === "wal"}
            onClick={() => {
              setMode("wal");
              setError(null);
              setWalRangeMeta(null);
            }}
          >
            WAL
          </button>
        </div>
        <span
          className={`badge chrome-badge${connected ? " ok badge-conn" : ""}`}
          aria-live="polite"
          tabIndex={connected ? 0 : undefined}
          title={connTitle}
        >
          {statusLabel}
          {connected && session && (
            <span className="conn-popover" role="tooltip" aria-hidden="true">
              <span className="conn-popover-line mono">{connSummary}</span>
              {session.serverVersion ? (
                <span className="conn-popover-line mono">{session.serverVersion}</span>
              ) : null}
            </span>
          )}
        </span>

        <div className="chrome-meta" aria-label="Context strip">
          {!connected ? (
            <div className="meta-row">
              <span className="muted">未连接</span>
            </div>
          ) : mode === "wal" ? (
            <div className="meta-row meta-controls-row">
              <div className="chrome-controls">
                <label className="control">
                  <span className="control-label">start LSN</span>
                  <input
                    className="mono wal-lsn-input"
                    value={walStartLsn}
                    onChange={(e) => setWalStartLsn(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void onWalLoad();
                      }
                    }}
                    placeholder="0/16B3748"
                    disabled={!connected || walPhase === "loading"}
                    required
                  />
                </label>
                <label className="control">
                  <span className="control-label">end LSN</span>
                  <input
                    className="mono wal-lsn-input"
                    value={walEndLsn}
                    onChange={(e) => setWalEndLsn(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void onWalLoad();
                      }
                    }}
                    placeholder="0/16B4000"
                    disabled={!connected || walPhase === "loading"}
                    required
                  />
                </label>
                <button
                  className="primary"
                  type="button"
                  disabled={!canWalLoad}
                  onClick={() => void onWalLoad()}
                >
                  {walPhase === "loading" && !walFilling ? (
                    <>
                      <span className="spinner" /> Load
                    </>
                  ) : (
                    "Load"
                  )}
                </button>
                <button
                  type="button"
                  disabled={!connected || walFilling || walPhase === "loading"}
                  onClick={() => void onWalRecent20()}
                  title="Fill recent ~20 window and Load"
                >
                  {walFilling ? (
                    <>
                      <span className="spinner" /> recent 20
                    </>
                  ) : (
                    "recent 20"
                  )}
                </button>
              </div>
              <div className="meta-stats" aria-label="WAL context">
                <span className="meta-item">
                  <span className="label">mode</span>
                  <span className="value">WAL</span>
                </span>
                {walRangeMeta ? (
                  <>
                    <span className="meta-item">
                      <span className="label">range</span>
                      <span
                        className="value mono"
                        title={`${walRangeMeta.startLsn} – ${walRangeMeta.endLsn}`}
                      >
                        {walRangeMeta.startLsn} – {walRangeMeta.endLsn}
                      </span>
                    </span>
                    <span className="meta-item">
                      <span className="label">#records</span>
                      <span className="value">{walRangeMeta.count}</span>
                    </span>
                    {walNewLsns.size > 0 && (
                      <span className="meta-item">
                        <span className="label">#new</span>
                        <span className="value wal-new-count">{walNewLsns.size}</span>
                      </span>
                    )}
                  </>
                ) : (
                  <span className="meta-item">
                    <span className="label">range</span>
                    <span className="value muted">not loaded</span>
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="meta-row meta-controls-row">
              <div className="chrome-controls">
                <div
                  className="mode-switch relation-kind-switch"
                  role="group"
                  aria-label="Relation kind"
                >
                  <button
                    type="button"
                    className={relationKind === "table" ? "mode-btn active" : "mode-btn"}
                    aria-pressed={relationKind === "table"}
                    onClick={() => onSwitchRelationKind("table")}
                  >
                    表
                  </button>
                  <button
                    type="button"
                    className={relationKind === "index" ? "mode-btn active" : "mode-btn"}
                    aria-pressed={relationKind === "index"}
                    onClick={() => onSwitchRelationKind("index")}
                  >
                    索引
                  </button>
                </div>

                {relationKind === "table" ? (
                  <>
                    <label className="control">
                      <span className="control-label">table</span>
                      <select
                        className="table-select"
                        value={selectedOid ?? ""}
                        disabled={tables.length === 0 || loadState === "loading-tables"}
                        title={selectedTable?.qualifiedName ?? undefined}
                        onChange={(e) => {
                          if (e.target.value !== "") void onSelectTable(Number(e.target.value));
                        }}
                      >
                        <option value="" disabled={tables.length > 0}>
                          {tables.length === 0 ? "no user heap tables" : "select a table…"}
                        </option>
                        {tables.map((t) => (
                          <option key={t.oid} value={t.oid}>
                            {t.qualifiedName} ({t.blocks} blk)
                          </option>
                        ))}
                      </select>
                    </label>
                    {loadState === "loading-tables" && (
                      <span className="muted">
                        <span className="spinner" />
                        tables
                      </span>
                    )}
                    <label className="control">
                      <span className="control-label">blkno</span>
                      <input
                        className="blkno-input"
                        type="number"
                        min={0}
                        value={blkno}
                        onChange={(e) => setBlkno(Number(e.target.value))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            triggerLoad();
                          }
                        }}
                        disabled={!selectedTable || selectedTable.blocks === 0}
                      />
                    </label>
                    <button className="primary" type="button" disabled={!canLoad} onClick={triggerLoad}>
                      {loadState === "loading-page" ? (
                        <>
                          <span className="spinner" /> Load
                        </>
                      ) : (
                        "Load"
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={!heapPage || loadState === "loading-page" || selectedOid == null}
                      onClick={() =>
                        selectedOid != null && loadBlk(selectedOid, blkno, { refresh: true })
                      }
                    >
                      Refresh
                    </button>
                  </>
                ) : (
                  <>
                    <label className="control">
                      <span className="control-label">index</span>
                      <select
                        className="index-select"
                        value={selectedIndexOid ?? ""}
                        disabled={
                          indexes.length === 0 ||
                          loadState === "loading-indexes" ||
                          !indexesFetched
                        }
                        title={selectedIndex ? indexOptionTitle(selectedIndex) : undefined}
                        onChange={(e) => {
                          if (e.target.value !== "") onSelectIndex(Number(e.target.value));
                        }}
                      >
                        <option value="" disabled={indexes.length > 0}>
                          {loadState === "loading-indexes" || !indexesFetched
                            ? "loading indexes…"
                            : indexes.length === 0
                              ? "无用户索引（系统 schema 除外）"
                              : "select an index…"}
                        </option>
                        {indexes.map((i) => (
                          <option key={i.oid} value={i.oid} title={indexOptionTitle(i)}>
                            {formatIndexOption(i)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {loadState === "loading-indexes" && (
                      <span className="muted">
                        <span className="spinner" />
                        indexes
                      </span>
                    )}
                    <label className="control">
                      <span className="control-label">blkno</span>
                      <input
                        className="blkno-input"
                        type="number"
                        min={0}
                        value={blkno}
                        placeholder="0=metapage"
                        onChange={(e) => setBlkno(Number(e.target.value))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            triggerLoadIndex();
                          }
                        }}
                        disabled={!selectedIndex}
                      />
                    </label>
                    <button
                      className="primary"
                      type="button"
                      disabled={!canLoadIndexBlk}
                      title={
                        selectedIndex && !canLoadIndex(selectedIndex)
                          ? indexOptionTitle(selectedIndex)
                          : undefined
                      }
                      onClick={triggerLoadIndex}
                    >
                      {loadState === "loading-page" ? (
                        <>
                          <span className="spinner" /> Load
                        </>
                      ) : (
                        "Load"
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={!btreePage || loadState === "loading-page" || selectedIndexOid == null}
                      onClick={() =>
                        selectedIndexOid != null &&
                        loadIndexBlk(selectedIndexOid, blkno, { refresh: true })
                      }
                    >
                      Refresh
                    </button>
                  </>
                )}
              </div>

              {heapPage && selectedTable && (
                <div className="meta-stats" aria-label="Page statistics">
                  <span className="meta-item">
                    <span className="label">table</span>
                    <span className="value" title={selectedTable.qualifiedName}>
                      {selectedTable.qualifiedName} (oid {selectedTable.oid})
                    </span>
                  </span>
                  <span className="meta-item">
                    <span className="label">#blocks</span>
                    <span className="value">{selectedTable.blocks}</span>
                  </span>
                  <span className="meta-item">
                    <span className="label">blkno</span>
                    <span className="value">{blkno}</span>
                  </span>
                  <span className="meta-item">
                    <span className="label">page</span>
                    <span className="value">{heapPage.stats.pageSize}</span>
                  </span>
                  <span className="meta-item">
                    <span className="label">lower/upper/free</span>
                    <span className="value">
                      {heapPage.stats.pd_lower}/{heapPage.stats.pd_upper}/{heapPage.stats.freeBytes}
                    </span>
                  </span>
                  <span className="meta-item">
                    <span className="label">ItemId</span>
                    <span
                      className="value"
                      title={`UNUSED=${heapPage.stats.lpUnused} NORMAL=${heapPage.stats.lpNormal} REDIRECT=${heapPage.stats.lpRedirect} DEAD=${heapPage.stats.lpDead}`}
                    >
                      {heapPage.stats.itemIdTotal} (U{heapPage.stats.lpUnused}/N{heapPage.stats.lpNormal}/R
                      {heapPage.stats.lpRedirect}/D{heapPage.stats.lpDead})
                    </span>
                  </span>
                  <span className="meta-item">
                    <span className="label">#tup</span>
                    <span className="value">{heapPage.stats.tupleCount}</span>
                  </span>
                </div>
              )}

              {btreePage && pageView?.kind === "btree" && indexBadge && (
                <div className="meta-stats" aria-label="Index page statistics">
                  <span className="meta-item">
                    <span className="label">index</span>
                    <span
                      className="value"
                      title={`${pageView.index.qualifiedName} (oid ${pageView.index.oid})`}
                    >
                      {pageView.index.qualifiedName} (oid {pageView.index.oid})
                    </span>
                  </span>
                  <span className="meta-item">
                    <span className="label">am</span>
                    <span className="value">{pageView.index.accessMethod}</span>
                  </span>
                  <span className="meta-item">
                    <span className="label">#blocks</span>
                    <span className="value">{pageView.index.blocks}</span>
                  </span>
                  <span className="meta-item">
                    <span className="label">blkno</span>
                    <span className="value">{blkno}</span>
                  </span>
                  <span className="meta-item">
                    <span className="label">page</span>
                    <span className="value page-badge-value">
                      <span className="page-type-badge">{indexBadge.text}</span>
                      {indexBadge.chips.map((c) => (
                        <span key={c} className="status-chip">
                          {c}
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className="meta-item">
                    <span className="label">level</span>
                    <span className="value">{levelText(btreePage)}</span>
                  </span>
                  <span className="meta-item">
                    <span className="label">lower/upper/free</span>
                    <span className="value">
                      {btreePage.stats.pd_lower}/{btreePage.stats.pd_upper}/{btreePage.stats.freeBytes}
                    </span>
                  </span>
                  <span className="meta-item">
                    <span className="label">ItemId</span>
                    <span
                      className="value"
                      title={`UNUSED=${btreePage.stats.lpUnused} NORMAL=${btreePage.stats.lpNormal} REDIRECT=${btreePage.stats.lpRedirect} DEAD=${btreePage.stats.lpDead}`}
                    >
                      {btreePage.stats.itemIdTotal} (U{btreePage.stats.lpUnused}/N
                      {btreePage.stats.lpNormal}/R{btreePage.stats.lpRedirect}/D
                      {btreePage.stats.lpDead})
                    </span>
                  </span>
                  <span className="meta-item">
                    <span className="label">#tup</span>
                    <span className="value">
                      {btreePage.stats.tupleCount} (posting {btreePage.stats.postingTupleCount})
                    </span>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {((mode === "page" && heapPage) || (mode === "wal" && connected)) && (
          <div className="chrome-actions">
            <button
              className="chrome-detail"
              type="button"
              aria-expanded={!detailCollapsed}
              aria-controls={mode === "wal" ? "wal-detail-panel" : "selection-detail-panel"}
              onClick={() => setDetailCollapsed((v) => !v)}
            >
              {detailCollapsed ? "Show detail" : "Collapse detail"}
            </button>
            {mode === "page" && (
              <button
                className="chrome-collapse"
                type="button"
                aria-expanded={!hexCollapsed}
                aria-controls="hex-panel"
                onClick={() => setHexCollapsed((v) => !v)}
              >
                {hexCollapsed ? "Show hex" : "Collapse hex"}
              </button>
            )}
          </div>
        )}
        <button
          className="chrome-theme"
          type="button"
          aria-label="Toggle color theme"
          onClick={toggleTheme}
        >
          Theme: {theme}
        </button>
      </header>

      <main className={`main${mode === "page" && pageView ? " main-paged" : ""}${mode === "wal" ? " main-wal" : ""}`}>
        {error && (
          <div className="panel error-panel" role="alert">
            <div>
              <strong>{error.code}</strong>: {error.message}
            </div>
            <div className="next">Next: {error.nextStep}</div>
          </div>
        )}

        {!connected && (
          <div className="center-form panel">
            <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Connect</h2>
            <form className="form-grid" onSubmit={onConnect}>
              <label>
                Host
                <input
                  value={form.host}
                  onChange={(e) => setForm({ ...form, host: e.target.value })}
                  disabled={loadState === "connecting"}
                  required
                />
              </label>
              <label>
                Port
                <input
                  value={form.port}
                  onChange={(e) => setForm({ ...form, port: e.target.value })}
                  disabled={loadState === "connecting"}
                  required
                />
              </label>
              <label>
                Database
                <input
                  value={form.database}
                  onChange={(e) => setForm({ ...form, database: e.target.value })}
                  disabled={loadState === "connecting"}
                  required
                />
              </label>
              <label>
                User
                <input
                  value={form.user}
                  onChange={(e) => setForm({ ...form, user: e.target.value })}
                  disabled={loadState === "connecting"}
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  autoComplete="off"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  disabled={loadState === "connecting"}
                />
              </label>
              <button className="primary" type="submit" disabled={loadState === "connecting"}>
                {loadState === "connecting" ? (
                  <>
                    <span className="spinner" /> Connecting…
                  </>
                ) : (
                  "Connect"
                )}
              </button>
            </form>
            <p className="muted">
              Or set env credentials so the server auto-connects on start. Password is never stored
              in the browser. Enable <code>pageinspect</code> / <code>pg_walinspect</code> yourself —
              this app never runs <code>CREATE EXTENSION</code>.
            </p>
          </div>
        )}

        {connected && mode === "wal" && (
          <WalView
            phase={walPhase}
            records={walRecords}
            newLsns={walNewLsns}
            detailOpen={!detailCollapsed}
          />
        )}

        {connected && mode === "page" && relationKind === "table" && !heapPage && selectedTable?.blocks === 0 && (
          <div className="panel muted">
            Empty relation (0 blocks). Insert rows or pick another table.
          </div>
        )}

        {connected && mode === "page" && relationKind === "table" && !heapPage && !error && selectedTable && selectedTable.blocks > 0 && (
          <div className="panel muted">Select blkno and press Load to fetch a raw page.</div>
        )}

        {connected && mode === "page" && relationKind === "table" && !selectedTable && !error && (
          <div className="panel muted">Select a heap table to begin.</div>
        )}

        {connected && mode === "page" && relationKind === "index" && loadState === "loading-indexes" && (
          <div className="panel muted">
            <span className="spinner" /> Loading indexes…
          </div>
        )}

        {connected && mode === "page" && relationKind === "index" &&
          loadState !== "loading-indexes" && indexesFetched && indexes.length === 0 && !error && (
            <div className="panel muted">无用户索引（系统 schema 除外）。</div>
          )}

        {connected && mode === "page" && relationKind === "index" &&
          loadState !== "loading-indexes" && !selectedIndex && !btreePage && !error &&
          indexes.length > 0 && (
            <div className="panel muted">选择一个索引开始（blkno 0 为 metapage）。</div>
          )}

        {connected && mode === "page" && relationKind === "index" &&
          loadState !== "loading-indexes" && selectedIndex && !btreePage && !error && (
            <div className="panel muted">
              输入 blkno 后 Load（0 = metapage）。
            </div>
          )}

        {connected && mode === "page" && relationKind === "index" && indexHint && (
          <div className="panel index-hint" role="status">
            {indexHint}
          </div>
        )}

        {connected && mode === "page" && heapPage && (
          <div className="main-split" data-hex={hexCollapsed ? "collapsed" : "expanded"}>
            <section className="pane pane-structure" aria-label="Page structure">
              {loadState === "loading-page" && (
                <div className="muted">
                  <span className="spinner" /> Loading page…
                </div>
              )}
              <StructureMap
                page={heapPage}
                currentBlkno={blkno}
                selectedId={selectedId}
                highlight={highlight}
                diffIds={diffIds}
                detailOpen={!detailCollapsed}
                onSelect={onSelectStructure}
                onLoadCrossBlock={(target) => {
                  if (selectedOid != null) {
                    setBlkno(target);
                    void loadBlk(selectedOid, target);
                  }
                }}
              />
            </section>

            {!hexCollapsed && (
              <section id="hex-panel" className="pane pane-hex" aria-label="Hex dump panel">
                <HexDump
                  raw={heapPage.raw}
                  freeRange={heapPage.freeSpace.range}
                  freeDiff={diffIds.has("free")}
                  highlight={highlight}
                  locate={hexLocate}
                  locateHandledNonceRef={hexLocateHandledNonceRef}
                  onSelectOffset={onHexSelect}
                />
              </section>
            )}
          </div>
        )}

        {connected && mode === "page" && btreePage && (
          <div className="panel muted">
            Index page loaded ({pageView?.kind === "btree" ? pageView.index.qualifiedName : ""} blk{" "}
            {blkno}, {indexBadge?.text ?? btreePage.pageType}); tri-pane structure/hex rendering
            arrives with the next task.
          </div>
        )}
      </main>
    </div>
  );
}

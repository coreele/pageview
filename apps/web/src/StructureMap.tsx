import {
  decodeInfomask,
  decodeInfomask2,
  decodeItemIdFlags,
  type ParsedPage,
  type ByteRange,
} from "page-core";

type Props = {
  page: ParsedPage;
  currentBlkno: number;
  selectedId: string | null;
  highlight: ByteRange | null;
  diffIds: Set<string>;
  onSelect: (id: string, range: ByteRange) => void;
  onLoadCrossBlock: (blkno: number) => void;
};

export function StructureMap({
  page,
  currentBlkno,
  selectedId,
  highlight,
  diffIds,
  onSelect,
  onLoadCrossBlock,
}: Props) {
  const selectedTuple = page.tuples.find((t) => selectedId === `tuple-${t.itemIndex}`);
  const selectedItem = page.itemIds.find((i) => selectedId === `itemid-${i.index}`);

  return (
    <div className="structure">
      <div className="growth">ItemId → grows right/down · tuples ← grow from page end · free in between</div>

      <div
        className={`region header${selectedId === "header" ? " selected" : ""}${diffIds.has("header") ? " diff" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => onSelect("header", page.header.range)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onSelect("header", page.header.range);
        }}
      >
        <strong>Page header</strong>{" "}
        <span className="mono muted">
          [{page.header.range.start}..{page.header.range.end}) lower={page.header.pd_lower} upper=
          {page.header.pd_upper} special={page.header.pd_special} lsn={page.header.pd_lsn}
        </span>
      </div>

      {page.itemIds.map((item) => (
        <div
          key={item.index}
          className={`region itemid${selectedId === `itemid-${item.index}` ? " selected" : ""}${diffIds.has(`itemid-${item.index}`) ? " diff" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(`itemid-${item.index}`, item.range)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onSelect(`itemid-${item.index}`, item.range);
          }}
        >
          <strong>ItemId[{item.index}]</strong> {item.status} off={item.offset} len={item.length}
          {item.status === "REDIRECT" ? ` → lp ${item.redirectOffset}` : ""}
          <span className="mono muted">
            {" "}
            bytes [{item.range.start}..{item.range.end})
          </span>
        </div>
      ))}

      <div
        className={`region free${selectedId === "free" ? " selected" : ""}${diffIds.has("free") ? " diff" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => onSelect("free", page.freeSpace.range)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onSelect("free", page.freeSpace.range);
        }}
      >
        <div className="free-break">free space (visually compressed)</div>
        <strong>Free space</strong>{" "}
        <span className="mono">
          [{page.freeSpace.range.start}..{page.freeSpace.range.end}) · {page.freeSpace.bytes} bytes
          real span
        </span>
      </div>

      {[...page.tuples].reverse().map((t) => {
        const cross = t.header.t_ctid.blockNumber !== currentBlkno;
        return (
          <div
            key={t.itemIndex}
            className={`region tuple${selectedId === `tuple-${t.itemIndex}` ? " selected" : ""}${diffIds.has(`tuple-${t.itemIndex}`) ? " diff" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(`tuple-${t.itemIndex}`, t.range)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onSelect(`tuple-${t.itemIndex}`, t.range);
            }}
          >
            <strong>Tuple lp[{t.itemIndex}]</strong>{" "}
            <span className="mono muted">
              [{t.range.start}..{t.range.end}) xmin={t.header.t_xmin} xmax={t.header.t_xmax} hoff=
              {t.header.t_hoff}
            </span>
            {(t.hotUpdated || t.heapOnlyTuple) && (
              <div className="muted">
                HOT flags: {t.hotUpdated ? "HOT_UPDATED " : ""}
                {t.heapOnlyTuple ? "HEAP_ONLY_TUPLE" : ""}
              </div>
            )}
            <div>
              ctid=({t.header.t_ctid.blockNumber},{t.header.t_ctid.offsetNumber})
              {cross ? (
                <>
                  {" "}
                  <button
                    type="button"
                    className="primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onLoadCrossBlock(t.header.t_ctid.blockNumber);
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    Load block {t.header.t_ctid.blockNumber}
                  </button>
                  <span className="muted"> (cross-block; no prefetch)</span>
                </>
              ) : (
                <span className="muted"> (same page)</span>
              )}
            </div>
          </div>
        );
      })}

      {(selectedItem || selectedTuple) && (
        <div className="panel">
          <strong>Selection detail</strong>
          {selectedItem && (
            <div className="flag-list" aria-label="ItemId flags">
              {decodeItemIdFlags(selectedItem.flags).map((b) => (
                <div key={b.name} className={b.set ? "set" : "unset"} tabIndex={0}>
                  {b.set ? "●" : "○"} {b.name} — {b.meaning}
                </div>
              ))}
            </div>
          )}
          {selectedTuple && (
            <>
              <div className="flag-list" aria-label="t_infomask bits">
                <div className="muted">t_infomask=0x{selectedTuple.header.t_infomask.toString(16)}</div>
                {decodeInfomask(selectedTuple.header.t_infomask).map((b) => (
                  <div key={b.name} className={b.set ? "set" : "unset"} tabIndex={0}>
                    {b.set ? "●" : "○"} {b.name} — {b.meaning}
                  </div>
                ))}
              </div>
              <div className="flag-list" aria-label="t_infomask2 bits">
                <div className="muted">t_infomask2=0x{selectedTuple.header.t_infomask2.toString(16)}</div>
                {decodeInfomask2(selectedTuple.header.t_infomask2).map((b) => (
                  <div key={b.name} className={b.set ? "set" : "unset"} tabIndex={0}>
                    {b.set ? "●" : "○"} {b.name} — {b.meaning}
                  </div>
                ))}
              </div>
              {selectedTuple.columns && (
                <div style={{ marginTop: "0.5rem" }}>
                  <strong>Columns</strong>
                  <ul>
                    {selectedTuple.columns.map((c) => (
                      <li key={c.attnum} className="mono">
                        {c.dropped ? (
                          <span className="muted">
                            #{c.attnum} {c.name}: (dropped)
                          </span>
                        ) : (
                          <>
                            #{c.attnum} {c.name} ({c.typeName}): {c.null ? "NULL" : c.display}
                            {c.toasted ? " [TOASTed]" : ""}
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
          {highlight && (
            <div className="muted mono">
              highlight bytes [{highlight.start}..{highlight.end})
            </div>
          )}
        </div>
      )}

      {page.tuples.length === 0 && (
        <div className="panel muted">No NORMAL tuples on this page. Free space dominates; structure is still browsable.</div>
      )}
    </div>
  );
}

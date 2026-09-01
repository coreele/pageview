import type { ByteRange, BtreeIndexTuple, ParsedBtreePage } from "page-core";
import { formatBytesPreview, tidRole, tInfoRows } from "./indexDetail";

type Props = {
  page: ParsedBtreePage;
  tuple: BtreeIndexTuple;
  /** Clicking the key-byte block selects + highlights the hex range (P0-9). */
  onSelectRange: (id: string, range: ByteRange) => void;
  /** T8 wiring: internal child-page load (t_tid downlink). */
  onLoadChildBlock?: (blkno: number) => void;
  /** T8 wiring: leaf heap-TID jump to the owning table. */
  onJumpHeapBlock?: (blkno: number) => void;
};

function tidText(t: { blockNumber: number; offsetNumber: number }): string {
  return `(${t.blockNumber},${t.offsetNumber})`;
}

/**
 * Detail body for one selected index tuple (ui-design "index tuple detail"):
 * t_tid semantics by page type, itemlen, t_info bit rows (D2/D3), hikey/posting
 * badges, truncated key-byte hex, scrollable posting TID list.
 */
export function IndexTupleDetail({
  page,
  tuple,
  onSelectRange,
  onLoadChildBlock,
  onJumpHeapBlock,
}: Props) {
  const role = tidRole(page, tuple);
  const keyPreview = formatBytesPreview(page.raw, tuple.keyRange);
  const keyId = `tuple-${tuple.lpIndex}.key`;
  const roleText =
    role.role === "child"
      ? "internal: child page pointer"
      : role.role === "heap"
        ? "leaf: heap TID"
        : role.note;

  return (
    <div className="index-tuple-detail">
      <div className="index-tuple-detail__line mono">
        lp[{tuple.lpIndex}] index tuple · itemoffset {tuple.itemoffset}
        {tuple.isHikey && <span className="detail-badge">hikey</span>}
        {tuple.isPivot && !tuple.isHikey && <span className="detail-badge">pivot</span>}
        {tuple.isPosting && (
          <span className="detail-badge">posting ×{tuple.postingCount ?? "?"} tids</span>
        )}
      </div>

      <div className="index-tuple-detail__line mono selection-ctid">
        t_tid {tidText(tuple.t_tid)} — {roleText}
        {role.role === "child" &&
          (onLoadChildBlock ? (
            <>
              {" "}
              <button
                type="button"
                className="primary"
                onClick={() => onLoadChildBlock(tuple.t_tid.blockNumber)}
              >
                Load child blk {tuple.t_tid.blockNumber}
              </button>
            </>
          ) : null)}
        {role.role === "heap" &&
          (onJumpHeapBlock ? (
            <>
              {" "}
              <button
                type="button"
                className="primary"
                onClick={() => onJumpHeapBlock(tuple.t_tid.blockNumber)}
              >
                Open blk {tuple.t_tid.blockNumber} in owning table
              </button>
            </>
          ) : null)}
      </div>

      <div className="index-tuple-detail__line mono">
        itemlen {tuple.itemlen} · t_info 0x{tuple.t_info.toString(16).padStart(4, "0")}
      </div>

      <div className="flag-list" aria-label="t_info bits">
        {tInfoRows(tuple).map((r) => (
          <div key={r.name} className={r.set ? "set" : "unset"} tabIndex={0}>
            {r.set ? "●" : "○"} {r.name} — {r.meaning}
          </div>
        ))}
      </div>

      {keyPreview.total > 0 && (
        <div className="index-tuple-detail__key">
          <button
            type="button"
            className="key-bytes mono"
            onClick={() => onSelectRange(keyId, tuple.keyRange)}
            title={`Key bytes [${tuple.keyRange.start}..${tuple.keyRange.end}) — click to highlight in hex`}
          >
            <span className="key-bytes__label">
              Key bytes [{tuple.keyRange.start}..{tuple.keyRange.end})
            </span>
            <span className="key-bytes__hex">{keyPreview.hex || "(empty)"}</span>
            <span className="key-bytes__count">
              {keyPreview.truncated
                ? `… ${keyPreview.total} bytes total (showing first 64)`
                : `${keyPreview.total} bytes total`}
            </span>
          </button>
        </div>
      )}

      {tuple.isPosting && (
        <div className="index-tuple-detail__posting">
          <div className="index-tuple-detail__line">
            posting TIDs ({tuple.postingCount ?? "?"}, count complete)
          </div>
          {tuple.postingTids ? (
            <ul className="posting-tid-list mono" aria-label="posting TID list">
              {tuple.postingTids.map((tid, i) =>
                onJumpHeapBlock ? (
                  <li key={`${tid.blockNumber}-${tid.offsetNumber}-${i}`}>
                    <button
                      type="button"
                      className="posting-tid"
                      title="Open this block in the owning table"
                      onClick={() => onJumpHeapBlock(tid.blockNumber)}
                    >
                      {tidText(tid)}
                    </button>
                  </li>
                ) : (
                  <li key={`${tid.blockNumber}-${tid.offsetNumber}-${i}`}>{tidText(tid)}</li>
                ),
              )}
            </ul>
          ) : (
            <div className="parse-warning-inline">⚠ posting TID list parse failed (out of range); count preserved</div>
          )}
        </div>
      )}
    </div>
  );
}

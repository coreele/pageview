import {
  decodeInfomask,
  decodeInfomask2,
  decodeItemIdFlags,
  deriveStructureFields,
  selectionTargetForField,
  splitFieldIntoRowSegments,
  STRUCTURE_BYTES_PER_ROW,
  type ByteRange,
  type ParsedPage,
  type StructureField,
} from "page-core";

type Props = {
  page: ParsedPage;
  currentBlkno: number;
  selectedId: string | null;
  highlight: ByteRange | null;
  diffIds: Set<string>;
  freeCollapsed: boolean;
  onToggleFreeCollapsed: () => void;
  onSelect: (id: string, range: ByteRange) => void;
  onLoadCrossBlock: (blkno: number) => void;
};

type LayoutSegment = {
  field: StructureField;
  row: number;
  colStart: number;
  colEnd: number;
};

function buildLayoutSegments(fields: StructureField[]): LayoutSegment[] {
  const segments: LayoutSegment[] = [];
  for (const f of fields) {
    if (f.visualOnly || f.region === "free") continue;
    for (const seg of splitFieldIntoRowSegments(f, STRUCTURE_BYTES_PER_ROW)) {
      segments.push({
        field: f,
        row: seg.row,
        colStart: seg.colStart,
        colEnd: seg.colEnd,
      });
    }
  }
  return segments;
}

function groupByRow(segments: LayoutSegment[]): Map<number, LayoutSegment[]> {
  const map = new Map<number, LayoutSegment[]>();
  for (const s of segments) {
    const list = map.get(s.row) ?? [];
    list.push(s);
    map.set(s.row, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.colStart - b.colStart);
  }
  return map;
}

function isFieldSelected(selectedId: string | null, field: StructureField): boolean {
  if (!selectedId) return false;
  if (selectedId === field.id) return true;
  if (selectedId.startsWith(`${field.id}.`)) return true;
  return false;
}

function isFieldDiff(diffIds: Set<string>, field: StructureField): boolean {
  if (diffIds.has(field.id)) return true;
  if (field.region === "header" && diffIds.has("header")) return true;
  if (field.region === "free" && diffIds.has("free")) return true;
  const itemMatch = /^itemid-(\d+)/.exec(field.id);
  if (itemMatch && diffIds.has(`itemid-${itemMatch[1]}`)) return true;
  const tupleMatch = /^tuple-(\d+)/.exec(field.id);
  if (tupleMatch && diffIds.has(`tuple-${tupleMatch[1]}`)) return true;
  return false;
}

/** Prefer readable short names over naive truncation (avoids "pd_", "che"). */
function abbreviateLabel(label: string, spanBytes: number): string {
  const known: Record<string, string[]> = {
    checksum: ["cks", "ck"],
    flags: ["flg", "fl"],
    pd_lower: ["lower", "lo"],
    pd_upper: ["upper", "up"],
    special: ["spec", "sp"],
    "pagesize/ver": ["psz/v", "pv"],
    prune_xid: ["prune", "px"],
    xlogid: ["xlog", "xl"],
    xrecoff: ["xoff", "xo"],
    lower: ["lower", "lo"],
    upper: ["upper", "up"],
    "psz/ver": ["psz/v", "pv"],
    infomask2: ["imask2", "im2"],
    infomask: ["imask", "im"],
    nullbits: ["nullb", "nb"],
    hoff: ["hoff", "ho"],
    cid: ["cid", "ci"],
    ctid: ["ctid", "ct"],
    xmin: ["xmin", "xn"],
    xmax: ["xmax", "xm"],
  };
  const item = /^ItemId\[(\d+)\]$/.exec(label);
  if (item) return spanBytes >= 3 ? `#${item[1]}` : item[1]!;
  const options = known[label];
  if (options) {
    for (const opt of options) {
      if (opt.length <= spanBytes * 2 + 1) return opt;
    }
    return options[options.length - 1]!;
  }
  if (spanBytes <= 1) return label.slice(0, 2);
  if (spanBytes <= 2) return label.length <= 4 ? label : label.slice(0, 3);
  if (label.length <= spanBytes * 2) return label;
  return label.slice(0, Math.max(3, spanBytes * 2 - 1));
}

function FreeSpaceBand({
  page,
  selectedId,
  diffIds,
  freeCollapsed,
  onToggleFreeCollapsed,
  onSelect,
}: {
  page: ParsedPage;
  selectedId: string | null;
  diffIds: Set<string>;
  freeCollapsed: boolean;
  onToggleFreeCollapsed: () => void;
  onSelect: (id: string, range: ByteRange) => void;
}) {
  const { range, bytes } = page.freeSpace;
  if (range.end <= range.start) return null;
  const selected = selectedId === "free";
  const diff = diffIds.has("free");
  return (
    <div
      id="free-space-band"
      className={`free-band${freeCollapsed ? " collapsed" : ""}${selected ? " selected" : ""}${diff ? " diff" : ""}`}
    >
      <div
        className="free-band-body"
        role="button"
        tabIndex={0}
        aria-label={`free space [${range.start}..${range.end}) ${bytes} bytes`}
        onClick={() => onSelect("free", range)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect("free", range);
          }
        }}
      >
        <div className="free-break">
          <span className="free-break-label mono">
            free space [{range.start}..{range.end}) · {bytes} bytes
            {freeCollapsed ? "" : " (compressed)"}
          </span>
        </div>
      </div>
      <button
        type="button"
        className="free-toggle"
        aria-expanded={!freeCollapsed}
        aria-controls="free-space-band"
        onClick={onToggleFreeCollapsed}
      >
        {freeCollapsed ? "Expand free space" : "Collapse free space"}
      </button>
    </div>
  );
}

function FieldCell({
  field,
  colStart,
  colEnd,
  selected,
  diff,
  onSelect,
  fields,
}: {
  field: StructureField;
  colStart: number;
  colEnd: number;
  selected: boolean;
  diff: boolean;
  onSelect: (id: string, range: ByteRange) => void;
  fields: StructureField[];
}) {
  const span = colEnd - colStart;
  const isItemId = field.region === "itemid" && !field.parentId;
  const thirds = isItemId
    ? fields.filter((f) => f.parentId === field.id && f.visualOnly)
    : [];

  const activate = () => {
    const target = selectionTargetForField(fields, field.id) ?? field;
    onSelect(target.id, target.range);
  };

  const shortLabel = abbreviateLabel(field.label, span);
  const lpStatus =
    isItemId && field.fullLabel.includes("UNUSED")
      ? "UNUSED"
      : isItemId && field.fullLabel.includes("NORMAL")
        ? "NORMAL"
        : isItemId && field.fullLabel.includes("REDIRECT")
          ? "REDIRECT"
          : isItemId && field.fullLabel.includes("DEAD")
            ? "DEAD"
            : undefined;

  return (
    <div
      className={`field-cell region-${field.region}${selected ? " selected" : ""}${diff ? " diff" : ""}${lpStatus ? ` lp-${lpStatus.toLowerCase()}` : ""}`}
      style={{ gridColumn: `${colStart + 1} / ${colEnd + 1}` }}
      role="button"
      tabIndex={0}
      title={field.fullLabel}
      aria-label={field.fullLabel}
      data-lp-status={lpStatus}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      }}
    >
      {isItemId && thirds.length >= 3 ? (
        <div className="itemid-thirds">
          {(["off", "flag", "len"] as const).map((name) => {
            const t = thirds.find((x) => x.label === name);
            if (!t) return null;
            return (
              <span key={t.id} className="itemid-third" title={t.fullLabel}>
                {t.label}
              </span>
            );
          })}
        </div>
      ) : (
        <span className="field-label">{shortLabel}</span>
      )}
    </div>
  );
}

function DiagramRows({
  fields,
  selectedId,
  diffIds,
  onSelect,
}: {
  fields: StructureField[];
  selectedId: string | null;
  diffIds: Set<string>;
  onSelect: (id: string, range: ByteRange) => void;
}) {
  const segments = buildLayoutSegments(fields);
  const grouped = groupByRow(segments);
  const sortedRows = [...grouped.keys()].sort((a, b) => a - b);
  if (sortedRows.length === 0) return null;

  return (
    <>
      {sortedRows.map((row) => (
        <div
          key={row}
          className="structure-row"
          role="row"
          aria-label={`offset row 0x${(row * STRUCTURE_BYTES_PER_ROW).toString(16)}`}
        >
          <span className="structure-row-offset mono muted">
            {(row * STRUCTURE_BYTES_PER_ROW).toString(16).padStart(4, "0")}
          </span>
          <div className="structure-row-grid">
            {(grouped.get(row) ?? []).map((seg) => (
              <FieldCell
                key={`${seg.field.id}-${seg.colStart}`}
                field={seg.field}
                colStart={seg.colStart}
                colEnd={seg.colEnd}
                selected={isFieldSelected(selectedId, seg.field)}
                diff={isFieldDiff(diffIds, seg.field)}
                onSelect={onSelect}
                fields={fields}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export function StructureMap({
  page,
  currentBlkno,
  selectedId,
  highlight,
  diffIds,
  freeCollapsed,
  onToggleFreeCollapsed,
  onSelect,
  onLoadCrossBlock,
}: Props) {
  const fields = deriveStructureFields(page);
  const upperFields = fields.filter(
    (f) => !f.visualOnly && (f.region === "header" || f.region === "itemid"),
  );
  const tupleFields = fields.filter((f) => !f.visualOnly && f.region === "tuple");

  const selectedItem = page.itemIds.find(
    (i) => selectedId === `itemid-${i.index}` || selectedId?.startsWith(`itemid-${i.index}.`),
  );
  const selectedTuple = page.tuples.find(
    (t) => selectedId === `tuple-${t.itemIndex}` || selectedId?.startsWith(`tuple-${t.itemIndex}.`),
  );
  const selectedField = fields.find((f) => f.id === selectedId && !f.visualOnly);

  return (
    <div className="structure structure-diagram">
      <div className="diagram-legend" aria-hidden="true">
        <span className="legend-chip region-header">header</span>
        <span className="legend-chip region-itemid">ItemId</span>
        <span className="legend-chip region-free">free</span>
        <span className="legend-chip region-tuple">tuple</span>
        <span className="legend-meta muted">32 B / row · low offset ↑ · linked with hex</span>
      </div>

      <section className="diagram-section" aria-label="PageHeader and ItemId">
        <div className="structure-section-label">
          <span className="section-dot region-header" />
          PageHeader / ItemId
        </div>
        <DiagramRows
          fields={upperFields}
          selectedId={selectedId}
          diffIds={diffIds}
          onSelect={onSelect}
        />
      </section>

      <section className="diagram-section" aria-label="Free space">
        <div className="structure-section-label">
          <span className="section-dot region-free" />
          Free space
        </div>
        <FreeSpaceBand
          page={page}
          selectedId={selectedId}
          diffIds={diffIds}
          freeCollapsed={freeCollapsed}
          onToggleFreeCollapsed={onToggleFreeCollapsed}
          onSelect={onSelect}
        />
      </section>

      <section className="diagram-section" aria-label="HeapTuple">
        <div className="structure-section-label">
          <span className="section-dot region-tuple" />
          HeapTuple
        </div>
        <DiagramRows
          fields={tupleFields}
          selectedId={selectedId}
          diffIds={diffIds}
          onSelect={onSelect}
        />
      </section>

      {(selectedItem || selectedTuple || selectedField) && (
        <div className="panel selection-detail">
          <strong>Selection detail</strong>
          {selectedField && (
            <div className="mono" style={{ marginBottom: "0.35rem" }}>
              {selectedField.fullLabel}
            </div>
          )}
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
              {(selectedTuple.hotUpdated || selectedTuple.heapOnlyTuple) && (
                <div className="muted">
                  HOT flags: {selectedTuple.hotUpdated ? "HOT_UPDATED " : ""}
                  {selectedTuple.heapOnlyTuple ? "HEAP_ONLY_TUPLE" : ""}
                </div>
              )}
              <div>
                ctid=({selectedTuple.header.t_ctid.blockNumber},{selectedTuple.header.t_ctid.offsetNumber})
                {selectedTuple.header.t_ctid.blockNumber !== currentBlkno ? (
                  <>
                    {" "}
                    <button
                      type="button"
                      className="primary"
                      onClick={() => onLoadCrossBlock(selectedTuple.header.t_ctid.blockNumber)}
                    >
                      Load block {selectedTuple.header.t_ctid.blockNumber}
                    </button>
                    <span className="muted"> (cross-block; no prefetch)</span>
                  </>
                ) : (
                  <span className="muted"> (same page)</span>
                )}
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
        <div className="panel muted">
          No NORMAL tuples on this page. Free space dominates; structure is still browsable.
        </div>
      )}
    </div>
  );
}

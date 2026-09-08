import { useEffect, useRef } from "react";
import type { TreeRow, VisibleTree } from "./btreeTree";

type Props = {
  tree: VisibleTree;
  ariaLabel?: string;
  onToggleExpand: (row: TreeRow) => void;
  onActivate: (row: TreeRow) => void;
  onRetry: (row: TreeRow) => void;
};

function typeLabel(row: TreeRow): string {
  if (row.role === "index") return row.expandable ? "btree" : "";
  if (row.pageType === "unknown") return "…";
  if (row.pageType === "meta") return "meta";
  const level = row.level == null ? "" : ` L${row.level}`;
  const root = row.isRoot ? " root" : "";
  return `${row.pageType}${level}${root}`;
}

function TreeNode({
  row,
  onToggleExpand,
  onActivate,
  onRetry,
}: {
  row: TreeRow;
  onToggleExpand: (row: TreeRow) => void;
  onActivate: (row: TreeRow) => void;
  onRetry: (row: TreeRow) => void;
}) {
  const label = row.role === "index" ? row.title : `blk ${row.blkno}`;
  return (
    <div
      className="btree-tree-row"
      style={{ paddingLeft: `${0.35 + row.depth * 0.85}rem` }}
      data-current={row.current ? "true" : undefined}
      data-row={row.key}
    >
      {row.expandable ? (
        <button
          type="button"
          className="btree-tree-expander"
          aria-label={row.expanded ? `Collapse ${label}` : `Expand ${label}`}
          aria-expanded={row.expanded}
          onClick={() => onToggleExpand(row)}
        >
          {row.expanded ? "▾" : "▸"}
        </button>
      ) : (
        <span className="btree-tree-expander btree-tree-expander--leaf" aria-hidden="true">
          {row.status === "loading" ? "…" : "•"}
        </span>
      )}
      <button
        type="button"
        className="btree-tree-label"
        aria-current={row.current ? "true" : undefined}
        title={row.role === "index" ? row.title : undefined}
        onClick={() => onActivate(row)}
      >
        {label}
        <span className="btree-tree-kind">{typeLabel(row)}</span>
        {row.chips.map((chip) => (
          <span key={chip} className="btree-tree-chip">
            {chip}
          </span>
        ))}
      </button>
      {row.status === "error" && row.error && (
        <span className="btree-tree-error">
          <span title={`${row.error.code}: ${row.error.message}`}>failed</span>
          <button type="button" className="btree-tree-retry" onClick={() => onRetry(row)}>
            Retry
          </button>
        </span>
      )}
    </div>
  );
}

export function BtreeTreePanel({
  tree,
  ariaLabel = "B-tree pages",
  onToggleExpand,
  onActivate,
  onRetry,
}: Props) {
  const rootRef = useRef<HTMLElement>(null);
  useEffect(() => {
    rootRef.current
      ?.querySelector<HTMLElement>('.btree-tree-row[data-current="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [tree]);

  return (
    <section
      id="btree-tree-panel"
      ref={rootRef}
      className="pane pane-tree"
      aria-label={ariaLabel}
    >
      {tree.emptyHint && (
        <div className="muted">{tree.emptyHint}</div>
      )}
      {tree.rows.length === 0 && !tree.orphan && !tree.emptyHint && (
        <div className="muted">Loading tree…</div>
      )}
      {tree.rows.map((row) => (
        <TreeNode
          key={row.key}
          row={row}
          onToggleExpand={onToggleExpand}
          onActivate={onActivate}
          onRetry={onRetry}
        />
      ))}
      {tree.orphan && (
        <div className="btree-tree-orphan" role="status">
          <div className="muted">
            Current block is not reachable from root in the cached tree.
          </div>
          <TreeNode
            row={tree.orphan}
            onToggleExpand={onToggleExpand}
            onActivate={onActivate}
            onRetry={onRetry}
          />
        </div>
      )}
    </section>
  );
}

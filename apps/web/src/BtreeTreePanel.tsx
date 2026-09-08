import { useEffect, useRef } from "react";
import { treeKindTokens, type TreeRow, type VisibleTree } from "./btreeTree";

export type CatalogSectionId = "table" | "index";

type Props = {
  tableTree: VisibleTree;
  indexTree: VisibleTree;
  tableSectionCollapsed: boolean;
  indexSectionCollapsed: boolean;
  onToggleSection: (id: CatalogSectionId) => void;
  onToggleExpand: (row: TreeRow) => void;
  onActivate: (row: TreeRow) => void;
  onRetry: (row: TreeRow) => void;
};

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
  const named = row.role === "index" || row.role === "table";
  const label = named ? row.title : `blk ${row.blkno}`;
  return (
    <div
      className="btree-tree-row"
      style={{ ["--tree-depth" as string]: String(row.depth) }}
      data-current={row.current ? "true" : undefined}
      data-role={row.role}
      data-depth={row.depth}
      data-row={row.key}
    >
      {row.expandable ? (
        <button
          type="button"
          className="btree-tree-expander"
          aria-label={row.expanded ? `Collapse ${label}` : `Expand ${label}`}
          aria-expanded={row.expanded}
          onClick={() => onToggleExpand(row)}
        />
      ) : (
        <span
          className={`btree-tree-expander btree-tree-expander--leaf${row.status === "loading" ? " btree-tree-expander--loading" : ""}`}
          aria-hidden="true"
        >
          {row.status === "loading" ? "…" : null}
        </span>
      )}
      <button
        type="button"
        className="btree-tree-label"
        aria-current={row.current ? "true" : undefined}
        title={named ? (row.hoverTitle ?? row.title) : undefined}
        onClick={() => onActivate(row)}
      >
        <span className="btree-tree-blk">{label}</span>
        {treeKindTokens(row).map((token) => (
          <span key={token} className="btree-tree-kind">
            {token}
          </span>
        ))}
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

function TreeSection({
  id,
  title,
  collapsed,
  tree,
  onToggleSection,
  onToggleExpand,
  onActivate,
  onRetry,
}: {
  id: CatalogSectionId;
  title: string;
  collapsed: boolean;
  tree: VisibleTree;
  onToggleSection: (id: CatalogSectionId) => void;
  onToggleExpand: (row: TreeRow) => void;
  onActivate: (row: TreeRow) => void;
  onRetry: (row: TreeRow) => void;
}) {
  return (
    <div className="tree-section" data-section={id} data-collapsed={collapsed ? "true" : undefined}>
      <button
        type="button"
        className="tree-section-head"
        aria-expanded={!collapsed}
        aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
        onClick={() => onToggleSection(id)}
      >
        <span className="btree-tree-expander" aria-hidden="true" aria-expanded={!collapsed} />
        <span className="tree-section-title">{title}</span>
      </button>
      {!collapsed && (
        <div className="tree-section-body">
          {tree.emptyHint && <div className="muted">{tree.emptyHint}</div>}
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
        </div>
      )}
    </div>
  );
}

export function BtreeTreePanel({
  tableTree,
  indexTree,
  tableSectionCollapsed,
  indexSectionCollapsed,
  onToggleSection,
  onToggleExpand,
  onActivate,
  onRetry,
}: Props) {
  const rootRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    const currentPage = root?.querySelector<HTMLElement>(
      '.btree-tree-row[data-role="page"][data-current="true"]',
    );
    (currentPage ?? root?.querySelector<HTMLElement>('.btree-tree-row[data-current="true"]'))
      ?.scrollIntoView({ block: "nearest" });
  }, [tableTree, indexTree]);

  return (
    <section id="btree-tree-panel" ref={rootRef} className="pane pane-tree" aria-label="Catalog">
      <TreeSection
        id="table"
        title="TABLE"
        collapsed={tableSectionCollapsed}
        tree={tableTree}
        onToggleSection={onToggleSection}
        onToggleExpand={onToggleExpand}
        onActivate={onActivate}
        onRetry={onRetry}
      />
      <TreeSection
        id="index"
        title="INDEX"
        collapsed={indexSectionCollapsed}
        tree={indexTree}
        onToggleSection={onToggleSection}
        onToggleExpand={onToggleExpand}
        onActivate={onActivate}
        onRetry={onRetry}
      />
    </section>
  );
}

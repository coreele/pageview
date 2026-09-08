import { useCallback, useRef, useState, type PointerEvent, type ReactNode } from "react";
import {
  DEFAULT_PAGE_SPLIT,
  dragHex,
  dragTree,
  hexDragStart,
  loadStoredSplit,
  pageSplitTemplate,
  storeSplit,
  type PageSplitState,
} from "./paneSplit";

function SplitGutter({
  label,
  onBegin,
  onDrag,
}: {
  label: string;
  onBegin: () => void;
  onDrag: (dx: number) => void;
}) {
  const originX = useRef(0);

  const stopDrag = () => {
    document.documentElement.classList.remove("is-split-dragging");
  };

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    originX.current = e.clientX;
    onBegin();
    document.documentElement.classList.add("is-split-dragging");
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    onDrag(e.clientX - originX.current);
  };

  return (
    <button
      type="button"
      className="split-gutter"
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        onBegin();
        onDrag(e.key === "ArrowRight" ? 16 : -16);
      }}
    />
  );
}

export function PageSplit({
  treeOpen,
  hexOpen,
  tree,
  hex,
  children,
}: {
  treeOpen: boolean;
  hexOpen: boolean;
  tree?: ReactNode;
  hex?: ReactNode;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState<PageSplitState>(
    () => loadStoredSplit() ?? DEFAULT_PAGE_SPLIT,
  );
  const startRef = useRef(split);

  const commit = useCallback((next: PageSplitState) => {
    setSplit(next);
    storeSplit(next);
  }, []);

  const begin = () => {
    startRef.current = split;
  };

  const beginHex = () => {
    const measured = rootRef.current?.querySelector(".pane-hex")?.getBoundingClientRect().width;
    startRef.current = hexDragStart(split, measured ?? 0);
  };

  const widthOf = () => rootRef.current?.clientWidth ?? 0;

  return (
    <div
      ref={rootRef}
      className="main-split"
      data-tree={treeOpen ? "expanded" : "collapsed"}
      data-hex={hexOpen ? "expanded" : "collapsed"}
      style={{ ["--page-split-cols" as string]: pageSplitTemplate(split, treeOpen, hexOpen) }}
    >
      {treeOpen ? tree : null}
      {treeOpen ? (
        <SplitGutter
          label="Resize tree pane"
          onBegin={begin}
          onDrag={(dx) => commit(dragTree(startRef.current, dx, widthOf(), hexOpen))}
        />
      ) : null}
      {children}
      {hexOpen ? (
        <SplitGutter
          label="Resize hex pane"
          onBegin={beginHex}
          onDrag={(dx) => commit(dragHex(startRef.current, dx, widthOf(), treeOpen))}
        />
      ) : null}
      {hexOpen ? hex : null}
    </div>
  );
}

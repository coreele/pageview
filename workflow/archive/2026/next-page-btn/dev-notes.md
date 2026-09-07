# Dev Notes: next-page-btn

> **适用对象**：Reviewer / QA。**前置条件**：Plan 已确认。**操作步骤**：对照 T1–T6 与下方证据。**预期结果**：验证命令绿；手测或 §6。**失败处理**：本文件记录缺口。

## 实现说明

- T1：源分支 `next-page-btn`（自 `main`）。
- T2：`pageToolbarNav.ts` — `heapPageNav` / `btreePageNav`（复用 `siblingNav`）/ `toolbarNavEnabled` / `navButtonTitle`。单测 12 例先红（缺模块）后绿。
- T3：`App.tsx` 两处 Refresh 右侧 `PageToolbarNavButtons`。`loadedBlkno` 与输入 `blkno` 分离（P1-1）。Prev/Next 调用非 refresh `loadBlk` / `loadIndexBlk`。HeapPeek / WAL 无这两钮。
- T4：Page 次带 `meta-controls-row--stack` 纵向堆叠；WAL 行仍横向 wrap。
- T5：`README.md` / `README.zh-CN.md` Page 模式各加 Prev/Next 一句。

## 变更路径

| 路径 | 变更 |
|---|---|
| `apps/web/src/pageToolbarNav.ts` + `*.test.ts` | 新增 |
| `apps/web/src/App.tsx` | 按钮、loadedBlkno、stack class |
| `apps/web/src/styles.css` | `--stack` |
| `README.md` / `README.zh-CN.md` | 翻页一句 |
| `apps/web/src/blockNav.ts` | 未改 |
| `apps/server/**`、`packages/page-core/**`、`HeapPeekOverlay.tsx` | 未改需求行为 |

## 验证

```bash
pnpm --filter web test   # 10 files, 112 tests（含 pageToolbarNav 12）
pnpm test                # page-core 58 + wal-core 13 + web 112 + server 31
pnpm -r typecheck        # 零错误
pnpm -r build            # web vite build 成功
```

2026-09-01：上述四条全绿。

## 手测 / quality.md §6

本会话无浏览器工具。P0-1/7/8 与 Plan 手测 1–7 **未目视**。恢复：`pnpm dev:web` 后按清单操作。风险：宽屏堆叠与 Next 后无 Refresh diff 仅靠 CSS `--stack` 与 `loadBlk` 未传 `refresh` 的代码审查。

禁止面：diff 无 `apps/server/**`、`packages/page-core/**`、`blockNav.ts`、`HeapPeekOverlay.tsx`。

## QA 修复回执

| 缺陷 ID | 处理 | 摘要 | 验证 | 建议复测 |
|---|---|---|---|---|
| | | | | |

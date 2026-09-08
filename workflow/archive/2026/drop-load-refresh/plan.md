# Plan: drop-load-refresh

## 元信息

- 依据 Spec: `workflow/archive/2026/drop-load-refresh/spec.md`
- 依据 Design: N/A
- 依据 UI: `workflow/archive/2026/drop-load-refresh/ui-design.md`
- 路径等级: standard
- Review 门禁: required
- 最低验证层: unit + static
- 验证命令:
  - `pnpm --filter web test`
  - `pnpm --filter web typecheck`
- 预期证据: 退出码 0；P0 对应单测通过；e2e helpers 可关掉 Tree 后点 Load。

## 目标摘要

Page 浏览分为 Tree 亮（目录、精简次带、点 blk 加载/刷新）与 Tree 暗（无目录、现次带）。chrome 只有 Tree 开关，不展示 Single。

## 任务拆解

1. **纯函数**（完成条件：`pageRowClickAction` 覆盖 ignore/load/refresh；`pageBrowseMode` 由 collapsed 映射）
2. **App 接线**（完成条件：chrome 单独 Tree 开关；亮时不渲染次带按钮；暗时保持现次带；无 Single 字样；`onTreeActivate` 当前 blk 走 refresh；空态无 Open Tree）
3. **README + e2e**（完成条件：中英写明 Tree 亮/暗；需要 Load 的 e2e 先关掉 Tree）
4. **回归**（完成条件：web test + typecheck 绿）

## 依赖与顺序

1 → 2 → 3 → 4。

## 触碰路径

- `apps/web/src/btreeTree.ts` 或新建 `pageBrowse.ts`、对应 `*.test.ts`
- `apps/web/src/App.tsx`、`apps/web/src/chromeToggle.test.ts`、`apps/web/src/treeNavUi.test.ts`
- `README.md`、`README.zh-CN.md`
- `e2e/helpers/app.ts`、引用 `pageLoadButton` 的 spec

不改：server、URL 参数、WAL 次带、`HEAP_BLOCK_LIST_CAP`。

## 验收与验证

| ID | 要求或命令 | 预期证据 | 结果（实施后填） |
|---|---|---|---|
| P0-1 | 默认 Tree 亮；无次带按钮；只有 Tree 开关 | App 源码 / 单测扫描 | Pass |
| P0-2 | Single 出全套次带、无目录 | `collapsed` 时 `treeOpen` false 且渲染 Load | Pass |
| P0-3 | 再点当前 heap blk = refresh | `pageRowClickAction` + App 调 `loadBlk(..., { refresh: true })` | Pass |
| P0-4 | 点另一 blk = load | 同上 load 分支 | Pass |
| P0-5 | 再点当前 index 页 = refresh | `loadIndexBlk(..., { refresh: true })` | Pass |
| P0-6 | Tree 选表后关掉 Tree 可 Load 其他 blk | 代码：切模式不清 oid；e2e helper 关 Tree | Pass |
| P0-7 | WAL 无 Tree 开关，有 Load | App WAL 分支 | Pass |
| P1 | expander 不刷新；表名仍收起；文案；README | 单测 + README | Pass |
| V-reg | `pnpm --filter web test` | 退出码 0 | Pass |
| V-static | `pnpm --filter web typecheck` | 退出码 0 | Pass |

## 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 真机点 Tree 亮暗 | 本会话浏览器 MCP 可能无 schema | 次带切换手感 | 本地连库点开关 |
| e2e 全量 | CI 不跑 Playwright | helper 改后未实跑 | 本地 `pnpm test:e2e` |

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | N/A（无新 API） |
| 用户文档 | `README.md`、`README.zh-CN.md` |
| 运维文档 | N/A |

## 交接顺序

1. Developer 实施与自验 →
2. Reviewer（Review 门禁 required 时）→
3. QA 验收 →
4. 用户授权合并 → Manager 第三阶段文档提交（`done`）→ 合入 → 归档

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-09-08 | 初稿 |
| 2026-09-08 | 用户修订：chrome 保持 Tree 开关，不展示 Single |

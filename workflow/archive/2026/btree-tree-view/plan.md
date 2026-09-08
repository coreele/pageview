# Plan: btree-tree-view

## 元信息

- 依据 Spec: `workflow/archive/2026/btree-tree-view/spec.md`
- 依据 Design: `workflow/archive/2026/btree-tree-view/design.md`
- 依据 UI: `workflow/archive/2026/btree-tree-view/ui-design.md`
- 路径等级: full
- Review 门禁: required
- 最低验证层: unit + build + static
- 验证命令:
  - `pnpm --filter page-core test`
  - `pnpm --filter web test`
  - `pnpm -r typecheck`
  - `pnpm -r build`
- 预期证据: 上述命令退出码 0；新增 `btree-tree` / `btreeTree` / 面板相关用例通过；typecheck/build 无错误。

## 目标摘要

B-tree 索引页与 heap 表页增加与 hex/detail 同类的 **Show tree / Collapse tree** 面板：索引按需展示拓扑，表为块号列表；高亮当前块、点节点加载该页；默认折叠；不改 server、URL、WAL。

## 任务拆解

1. **page-core 纯函数**（完成条件：`btreeDownlinks` / 节点摘要 / `pathFromCache` 有单测；不改 `parseBtreePage`）
2. **web 树状态模块**（完成条件：缓存、展开、打开时该 fetch 的 blk 集合、P0-5 计数、换关系 reset；mock fetch）
3. **`BtreeTreePanel`**（完成条件：节点列表、expander 与 Load 分离、高亮、失败 Retry、孤立警告）
4. **App 接线**（完成条件：chrome 按钮在 btree/heap 页；折叠卸载 pane；索引展开 fetch 不调用 `loadIndexBlk`；索引点节点走 `loadIndexBlock`；表点行走 `loadBlk` 且不切 kind；换表/换索引/换 kind/WAL reset 清树）
5. **布局 CSS**（完成条件：`data-tree`；宽屏树列受限宽；窄屏树在上；折叠无占位列）
6. **用户文档**（完成条件：README.md 与 README.zh-CN.md 索引节各一句开关说明）

## 依赖与顺序

1 → 2 → 3 与 4 可交错，4 依赖 2/3 → 5 随 4 → 6 不阻塞代码，须在 Review 前完成。

## 触碰路径

- `packages/page-core/src/btree-tree.ts`（新）
- `packages/page-core/src/index.ts`（导出）
- `packages/page-core/tests/btree-tree.test.ts`（新）
- `apps/web/src/btreeTree.ts`（新）
- `apps/web/src/btreeTree.test.ts`（新）
- `apps/web/src/BtreeTreePanel.tsx`（新）
- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `README.md` / `README.zh-CN.md`

不改：`apps/server/**`、`packages/wal-core/**`、heap `parsePage`、`urlState.ts`。

## 验收与验证

| ID | 要求或命令 | 预期证据 | 结果（实施后填） |
|---|---|---|---|
| P0-1 | 默认折叠：加载 btree 后按钮 Show tree、无 `#btree-tree-panel` | web 测试断言初始 `treeCollapsed` / 无 pane | |
| P0-2 | 展开后有面板且结构区仍在；再折叠卸载 | 组件/状态测试 | |
| P0-3 | WAL 无树按钮 | App 条件：`treeChromeVisible` 仅 btree\|heap | |
| P0-4 | pathFromCache：meta→root→叶（高度 2 fixture） | page-core 测试 | |
| P0-5 | 打开树 fetch 集合 = meta + 路径，不含全部叶 | web 测试 mock 计数 | |
| P0-6 | 激活子节点调用 Load、树仍展开 | btreeTree + 面板回调测试 | |
| P0-7 | reset 清空 cache/expanded/collapsed 回默认 | web 测试 | |
| P0-8 | heap 分栏无 data-tree；hex/detail 开关仍在 | 接线不改 heap 分支；既有 web 测试绿 | |
| P1-1 | 节点摘要含 flags 芯片 | page-core 测试 | |
| P1-2 | 缓存中无路径时孤立 | page-core `pathFromCache` 返回 orphan | |
| P1-3 | 节点 error + retry 回调 | 面板/状态测试 | |
| V-build | `pnpm -r typecheck && pnpm -r build` | 退出码 0 | |
| V-docs | README 中英索引节含 tree 开关 | 文案可见 | |

## 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| P0-5 真库扇出 | 本项最低层不含 integration；CI 已无 e2e | 计数测试用 synthetic 页，与真库往返次数可能不同 | 本地连库手测打开 `uq_k_idx` 树，网络面板无上百叶请求 |
| 键盘上下键 | UI 稿最低只要求 Tab+Enter | 树深时键盘效率差 | 不阻塞；有余力再加箭头 |

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | N/A：无新公开 API；page-core 导出由类型与测试覆盖 |
| 用户文档 | `README.md`、`README.zh-CN.md` 索引浏览节 |
| 运维文档 | N/A：无部署/环境变化 |

## 交接顺序

1. Developer 实施与自验 →
2. Reviewer（Review 门禁 required）→
3. QA 验收 →
4. 用户授权合并 → Manager 第三阶段文档提交（`done`）→ 合入 → 归档

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-09-07 | 初稿。Spec 确认：hex/detail 同类开关，默认折叠。 |

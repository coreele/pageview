# Dev Notes: btree-tree-view

## 实现摘要

B-tree 索引页增加与 hex/detail 同类的 chrome 开关 **Show tree / Collapse tree**（默认折叠）。展开后主分栏挂载树面板；结构图 / hex / 详情保留。拓扑纯函数在 `page-core`；web 侧独立缓存，展开取页走 `fetchIndexPage`，不调用 `loadIndexBlk`。点节点才加载当前页。换关系 / 进 WAL 清空树状态。无新 server 端点，URL 不编码折叠态。

## 变更路径

- `packages/page-core/src/btree-tree.ts`、`packages/page-core/src/index.ts`、`packages/page-core/tests/btree-tree.test.ts`
- `apps/web/src/btreeTree.ts`、`apps/web/src/btreeTree.test.ts`、`apps/web/src/BtreeTreePanel.tsx`
- `apps/web/src/App.tsx`、`apps/web/src/styles.css`
- `README.md`、`README.zh-CN.md`

## 测试先行记录（TDD）

| Spec ID / 行为项 | 测试 | 先失败 | 后通过 | 说明 |
|---|---|---|---|---|
| P0-1 | `btreeTree.test.ts` collapsed 不 fetch；默认 EMPTY collapsed | 是（新文件红） | 是 | 与 chrome 默认折叠一致 |
| P0-2 | collapse 保留 cache、pending 为空 | 是 | 是 | |
| P0-3 | `treeChromeVisible` 仅 btree | 是 | 是 | App 按钮同条件 |
| P0-4 | `pathFromCache` 高度 2 meta→root→leaf；web visibleTree 自动展开 | 是 | 是 | |
| P0-5 | open 后 pending 仅 0 然后 root，不含 10/12 | 是 | 是 | mock 计数，无真库 |
| P0-6 | collapsed 仍 false；换当前叶只改 highight | 是 | 是 | Activate 在 App 跳过同 blk |
| P0-7 | `resetBtreeTree` = EMPTY | 是 | 是 | resetPageView / WAL 调用 |
| P0-8 | 既有 web 回归 198→210 全绿 | N/A | 是 | heap 分栏未加 data-tree |
| P1-1 | chips 从 flags 导出 | 是 | 是 | page-core + web 各一例 |
| P1-2 | 不可达叶 orphan | 是 | 是 | |
| P1-3 | putError 后 pending 空，retry 再入队 | 是 | 是 | |

## 验证

| 命令 | 验证层 | 结果摘要 / 证据 |
|---|---|---|
| `pnpm --filter page-core test` | unit | 170 passed，含 btree-tree 12 |
| `pnpm --filter web test` | unit | 210 passed，含 btreeTree 12 |
| `pnpm -r typecheck` | static | 四包 Done |
| `pnpm -r build` | build | web vite build 成功 |

## 布局回修（用户：左侧导航太大）

- 原因：宽屏树列 `minmax(180px, 0.28fr)` + `max-width: 22rem`，两节点索引仍占约 1/4 视口。
- 处理：`fit-content(13rem)` + pane `max-width: 13rem`。提交 `36b5ff3`。

## 表模式同步（2026-09-08）

- 树状态改为按 index oid 分片；表页 Show tree 列出该表索引，单独 B-tree 自动展开。
- 点节点 `setRelationKind("index")` + `loadIndexBlk`，不 `resetPageView` 清树。
- 换表 / 改过滤器 / WAL 仍 `resetTreeContext`。
- 提交 `3dae723`。web 215 tests。

## 表模式更正为块列表（2026-09-08）

用户：table 模式导航没有 tree，就是列表。撤销索引森林。

- `visibleHeapBlockList`：`blk 0 … blocks-1`，当前块高亮；`blocks > 2000` 窗口化。
- `visibleTree(state, oid, currentBlkno)` 回到单索引页拓扑。
- 表模式点行 `loadBlk`，不切 `relationKind`。
- 换表 / 换索引 / 换 kind / WAL 清树。

| Spec ID / 行为项 | 测试 | 先失败 | 后通过 | 说明 |
|---|---|---|---|---|
| P0-9 | `visibleHeapBlockList` 5 块 + 当前高亮 | 是（替换森林用例） | 是 | 无 expander、无索引名 |
| P0-10 | 列表行 `blkno` 即目标堆块 | 是（合同断言） | 是 | App `onTreeActivate` heap 分支 |
| 大表窗口 | `heapBlockListRange(3000, …)` | 是 | 是 | 软上限 2000 |

验证：`pnpm --filter page-core test` 170；`pnpm --filter web test` 215（btreeTree 17）；`pnpm -r typecheck` / `pnpm -r build` 退出码 0。

## 目标分支同步（最终 Review 前）

- 目标分支及提交: `origin/main` `872e7f62a9f68b152082a72f570a92ff10535daa`
- 同步后源分支 HEAD: `36b5ff315e25695dd8fc3cd1400bc9930cbce2a5`
- 同步方式: rebase
- 冲突及处理: N/A（已与 origin/main 同步，无新提交）
- 同步后复验: 布局回修后 `pnpm --filter web test` 退出码 0；HEAD `36b5ff3`
- 表模式更正后源分支 HEAD: `d086861fb038ca79e3a69380dcc3a76057b8483e`；`origin/main` 仍为 `872e7f6`，无需再 rebase

## 文档影响

| 类别 | 已更新路径或交接说明 |
|---|---|
| 开发文档 | N/A（Plan 声明无新公开 API 文档） |
| 用户文档 | `README.md`、`README.zh-CN.md` 索引节 |
| 运维文档 | N/A |

## 未解决风险 / 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| P0-5 真库扇出 | Plan 最低层不含 integration | 打开大索引若实现回归可能多打叶请求 | 本地对 `uq_k_idx` 看网络面板 |
| 树内方向键 | 最低 Tab+Enter | 深树键盘较慢 | 不阻塞 |

## QA 修复回执

| 缺陷 ID | 处理 | 摘要 | 验证证据 | 建议复测范围 |
|---|---|---|---|---|
| | | | | |

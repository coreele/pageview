# QA Report: btree-tree-view

> 首测与所有回归写在本文件，按轮次追加；禁止 `qa-report-v2.md`。

## 轮次

| 轮次 | 日期 | 实现版本 | 环境 | 范围 | 结论 |
|---|---|---|---|---|---|
| 1 | 2026-09-07 | `fe9d523bf85cc1b36b0bddf37a8b78eeb8c51a54` | 本地 pnpm workspace（同步后 `origin/main` `872e7f6`） | 首测：Spec P0/P1 + Plan 验证层 | Pass |
| 2 | 2026-09-07 | `36b5ff315e25695dd8fc3cd1400bc9930cbce2a5` | 同上 | 回归：树列收窄（用户反馈过宽） | Pass |
| 3 | 2026-09-08 | `3dae723b3e71af1ac5b28b17891fd7dbf84b9cd4` | 同上 | 表模式树 + P0-9/P0-10 + 回归 | Pass |
| 4 | 2026-09-08 | `d086861fb038ca79e3a69380dcc3a76057b8483e` | 同上 | 表模式改为堆块列表；回归索引树 | Pass |

## 执行命令

| 命令 | 输出摘要 / 证据位置 |
|---|---|
| `pnpm --filter page-core test` | 6 files / 170 tests passed（含 `btree-tree.test.ts` 12） |
| `pnpm --filter web test` | 13 files / 215 tests passed（含 `btreeTree.test.ts` 17） |
| `pnpm -r typecheck` | page-core / wal-core / server / web Done |
| `pnpm -r build` | 四包成功；web vite built `index-BcnrqYiU.js` |

## 覆盖（对照 Spec 验收与 Plan 验证）

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| P0-1 | 默认折叠、三联区不变 | Pass | `pendingFetches` 在 collapsed 为空；EMPTY 默认 `collapsed: true`；heap/btree 结构区代码仍在 |
| P0-2 | Show/Collapse 不丢页 | Pass | `setTreeCollapsed` 测试保留 cache |
| P0-3 | WAL 无树按钮；heap 有按钮 | Pass | `treeChromeVisible` 为 btree\|heap；WAL 无 pageView |
| P0-4 | 路径展开 + 高亮 | Pass | `pathFromCache` 高度 2；`visibleTree` current=11 |
| P0-5 | 按需取页 | Pass | open 后 pending `[0]` 再 `[3]`，不含叶 10/12 |
| P0-6 | 点节点仍开树 | Pass | `openedAtLeaf().collapsed === false`；App `loadedBlkno === target` 跳过重复 Load |
| P0-7 | 换表 / 换索引 / 换 kind / WAL 清树 | Pass | `resetTreeContext` 在 onSelectTable / onSelectIndex / onSwitchRelationKind / 过滤器 / WAL |
| P0-9 | 表模式块列表 | Pass | `visibleHeapBlockList(5, 2)` 列出 0–4、高亮 2、无 expander |
| P0-10 | 表列表加载堆页 | Pass | `onTreeActivate` heap 分支 `loadBlk`，不改 kind |
| P0-8 | 既有路径 | Pass | web 215 / page-core 170 回归；heap 三联区保留，仅多可选树列 |
| P1-1 | 状态芯片 | Pass | `btreeTreeNodeSummary` + visibleTree chips |
| P1-2 | 孤立当前页 | Pass | `pathFromCache` orphan；`visibleTree.orphan` |
| P1-3 | 失败可 retry | Pass | error 不自动 pending；`retryNode` 后重新入队 |
| V-build | typecheck + build | Pass | 见执行命令 |
| V-docs | README 中英 | Pass | 索引节含 Show tree / Collapse tree |

## 回归

| 范围 | 结果 | 证据 |
|---|---|---|
| page-core 既有 btree/heap 解析 | Pass | 158 旧用例 + 12 新用例 |
| web url/hex/index/heapPeek | Pass | 198 旧用例 + 12 新用例 |
| 树列宽度 | Pass | `styles.css`：`fit-content(13rem)`，无 `0.28fr` / `22rem`；web 210 回归绿 |

## 文档与安全验收

| 项 | 结果 | 备注 |
|---|---|---|
| 用户可见文档 | Pass | README 双语 |
| 运维可执行文档 | Pass | N/A |
| 安全验证范围 | Pass | 无新依赖；无 URL 折叠参数；取页走既有守卫 |

## 缺陷

| ID | 严重度 | 摘要 | 状态 | 处理说明 | 验证证据 |
|---|---|---|---|---|---|
| — | | | | | |

## 阻塞（Blocked 时必填）

- 原因:
- 风险:
- 恢复条件:
- 复测范围:

## 结论

- 本轮结论: Pass
- 合并: 已授权
- 待合入提交: `d086861fb038ca79e3a69380dcc3a76057b8483e`

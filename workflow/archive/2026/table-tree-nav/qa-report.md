# QA Report: table-tree-nav

> 首测与所有回归写在本文件，按轮次追加；禁止 `qa-report-v2.md`。

## 轮次

| 轮次 | 日期 | 实现版本 | 环境 | 范围 | 结论 |
|---|---|---|---|---|---|
| 1 | 2026-09-08 | `bf7c85490a318ce76676f4d167ffd141e1ef0da5` | 本地 pnpm workspace（`origin/main` `cd6dd9b`） | Spec P0-1–P0-7 / P1 + Plan V-docs / V-reg / V-static | Pass |
| 2 | 2026-09-08 | `f00465c651b16729ef0c43345487998192007ce8` | 同上 | 用户反馈：导航层级显示 | Pass |
| 3 | 2026-09-08 | `7fcae3c19c15c3dae64e4c65109986676abf9ac2` | 同上 | 用户反馈：去掉行底、收紧行距 | Pass |
| 4 | 2026-09-08 | `7a0897a1f6e32688132b75b0f2290c988cba5925` | 同上 | 用户反馈：再点表名收起 | Pass |
| 5 | 2026-09-08 | `9dac4e3373ecb62c128dfa2c6a3d02ffa9a3acc6` | 同上 | 用户反馈：栏间间隔与拖动调宽 | Pass |
| 6 | 2026-09-08 | `a323460e87daf2e87a6e1ebbc242531ea0bfbe08` | 同上 | 用户反馈：hex 等宽与裁切 | Pass |

## 执行命令

| 命令 | 输出摘要 / 证据位置 |
|---|---|
| `pnpm --filter web test` | 16 files / 238 passed（`btreeTree.test.ts` 28） |
| `pnpm --filter web typecheck` | 退出码 0 |

### 轮次 2

| 命令 | 输出摘要 / 证据位置 |
|---|---|
| `pnpm --filter web test` | 16 files / 241 passed（`treeNavUi.test.ts` 7） |
| `pnpm --filter web typecheck` | 退出码 0 |

### 轮次 3

| 命令 | 输出摘要 / 证据位置 |
|---|---|
| `pnpm --filter web test` | 16 files / 241 passed |

### 轮次 4

| 命令 | 输出摘要 / 证据位置 |
|---|---|
| `pnpm --filter web test` | 16 files / 242 passed |
| `pnpm --filter web typecheck` | 退出码 0 |

### 轮次 5

| 命令 | 输出摘要 / 证据位置 |
|---|---|
| `pnpm --filter web test` | 17 files / 246 passed |
| `pnpm --filter web typecheck` | 退出码 0 |

### 轮次 6

| 命令 | 输出摘要 / 证据位置 |
|---|---|
| `pnpm --filter web test` | 17 files / 248 passed |
| `pnpm --filter web typecheck` | 退出码 0 |

## 覆盖（对照 Spec 验收与 Plan 验证）

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| P0-1 | 未 Load 也列出 tables；Tree 可见 | Pass | `treeChromeVisible` table+undefined；`visibleTableCatalog` 三表无子节点 |
| P0-2 | Table 无表下拉；Index 仍有 | Pass | `App.tsx` Table 分支无 `table-select`；Index 分支仍有 |
| P0-3 | 点表 Load blk 0 | Pass | `activateTable` 在 `blocks > 0` 时 `loadBlk(oid, 0)` |
| P0-4 | 0 blk 不请求 | Pass | catalog 无 page 子行；`activateTable` 在 `blocks === 0` 早退 |
| P0-5 | 点 blk Load；expander 不 Load | Pass | `onTreeActivate` page 走 `loadBlk`；expander `toggleTableExpanded` |
| P0-6 | Index 无页无 Tree | Pass | `treeChromeVisible({ relationKind: "index", pageKind: undefined })` false |
| P0-7 | 深链展开该表 | Pass | restore `ensureTableExpanded`；catalog 选中+当前 blk |
| P1 | 长名 ellipsis + title | Pass | `.btree-tree-blk` ellipsis；表行 `title=qualifiedName` |
| V-docs | README | Pass | 中英写明 Table 用导航选表 |
| V-reg | web test | Pass | 238 全绿 |
| V-static | typecheck | Pass | 退出码 0 |
| P1-hierarchy | 父子层级可分 | Pass | 子行 1.25rem 缩进 + 引导线；选中为文字 accent、无行底 |
| P1-label-collapse | 再点已展开表名收起 | Pass | `tableNameClickCollapses(selected, selected, [oid])` true；`activateTable` 早退 |
| P1-split | 三栏间隔与拖动 | Pass | 默认 hex 与结构图 `1fr` 等分；上限 1600px |

## 回归

| 范围 | 结果 | 证据 |
|---|---|---|
| btree 树缓存 / 窗口 / URL / 索引选项 | Pass | 既有 web 用例仍绿 |

## 文档与安全验收

| 项 | 结果 | 备注 |
|---|---|---|
| 用户可见文档 | Pass | README 中英已改 |
| 运维可执行文档 | Pass | N/A |
| 安全验证范围 | Pass | 无新端点、无新依赖；页请求仍走既有 `loadBlk` |

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
- 待合入提交: `a323460e87daf2e87a6e1ebbc242531ea0bfbe08`

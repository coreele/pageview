# QA Report: drop-load-refresh

> 首测与所有回归写在本文件，按轮次追加；禁止 `qa-report-v2.md`。

## 轮次

| 轮次 | 日期 | 实现版本 | 环境 | 范围 | 结论 |
|---|---|---|---|---|---|
| 1 | 2026-09-08 | `fa596be3c2468bd1e2122d07b7c3c1f9536653fa` | 本地 web vitest + tsc；`origin/main` `5482949` 为祖先 | 首测（含 Tree 开关修订） | Pass |

## 执行命令

| 命令 | 输出摘要 / 证据位置 |
|---|---|
| `pnpm --filter web test` | 18 files / 269 passed |
| `pnpm --filter web typecheck` | 退出码 0 |

## 覆盖（对照 Spec 验收与 Plan 验证）

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| P0-1 | 默认 Tree 亮；无次带按钮；只有 Tree 开关 | Pass | `pageBrowseMode(false)==="tree"`；`chromeToggleClass(!collapsed)`；chrome-controls 包在 `browseMode === "single"`；无 `>Single<` |
| P0-2 | 关掉 Tree 出全套次带、无目录 | Pass | `collapsed` → single；`treeOpen={!btreeTree.collapsed}`；暗时渲染 Load 行 |
| P0-3 | 再点当前 heap blk = refresh | Pass | `pageRowClickAction` refresh；`loadBlk(row.indexOid, row.blkno, { refresh: true })` |
| P0-4 | 点另一 blk = load | Pass | `pageRowClickAction` load 分支；非当前页走无 refresh 的 `loadBlk` |
| P0-5 | 再点当前 index 页 = refresh | Pass | `isCurrentDisplayedPage` btree；`loadIndexBlk(..., { refresh: true })` |
| P0-6 | Tree 选表后关掉 Tree 可 Load 其他 blk | Pass | 切模式只 `setTreeCollapsed`；e2e helper 按 `aria-pressed` 关 Tree 后点 Load |
| P0-7 | WAL 无 Tree 开关，有 Load | Pass | WAL 控件切片含 `"Load"` / `recent 20`，无 `chromeToggleClass` / Tree |
| P1 | expander 不刷新；表名仍收起；文案；README | Pass | `onTreeToggleExpand` 未改；无 Open Tree；README 写 Tree 亮/暗，无 `Tree \| Single` |
| V-docs | README 中英 | Pass | `chromeToggle.test.ts` 禁止 `Tree \| Single` |
| V-reg | web test | Pass | 269 passed |
| V-static | typecheck | Pass | 退出码 0 |

## 回归

| 范围 | 结果 | 证据 |
|---|---|---|
| btree 树 / urlState / indexView / chromeToggle / pageToolbarNav | Pass | 同次 vitest 全绿 |

## 文档与安全验收

| 项 | 结果 | 备注 |
|---|---|---|
| 用户可见文档 | Pass | README 中英 Tree 亮/暗、Refresh 与 Prev/Next 入口 |
| 运维可执行文档 | Pass | N/A（Plan） |
| 安全验证范围 | Pass | 无新密钥；请求仍走既有 page API |

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
- 合并: 已授权（等 Manager 置 `done`）
- 待合入提交: `fa596be3c2468bd1e2122d07b7c3c1f9536653fa`

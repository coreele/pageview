# Dev Notes: drop-load-refresh

## 实现摘要

Page 浏览用 `btreeTree.collapsed` 映射 Tree 亮/暗（沟通名 Tree / Single）。chrome 仍是单独 **Tree** 开关，界面不出现 Single。Tree 亮：目录、不渲染次带 Table/Index/blkno/Load/Refresh/Prev/Next；点 page 行走 `pageRowClickAction`，当前显示块 `loadBlk` / `loadIndexBlk(..., { refresh: true })`。Tree 暗：隐藏目录、保留原次带。切 Table/Index 不再强制开树。空态去掉「Open Tree」。

## 变更路径

- `apps/web/src/pageBrowse.ts`、`apps/web/src/pageBrowse.test.ts`
- `apps/web/src/App.tsx`、`apps/web/src/styles.css`
- `apps/web/src/treeNavUi.test.ts`、`apps/web/src/chromeToggle.test.ts`
- `README.md`、`README.zh-CN.md`
- `e2e/helpers/app.ts`、`e2e/m1.spec.ts`、`e2e/m6-m8-m9.spec.ts`

## 测试先行记录（TDD）

| Spec ID / 行为项 | 测试 | 先失败 | 后通过 | 说明 |
|---|---|---|---|---|
| P0-1 | `pageBrowseMode(false)==="tree"`；`chromeToggleClass(!collapsed)`；次带包在 `browseMode === "single"`；无 `>Single<` | 是 | 是 | 用户修订后改为单 Tree 开关 |
| P0-2 | `pageBrowseMode(true)==="single"`；`collapsed` 时 `treeOpen` false | 是 | 是 | 关 Tree 渲染 `.chrome-controls` |
| P0-3 | `pageRowClickAction` refresh；App `loadBlk(..., { refresh: true })` | 是 | 是 | 去掉同 blk 空 return |
| P0-4 | `pageRowClickAction` load | 是 | 是 | |
| P0-5 | `isCurrentDisplayedPage` btree；App `loadIndexBlk(..., { refresh: true })` | 是 | 是 | |
| P0-6 | 切模式只 `setTreeCollapsed`，不清 oid；e2e 按 `aria-pressed` 关 Tree | 否 | 是 | 接线代码审；e2e 未在本会话实跑 |
| P0-7 | WAL chrome 有 `"Load"`、无 Tree 开关 | 是 | 是 | `treeNavUi.test.ts` 切片 |
| P1 | 无 Open Tree 文案；README Tree 亮/暗；expander 仍 `onTreeToggleExpand` | 否 | 是 | README 不出现 Single 界面名 |
| V-reg / V-static | web test + typecheck | — | 是 | 18 files / 269；tsc 0 |

## 验证

| 命令 | 验证层 | 结果摘要 / 证据 |
|---|---|---|
| `pnpm --filter web test` | unit | 18 files / 269 passed |
| `pnpm --filter web typecheck` | static | 退出码 0 |

## 目标分支同步（最终 Review 前）

- 目标分支及提交: `origin/main` `5482949620a8b27520151991939d1245c7ff5829`
- 同步后源分支 HEAD: `fa596be3c2468bd1e2122d07b7c3c1f9536653fa`
- 同步方式: N/A（`origin/main` 已是祖先，无需 rebase）
- 冲突及处理: N/A
- 同步后复验: `pnpm --filter web test` 18/269；`pnpm --filter web typecheck` 退出码 0

## 文档影响

| 类别 | 已更新路径或交接说明 |
|---|---|
| 开发文档 | N/A |
| 用户文档 | `README.md`、`README.zh-CN.md` |
| 运维文档 | N/A |

## 未解决风险 / 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 真机点 Tree 亮暗 | 实施时未连库点击 | 次带切换手感 | 本地连库点开关 |
| e2e 全量 | CI 不跑 Playwright；本会话未实跑 | helper 改后未实跑 | 本地 `pnpm test:e2e` |

## QA 修复回执

| 缺陷 ID | 处理 | 摘要 | 验证证据 | 建议复测范围 |
|---|---|---|---|---|
| | | | | |

# Dev Notes: table-tree-nav

## 实现摘要

Table 模式导航改为表目录：`visibleTableCatalog` 生成 `schema.table` 节点，展开后挂 `visibleHeapBlockList` 窗口。连库后 Tree 默认开、不依赖已 Load 页。点表名 `loadBlk(oid, 0)`（0 块表不请求）；点 expander 只改 `expandedTableOids`；点 blk 走既有 heap Load。次带去掉 Table 侧 `select.table-select`，Index 两个下拉与 B-tree 树不变。

## 变更路径

- `apps/web/src/btreeTree.ts`、`apps/web/src/btreeTree.test.ts`
- `apps/web/src/BtreeTreePanel.tsx`、`apps/web/src/App.tsx`、`apps/web/src/styles.css`
- `README.md`、`README.zh-CN.md`
- `e2e/helpers/app.ts`、`e2e/m1.spec.ts`（CI 已不跑 e2e；helpers 改点树节点以免本地套件仍找下拉）

## 测试先行记录（TDD）

> 每项行为变更一行。首列填 Spec 的 `P0-n` / `P1-n`，无 Spec 时填 Plan 的 `V-n` 或行为项描述。
> 「先失败」记录测试在实现前的失败证据；确实无法测试先行的，在「说明」写原因、风险与替代验证。
> 有 Spec 时，每条 P0 必须在本表出现。

| Spec ID / 行为项 | 测试 | 先失败 | 后通过 | 说明 |
|---|---|---|---|---|
| P0-1 | `treeChromeVisible` table+无 page；`visibleTableCatalog` 列出表节点 | 否 | 是 | 与实现同批；首次 web test 即绿 |
| P0-2 | Table 分支无 `table-select`；Index 仍有 | 否 | 是 | 静态核对 `App.tsx`；无组件挂载测 |
| P0-3 | `activateTable` → `loadBlk(oid, 0)` | 否 | 是 | App 接线代码审；catalog 不发请求 |
| P0-4 | 0-block 表无 page 子节点、`expandable=false` | 否 | 是 | `visibleTableCatalog` 用例 |
| P0-5 | 块行 `role=page`；expander 走 `toggleTableExpanded` | 否 | 是 | catalog 子块 + App `onTreeToggleExpand` |
| P0-6 | `treeChromeVisible({ kind: index, pageKind: undefined })` false | 否 | 是 | 单测 |
| P0-7 | 选中 oid 展开且当前 blk 高亮 | 否 | 是 | catalog + restore `ensureTableExpanded` |
| P1 | CSS ellipsis；表行 `title=qualifiedName` | 否 | 是 | 样式 + `BtreeTreePanel` |

## 验证

| 命令 | 验证层 | 结果摘要 / 证据 |
|---|---|---|
| `pnpm --filter web test` | unit | 16 files / 238 passed（`btreeTree.test.ts` 28） |
| `pnpm --filter web typecheck` | static | 退出码 0 |

## 目标分支同步（最终 Review 前）

- 目标分支及提交: `origin/main` `cd6dd9be3285a08586975437d0192173fa42a826`
- 同步后源分支 HEAD: `bf7c85490a318ce76676f4d167ffd141e1ef0da5`
- 同步方式: N/A（`origin/main` 已是祖先，未 rebase）
- 冲突及处理: N/A
- 同步后复验: `pnpm --filter web test` 238 passed；`pnpm --filter web typecheck` 退出码 0

## 文档影响

| 类别 | 已更新路径或交接说明 |
|---|---|
| 开发文档 | N/A |
| 用户文档 | `README.md`、`README.zh-CN.md` |
| 运维文档 | N/A |

## 未解决风险 / 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 真机连库点表 | 本会话无浏览器工具、未连 Postgres | 无页 split / 长名截断观感 | 本地 Connect 后点表与 blk |
| Playwright e2e | CI 已去掉；本会话未跑 | helpers/m1 已改，未实跑 | 有人跑 `e2e/` 时 |

## 用户反馈回修（层级显示）

截图：父子共用同一 accent 条 + 缩进过浅，表与 blk 0 糊成一块。

- `f00465c651b16729ef0c43345487998192007ce8`：子行 `--tree-indent: 1.25rem` 与竖向引导线；表/索引选中淡底无左边条；当前 page 才用 inset accent。`treeNavUi.test.ts` 补 3 条。
- 复验：`pnpm --filter web test` 241 passed；`pnpm --filter web typecheck` 退出码 0。
- `7a0897a1f6e32688132b75b0f2290c988cba5925`：已展开的当前表再点表名 `tableNameClickCollapses` → `toggleTableExpanded`，不 Load。web test 242。
- `9dac4e3373ecb62c128dfa2c6a3d02ffa9a3acc6`：三栏 `PageSplit` 拖动调宽 + 10px gutter；宽度写入 `pg-page-viewer.split`。web test 246。
- `a323460e87daf2e87a6e1ebbc242531ea0bfbe08`：hex 默认与结构图等分 1fr；上限 1600px；`.hex` `min-width: 0` 避免裁切。storage key v2。web test 248。

## QA 修复回执

> QA `Fail` 后按缺陷 ID 追加，不另建文件。

| 缺陷 ID | 处理 | 摘要 | 验证证据 | 建议复测范围 |
|---|---|---|---|---|
| | | | | |

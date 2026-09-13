# Dev Notes: single-relation-select

## 实现摘要

- 在 single 模式（`pageBrowseMode(btreeTree.collapsed) === "single"`）的次带 `.chrome-controls` 内，按 `relationKind` 增补关系下拉：`table` 分支加 `table-select`，`index` 分支加 `index-select`，均位于 blkno 控件之前。
- Table 下拉列出 `tables`，option 文案 `` `<qualifiedName> (oid <oid> · <blocks> blk)` ``；Index 下拉列出**全部** `indexes`（无表过滤），option 复用 `formatIndexOption` / `indexOptionTitle`。
- 选择即走现 `onSelectTable` / `onSelectIndex` 语义（清页 / blkno 0 / Tree 展开同步），并在可加载时自动 `loadBlk(oid, 0)` / `loadIndexBlk(oid, 0)`；0 块表、非 B-tree、0 块 B-tree 索引不自动加载。
- 未改动 Tree 模式：两下拉仅在 `browseMode === "single"` 门控内渲染。
- 新增纯函数模块 `relationSelect.ts`（`formatTableOption`、`shouldAutoLoadRelation`），单测覆盖。
- README 中英同步更新「Tree 暗时可从工具栏选表 / 索引」。

## 变更路径

- 新增 `apps/web/src/relationSelect.ts`
- 新增 `apps/web/src/relationSelect.test.ts`
- 修改 `apps/web/src/App.tsx`（import、`pickTableFromSelect` / `pickIndexFromSelect`、single 门控内两个 `<select>`）
- 修改 `apps/web/src/treeNavUi.test.ts`（`index-tree-nav chrome (P0-3)` 旧断言改写为「仅 single 门控内出现」+ 占位 / 禁用 / 自动加载源码扫描）
- 修改 `README.md`、`README.zh-CN.md`

## 测试先行记录（TDD）

> 每项行为变更一行。首列填 Spec 的 `P0-n` / `P1-n`，无 Spec 时填 Plan 的 `V-n` 或行为项描述。

| Spec ID / 行为项 | 测试 | 先失败 | 后通过 | 说明 |
|---|---|---|---|---|
| P0-1 | `relationSelect.test.ts` `formatTableOption`；`treeNavUi.test.ts`「仅 single 门控内出现 table-select」 | 红：模块不存在 + App.tsx 无 `className="table-select"`（`pnpm --filter web test` 3 failed） | 绿：301 passed | 文案与门控位置 |
| P0-2 | `relationSelect.test.ts` `shouldAutoLoadRelation(>0)=true`；`treeNavUi.test.ts` 扫描 `loadBlk(oid, 0)` 与 `shouldAutoLoadRelation(t.blocks)` | 红（同上） | 绿 | 真机自动加载见验证缺口 |
| P0-3 | 复用现 `triggerLoad` / `canLoad`，无改动 | 回归 | `pageBrowse` / `blockNav` 等全绿 | |
| P0-4 | `indexView.test.ts` `formatIndexOption`；`treeNavUi.test.ts` catalog `not.toMatch(/filterIndexesByTable/)` | 保持通过 | 绿 | 索引列表为完整 `indexes` |
| P0-5 | `relationSelect.test.ts` `canLoadIndex && shouldAutoLoadRelation`；`treeNavUi.test.ts` 扫描 `loadIndexBlk(oid, 0)` | 红 | 绿 | 真机结构图见缺口 |
| P0-6 | `relationSelect.test.ts` 非 B-tree 组合为 false | 红 | 绿 | 非 B-tree 不自动加载 |
| P0-7 | 复用现 `triggerLoadIndex` / `canLoadIndexBlk`，无改动 | 回归 | 绿 | |
| P0-8 | 复用现按钮 / `heapToolbarNav` / `indexToolbarNav`；`blockNav` / `pageToolbarNav` / `pageBrowse` 回归 | 回归 | 绿 | |
| P0-9 | 选择走现 handler + 现 Load 提交点写 `urlLoaded`；`urlState` 回归 | 回归 | 绿 | 深链回放见缺口 |
| P0-10 | `onSelectTable` / `onSelectIndex` 已调 `ensureTableExpanded` / `ensureIndexExpanded`；`btreeTree` 回归 | 回归 | 绿 | 真机见缺口 |
| P0-11 | `treeNavUi.test.ts` 断言两 className 均在 `browseMode === "single" && (` 之后 | 红：旧断言要求不含，与实现冲突 | 绿 | 合同变更，已按 Spec 改写 |
| P0-12 | `treeNavUi.test.ts` 扫描 `Loading tables…` / `No tables` / `select a table…` / `Loading indexes…` / `No user indexes (system schemas excluded)` / `select an index…` / `loadState === "loading-page"` | 红 | 绿 | |
| P0-13 | `relationSelect.test.ts` `shouldAutoLoadRelation(0)=false`；源码扫描门禁 | 红 | 绿 | 0 块不发请求 |

## 验证

| 命令 | 验证层 | 结果摘要 / 证据 |
|---|---|---|
| `pnpm --filter web test` | unit | EXIT=0；21 files / 301 tests passed（含新增 `relationSelect.test.ts` 与改写后的 `treeNavUi.test.ts`） |
| `pnpm --filter web typecheck` | static | EXIT=0；零类型错误 |
| `pnpm build` | build | EXIT=0；page-core / wal-core / server / web（vite 70 modules）全部构建成功 |

## 目标分支同步（最终 Review 前）

- 目标分支及提交: `main` @ `ed8437c78c39d8d526989fc387551dfeffda6c4c`（`git fetch --all` 后 `origin/main` 与本地 `main` 同为 `ed8437c`，未移动）
- 同步后源分支 HEAD: `e4186cd2ecbb4e47b55942043ae70ae653882fc9`（代码提交 `e4186cd`，位于 `00fc72f` 之上）
- 同步方式: N/A（no-op；`git merge-base --is-ancestor origin/main HEAD` 退出 0，`origin/main..HEAD` 仅 `e4186cd`、`00fc72f`，无需 rebase / stash）
- 冲突及处理: N/A（无 rebase，无冲突；工作流文档 `main.md` / `dev-notes.md` 未受影响，仍留在工作树）
- 同步后复验: `pnpm --filter web test` EXIT=0（301 passed）；`pnpm --filter web typecheck` EXIT=0；`pnpm build` EXIT=0（全仓构建成功）

## 文档影响

| 类别 | 已更新路径或交接说明 |
|---|---|
| 开发文档 | N/A（`relationSelect.ts` 为内部纯函数，无新 API / 模块契约） |
| 用户文档 | `README.md`、`README.zh-CN.md`（Tree 暗时工具栏可选表 / 索引并自动加载 blk 0） |
| 运维文档 | N/A（无部署 / 配置变更） |

## 未解决风险 / 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 真机自动加载 blk 0 / 结构图 / URL 实时写入 | 无 React DOM 测试环境，web 仅 vitest 纯函数 + 源码扫描；需活 PG 与浏览器 | P0-2 / P0-5 / P0-9 真实行为仅由源码扫描间接保证 | 本地 `pnpm dev:server` + `pnpm dev:web`，连接后关 Tree 选表 / 索引核对 |
| 深链回放 | 需活 PG 与浏览器 | P0-9 回放未端到端验证 | 用带 `?mode=page&kind=index&index=<oid>&blkno=0` 的 URL 重载 |
| 窄宽换行与长名截断观感 | 纯 CSS 视觉，无快照测试 | 极窄宽下控件拥挤 | 浏览器手动缩放核对 |

## QA 修复回执

> QA `Fail` 后按缺陷 ID 追加，不另建文件。

| 缺陷 ID | 处理 | 摘要 | 验证证据 | 建议复测范围 |
|---|---|---|---|---|
| | | | | |

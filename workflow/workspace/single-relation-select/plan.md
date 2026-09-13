# Plan: single-relation-select

## 元信息

- 依据 Spec: `workflow/workspace/single-relation-select/spec.md`
- 依据 Design: N/A（Design 门禁 skipped：单组件内 UI 增补，无模块边界 / 分层 / 技术选型决策）
- 依据 UI: `workflow/workspace/single-relation-select/ui-design.md`
- 路径等级: standard
- Review 门禁: required
- 最低验证层: unit + static + build
  - `unit`：新增 `relationSelect` 纯函数与 `treeNavUi.test.ts` 源码扫描覆盖选择 / 门禁 / 门控合同；任何行为变更至少 `unit`（quality.md §1）。
  - `static`：`tsc --noEmit` 覆盖 JSX / 类型接线。
  - `build`：Vite 打包确认新增 JSX 无构建期错误。
  - 真机自动加载 / 深链回放属 `integration`，需活 PG，CI 未跑 Playwright，见「验证缺口」。
- 验证命令:
  - `pnpm --filter web test`
  - `pnpm --filter web typecheck`
  - `pnpm build`
  - （全仓回归，可选）`pnpm test`、`pnpm typecheck`
  - （需活 PG，可选）`pnpm test:e2e`
- 预期证据: 上述命令退出码 0；`relationSelect` / `treeNavUi` 新增用例通过且旧断言改写后绿；typecheck 零错误；build 成功日志。

## 目标摘要

在 `browseMode === "single"`（Tree 关闭）的次带 `.chrome-controls` 内，按 `relationKind` 增补关系下拉：table 选表、index 选全部用户索引。选择即选中并（可加载时）自动 Load blk 0、blkno 置 0；Tree 展开同步；Tree 模式不渲染下拉。不改变既有 handler / URL 合同，不重新引入表过滤耦合。

## 任务拆解

1. **新增纯函数模块**（完成条件：新增 `apps/web/src/relationSelect.ts` 与 `relationSelect.test.ts`）
   - `formatTableOption(t: TableRow): string` → `` `${t.qualifiedName} (oid ${t.oid} · ${t.blocks} blk)` ``（Spec §2 option 文本）。
   - `shouldAutoLoadRelation(blocks: number): boolean` → `blocks > 0`（Spec §2/§3/§13：0 块不发请求）；index 侧自动加载条件为 `canLoadIndex(idx) && shouldAutoLoadRelation(idx.blocks)`，直接复用 `indexView.canLoadIndex`。
   - 单测覆盖：正常 / 0 块 / 长名（不断言截断，只断言字符串）、`canLoadIndex` 组合下的门禁。
2. **App 接线**（完成条件：仅 single 模式渲染两个下拉，行为符合 Spec §2/§3/§4/§5）
   - 在 `{browseMode === "single" && (` 的 `.chrome-controls` 内、`relationKind === "table"` 分支的 blkno `<label>` 之前插入 `<label className="control"><span className="control-label">table</span><select className="table-select">…`；在 `relationKind === "index"` 分支同理插入 `index-select`，`indexHint` 保持现有位置。
   - Table 下拉：`value` 仅在 `selectedOid` 命中 `tables` 时取该 oid，否则 `""` 占位项；`disabled = !tablesFetched || loadState === "loading-tables" || loadState === "loading-page" || tables.length === 0`；占位文案 `Loading tables…`（未到 / 加载中）/ `No tables`（空）/ `select a table…`（可选未选）；`title` = 选中表 `qualifiedName`；option `title` = `qualifiedName`。
   - Index 下拉：`value` 仅在 `selectedIndexOid` 命中 `indexes` 时取该 oid，否则 `""` 占位项；`disabled = !indexesFetched || loadState === "loading-indexes" || loadState === "loading-page" || indexes.length === 0`；占位文案 `Loading indexes…` / `No user indexes (system schemas excluded)` / `select an index…`；option 文本 `formatIndexOption`、`title` `indexOptionTitle`；列表为完整 `indexes`，**不**调用 `tableFilterOptions` / `filterIndexesByTable` / `tablesWithIndexes`。
   - 新增选择处理：`pickTableFromSelect(oid)` = `setBlkno(0)` → `void onSelectTable(oid)` → `if (shouldAutoLoadRelation(t.blocks)) void loadBlk(oid, 0)`；`pickIndexFromSelect(oid)` = `void onSelectIndex(oid)`（内部已 `setBlkno(0)` + `resetPageView` + `ensureIndexExpanded`）→ `if (canLoadIndex(idx) && shouldAutoLoadRelation(idx.blocks)) void loadIndexBlk(oid, 0)`。两者入口先判 `loadState === "loading-page"` 直接返回；**不**复制 Tree 的「再点已选节点即收起」逻辑。`onSelectTable` / `onSelectIndex` 已调用 `ensureTableExpanded` / `ensureIndexExpanded`，满足 Tree 同步。
   - 复核选择重置集合与 Spec §合同一致（`pageView` / `loadedBlkno` / `selectedId` / `highlight` / `prevRaw` / `diffIds` / `hexLocate` / `urlLoaded.blkno = null`）；如需补齐，优先在现有选择路径内复用 `resetPageView`，不改外部错误码 / 失败清页 / URL 合同。
3. **测试合同更新**（完成条件：旧断言改写为反映新合同）
   - `apps/web/src/treeNavUi.test.ts`：`index-tree-nav chrome (P0-3)` 的 `"does not keep table or index dropdowns in App"` 改为断言 `App.tsx` 含 `className="table-select"` 与 `className="index-select"`，且两处均出现在 `browseMode === "single"` 之后（即门控内）；保留并确保 `index-tree-nav catalog (P0-2)` 的 `not.toMatch(/filterIndexesByTable/)` 仍通过。
   - 可加源码扫描断言：占位文案与 `loadState === "loading-page"` 禁用、`loadBlk(…, 0)` / `loadIndexBlk(…, 0)` 自动加载调用。
4. **README 更新**（完成条件：中英同步，去掉「Tree 暗时无下拉」描述）
   - `README.md` 第 24、29、77 行附近与 `README.zh-CN.md` 第 24、29、76 行附近：改为 Tree 暗时可在次带选择表或索引（index 列出全部用户索引、非 B-tree 标记不可加载）。
5. **回归**（完成条件：`pnpm --filter web test`、`pnpm --filter web typecheck`、`pnpm build` 全绿；`urlState` / `blockNav` / `indexView` / `pageBrowse` 既有用例不回归）

## 依赖与顺序

1 → 2 → 3 → 4 → 5。任务 3 依赖 2 的最终 DOM 结构（className 与门控）；任务 1 与 2 可并行，但 3 须在 2 之后定稿。

## 触碰路径

- 新增：`apps/web/src/relationSelect.ts`、`apps/web/src/relationSelect.test.ts`
- 修改：`apps/web/src/App.tsx`（single 模式 `.chrome-controls` 两分支 + 两个选择处理）
- 修改：`apps/web/src/treeNavUi.test.ts`（改写 P0-3 断言）
- 文档：`README.md`、`README.zh-CN.md`
- 仅回归不改：`apps/web/src/indexView.ts`（复用 `formatIndexOption` / `indexOptionTitle` / `canLoadIndex` / `nonBtreeHint`）、`apps/web/src/pageBrowse.ts`、`apps/web/src/urlState.ts`、`apps/web/src/blockNav.ts`
- 样式：`apps/web/src/styles.css` 仅在换行确实需要时微调既有 `.table-select` / `.index-select`（类已存在，预期不改）
- 可选：`e2e/helpers/app.ts`（已有 `tableSelect`；如补 `indexSelect` / 选择 helper 及 single 模式用例）

不改：server、URL 参数名与语义、`loadBlk` / `loadIndexBlk` / `onSelectTable` / `onSelectIndex` / `onSwitchRelationKind` 外部合同、B-tree / heap 解析、WAL。

## 验收与验证

> ID 取 Spec 的 `P0-n`。每条 P0 至少一行。无 React DOM 测试环境，行为类断言以「纯函数单测 + App.tsx 源码扫描」为主；真机行为见「验证缺口」。

| ID | 要求或命令 | 预期证据 | 结果（实施后填） |
|---|---|---|---|
| P0-1 | kind=table 时 single 次带出现表下拉并列出 `tables` | `treeNavUi.test.ts` 断言 `table-select` 在 `browseMode === "single"` 内；`relationSelect.test.ts` 文案用例；`pnpm --filter web test` 退出码 0 | |
| P0-2 | 选 `blocks>0` 表 → 选中、blkno 0、自动 `loadBlk(oid,0)`、URL 带 `kind=table&table=<oid>&blkno=0` | 源码扫描断言 `pickTableFromSelect` 调 `loadBlk(oid, 0)` 且 `setBlkno(0)`；`urlState.test.ts` 回归（table + blkno 0 编码）；e2e / 真机见缺口 | |
| P0-3 | 已加载 blk 0 后输入另一 blkno 点 Load 正常加载 | 复用现 `triggerLoad` / `canLoad`，无改动；`pnpm --filter web test` 回归 | |
| P0-4 | kind=index 时索引下拉列出全部用户索引（不过滤），带 am / 块数，非 B-tree 标 `✕` | `indexView.test.ts` `formatIndexOption` 用例；源码扫描断言列表来自完整 `indexes`、无 `filterIndexesByTable` | |
| P0-5 | 选 B-tree 且 `blocks>0` 索引 → 选中、blkno 0、自动 `loadIndexBlk(oid,0)`、结构图出现 | 源码扫描断言 `pickIndexFromSelect` 调 `loadIndexBlk(oid, 0)`；`canLoadIndex` 单测；真机见缺口 | |
| P0-6 | 选非 B-tree 索引 → 选中、不发请求、Load 禁用、显示非 B-tree 提示 | `indexView.test.ts` `canLoadIndex` / `nonBtreeHint` 用例；源码扫描断言自动加载受 `canLoadIndex` 门禁 | |
| P0-7 | 已加载索引页后输入另一 blkno 点 Load 正常加载 | 复用现 `triggerLoadIndex` / `canLoadIndexBlk`，无改动；`pnpm --filter web test` 回归 | |
| P0-8 | Refresh / Prev / Next 行为与现合同一致 | 复用现按钮与 `loadBlk` / `loadIndexBlk` / `heapToolbarNav` / `indexToolbarNav`；`blockNav.test.ts`、`pageToolbarNav.test.ts`、`pageBrowse.test.ts` 回归 | |
| P0-9 | 通过下拉选表 / 索引并 Load 成功后重载同一 URL 恢复关系与 blkno | 选择走 `onSelectTable` / `onSelectIndex` + 现有 Load 提交点写 `urlLoaded`；`urlState.test.ts` 回归；深链回放见缺口 | |
| P0-10 | 通过下拉选中后点 Tree 开关回 Tree，目录展开并高亮该关系 | `onSelectTable` / `onSelectIndex` 已调 `ensureTableExpanded` / `ensureIndexExpanded`；源码扫描断言；`btreeTree.test.ts` 回归；真机见缺口 | |
| P0-11 | Tree 模式不渲染表 / 索引下拉 | `treeNavUi.test.ts` 断言两 `className` 均位于 `browseMode === "single"` 门控之后；`pnpm --filter web test` 退出码 0 | |
| P0-12 | 无表 → 禁用 + 空态；索引未到 / 为空 → 加载态 / `No user indexes (system schemas excluded)` | 源码扫描断言三处占位文案与禁用条件（`!tablesFetched` / `loading-tables` / `loading-indexes` / 空列表）；`pnpm --filter web test` 退出码 0 | |
| P0-13 | 选 `blocks===0` 表 / B-tree 索引 → 选中、blkno 0、不发请求、显示空关系 / 空索引提示 | `relationSelect.test.ts` `shouldAutoLoadRelation` 用例；源码扫描断言自动加载受 `shouldAutoLoadRelation` 门禁；现空态提示文案不变 | |
| V-static | `pnpm --filter web typecheck` | 退出码 0，零类型错误 | |
| V-build | `pnpm build` | 退出码 0，web / server 构建成功 | |
| V-reg | `pnpm --filter web test`（全量） | 退出码 0；`treeNavUi` 新断言与 `urlState` / `blockNav` / `indexView` / `pageBrowse` / `pageToolbarNav` / `btreeTree` 全绿 | |
| V-docs | README 中英同步 | 两文件 Tree 暗描述改为可在次带选表 / 索引，无「不加回下拉」残留 | |

## 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 真机自动加载 blk 0、结构图渲染、URL 实时写入 | 无 React DOM 测试环境（web 仅 vitest 纯函数 + 源码扫描），自动加载需活 PG 与浏览器 | P0-2 / P0-5 / P0-9 的真实行为仅由源码扫描间接保证 | 本地 `pnpm dev:server` + `pnpm dev:web`，连接后关 Tree 选表 / 索引核对 |
| 深链回放（同 URL 重载恢复关系与 blkno） | 需活 PG 与浏览器 | P0-9 回放路径未端到端验证 | 本地用带 `?mode=page&kind=index&index=<oid>&blkno=0` 的 URL 重载 |
| e2e 全量 | CI 未跑 Playwright（历史 `ci-drop-e2e`）；本项未新增 e2e 用例 | 回归面靠单测覆盖 | 本地 `pnpm test:e2e`（`pnpm --filter server build && pnpm --filter web build && … && playwright test`） |
| 窄宽换行与长名截断观感 | 纯 CSS 视觉，无快照测试 | 极窄宽下控件换行拥挤 | 浏览器手动缩放核对 |
| Tree 模式无下拉的 DOM 级确认 | 源码扫描断言门控位置，非真实渲染 | 门控写错位置时扫描可能漏判 | e2e `selectPageBrowseMode(page,"tree")` 后断言无 `select.table-select` |

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | N/A（无新 API / 模块契约；`relationSelect.ts` 为内部纯函数） |
| 用户文档 | `README.md`、`README.zh-CN.md`（Tree 暗时的关系选择行为） |
| 运维文档 | N/A（无部署 / 配置 / 运维变更） |

## 交接顺序

1. Developer 实施与自验 →
2. Reviewer（Review 门禁 required 时）→
3. QA 验收 →
4. 用户授权合并 → Manager 第三阶段文档提交（`done`）→ 合入 → 结束

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-09-13 | 初稿 |

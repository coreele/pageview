# Spec: single-relation-select

> 需求与行为合同，先于 Plan 完成。任务拆分见同目录 `plan.md`。
>
> **feature-id**：`single-relation-select`
>
> **确认记录**：路径 `standard`；Spec 用户确认 **not-required**（需求明确，无业务歧义；见 `main.md`）。

## 背景与目标

`index-tree-nav` + `drop-load-refresh` 之后，选表/选索引完全依赖左侧 Tree 目录；Tree 关闭（single 模式，`pageBrowseMode(btreeTree.collapsed) === "single"`）时次带只剩 `Table | Index` 切换、blkno 输入与 Load / Refresh / Prev / Next，**没有任何关系选择控件**。用户若没先在 Tree 里点过表/索引（或 URL 未带 `table`/`index`），single 模式下无法选表、选索引，也就无从输入 blkno 加载。

目标：在 single 模式工具栏内恢复「选关系」能力——Table kind 可直接选表，Index kind 可直接选索引，选中后按现有语义加载 blk 0，之后可用 blkno + Load / Refresh / Prev / Next 操作该关系。不改变 Tree 模式行为，不重新引入表过滤耦合。

## 非目标

- 改变 Tree 模式（Tree 亮）的行为与控件；Tree 模式下仍不加回任何下拉。
- 重新引入「表过滤索引」的耦合：Index kind 不出现表过滤器，索引列表始终是全部用户索引（与现 Tree INDEX 段一致）。
- 改 B-tree / heap 页解析、结构图、详情区、Hex、diff、WAL。
- 改 `loadBlk` / `loadIndexBlk` / `onSelectTable` / `onSelectIndex` / `onSwitchRelationKind` 的既有合同（错误码、失败是否清页、非 B-tree 拦截、URL 参数名与语义）。
- 让 Tree/Single 模式进入 URL 或 localStorage。
- 新增 server 端点或改 `/api/tables`、`/api/indexes` 载荷。

## 范围与可见行为

### 1. 出现位置

- 仅当 Page 模式、已连接、**Tree 关闭**（`browseMode === "single"`）时，次带渲染关系选择控件。
- Tree 开启（`tree`）时次带维持现状：不渲染关系选择控件。
- 关系选择控件按当前 `relationKind` 切换：`table` 显示表下拉，`index` 显示索引下拉；`Table | Index` 分段开关保持现状。
- 选择控件在 `loadState === "loading-page"` 期间禁用，避免并发加载。

### 2. Table kind

- 下拉列出当前 `tables` 列表，option 文本为 `<qualifiedName> (oid <oid> · <blocks> blk)`；`title` 为 `qualifiedName`。
- `tables` 尚未到达（`!tablesFetched` 或 `loadState === "loading-tables"`）：下拉禁用，显示加载态文案（如 `Loading tables…`）。
- 无表：下拉禁用，显示空态文案（如 `No tables`）。
- 选中一张 `blocks > 0` 的表：`selectedOid` 更新为该表，清空当前页 / 选中 / diff / hex 定位（现 `onSelectTable` 语义），blkno 置 0，并自动 `loadBlk(oid, 0)`（与 Tree 点表名一致）。
- 选中一张 `blocks === 0` 的表：`selectedOid` 更新，清空当前页，blkno 置 0，**不发 page 请求**；沿用现空关系提示。
- 下拉当前值反映 `selectedOid`（含从 Tree 或深链带入的选择）；`selectedOid` 不在列表中时显示占位。

### 3. Index kind

- 下拉列出**全部**用户索引（不按表过滤），option 文本复用现 `formatIndexOption`（`<qualifiedName> (<accessMethod> · <blocks> blk)`；非 B-tree 前缀 `✕ `；invalid 后缀 ` · invalid`），`title` 复用 `indexOptionTitle`。
- `indexes` 尚未到达（`!indexesFetched` 或 `loadState === "loading-indexes"`）：下拉禁用，显示加载态文案（如 `Loading indexes…`）。
- 无用户索引：下拉禁用，显示空态文案（`No user indexes (system schemas excluded)`）。
- 选中一个 B-tree 且 `blocks > 0` 的索引：`selectedIndexOid` 更新，清空当前页 / 选中 / diff / hex 定位（现 `onSelectIndex` 语义），blkno 置 0，并自动 `loadIndexBlk(oid, 0)`（metapage）。
- 选中非 B-tree 索引：`selectedIndexOid` 更新并显示，**不发 page 请求**；Load 禁用，行内 `indexHint`（非 B-tree 提示）保留。
- 选中 `blocks === 0` 的 B-tree 索引：`selectedIndexOid` 更新，blkno 置 0，**不发 page 请求**；沿用现空索引提示。
- 下拉当前值反映 `selectedIndexOid`（含从 Tree 或深链带入的选择）；选中值不在列表中时显示占位。

### 4. 选中语义

- 选择只做「选中 + （可加载时）Load blk 0」；**不**执行 Tree 里「再点已选中节点即收起」的展开/折叠切换。
- 关系切换一律把 blkno 输入置 0（`selectedOid` / `selectedIndexOid` 变化时）。
- 选中后，blkno 输入 + Load / Refresh / Prev / Next 继续按现合同作用于新关系（`canLoad` / `canLoadIndexBlk` / `heapToolbarNav` / `indexToolbarNav` / `indexNavEnabled`）。
- 切换 `Table | Index` 仍走现 `onSwitchRelationKind`：清当前页、按 `indexSelectionSurvives` 决定是否保留索引选择；下拉随之显示当前 kind 的选择。

### 5. 与 Tree / URL 的关系

- 通过下拉选中后，Tree 的展开状态须包含该关系（沿用 `ensureTableExpanded` / `ensureIndexExpanded`），使点 **Tree** 开关回到 Tree 模式时能看到并高亮该选中关系。
- 选择与 Load 仍经现有 URL 同步写入 `mode=page`、`kind`、`table`（页面模式下始终写 `selectedOid`）、`index`（仅 `kind=index`）、`blkno`（Load 成功后）。
- 深链回放：同一 URL 重新加载后恢复同一关系与 blkno；模式（Tree/Single）不在 URL 中，回放仍按现实现默认开 Tree（`setTreeCollapsed(false)`），此行为不变。

## 合同

### API / 接口

N/A（复用现有 `tables` / `indexes` 列表与 heap / index page GET）。

### 数据 / 状态

- `selectedOid`、`selectedIndexOid`、`relationKind`、`blkno`、`loadedBlkno`、`pageView` 语义不变；本项只新增输入入口。
- 关系选择变化：清 `pageView` / `loadedBlkno` / `selectedId` / `highlight` / `prevRaw` / `diffIds` / `hexLocate`，`blkno = 0`，并使 `urlLoaded.blkno = null`（选中即失效旧 blkno，与现选择路径一致）；随后按 §2/§3 自动 Load，成功时再提交 `urlLoaded.blkno = 0` 并入 history。
- 新增的下拉状态（如无）不引入独立 state；直接读写 `selectedOid` / `selectedIndexOid`。
- Tree 展开集合（`expandedTableOids` / `expandedIndexOids`）按 §5 更新，不写 URL。

### 错误与约束

- 不引入新错误码。
- 非 B-tree 索引仍可选、禁止 Load（`canLoadIndex`）。
- `blocks === 0` 关系不自动 Load、不发请求；沿用现空态提示。
- Load 失败：选择保留，走既有 error-panel；下拉不清空。
- 选择期间 `loading-page` 时下拉禁用，避免重复请求。

### 测试合同

- 现 `apps/web/src/treeNavUi.test.ts` 的 `"does not keep table or index dropdowns in App"`（断言 `App.tsx` 不含 `className="table-select"` / `className="index-select"`）与本次合同冲突，必须改写为反映新合同：关系下拉**仅**在 `browseMode === "single"` 内出现，Tree 模式下不出现。此为合同变更，Review / QA 须按新断言验收。
- `README.md` / `README.zh-CN.md` 中「Tree 关闭时无表/索引下拉」的描述须更新为：Tree 关闭时可在次带选择表或索引。

## 验收

> 每条 P0 必须可验证。

### P0

- **P0-1** Given 已连接、Page 模式、Tree 关闭、kind=table，When 看次带，Then 有表下拉且列出 `tables`，可选中；不再出现「只能操作已选关系」的缺口。
- **P0-2** Given P0-1，When 从下拉选一张 `blocks > 0` 的表，Then `selectedOid` 变为该表、blkno 输入为 0、自动加载该表 blk 0、URL 含 `kind=table&table=<oid>&blkno=0`。
- **P0-3** Given P0-2 已加载 blk 0，When 输入另一合法 blkno 并点 Load，Then 加载该表该块（行为与现 Load 一致）。
- **P0-4** Given 已连接、Page 模式、Tree 关闭、kind=index，When 看次带，Then 有索引下拉且列出全部用户索引（不按表过滤），带 access method 与块数标注，非 B-tree 标 `✕`。
- **P0-5** Given P0-4，When 选一个 B-tree 且 `blocks > 0` 的索引，Then `selectedIndexOid` 变为该索引、blkno 输入为 0、自动加载 metapage blk 0，结构图出现。
- **P0-6** Given P0-4，When 选一个非 B-tree 索引，Then 选中但不发 page 请求、Load 禁用、显示非 B-tree 行内提示。
- **P0-7** Given P0-5 已加载某索引页，When 输入另一合法 blkno 并点 Load，Then 加载该索引该块。
- **P0-8** Given single 模式已加载某页，When 分别点 Refresh / Prev / Next，Then 行为与现合同一致（Refresh 走 `{ refresh: true }` 且成功时 diff；Prev/Next 按 heap blk±1 或 B-tree `btpo_prev`/`btpo_next`）。
- **P0-9** Given 通过下拉选表/索引并 Load 成功，When 重新加载同一 URL，Then 恢复同一关系与 blkno。
- **P0-10** Given 通过下拉选中表或索引，When 点 Tree 开关回到 Tree 模式，Then 目录展开到该关系且选中状态可见。
- **P0-11** Given Tree 开启（tree 模式），When 看次带，Then 不渲染表/索引下拉（维持现合同）。
- **P0-12** Given kind=table 且库中无表，When 看下拉，Then 禁用并显示空态文案；Given kind=index 且索引未拉取/为空，Then 分别显示加载态 / `No user indexes (system schemas excluded)`。
- **P0-13** Given kind=table 且选一张 `blocks === 0` 的表，Then 选中、blkno 为 0、不发 page 请求、显示空关系提示；Given kind=index 且选 `blocks === 0` 的 B-tree 索引，Then 同理不发请求并显示空索引提示。

### P1

- 切换 `Table | Index` 后下拉反映当前 kind 的选择；切回 table 时下拉显示 `selectedOid`。
- 从 Tree / 深链带入的 `selectedOid` / `selectedIndexOid` 在 single 模式下下拉能正确回显。
- `loading-page` 期间下拉禁用。
- 长 `qualifiedName` 截断显示，`title` 保留全名。
- README 中英同步更新（见「测试合同」）。

## 开放问题

无。需求明确：single 模式补齐表/索引选择入口。已写入范围、如驳回请改对应条的默认：

- 仅 single 模式出现下拉，Tree 模式保持无下拉。
- 选择即选中并自动 Load blk 0（0 块 / 非 B-tree 除外），blkno 重置为 0。
- Index kind 不设表过滤器，索引列表为全部用户索引。
- 模式（Tree/Single）不进 URL，深链回放仍默认开 Tree。

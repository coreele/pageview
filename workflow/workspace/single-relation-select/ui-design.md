# UI Design: single-relation-select

> 依据 Spec `workflow/workspace/single-relation-select/spec.md`。只记录需要决策的界面与交互事项；行为合同与验收以 Spec 为准。Design 门禁 skipped（单组件内 UI 增补，无模块 / 分层 / 技术选型决策）。

## 背景与范围

`index-tree-nav` + `drop-load-refresh` 之后，选表 / 选索引完全依赖左侧 Tree 目录。Tree 关闭（`pageBrowseMode(btreeTree.collapsed) === "single"`）时次带只剩 `Table | Index` 切换、blkno 输入与 Load / Refresh / Prev / Next，没有关系选择入口；未在 Tree 点过关系或 URL 未带 `table`/`index` 时无法开始。

本项在 single 模式次带的 `.chrome-controls` 内、按 `relationKind` 增补一个关系 `<select>`：table 显示表下拉，index 显示索引下拉。复用既有 `.table-select` / `.index-select` 皮肤与 `indexView.ts` 的索引文案函数；不重做布局、不新增页面。

## 非目标

- 不改 Tree 模式（Tree 亮）的行为与控件；Tree 模式不渲染任何关系下拉。
- 不在 Index 侧引入表过滤器；索引下拉始终列出全部用户索引（与 Tree INDEX 段一致）。
- 不新增 URL / localStorage 参数；不新增 server 端点；不改 B-tree / heap 解析与主区渲染。
- 不重新设计 chrome、主色或 `.chrome-controls` 结构。

## 用户与关键场景

| 角色或场景 | 目标 | 备注 |
|---|---|---|
| 关掉 Tree 后浏览 | 不打开目录也能选一张表并 Load 页 | kind=table |
| 关掉 Tree 后看索引 | 选一个 B-tree 索引直接看 metapage | kind=index，非 B-tree 仍列出但不可 Load |
| 从深链 / Tree 带入选中 | 下拉回显当前关系 | `selectedOid` / `selectedIndexOid` 反映当前值 |
| 切回 Tree | 目录展开到该关系且选中可见 | 依赖 `ensureTableExpanded` / `ensureIndexExpanded` |

## 信息架构与关键界面

single 模式次带（`.meta-controls-row--stack` 内唯一 `.chrome-controls`），单一构图、从左到右：

```text
┌ 次带（Tree 暗）──────────────────────────────────────────────────────┐
│ [Table | Index]  [ relation ▾ ]  [blkno] [Load] [Refresh] [Prev] [Next] │
│  index 侧非 B-tree 时：[ 行内 indexHint，flex 1 1 100% 独占一行 ]        │
└───────────────────────────────────────────────────────────────────────┘
```

- 关系下拉紧跟 kind 开关之后、blkno 之前；即 `kind switch · relation select · blkno · Load · Refresh · Prev/Next`。
- `indexHint`（`nonBtreeHint`，`.index-hint-inline`，`flex: 1 1 100%`）保持在 index 分支内，按现有位置渲染（下拉之后、blkno 之前或其后），自然换行独占一行，不挤压下拉。
- Tree 亮时不渲染该 `.chrome-controls`（现 `{browseMode === "single" && (` 门控），主区与目录不变。

## 关键流程

| 步骤 | 用户动作 | 系统反馈 | 空态 / 加载 / 错误 |
|---|---|---|---|
| 1 | 关掉 Tree（`browseMode==="single"`） | 次带出现 kind 开关与关系下拉 | 列表未到：下拉禁用并显示加载文案 |
| 2 | kind=table，在下拉选表 | 选中该表，blkno 置 0；`blocks>0` 自动 `loadBlk(oid,0)`，`blocks===0` 不发请求 | 空库：`No tables`；0 块：现空关系提示 |
| 3 | kind=index，在下拉选索引 | 选中该索引，blkno 置 0；B-tree 且 `blocks>0` 自动 `loadIndexBlk(oid,0)` | 非 B-tree / 0 块：不发请求，保留行内提示 |
| 4 | 输入 blkno 点 Load / Refresh / Prev / Next | 按现合同作用于新关系 | `loading-page` 期间下拉禁用 |
| 5 | 点 Tree 开关回 Tree 模式 | 目录展开到该关系并高亮 | 选择保留，不重置 |

## 布局与视觉方向

- 构图与层级：关系下拉复用既有 `.table-select`（`max-width: 20rem`）与 `.index-select`（`max-width: 26rem`）皮肤——`var(--surface)` 底、`1px var(--border)` 边、`border-radius: 4px`、`padding: .3rem .4rem`。放在 `.control` 标签内，与 blkno 控件同构（`.control-label` + 控件）。
- 色彩 / 字体 / 氛围：沿用现有 token（`--surface` / `--border` / `--text-muted` / `--danger`），不新增颜色。下拉 `title` 提供全名，不引入 tooltip 组件。
- 明确避开：新主色 / 新皮肤；在 chrome 出现 “Single” 字样；把下拉做成自定义弹层（原生 `<select>` 即可）；改变 `.chrome-controls` 的 `flex-wrap` 结构。

## 组件与交互约定

| 区域或组件 | 约定 | 复用既有系统？ |
|---|---|---|
| Table 下拉 | `<select className="table-select">`；option 文本 `<qualifiedName> (oid <oid> · <blocks> blk)`；option 与 select 的 `title` 为 `qualifiedName` | 是（`.table-select` 皮肤） |
| Table 下拉状态 | `value` 取 `selectedOid`（不在 `tables` 中时回落到占位项）；`!tablesFetched` 或 `loading-tables` 显示 `Loading tables…` 并禁用；`tables` 为空显示 `No tables` 并禁用；`loading-page` 禁用 | 是 |
| Index 下拉 | `<select className="index-select">`；option 文本复用 `formatIndexOption`（非 B-tree 前缀 `✕ `、invalid 后缀 ` · invalid`）；option 与 select 的 `title` 复用 `indexOptionTitle` | 是（`.index-select` 皮肤 + `indexView.ts`） |
| Index 下拉状态 | `value` 取 `selectedIndexOid`（不在 `indexes` 中时回落占位项）；`!indexesFetched` 或 `loading-indexes` 显示 `Loading indexes…` 并禁用；空列表显示 `No user indexes (system schemas excluded)` 并禁用；`loading-page` 禁用 | 是 |
| 选中处理 | onChange 调 `onSelectTable` / `onSelectIndex` 语义 + 可加载时 `loadBlk(oid,0)` / `loadIndexBlk(oid,0)`；**不**触发 Tree 的「再点已选节点即收起」；每次选择 `setBlkno(0)` | 复用现处理函数 |
| 截断 | 长 `qualifiedName` 由 `<select>` 原生截断；`title` 保留全名（table = `qualifiedName`，index = `indexOptionTitle`） | 是 |
| 列表来源 | Table 用 `tables`；Index 用完整 `indexes`，**不**按表过滤、**不**调用 `tableFilterOptions` / `filterIndexesByTable` / `tablesWithIndexes` | 是 |

## 响应式与无障碍

| 项 | 约定 |
|---|---|
| 断点 / 适配 | `.chrome-controls` 已 `flex-wrap: wrap`；窄宽下关系下拉与 blkno / 按钮自然换行，`max-width` 限制长名不撑破。沿用既有 `<960` 行为，不新增断点 |
| 键盘 / 焦点 | 原生 `<select>` 可 Tab 聚焦、方向键选择、Enter/空格展开；焦点环沿用全局。顺序为 kind 开关 → 关系下拉 → blkno → Load → Refresh → Prev/Next |
| 语义 / 对比度 | 用 `<label className="control"><span className="control-label">table|index</span><select…></label>` 关联标签与控件；沿用 token，light/dark 对比度不变。禁用态用原生 `disabled`，不另造 `aria-disabled` |
| 门控 | 下拉**仅**在 `browseMode === "single"` 内渲染；Tree 模式 DOM 中不出现 `table-select` / `index-select` |

## 开放问题

N/A。Spec 开放问题为空，默认项见 Spec「开放问题」。

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| 选中值不在列表（深链 oid 未到 / 已被删）时受控 `<select>` 无匹配项而空白 | 用户看不出当前关系 | 始终渲染 `value=""` 占位项，`value` 仅在 oid 命中列表时取该 oid |
| `blocks===0` 表当前 `onSelectTable` 不置 blkno | 与 Spec「一律置 0」不符 | 选择处理里先 `setBlkno(0)` 再走选择分支 |
| 关系下拉与 `loading-page` 并发触发 | 重复请求 | 选择期间 `disabled`，处理函数再判 `loadState==="loading-page"` 直接返回 |
| 旧断言 `treeNavUi.test.ts` 与新合同冲突 | 测试红 | 按 Spec「测试合同」改写为「仅 single 模式出现」 |

## 对 Plan 与 Developer 的要点

### Plan

- 抽出可测纯函数：table option 文案（`<qualifiedName> (oid <oid> · <blocks> blk)`）与「是否自动 Load」（`blocks > 0`，index 叠加 `canLoadIndex`），单测覆盖 P0-2 / P0-5 / P0-13 的门禁分支。
- `treeNavUi.test.ts` 的 `index-tree-nav chrome (P0-3)` 改为断言两个下拉**仅**在 `browseMode === "single"` 内出现；`index-tree-nav catalog (P0-2)` 的 `not.toMatch(/filterIndexesByTable/)` 必须保持通过。
- README 中英同步更新「Tree 暗时不加回下拉」的描述。

### Developer

- 在 `{browseMode === "single" && (` 的 `.chrome-controls` 内、`relationKind` 两分支各自的 blkno `<label>` 之前插入下拉；不改 Tree 模式分支。
- 复用 `onSelectTable` / `onSelectIndex` / `ensureTableExpanded` / `ensureIndexExpanded` / `loadBlk` / `loadIndexBlk`，不新增独立 state；`indexHint` 保持现有渲染。
- 复用 `.table-select` / `.index-select` 现有 CSS；仅在换行确实需要时微调，不新增皮肤。

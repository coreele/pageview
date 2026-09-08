# Spec: index-tree-nav

> 需求与行为合同，先于 Plan 完成。任务拆分见同目录 `plan.md`。
>
> **feature-id**：`index-tree-nav`
>
> **确认记录**：路径 `standard`；Spec 用户确认 **approved**（2026-09-08「ok」）。2026-09-08 用户修订：index 段始终列出全部用户索引，不再按选中表过滤。其余默认：点 B-tree 索引 Load blk 0、两段在两种 kind 都显示、去掉 Index 次带两个下拉、段折叠不进 URL。

## 背景与目标

Table 模式已把选表放进左侧导航（表 → 堆块），次带表下拉已去掉。Index 模式仍用次带「表过滤器 + 索引下拉」，且 Tree 只在 Load 过 B-tree 页之后出现。用户要求导航列做成两段：**table** 与 **index**，各自有最大高度，且可以整段收起。

目标：

1. Page 模式左侧导航同时有 **table**、**index** 两段目录；点段标题可完全折叠；展开时内容区有最大高度，超出滚动。
2. Index 选索引走 index 段（与选表走 table 段对称）；次带去掉表过滤器与索引 `<select>`。
3. 连库后、尚未 Load 索引页时就能打开并使用该导航（否则拿掉下拉会选不了索引）。
4. 选中 B-tree 索引后，该索引节点下仍是现有 B-tree 拓扑（不是堆块那种连续 blk 列表）。

## 非目标

- 去掉 `Table | Index` 分段
- 去掉次带 `blkno` / Load / Refresh / Prev / Next
- 树内搜索 / 过滤框
- 把非 B-tree 索引页解析进结构图
- 一次画出整棵超大 B-tree（仍用现有按需展开 / 缓存）
- 段折叠或 index 展开写入 URL / localStorage
- 新 server 端点；改 `/api/indexes` 载荷形状
- WAL 变更
- 改 table 段点表 / 点堆块的既有合同（table-tree-nav）

## 范围与可见行为

### 1. 何时出现 Tree

- Page 模式 + 已连接：kind 为 **table 或 index** 时，chrome **Tree** 开关在尚未 Load 页时也出现。
- 两种 kind 下该情境默认 **开**。用户可关掉；关掉后选表/选索引都只剩 Tree 开关，没有下拉回退。
- 从 Table 切到 Index、从 Index 切回 Table：目录两段都在；不因切 kind 把 Tree 默认关回去。
- WAL：无 Tree。

### 2. 两段目录

```text
TABLE                         ← 段标题（大写加粗，点此整段收起/展开）
  items
    blk 0
INDEX                         ← 段标题
  tb_pkey
    blk 0  meta
```

- **table 段**：内容与现在 Table 目录树相同（表节点顺序、块窗口、点表/点箭头/点块）。可见文案为关系名（不含 schema）；`title` 为 `qualifiedName`。
- **index 段**：列出全部用户索引（见 §3）。可见文案为索引名（不含 schema）。B-tree 行不标 access method（元信息区已有）。非 B-tree 标 access method，invalid 仍可标出。不在树行上重复块数。`title` 为 `qualifiedName`（非 B-tree / invalid 的 title 语义与现 `indexOptionTitle` 一致）。
- 两段**同时存在**于 Table kind 与 Index kind，不因当前 kind 藏掉另一段。
- 段标题 **TABLE** / **INDEX**：大写、加粗，形如独立分区头；两段之间有分隔。

### 3. Index 列表

- index 段始终列出全部用户索引；不按选中表过滤。未选表也可以直接点索引。
- 点 table 段里的表：仍按 table-tree-nav 选中该表（并按规则 Load 堆页）；index 段内容与选中索引都不因换表而收缩或清空。
- 无用户索引：index 段空态（现「No user indexes…」类文案），段标题仍在、可折叠。

### 4. 点击索引

- **点索引名**：选中该索引并切到 **Index** kind（若尚未在 Index）。
  - B-tree 且尚未在看该索引页：展开并 **Load blk 0**（metapage）。
  - 非 B-tree：选中、不发 page 请求；主区沿用现非 B-tree 提示。
  - `blocks === 0` 的 B-tree：选中、不发 page 请求；主区给空索引提示。
  - 已选中且子树已展开时再点索引名：**收起**（不 Load、不取消选中）。已选中但已收起时再点则只展开。
- **点箭头**：只展开/收起该索引的 B-tree 子树，不 Load、不切 kind。
- **点 B-tree 页行**：Load 该索引页（已是当前块则不重复请求）。保持 Index kind。
- Load 失败：选中索引保留；错误走既有 error-panel；其余节点仍可点。

点 table 段表名/块时：切到 **Table** kind（若还在 Index），行为仍是 table-tree-nav。

### 5. 段折叠与最大高度

- 点 **table** / **index** 段标题：只折叠或展开该段的内容；另一段不动。折叠后该段只剩标题一行。
- 允许两段同时折叠（导航里只剩两个标题）。
- 展开时每段内容区有 **最大高度**（相对树面板，两段各自封顶，互不把对方挤出视口）；超出在该段内滚动。折叠态不受 max-height 约束。
- 段折叠默认：两段都展开。不写入 URL / localStorage。chrome Tree 关掉是整列消失，与段折叠独立。

### 6. 次带

- Index 模式**去掉** `table` 过滤器与 `index` `<select>`。
- 保留 blkno、Load、Refresh、Prev/Next、非 B-tree 行内提示。未选索引时这些控件保持不可用（与现在未选索引一致）。
- 元信息区若已有索引名/oid，可保留（不是选索引入口）。
- Table 模式次带不把索引下拉加回去。

### 7. 无页时的主区

- 已连库、导航开着、尚未 Load 成功页：左侧两段目录 + 右侧既有提示（未选表 / 空表 / 未选索引 / 空索引 / 非 B-tree / 选索引后等待 Load）。点 B-tree 索引会自动 Load blk 0，故「请按 Load」主要出现在用户关掉自动路径、非 B-tree、或失败之后。
- 未开 Tree 且未 Load：主区提示用 Tree 选表或选索引。

### 8. 索引列表何时拉取

- 连库成功后即拉取 `/api/indexes`（不必先点 Index 分段），以便 Table kind 下 index 段有数据。
- 失败：既有 error-panel；table 段仍可用。

### 9. URL

- 不新增参数。点索引 + Load 仍写入现有 `kind=index`、`table=<oid>`、`index=<oid>`、`blkno`。
- 深链进 Index：表/索引列表到达后选中 URL 中的表与索引；有 blkno 则 Load。导航应展开 index 段与该索引节点。
- 深链进 Table：行为仍是 table-tree-nav；index 段仍列出全部索引，默认展开。
- 深链 `kind=index`：按 `index=` 选中并 Load（若可 Load）；`table=` 只恢复 table 段选中，不作为索引进口过滤器。列表里存在的 B-tree 即使所属表与 `table=` 不一致也 Load。

## 合同

### API / 接口

N/A（继续用现有 tables 列表、indexes 列表、heap / index page GET）。

### 数据 / 状态

- `selectedOid`、`selectedIndexOid`、`loadedBlkno`、`pageView` 语义不变。
- 切 kind 仍清当前页 / diff / hex 定位（与现 `onSwitchRelationKind` 同类），然后按上面规则自动 Load。
- 段折叠与 chrome Tree 折叠是两套状态；都不进 URL。

### 错误与约束

- 不引入新错误码。
- 非 B-tree 仍可选、禁止 Load（现 `canLoadIndex`）。
- B-tree 展开/缓存仍按索引 oid 分片（现 `slices`）。

## 验收

### P0

- **P0-1** Given 已连接且 kind=table、尚未 Load 页，When 看导航，Then Tree 默认开，可见 **table** 与 **index** 两段标题；table 段列出 tables。
- **P0-2** Given 已连接且库中有多表的索引，When 选中其中一张表，Then index 段仍列出全部用户索引（含其他表的）。
- **P0-3** Given Index 模式次带，When 扫控件，Then 无表过滤器、无索引 `<select>`；blkno / Load 仍在。
- **P0-4** Given 导航中一个 B-tree 索引，When 点索引名，Then kind 变为 index、选中该索引并 Load blk 0，结构图出现。
- **P0-5** Given 一个非 B-tree 索引，When 点索引名，Then 选中、不发 page 请求，主区非 B-tree 提示。
- **P0-6** Given 两段都展开，When 点 **index** 段标题，Then index 段内容全部隐藏、只剩标题；table 段不变。再点标题则展开。table 段标题同样可完全折叠。
- **P0-7** Given kind=index 且尚未 Load 页，When 看 chrome，Then Tree 开关可见且默认开（不再要求先有 btree 页）。
- **P0-8** Given Index 模式 URL 含 table、index 与 blkno，When 深链恢复，Then 选中该表与索引、Load 该块、index 段与该索引节点展开。

### P1

- 展开的段内容超出 max-height 时在该段内滚动，不把另一段顶出树面板。
- 已展开的当前索引再点索引名即收起。
- 选表后 index 段仍列出全部用户索引。
- 长 `qualifiedName` 截断 + title 全名。

## 开放问题

N/A（下列默认已写入范围；若驳回请改对应条）：

- index 段始终列出全部用户索引，不按选中表过滤。
- 点 B-tree 索引自动 Load blk 0；子树仍是 B-tree 拓扑。
- 两段在 Table / Index kind 都显示。
- 去掉 Index 次带两个下拉。
- 段折叠不进 URL。

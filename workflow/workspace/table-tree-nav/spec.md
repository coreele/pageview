# Spec: table-tree-nav

> 需求与行为合同，先于 Plan 完成。任务拆分见同目录 `plan.md`。
>
> **feature-id**：`table-tree-nav`
>
> **确认记录**：路径 `standard`；Spec 用户确认 **approved**（2026-09-08「ok」）。用户已同意范围（「可以，从 table 模式开始」）及默认开树、点表 Load blk 0。

## 背景与目标

Page 模式 Table 侧用次带 `<select>` 选表，左侧 Tree 只在**已 Load 堆页之后**出现，且只列当前表的块号。有了导航列之后，选表也应走同一列，下拉可以去掉。

目标：

1. Table 模式：导航是「表 → 块」。点表选中并进入该表；点块 Load 该堆页。
2. 连库后、尚未 Load 时就能打开并使用该导航（否则拿掉下拉会选不了表）。
3. Index 模式保持现状：表过滤器 + 索引下拉；树仍是当前索引的 B-tree，且仍在 Load 索引页之后出现。

## 非目标

- Index 模式把索引或表放进树；拿掉 Index 侧两个下拉
- 去掉 `Table | Index` 分段
- 去掉次带 `blkno` / Load / Refresh / Prev / Next（跳号与刷新仍走次带）
- 树内搜索 / 过滤框
- 一次列出超大表的全部块（仍用现有约 2000 行窗口）
- 树折叠态写入 URL
- 新 server 端点；改 `/api/tables` 载荷形状
- WAL 变更

## 范围与可见行为

### 1. 何时出现 Tree

- Page 模式 + 已连接 + **Table** kind：chrome **Tree** 开关在**尚未 Load 页**时也出现。
- 该情境默认 **开**（面板挂载）。用户可关掉；关掉后仍靠 Tree 开关打开，没有第二个选表入口。
- 切到 Index：行为回到现状（有索引页才出 Tree，默认关）。再切回 Table：恢复 Table 侧规则（默认开，目录树）。
- WAL：无 Tree。

### 2. 目录树长什么样

```text
schema.table          [N blk]     ← 表节点
  blk 0
  blk 1                           ← 当前堆页时高亮
```

- 表节点顺序 = 现有 tables 列表顺序；文案 `qualifiedName`，块数作次要标记。列窄则截断，`title` 为全名。
- 未选表：表节点全部收起（或仅列出、都不展开块）。已选表：该表展开，块列表规则与现在 `visibleHeapBlockList` 相同（含大表窗口与范围提示）。
- 当前表高亮；已 Load 时当前 blk 高亮。
- 0 block 的表仍列出，无块子节点。

### 3. 点击

- **点表名**：选中该表（`selectedOid`）。`blocks > 0` 时 **Load blk 0**（已是该表 blk 0 则不重复请求）。`blocks === 0` 时不请求页，主区提示空表（与现文案同类）。
- **点箭头**：只展开/收起块列表，不 Load。
- **点块号**：Load 该块（已是当前块则不重复请求）。不改 `relationKind`。
- Load 失败：选中表保留；错误走既有 error-panel；其余节点仍可点。

### 4. 次带

- Table 模式**去掉** `table` 下拉。
- 保留 blkno、Load、Refresh、Prev/Next。未选表时这些控件保持不可用（与现在未选表一致）。
- 元信息区若已有表名/oid，可保留（不是选表入口）。

### 5. 无页时的主区

- 已连库、Table 模式、导航开着、尚未 Load 成功页：左侧目录树 + 右侧既有提示（未选表 / 空表 / 选表后等待 Load——但点表会自动 Load blk 0，故「请按 Load」只在用户关掉自动路径或失败后出现）。
- 未开 Tree 且未 Load：主区提示用 Tree 选表（因下拉已删除）。

### 6. URL

- 不新增参数。点表 + Load 仍写入现有 `kind=table`、`table=<oid>`、`blkno`。
- 深链进 Table：表列表到达后选中 URL 中的表；有 blkno 则 Load。导航应展开该表。

## 合同

### API / 接口

N/A（继续用现有 tables 列表与 heap page GET）。

### 数据 / 状态

- `selectedOid`、`loadedBlkno`、`pageView` 语义不变。
- Table 模式树折叠默认：连库后为展开；不写入 URL / localStorage。
- 换表仍清当前页 / diff / hex 定位（与现 `onSelectTable` 同类），然后按上面规则 Load blk 0。

### 错误与约束

- 无用户表：树空态（现「no user heap tables」类文案），无下拉可回退。
- 块窗口过大：沿用 `HEAP_BLOCK_LIST_CAP` 与范围提示。
- 不引入新错误码。

## 验收

### P0

- **P0-1** Given 已连接且 kind=table、尚未 Load 页，When 看 chrome，Then Tree 开关可见且默认开，导航列出 tables。
- **P0-2** Given Table 模式次带，When 扫控件，Then 无 `table` `<select>`；Index 模式两个下拉仍在。
- **P0-3** Given 导航中一张 `blocks > 0` 的表，When 点表名，Then 选中该表并 Load blk 0，结构图出现。
- **P0-4** Given 一张 `blocks === 0` 的表，When 点表名，Then 选中、不发 page 请求，主区空表提示。
- **P0-5** Given 已展开的表，When 点某一 blk，Then Load 该堆页；点 expander 只展开不 Load。
- **P0-6** Given kind=index 且尚未 Load 索引页，When 看 chrome，Then 无 Tree 开关（与现状一致）；Load 后树仍为 B-tree 拓扑。
- **P0-7** Given Table 模式 URL 含 table 与 blkno，When 深链恢复，Then 选中该表、Load 该块、导航展开该表。

### P1

- 长 `qualifiedName` 截断 + title 全名。
- 用户关掉 Tree 后再打开，仍是目录树而非空块列表。

## 开放问题

N/A（默认开树、点表 Load blk 0 已写入范围；若驳回请改这两条）。

# Spec: next-page-btn

> 需求与规格（Plan 之前完成）。任务拆解见后续同目录 `plan.md`。
>
> **feature-id**：`next-page-btn` · **sub-feature-id**：`next-page-btn`（未拆分）
>
> **确认门禁**：路径 `standard`；Spec 用户确认 **approved**（2026-09-01）。开放问题 none。
>
> **适用对象**：Page 模式使用者（heap / B-tree 索引页）。**前置条件**：已连接；已选关系；已 Load 当前页。**操作步骤**：用 Prev / Next 翻页；对照选择列表下方的 page 统计。**预期结果**：见按钮语义、禁用与布局合同及 P0。**失败处理**：边界页禁用按钮，不发越界请求；加载失败沿用既有错误面板。
>
> **前序基线**：`layout-chrome-split`（次带：选择器 + blkno + Load + Refresh；`meta-stats` 于页加载后出现）、`index-viewer`（索引工具栏与 `siblingNav` / 详情区 `← Load blk N`）。本项**不废止**详情区兄弟导航。
>
> **Design 门禁**：`skipped`。无模块边界/分层/选型；复用 `loadBlk` / `loadIndexBlk` 与 `siblingNav`。

## 已确认决策

| # | 裁决 |
|---|---|
| 1 | heap 与 index 工具栏都加 **Prev** 与 **Next** |
| 2 | heap：已显示页 `blkno ± 1`。btree：`btpo_prev` / `btpo_next`，**不是**关系顺序块号 |
| 3 | 无上一/下一页时禁用，**不**发请求、**不**走 `BLKNO_OUT_OF_RANGE` |
| 4 | 启用同 Refresh：须已加载当前页 |
| 5 | heap page 统计条参考 index，在选择列表**下方**（宽屏也不得与表下拉并排） |

## 背景与目标

工具栏仅 Load / Refresh 与手动 `blkno`。Heap 邻页是顺序块；B-tree 邻页是 opaque 兄弟，块号可跳。要在 Refresh 右侧翻页，并把 heap 统计条放到选择列表下。

## 非目标

- 改 `loadBlk` / `loadIndexBlk` 的 Refresh diff、错误码、schema 拉取
- 改详情区 `btpo_prev` / `btpo_next` 的 `← Load blk N` 按钮（保留）
- HeapPeek 浮层增加 Prev/Next（基线：浮层无 Load/Refresh）
- WAL 模式工具栏
- 自动刷新表/索引的 `#blocks` 列表
- 新主题开关、新键盘快捷键（blkno 上 Enter 仍只触发 Load）
- 改结构图 / hex / 解码

## 范围与可见行为

### 按钮位置与样式

Page 模式、`relationKind` 为 table 与 index 时，在对应 **Refresh 右侧**增加两个按钮，顺序：

`Load` · `Refresh` · **Prev** · **Next**

文案为 `Prev` / `Next`。样式对齐 Refresh（非 primary）。`title`：可点时为目标 blk（如 `blk 3`）；禁用时 heap 为 `first block` / `last block`，btree 为 `leftmost` / `rightmost`（与 `siblingNav` 注释一致）。

### 启用（与 Refresh 对齐）

两边均须：已成功加载当前模式的页（heap：`heapPage`；index：`btreePage`）、`loadState !== loading-page`、当前关系 oid 非空。

未 Load、换表/换索引清页、加载中：Prev 与 Next 均禁用。

### Heap 目标页

以**当前显示页**的块号为准（最后一次成功 Load / Refresh / Prev / Next 写入的 blk），**不**用未提交的 blkno 输入框脏值。

| 按钮 | 可点当且仅当 | 点击 |
|---|---|---|
| Prev | 显示 blkno `> 0` | Load `blkno - 1`（非 refresh） |
| Next | 显示 blkno `< selectedTable.blocks - 1` | Load `blkno + 1`（非 refresh） |

`blocks === 0` 或尚未有显示页：保持禁用。点击后更新 blkno 输入为新块号；选中/高亮/diff 按既有非 refresh Load（清空 diff 与选中）。

### B-tree 目标页

以当前显示页 `special` 的 `siblingNav` 为准（`P_NONE` → 无兄弟）。

| 按钮 | 可点当且仅当 | 点击 |
|---|---|---|
| Prev | `siblingNav.prev != null` | `loadIndexBlk(oid, prev)`（非 refresh） |
| Next | `siblingNav.next != null` | `loadIndexBlk(oid, next)`（非 refresh） |

`special` 不可读（无 opaque）：Prev 与 Next 均禁用。Metapage / 最左 / 最右叶：无兄弟则禁用，即使关系内还有其他块号。

禁止用 `blkno ± 1` 作为 btree 工具栏翻页。禁用按钮为 native `disabled`（点击无操作）。

### Heap page 统计布局

`.meta-stats`（table / #blocks / blkno / page / lower/upper/free / ItemId / #tup 等既有字段）必须出现在 **chrome 选择与操作行之下**，与 index 的统计条同一纵向层级。

宽屏下 **禁止** heap 统计条与 table 下拉（或 Load/Refresh/Prev/Next）左右并排。统计字段集合不因本项增删。Index 统计条位置保持「控件行下」；允许与 heap 共用同一堆叠规则。

未加载页：不渲染该统计条（基线）。

## 合同

### API / 接口

| 项 | 合同 |
|---|---|
| HTTP | 不新增端点；翻页走既有 `/api/tables/:oid/pages/:blkno` 与 `/api/indexes/:oid/pages/:blkno` |
| `siblingNav` | btree 工具栏 Prev/Next 的目标与禁用与该函数一致 |
| 公开导出 | 不因本项新增必导出符号 |

### 数据 / 状态

| 概念 | 合同 |
|---|---|
| 显示页块号 | 成功 Load 后的 `blkno`；Prev/Next 以它为基准 |
| 翻页 Load | 等价于对该目标 blk 的非 refresh Load（清 diff、清选中、更新 `pageView`） |
| Refresh | 语义不变；仍刷新**输入框**中的 blkno |

### 错误与约束

| 约束 | 说明 |
|---|---|
| 越界 | 工具栏 Prev/Next **禁止**在已知无上一/下一页时发请求 |
| 详情导航 | 保留；与工具栏并存 |
| HeapPeek / WAL | 不出现这两枚按钮 |

## 验收（Given-When-Then）

### P0

- **P0-1 两处都有按钮**  
  Given Page 模式 table 工具栏与 index 工具栏，  
  When 查看 Refresh 右侧，  
  Then 均可见 Prev、Next，且顺序为 Refresh → Prev → Next。

- **P0-2 未加载则禁用**  
  Given 已选表或索引但尚未成功 Load（或加载中），  
  When 查看 Prev/Next，  
  Then 二者均 `disabled`（与 Refresh 同时不可用或 Refresh 因无页而禁用）。

- **P0-3 heap 顺序翻页**  
  Given 已加载 heap `blkno = k` 且 `0 < k < blocks-1`，  
  When 点 Next 再点 Prev，  
  Then 先后 Load `k+1` 与回到 `k`；请求块号为顺序 ±1，不是 opaque 兄弟。

- **P0-4 heap 首页/末页禁用**  
  Given 已加载 heap `blkno = 0`，  
  When 查看按钮，Then Prev `disabled`、Next 在 `blocks > 1` 时可点。  
  Given 已加载 `blkno = blocks-1` 且 `blocks ≥ 1`，  
  When 查看按钮，Then Next `disabled`；`blocks > 1` 时 Prev 可点。  
  禁用时不发出 page 请求。

- **P0-5 btree 按兄弟翻页**  
  Given 已加载 B-tree 叶（或内）页，`btpo_next = N ≠ P_NONE`、`btpo_prev = P`，  
  When 点 Next，Then Load 索引块 `N`（即使 `N ≠ 当前 blkno+1`）。  
  When 再点 Prev（若 `P ≠ P_NONE`），Then Load 块 `P`。

- **P0-6 btree 无兄弟禁用**  
  Given 已加载页 `siblingNav.next == null`（rightmost / metapage 等），  
  When 查看 Next，Then `disabled`，不发请求。  
  Prev 在 `prev == null` 时同理。`special` 缺失时两键均禁用。

- **P0-7 翻页是 Load 不是 Refresh**  
  Given 已加载页且存在可点的 Next，  
  When 点 Next，  
  Then 走非 refresh Load：新页替换视图；不把本跳转当作 Refresh diff。

- **P0-8 heap 统计在选择列表下方**  
  Given 已加载 heap 页、视口宽到足以让控件与统计并排，  
  When 查看次带，  
  Then page 统计条在 table 选择列表（及同排的 blkno/Load/Refresh/Prev/Next）**之下**，不在表下拉右侧。

### P1

- **P1-1 脏输入不影响目标**  
  Given 已加载 heap 页 `k`，用户把 blkno 输入改成其他值但未 Load，  
  When 点 Next（若可点），  
  Then 目标为 `k+1`，不是输入值 +1。

- **P1-2 详情区兄弟按钮仍在**  
  Given 已加载带 `btpo_next` 的索引页并选中 special，  
  When 查看详情，  
  Then 仍有既有 `Load blk N →`；工具栏 Next 与之目标相同（同一 `siblingNav.next`）。

- **P1-3 禁用 title**  
  Given 首页 / 末页或 leftmost / rightmost，  
  When 悬停禁用的 Prev/Next，  
  Then heap 为 `first block` / `last block`，btree 为 `leftmost` / `rightmost`。

- **P1-4 回归**  
  Given 已加载 heap 或 btree 页，  
  When 仅 Load / Refresh / 换表 / 切 WAL，  
  Then 既有行为不变；HeapPeek 无 Prev/Next。

## 开放问题

none

# Spec: column-align-pad

> 需求与规格（Plan 之前完成）。任务拆解见后续同目录 `plan.md`。
>
> **feature-id**：`column-align-pad` · **sub-feature-id**：`column-align-pad`（未拆分）
>
> **确认门禁**：路径 `standard`；Spec 用户确认 **approved**（2026-09-01）。裁决：padding **留空**；列尾至 `dataRange.end` 与列间同一规则（不并入列）；**不加**图例 `pad` chip。
>
> **适用对象**：结构图使用者（对照 heap 列字节）。**前置条件**：已加载含已解码列的 heap 页。**操作步骤**：打开结构图，对照列格宽度与 hex。**预期结果**：见列 range / 空洞合同及 P0。**失败处理**：无列信息时仍显示整体 `data`；解析失败呈现不变。
>
> **前序基线**：`pd-flags-tuple-view`（单 lane、禁止重叠 `data`/`data-gap-*`）、`page-diagram-32b`。本项**废止**该基线 P0-4「列前 padding 折叠进下一列」；其余基线语义保留，除非本文件显式修订。
>
> **Design 门禁**：`skipped`。无模块边界/分层/选型；复用 `deriveStructureFields` 与单 lane CSS grid。

## 背景与目标

`pd-flags-tuple-view` 为避免同 32B 行出现第二行 `data`，把列间 MAXALIGN padding 折进下一列的**视觉** `range.start`。解码 `columns[].range` 仍正确，但结构图上固定宽度列看起来变长。

活库 `public.items`（`id int4`、`name text`、`price float4`）页 0：`price` 恒 4 字节，但 apple（`name` 5 字符、前导 pad 2B）的 `price` 格为 6B，banana（6 字符、pad 1B）为 5B。

目标：列格只覆盖该列解码字节；空洞不标列名/列值、不生成独立 pad 字段。

## 非目标

- 改 `parsePage`、列解码、`attalign` 算法、ItemId / tuple header 语义
- 回退单 lane，或再生成 `pad-*`、与列格重叠的 `data` / `data-gap-*`
- 图例增加 `pad` chip
- 改 infomask / pd_flags 位带、ItemId 三分格、hex 折叠、Refresh diff
- WAL / 索引页结构图
- 新主题开关；不新增 `StructureFieldRegion`

## 范围与可见行为

### 废止折叠

有已解码列（`columns` 中存在 `range.end > range.start`）时：

- 列字段 `tuple-{itemIndex}.col-{attnum}` 的 `range` **等于**该列解码 `range`（`start`/`end` 均不得前伸或后延）
- **禁止** `visualStart = min(col.start, prevEnd)` 及任何把空洞并入列格的规则

### Padding 呈现（已确认：留空）

同一 tuple 的 `dataRange` 内，未被任何列字段覆盖的字节空洞（长度 ≥ 1）**不生成字段**：

- 来源：首列前（`dataRange.start` → 首列 `start`）、列与列之间、**末列 `end` → `dataRange.end`**
- 结构图对应 CSS grid 列为空白（页背景），不是列格、不是 free 带（free 仍仅 `[pd_lower, pd_upper)`）
- **禁止** `tuple-*.pad-*`、`data-gap-*`、以及把这些字节画进任一 `col-*`

0 字节间隙无额外行为。NULL / dropped 且无存储的列不占字节；其后非空列的对齐空洞仍留空，不得并入该非空列。

无有效列字段且 `dataRange` 非空：仍只生成整体 `data`（基线），覆盖完整 `dataRange`。

### 选中与 hex

选中列字段：高亮 = 该列解码字节，不含前后空洞。

`resolveFieldAt(offset)` / `findStructureAt`：offset 落在上述空洞内时 **不命中任何 `col-*`**，返回 `null`。Hex 点击未映射字节保持既有行为（单字节 `byte-N`），不得改选相邻列。

### 布局

- 单 lane、`grid-row: 1` 保留
- 有列字段的 tuple：**禁止** id 以 `.data` 开头的字段
- 禁止再引入 `.structure-row-lanes` 或多 lane；空白列不得堆出第二行 `data`

## 合同

### API / 接口

| 项 | 合同 |
|---|---|
| `deriveStructureFields` | 列字段 range = 解码 range；不生成 `pad-*` / `data-gap-*` |
| 公开导出 | 不要求新增导出；不删除既有导出 |
| `StructureFieldRegion` | 不新增枚举值 |

### 数据 / 状态

| 概念 | 合同 |
|---|---|
| 列解码 | `DecodedColumn.range` 语义不变 |
| 列视觉 range | 与解码 range 同一 `[start, end)` |
| 空洞 | `dataRange` 内非列字节无结构字段；含列尾至 `dataRange.end` |
| 字段单调 | 同一 tuple 内列按 `start` 升序；列与列之间允许 gap |

### 错误与约束

| 约束 | 说明 |
|---|---|
| 解析边界 | **禁止**为布局修改 `parsePage` / `decodeTupleColumns` |
| 布局边界 | **禁止**多 lane、重叠 `data`/`data-gap-*`/`pad-*`、把空洞标成列名/列值 |
| 无列 | 无有效列时整体 `data` 行为保留 |
| 图例 | **禁止**新增 `pad` chip |

## 验收（Given-When-Then）

### P0

- **P0-1 列 range 等于解码**  
  Given 含相邻列间 MAXALIGN padding 的已解码 tuple，  
  When `deriveStructureFields`，  
  Then 每个 `col-{attnum}` 的 `range` 与对应 `columns[].range` 的 `start`/`end` 全等。

- **P0-2 固定宽度列视觉宽度一致**  
  Given `items` 类布局：`int4` + 变长 `text` + `float4`，两行 `name` 长度不同且 `price` 均非 NULL，  
  When 比较两行 price 的 `col-*` span，  
  Then 两者均为 4 字节。

- **P0-3 空洞无字段**  
  Given P0-1 同一 tuple（含列尾至 `dataRange.end` 若有空档），  
  When 列出该 tuple 结构字段，  
  Then 每个 ≥1B 空洞（首前 / 列间 / 列尾）不被任何 `col-*`、`pad-*`、`.data*` 覆盖；不存在 `pad-*`。

- **P0-4 选中列不含空洞**  
  Given 已渲染且某列前存在空洞，  
  When 选中该列字段，  
  Then 结构图与 hex 高亮区间等于该列解码 range。

- **P0-5 空洞不命中列**  
  Given 同上，空洞内偏移 `off`，  
  When `resolveFieldAt(page, off)`（及 web `findStructureAt`），  
  Then 返回 `null`（或不含该 tuple 的 `col-*`）；不得返回下一列/上一列。

- **P0-6 无重叠 data、单 lane**  
  Given 含列信息的 tuple，  
  When `deriveStructureFields` 与 `groupSegmentsIntoLanes`，  
  Then 不存在 id 以 `.data` 开头的字段；恒单一 lane；同行 cell `grid-row: 1`，无第二行 `data`。

- **P0-7 无列保留整体 data**  
  Given 无有效列字段且 `dataRange` 非空的 tuple，  
  When `deriveStructureFields`，  
  Then 仍存在整体 `data` 字段覆盖完整 `dataRange`。

### P1

- **P1-1 NULL 不吞对齐空洞**  
  Given 某列 NULL（无存储）、其后非空列前存在对齐空洞，  
  When 生成字段，  
  Then 该非空列 `range.start` 仍为解码起点（空洞未并入）。

- **P1-2 空洞观感**  
  Given light 与 dark，  
  When 查看列间/列尾空洞，  
  Then 为结构图底色空隙，不是 free 带，无第二行 `data`。

- **P1-3 回归**  
  Given 已加载 heap 页，  
  When 选中 header / ItemId / infomask / 列值，  
  Then 选中↔hex、列值文本、单 lane、pd_flags/infomask 位带与基线一致。

## 开放问题

none（2026-09-01 已确认：1=a 留空；2=是，列尾空洞不并入末列；3=否，无 pad 图例。）

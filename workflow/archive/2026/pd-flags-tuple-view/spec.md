# Spec: pd-flags-tuple-view

> 需求与规格（Plan 之前完成）。任务拆解见后续同目录 `plan.md`。
>
> **feature-id**：`pd-flags-tuple-view` · **sub-feature-id**：`pd-flags-tuple-view`（未拆分）
>
> **确认门禁**：路径 `standard`；Spec 用户确认 **not-required**（无业务歧义；用户在登记时已明确意图：tuple 可视化优化 + pd_flags 显示优化）。
>
> **前序基线**：`infomask-detail`（位格条交互合同）、`layout-chrome-split`、`page-diagram-32b`（32B 物理行网格）。本项在其上增量修订；既有合同**语义保留**，除非本文件显式修订。
>
> **Design 门禁**：`skipped`。无模块边界/分层/选型决策；复用既有 `InfomaskBitStrip` 组件与 CSS grid 模式。

## 背景与目标

现状两个痛点：

1. 页头 `pd_flags` 仅有 hex 数值，选中后无位级解释（`t_infomask`/`t_infomask2` 已有位格条，交互断层）。
2. tuple 区域结构图：列间 MAXALIGN padding 由独立 `data-gap-*` 字段呈现，与同 32B 行的列值在 CSS grid 中重叠，绘制出第二行 "data"，且多 tuple 拆 lane 造成行高膨胀与错位。

目标：

1. `pd_flags` 选中时在 Selection detail 显示与 infomask 同合同的位格条（hex + 位格 + hover/聚焦 + `?` 参考）。
2. tuple 区域改为**单物理行 lane**：同一 32B 行内所有字段（含跨 tuple 首尾）按列起点排序平铺一行；列前 padding **折叠进下一列视觉范围**；不再生成 `data-gap-*`/重叠 `data` 字段。

## 非目标

- 修改 `parsePage` / tuple header / ItemId / infomask 解码语义
- 改动 ItemId `lp_flags`、`t_infomask`/`t_infomask2` 的呈现合同
- 页头其余字段（pd_lsn、pd_lower、pd_upper、pd_special、pd_prune_xid）的详情形态改版
- 新主题或 light/dark 合同变更
- 连接、取页、列解码、HOT/ctid、Refresh diff、hex 折叠等其它子系统

## 范围与可见行为

### 在范围

1. **page-core 新增公开导出 `decodePdFlags(value: number): FlagBit[]`**：
   - 位定义（bufpage.h）：`PD_HAS_FREE_LINES`(0x0001)、`PD_PAGE_FULL`(0x0002)、`PD_ALL_VISIBLE`(0x0004)；合法掩码 `PD_VALID_FLAG_BITS`(0x0007)；
   - 固定三项按位输出（`set` = 按位与）；超出 0x7 的位聚合为单项 `PD_FLAGS_UNKNOWN`（`meaning` 含残余位 hex，`set: true`）；无残余位时不输出该项；
   - 同步导出三个位常量与 `PD_VALID_FLAG_BITS`。
2. **Selection detail 的 `pd_flags` 位带**：选中 `header.pd_flags` 时，显示单条位格条（新组件 `FlagBitStripSolo`）：可读 hex（`pd_flags=0x…`）、位格 hover/聚焦说明、`?` 全量参考；交互合同与 `infomask-detail` Spec 一致。
3. **tuple 列字段视觉范围（`deriveStructureFields`）**：
   - 列字段按物理 offset 升序处理；每列**视觉起点** = `min(col.start, max(prevEnd, dataRange.start))`（把前导 padding 折叠进本列视觉范围），`end` 保持解码值不变；
   - **移除** `data-gap-*` 字段生成；仅当该 tuple **无任何有效列字段**且 `dataRange` 非空时，生成整体 `data` 字段（原行为保留）。
4. **单 lane 布局（`groupSegmentsIntoLanes`）**：恒返回**单一** lane，段按 `(colStart, colEnd, field.id)` 排序；不再按 tuple 拆分多 lane。
5. **渲染与样式**：每个 cell part 渲染为一行 grid（`grid-row: 1`）；移除 `.structure-row-lanes` / `.structure-row-lane` 多 lane 样式与按 tuple 的纵向堆叠。

### 明确保留（不削弱）

- tuple header 字段（`t_xmin`…`t_hoff`、`nullbitmap`）的字段集与 range 不变
- 列字段 `end`、`label`、`fullLabel`、`valueText`（列值文本）语义不变
- 结构图 ↔ hex 双向高亮、选中详情入口、列解码、HOT/ctid、ItemId flags 呈现不变
- 无列信息的 tuple（未知类型/无 schema）仍显示整体 `data` 字段
- `resolveFieldAt` / `selectionTargetForField` 等消费方基于新字段集继续工作

## 合同

### API / 接口

| 项 | 合同 |
|---|---|
| `decodePdFlags` | 纯函数；输入 `number`，输出 `FlagBit[]`（顺序：三个定义位按常量升序，残余位项最后） |
| `FlagBitStripSolo` | 受控展示组件（props: `label`/`value`/`bits`）；不自带位定义，位文案以传入 `bits` 为准 |
| `index.ts` | 新增导出 `decodePdFlags`（及 PD 常量）；既有导出不变 |

### 数据 / 状态

| 概念 | 合同 |
|---|---|
| pd_flags 位来源 | 仅 page-core `decodePdFlags`；前端**禁止**另造位定义表 |
| 列视觉起点 | 折叠规则仅影响**视觉 range**；列解码数据（`t.columns`）不变 |
| 字段唯一性 | 同一 tuple 不再同时存在 `col-*` 与 `data`/`data-gap-*` 字段（有列字段时） |
| lane 数 | `groupSegmentsIntoLanes` 对任意输入返回长度恰为 1 的数组（空输入返回 `[[]]` 既有约定保留） |

### 错误与约束

| 约束 | 说明 |
|---|---|
| 解析边界 | **禁止**修改 `parsePage` / 列解码语义以迁就布局 |
| 视觉范围单调 | 同一 tuple 内列视觉区间不得互相包含错序；`visualStart < end` 恒成立 |
| 基线不回退 | infomask 位格条、ItemId flags、hex 联动、列值文本不回退 |
| 主题 | 沿用 light/dark；pd_flags 位带复用既有 infomask 位格样式类 |

## 验收（Given-When-Then）

### P0

- **P0-1 decodePdFlags 位解码**  
  Given `pd_flags` 样例值（0x0、0x4、0x5、含残余位的 0x14），  
  When 调用 `decodePdFlags`，  
  Then 置位集合与按位与一致（0x4→PD_ALL_VISIBLE；0x5→PD_HAS_FREE_LINES+PD_ALL_VISIBLE）；0x14 额外含 `PD_FLAGS_UNKNOWN` 且 `set` 为 true；0x4/0x5 无 UNKNOWN 项；合法值内未置位项 `set` 为 false。

- **P0-2 pd_flags 选中位带**  
  Given 已加载页且 Selection detail 选中 `header.pd_flags`，  
  When 查看详情面板，  
  Then 出现位格条：可读 hex（`pd_flags=0x…` 与页头值同源）、位格（置位高亮）、hover/聚焦单格说明、`?` 全量参考。

- **P0-3 移除重叠 data 字段**  
  Given 含列信息的 tuple，  
  When `deriveStructureFields` 输出，  
  Then 不存在 id 以 `.data` 开头的字段（无 `data`、无 `data-gap-*`）。

- **P0-4 padding 折叠进下一列**  
  Given 相邻列间存在 MAXALIGN padding 的 tuple，  
  When 查看列字段 range，  
  Then 每列 `end` 等于解码 offset；`start ≤ 解码 offset`（视觉起点前伸吸收 padding）；首列视觉起点 ≥ `dataRange.start`。

- **P0-5 无列 tuple 保留整体 data**  
  Given 无有效列字段（未知类型/无 schema）且 `dataRange` 非空的 tuple，  
  When `deriveStructureFields` 输出，  
  Then 仍存在整体 `data` 字段且 range 为完整 `dataRange`。

- **P0-6 单 lane 排序**  
  Given 同一 32B 行内含跨 tuple 的段（前一 tuple 行尾 + 后一 tuple 行首）与 itemid 段，  
  When `groupSegmentsIntoLanes`，  
  Then 返回单一 lane 且按 `colStart` 升序（平铺一行，无纵向堆叠）。

- **P0-7 单行渲染无第二行 data**  
  Given 含多 tuple 的页渲染结构图，  
  When 查看任一 cell part 行，  
  Then 所有 cell 位于同一 grid 行（`grid-row: 1`），无重叠/下坠的第二行 "data"。

### P1

- **P1-1 回归不回退**  
  Given 已加载页，  
  When 选中 tuple 字段 / pd_flags / infomask 各一处，  
  Then 选中↔hex 高亮、字段主值、列值文本、infomask 位格条、ItemId flags 均与基线一致可用。

- **P1-2 主题可读**  
  Given light 与 dark 主题，  
  When 查看 pd_flags 位带与 tuple 行网格，  
  Then 置位/未置、单元格边界在两种主题下可辨读。

## 开放问题

none

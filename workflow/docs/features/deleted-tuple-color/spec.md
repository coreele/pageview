# Spec: deleted-tuple-color

> 需求与规格（Plan 之前完成）。任务拆解见后续同目录 `plan.md`。
>
> **feature-id**：`deleted-tuple-color` · **sub-feature-id**：`deleted-tuple-color`（未拆分）
>
> **确认门禁**：路径 `standard`；Spec 用户确认 **required**（「被删除」判定存在业务歧义）。「判定规则」为建议默认值，确认后才可进入 Plan。
>
> **适用对象**：结构图使用者。**前置条件**：已加载含 `LP_NORMAL` 元组的 heap 页。**操作步骤**：打开结构图，对照图例与元组底色。**预期结果**：见判定规则与 P0。**失败处理**：解析失败或无元组时不新增着色；既有错误呈现不变。
>
> **前序基线**：`page-diagram-32b`、`pd-flags-tuple-view`。本项只加删除态颜色；布局与四色 region 合同保留，除非本文件显式修订。
>
> **Design 门禁**：`skipped`。无模块边界/分层/选型；复用 `region: "tuple"` 与 CSS token。

## 背景与目标

结构图 header / ItemId / free / tuple 四色中，所有 `LP_NORMAL` 元组共用 `--region-tuple` 绿，DELETE/UPDATE 旧版本无法从底色区分。用户截图标出 `xmax != 0` 的两行（`1fa0` xmax=14171、`1fc0` xmax=14170）。

目标：按页内字段判定已删除/旧版本元组，整段使用可分辨底色，图例可对照。

## 非目标

- CLOG / snapshot / 真实 MVCC 可见性
- 改 `parsePage`、列解码、ItemId `lp_flags` 语义
- 改 ItemId `LP_DEAD` 既有样式（半透明 + 删除线）；本项只覆盖仍有 tuple body 的 `LP_NORMAL` 槽
- Hex dump 着色、选中高亮、Refresh diff 色
- 新主题或 light/dark 切换合同
- WAL 视图、连接/取页、HOT/ctid 解码

## 范围与可见行为

### 判定规则（建议默认，待确认）

元组视为 **deleted** 当且仅当 `header.t_xmax !== 0`。

- `t_xmax === 0` → 存活色 `--region-tuple`；非 0 → 删除色新 token
- **不**读 `HEAP_XMAX_INVALID` / `HEAP_XMAX_LOCK_ONLY` / `HEAP_XMAX_COMMITTED`
- 不区分 DELETE 与 UPDATE 旧版本（截图两行即 UPDATE 旧版本，有意着删除色）
- `LP_DEAD` ItemId（无 tuple body）不走本规则

page-core 导出纯函数 `isDeletedHeapTuple(tuple): boolean`（即上述比较）；结构图禁止另写判定。

### 着色范围

每个 deleted 元组中，`id` 前缀 `tuple-{itemIndex}.` 的全部字段（`xmin`…`hoff`、nullbitmap、列值/`data`）用删除色。同行存活元组、header、ItemId、free 保持原色。

### 图例

图例在 `tuple` chip 旁增加 `deleted` chip，底色与删除态元组相同。既有四项文案与顺序不变。

### 主题

沿用 light/dark。删除色在两主题下须与存活绿、header 蓝、ItemId 金、free 灰可分辨。选中 overlay（`--field-selected`）叠在删除底色上，不得取消区分。

## 合同

### API / 接口

| 项 | 合同 |
|---|---|
| `isDeletedHeapTuple` | 纯函数；输入含 `header.t_xmax` 的元组；`t_xmax !== 0` → `true`，否则 `false` |
| `packages/page-core` 公开导出 | 新增 `isDeletedHeapTuple`；既有导出不变 |
| 结构图 CSS | 新增 `--region-tuple-deleted`（light 与 dark 各一值）；存活元组继续用 `--region-tuple` |

### 数据 / 状态

| 概念 | 合同 |
|---|---|
| 判定来源 | 仅 `t_xmax`；禁止用 ItemId status 或 infomask 替代（除非开放问题改判） |
| 字段 region | 仍为 `"tuple"`；删除态用附加 class / 等价标记，不新增 `StructureFieldRegion` 枚举值（除非实现证明必须扩展，且不改变四色 region 语义） |
| 解析数据 | `HeapTuple.header.t_xmax` 语义不变 |

### 错误与约束

| 约束 | 说明 |
|---|---|
| 解析边界 | **禁止**为着色修改 `parsePage` / 列解码 |
| 布局边界 | **禁止**改变单 lane、padding 折叠、字段 range |
| ItemId | **禁止**把 `LP_DEAD` 槽改成删除元组色；既有 `lp-dead` 样式保留 |
| 无元组 | 无 `LP_NORMAL` 元组时图例仍可显示 `deleted` chip，页面上无对应单元格 |

## 验收（Given-When-Then）

### P0

- **P0-1 判定函数**  
  Given `t_xmax` 为 `0` 与非 `0`（含 `1`、截图量级如 `14170`）的元组，  
  When 调用 `isDeletedHeapTuple`，  
  Then `0` → `false`；非 `0` → `true`。与 infomask 位无关（即使设置 `HEAP_XMAX_INVALID` / `HEAP_XMAX_LOCK_ONLY`，只要 `t_xmax !== 0` 仍为 `true`）。

- **P0-2 删除元组整段着色**  
  Given 一页同时含 `t_xmax === 0` 与 `t_xmax !== 0` 的 `LP_NORMAL` 元组，  
  When 渲染结构图，  
  Then 每个 `t_xmax !== 0` 元组的全部 `tuple-{i}.*` 单元格使用删除底色；`t_xmax === 0` 的单元格使用存活绿。

- **P0-3 同行异色**  
  Given 同一 32B 行内既有存活元组字段也有删除元组字段，  
  When 查看该行，  
  Then 两类单元格底色不同；header / ItemId / free 不误用删除色。

- **P0-4 图例**  
  Given 结构图已渲染，  
  When 查看图例，  
  Then 存在 `deleted` chip，其底色与删除态元组单元格同源（同一 CSS token）。

### P1

- **P1-1 主题可读**  
  Given light 与 dark，  
  When 查看存活元组、删除元组与图例，  
  Then 两种主题下五类区域（header / ItemId / free / tuple / deleted）可分辨；选中 overlay 不掩盖删除/存活区分。

- **P1-2 ItemId LP_DEAD 不回退**  
  Given 页上存在 `LP_DEAD` ItemId，  
  When 查看结构图，  
  Then 该 ItemId 仍为既有 `lp-dead` 样式（半透明 + 删除线），不是 `--region-tuple-deleted`。

- **P1-3 回归**  
  Given 已加载页，  
  When 选中存活/删除元组字段及 hex 联动，  
  Then 选中↔hex 高亮、字段值、单 lane 布局与基线一致。

## 开放问题

1. **判定是否采用 `t_xmax !== 0`？**（建议：是，对齐截图。）否决则须改用其一并重写 P0-1：  
   - (a) 排除 `HEAP_XMAX_LOCK_ONLY`（行锁非删除）  
   - (b) 排除 `HEAP_XMAX_INVALID`（xmax 无效/中止）  
   - (c) 仅当 `HEAP_XMAX_COMMITTED`（页内提示已提交，仍非 CLOG）  
2. **图例文案**用 `deleted` 还是 `tuple (deleted)`？（建议：`deleted`）
3. **删除色色相**用红/玫红（靠近 `--danger`）是否可接受？（建议：是；具体 hex 由实现选可读值，不锁死）

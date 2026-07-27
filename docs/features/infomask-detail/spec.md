# Spec: infomask-detail

> 需求与规格（Plan 之前完成）。任务拆解见后续同目录 `plan.md`。
>
> **feature-id**：`infomask-detail` · **sub-feature-id**：`infomask-detail`（未拆分）
>
> **确认门禁**：路径 `standard`；Spec 用户确认 **required**。产品澄清（呈现策略、字段范围）已定；**本 Spec 全文**仍须经当前用户会话确认后方可进入 Planner。
>
> **前序基线**：`pg-page-viewer`、`page-diagram-32b`、`layout-chrome-split`、`hex-collapse`（归档见 `docs/archive/2026/`）。本项**仅**修订 Selection detail 中 `t_infomask` / `t_infomask2` 的呈现形态；既有选中联动、hex 高亮、列解码、HOT/ctid、主题等合同**语义保留**，除非本文件显式修订。
>
> **Design 门禁**：`skipped`。无独立 `design.md` / `ui-design.md`；呈现合同写于本 Spec。

## 背景与目标

现状：Selection detail 对 `t_infomask` / `t_infomask2` 使用完整纵向 ○/● flag 清单，未置项占满垂直空间，已置位难扫读。

目标：改为紧凑**位格条**——方块=位条目；**高亮=置位**、未置=低调态；**hover（或等价键盘聚焦）**显示该位 `name`/`meaning`；旁侧 **`?`** 点击后展示**全部位说明**（完整参考，非默认占高列表）。方向：简约、美观、现代。保留可读 hex。

成功标准：一眼区分已置/未置；悬停或聚焦可得单格说明；`?` 可查全量参考；默认垂直占用明显低于纵向清单；选中↔hex、字段主值、列解码、HOT/ctid 不回退。

参考截图（痛点示意，非像素稿）：`C:\Users\admin\.cursor\projects\d-AStudy-Space-pageview/assets/c__Users_admin_AppData_Roaming_Cursor_User_workspaceStorage_82874710c750b3b98380c20e0e5f9b3d_images_image-c77bd076-50a7-4d59-80c9-2d3ef3c2ce62.png`

## 非目标

- 修改 `page-core`（或服务端）对 infomask / ItemId 的解析语义、位定义或解码结果
- 改版 **ItemId `lp_flags`**（互斥 LP 状态枚举，非同类 bitmask；保持既有 ○/● 清单）
- 结构图内常驻 infomask 图注；像素级复刻参考图
- 新主题或改动 light/dark 合同
- 连接、取页、列解码、HOT/ctid、Refresh diff、hex 折叠等其它子系统重构
- 以完整纵向 ○/● 或长说明列表作为默认主呈现（`?` 面板内全量参考除外）

## 范围与可见行为

### 在范围

1. **字段**：Selection detail 的 `t_infomask` 与 `t_infomask2`，统一呈现策略。
2. **默认主呈现**（条目顺序 = `decodeInfomask` / `decodeInfomask2` 返回的 `FlagBit[]`）：
   - 可读 **hex**（`t_infomask=0x…` / `t_infomask2=0x…`，沿用既有 `0x` + 十六进制）；
   - **位格条**：一方块 = 一项；置位高亮、未置低调；**禁止**默认展开全量名称—含义清单。
3. **单格说明**：hover 或键盘聚焦某格 → 展示该格 `name` 与 `meaning`（与归档 P0-3 hover/聚焦等价一致）。
4. **`?` 全量参考**：每位格条旁独立 `?`；点击打开该字段全部位（名称、含义、置位/未置可辨）；可关闭；全量列表**禁止**作默认常驻占高内容。
5. **零已置**：仍展示 hex + 位格条；无置位则全低调；不强制单独「空」文案。
6. **视觉**：简约、美观、现代；light/dark 下置位、未置、控件与说明可读。

### 明确保留（不削弱）

- Selection detail 在选中后仍打开/更新；`fullLabel` + 主值（`valueText`）保留
- 结构图 ↔ hex 双向高亮与自动滚动等既有联动
- 同面板列值、ctid/跨块加载、HOT 摘要行（若有）语义保留
- ItemId flags 呈现保持现状
- 位文案以 page-core 解码的 `name` / `meaning` / `set` 为准；前端**禁止**另造冲突位定义表

### 不在本项改动

壳层连接/表目录、Context strip、结构图网格、hex 行宽/折叠——除非位格条所需局部样式（归 Plan；不另建 Design 文档）。

## 合同

### API / 接口

**N/A（本项）**。不新增/变更 HTTP 或服务端契约。UI 继续消费 page-core 导出的 `decodeInfomask`、`decodeInfomask2` 与既有 tuple header 数值。

### 数据 / 状态

| 概念 | 合同 |
|---|---|
| 位条目来源 | `decodeInfomask(value)` / `decodeInfomask2(value)` 的 `FlagBit[]`（含 `HEAP_NATTS` 等复合项）；**禁止**为展示改写 `set` / 位掩码语义 |
| 位格 ↔ 条目 | 一格 = 数组一项；顺序与解码数组一致 |
| `HEAP_NATTS` | 作为 `t_infomask2` 位格条中一项呈现（含义含属性个数，与解码一致）；**禁止**拆改 page-core NATTS 掩码语义 |
| Hex（Q3） | 每位格条区域**必须**保留可读 hex；含义由 hover/聚焦与 `?` 承载；**禁止**默认长列表 |
| 零已置（Q4） | 仍渲染 hex + 位格条；无置位高亮即可 |
| `?` 面板 | 默认关闭；点击打开对应字段全量参考；可关闭；打开态**不得**删除位格条（可叠加浮层/折叠区） |
| 主题 | 沿用既有 light/dark；本项不新增主题偏好键 |

### 错误与约束

| 约束 | 说明 |
|---|---|
| 解析边界 | **禁止**修改 page-core 解析/解码语义以迁就 UI |
| 基线不回退 | **禁止**削弱选中详情入口、hex 联动、列解码、HOT/ctid、ItemId flag 可读性 |
| 默认呈现 | **禁止**将完整纵向 ○/● 或全量说明列表恢复为两位字段的默认主 UI |
| 无数据 | 无选中 tuple 时不展示两位格条（随 `selectedTuple` 出现，与现状一致） |
| 无障碍 | 位格可键盘聚焦；聚焦与 hover 对单格说明等价；`?` 为可激活控件（按钮或等价） |

## 验收（Given-When-Then）

### P0

- **P0-1 位格条替换默认清单**  
  Given 已加载含至少一条 NORMAL tuple 的页且 Selection detail 显示该 tuple，  
  When 查看 `t_infomask` 与 `t_infomask2` 区域，  
  Then 二者均为位格条（方块=位条目），置位高亮、未置低调；且默认不出现完整纵向 ○/●（或等价）全量名称列表。

- **P0-2 保留可读 hex**  
  Given 同上，  
  When 查看两位区域，  
  Then 各自可见可读 hex（`0x` + 与 header 值一致的十六进制），与 header / page-core 数值同源。

- **P0-3 单格 hover/聚焦说明**  
  Given 位格条已渲染，  
  When hover 或键盘聚焦某一格，  
  Then 展示该格 `name` 与 `meaning`；置位与未置在格态上可区分。

- **P0-4 `?` 全量参考**  
  Given 位格条已渲染，  
  When 点击该字段旁的 `?`，  
  Then 出现含该字段全部位条目（名称、含义、置位/未置可辨）的参考面板；关闭后主区仍为紧凑位格条 + hex。

- **P0-5 双字段统一策略**  
  Given Selection detail 展示 tuple，  
  When 对比 `t_infomask` 与 `t_infomask2`，  
  Then 二者同一呈现模式（hex + 位格条 + hover/聚焦 + `?`），仅条目集随各自解码结果不同。

- **P0-6 零已置仍可扫读**  
  Given 某 tuple 的 `t_infomask` 无解码置位（或值为 0），  
  When 查看该区域，  
  Then 仍显示 hex 与位格条，且无一格呈置位高亮。  
  （`t_infomask2` 同理；解码约定为始终 `set` 的项如 `HEAP_NATTS` 按其解码结果高亮，且不因字段数值为 0 而删除位格条。）

- **P0-7 解码语义不回退**  
  Given 已知 `t_infomask` / `t_infomask2` 样例值，  
  When 比对 UI 置位集合与 `decodeInfomask` / `decodeInfomask2`，  
  Then 置位集合与名称/含义一致；page-core 位定义未被本项改写。

- **P0-8 详情与联动回归**  
  Given 已加载页，  
  When 选中 tuple 字段并查看 Selection detail，  
  Then 字段主值、列解码、ctid/跨块入口、结构图↔hex 高亮仍可用；ItemId flags 仍可读（允许仍为原清单形态）。

### P1

- **P1-1 主题可读**  
  Given light 与 dark 主题，  
  When 查看位格条、hover/聚焦说明与 `?` 面板，  
  Then 置位/未置与正文在两种主题下均可辨读。

- **P1-2 垂直空间改善可感知**  
  Given 与改版前同页同选中（少数位置位、多数未置），  
  When 比较 Selection detail 中 infomask 区域高度，  
  Then 默认主呈现（`?` 未打开）显著短于原完整纵向清单。

## 开放问题

none

已关闭决策（勿再打开）：

| ID | 决议 |
|---|---|
| Q1 | 位格条（高亮=置位）+ hover/聚焦 + `?` 全量参考；非纯 chip、非默认纵向 ○/● 清单 |
| Q2 | 仅 `t_infomask` 与 `t_infomask2` 统一；不强制 ItemId 及其它字段 |
| Q3 | 保留可读 hex；含义在 hover/`?`（已写入合同） |
| Q4 | 零已置仍示 hex + 位格条，全未置不高亮（已写入合同） |

# Spec: page-diagram-32b

> 需求与规格（Plan 之前完成）。任务拆解见后续同目录 `plan.md`。
>
> **feature-id**：`page-diagram-32b` · **sub-feature-id**：`page-diagram-32b`（未拆分）
>
> **确认门禁**：路径 `full`；Spec 用户确认 **required**。「推荐默认」确认前不得视为已裁决；开放问题关闭后方可进入 Planner（Design + `ui-design.md` + Plan）。
>
> **前序基线**：`pg-page-viewer`（归档 `docs/archive/2026/pg-page-viewer/`）。本 Spec **仅**约定页结构主视图与 hex 的 **32B 结构图形态与交互**；连接、取页、解析、flag 解读、列解码、HOT/ctid、刷新对比、主题与元信息等既有合同**语义保留**，除非本文件显式修订。

## 背景与目标

现状：结构主视图为区块列表；hex 为 **16 字节/行**；字段边界不直观。

目标：改为 **32 字节一行**的结构图——字段名与边界可见、点击高亮、中间 free space 可折叠，并与底部 hex（同行宽 32B）双向联动。可比参考图更美观，**不必像素复刻**。

成功标准：按 32B 网格扫读边界；点击高亮；折叠 free space 后仍可读真实跨度；结构图与 hex 选中区间双向一致。

参考图（示意图）：`/Users/zhougangjie/.cursor/projects/Users-zhougangjie-Space-pageview/assets/page_header_tuple-60f738fc-cf75-4be7-b83e-0465348f214c.png`

## 非目标

- 重做连接、表目录、取页 API、page-core 解析语义或非 8KB 策略
- 像素级复刻参考图（装饰/配色归 `ui-design.md`）
- 新主题或改动 light/dark 合同
- 将 infomask 动态/静态**常驻图注**升为本项 P0（见 Q4；既有 hover/聚焦逐位解读保留）
- 索引页 / FSM / VM / 离线假数据主路径
- 后端协议变更（预期纯前端；若须改 API，先修订本 Spec）

## 范围与可见行为

### 在范围

1. 主视图改为结构图；一排 = **32 字节**；按页内偏移分行。
2. 可解析字段（及可划分子区间）画出边界并展示字段名/信息（窄字段见 Q2）。
3. 点击字段（或等价可聚焦目标）后结构图内高亮。
4. Free space 可折叠/展开；折叠后仍标明空闲区与真实字节跨度（见 Q5）；**禁止**破坏 hex 字节映射。
5. 结构图选中 ↔ hex 高亮同一字节区间；hex 点选落在某字段上时结构图高亮该字段（跨行见 Q3）。
6. Hex 每行 **32 字节**；地址标注见 Q6。

相对顺序：Page header → ItemId → free space（`pd_lower`–`pd_upper`）→ HeapTuple（高偏移端）。垂直方向见 Q1。

| 区域 | 至少覆盖（须可画边界并参与选中；文案由 Design/UI 细化） |
|---|---|
| Page header | `pd_lsn`（可分 xlogid/xrecoff）、checksum、flags、`pd_lower`、`pd_upper`、`pd_special`、pagesize/version、`pd_prune_xid` 等既有可解析字段 |
| ItemId | 每 slot：`off` / `flag` / `len`（或等价）；LP 状态 UNUSED / NORMAL / REDIRECT / DEAD 可辨 |
| Free space | 整段 `[pd_lower, pd_upper)` 可选中 |
| HeapTuple | `t_xmin`/`t_xmax`/`t_cid`、ctid 组成、`infomask`/`infomask2`、`hoff` 及用户数据区（按列或整块；未知/TOAST 沿用基线） |

### 明确保留（不削弱）

- 空洞压缩：free space / 大片空白**禁止**按真实字节比例撑满视口。
- 压缩/折叠**禁止**使结构图↔hex 映射失真。
- 基线 flag/infomask 解读、列解码、HOT/ctid、刷新对比、主题、元信息、键盘可达等 P0：本项不删除，实现须回归。

### 不在本项改动

连接表单、表列表、Context strip 字段集、主题入口等壳层——除非结构图/hex 必需的局部布局（归 `ui-design.md`）。

## 合同

### API / 接口

**N/A（本项）**。沿用 raw page + schema；**禁止**改为仅下发服务端预渲染图。若须新增接口，先修订本 Spec。

### 数据 / 状态

| 概念 | 合同 |
|---|---|
| 行宽 | 结构图与 hex 均为 **32 字节/行**。8KB 页 → **256** 行（`8192 / 32`）。 |
| 偏移 | 页内绝对字节；半开区间 `[start, end)`。行 `r` → `[r*32, min((r+1)*32, pageSize))`。 |
| 选中 | 至少「字段级」选中；结构图高亮该目标，hex 高亮其完整字节区间。允许区域级快捷（如整段 free），**不得**替代字段级。 |
| 高亮 | 单一权威 `ByteRange`（或等价）供结构图与 hex 共用；跨行字段覆盖全部字节（Q3）。 |
| Free 折叠 | UI 布尔态；不改解析数据与 hex 内容；只改结构图中 free 的高度/行数呈现。 |
| Diff | 既有 diff 高亮可与选中共存且可区分（样式归 UI Design）。 |

垂直方向、窄标签、跨行、infomask 图注、折叠视觉、hex 地址的**推荐默认**见开放问题 Q1–Q6（待确认）。

### 错误与约束

| 条件 | 要求 |
|---|---|
| 非 8KB / 无法解析 | 沿用基线：明确错误；**禁止**渲染错误的 32B 结构图 |
| 折叠 / 压缩 | **禁止**字节映射错位；选中区间须对应真实偏移 |
| 窄标签 | **禁止**为美化合并相邻不同字段边界 |
| 像素稿 | **允许**相对参考图美化；**禁止**以未像素复刻为缺陷 |

## 验收（Given-When-Then）

### P0

- **P0-1 结构图 32B 行网格**  
  Given 已加载标准 8KB heap 页，When 查看页结构主视图，Then 为结构图形态，逻辑行宽 32 字节，相对顺序 header → ItemId → free → tuple，垂直方向符合已确认 Q1。

- **P0-2 字段边界与标签**  
  Given 已加载含 NORMAL tuple 的页，When 查看结构图，Then 可辨识 header 字段边界、各 ItemId 的 off/flag/len（或等价）边界、以及某 tuple 主要 header 字段边界；单元展示字段名或按已确认 Q2 可读。

- **P0-3 点击高亮**  
  Given 结构图有可点击字段，When 点击某一字段，Then 该字段进入与未选中可区分的选中高亮。

- **P0-4 结构图 → hex**  
  Given 已加载页且 hex 可见，When 结构图选中某字段，Then hex 高亮该字段完整字节区间（跨行按已确认 Q3）。

- **P0-5 hex → 结构图**  
  Given 已加载页，When hex 点选落在某已映射字段上的字节，Then 结构图高亮该字段，区间与该字段字节范围一致。

- **P0-6 hex 32B 一行**  
  Given 已加载 8KB 页，When 查看 hex，Then 每行 32 字节；行首偏移符合已确认 Q6；行数 = `ceil(pageSize/32)`（8192 时为 256）。

- **P0-7 free space 可折叠**  
  Given 存在非空 free space，When 折叠，Then 按已确认 Q5 紧缩，仍可辨识空闲区与真实字节跨度；When 再展开，Then 恢复展开呈现，且不破坏 P0-4/P0-5。

- **P0-8 折叠/压缩不破坏映射**  
  Given free 已折叠（或压缩呈现），When 选中紧邻 free 的 ItemId 与某 tuple 字段并看 hex，Then 高亮落在正确区间，**禁止**错位到 free 或其他结构。

- **P0-9 非像素复刻不阻塞**  
  Given 排版装饰/配色与参考图不同，When 验收 P0-1..P0-8，Then 合同行为满足即通过；不得以未像素复刻判失败。

### P1

- **P1-1 窄字段完整名可达**  
  Given 字段过窄无法显示全名，When hover/聚焦或选中，Then 可得完整字段名（tooltip 或详情区），边界仍可见。

- **P1-2 跨行字段片段一致**  
  Given 字段跨越 ≥2 个 32B 行，When 点击任一片段或 hex 中该区间任一字，Then 所有片段与 hex 整段同步高亮。

- **P1-3 infomask 图注（可选）**  
  Given 用户确认纳入参考图类 infomask 动态/静态说明，When 查看结构图，Then 提供不遮挡主网格的说明；否则 N/A。

## 开放问题

均为 **推荐默认 + 待用户确认**。确认前不得实现；请在当前用户会话逐项裁决（采纳 / 修改 / 否决）。

| ID | 议题 | 推荐默认 | 状态 |
|---|---|---|---|
| **Q1** | 垂直方向：自下而上 vs Header 在上 | **低偏移在上、高偏移在下**（header/ItemId 上，free 中，tuple 偏下）；与 hex 同向；**禁止**整页倒置 | 待确认 |
| **Q2** | 窄字段标签 | 格内缩写/截断；全文经 tooltip 或详情区；**禁止**因标签省略边界 | 待确认 |
| **Q3** | 跨行字段与 hex 对齐 | 整字段单一选中；各行画片段；点击任片段或 hex 区间内任一字 → 全字段 + hex 连续区间同步 | 待确认 |
| **Q4** | infomask 动态/静态图注 | **不纳入本项 P0**；保留逐位解读；需要则 P1-3 | 待确认 |
| **Q5** | free 折叠在 32B 网格上的视觉 | 紧凑断裂带 + `free space` 与真实 `[start,end)`/字节数；**不**为折叠区铺满空 32B 行；展开仍空洞压缩；折叠控件可发现且可键盘操作 | 待确认 |
| **Q6** | hex 32B 后地址标注 | 行首 = 该行首字节页内绝对偏移，十六进制 ≥4 位（如 `0000`、`0020`）；32 字节/行；ASCII 旁路可选，若有须对齐且不破坏点选 | 待确认 |

---

**交接提示（Manager）**：建议状态 `awaiting-spec-approval`。待确认：Q1–Q6（及对 P0/P1 范围的异议）。关闭后调度 `planner`（`design.md`、`ui-design.md`、`plan.md`）。Analyst 不改 STATUS / 工作项记录。

# Spec: hex-collapse

> 需求与规格（Plan 之前完成）。任务拆解见后续同目录 `plan.md`。
>
> **feature-id**：`hex-collapse` · **sub-feature-id**：`hex-collapse`（未拆分）
>
> **确认门禁**：**待确认 / awaiting-spec-approval**（2026-07-27 修订稿）。路径 `standard`。范围 B、仅 free、联动、双向高亮/滚动，以及「始终折叠、取消 Expand」已写入正文；**修订稿须当前用户会话再批后方可进入 Plan。**
>
> **前序基线（不得无故回退）**：
> - `workflow/docs/archive/2026/pg-page-viewer/spec.md`：连接与取页、空洞压缩、hex 联动等。
> - `workflow/docs/archive/2026/page-diagram-32b/spec.md`：32B 结构图、free 折叠（Q5）、双向高亮、hex 自动定位等。
> - `workflow/docs/archive/2026/layout-chrome-split/spec.md`：宽屏分栏、顶栏「Collapse hex」整栏显隐唯一入口、窄屏回退等。
>
> **本项显式修订（覆盖前序）**：
> 1. 前序「Free 折叠只改结构图、不改 hex」→ **hex 视图内**亦按 free 区间折叠，与左侧 **同一呈现语义**。
> 2. 前序 `page-diagram-32b` **Q5 / P0-7**「结构图 free 可折叠/展开切换」→ 非空 free 在结构图与 hex **始终**断裂带呈现；**取消**展开态与 Collapse/Expand free space 可切换控件。前序可展开要求 **以本 Spec 覆盖**。
> 3. 双向高亮、自动滚动、32B、顶栏 Collapse hex、宽屏分栏等其余前序义务不得削弱。

## 背景与目标

现状：结构图曾有 Collapse/Expand free space；顶栏 Collapse hex 可整栏隐藏；HEX 仍为连续 32B/行，无视图内 free 折叠。

目标（范围 **B** + 折叠态修订）：

1. HEX **视图内**将 free 对应字节折为紧凑断裂带，缩短无意义长滚。
2. 与左侧 **联动、同一呈现**：非空 free **始终折叠**，两侧一致。
3. **取消** free 展开态与可切换 Collapse/Expand 控件；选中 free **仅高亮断裂带**（不自动、也无手动展开到逐字节）。
4. **保留**双向高亮与自动滚动；顶栏 Collapse hex **不变**（非本项交付目标）。
5. 纯前端；**禁止**改 `page-core` 解析语义。

成功标准：非空 free 两侧恒为可辨识跨度的断裂带；无 Expand/切换入口；选中高亮断裂带；非 free 映射不错位；双向高亮与非 hex 发起的自动定位仍成立。

参考截图（登记引用，**非像素稿**）：`workflow/docs/manager/hex-collapse.md` 所引 2026-07-27 UI 截图。

## 非目标

- 仅顶栏 Collapse hex（范围 A）或以 A+B 为交付范围
- 按「大段重复字节」或任意同值 run 折叠（**明确排除**）
- free 的**展开态**或 Collapse/Expand free space **可切换**控件（结构图或 hex）
- 选中 free 时自动/手动展开为逐字节或结构图展开条
- 改 `page-core` / 字段边界 / 字节映射 / 非 8KB 策略 / 后端 API
- 扩大主题语义；像素复刻参考截图
- 削弱双向高亮、hex 自动滚动、32B/地址、Collapse hex 唯一入口、宽屏分栏
- 索引页 / FSM / VM、离线假数据主路径等前序非目标

## 范围与可见行为

### 在范围

1. **始终折叠**：非空 free（`[pd_lower, pd_upper)`，与解析一致）在结构图与 hex **恒为**紧凑断裂带，标明 `free space` 与真实 `[start,end)`/字节数；**禁止**铺满逐字节单元格或结构图展开条。
2. **移除可切换控件**：两侧**一并移除** Collapse/Expand free space（及等价可切换布尔 UI）。**允许**断裂带为**仅展示态**标签（无展开入口）。空 free（`end <= start`）无折叠 UI、无断裂带。
3. **联动**：两侧非空 free **同一呈现**；无「一侧展开、一侧折叠」合法态。
4. **对象**：仅 free；**禁止**折叠 header / ItemId / HeapTuple 等。
5. **局部行**：free 可不对齐 32B；同行 free 前/后非 free **必须**仍为单元格。
6. **选中**：可选中整段 free；两侧同一 `ByteRange` 高亮断裂带。**禁止**因选中自动展开；**禁止**手动展开入口。非 free 高亮真实单元格；**禁止**折叠导致高亮错位。
7. **自动滚动**：非 hex 发起、选中非空且 hex 整栏可视 → 滚至目标首字节所在**呈现行**（折叠后几何）；同区间未变不强制再滚；hex 内发起**禁止**强制拉滚。整栏 Collapse hex 时仍先展开整栏再定位。
8. **顶栏 Collapse hex**：入口与行为不变；**禁止**在 hex 面板内再提供整栏折叠。

### 明确保留（引用前序）

| 来源 | 须保留 |
|---|---|
| `pg-page-viewer` | 连接/取页；空洞压缩；结构图↔hex 联动总则 |
| `page-diagram-32b` | 32B；字段选中；双向高亮；hex 自动定位；行首绝对偏移。**Q5 可切换折叠由本 Spec 覆盖为始终折叠** |
| `layout-chrome-split` | 宽屏左右；窄屏上下；Collapse hex 整栏唯一入口；壳层编排 |

### 不在本项改动

- `page-core` 与后端解析/编码；连接表单与 API
- 顶栏 Collapse hex 合同（仅不回退）；主题默认策略

## 合同

### API / 接口

**N/A（本项）**。沿用既有 connect / tables / schema / pages。**禁止**为折叠新增服务端预计算或改解析响应语义。

### 数据 / 状态

| 概念 | 合同 |
|---|---|
| Free 呈现态 | 非空 free **恒折叠**（结构图 + hex）。**禁止**可切换展开态；去掉可切换布尔或等价恒折叠。 |
| 折叠范围 | 仅 `page.freeSpace.range`（半开 `[start, end)`）；`end <= start` → 无折叠 UI、无断裂带。 |
| 折叠呈现 | free 跨度 → 紧凑断裂带（`free space` + 真实跨度/字节数）；不渲染逐字节单元格或结构图展开条。行宽 32B；非 free 行/片段行首 = 页内绝对偏移（十六进制 ≥4 位）。 |
| 控件 | **移除**两侧 Collapse/Expand free space。断裂带可仅展示；**禁止**展开入口。 |
| 整栏 hex | `hexCollapsed` ⊥ free 呈现。Show hex 后非空 free 仍为断裂带。 |
| 选中 / 高亮 | 单一权威 `ByteRange`；折叠不改区间语义。Free id `"free"`（或等价）。选中 free → **高亮断裂带**，不展开。 |
| Hex 自动定位 | 沿用前序；按**始终折叠后**几何使目标偏移呈现进入可视区。 |
| Diff | 可与选中共存；free 在 diff 时断裂带须可区分（样式归 Plan）。 |

### 错误与约束

| 条件 | 要求 |
|---|---|
| 解析 | **禁止**改 `page-core` |
| 折叠对象 | **禁止**按重复字节 run 折叠；**禁止**折叠非 free |
| 展开 | **禁止** free 展开态或 Expand 入口（两侧） |
| 映射 | **禁止**结构图↔hex 映射/高亮错位 |
| 呈现一致 | **禁止**两侧非空 free 呈现不一致 |
| 整栏 Collapse hex | **禁止**削弱唯一入口或在 hex 面板重复提供 |
| 既有联动 | **禁止**削弱双向高亮或非 hex 发起的自动滚动（含整栏先展开再滚） |
| 像素 | **允许**相对截图美化；**禁止**以未像素复刻判失败 |
| 空 free | **禁止**误导性 free 折叠/断裂带 UI |

## 验收（Given-When-Then）

> 前序相关 P0（双向高亮、自动滚动、32B、Collapse hex）合入前须回归；结构图 free「可展开切换」以本 Spec 覆盖为准。

### P0

- **P0-1 Hex 内始终折叠 free**  
  Given 已加载页、hex 整栏可见、非空 free，When 查看 hex，Then free 跨度不以逐字节铺满，而以紧凑断裂带呈现，并可辨识 free space 与真实 `[start,end)`/字节数。

- **P0-2 结构图始终折叠**  
  Given 已加载页、结构图可见、非空 free，When 查看 Free space 区域，Then 恒为紧凑断裂带，可辨识 free space 与真实跨度/字节数；Then **禁止**呈现为可展开的逐行/空洞压缩展开条。

- **P0-3 两侧呈现一致**  
  Given 结构图与 hex 均可见且非空 free，When 对照两侧，Then 皆为折叠/断裂带且跨度信息一致；Then **禁止**一侧断裂带、另一侧逐字节或结构图展开条。

- **P0-4 无 Expand / 切换入口**  
  Given 非空 free 且两侧可见，When 检查 UI，Then **禁止**存在「Collapse free space」「Expand free space」或等价可切换控件；Then 断裂带文案若有，仅为展示态、无展开入口。

- **P0-5 仅折叠 free，排除重复字节**  
  Given free 外存在长串相同字节（如 tuple 内连续 `00`），When 查看 hex，Then 这些非 free 仍为单元格；Then **禁止**仅因「重复字节」出现额外折叠带。

- **P0-6 选中高亮断裂带、不展开**  
  Given 非空 free 且两侧可见，When 结构图或 hex 选中 free，Then 两侧对同一 free `ByteRange` 进入可区分选中态，高亮断裂带（或等价）；Then **禁止**自动展开为逐字节；Then **禁止**出现手动展开到逐字节的入口。

- **P0-7 不破坏双向高亮**  
  Given 非空 free 为折叠呈现且 hex 可见，When 结构图选中某非 free 字段，Then hex 高亮其完整真实字节区间；When hex 点选落在已映射非 free 字段字节上，Then 结构图高亮该字段。

- **P0-8 不破坏自动滚动**  
  Given 已加载 8KB 页、hex 整栏可见、非空 free 折叠呈现，可视区不含页尾附近某 tuple 字段字节，When 结构图点击该字段（非 hex 发起），Then hex 滚至该区间首字节所在呈现行进入可视区；When 再点同一已选字段（区间未变），Then 不强制再滚；When hex 内点选导致选中变化，Then 不因该次强制拉滚。

- **P0-9 局部行与偏移**  
  Given free 起止不对齐 32B，When 查看 hex 折叠呈现，Then 同行 free 前/后非 free 仍为单元格；Then 可见行行首为页内绝对偏移；Then 边界字节高亮/点选映射正确。

- **P0-10 顶栏 Collapse hex 不回退**  
  Given 已 `page_loaded`，When 使用主带「Collapse hex」/「Show hex」，Then 整栏显隐仍可用且入口仅在主带 Theme 左侧；When 查看 hex 面板，Then **禁止**出现整栏折叠控件。Then 整栏再次展开后，非空 free 仍为折叠/断裂带。

- **P0-11 不改 page-core / API**  
  Given 本项实现后，When 对同一夹具页对比解析与接口行为，Then 与改前一致（字段边界、解码、非 8KB 拒绝等）。

- **P0-12 空 free 无折叠 UI**  
  Given free 为空（`end <= start`），When 查看结构图与 hex，Then 不提供 free 折叠/断裂带 UI。

### P1

- **P1-1 diff 可辨**  
  Given 刷新对比使 free 落入 diff 且非空 free 为折叠呈现，When 查看两侧断裂带，Then 可区分 diff 与普通折叠带（不强制像素）。

## 开放问题

> 范围 B、仅 free、联动、双向高亮/滚动，以及始终折叠、取消 Expand、选中仅高亮断裂带：**已裁决**。初版 Q1（hex 侧对等 Collapse/Expand）、Q2（选中是否自动展开）**关闭**。

无未决开放问题。

---

**交接提示（Manager）**：修订稿 `workflow/docs/features/hex-collapse/spec.md`。建议状态 **`awaiting-spec-approval`**。用户确认修订稿后方可调度 Planner。Analyst 不改 STATUS/工作项记录；不写 Design/Plan/代码；不 commit。

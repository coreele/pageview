# UI Design: page-diagram-32b

> **UI 表面**：gui  
> 依据 Spec：`docs/features/page-diagram-32b/spec.md` · 依据 Design：`design.md` · 依据标准：`docs/standards/ui.md`  
> **主题**：沿用既有 light/dark 合同（本 Spec **未**要求改主题）；结构图/hex 复用现有 CSS 变量并扩展区域/选中 token。单主题新皮肤 **不**引入。

## 目标与任务

- **主目标**：在真实 8KB heap 页上，按 32B 网格扫读字段边界，点击高亮，折叠 free space，并与 hex 双向对齐同一字节区间。
- **关键任务（优先级）**：浏览 32B 结构图 → 点选字段看边界/名称 → 对照 hex 高亮 → 折叠/展开 free →（次要）详情区 flag/列值等基线能力。
- **信息优先级**：结构图网格 > 选中高亮与详情 > hex > 壳层/Context strip（本项不重做 strip）。

参考图仅为示意图（非像素稿）：分区语义与字段名可借鉴；装饰/配色可优化（P0-9）。

## 信息架构与元信息

### 主区分区（本项改动面）

```text
┌─ Main（保留壳层 chrome / strip / navigator）──────────────┐
│  Structure diagram（32B 逻辑行）                           │
│    [PageHeader 字段格]                                     │
│    [ItemId 槽位 … 按 32B 换行]                             │
│    [FreeSpaceBand：折叠/展开]                              │
│    [HeapTuple 字段格 …]                                    │
│  Selection detail（既有 flag/列值/HOT；保留）              │
│  Hex dump（32B/行；可折叠高度控件可保留）                   │
└────────────────────────────────────────────────────────────┘
```

- **元信息**：Context strip 字段集与基线一致；本项不新增必显元信息。
- **壳层**：连接表单、表列表、主题入口 **不改**（除非结构图/hex 局部间距）。

### 结构图信息优先级

1. 字段边界（始终可见，即使标签缩写）
2. 字段名/缩写 + 选中态
3. Free 真实跨度文案与折叠控件
4. 区域标注（PageHeader / ItemId / free / Tuple）——次要，不遮挡网格

## 流程

1. 用户已按基线加载页 → 主视图为 32B 结构图（非旧区块列表）。
2. 扫读：自上而下低→高偏移；同行内左→右为低→高列。
3. 点击字段格（或键盘激活）→ 该字段选中高亮；hex 同步高亮完整 `ByteRange`。
4. Hex 点某字节 → 若落在已映射字段 → 结构图该字段（含跨行片段）同步高亮。
5. Free：默认展开（空洞压缩条）或沿用产品默认；用户折叠 → 紧凑断裂带仍显示 `free space` + `[start,end)` + 字节数；再展开恢复；hex 不变。
6. 窄字段：格内缩写；hover/聚焦/选中 → tooltip 和/或详情区全文。
7. 基线：详情区 flag 逐位、列值、跨块 ctid、Refresh diff 仍可用。

## 状态

| 状态 | 呈现 | 用户可执行动作 |
|---|---|---|
| 初始 / 未加载页 | 沿用基线（无结构图） | 选表 Load |
| 加载页 | 主区局部指示；壳层稳定 | 等待 |
| 空（无 NORMAL tuple） | 结构图仍含 header/ItemId/free；提示无 tuple（基线文案可保留） | 浏览/折叠 free |
| 成功 `page_loaded` | 32B 结构图 + hex(32) + 详情 | 点选、折叠、hex 点选 |
| 选中字段 | 字段片段 + hex 区间高亮可区分；详情区更新 | 改选；看 tooltip |
| Free 折叠 / 展开 | 断裂带高度变化；跨度文案仍在；hex 行数不变 | 切换折叠 |
| `diff_active` | diff 样式与选中/hex 高亮可区分 | 再刷新 |
| 错误（非 8KB 等） | 沿用基线：明确错误；**禁止**画错误 32B 图 | 换页/环境 |
| 部分失败（未知列/TOAST） | 该列降级展示；网格其余可用 | 继续浏览 |

## 表面专属设计

### gui

#### 布局与层级（Q1）

- **垂直**：Header/ItemId 在上，free 中，tuple 在下；与 hex 同向。**禁止**整页倒置。
- **水平**：每逻辑行 32 列；字段按 `[start,end)` 切片段占格。
- 结构图占主区最大面积；hex 在下（默认约 30% 高，可沿用折叠）。
- 区域标签可用小标题或左边注；**禁止**大卡片墙盖住网格。

#### Free space（Q5 / P0-7）

| 态 | 视觉 |
|---|---|
| 展开 | 空洞压缩条（非真实比例撑满）；标注 free + 真实跨度/字节数；整段可点选 |
| 折叠 | **紧凑断裂带**（单行量级高度）；文案含 `free space` 与 `[start,end)`/字节数；**不**生成铺满的空 32B 行 |

- 折叠控件：可见按钮或等价控制；`aria-expanded`；Tab + Enter/Space 可操作。
- 折叠**只**变结构图高度，不变 hex。

#### 字段标签（Q2 / P1-1）

- 宽格：尽量全名；窄格：缩写/截断（如 `xmin`、`off`）。
- 全文：`title`/tooltip，且选中时详情区显示 `fullLabel`。
- **禁止**为塞文案而合并相邻字段边界。

#### 跨行字段（Q3 / P1-2）

- 每个 32B 行画该字段落在此行的片段；片段共享选中态。
- 点任一片段 = 选中整字段；hex 高亮连续 `[start,end)`。

#### ItemId 视觉子段

- 每 4B slot 内画 `off | flag | len`（或等价）三分视觉；LP 状态（UNUSED/NORMAL/REDIRECT/DEAD）可用色或角标区分。
- 选中任一子标签 → 高亮该 ItemId 完整 4B（见 `design.md`）；hex 同步该 4B。

#### Hex（Q6 / P0-6）

- 32 字节/行；行首偏移十六进制 ≥4 位（`0000`、`0020`…）。
- 行数 = `ceil(pageSize/32)`（8192→256）。
- ASCII 旁路：**可选**；若做须与字节列对齐且不破坏点选。
- 高亮类名与结构图选中共用同一 `highlight`。

#### 密度与响应式

- 等宽字体用于偏移/hex/窄标签；结构图正文字号约 11–13px，行高偏紧。
- ≥1280px：结构图与 hex 上下分栏。
- 窄屏：结构图横向滚动优于压扁列导致边界不可辨。

#### 焦点与键盘

| 目标 | 行为 |
|---|---|
| 字段格 | `tabIndex=0` 或罗盘式焦点；Enter/Space 选中 |
| Free 折叠控件 | 可聚焦；Enter/Space 切换 |
| Hex 字节 | 保留可点/可键盘（与基线一致；32B 行） |
| 跨块 ctid 等 | 基线保留 |

- `:focus-visible` 高对比轮廓（两主题可见）。
- Flag/infomask：保留 hover/聚焦逐位解读（详情区）；**不**做参考图类常驻图注（Q4）。

#### 视觉语义

- 复用既有 token：`--region-header` / `itemid` / `free` / `tuple`、`--hex-hl`、`--diff`、`--focus`。
- 新增/明确：`--field-selected`（结构图选中，可与 hex-hl 呼应但与 `--diff` 可分）。
- 参考图配色（蓝 ItemId、绿 xmin 组、橙 ctid）**允许**作语义提示，非强制像素。
- 主题策略：沿用基线 `data-theme` light/dark 与默认偏好；不新增模式；新控件两主题可读。

### cli

N/A（`UI 表面=gui`）

## 与 Spec 验收映射

| Spec 验收 ID | 本设计落点 |
|---|---|
| P0-1 | 32B 结构图；顺序与 Q1 垂直方向 |
| P0-2 | 字段格边界 + 标签/缩写；ItemId/tuple 主要字段可辨 |
| P0-3 | `--field-selected`（或等价）与未选中可分 |
| P0-4 | 选中 → hex 同 `highlight` 整段 |
| P0-5 | hex 点选 → `resolveFieldAt` → 结构图字段高亮 |
| P0-6 | Hex 32B、偏移格式、256 行 |
| P0-7 | FreeSpaceBand 折叠/展开 + 跨度文案 + 键盘 |
| P0-8 | 折叠后选邻接 ItemId/tuple，hex 区间仍正确 |
| P0-9 | 不要求像素复刻 |
| P1-1 | tooltip/详情全文；边界仍在 |
| P1-2 | 跨行片段同步高亮 |
| P1-3 | 默认 N/A（Q4）；若做则侧注不遮挡网格 |

## 对 Plan / Developer 的要点

- 实施顺序与 `design.md` 一致：映射 → hex 32 → 结构图 → 折叠 → 联动 → 窄标签/a11y。
- 手测证据：折叠前后截图或说明；跨行字段点击；hex↔结构图各一方向；light/dark 下选中可读。
- 遵守 `docs/standards/ui.md`；不以「更美观」合并边界或倒置布局。
- 回归：详情区 infomask、列值、HOT/ctid、Refresh diff、strip、主题。

## 开放阻塞

none（Spec 界面合同与 Q1–Q6 已确认；主题沿用基线。）

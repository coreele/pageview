# UI Design: wal-viewer

> **UI 表面**：gui  
> 依据 Spec：`workflow/docs/features/wal-viewer/spec.md` · 依据 Design：`design.md` · 依据标准：`workflow/docs/standards/ui.md`  
> **主题**：单主题策略延续既有应用 light/dark（Spec **未要求**本项新增主题条款；不新增 token/切换义务）。

## 目标与任务

- **主目标**：在 WAL 模式下浏览一批结构化 record（一行一条宽元数据），选中单条，处理含 FPI 的折叠摘要；明确 hex 在 v1 不可用。
- **关键任务（优先级）**：切换至 WAL → 填写或「填入最近窗口」→ 加载批次 → 扫读列表与选中 →（可选）展开 FPI 元信息。
- **信息优先级**：record 列表 > LSN 查询控件 > 选中/详情与 hex 占位 > 连接元信息（沿用既有 strip，不抢列表）。

## 信息架构与元信息

### 分区（桌面默认）

```text
┌─ App chrome ──────────────────────────────────────────────────┐
│ 品牌/标题 · [Page | WAL] 模式切换 · 连接徽标 · [既有主题切换]   │
├─ Context strip（沿用；模式相关次要信息）───────────────────────┤
│ 连接非机密字段 · PG version（可截断）                           │
│ WAL：当前查询区间 start–end（已加载时）· record 条数            │
├─ WAL Navigator / 查询 ──────┬─ WAL Main ──────────────────────┤
│ start LSN                   │ Record 列表（一行一条）           │
│ end LSN                     │  选中行高亮                       │
│ [填入最近窗口] [Load]       │  FPI：默认折叠摘要                │
│                             ├─ 详情 / Hex 占位 ─────────────────┤
│                             │ 选中摘要；hex：「v1 不可用」说明   │
└─────────────────────────────┴──────────────────────────────────┘
```

- **mode=page**：主区保持既有 Navigator + StructureMap + Hex（本设计不改 Page 布局合同）。
- **mode=wal**：**禁止**使用 page 32B/行 grid / StructureMap 作为 WAL 行布局。
- **窄屏（&lt;960px）**：查询控件改顶栏堆叠；列表仍为主锚点。

### Record 行：核心列（不得缺省到不可辨识）

| 列 / 区 | 内容 | 备注 |
|---|---|---|
| LSN | `start_lsn`；有则旁注 `end_lsn`（次要字重） | 等宽；**列表不显示 `prev_lsn`**（API 仍可透出） |
| xid | 有则显示 | **第二列**；可空显示 — |
| RM / type | `resource_manager`、`record_type` | 主扫读 |
| 长度 | `record_length`；可得则 `main_data_length` | |
| 摘要 | `description` / `block_ref` | 单行截断 + `title` 全文 |
| FPI | `fpi_length > 0`：折叠芯片「FPI · N bytes」；展开仅元信息 | 见下 |

### FPI

- **默认折叠**：只显示长度/标记；**禁止**默认渲染 8KB/整页内容。
- **展开**：仅增加元信息（`fpi_length`、标记、`block_ref` 摘要等）；仍**禁止**整页/原始字节渲染。
- 无 FPI（`fpi_length = 0` 或等价）：不展示展开控件。

### Hex 占位

- 详情区固定存在「字节 / hex」槽位；文案明确 **WAL v1 不提供原始字节 hex**（禁止伪造 dump）。
- Page 模式 hex 行为不变。

## 流程

1. 启动 / 已连接 → chrome 可见 **Page | WAL**。
2. 选 WAL → 主区换 WAL UI；**不**自动请求大范围批次（`wal_idle`）；连接保持。
3. 用户填 start/end（必填）；可选 **「填入最近窗口」**（废止「填入当前 LSN」双填 tip）→ `GET /api/wal/recent-window?limit=20` → 成功则写入 **start + end**（窗口，非 tip 点）→ **仍须**用户点 Load；**禁止** Fill 后自动 Load。
4. Load → `wal_loading` → 成功 `wal_loaded`：列表约 **最近 20 条**（或更少）；**禁止** tip 点查 Empty batch 冒充成功。失败 → `wal_error`（含 recent-window 已删段等，**不得**把失败结果写成成功窗口）。
5. 点击行 → `wal_record_selected`；换批次成功 → **清空选中**；FPI 全部回到折叠。
6. 切回 Page → Page 主区；会话不断开；缺扩展失败限于该模式请求。

Fill 失败（网络/门禁/BAD_LSN/过大）：保留或清空起终点以实现为准，但须可见错误；**禁止**静默留下假成功 tip 双填。

## 状态

| 状态 | 呈现 | 用户可执行动作 |
|---|---|---|
| 初始（未连） | 连接表单；模式切换可用但 WAL Load 不可成功浏览 | 连接；切模式 |
| `wal_idle` | LSN 空或已填未加载；列表区提示输入区间后 Load | 填 LSN；**填入最近窗口**；Load |
| `wal_loading` | Load/列表局部 spinner；chrome+strip 保留 | 等待 |
| `wal_loaded` | 一行一条列表；条数可见 | 选中；展开 FPI；改区间再 Load |
| 空批次 | 明确空说明（合法区间无 record）；不崩溃 | 改区间；回 Page |
| `wal_record_selected` | 行选中态；详情摘要；hex 占位 | 改选；折叠/展开 FPI |
| `wal_error` | 原因 + ≥1 可执行下一步（扩展/版本/权限/LSN/批次过大等） | 按 nextStep 修正后重试 |
| 部分失败 | N/A（批次要么全成功要么硬错误；无截断部分成功） | — |
| Page 各态 | 沿用既有 ui-design / 实现 | 切 WAL 不强制断连 |

## 表面专属设计

### gui

#### 布局与层级

- Chrome 增加 **分段控件** `Page | WAL`（互斥）；当前模式明确高亮。
- WAL 列表为最大面积；行高紧凑；选中用既有 `--accent` / 表面对比，勿新造紫色主题。
- 查询区约 240–280px 宽（对齐既有 Navigator）；≥1280px 列表与底详情上下分栏。

#### 密度与响应式

- 正文约 13–14px；LSN/数字等宽；8px 间距网格。
- 摘要列截断；加载禁止卸掉 chrome。

#### 焦点与键盘

| 步 | 控件 | 键位 |
|---|---|---|
| 模式 | Page / WAL | Tab；Enter/Space |
| LSN | start/end 输入 | Tab；Enter → Load |
| 填入最近窗口 | 按钮 | Tab；Enter/Space |
| Load | 按钮 | Enter/Space |
| 列表 | 行 | Tab 入列表；↑↓；Enter 选中 |
| FPI | 折叠控件 | Enter/Space 切换 |

- `:focus-visible` 高对比轮廓；沿用既有禁止无替代 `outline: none`。

#### 视觉语义

- 复用既有 CSS 变量（`--bg`、`--surface`、`--text`、`--accent`、`--danger`、`--focus` 等）。
- 错误用 `--danger`；FPI 标记用次要边框/芯片，不抢 LSN/type 主列。

#### 主题策略

- **不新增**本 feature 的主题合同；沿用应用既有 light/dark 切换与 token。
- WAL 表面必须在两套既有主题下保持正文与关键控件可读（回归既有底线，非新需求）。

### cli

N/A（`UI 表面=gui`）。

## 与 Spec 验收映射

| Spec 验收 ID | 本设计落点 |
|---|---|
| P0-1 模式切换 | chrome `Page \| WAL`；主区整页切换 |
| P0-2 路径分离 | WAL 主区独立组件；数据走 WAL API（实现层） |
| P0-3 一行一条 + 宽元数据 | 列表列定义；禁止 32B grid |
| P0-4 选中 | 行点击/键盘选中态 |
| P0-5 hex 不可用 | 详情 hex 占位文案 |
| P0-6 / P0-7 / P0-11 错误 | `wal_error` 面板：原因+下一步 |
| P0-8 / P0-9 FPI | 默认折叠；展开仅元信息 |
| P0-10 Page hex | mode=page 不改 hex 合同 |
| P0-12 monorepo | 同应用壳增量（非独立站） |
| P1-1 空批次 | 空态文案 |
| P1-2 Fill 最近 ~20 | 「填入最近窗口」→ recent-window 写控件；**不**自动 Load；再 Load 见约 20 条；失败可读且不写假窗口 |
| P1-3 切换保留连接 | 切模式不提交密码；失败限于模式请求 |

## 对 Plan / Developer 的要点

- 先壳层模式切换，再 WAL 查询+列表，再 FPI/选中/占位；勿把 WAL 塞进 `StructureMap`。
- 进入 WAL **禁止**自动盲拉；Fill = recent-window，**禁止** tip 双填；批次过大错误展示 Design 硬错误文案（非静默空列表）。
- 验证证据：Fill → 控件为窗口 → 手动 Load → 约 20 行；模式往返；含 FPI 折叠/展开；选中+hex 占位；Page hex 回归。

## 开放阻塞

无。

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-07-30 | 初稿 |
| 2026-07-30 | 增量：Fill → 填入最近窗口（非 tip 双填）；对齐 P1-2 |
| 2026-07-30 | 列表列：仅 start/end LSN（不显示 prev）；xid 为第二列 |

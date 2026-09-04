# UI Design: index-key-decode

> **UI 表面**：gui  
> 依据 Spec：`workflow/docs/features/index-key-decode/spec.md` · 依据 Design：`design.md` · 依据标准：`workflow/docs/standards/ui.md`  
> **主题**：单主题策略延续既有应用 light/dark（Spec 未要求本项新增主题条款；不新增 token/切换义务）。

## 目标与任务

- **主目标**：在 B-tree 详情面板选中任一 index tuple（普通 leaf / posting / pivot downlink / hikey）时，在既有 Key bytes hex 旁阅读按键列顺序的**解码键值**；不支持场景优雅降级为仅 hex（页面其余部分不受影响）。
- **关键任务（优先级）**：加载索引页（自动附带列元数据请求）→ 选中 tuple → 扫读键值行（列名/类型/值）→ 对照下方 hex（既有点击高亮不变）→（P1）点列高亮对应 hex 区间。
- **信息优先级**：键值行 > Key bytes hex（既有，位置不变不降级）> t_info 位格 / t_tid 语义 / posting TID 列表（既有，不动）。

## 信息架构与元信息

### 详情面板内键区（IndexTupleDetail，仅非 metapage 且选中 tuple 时）

```text
┌─ index tuple detail（既有结构不动）───────────────────────┐
│ lp[i] · itemoffset · 徽标（hikey/pivot/posting）           │
│ t_tid 语义行 · itemlen/t_info · t_info 位格（既有）        │
├─ Key values（新，置于 Key bytes 之上）────────────────────┤
│ 1 a (int4) = 42                                            │
│ 2 b (text) = 'hello world'                                 │
│ 3 c (int4) = NULL · include                                │
├─ Key bytes [start..end)（既有 hex 按钮，零改动）───────────┤
│ …（posting TID 列表等既有内容不变）                        │
└───────────────────────────────────────────────────────────┘
```

- **每列一行**（Spec 合同格式）：`{attnum} {name} ({typname}) = {display}`，按 indkey 顺序；>8 行时区域内滚动（不撑爆面板）。
- **NULL**：值位置显示 `NULL`（pivot/hikey 被 suffix-truncation 截掉的尾列与 INCLUDE 列同此呈现，不区分——Spec 裁决局限）。
- **徽标**：`include`（leaf 上 INCLUDE 列）；P1：`↓`（descending）、`nulls first`。
- **降级行级**：不支持类型 `{attnum} {name} ({typname}) — unsupported type: {typname}`；结构错误 `{attnum} {name} ({typname}) — decode error: {reason}`；其后不可步进的列不再显示行，由首个降级行的 reason 说明「该列及之后」。
- **降级索引级**（有键区、无行，单行 muted 标注）：表达式索引 `expression index — key values not decoded (hex only)`；元数据失败 `column metadata unavailable ({code}) — key values not shown (hex only)`。
- **长值截断**（仅 text 族显示层）：>64 字符截断显示 `…`，行尾注 `{n} chars total (showing first 64)`（镜像 hex 64B 截断口径；解码值本身不截断——Spec 合同）。
- metapage：无键值区（既有空态说明不变）。

### 新增 UI 文案（英文，沿 index-viewer 英文合同）

| 文案 | 场景 |
|---|---|
| `Key values` | 键值区标题 |
| `{attnum} {name} ({typname}) = {display}` | 正常行 |
| `NULL` | 空值 |
| `include` / `↓` / `nulls first` | 徽标（后两者 P1） |
| `{n} chars total (showing first 64)` | 长值截断注 |
| `unsupported type: {typname}` | 行级降级 |
| `decode error: {reason}` | 行级结构错误 |
| `expression index — key values not decoded (hex only)` | 索引级降级 |
| `column metadata unavailable ({code}) — key values not shown (hex only)` | 元数据失败 |
| `loading column metadata…` | 元数据加载中 |

## 流程

1. 选定 B-tree 索引 → Load：页面加载照旧（既有流程零变化），同时后台请求列元数据（按 oid 缓存；成功后同索引块导航/Refresh 不再请求）。
2. 选中 tuple（leaf/posting/pivot/hikey）→ 键值区按元数据状态呈现（见状态表）；hex 及全部既有面板行为不变。
3. 连接重建 / 刷新索引列表 → 列元数据缓存清空，下次加载重新请求；切换索引按 oid 复用既有缓存。
4. （P1）点击键值行 → hex 中该列字节区间高亮（复用既有 selection/highlight 机制，id `tuple-{lp}.col-{attnum}`）。

## 状态

| 状态 | 呈现 | 用户可执行动作 |
|---|---|---|
| 初始（未加载页） | 无键值区（既有详情面板状态不变） | 选索引、Load |
| 页面加载中 | 既有页面加载表现（不动） | 等待 |
| 元数据加载中 | 页面已渲染；选中 tuple 时键值区单行 muted `loading column metadata…` | 正常浏览/选中；等待 |
| 空 | metapage / 无 tuple：无键值区（既有空态文案不变） | 导航块 |
| 成功 | 键值行列表（含 NULL/徽标/截断注） | 扫读；P1 点行高亮 hex |
| 错误（元数据失败） | 页面照常渲染；键值区 `column metadata unavailable ({code}) …` 单行标注，hex-only | 重试 = 再次 Load（失败不缓存）；修复连接 |
| 部分失败 | 行级 `unsupported type` / `decode error` / 其后列省略；或索引级 `expression index` 标注 | 阅读 hex；换索引 |
| 页面级错误 | 既有全局错误路径（不动；元数据失败**不**触发） | 按既有 nextStep |

## 表面专属设计

### gui

- **布局与层级**：键值区是详情面板内的一个子区块（`.index-tuple-detail__key` 内、Key bytes hex 按钮之上）；一行一列、等宽字体、值随行换行（`word-break` 防长值撑破）；不新增面板、不改三联区布局（Spec 非目标：不做 UI 布局重排）。
- **密度与响应式**：与 `flag-list` 一致的紧凑行距；区域 `max-height` + 纵向滚动（约 8 行阈值）；窄屏自然换行，无横向滚动。
- **焦点与键盘**：P0 键值行为静态文本（不可聚焦）；P1 升级为 `<button>`（可 Tab、Enter/Space 触发 hex 高亮），`:focus-visible` 高对比轮廓沿用既有 token；徽标非交互。
- **视觉语义**：复用既有 CSS 变量（`--text`/`--muted`/`--accent`/`--danger` 等）；徽标复用 `.detail-badge` 样式；行级降级用 muted + 现有警示色文字（不新造色板）；`NULL` 用 muted 字重区分实值。
- **主题策略**：单主题（Spec 未要求多主题）；沿用应用既有 light/dark 切换，键值区在两套既有主题下保持正文可读（回归底线，非新需求）。

### cli

N/A（`UI 表面=gui`）。

## 与 Spec 验收映射

| Spec 验收 ID | 本设计落点 |
|---|---|
| P0-1 列元数据端点 | 无 UI 落点（API 合同；触发方 = Load 流程步骤 1 的后台请求） |
| P0-2/P0-3/P0-4 值呈现 | 键值行格式与值约定（引号/UTC `Z`/微秒/小写 uuid/true-false） |
| P0-5 NULL | 行值 `NULL` |
| P0-6 多列 | 每列一行按序 |
| P0-7 posting | 选中 posting tuple 时同区呈现（键 = posting TID 行的 SQL 值） |
| P0-8 hikey / pivot | 同区呈现；尾 TID 不入行（P1 另显 `(block,offset)`） |
| P0-9 INCLUDE | leaf 行 `include` 徽标；hikey 中该列 NULL |
| P0-10 表达式降级 | 索引级标注行、无键值行、页面正常 |
| P0-11 不支持类型 | 行级 `unsupported type: {typname}` + 其后省略；纯 jsonb 单列索引：索引级 `unsupported type: jsonb` 标注（hex-only） |
| P0-12 元数据失败 | 状态表「错误」行：含 code、页面照常 |
| P0-13 回归 | hex 块/结构图/守卫链零改动；键值区为纯增量子区块 |
| P1 类型/标注/高亮/TID | `↓`/`nulls first` 徽标、行→hex 高亮（id 约定见流程 4）、pivot 尾 TID `(block,offset)` |

## 对 Plan / Developer 的要点

- 呈现派生逻辑（行模型、截断、徽标、降级文案）进纯模块 `indexKeyDetail.ts` 并单测；`IndexTupleDetail` 仅渲染（design §5）。
- 元数据请求失败与加载中**只**影响键值区：禁止 `setError`、禁止阻塞 `loadState`、禁止全局弹错。
- 新文案以上表为冻结依据，逐字使用；不改动既有 index-viewer 文案。
- 手测清单（入 dev-notes）：加载中标注、断连降级、表达式索引、jsonb 混合列、NULL/include/截断、两套主题可读、hex 联动不回退。

## 开放阻塞

无。

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-08-31 | 初稿：键值区置于 Key bytes 之上；每列一行 + 徽标/NULL/降级标注；元数据加载/失败仅影响键值区；P1 高亮与标注；冻结新增英文文案表 |

# UI Design: layout-chrome-split

> **UI 表面**：gui  
> 依据 Spec：`docs/features/layout-chrome-split/spec.md` · 依据 Design：`design.md` · 依据标准：`docs/standards/ui.md`  
> **主题**：light / dark（沿用前序 Spec；本项不新增主题模式或皮肤包）

## 目标与任务

- **主目标**：在已连接并加载页后，用顶栏完成选表→blkno→加载/刷新；宽屏左右对照结构图与 hex。
- **关键任务（优先级）**：顶栏主控 → 扫读次带元信息 → 主区结构图/hex 浏览与联动 → 主题切换。
- **信息优先级**：结构图 + hex（主内容）> 顶栏主控 > 次带元信息 > 选中详情（结构 pane 内）。

参考截图仅为编排示意（非像素稿）。

## 信息架构与元信息

### 壳层分区（本项目标态）

```text
┌─ 主带 TopChrome ──────────────────────────────────────────────────┐
│ 标题 · 连接状态徽标 · [表 combobox] · [blkno] · Load · Refresh · Theme │
├─ 次带 ContextMeta ────────────────────────────────────────────────┤
│ 连接详情（host:port / db / user · PG version）                      │
│ 表/OID/#blocks · 页统计（page · lower/upper/free · ItemId U/N/R/D · #tup）│
├─ Main（无左侧栏）─────────────────────────────────────────────────┤
│  ≥960 + page_loaded:  [ StructureMap+detail ] ‖ [ Hex ]            │
│  <960  + page_loaded:  StructureMap+detail 上 / Hex 下              │
│  未加载: 连接表单或空态提示（居中/主区）                             │
└───────────────────────────────────────────────────────────────────┘
```

- **禁止**：左侧 Tables/`blkno`/Load 专用栏或空壳占位；密码出现在任一 chrome 带。
- **主带 vs 次带**：主带可操作；次带只读扫读。视觉用分隔线 + 字重区分，勿多枚大卡片。

### 必显字段 × 落点

| 字段 | 时机 | UI 落点 |
|---|---|---|
| 连接状态（disconnected / connecting / connected） | 始终 | 主带徽标（`aria-live` 保留） |
| 表选择、`blkno`、Load、Refresh、主题 | `connected`+（Refresh：`page_loaded`） | 主带 |
| host、port、database、user（无密码） | `connected`+ | 次带连接行；截断 + `title`/`tooltip` |
| PG 完整版本串 | `connected`+ | 次带；截断 + `title` |
| 表限定名、OID、#blocks | 已选表 / `page_loaded` | 次带；未选表占位「未选表」 |
| 当前 blkno | `page_loaded` | 次带（与主带输入同步显示） |
| 页大小、lower/upper/free、ItemId 与 LP 分项、#tup | `page_loaded` | 次带页行；未加载占位「页元信息：加载页后显示」 |

数据源沿用前序 Design（会话非机密 + tables 行 + `page.stats`）；**禁止**第二套手算。

### 表选择形态

- **控件**：原生 `<select>` 或等价 combobox（`role="combobox"` / listbox 模式均可），选项文案：`qualifiedName (N blk)`。
- **范围**：仅 heap 用户表（API 已过滤）；空表列表 → 次带/主区空说明。
- **P1-3**：表很多时，P0 依赖原生 select 滚动即可；可选在 select 旁加过滤输入（不阻塞 Load）。本项 P0 **不强制**过滤框。

## 流程

1. 启动 → 主题（系统偏好）→ 探测会话。
2. 未连接：主带标题+状态+主题；次带「未连接」；主区连接表单。
3. 连接 → 主带选表 → blkno → Load → 主区按断点分栏或堆叠。
4. 次带扫读元信息；结构图 ↔ hex 双向高亮；非 hex 选中 → hex 自动滚（语义不变）。
5. Refresh → 同页 diff；壳层不整页卸装。
6. 主题切换即时换肤；&lt;960 自动堆叠，主控仍在顶栏。

## 状态

| 状态 | 呈现 | 用户可执行动作 |
|---|---|---|
| 初始 `disconnected` | 主带 disconnected + 主题；次带未连接；主区表单 | 连接；主题 |
| 加载（连接） | 表单 disabled + spinner；壳层保留 | 等待；可主题 |
| 加载（拉表） | 表 select 旁局部指示；主带保留 | 等待 |
| 加载（拉页/刷新） | 主区或按钮局部 spinner；**禁止**整页卸 chrome | 等待；刷新中禁用重复 Refresh |
| 空（无用户表） | select 空 + 说明 | 重连；主题 |
| 空（块数 0） | 表已选；Load 禁用；主区空说明 | 换表 |
| 成功 `connected` | 主带可选表；次带连接+版本 | 选表 / Load |
| 成功 `page_loaded` | 分栏或堆叠主内容 + 次带页统计 | 联动；Refresh；主题 |
| `diff_active` | 沿用 diff 高亮 | 再刷新 |
| 错误 | 主区错误面板：原因 + 下一步 | 修正重试 |
| 部分失败（未知列/TOAST） | 沿用基线降级 | 继续浏览 |

## 表面专属设计

### gui

#### 布局与层级

- **主带高度**：约 40–48px，单行优先（控件 `flex` + `gap`；标题可缩短/省略）。
- **次带高度**：约 48–72px（两行元信息）；`overflow` 允许折行，**禁止**不可滚裁切死角（P1-2）。
- **分栏初始比例（宽屏）**：结构图 pane **55%** / hex pane **45%**（`minmax(0, 0.55fr) minmax(0, 0.45fr)` 或等价）；任一侧 `min-width` ≥ 240px，避免完全不可达。
- **Selection detail**：留在结构图 pane 内、网格下方（沿用现组件）；不单独占第三列。
- **Hex 折叠**：宽屏允许折叠；折叠后右 pane 保留折叠控件与简短占位，**禁止**把结构图偷偷拉满后无法再展开的死角（展开控件须仍可见）。
- 元信息**不得**用大卡片墙盖住主视图。

#### 密度与响应式

| 视口 | 行为 |
|---|---|
| ≥960px + 已加载页 | 左右并排；两 pane 同时可见（可各自内滚） |
| &lt;960px + 已加载页 | 上下堆叠；结构上、hex 下；各自可滚 |
| 极窄顶栏 | 主带允许折行（表/blkno/按钮换行）；次带折行；P1-2 |

- 断点权威：CSS `min-width: 960px`（见 Design §4）。
- 正文字号约 13–14px；次带等宽值；8px 间距网格。
- 加载/刷新：**禁止**无意义整页壳层跳动（P0-12）。

#### 焦点与键盘（P0-11）

| 步 | 控件 | 键位 |
|---|---|---|
| 选表 | 顶栏 select/combobox | Tab；↑↓/字母跳转（原生）；Enter 确认（若自定义） |
| blkno | 数字输入 | Tab；Enter → 触发 Load（推荐） |
| Load / Refresh | 按钮 | Tab；Enter/Space |
| 主题 | 切换按钮 | Tab；Enter/Space |
| 结构图/hex/折叠 | 沿用前序 | 不变 |

- `:focus-visible` 高对比轮廓（两主题可见）。
- 自动滚动**禁止**抢走结构图字段焦点。

#### 视觉语义

- **复用**既有 CSS 变量（`--bg`、`--surface`、`--text`、`--accent`、`--focus`、区域色、`--hex-hl`、`--diff`、`--field-selected`、`--hex-locate`）。
- 本项可微调 chrome/strip 间距与分隔；**禁止**新造主题模式。
- 主带控件对齐基线；状态徽标 `connected` 用既有 `.badge.ok`。

#### 主题策略

| 项 | 决策 |
|---|---|
| 模式 | `light` \| `dark`（沿用） |
| 入口 | 主带右侧 Theme 按钮（可访问名保留） |
| 默认 / 记忆 | 沿用 `theme.ts`（系统偏好；已有 localStorage 则保持） |
| 本项 | **不**改默认策略语义；仅保证入口不被布局移除 |

### cli

N/A（`UI 表面=gui`）

## 与 Spec 验收映射

| Spec 验收 ID | 本设计落点 |
|---|---|
| P0-1 | 主带表/blkno/Load；无侧栏主路径 |
| P0-2 | 主带 Refresh；`page_loaded` 后可用 |
| P0-3 | 无 `.nav` / 空壳；主区全宽给 split |
| P0-4 | 主带+次带字段表；截断+title；主内容优先 |
| P0-5 | 主带徽标 + Theme |
| P0-6 | ≥960 左右 55/45；图左 hex 右 |
| P0-7 | &lt;960 上下堆叠；主控仍在顶栏 |
| P0-8 | 双 pane 可见下双向高亮 |
| P0-9 | hex 容器内自动滚；宽屏不拖垮结构图 |
| P0-10 | 不改 core/API（Design）；UI 无第二解析 |
| P0-11 | 键盘路径表 |
| P0-12 | 局部加载指示；壳层稳定 |
| P1-1 | N/A（P0 不做拖拽分隔） |
| P1-2 | 极窄顶栏折行 |
| P1-3 | 原生 select 滚动；过滤可选 |

## 对 Plan / Developer 的要点

- 实施顺序：删侧栏 + 主带主控 → 次带元信息迁入/美化 → `.main-split` + 960 断点 → 联动/自动滚手测 → 键盘与主题回归 → README 壳层说明。
- 手测证据：宽屏左右截图；窄屏堆叠截图；顶栏无侧栏；次带必显字段清单勾选；结构图→hex 高亮+自动滚；hex→结构图；键盘走通选表→blkno→Load→主题；light/dark 各一。
- 遵守 `docs/standards/ui.md`；不以「更现代」加回侧栏或省略次带字段。

## 开放阻塞

none（Spec Q1–Q6 与必显元信息已确认。）

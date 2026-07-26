# Design: layout-chrome-split

## 背景

在已合入的 `pg-page-viewer` + `page-diagram-32b` 之上做**前端壳层布局增量**：顶栏主控、左侧栏移除、宽屏结构图‖hex 左右并排。路径 `full`；Spec 与 Q1–Q6（含第三轮微调）已确认。本 Design 只定模块边界、分层与选型；信息架构与视觉见 `ui-design.md`。

**第三轮增量（已批准）**：主带固定顺序标题 → connected → Collapse hex → Theme；表控下移次带；连接详情收入徽标 hover/聚焦；Collapse **仅**主带入口；表/页统计空态空白。左右分栏与 960 断点**不回退**。

**第四轮 UI 细化**：hex 展开时移除 pane-head 标签；折叠时条件渲染移除整个 hex pane，Grid 切为结构图单栏。状态仍由 `App.hexCollapsed` 管理，不新增模块或依赖。

**约束摘要（不可偏离）**

- 纯前端；**禁止**改 `page-core` 解析语义、字段边界、字节映射；**禁止**改后端 API。
- 断点 **960px**；≥960 结构图左 ‖ hex 右；&lt;960 上下堆叠（图上 hex 下）。
- light/dark、双向高亮、hex 自动滚动、键盘可达——沿用前序，本项不削弱。
- 左侧 Tables 专用栏**完全移除**（无空壳）。

## 方案对比与决策

### 1. 变更落点与包边界

| 方案 | 概要 | 优点 | 缺点 |
|---|---|---|---|
| A | **仅改 `apps/web`（App 壳层 + CSS；StructureMap/HexDump 包装与滚动容器微调）** | 与 Spec「API N/A / 不改 page-core」一致；风险面最小 | 壳层逻辑仍集中在 `App.tsx` |
| B | 为布局抽公共包或改 server 下发布局提示 | — | 超出范围；易滑向预渲染布局 |
| C | 改 `page-core` 以适配新容器 | — | 违反 Spec |

**决策: A**。

| 包 | 本项 | 禁止 |
|---|---|---|
| `apps/web` | 顶栏重组、移除 `.nav`、主区分栏、断点样式、表 combobox 接线、Collapse/连接 hover | 另写解析/格式化；改 API 客户端合同语义 |
| `packages/page-core` | **不改** | 解析、`deriveStructureFields`、`computeHexScrollTarget` 等语义变更 |
| `apps/server` | **不改** | 新路由或布局载荷 |

依赖方向不变（`web → page-core` / `web → server`）；不新增依赖。

### 2. 壳层组件拆分

| 方案 | 概要 | 优点 | 缺点 |
|---|---|---|---|
| A | **在 `App.tsx` 内重组 DOM；可选抽 `TopChrome` / `ContextMeta` 纯展示子组件（同目录）** | 改动可审；子组件可选、不强制新目录 | 文件仍可能偏长 |
| B | 引入路由/状态库重写壳 | — | 过度工程 |
| C | 保留 `.nav` 仅 `display:none` | 实现快 | 违反「完全移除、无空壳」 |

**决策: A**。允许抽 1–2 个壳层子组件以降低 `App.tsx` 噪音；**禁止**保留隐藏侧栏。表列表数据源仍为既有 `listTables()`；UI 形态为顶栏次带 `<select>` / combobox（见 UI）。

### 3. 主区分栏实现

| 方案 | 概要 | 优点 | 缺点 |
|---|---|---|---|
| A | **CSS Grid + `@media (min-width: 960px)`；两 pane 各自 `overflow: auto`；初始比例由 UI Design 锁定** | 无新依赖；断点与 Spec 对齐；滚动边界清晰 | 可调分隔为 P1 |
| B | JS `matchMedia` 切换两套布局树 | 可细控 | 易造成加载跳动；双树维护成本高 |
| C | 第三方 split-pane 库 | 拖拽开箱 | 本项 P0 不要求可调；增依赖 |

**决策: A**。

```text
.main-split
  ├── .pane-structure  (StructureMap：图 + Selection detail；overflow:auto)
  └── .pane-hex        (仅展开时渲染；HexDump；无 pane-head/Collapse；overflow:auto / HexDump 内滚)
```

| 视口 | 布局 |
|---|---|
| ≥960px 且 `page_loaded` | `grid-template-columns: <左> <右>`（比例见 UI）；单行 |
| &lt;960px 或未加载页 | 单列：结构上、hex 下（未加载时主区仍为连接/空态，无分栏） |

- **滚动边界**：结构图 pane 与 hex 滚动容器分离；`hexLocate` **只**滚 hex 容器；宽屏**禁止**因定位滚动整页 `.main`。
- **Collapse**：`hexCollapsed` 仍在 `App`；入口**仅**主带。折叠时不渲染 `.pane-hex`，`.main-split` 使用单列让结构图占满；禁止保留标签、占位文案或空右列。Show hex 后恢复原 pane，≥960px 恢复左右分栏（见 UI）。
- **P1-1** 可调分隔：P0 **不做**。

### 4. 断点判定权威

| 方案 | 概要 | 优点 | 缺点 |
|---|---|---|---|
| A | **以 CSS 媒体查询为布局权威**（`min-width: 960px`） | 与视口真实布局一致；无 hydration 双态 | 测试需浏览器/手测 |
| B | 仅 JS `window.innerWidth` 切换 class | 易单测布尔 | 与 CSS 不同步风险 |

**决策: A**。JS 不另维护「宽/窄」业务状态；手测/QA 以 DevTools 视口宽度为准。

### 5. 顶栏状态与数据流

壳层状态仍全部在 `App`（或提升后的等价根组件）：

- 连接 / 表 / blkno / loadState / page / theme / selection / hexLocate / freeCollapsed / hexCollapsed — **语义不变**（仅 DOM 落点变更）。
- **主带（固定顺序）**：标题 → connected 徽标 → Collapse hex（`page_loaded`）→ Theme。
- **次带**：表 select + blkno + Load/Refresh；其后表/页统计（空态见 UI）。
- **连接详情**：host/port/database/user + PG 版本串挂在 connected 徽标（hover/聚焦）；**禁止**次带常驻；**禁止**为布局新增 API。

```text
[connected]
    │
    ▼
 TopChrome 主带: 标题 · badge(+conn popover) · Collapse hex · Theme
 ContextMeta 次带: table select · blkno · Load/Refresh · [page stats if page_loaded]
    │
    ▼
 .main（无 .nav）
    └── .main-split（page_loaded 时）
          ├── hex 展开 → StructureMap ‖ HexDump（无 pane-head/Collapse）
          └── hex 折叠 → StructureMap（单栏占满）
```

### 6. Hex 自动滚动与左右布局

既有 `selectByteRange` / `hexLocate` / `HexDump` effect **保留**。布局变更后须保证：

1. Hex 滚动容器 ref 仍指向实际可滚的 hex 内容区。
2. 宽屏双可见时，定位**不得**强制滚动结构图 pane。
3. 窄屏堆叠时，若 hex 面板完全不可见，**允许**一次最小幅度滚主区使 hex 可见；部分可见则禁止。

**禁止**为适配分栏改 `page-core` 的 `computeHexScrollTarget`。

### 7. 连接详情呈现（结构选型）

| 方案 | 概要 | 优点 | 缺点 |
|---|---|---|---|
| A | **徽标可聚焦 + 原生 `title` + CSS `:hover`/`:focus-visible` 浮层（无新依赖）** | 满足 Spec hover+键盘；零依赖 | 浮层需手写 a11y |
| B | 引入 popover/tooltip 组件库 | 能力全 | 超范围依赖 |
| C | 次带常驻截断行 | — | 违反第三轮合同 |

**决策: A**。浮层文案与 `title` 同源（会话非机密字段）；**禁止**密码；细节见 `ui-design.md`。

## 与 Spec 合同对齐

| Spec 合同 | Design 落实 |
|---|---|
| API N/A / 不改 page-core | §1 |
| 左侧栏完全移除 | §2 |
| 主带顺序 / Collapse 唯一入口 | §5、§3 |
| 表控在次带；连接徽标可达 | §5、§7 |
| 960 / 左右 / 上下（不回退） | §3–§4 |
| 双向高亮 / hex 自动滚 | §3 滚动边界 + §6 |
| 主题 / 连库状态 | chrome 主带；`theme.ts` 不改合同 |
| 表/页统计空态 | UI Design；无第二套统计计算 |

## 模块影响

| 路径 | 预期 |
|---|---|
| `apps/web/src/App.tsx` | 第四轮仅删 hex pane-head 标签；按 `hexCollapsed` 条件渲染整个 hex pane |
| `apps/web/src/styles.css` | 折叠态 Grid 单栏/结构图占满；清理 pane-head 与折叠占位样式 |
| `apps/web/src/StructureMap.tsx` / `HexDump.tsx` | 尽量少改；pane 内滚与 a11y |
| `apps/web/src/theme.ts` / `api.ts` / `diff.ts` | **预期不改** |
| `packages/page-core/**` / `apps/server/**` | **禁止改** |

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| Hex 滚动容器被 pane 嵌套破坏自动定位 | P0-9 失败 | 手测宽/窄；确认 ref；禁止 `scrollIntoView` 牵动结构图 |
| 折叠后仅主带可展开，用户找不到 | P0-13 UX | 主带按钮文案在折叠态为 Show hex；保持其为唯一入口 |
| 折叠后 Grid 仍保留第二轨 | 结构图未占满、出现空右列 | 条件渲染 pane，并显式应用单栏 Grid；手测边框/间距/可用宽度 |
| 连接浮层不可键盘达 | P0-14/P0-11 失败 | 徽标可聚焦 + title；手测 Tab→徽标 |
| 空态仍堆砌 —/N/A | P0-15 失败 | 未 `page_loaded` 整块不渲染统计 |
| 误改 core/API | P0-10 失败 | Diff 白名单；仅 `apps/web` |
| 宽屏分栏被顶栏改动回退 | P0-6 失败 | 禁止改 `.main-split` 宽屏规则；回归手测 |

### 开放风险（需 Manager / Analyst）

**无。** 若实施中发现必须改 API 或 `page-core` 语义，**停止**并回 Manager 修订 Spec。

## 对 Plan 与 Developer 的要点

### Plan

- 基线 T1–T14 已落地；第四轮以 **T15–T16** 删除 Hex 标签与折叠占位列。
- 验证：L2 + 定向手测（展开无标签；折叠无文案/右列；Show hex 恢复宽屏左右）。
- Review 门禁 `required`：进入 QA 前须 Approve。

### Developer

- 源分支 `layout-chrome-split` → 目标 `main`（在既有分支上增量）。
- **禁止**改 `packages/page-core`、`apps/server`。
- **禁止**回退宽屏左右分栏或恢复侧栏。
- 保留 `selectByteRange` / `hexLocate` / 主题 / 刷新 diff 语义。
- 不像素复刻参考截图。

# Design: layout-chrome-split

## 背景

在已合入的 `pg-page-viewer` + `page-diagram-32b` 之上做**前端壳层布局增量**：顶栏主控上移、左侧 Tables 专用栏移除、宽屏结构图‖hex 左右并排。路径 `full`；Spec 与 Q1–Q6 已确认。本 Design 只定模块边界、分层与选型；信息架构与视觉见 `ui-design.md`。

**约束摘要（不可偏离）**

- 纯前端；**禁止**改 `page-core` 解析语义、字段边界、字节映射；**禁止**改后端 API。
- 断点 **960px**；≥960 结构图左 ‖ hex 右；&lt;960 上下堆叠（图上 hex 下）。
- 顶栏主带 / 次带编排与必显元信息、light/dark、双向高亮、hex 自动滚动、键盘可达——沿用前序，本项不削弱。
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
| `apps/web` | 顶栏重组、移除 `.nav`、主区分栏、断点样式、表 combobox 接线 | 另写解析/格式化；改 API 客户端合同语义 |
| `packages/page-core` | **不改** | 解析、`deriveStructureFields`、`computeHexScrollTarget` 等语义变更 |
| `apps/server` | **不改** | 新路由或布局载荷 |

依赖方向不变（`web → page-core` / `web → server`）；不新增依赖。

### 2. 壳层组件拆分

| 方案 | 概要 | 优点 | 缺点 |
|---|---|---|---|
| A | **在 `App.tsx` 内重组 DOM；可选抽 `TopChrome` / `ContextMeta` 纯展示子组件（同目录）** | 改动可审；子组件可选、不强制新目录 | 文件仍可能偏长 |
| B | 引入路由/状态库重写壳 | — | 过度工程 |
| C | 保留 `.nav` 仅 `display:none` | 实现快 | 违反「完全移除、无空壳」 |

**决策: A**。允许抽 1–2 个壳层子组件以降低 `App.tsx` 噪音；**禁止**保留隐藏侧栏。表列表数据源仍为既有 `listTables()`；UI 形态改为顶栏 `<select>` / combobox（见 UI）。

### 3. 主区分栏实现

| 方案 | 概要 | 优点 | 缺点 |
|---|---|---|---|
| A | **CSS Grid + `@media (min-width: 960px)`；两 pane 各自 `overflow: auto`；初始比例由 UI Design 锁定** | 无新依赖；断点与 Spec 对齐；滚动边界清晰（联动/自动滚仍限各 pane） | 可调分隔为 P1 |
| B | JS `matchMedia` 切换两套布局树 | 可细控 | 易造成加载跳动；双树维护成本高 |
| C | 第三方 split-pane 库 | 拖拽开箱 | 本项 P0 不要求可调；增依赖 |

**决策: A**。

```text
.main-split
  ├── .pane-structure  (StructureMap：图 + Selection detail；overflow:auto)
  └── .pane-hex        (hex 折叠控件 + HexDump；overflow:auto / HexDump 内滚)
```

| 视口 | 布局 |
|---|---|
| ≥960px 且 `page_loaded` | `grid-template-columns: <左> <右>`（比例见 UI）；单行 |
| &lt;960px 或未加载页 | 单列：结构上、hex 下（未加载时主区仍为连接/空态，无分栏） |

- **滚动边界**：结构图 pane 与 hex 滚动容器分离。`hexLocate` / `computeHexScrollTarget` **只**滚 hex 容器（沿用 `page-diagram-32b`）；宽屏时**禁止**因定位滚动整页 `.main` 导致结构图跳动（面板已同屏时尤其禁止）。
- **P1-1** 可调分隔：本项 P0 **不做**；若做则在既有 grid 上加拖拽，不换架构。

### 4. 断点判定权威

| 方案 | 概要 | 优点 | 缺点 |
|---|---|---|---|
| A | **以 CSS 媒体查询为布局权威**（`min-width: 960px`） | 与视口真实布局一致；无 hydration 双态 | 测试需浏览器/手测 |
| B | 仅 JS `window.innerWidth` 切换 class | 易单测布尔 | 与 CSS 不同步风险；resize 抖动 |

**决策: A**。JS 不另维护「宽/窄」业务状态；手测/QA 以 DevTools 视口宽度为准。

### 5. 顶栏状态与数据流

壳层状态仍全部在 `App`（或提升后的等价根组件）：

- 连接 / 表 / blkno / loadState / page / theme / selection / hexLocate / freeCollapsed — **语义不变**。
- 主控从 `.nav` **搬迁**到顶栏主带；次带承接原 Context strip 必显字段。
- **禁止**为布局新增 API 或第二套元信息计算；页统计仍只读 `page.stats`（core 同源）。

```text
[connected]
    │
    ▼
 TopChrome 主带: badge · table select · blkno · Load/Refresh · Theme
 ContextMeta 次带: conn/PG · table/oid/#blocks · page stats…
    │
    ▼
 .main（无 .nav）
    └── .main-split（page_loaded 时）→ StructureMap ‖ HexDump
```

### 6. Hex 自动滚动与左右布局

既有 `selectByteRange` / `hexLocate` / `HexDump` effect **保留**。布局变更后须保证：

1. Hex 滚动容器 ref 仍指向实际可滚的 hex 内容区（右 pane 或窄屏下方 pane 内）。
2. 宽屏双可见时，定位**不得**强制滚动结构图 pane。
3. 窄屏堆叠时，若 hex 面板完全不可见，**允许**一次最小幅度滚主区使 hex 可见（沿用前序「允许」语义）；部分可见则禁止。

**禁止**为适配分栏改 `page-core` 的 `computeHexScrollTarget`。

## 与 Spec 合同对齐

| Spec 合同 | Design 落实 |
|---|---|
| API N/A / 不改 page-core | §1 |
| 左侧栏完全移除 | §2 决策 C 排除；DOM 删除 `.nav` |
| 顶栏主控唯一入口 | §5 主带 |
| 960 / 左右 / 上下 | §3–§4 |
| 双向高亮 / hex 自动滚 | §3 滚动边界 + §6；选中状态机不变 |
| 主题 / 连库状态 | chrome 主带保留；`theme.ts` 不改合同 |
| 分栏比例 | UI Design 定初始值；P1 可调 |

## 模块影响

| 路径 | 预期 |
|---|---|
| `apps/web/src/App.tsx` | 移除 nav；顶栏主/次带；主区 `.main-split` 包装 |
| `apps/web/src/styles.css` | 删/停用 `.nav`/`.body` 双列；顶栏与分栏 grid；`--nav-w` 移除 |
| `apps/web/src/StructureMap.tsx` / `HexDump.tsx` | 尽量少改；确保 pane 内滚与 a11y；必要时 class 适配 |
| `apps/web/src/theme.ts` / `api.ts` / `diff.ts` | **预期不改** |
| `packages/page-core/**` / `apps/server/**` | **禁止改** |

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| Hex 滚动容器被 pane 嵌套破坏自动定位 | P0-9 失败 | 手测宽/窄；确认 ref 仍在可滚 hex 根；禁止用 `scrollIntoView` 牵动结构图 |
| 顶栏挤占主视图高度 | P0-4「元信息不淹没主视图」失败 | 主带单行优先；次带紧凑；极窄折行见 UI P1-2 |
| 误留隐藏侧栏 | P0-3 失败 | Review 查 DOM：无 `.nav` / 等价空壳 |
| 误改 core/API | P0-10 失败 | Diff 边界审查；Plan 触碰路径白名单 |
| 宽屏 CSS 与手测视口差 1px | P0-6/7 争议 | 合同为 **960px**；`min-width: 960px` = 宽屏 |

### 开放风险（需 Manager / Analyst）

**无。** 若实施中发现必须改 API 或 `page-core` 语义，**停止**并回 Manager 修订 Spec；禁止自行扩范围。

## 对 Plan 与 Developer 的要点

### Plan

- 顺序：顶栏主控上移 + 删侧栏 → 次带元信息 → 主区 grid 分栏与断点 → 联动/自动滚回归手测 → 键盘/主题/加载稳定 → 文档。
- 验证：L2 = 既有 `page-core`/server 测试 + web typecheck/build（本项无新纯函数必测）；L3/手测覆盖 P0-1..P0-12 布局与联动。
- Review 门禁 `required`：进入 QA 前须 Approve。

### Developer

- 源分支 `layout-chrome-split` → 目标 `main`。
- **禁止**改 `packages/page-core`、`apps/server`。
- 删除侧栏 DOM/CSS，勿 `display:none` 应付。
- 保留 `selectByteRange` / `hexLocate` / 主题 / 刷新 diff 语义。
- 不像素复刻参考截图。

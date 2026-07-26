# UI Design: layout-chrome-split

> **UI 表面**：gui  
> 依据 Spec：`docs/features/layout-chrome-split/spec.md` · 依据 Design：`design.md` · 依据标准：`docs/standards/ui.md`  
> **主题**：light / dark（沿用前序 Spec；本项不新增主题模式或皮肤包）  
> **第三轮（已批准）**：主带固定顺序；Collapse 唯一入口；连接详情徽标 hover；次带表控 + 空态空白。

## 目标与任务

- **主目标**：次带完成选表→blkno→加载/刷新；宽屏左右对照结构图与 hex；主带只保留状态/折叠/主题。
- **关键任务（优先级）**：次带主控 → 扫读次带页统计（`page_loaded`）→ 主区结构图/hex → 主带 Collapse / Theme → 徽标查看连接详情。
- **信息优先级**：结构图 + hex（主内容）> 次带主控 > 次带页统计 > 主带状态/折叠/主题 > 连接详情（按需）。

参考截图仅为编排示意（非像素稿）。

## 信息架构与元信息

### 壳层分区（第三轮目标态）

```text
┌─ 主带 TopChrome（固定顺序）──────────────────────────────────────┐
│ 标题 · connected 徽标 · [Collapse hex] · Theme                    │
│          └─ hover/focus → 连接详情 + PG 版本（非次带常驻）          │
├─ 次带 ContextMeta ────────────────────────────────────────────────┤
│ [表 combobox] · [blkno] · Load · Refresh · | · 表/页统计（见空态） │
├─ Main（无左侧栏）─────────────────────────────────────────────────┤
│  ≥960 + page_loaded:  [ StructureMap+detail ] ‖ [ Hex 标签 + dump ]│
│  <960  + page_loaded:  StructureMap+detail 上 / Hex 下              │
│  未加载: 连接表单或空态提示（居中/主区）                             │
└───────────────────────────────────────────────────────────────────┘
```

- **禁止**：左侧专用栏/空壳；密码；次带常驻长连接串/PG 版本；hex 面板内 Collapse；宽屏回退为上下唯一布局。
- **主带 vs 次带**：主带 = 身份/状态/折叠/主题；次带 = 主控 +（`page_loaded` 时）页统计。分隔线区分，勿大卡片墙。

### 主带控件顺序（锁定）

从左到右、**禁止重排**：

1. 标题（`pg-page-viewer`）
2. 连接状态徽标（`disconnected` / `connecting…` / `connected`）
3. **Collapse hex**（仅 `page_loaded` 后出现；折叠态文案 **Show hex**）
4. **Theme**（始终在 Collapse **右侧**）

### Hex 面板控件处置

| 控件 | 决策 |
|---|---|
| Collapse / Show hex | **移除**自 hex 面板；**仅**主带入口（P0-13） |
| `HEX` / `Hex` 标签 | **保留**于 `.pane-head`（非折叠装饰，便于识别右栏） |
| 折叠占位文案 | 折叠后右 pane 内简短「Hex collapsed」即可；展开靠主带 Show hex |

### 连接详情交互（P0-14）

- **默认**：次带**不**渲染 host/port/db/user 或 PG 版本占行。
- **指针**：hover connected 徽标 → 显示浮层（CSS popover），多行：
  - `host:port / database / user`（无密码）
  - PostgreSQL 完整版本串
- **键盘**：徽标在 `connected` 时可聚焦（`tabindex="0"` 或等价 button）；`:focus-visible` 同样显示浮层；另设同源 `title` 作为兜底全文。
- 长文本浮层内可换行；**禁止**截断后无全文可达路径。

### 必显字段 × 落点

| 字段 | 时机 | UI 落点 |
|---|---|---|
| 连接状态 | 始终 | 主带徽标（`aria-live` 保留） |
| host、port、database、user（无密码） | `connected`+ | **徽标** hover/focus 浮层 + `title`；非次带常驻 |
| PG 完整版本串 | `connected`+ | 同上 |
| Collapse hex / Show hex | `page_loaded` | **主带**，Theme 左侧 |
| Theme | 始终 | 主带最右（Collapse 之后） |
| 表选择、`blkno`、Load、Refresh | `connected`+（Refresh：`page_loaded`） | **次带**左侧主控区 |
| 表限定名、OID、#blocks、当前 blkno、页大小、lower/upper/free、ItemId 与 LP 分项、#tup | **仅 `page_loaded`** | 次带主控**之后**的统计区；可扫读 |

数据源沿用会话非机密 + tables 行 + `page.stats`；**禁止**第二套手算。

### 表/页统计空态（P0-15）

| 条件 | 统计区呈现 |
|---|---|
| 未选表，或已选表但未 `page_loaded` | **空白**：整块不渲染统计项；**禁止** `—` / `N/A` /「未选表」/「加载页后显示」等占位噪音堆砌 |
| `page_loaded` | 渲染完整必显清单（见上表） |

次带在空态时仍只显示表控（select / blkno / Load；Refresh 按可用性禁用），其后统计位留空即可。

### 表选择形态

- **控件**：原生 `<select>` 或等价 combobox；选项：`qualifiedName (N blk)`。
- **范围**：仅 heap 用户表；空表列表 → 主区空说明（非统计区堆砌）。
- **P1-3**：P0 依赖原生 select 滚动；过滤框不强制。

## 流程

1. 启动 → 主题（系统偏好）→ 探测会话。
2. 未连接：主带标题+disconnected+Theme；次带可空或极简「未连接」一句（**非**统计占位墙）；主区连接表单。
3. 连接 → 次带选表 → blkno → Load → 主区按断点分栏；主带出现 Collapse hex。
4. `page_loaded` 后次带统计可扫读；结构图 ↔ hex 联动不变。
5. Hover/Tab 至 connected 徽标 → 读连接详情与 PG 版本。
6. 主带 Collapse → 折叠 hex（面板内无重复按钮）；Show hex 展开。
7. Refresh / Theme / 窄屏堆叠行为沿用前序，不削弱。

## 状态

| 状态 | 呈现 | 用户可执行动作 |
|---|---|---|
| 初始 `disconnected` | 主带 disconnected + Theme；次带无表控/无统计噪音；主区表单 | 连接；主题 |
| 加载（连接） | 表单 disabled + spinner；壳层保留 | 等待；可主题 |
| 加载（拉表） | 次带 select 旁局部指示 | 等待 |
| 加载（拉页/刷新） | 主区或按钮局部 spinner；**禁止**整页卸 chrome | 等待 |
| 空（无用户表） | select 空 + 主区说明 | 重连；主题 |
| 空（块数 0） | 表已选；Load 禁用；主区空说明；统计空白 | 换表 |
| 成功 `connected`（未加载页） | 次带可表控；**统计空白**；徽标可查连接 | 选表 / Load；hover 连接 |
| 成功 `page_loaded` | 分栏/堆叠 + 次带统计 + 主带 Collapse | 联动；Refresh；Collapse；主题 |
| `diff_active` | 沿用 diff 高亮 | 再刷新 |
| 错误 | 主区错误面板：原因 + 下一步 | 修正重试 |
| 部分失败（未知列/TOAST） | 沿用基线降级 | 继续浏览 |

## 表面专属设计

### gui

#### 布局与层级

- **主带高度**：约 40–48px，单行；顺序锁定（见上）。
- **次带高度**：约 40–72px；主控单行优先，统计可折行；**禁止**不可滚裁切死角（P1-2）。
- **分栏初始比例（宽屏）**：结构 **55%** / hex **45%**；任一侧 `min-width` ≥ 240px。**禁止**因顶栏微调改回宽屏上下唯一布局。
- **Selection detail**：留在结构图 pane 内。
- **Hex 折叠**：由主带控制；折叠后右 pane 保留 Hex 标签 + 短占位；展开入口仅在主带。
- 元信息**不得**用大卡片墙盖住主视图。

#### 密度与响应式

| 视口 | 行为 |
|---|---|
| ≥960px + 已加载页 | 左右并排；图左 hex 右；两 pane 同时可见 |
| &lt;960px + 已加载页 | 上下堆叠；结构上、hex 下 |
| 极窄顶栏 | 主带/次带允许折行；P1-2 |

- 断点权威：CSS `min-width: 960px`。
- 正文字号约 13–14px；统计等宽值；8px 间距网格。
- 加载/刷新：**禁止**无意义整页壳层跳动（P0-12）。

#### 焦点与键盘（P0-11）

| 步 | 控件 | 键位 |
|---|---|---|
| 连接详情 | connected 徽标 | Tab 聚焦 → 浮层/`title` 全文 |
| 选表 | 次带 select | Tab；↑↓ |
| blkno | 数字输入 | Tab；Enter → Load（推荐） |
| Load / Refresh | 按钮 | Tab；Enter/Space |
| Collapse hex | 主带按钮（`page_loaded`） | Tab；Enter/Space |
| 主题 | 主带 Theme | Tab；Enter/Space |
| 结构图/hex | 沿用前序 | 不变 |

- 推荐 Tab 顺序（`connected` + `page_loaded`）：徽标 → 表 → blkno → Load → Refresh → Collapse → Theme → 主内容。
- `:focus-visible` 高对比轮廓；自动滚动**禁止**抢走结构图字段焦点。

#### 视觉语义

- **复用**既有 CSS 变量；可微调 chrome 间距与 conn 浮层。
- **禁止**新造主题模式。
- 状态徽标 `connected` 用既有 `.badge.ok`；浮层用 `--surface` / 边框，避免挡住主带关键按钮。

#### 主题策略

| 项 | 决策 |
|---|---|
| 模式 | `light` \| `dark`（沿用） |
| 入口 | 主带最右 Theme（Collapse 右侧） |
| 默认 / 记忆 | 沿用 `theme.ts` |
| 本项 | **不**改默认策略语义 |

### cli

N/A（`UI 表面=gui`）

## 与 Spec 验收映射

| Spec 验收 ID | 本设计落点 |
|---|---|
| P0-1 | 次带表/blkno/Load；无侧栏；主控不在主带 |
| P0-2 | 次带 Refresh；`page_loaded` 后可用 |
| P0-3 | 无 `.nav` / 空壳 |
| P0-4 | 主带固定顺序；次带表控+统计；连接不次带常驻 |
| P0-5 | 主带徽标 + Theme |
| P0-6 | ≥960 左右 55/45；图左 hex 右；不回退 |
| P0-7 | &lt;960 上下；主带 Collapse/Theme 与次带主控仍可用 |
| P0-8 | 双 pane 可见下双向高亮 |
| P0-9 | hex 容器内自动滚；宽屏不拖垮结构图 |
| P0-10 | 不改 core/API |
| P0-11 | 键盘路径表（含徽标连接详情） |
| P0-12 | 局部加载指示；壳层稳定 |
| P0-13 | Collapse 仅主带、Theme 左；hex pane 无折叠按钮；保留 Hex 标签 |
| P0-14 | 徽标 hover/focus 浮层 + title |
| P0-15 | 未选表/未 `page_loaded` 统计整块空白 |
| P1-1 | N/A（P0 不做拖拽） |
| P1-2 | 极窄折行 |
| P1-3 | 原生 select 滚动 |

## 对 Plan / Developer 的要点

- **增量**相对已落地 T1–T8：重排主/次带；Collapse 迁主带并删 hex 内按钮；连接详情进徽标；统计空态去占位。
- **禁止**改动宽屏 `.main-split` 左右规则（回归 P0-6）。
- 手测证据优先：主带 DOM 顺序；hex pane 无 Collapse；未加载时统计空白；徽标 hover+Tab；≥960 仍左右。
- 遵守 `docs/standards/ui.md`。

## 开放阻塞

none（Spec 第三轮含微调已批准；tooltip vs popover 由本文件定为 CSS 浮层 + `title`。）

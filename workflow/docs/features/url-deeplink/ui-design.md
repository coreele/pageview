# UI Design: url-deeplink

> **UI 表面**：gui
> 依据 Spec：`workflow/docs/features/url-deeplink/spec.md` · 依据标准：`workflow/docs/standards/ui.md` · 依据结构设计：`design.md`
> 主题：沿用既有 light/dark（localStorage 持久化）；本特性不新增主题参数（Spec 非目标）。

## 目标与任务

用户目标（Spec 四用户故事）：复制地址栏分享当前视图、收藏书签直达、新 tab 并排对照、F5 刷新恢复。本特性**不改变任何页面布局**——全部用户可见变化集中在三处表面：浏览器地址栏（chrome 级）、启动/后退还原过程（复用既有加载指示）、`BAD_URL_PARAM` 错误呈现（复用既有错误面板）。

关键任务与信息优先级：①地址栏始终可复制且与当前已提交视图一致；②还原过程有进行中反馈、不空白不跳动；③失效参数报错后应用仍可用。

## 信息架构与元信息

无新增界面元素、无新增元信息字段（Spec 未要求展示 URL 参数说明）。地址栏本身即信息载体；页面内不渲染参数 echo。

## 流程

1. **编码（正向）**：选择表/索引/过滤器或切换模式/种类 → 地址栏即时更新（同视图演化，不新增历史）；输入 blkno/LSN 但未 Load → 地址栏不变；Load **成功** → 地址栏更新且产生一条浏览器历史；Load 失败 → 地址栏保留失败前视图参数。
2. **还原（反向）**：打开/刷新/后退至含参 URL → 连接探测照常 → 已连接：还原输入侧 + 满足判定则自动加载（既有 spinner 呈现）→ 页面呈现；未连接：连接面板置顶照常（不因深链改形/遮挡），连接成功后自动执行同一还原；连接失败：既有连接错误照常。
3. **错误（格式层）**：已知参数值非法 → 既有错误面板 `BAD_URL_PARAM`，应用以默认视图可用，地址栏保留原样供用户修正。

## 状态

| 状态 | 呈现 | 用户可执行动作 |
|---|---|---|
| 初始（裸 URL / 还原前） | 与现状一致：默认 page/table、连接探测 | 照常连接/操作 |
| 还原·等待连接 | 连接面板置顶（P0-7，形态不变）；深链参数保留于地址栏 | 填写凭据 Connect |
| 还原·加载中 | 复用既有指示：`loading-page` spinner + Load 按钮 spinner；WAL 为 Load 按钮 spinner；表/索引列表 spinner | 照常（既有禁用逻辑） |
| 空（参数不足自动加载） | 仅还原输入侧（如单 LSN 只预填输入框）；主区既有引导文案（"Select blkno and press Load…" 等） | 手动补全后 Load |
| 成功 | 目标视图呈现（三联视图 / WAL 记录列表）；地址栏 = 该视图规范 URL | 复制/收藏/继续操作（语义同现状） |
| 错误（格式层 `BAD_URL_PARAM`） | 既有错误面板（`role=alert`）：`code: message` + `Next:` 行；应用默认视图可用、不崩溃 | 按 nextStep 修正地址栏参数后刷新；或直接在默认视图操作（首个视图动作后 URL 随之更新） |
| 错误（对象层） | 既有合同原样：`NOT_HEAP_TABLE`/`NOT_INDEX`/`INDEX_NOT_BTREE`/`BLKNO_OUT_OF_RANGE`/`WAL_BATCH_TOO_LARGE` 等（含 nextStep）；0 块表 / 非 B-tree 走既有守卫提示，不发请求 | 按 nextStep 从列表重选 / 缩小范围 |

## 表面专属设计

### gui

- 布局与层级：**零布局变更**。地址栏为浏览器 chrome，不在页面内复制 URL 展示控件（Spec 未要求，避免噪声）。
- 密度与响应式：N/A（无布局变更）。
- 焦点与键盘：还原与地址栏同步不移动焦点、不抢占键盘（无新可聚焦控件）；既有键盘路径（Enter 触发 Load 等）不变。
- 视觉语义（色 / 字 / 距 / 数据可视化）：无新增视觉元素；`BAD_URL_PARAM` 沿用错误面板既有样式。
- 主题策略：单套设计适配既有 light/dark（无新元素即无新 token；Spec 未要求主题入 URL）。
- 感知性能：还原自动加载复用既有 spinner，无整页跳转；地址栏更新为 SPA 内 history 操作，页面无重载闪烁（Spec 禁止整页导航）。

### cli

N/A（`UI 表面=gui`）。

## 新文案冻结（英文，Developer 逐字使用）

`BAD_URL_PARAM` 形状沿既有 `{ code, message, nextStep }`；message 含参数名与原因（风格对齐 server `BAD_OID` 既有文案）：

| 场景 | message | nextStep（共用） |
|---|---|---|
| `mode` 非法 | `Invalid URL parameter mode="xyz" (expected "page" or "wal")` | `Fix or remove the URL parameters in the address bar, then reload. The app stays usable on the default view.` |
| `kind` 非法 | `Invalid URL parameter kind="xyz" (expected "table" or "index")` | 同上 |
| `table`/`index` 非法 | `Invalid URL parameter table="abc" (expected an integer in 1..4294967295)`（`index` 同型替换参数名与原值） | 同上 |
| `blkno` 非法 | `Invalid URL parameter blkno="-1" (expected a non-negative integer)` | 同上 |
| `startLsn`/`endLsn` 非法 | `Invalid URL parameter startLsn="ZZ" (expected an LSN like 0/16B3748)`（`endLsn` 同型） | 同上 |

原值以 `"` 包裹回显（含空值如 `table=""`），与 server `Invalid oid "abc"` 风格一致。README 双语文档由 Plan 落实（非验收项）。

## 与 Spec 验收映射

| Spec 验收 ID | 本设计落点 |
|---|---|
| P0-1/2/3（表/索引/WAL URL 同步） | 流程 1；手测清单 M1 |
| P0-4/5/6（已连接还原 + 预填不覆盖） | 流程 2 + 状态「还原·加载中/成功」；M2 |
| P0-7（未连接还原） | 流程 2 + 状态「还原·等待连接」（连接面板形态不变）；M3 |
| P0-8（`BAD_URL_PARAM`） | 状态「错误（格式层）」+ 文案冻结表；M4 |
| P0-9/10（对象层失效） | 状态「错误（对象层）」（复用既有合同，无新呈现）；M5 |
| P0-11（后退） | 流程 2（popstate 等价还原路径）；M6 |
| P0-12（裸 URL 回归） | 状态「初始」与现状一致；M7 |
| P0-13（输入不污染 URL） | 流程 1（Load 成功才同步、失败不写）；M8 |
| P0-14（刷新恢复） | 流程 2（刷新 = 启动还原）；M2 |
| P1（规范化/未知参数/单 LSN/无 blkno/守卫/不一致） | 状态「空」+ `urlState.ts` 单测（plan 落实）；M9 抽核 |

## 手测清单（浏览器项；QA 与 Developer 共用口径）

- M1 地址栏时机：P0-1/2/3 三视图 Load 成功后地址栏逐参数核对；选择/切换即时更新且后退一步不回退（不新增历史）；输入未 Load / Load 失败地址栏不变（P0-13）。
- M2 还原·已连接：P0-4/5/6 URL 直开 + F5（P0-14）；WAL 深链 recent-20 预填未覆盖（P0-6）。
- M3 还原·未连接：无 `.env` 服务直开 P0-7 URL → 连接面板置顶、参数保留 → Connect 成功后自动加载。
- M4 格式错误：`?mode=page&table=abc`、`blkno=-1`、`mode=xyz`、`startLsn=ZZ` → `BAD_URL_PARAM` 三段式、默认视图可用、地址栏原样；随后任一视图动作 URL 正常跟随。
- M5 对象层：非用户表 oid / 非索引 oid / blkno 越界 → 既有错误码与 nextStep 原样。
- M6 历史：表块 5 → 块 7 → 后退回块 5（自动重载）→ 前进回块 7；同块 Refresh 不新增历史（后退无空跳）。
- M7 裸 URL 回归：无参直开行为与现状一致（默认视图、连接探测、无自动加载）。
- M8 LSN 显示形态：地址栏 `%2F` / `/` 两种形态复制到新 tab 均可还原（round-trip）。
- M9 P1 抽核：page→wal 规范化、`?foo=1&mode=wal` 等价、单 LSN 预填不加载、`table` 无 `blkno` 加载块 0、0 块表/非 B-tree 守卫不发请求、过滤器不含 `index` 时静默丢弃。
- M10 并排对照：复制 URL 新 tab 改 blkno，双 tab 对照互不影响；分享 URL 给同库同事直达（用户故事口径）。

## 对 Plan / Developer 的要点

- 文案逐字取自冻结表，不得改写；错误经既有 `setError` → 错误面板（`role=alert`）呈现，不新建呈现组件。
- 还原加载指示一律复用既有 spinner/loadState，不新增进度 UI；不得出现整页 loading 遮罩或布局跳动。
- 手测清单 M1–M10 纳入 Plan 验证证据（`dev-notes.md` 记录结论）。
- 主题不新增参数；两套主题下错误面板可读性沿用现状（M4 顺带核对）。

## 开放阻塞

无（Spec 合同完备：参数 schema、还原判定、错误合同均已冻结；四裁决已确认）。

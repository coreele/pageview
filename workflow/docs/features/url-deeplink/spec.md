# Spec: url-deeplink

> 需求与规格（Plan 之前完成）。任务拆解见后续同目录 `plan.md`。
>
> **feature-id**：`url-deeplink` · **sub-feature-id**：`url-deeplink`（未拆分）
>
> **确认记录**：路径 `standard`；Spec 用户确认登记为 not-required，但本文存在业务歧义（历史粒度、编码范围、未连接还原行为、失效参数呈现，见「开放问题」），按 workflow 规则建议当前用户会话确认；各裁决点已给出建议缺省值，用户逐项接受或缺省认可后即可进入 Design。
>
> **Design 门禁**：`required`。URL 读写时机在组件层的落点、history 集成方式、参数解析模块归属等架构由 `design.md` 决定；本文件只约定用户可见行为与合同（参数 schema、同步行为、还原流程、错误合同）。
>
> **适用对象 / 前置条件**：面向 Planner（Design/Plan）与 QA；前置为浏览器可运行 web 端、可达的 PostgreSQL 实例（含 `.env` 自动连接或手动连接两种形态）。

## 背景与目标

现状：web 端为无路由单页应用（`apps/web/src/App.tsx`），视图状态全部为内存态：`mode`（page|wal）、`relationKind`（table|index）、`selectedOid`（表选择 / index 模式表过滤器）、`selectedIndexOid`、`blkno`、WAL `startLsn`/`endLsn` 等。零 URL 机制：刷新、分享、收藏、新 tab 打开均丢失视图。

目标：

1. 将视图级状态编码进 URL query，地址栏随视图变化而变化（用户可复制、收藏）。
2. 启动时解析 URL 还原视图：连接探测 → 还原输入侧状态 → 参数足以构成视图时自动加载 → 失效参数优雅报错（不崩溃）。
3. 支持四类用户故事：分享链接、收藏书签、新 tab 并排对照、刷新恢复（见「用户故事」）。
4. 为后续「右键新 tab 打开」等增强铺路。

## 非目标

- 瞬态交互状态入 URL：选中项 / 高亮 / hex 联动定位 / Refresh diff / 折叠面板（hex/detail）/ heap-peek 浮层
- 凭据或连接参数入 URL：host / port / database / user / password 禁止编码（安全规范；URL 会被分享、留痕）
- 主题（light/dark）入 URL：已有 localStorage 持久化，是跨视图偏好而非视图状态
- 多标签间状态同步（BroadcastChannel / storage 事件广播）
- server、page-core、wal-core 任何改动；既有 `/api/*` 合同变更
- 连接流程改造：`.env` 自动连接、手动连接表单、连接错误呈现均维持现状
- 深链参数的权限校验或服务端鉴权（参数只指向 oid/LSN，加载仍走既有 API 及其守卫）

## 范围与可见行为

### 在范围

1. **URL 编码（地址栏可见变化）**
   - 视图级状态以 query 参数编码（schema 见合同）；无参数的裸 URL = 默认视图（page 模式 / table 种类 / 无选择），与现状一致。
   - 规范形：URL 只编码当前模式下有效的参数；模式/种类切换后，失效参数从 URL 移除（与内存态行为一致：切换清除页面视图）。
2. **运行时同步（用户可见行为）**
   - 同步点：① mode 切换、kind 切换、表选择、索引选择、index 模式表过滤器变更——变更即时同步；② blkno 与 WAL LSN——仅在对应 Load **成功**后同步（提交点 = Load 成功）。
   - Load 失败不写入本次参数（地址栏保留失败前视图的 URL）；blkno/LSN 输入过程不更新地址栏。
   - URL 更新为 SPA 内 history 操作，不得触发整页导航/重新加载。
   - 历史粒度（裁决点 1，建议缺省）：每次**成功 Load** 产生一条浏览器历史（后退 = 回到上一个已加载视图）；选择/切换类同步不新增历史。浏览器后退/前进触发按目标 URL 还原（等价于启动还原路径，含自动加载）。
3. **启动还原（连接探测 → 自动加载）**
   - 启动时读取并校验 URL 参数（类型/范围/枚举），然后走既有连接探测（`getSession`）：
     - **已连接**（`.env` 自动连接等）：还原输入侧状态（mode/kind/选择/blkno/LSN 输入值）；参数足以构成可加载视图时自动加载（见合同「还原判定」）。
     - **未连接**（裁决点 3，建议缺省）：连接面板照常置顶显示；待还原参数保留；连接成功后自动执行同一还原与自动加载；连接失败照常呈现连接错误。
   - 还原后用户继续操作与现状一致（深链只影响初始态）。
4. **WAL 深链与预填的交互**：进入 WAL 模式（已连接）时的 recent-20 预填**不得覆盖**深链提供的 `startLsn`/`endLsn`；无深链 LSN 时预填行为不变。
5. **守卫优先于请求**：还原自动加载遵守既有客户端守卫——0 块表不加载、非 B-tree 索引选中但不发请求（提示沿用现状）；不满足时仅还原选择与提示，不发 API 请求。

### 用户故事（验收口径）

- 分享：在已加载的表块视图复制地址栏 URL，发给可达同库的同事；对方打开后看到同一表同一块。
- 书签：收藏当前索引页视图 URL；之后从书签打开直达该页。
- 并排对照：复制 URL 到新 tab，改为另一 blkno，两 tab 并排对照。
- 刷新恢复：已加载视图按 F5，视图恢复（连接仍有效）。

## 合同

### API / 接口：URL 参数 schema

query string 形式（`?` 后）；参数全部可选；参数名与 server 既有 query 命名对齐（`startLsn`/`endLsn` 同 `/api/wal/records`），采用可读长名，便于手工构造与排障（与 `BAD_OID` 排障引导一致）。

| 参数 | 类型 / 取值 | 校验（格式层） | 默认 | 语义 |
|---|---|---|---|---|
| `mode` | 枚举 `page` \| `wal` | 必须为枚举值 | `page` | 视图模式 |
| `kind` | 枚举 `table` \| `index` | 必须为枚举值；仅 `mode=page` 时有效，wal 下忽略 | `table` | 关系种类 |
| `table` | 十进制整数 `1..4294967295` | 同 `BAD_OID` 口径（整数、范围） | 无（未选） | `kind=table`：选中表 oid；`kind=index`：表过滤器 oid |
| `index` | 十进制整数 `1..4294967295` | 同 `BAD_OID` 口径；仅 `kind=index` 时有效 | 无 | 选中索引 oid |
| `blkno` | 十进制整数 ≥0 | 同 `BAD_BLKNO` 口径；上界由对象实际块数判定（`BLKNO_OUT_OF_RANGE`） | 0 | page 模式块号 |
| `startLsn` | LSN 字符串（`X/Y` 十六进制） | 同既有 `BAD_LSN` 校验口径 | 无 | WAL 区间起点 |
| `endLsn` | 同上 | 同上 | 无 | WAL 区间终点；与 `startLsn` 成对生效 |

约束：

- 未知参数名**忽略不报错**（前向兼容）；已知参数值非法才报错。
- 参数名一经发布即为公开合同：改名/改语义须向后兼容（保留旧名别名或宽容映射）。
- 凭据类信息禁止出现在任何同步出的 URL 中。

### 数据 / 状态

| 概念 | 合同 |
|---|---|
| 编码集 | `mode`、`kind`、`table`（选择或过滤器）、`index`、`blkno`（Load 成功后）、`startLsn`/`endLsn`（Load 成功后） |
| 排除集及理由 | 选中项/高亮/hex 定位：页面内交互瞬态，还原价值低、徒增 URL 噪声；diff 状态：依赖前一页字节快照，URL 无法表达；折叠面板：布局偏好非视图状态；主题：localStorage 已持久化的跨视图偏好；heap-peek 浮层：临时对照，主视图不受影响；`loadedBlkno`、index 列元数据缓存：派生态，由加载重建；连接/会话：凭据禁止入 URL |
| oid vs 名称（裁决点 2） | 采用 **oid**：与既有 API/错误合同（`BAD_OID`、`NOT_INDEX` 等）同口径；紧凑、无需转义；跨库不稳定可接受——页数据本身即库特定，深链不承诺跨库有效。名称可作为未来增强（别名/显示），非本项范围 |
| 同步时机（用户可见层） | 见「范围 2」：选择/切换即时同步，blkno/LSN 在 Load 成功后同步；失败不写入 |
| 还原判定 | `mode=page` 且 `kind=table` 且有 `table` → 自动加载该表（`blkno` 缺省 0，0 块表除外）；`mode=page` 且 `kind=index` 且有 `index`（通过 B-tree/过滤器守卫）→ 自动加载（`blkno` 缺省 0）；`mode=wal` 且 `startLsn`+`endLsn` 齐全且已连接 → 自动加载区间；其余组合仅还原输入侧状态，不自动加载 |
| 部分参数缺失 | 缺失参数取默认值（上表），不报错：`table` 无 `blkno` → 加载块 0；`kind=index` 无 `index` → 仅还原过滤器；`startLsn`/`endLsn` 仅其一 → 填入对应输入框，不自动加载（按 Load 时触发既有 `BAD_LSN` 校验） |
| 内部不一致参数 | `kind=index` 且 `table` 过滤器不含 `index` 指向的索引 → 过滤器优先，索引选择被丢弃（与运行时 `indexSelectionSurvives` 行为一致），不报错 |
| 还原与现状的关系 | 还原只设定初始态；随后的切换/清空/加载语义完全沿用现状 |

### 错误与约束

| 情形 | 合同 |
|---|---|
| URL 参数格式非法（已知参数名、值不合法） | 客户端新错误码 `BAD_URL_PARAM`：`{ code, message, nextStep }` 形状沿既有合同，message 含参数名与原因，nextStep 指示修正或清除参数；错误面板（`role=alert`）呈现；应用以默认视图正常可用，不崩溃；地址栏保留原 URL（不自动清除，便于用户修正）（裁决点 4 建议缺省） |
| 对象不存在 / 不可加载 | 走既有加载合同，不新增深链专属码：`table` 非用户表 → `NOT_HEAP_TABLE`；`index` 非索引 → `NOT_INDEX`；非 B-tree → `INDEX_NOT_BTREE`；`blkno` 越界 → `BLKNO_OUT_OF_RANGE`；扩展缺失 → `PAGEINSPECT_MISSING`/`WALINSPECT_MISSING`；区间超限 → `WAL_BATCH_TOO_LARGE`。呈现与 nextStep 语义不变（从列表重选 / 缩小范围） |
| 未连接 + 深链 | 连接面板照常显示（不因深链遮挡/改形）；连接成功后自动还原加载（裁决点 3 建议缺省）；连接失败错误照常 |
| 禁止 | URL 更新触发整页导航；把失败 Load 的参数写入 URL；凭据入 URL；为深链放宽任何既有服务端守卫 |

## 验收（Given-When-Then）

测试口径：参数解析/校验/规范化为纯函数，可用 web 单测覆盖；还原流程、历史行为、跨模式交互以手测（QA）核对。

### P0

- **P0-1 表视图 URL 同步**  
  Given 已连接、page 模式、table 种类，已选中表 oid=T，  
  When 输入 blkno=5 并 Load 成功，  
  Then 地址栏为 `?mode=page&kind=table&table=T&blkno=5`（参数顺序不限定），且无整页刷新。

- **P0-2 索引视图 URL 同步**  
  Given 已连接、page 模式、index 种类，过滤器表 oid=F，选中索引 oid=I，  
  When blkno=0 Load 成功，  
  Then 地址栏为 `?mode=page&kind=index&table=F&index=I&blkno=0`。

- **P0-3 WAL 视图 URL 同步**  
  Given 已连接、wal 模式，  
  When startLsn/endLsn 填写合法区间并 Load 成功，  
  Then 地址栏为 `?mode=wal&startLsn=<原值>&endLsn=<原值>`，记录列表照常呈现。

- **P0-4 已连接启动还原（表）**  
  Given 服务端已连接（`.env` 自动连接），  
  When 打开 `?mode=page&kind=table&table=T&blkno=5`，  
  Then 表 T 被选中、块 5 自动加载并呈现三联视图，地址栏参数保持。

- **P0-5 已连接启动还原（索引）**  
  Given 服务端已连接，  
  When 打开 `?mode=page&kind=index&table=F&index=I&blkno=1`（I 为 F 下的 B-tree 索引），  
  Then 过滤器/索引按参数还原，块 1 自动加载并呈现索引页解析结果。

- **P0-6 已连接启动还原（WAL，含预填不覆盖）**  
  Given 服务端已连接，  
  When 打开 `?mode=wal&startLsn=A&endLsn=B`（A/B 为合法区间），  
  Then LSN 输入框为 A/B（recent-20 预填未覆盖），区间自动加载，记录列表呈现。

- **P0-7 未连接还原**  
  Given 服务端未连接且无 `.env`，  
  When 打开 `?mode=page&kind=table&table=T&blkno=5`，  
  Then 显示连接面板（深链参数不丢失）；连接成功后表 T/块 5 自动加载。

- **P0-8 失效参数（格式层）**  
  When 打开 `?mode=page&table=abc`（或 `blkno=-1`、`mode=xyz` 等已知参数非法值），  
  Then 错误面板呈现 `BAD_URL_PARAM`（message 含参数名与原因），应用以默认视图可用、不崩溃，地址栏 URL 保留原样。

- **P0-9 失效参数（对象层）**  
  Given 已连接，  
  When 打开 `?mode=page&kind=table&table=<非用户表oid>`（索引侧 `index=<非索引oid>`），  
  Then 呈现既有 `NOT_HEAP_TABLE`（`NOT_INDEX`）错误合同（code/message/nextStep），无深链专属新码。

- **P0-10 blkno 越界**  
  Given 已连接，  
  When 打开 `?mode=page&kind=table&table=T&blkno=<≥T块数>`，  
  Then 呈现既有 `BLKNO_OUT_OF_RANGE` 合同。

- **P0-11 浏览器后退（依赖裁决点 1 缺省）**  
  Given 已加载表 T 块 5 后又加载块 7，  
  When 按浏览器后退，  
  Then URL 与视图均回到块 5（含自动重加载），无空白/崩溃。

- **P0-12 裸 URL 回归**  
  When 打开无参数裸 URL，  
  Then 行为与现状一致：默认 page/table、无选择、无自动加载、连接探测照常。

- **P0-13 输入不污染 URL**  
  Given 已加载表 T 块 5，  
  When 仅修改 blkno 输入为 9（不按 Load），  
  Then 地址栏仍为块 5 的 URL；随后 Load 失败（如越界）时地址栏亦不变。

- **P0-14 刷新还原**  
  Given 已连接且当前视图为 `?mode=page&kind=table&table=T&blkno=5`，  
  When 按 F5，  
  Then 视图恢复为表 T 块 5（含自动加载）。

### P1

- 模式/种类切换的 URL 规范化：page→wal 后 URL 仅含 `mode=wal`（page 参数移除），且不新增浏览器历史。
- 未知参数忽略：`?foo=1&mode=wal` 等价于 `?mode=wal`，无报错。
- `mode=wal` 下 `kind` 被忽略。
- 单个 LSN 参数：`?mode=wal&startLsn=A` → 输入框预填 A、endLsn 走 recent-20 预填或空，不自动加载。
- `table` 无 `blkno`：还原选择并自动加载块 0。
- 守卫拦截：`table=<0块表>` / `index=<非B-tree>`：选择还原、提示呈现、未发起页面请求。
- 内部不一致：过滤器不含指定 `index` 时过滤器优先、索引静默丢弃。
- 分享场景手工核对：复制 URL 到新 tab / 发给同库同事，直达视图（README 双语文档由 Plan 落实，非验收项）。

## 开放问题（已裁决）

2026-09-04 用户确认 Spec 通过，四点均按建议裁决：

1. **历史粒度：每次成功 Load 产生一条历史**（后退 = 上一视图；符合浏览器心智）。
2. **编码范围：7 参数集（mode/kind/table/index/blkno/startLsn/endLsn）+ oid 而非名称**；瞬态与凭据排除；名称可读性可作未来别名增强。
3. **未连接还原：连接面板置顶 + 连接成功后自动还原加载**（深链语义=直达视图）。
4. **失效呈现：格式错误新码 `BAD_URL_PARAM`（沿既有三段式形状）+ 对象层失效复用既有错误码**，不引入第二套呈现。

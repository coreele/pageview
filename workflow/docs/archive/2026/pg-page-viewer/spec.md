# Spec: pg-page-viewer

> 需求与规格（Plan 之前完成）。任务拆解见后续同目录 `plan.md`。
>
> **feature-id**：`pg-page-viewer` · **sub-feature-id**：`pg-page-viewer`（未拆分）
>
> **确认门禁**：路径等级 `full`。用户已批准全量 Spec（含原范围 P0-1..P0-12、P1-1..P1-3 及增量外观/元信息/UI·UX 条款 P0-13..P0-20、P1-4）；开放问题已全部裁决并关闭。**既有条目语义保留、不得删改**。可进入 Planner：须修订 `design.md`/`plan.md`，并产出 `ui-design.md`（`UI 表面: gui`，Design 门禁 required）。

## 背景与目标

本地网页工具：连接本机真实 PostgreSQL，经 `pageinspect.get_raw_page()` 拉取 heap 表页原始字节，交互式展示 page header、ItemId、free space、HeapTuple 及相互关系。

面向开发者与学习者，理解 heap 页物理布局与 DML 对页结构的影响。成功标准：能连接、选表与块号、看到经典页布局，并完成五类核心交互（flag 解读、列值解码、HOT/ctid 追踪、刷新对比、hex 联动）。另须满足下文深色模式、基础元信息与 GUI 质量增量条款。

## 非目标

- 以上传文件或离线模拟器为数据主路径
- B-tree / 其他索引页、FSM、VM
- 公网托管、多租户或生产级远程连接安全加固
- 追踪 TOAST 外部页并还原完整大对象
- 非标准 `BLCKSZ`（非 8KB）实例
- 应用内执行任意 DML/DDL（刷新对比假定用户在外部如 `psql` 改库）
- 可定制主题编辑器、任意多主题皮肤包（第一版仅 light / dark）

## 范围与可见行为

### 部署与运行

- **本地工具**：本机运行，连接本机开发/学习用 PostgreSQL。
- **PG 版本基准**：以 **PostgreSQL 16.11** 为文档声明与测试夹具基准；兼容同主版本系列（16.x）。跨主版本差异不在第一版保证范围。
- **后端栈**：Node.js + Fastify + `pg`。
- 连接凭据仅存后端进程内存；进程退出后不落盘（第一版）。
- 文档须说明：`get_raw_page` 通常需要超级用户或已显式授权角色。

### 连接与目录

1. 用户提交连接信息。**连接入口支持两种来源**：UI 表单为必填路径；环境变量为可选来源（存在时可预填或直接建立连接）。UI 提交优先级不低于环境变量的语义由 Design 决定，但两者均须支持。
2. 验证连通性与 `pageinspect` 可用性；不可用时给出启用指引。**禁止**应用代为执行 `CREATE EXTENSION`（仅提示用户自行安装/启用扩展）。
3. 连接成功后**仅**列出普通 heap 用户表（`relkind = 'r'`），含按 8KB 估算的块数；**禁止**列出 `pg_catalog` 等系统表。
4. 用户选择表与 `blkno` 后加载该页。

### 页结构可视化

成功加载后须展示：

- **Page header**：可解析字段（含 `pd_lsn`、`pd_checksum`、`pd_flags`、`pd_lower`、`pd_upper`、`pd_special`、`pd_pagesize_version`、`pd_prune_xid`）及字节区间。
- **ItemId 数组**（header 后至 `pd_lower`）：offset / length / LP 状态（UNUSED / NORMAL / REDIRECT / DEAD）。
- **Free space**（`pd_lower`–`pd_upper`）：边界有明确视觉指示。
- **HeapTuple**（自页尾向前）：对 NORMAL 项展示 HeapTupleHeader（`t_xmin`/`t_xmax`/`t_cid`/`t_ctid`/`t_infomask`/`t_infomask2`/`t_hoff` 等）及用户数据区。

布局须体现：ItemId 自前往后增长、tuple 自后往前增长、中间为 free space。

#### 空洞压缩（free space visual compression）

真实页固定 8KB。当页内仅有少量 tuple、物理占用很小时，结构图中的 free space（及其它大片空白/空洞）**禁止**按真实字节比例占满视口而把页面撑开为大段空白。

- 须对 free space 与大片空白做可视化压缩或等价布局策略（如折叠、断裂标记、非线性比例），使 header、ItemId、tuple 与交互元素保持可读、可操作。
- 压缩后仍须表达 `pd_lower` / `pd_upper` 边界以及「ItemId 向后、tuple 向前」的增长方向，并明确标示该区间为被压缩的空闲区（含或可得知其真实字节跨度）。
- 压缩不得改变各结构相对顺序，也不得使 hex 联动的字节映射失真。

### 核心交互（第一版全部交付）

1. **Flag / infomask 逐位解读**  
   ItemId flag、`t_infomask`/`t_infomask2`：hover（或等价聚焦）展开各位名称与含义；置位与未置位可区分。

2. **列值解码**  
   结合表列定义输出列名 + 值。  
   - 常见类型：`bool`、`int2`/`int4`/`int8`、`float4`/`float8`、`text`/`varchar`、`bytea`、`date`/`timestamp`/`timestamptz`、`uuid`、`numeric`。  
   - 未知类型：该列原始字节 hex；**禁止**因此阻塞整页。  
   - TOAST 指针：标为 TOASTed（或等价）；**禁止**拉取外部 TOAST 页。  
   - `attisdropped`：占位，不作为普通列值。  
   - 须处理 `attalign` 与 null bitmap。

3. **HOT 链 / ctid 追踪**  
   基于 `t_ctid` 与 HOT 相关标志（如 `HEAP_HOT_UPDATED` / `HEAP_ONLY_TUPLE`），在**当前页内**绘制更新链；绘制 `LP_REDIRECT`。  
   跨页 ctid（指向其他块）须标明目标块号与偏移；**默认不自动加载**目标页。**允许用户点击跨块目标后再加载并展示目标页**（标注 + 点击加载）；仅在点击后才发起对目标页的加载。

4. **刷新对比**  
   刷新同一 `(表, blkno)`，与刷新前快照对比，高亮变化的 ItemId、tuple 字段或字节区间。

5. **Hex dump 联动**  
   整页 hex 视图；结构图 ↔ hex 双向高亮对应字节区间/结构。

### 页大小

假定标准 8KB。校验页大小（如 `pd_pagesize_version`）；非 8KB 时拒绝展示并明确报错，**禁止**静默错解。

### 外观与主题（深色模式）

第一版 GUI **明确要求** light / dark（本 Spec 要求；非 `workflow/docs/standards/ui.md` 全局强制）。

- 用户可在 light 与 dark 间切换。
- **默认主题**：跟随系统 `prefers-color-scheme`；无法读取时默认 light。
- 切换后，页结构主视图、元信息区、表单与错误反馈在当前主题下正文与关键控件须可读，足以完成核心浏览路径。
- 跨会话记忆不强制（见 P1-4）；若实现持久化，**禁止**将数据库密码一并持久化。布局/token 细节由 `ui-design.md` 定。

### 基础元信息可见性

须提供与页结构主视图**分区明确**的元信息区（面板/侧栏/页眉等；布局由 `ui-design.md` 定），连接与页上下文可扫读，且默认**不淹没**主视图。

#### 必显清单

| 字段 | 可见时机 | 备注 |
|---|---|---|
| 连接信息：host、port、database、user（**禁止**展示密码） | `connected` 及之后 | 可截断长值，但须可辨识当前连接目标 |
| PostgreSQL 服务端版本字符串 | `connected` 及之后 | 展示服务端报告的完整版本串 |
| 表限定名（schema.relname）与关系 OID | 已选表 / `page_loaded` | 与表列表合同一致 |
| 当前 `blkno` | `page_loaded` | |
| 关系总块数 | 已选表 / `page_loaded` | 与表列表块数一致 |
| 页大小（字节） | `page_loaded` | 标准成功路径为 8192 |
| `pd_lower`、`pd_upper`、free space 字节数（`pd_upper - pd_lower`） | `page_loaded` | 数值须与结构图边界一致 |
| ItemId 总数；各 LP 状态计数（UNUSED / NORMAL / REDIRECT / DEAD） | `page_loaded` | 各状态计数之和须等于 ItemId 总数 |
| tuple 计数 | `page_loaded` | 等于 NORMAL ItemId 对应的 HeapTuple 条数 |

上述字段在对应状态下须无需额外「深挖」即可看到（允许折叠次要细节，但必显项默认展开或常驻可见）。

### UI / UX 质量（GUI 底线）

对齐 `workflow/docs/standards/ui.md` GUI 底线；禁止仅以「现代」「高级」等主观词作为唯一验收标准：

1. **信息层级与密度**：页结构可视化为主内容；元信息分区明确，默认不淹没主视图。
2. **状态完整**：初始（未连接）、加载中、空（无表 / 空页）、成功（已连接 / 已加载页）、错误均有明确呈现。
3. **焦点与键盘**：可聚焦控件有可见焦点；核心路径（连接 → 选表 → 选/输入 blkno → 加载页 → 主题切换）可用键盘完成。
4. **错误可读**：须含原因 + 至少一条可执行下一步；禁止仅以裸异常码/堆栈作为唯一反馈。
5. **布局稳定**：连接验证、拉表、加载/刷新时避免无意义整页壳层跳动（允许局部加载指示）。与 P0-11 分工：空洞压缩约束结构图内部空白；本条约束整页壳层。

## 合同

### API / 接口

后端须提供下列能力（路径名为建议合同；实现可等价命名，语义与数据义务不变）：

| 能力 | 建议接口 | 行为 |
|---|---|---|
| 连接 | `POST /api/connect` | 接收连接参数；验证连通性与 `pageinspect`；成功后会话内可调用后续接口 |
| 表列表 | `GET /api/tables` | 普通 heap 用户表：至少含关系 OID、限定名、块数 |
| 表结构 | `GET /api/tables/:oid/schema` | 列解码元数据：列名、类型 OID/名、`attlen`、`attalign`、`attnum`、`attisdropped` 等 |
| 原始页 | `GET /api/tables/:oid/pages/:blkno` | `get_raw_page()` 完整页字节，base64（或等价无损编码） |

**禁止**仅以服务端解析结果替代原始字节交付。客户端须能获得 raw page + schema。解析落点由 Design 决定；验收以可见行为为准。

**跨块加载合同**：跨页 ctid 目标的加载复用原始页能力（`GET /api/tables/:oid/pages/:blkno`，`blkno` 为目标块号），无需新增专用接口。默认不预取跨块目标；仅当用户点击跨块标注后才发起该请求并切换展示目标页。

连接成功响应（或等价会话查询）须能支撑 UI 展示 **PostgreSQL 服务端完整版本串**（见元信息必显清单）；具体字段名由 Design 决定。

### 数据 / 状态

| 状态 | 含义 |
|---|---|
| `disconnected` | 无有效连接；不可拉表/页 |
| `connected` | 连接有效且 `pageinspect` 可用 |
| `page_loaded` | 当前表+块已加载并可可视化 |
| `diff_active` | 存在刷新前快照，且本次刷新已完成对比高亮 |

- 连接参数：至少主机、端口、数据库名、用户、密码（或等价连接串）；仅存后端进程内存。
- 页载荷：完整一页；标准成功路径长度 8192。
- 刷新快照：至少保留上一次成功展示的同一 `(oid, blkno)` 页依据，直至被更新或丢弃。
- **主题状态**：UI 维护当前主题 `light` | `dark`；用户可切换；默认跟随系统 `prefers-color-scheme`，无法读取时默认 light。

**渲染合同（空洞压缩）**：结构图对 free space 与大片空白采用压缩/等价布局，而非真实字节比例；压缩须保留结构相对顺序、`pd_lower`/`pd_upper` 边界与增长方向，且不破坏 hex 联动的字节映射。

**渲染合同（元信息）**：必显元信息字段在对应状态下可见；数值与当前连接/页数据一致；tuple 计数等于 NORMAL ItemId 对应的 HeapTuple 条数；**禁止**在 UI 展示数据库密码。

### 错误与约束

| 条件 | 要求 |
|---|---|
| 连接失败 | 明确原因与可执行下一步；保持 `disconnected` |
| 缺少 `pageinspect` | 明确提示与启用指引；**禁止**进入可正常浏览状态 |
| 非 heap 用户表 / OID 不存在 | 明确错误；**禁止**伪造页 |
| `blkno` 越界 | 明确错误 |
| `get_raw_page` 权限不足 | 明确权限错误并提示特权角色 |
| 非 8KB 页 | 明确不支持；不渲染结构图 |
| 未知类型 / TOAST | 非整页失败；单列 hex 或 TOASTed |

安全（本地工具）：

- 第一版不面向公网；文档声明仅本机可信环境。
- **禁止**将数据库密码写入仓库配置或前端长期存储（第一版）。
- **禁止**在元信息或其它 UI 区域展示密码明文。

## 验收（Given-When-Then）

### P0

- **P0-1 真实页浏览**  
  Given 本机 PG 已装 `pageinspect` 且账号可调用 `get_raw_page`，When 连接成功并选择某 heap 表有效 `blkno`，Then 展示 page header、ItemId、free space、HeapTuple，且数据来自实时 `get_raw_page()`（非内置假数据）。

- **P0-2 扩展缺失可诊断**  
  Given 目标库未装或角色不可用 `pageinspect`，When 连接或取页，Then 明确错误/指引，且不进入可正常浏览页结构的状态。

- **P0-3 Flag / infomask 解读**  
  Given 已加载含至少一条 NORMAL tuple 的页，When hover（或聚焦）ItemId flag 或 `t_infomask`/`t_infomask2`，Then 展示逐位名称与含义，置位与未置位可区分。

- **P0-4 列值解码**  
  Given 表含常见类型列且页上有对应 tuple，When 查看该 tuple，Then 显示列名与解码值；未知类型为 hex；TOAST 指针为 TOASTed 且不请求外部 TOAST 页。

- **P0-5 HOT / ctid / REDIRECT**  
  Given 页内存在 HOT 链或 `LP_REDIRECT`，When 查看该页，Then 同页链与 REDIRECT 可见；页外 ctid 标明为跨块（含目标块号与偏移）。

- **P0-6 跨块 ctid 点击加载**  
  Given 当前页存在指向其他块的 ctid 标注，When 用户点击该跨块目标，Then 加载并展示目标块页；且在点击前未自动加载/预取该目标页。

- **P0-7 刷新对比**  
  Given 已加载某页，且外部 DML 已改变该页，When 刷新同一 `(表, blkno)`，Then 变化结构或区间被高亮，未变部分不表现为全部变更。

- **P0-8 Hex 联动**  
  Given 已加载页，When 结构图选中某 ItemId 或 tuple 字段，Then hex 高亮对应字节；When hex 选中落在某结构上的区间，Then 结构图高亮该结构。

- **P0-9 非 8KB 拒绝**  
  Given 页大小非 8192（或页头表明非标准），When 解析/展示，Then 明确错误且不渲染错误布局。

- **P0-10 连接机密不落盘**  
  Given 用户经 UI 提交密码完成连接，When 检查第一版持久化存储与仓库配置，Then 密码未写入磁盘项目配置或前端长期存储。

- **P0-11 空洞压缩**  
  Given 加载的页仅含少量 tuple、free space 占物理空间大部分，When 展示结构图，Then free space/大片空白被压缩呈现（不按真实字节比例撑满视口），header、ItemId、tuple 与交互元素仍可读可操作，且 `pd_lower`/`pd_upper` 边界与增长方向仍可辨识。

- **P0-12 环境变量连接**  
  Given 通过环境变量提供了有效连接信息，When 启动/连接，Then 无需在 UI 重新录入即可建立连接（UI 表单仍可用于手工输入）。

- **P0-13 深色模式切换与可读**  
  Given 应用已启动，When 用户将主题切换为 dark（或从 dark 切回 light），Then UI 进入对应主题，且页结构主视图、元信息区与关键控件在该主题下仍可读、可完成浏览；**禁止**仅切换外壳而主视图保持不可读对比。

- **P0-14 默认主题**  
  Given 操作系统/浏览器偏好为 dark（或 light），且用户尚未手动覆盖主题，When 首次进入应用，Then 默认主题与该系统偏好一致；若无法读取系统偏好，Then 默认 light。

- **P0-15 基础元信息必显**  
  Given 已连接并成功加载某页，When 查看主界面（无需进入隐藏设置页），Then 可见：连接 host/port/database/user（无密码）、服务端完整 PG 版本串、表限定名与 OID、当前 blkno、关系总块数、页大小、`pd_lower`/`pd_upper`/free space 字节数、ItemId 总数与各 LP 状态计数、以及 tuple 计数（等于 NORMAL ItemId 对应的 HeapTuple 条数）；且上述数值与当前连接/页一致。

- **P0-16 元信息不淹没主视图**  
  Given 已加载页且元信息区可见，When 观察首屏信息层级，Then 页结构可视化仍为明确主内容区，元信息处于独立分区且默认不遮挡/挤占导致主视图不可用。

- **P0-17 状态完整呈现**  
  Given 用户分别处于未连接、连接/加载进行中、无用户表或空页、连接失败或取页失败、以及成功加载页，When 查看界面，Then 各状态有可区分的明确呈现（含加载指示与空态说明），不出现无反馈的空白死局。

- **P0-18 核心路径键盘可达**  
  Given 使用键盘（无指针），When 完成连接 → 选表 → 指定 blkno → 加载页 → 切换主题，Then 各步可聚焦控件有可见焦点，且路径可完成。

- **P0-19 错误可读**  
  Given 连接失败或 `pageinspect` 不可用或 `blkno` 越界，When 错误出现，Then 反馈同时包含原因说明与至少一条可执行下一步；**禁止**仅显示裸异常码或堆栈作为唯一反馈。

- **P0-20 加载布局稳定**  
  Given 已处于已连接布局，When 加载或刷新某一页，Then 不出现无意义的整页壳层跳动（允许局部加载指示）；本条不削弱 P0-11 对结构图空洞压缩的要求。

### P1

- **P1-1 空表 / 空页**  
  Given 块数为 0 或页内无 NORMAL tuple，When 浏览，Then 界面可用并说明空闲/无元组，不崩溃。

- **P1-2 越界块号**  
  Given `blkno` 超出关系块数，When 请求该页，Then 明确错误。

- **P1-3 dropped 列**  
  Given 存在 `attisdropped` 列，When 解码 tuple，Then 按占位处理，不显示为普通业务列值。

- **P1-4 主题偏好跨会话记忆（可选增强）**  
  Given 用户已手动选择 dark 或 light，When 刷新页面或重启前端应用（同浏览器配置），Then 仍恢复为该手动选择（覆盖系统默认）。第一版不强制；若未实现，以会话内切换满足 P0-13/P0-14 即可。

## 开放问题

### 已关闭（原范围）

1. **PG 主版本范围** — 已关闭。以 **PostgreSQL 16.11** 为文档声明与测试夹具基准；兼容同主版本系列（16.x）。
2. **连接入口** — 已关闭。**支持环境变量**：UI 表单为必填路径，环境变量为可选来源。
3. **`pageinspect` 缺失** — 已关闭。仅提示用户自行安装/启用扩展；**禁止**应用代为执行 `CREATE EXTENSION`。
4. **跨页 HOT / ctid** — 已关闭。默认仅标注跨块（目标块号+偏移），**允许点击后再加载目标页**；点击前不自动加载/预取（标注 + 点击加载，判为 P0，见 P0-6）。
5. **系统表** — 已关闭。仅列普通 heap 用户表；不列 `pg_catalog` 等系统表。

### 已关闭（增量 UI/UX）

1. **默认主题** — 已关闭。跟随系统 `prefers-color-scheme`；无法读取时默认 light。不改为固定 light/dark。
2. **主题跨会话记忆** — 已关闭。第一版不强制，保持 P1-4；不升为 P0。
3. **tuple 计数定义** — 已关闭。等于 NORMAL ItemId 对应的 HeapTuple 条数。
4. **PG 版本展示粒度** — 已关闭。展示服务端报告的完整版本串。
5. **元信息必显清单** — 已关闭。全部采纳必显表（连接 host/port/database/user 不含密码、完整 PG 版本串、表限定名+OID、blkno、总块数、页大小、`pd_lower`/`pd_upper`/free space 字节、ItemId 总数与各 LP 状态计数、tuple 计数按第 3 条定义）。无降级、无增补。

---

**交接提示（Manager）**：Spec 已确认；开放问题已全部关闭。建议状态 `designing`。等待 Manager 调度 `planner`（修订 `design.md`/`plan.md`，并产出 `ui-design.md`）。既有 P0-1..P0-12 / P1-1..P1-3 语义保留。

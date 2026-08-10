# Design: pg-page-viewer

## 背景

本地网页工具：连接本机 PostgreSQL，经 `pageinspect.get_raw_page()` 拉取 heap 用户表页（标准 8KB），在浏览器侧交互式展示页布局与五项核心能力（见 Spec）。

路径等级 `full`。Spec 已批准（含主题与元信息增量）。本 Design 只定模块边界、分层、选型与数据流，不改写 API/验收合同；布局与主题视觉见 `ui-design.md`。

## 方案对比与决策

### 1. 仓库与包边界

| 方案 | 概要 | 优点 | 缺点 |
|---|---|---|---|
| A | 单体：server 与 web 同仓同包，解析逻辑写在前端目录 | 起步快 | 解析难独立测；与「共享 core」方向不符 |
| B | **pnpm workspace 三包：`packages/page-core` + `apps/server` + `apps/web`** | 解析纯函数可 Vitest；前后端边界清晰；符合 Spec「共享 core」 | 需 workspace 脚手架 |
| C | 解析仅在服务端，前端只渲染 DTO | 前端薄 | 违反「须交付 raw」的验收主路径；hex 联动与压缩布局仍需字节级映射，DTO 不够 |

**决策:** 采用 **B**。

| 包 | 职责 | 禁止 |
|---|---|---|
| `packages/page-core` | 页头/ItemId/tuple 解析、区间映射、infomask 位定义、按 schema 列解码（含对齐/null bitmap/TOAST 指针检测）、页大小校验 | Node/`pg`/DOM；发起网络或 SQL |
| `apps/server` | Fastify HTTP、内存会话、`pg` 连接、目录/schema/`get_raw_page` 代理、错误映射 | 返回解析后的页结构作为主载荷；代执行 `CREATE EXTENSION` |
| `apps/web` | 连接/选表/选块 UI、主题状态、元信息装配、调用 API 与 core、结构图（含空洞压缩）、五项交互、hex 联动 | 持久化密码；依赖服务端解析结果才能渲染 |

依赖方向（单向）：

```text
apps/web ──▶ packages/page-core
apps/web ──▶ apps/server (HTTP)
apps/server ──▶ PostgreSQL (pg)
apps/server ✖ packages/page-core   # 请求主路径不依赖；可选仅在测试脚本复用
```

### 2. 解析落点

| 方案 | 概要 | 优点 | 缺点 |
|---|---|---|---|
| A | **浏览器调用 `page-core`；API 只给 base64 raw + schema** | 与 Spec 合同一致；单一解析源；hex/压缩共用真实偏移 | 大页解析在主线程（8KB 可接受） |
| B | 服务端解析并下发结构 + raw | 前端简单 | 双份真相风险；易滑向「只信服务端结构」 |
| C | 服务端与客户端双解析 | 可交叉校验 | 成本高、首版无必要 |

**决策:** 采用 **A**。页接口主载荷为完整页 base64（不含解析树）；schema 经 `GET .../schema` 单独获取。`page-core` 校验标准 8KB / `pd_pagesize_version`；失败则 UI 报错且不渲染结构图（P0-9）。

### 3. 前端与后端技术栈

| 层 | 选型 | 备选 | 取舍 |
|---|---|---|---|
| 语言 | TypeScript（strict） | JS | 与页偏移/位运算类型安全 |
| 后端 | Node.js 20 LTS + Fastify + `pg` | Express | Spec 已指定 Fastify + `pg` |
| 前端 | React + Vite | 纯 HTML | SPA 适合多视图联动；Vite 本地开发快 |
| 包管理 | pnpm workspaces | npm/yarn | 本地 monorepo 链接 `page-core` 简洁 |
| core 测试 | Vitest | node:test | 与 TS/Vite 生态一致；夹具驱动快 |

UI 组件不引入重型设计系统；结构图与 hex 为自研可视化层。

### 4. 连接来源优先级（Spec 交由 Design）

| 方案 | 概要 | 优点 | 缺点 |
|---|---|---|---|
| A | **Env 可在服务端直接建连；UI `POST /api/connect` 显式提交始终覆盖会话** | 满足 P0-12；手工路径不被 env 锁死 | 需约定 env 键名 |
| B | 仅 env 预填到前端表单，仍须点连接 | 实现简单 | 用户仍「重新录入/确认」，弱于「无需重新录入即可建立连接」 |
| C | 仅 UI，无 env | — | 违反已关闭裁决 |

**决策:** 采用 **A**。

- Env 键：优先 `DATABASE_URL`；否则 `PGHOST` / `PGPORT` / `PGDATABASE` / `PGUSER` / `PGPASSWORD`。
- 启动时若 env 完整：服务端自动做连通性 + `pageinspect` 检查，成功则内存会话为 `connected`（P0-12）。失败则保持 `disconnected` 并记录可诊断错误（不阻塞进程启动）。
- `POST /api/connect` 提交 UI 凭据时：**覆盖**当前会话（高于 env）。
- `POST /api/connect` 体 `{ "source": "env" }`：重新读取 env 建连（可选，便于不重启进程时重试）。
- **禁止**向前端回传密码；非机密字段（host/port/db/user）与完整 PG 版本串须可返回（见 §9）。凭据与连接仅存进程内存（P0-10）。

### 5. 会话与绑定

| 方案 | 概要 | 优点 | 缺点 |
|---|---|---|---|
| A | **单进程单会话（本地工具）；默认监听 `127.0.0.1`** | 匹配「非公网、单人」；无分布式会话 | 多标签页共享同一后端会话 |
| B | 多会话 token | 更接近多租户 | 超出 Spec 非目标 |

**决策:** 采用 **A**。文档声明仅本机可信环境。

### 6. 空洞压缩归属

压缩是**视图布局**策略，不属于字节解析。

- `page-core`：输出真实字节区间与结构顺序（线性偏移 0..8191）。
- `apps/web` 可视化层：对 free space / 大片空白做非线性或折叠布局；保留 `pd_lower`/`pd_upper` 与增长方向标注；选中态仍映射到 core 的真实区间，保证 hex 联动不失真（P0-11、P0-8）。

### 7. 跨块加载

不新增 API。UI 在点击跨块 ctid 标注后，对同一 `oid` 请求 `GET /api/tables/:oid/pages/:blkno`（目标块号），再经 core 解析并切换当前页。点击前禁止预取（P0-6）。

### 8. 主题状态边界（light / dark）

主题是**前端会话视图状态**，与后端 DB 会话正交。

| 方案 | 概要 | 优点 | 缺点 |
|---|---|---|---|
| A | **主题仅存 `apps/web`（`light` \| `dark`）；server 不参与** | 符合 Spec「UI 维护主题」；无服务端耦合 | 跨会话记忆若做（P1-4）须另定前端存储 |
| B | 主题偏好写入 server 会话 | 多标签一致 | 超出本地单页工具必要；密码同会话易混淆职责 |

**决策:** 采用 **A**。

- **默认**：读 `prefers-color-scheme`；不可读 → `light`（P0-14）。
- **切换**：用户控件覆盖当前会话主题（P0-13）；覆盖后不再自动跟随系统，直至刷新（首版无强制跨会话记忆）。
- **P1-4（可选）**：仅前端非密码存储（如 `localStorage` 主题键）；**禁止**与凭据同存或经 server。
- **服务端**：不返回主题字段；主题不影响 API。视觉 token/控件见 `ui-design.md`。

### 9. 元信息数据来源

必显元信息多源拼装；**禁止**为元信息新增解析专用 API。

| 字段组 | 数据源 | 边界 |
|---|---|---|
| host、port、database、user | connect 成功响应或等价会话查询（env 自动建连后同形） | **禁止**回传密码 |
| PostgreSQL 完整版本串 | 同上；连通检查时取自服务端报告（如 `SELECT version()`） | 建议字段名 `serverVersion`；须完整串 |
| 表限定名、OID、关系总块数 | `GET /api/tables` 选中行（可缓存） | 与表列表合同一致 |
| 当前 `blkno` | 前端导航（含跨块点击目标） | 与当前页请求一致 |
| 页大小、`pd_lower`/`pd_upper`、free 字节、ItemId 总数与各 LP 计数、tuple 计数（= NORMAL→HeapTuple） | **`page-core` 解析结果** | 与结构图同源；页 API 不以解析树为主载荷 |

可选 `GET /api/session`：`{ connected, host, port, database, user, serverVersion }`（无密码），供刷新后探测 env 已连。

## 关键数据流

```text
[Env 或 UI 凭据]
        │
        ▼
 apps/server  验证连通 + pageinspect（不 CREATE EXTENSION）
        │  内存会话 = connected
        │  记非机密连接字段 + serverVersion
        ▼
 GET /api/tables          → 仅 relkind=r 用户表 + 块数估算
 GET /api/tables/:oid/schema → 列解码元数据
 GET /api/tables/:oid/pages/:blkno
        │  SQL: pageinspect.get_raw_page(relname/oid约定, blkno)
        │  响应: { pageBase64, … }  （完整页；标准路径 8192 字节）
        ▼
 apps/web  base64→Uint8Array + schema
        ▼
 page-core.parsePage / decodeTuple …
        ▼
 结构图（可压缩布局）↔ hex ↔ flag/列值/HOT/刷新对比
 元信息区 ← connect/会话非机密 + tables 选中行 + core 派生统计
 主题 ← web 本地 light|dark（默认 prefers-color-scheme）
```

刷新对比：web 在刷新前保留同一 `(oid, blkno)` 的上一帧解析快照（或原始字节），与新帧 diff 后高亮；状态 `diff_active` 为前端视图状态。

## 与 Spec 合同对齐

| Spec 合同 | Design 落实 |
|---|---|
| 四类 API 语义 | `apps/server` 路由按 Spec 建议路径实现；可增加非机密连接状态查询，不得削弱四类义务 |
| raw + schema，禁止仅交付解析结果 | 页接口主载荷为无损编码字节；解析仅在 `page-core` + web |
| 解析落点由 Design 决定 | 正式定为浏览器侧 `page-core` |
| 连接 UI + env | §4 优先级与键名 |
| 安全（密码不落盘/不进前端长期存储） | 内存会话；默认本机绑定；文档声明 |
| 空洞压缩 | web 布局层；core 保持真实偏移 |
| 跨块点击加载 | 复用 pages API；无预取 |
| PG 版本串支撑元信息 | §9：connect/会话响应携带完整 `serverVersion` |
| 主题状态 light/dark | §8：仅 web；默认系统偏好 |
| 元信息数值一致 | §9：页统计自 core 派生，与结构图同源 |

## 模块影响

- 新建 monorepo 脚手架与三包；根 README 说明启动、env、pageinspect 权限与超级用户要求。
- 夹具：从 PG 16.11 实库导出的 raw 页（及对应 schema JSON）置于 `packages/page-core` 测试资源，供 Vitest 回归；CI/本地无库时仍可跑 core 单测。
- 真实 `get_raw_page` 联调属 server/web 集成验证，依赖本机或容器 PG 16.11 + `pageinspect`。
- connect/会话响应须扩展非机密字段 + 完整版本串；web 增加主题状态与元信息区数据装配（布局见 `ui-design.md`）。

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| heap 布局/对齐与 PG 16.11 细节偏差 | 列解码错误或错区间 | 以 16.11 实页夹具锁定；未知类型降级 hex，禁止整页失败 |
| HOT/跨块语义理解偏差 | P0-5/P0-6 失败 | Spec 行为优先；同页链 + 跨块标注分测；点击加载单独断言无预取 |
| 空洞压缩破坏 hex 映射 | P0-8/P0-11 冲突 | 布局坐标与字节区间分离；测试「视图选中 → 同一 byte range」 |
| 无本机 PG 时无法做集成验收 | P0-1 等阻塞 | Plan 区分 L2 夹具与 L3 实库；记录恢复条件 |
| 工作区非 Git | 分支/PR 流程不可用 | Manager 调度 Developer 前 init Git；本 Design/Plan 不依赖 Git |
| 元信息页统计与结构图不同源 | P0-15 数值不一致 | 强制自同一 `parsePage` 结果派生；禁止手算第二套 |

## 对 Plan 与 Developer 的要点

### Plan

- 任务顺序：workspace → `page-core`（解析+Vitest 夹具）→ server API（含版本串）→ web 壳/连接/主题/元信息 → 可视化与交互 → 实库冒烟 → 文档。
- 最低验证须覆盖 core 单测 + 至少一条真实 `get_raw_page` 路径（有 PG 时）；无 PG 时标明阻塞与恢复条件。
- UI/UX 任务对照 `ui-design.md`（P0-13..P0-20）；Review 门禁 `required`：进入 QA 前须 Reviewer Approve。

### Developer

- 严格保持「server 薄代理 / web+core 解析」边界；不要把解析树塞进页 API 作为唯一数据源。
- Env 与 UI 覆盖语义按 §4；禁止应用执行 `CREATE EXTENSION`；表列表过滤系统表。
- 密码禁止写入仓库配置、`.env.example` 仅占位键名、前端禁止 localStorage/sessionStorage 存密码（P1-4 主题键除外且不得含凭据）。
- 跨块目标仅在 click handler 内发请求。
- 非 8KB：core 失败 → UI 明确错误，不渲染结构图。
- connect 成功须返回完整 PG 版本串与非机密连接字段；主题仅前端；元信息页统计只读 core 输出。

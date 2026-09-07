# Spec: auto-install-extensions

> 需求与规格（Plan 之前完成）。任务拆解见后续同目录 `plan.md`。
>
> **feature-id**：`auto-install-extensions` · **sub-feature-id**：`auto-install-extensions`（未拆分）

## 背景与目标

- 现状：Page 模式守卫 `requirePageinspect` 与 WAL 模式守卫 `requireWalCapabilities`（`apps/server/src/session.ts`）在每个模式请求前检查 `pg_extension`；缺失即报 `PAGEINSPECT_MISSING` / `WALINSPECT_MISSING`（HTTP 400，`{code, message, nextStep}`），nextStep 要求用户自行 `CREATE EXTENSION`。README 双语明文承诺「The app never runs `CREATE EXTENSION` for you / 应用**不会**替你执行 `CREATE EXTENSION`」（README.md:52、README.zh-CN.md:52）。
- 来源：用户在 WAL 模式遇到 `WALINSPECT_MISSING`，裁决改为**守卫检测到缺失时自动安装**：执行 `CREATE EXTENSION IF NOT EXISTS` 后复查，失败才报既有错误码。
- 目标：
  1. `pageinspect` / `pg_walinspect` 缺失时 server 自动安装并复查，复查通过即正常放行请求；
  2. 安装失败才报错：错误码、HTTP 状态、响应形状保持不变，message 附 PG 原始失败原因，nextStep 改为人工安装指引；
  3. server 对所连库执行 DDL 写操作（`CREATE EXTENSION`）成为被接受的产品行为（用户裁决），README 双语合同表述同步修订。
- 定位：本地调试工具。**默认启用，不加配置开关**；幂等、按需触发。

## 非目标

- 不在 `POST /api/connect` 或启动自动连接时预装扩展——连接仍只验证连通性与版本，扩展按模式请求时执行守卫（现状语义保持）。
- 不新增/移除任何错误码；`PG_VERSION_UNSUPPORTED`、`PERMISSION`、`BAD_LSN` 等其他错误路径不变。
- 不改 web 客户端（错误形状兼容，web 零改动；见开放问题 1 的文案例外）。
- 不指定扩展安装的 SCHEMA 或版本（`CREATE EXTENSION IF NOT EXISTS <name>` 裸语句，落默认 schema）。
- 不改 fixture 采集脚本 `scripts/capture-fixtures.ts` 及 `packages/page-core/fixtures/README.md` 的「采集工具不执行 `CREATE EXTENSION`」独立合同。
- 不做安装结果的持久缓存或跨会话记录。

## 范围与可见行为

- 涉及守卫：Page 模式 5 路由（`/api/tables`、`/api/tables/:oid/schema`、`/api/tables/:oid/pages/:blkno`、`/api/indexes`、`/api/indexes/:oid/pages/:blkno`）的 `requirePageinspect`；WAL 模式 3 路由（`/api/wal/current-lsn`、`/api/wal/recent-window`、`/api/wal/records`）的 `requireWalCapabilities`。
- 可见行为变化仅一处：扩展缺失时，原先立即失败的请求现在先自动安装；安装成功则请求正常返回，失败才返回错误（错误码不变、message 增强原因、nextStep 改人工指引）。
- 已安装扩展的请求行为零变化：守卫仅执行既有存在性/可调用性 SELECT，**不发起任何 DDL**。
- 文档（用户裁决 #4）：README.md 与 README.zh-CN.md 修订——
  - Requirements 节（双语 :44-52 一带）：删除「应用不会代为执行 `CREATE EXTENSION`」承诺，改为说明缺失时自动安装、需要具备 `CREATE` 权限的角色（通常超级用户）、失败时报错并给人工指引；
  - Troubleshooting 表 `PAGEINSPECT_MISSING` / `WALINSPECT_MISSING` 两行（README.md:112-113、README.zh-CN.md:109-110）：语义改为「自动安装失败（如权限不足/扩展文件缺失）」，指引人工以超级用户执行 `CREATE EXTENSION <name>;` 或安装扩展文件后重试。
- 实现层影响（供 Plan 参考，非本 Spec 义务）：`PAGEINSPECT_NEXT` / `WALINSPECT_NEXT` 常量文本（session.ts:104-107）及断言其「will not run CREATE EXTENSION」的测试（`apps/server/tests/session-gates.test.ts`、`wal.test.ts`）需同步修订。

## 合同

### API / 接口

守卫-安装-复查-报错流程（两个扩展同构，扩展名分别为 `pageinspect`、`pg_walinspect`）：

1. **检查**：执行既有存在性检查 `SELECT 1 FROM pg_extension WHERE extname = '<ext>'`。行存在 → 走既有可调用性检查后放行，**不执行 DDL**。
2. **版本前置（仅 WAL）**：PG 大版本 < 15（或未知）时，先于扩展检查抛 `PG_VERSION_UNSUPPORTED`（现状代码即如此：`requireWalCapabilities` 依据连接时 `SELECT version()` 缓存的 `session.serverVersion` 判定）。低版本**不得**尝试安装 `pg_walinspect`，也不得改写版本错误文案语义。
3. **安装**：缺失时执行 `CREATE EXTENSION IF NOT EXISTS <ext>;`（不带 SCHEMA/VERSION 子句；幂等，并发/重复执行不得因「already exists」报错）。
4. **复查**：安装后重新执行同一存在性检查与可调用性检查（复用既有验证逻辑）；复查通过 → 放行，请求正常处理。
5. **报错（仅安装失败）**：安装 SQL 失败，或复查未通过，返回既有错误码：
   - `pageinspect` → `PAGEINSPECT_MISSING`；`pg_walinspect` → `WALINSPECT_MISSING`；
   - HTTP 400，响应体保持 `{code, message, nextStep}` 三字段形状（`AppErrorBody`）；
   - **message**：必须包含 PG 原始失败原因文本（如 `permission denied to create extension`（42501）、`extension "pg_walinspect" is not available`（控制文件/so 缺失）、版本不支持等）；
   - **nextStep**：人工安装指引，保留既有 SUPERUSER 提示语义（含 `CREATE EXTENSION <name>;` 命令），**不得**再包含「app 不会代为执行 CREATE EXTENSION」表述；
   - 安装失败必须就地转换为上述错误码抛出，**禁止**让 PG 原生错误穿透 `mapPgError` 泄漏为 `PERMISSION`（42501 现映射 403）或 `INTERNAL`。

### 数据 / 状态

- **无状态**：不缓存「已安装」或「安装失败」结论。每次守卫调用都重新执行存在性检查；失败不记忆负面结果（用户随后手动安装或换角色后，下一请求自然重试并成功）。依据：守卫本为逐请求执行、查询成本极低；负面缓存会掩盖用户修复，与本地调试工具定位冲突。
- 已安装路径的查询集合与现状一致（存在性 + 可调用性 SELECT），不新增轮询或后台任务。
- 自动安装仅在扩展缺失的请求路径触发，同一请求至多一次安装尝试。

### 错误与约束

- 错误码集合不变：新增零、删除零。`*_MISSING` 的语义从「扩展缺失（需手动装）」收窄为「扩展缺失且自动安装失败」。
- web 客户端零改动兼容：既有按 `code` 分支的错误处理不受影响。
- 安全约束：server 仅对用户显式连接的库执行 `CREATE EXTENSION IF NOT EXISTS`，不执行其他 DDL；不落盘任何安装记录；失败信息仅含 PG 服务端返回的错误文本。
- 版本约束：WAL 自动安装仅在 PG ≥ 15 生效；Page 模式无版本门禁（现状保持）。

## 验收（Given-When-Then）

### P0

- P0-1 Given 已连接库未启用 `pageinspect`，When 调用任一 Page 模式路由，Then server 执行 `CREATE EXTENSION IF NOT EXISTS pageinspect` 并复查通过，请求正常返回业务数据（非错误）。
- P0-2 Given PG ≥ 15 且未启用 `pg_walinspect`，When 调用任一 WAL 模式路由，Then server 自动安装并复查通过，请求正常返回。
- P0-3 Given 当前角色无 `CREATE` 权限（如 PG 返回 42501 permission denied），When 触发守卫，Then 返回 HTTP 400，code 为 `PAGEINSPECT_MISSING` / `WALINSPECT_MISSING`，message 含 PG 原始失败原因，nextStep 为含超级用户 `CREATE EXTENSION` 人工步骤的指引（无「app 不会代为执行」表述），响应体仍为 `{code, message, nextStep}`。
- P0-4 Given 目标库所在实例缺少扩展文件（control/so 缺失，如 `extension "..." is not available`），When 触发守卫，Then 同 P0-3：既有错误码 + message 附该原因 + 人工 nextStep。
- P0-5 Given 两扩展均已启用，When 调用 Page 与 WAL 路由，Then 全程仅执行既有 SELECT 检查、零 DDL（无任何 `CREATE EXTENSION` 语句发出），行为与现状一致。
- P0-6 Given 连接的是 PG 14（serverVersion 大版本 < 15），When 调用 WAL 路由，Then 返回既有 `PG_VERSION_UNSUPPORTED`（HTTP 400，文案语义不变），且不尝试安装 `pg_walinspect`、不发起扩展检查查询（现状代码即先于连接池抛出版本错误）。
- P0-7 Given 任一 `*_MISSING` 错误响应，Then 形状为三字段 JSON `{code, message, nextStep}` 且 HTTP 400；其余既有错误码（`PG_VERSION_UNSUPPORTED` 等）路径与形状不变，web 客户端零改动兼容。
- P0-8 Given 本项实现完成，Then README.md 与 README.zh-CN.md 均不再含「应用不会代为执行 `CREATE EXTENSION`」表述，Requirements 节说明自动安装行为与所需角色权限，Troubleshooting 两行 `*_MISSING` 改为自动安装失败语义及人工指引（双语一致）。

### P1

- P1-1 Given 自动安装失败（P0-3/P0-4 场景）后用户以超级用户手动装好扩展，When 不重启 server 再次调用同一路由，Then 请求成功（无负面缓存）。
- P1-2 Given 并发多个请求同时触发同一守卫，Then 仅产生幂等结果：至多一次实际创建、其余复查通过，无「already exists」类伪错误。
- P1-3 Given 安装语句成功但复查未通过（如函数签名异常），When 触发守卫，Then 按安装失败路径返回既有错误码（同 P0-3 合同）。
- P1-4 Given `POST /api/connect` 或 env 自动连接时两扩展均缺失，When 连接，Then 连接成功（不预装、不报 `*_MISSING`——现状语义保持）。

## 开放问题（已裁决）

1. **web 连接表单文案**（`apps/web/src/App.tsx:1269-1272`）：2026-08-31 用户裁决**纳入本项**（建议采纳）。修订为英文一句话：`Missing pageinspect / pg_walinspect are installed automatically when needed; failures are reported with the reason.`（保留前后文不动，纯文案，不改错误处理）；UI 表面相应记为 `gui`（仅此一行，无布局/交互变更）。

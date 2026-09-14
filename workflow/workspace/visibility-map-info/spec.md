# Spec: visibility-map-info

> 需求与行为合同，先于 Plan 完成。任务拆分见同目录 `plan.md`。
>
> **feature-id**：`visibility-map-info` · **sub-feature-id**：`visibility-map-info`（未拆分）

## 背景与目标

- 现状：Page 模式通过 `pageinspect.get_raw_page` 读取并解析 heap block 的原始字节（页头 / ItemId / tuple）。页头 `pd_flags` 中的 `PD_ALL_VISIBLE` 位只是页内提示（hint）；真正权威的 visibility map（VM，随 `VACUUM` 维护的独立 fork，记录每页 `all_visible` / `all_frozen`）当前**不展示**，README Scope 甚至明确把 VM 列为不支持（`No non-B-tree indexes, FSM/VM, or system catalogs`）。
- 来源：用户要求「对于 block，显示其 visibility map 信息，同样需要支持自动安装插件，插件安装失败则显示安装 button」。
- 目标：
  1. 对当前加载的 heap block 展示其 VM 状态（`all_visible`、`all_frozen`、以及页头提示 `pd_all_visible`）；
  2. 读取 VM 依赖 `pg_visibility` 扩展，缺失时按既有守卫模式**自动安装**并复查，失败才报错；
  3. 自动安装失败时，web 端在 VM 信息位置显示一个 **Install** 按钮（而非仅文本指引），点击后尝试安装并在成功后刷新 VM 信息。
- 定位：本地调试工具。默认启用、不加配置开关；幂等、按需触发（与 `auto-install-extensions` 一致）。

## 非目标

- 不展示 FSM（free space map）信息。
- 不列出整表逐页的 VM 清单（`pg_visibility_map`），仅针对当前加载的单个 block。
- 不对 index（B-tree）页展示 VM——VM 是 heap 专属 fork，索引无 VM。
- 不在 heap-peek overlay（只读浮层）内展示 VM；仅主 heap 页视图。
- 不改变 `pageinspect` / `pg_walinspect` 既有守卫与错误行为；本项新增的 Install 按钮语义默认仅覆盖 `pg_visibility`（见开放问题 1）。
- 不做安装结果的持久缓存或跨会话记录；不新增/删除既有错误码（仅新增 `VISIBILITY_MISSING`）。
- 不在 `POST /api/connect` 或启动自动连接时预装扩展。

## 范围与可见行为

- 新增 server 端点：
  - `GET /api/tables/:oid/pages/:blkno/visibility` —— 读取单个 heap block 的 VM 状态；
  - `POST /api/extensions/install` —— 显式安装一个白名单扩展（供 web Install 按钮调用）。
- 可见行为变化：
  1. heap 页视图的 meta-stats 条新增一个 VM meta-item，展示 `all-visible` / `all-frozen` / `pd_all_visible` 三项布尔值（页照常加载；VM 读取失败不阻断页渲染）；
  2. 当 VM 读取因 `pg_visibility` 缺失且自动安装失败而返回 `VISIBILITY_MISSING` 时，该 meta-item 位置显示 **Install pg_visibility** 按钮（附失败原因），点击 → `POST /api/extensions/install` → 成功后重新拉取 VM；仍失败则展示服务端原因；
  3. `pg_visibility` 缺失时 server 自动安装（`CREATE EXTENSION IF NOT EXISTS pg_visibility`，不带 SCHEMA/VERSION），复查通过即正常返回数据。
- 已安装 `pg_visibility` 的请求路径零 DDL（仅执行存在性 / 可调用性 SELECT）。
- 文档修订（README.md / README.zh-CN.md）：Requirements 增加 `pg_visibility`；Scope 的 VM 表述改为「VM 以只读方式展示（heap block）」；Troubleshooting 增加 `VISIBILITY_MISSING` 行。

## 合同

### API / 接口

#### 扩展守卫（`pg_visibility`）

沿用 `apps/server/src/session.ts` 的 `ensureExtension` 流程，新增第三个门：

| 字段 | 值 |
|---|---|
| ext | `pg_visibility` |
| code | `VISIBILITY_MISSING` |
| callableSql | `SELECT to_regprocedure('pg_visibility.pg_visibility(regclass, bigint)') IS NOT NULL AS ok` |
| nextStep | `Automatic install failed. Enable pg_visibility manually as a superuser: CREATE EXTENSION pg_visibility; then retry.` |

流程（与既有门同构）：存在性检查 → 缺失则一条裸 `CREATE EXTENSION IF NOT EXISTS pg_visibility` → 复查（存在性 + 可调用性）→ 通过放行；安装失败或复查失败就地抛 `VISIBILITY_MISSING`（HTTP 400，`{code, message, nextStep}`，message 附 PG 原始原因，**禁止**穿透 `mapPgError` 泄漏为 `PERMISSION`/`INTERNAL`）。并发 `42710`/`42701` 由复查裁决，不报伪错。

#### `GET /api/tables/:oid/pages/:blkno/visibility`

守卫链（顺序）：
1. 未连接 → 401 `NOT_CONNECTED`；
2. `parseOidParam` → 400 `BAD_OID`；
3. `blkno` 非负整数 → 400 `BAD_BLKNO`；
4. `PAGE_RELATION_SQL` 查得关系且 `relkind='r'`，否则 404 `NOT_HEAP_TABLE`；
5. `blkno >= blocks` → 400 `BLKNO_OUT_OF_RANGE`；
6. `requirePgVisibility(pool)`（自动安装门）；
7. 查询：`SELECT all_visible AS "allVisible", all_frozen AS "allFrozen", pd_all_visible AS "pdAllVisible" FROM pg_visibility($1, $2::bigint)`（参数 = `qualifiedName`、`blkno`）。

响应 200：
```json
{ "oid": 16384, "blkno": 0, "qualifiedName": "public.orders", "allVisible": true, "allFrozen": false, "pdAllVisible": true }
```
- 三者均为布尔；`pg_visibility` 对有效 blkno 恒返回一行（无 VM 时 `allVisible`/`allFrozen` 为 false）。防御性处理：若查询返回 0 行，按全 false 返回（不视为错误）。

#### `POST /api/extensions/install`

- Body：`{ "ext": "pageinspect" | "pg_walinspect" | "pg_visibility" }`。
- 未连接 → 401 `NOT_CONNECTED`。
- `ext` 不在白名单 → 400 `BAD_REQUEST`（`Invalid ext "…"`）。
- 白名单内：调用对应 `ensureExtension` 门。
  - 成功 → 200 `{ "installed": true, "ext": "pg_visibility" }`；
  - 失败 → 400 对应 `*_MISSING`（`{code, message, nextStep}`，形状不变）。

### 数据 / 状态

- **无状态**：不缓存安装结果或 VM 读取结果。每次请求重新执行存在性检查与 VM 查询；失败不记忆负面结果（用户手动装好扩展 / 授予权限后下一请求自然成功）。
- VM 读取与 page 读取互相独立：page 读取失败不影响 VM，VM 读取失败也不阻断 page 渲染（web 端把两者并行且 VM 非致命）。
- 自动安装仅在扩展缺失的请求路径触发，同一请求至多一次安装尝试；`POST /api/extensions/install` 每次至多一次尝试。

### 错误与约束

- 新增错误码 `VISIBILITY_MISSING`（HTTP 400，三字段形状）；其余错误码集合不变。
- `mapPgError` 增加 `VISIBILITY_MISSING` 分支，映射为 400 + 门 nextStep。
- web 端：`loadBlk` 并行拉取 schema/page/visibility，`visibility` 的 `VISIBILITY_MISSING` 错误**不**写全局 `error`（不覆盖既有页加载错误态），而是写入独立的 VM 状态槽并渲染 Install 按钮。
- 安全约束：server 仅对用户显式连接的库执行 `CREATE EXTENSION IF NOT EXISTS`，不执行其他 DDL；安装失败信息仅含 PG 服务端返回的错误文本。
- 版本约束：`pg_visibility` 无大版本门禁（PG 9.6+ 即有；`CREATE EXTENSION` 失败会自然暴露不支持）。

## 验收（Given-When-Then）

### P0

- P0-1 Given 已连接且 `pg_visibility` 已启用，When 调用 `GET /api/tables/:oid/pages/:blkno/visibility`（blkno 合法），Then 返回 200 且含布尔 `allVisible`/`allFrozen`/`pdAllVisible`。
- P0-2 Given `pg_visibility` 缺失，When 调用该端点，Then server 执行 `CREATE EXTENSION IF NOT EXISTS pg_visibility` 并复查通过，返回 200 业务数据（非错误）。
- P0-3 Given 当前角色无 `CREATE` 权限（PG 42501），When 触发 VM 守卫，Then 返回 HTTP 400，code=`VISIBILITY_MISSING`，message 含 PG 原始原因，nextStep 含超级用户 `CREATE EXTENSION pg_visibility` 指引，形状 `{code,message,nextStep}`（不得泄漏为 403 `PERMISSION`）。
- P0-4 Given heap 页已加载且 VM 读取成功，When 查看 meta-stats 条，Then 显示 `all-visible`/`all-frozen`/`pd_all-visible` 三项布尔值。
- P0-5 Given VM 读取返回 `VISIBILITY_MISSING`，When 查看 heap 页，Then 页仍正常渲染，VM meta-item 位置显示 **Install pg_visibility** 按钮（含失败原因）；点击后调用 install 端点，成功后刷新 VM 信息，仍失败则展示服务端原因。
- P0-6 Given `pg_visibility` 已启用，When 调用 VM 端点与 Page 端点，Then 全程零 DDL（无 `CREATE EXTENSION` 语句）。
- P0-7 Given `POST /api/extensions/install` 传入白名单缺失扩展，Then 安装并返回 200 `{installed:true}`；传入未知 ext 返回 400 `BAD_REQUEST`。
- P0-8 Given 本项实现完成，Then README.md 与 README.zh-CN.md：Requirements 提及 `pg_visibility`（自动安装 + 失败手工回退）；Scope 不再把 VM 列为不支持（改为只读展示）；Troubleshooting 增加 `VISIBILITY_MISSING` 行（双语一致）。

### P1

- P1-1 Given 安装失败后用户以超级用户手工装好扩展，When 不重启 server 再次请求，Then 成功（无负面缓存）。
- P1-2 Given 并发多个请求同时触发 VM 守卫，Then 幂等：至多一次实际创建、其余复查通过，无「already exists」伪错误。
- P1-3 Given 安装语句成功但复查未通过（函数签名异常），Then 按安装失败路径返回 `VISIBILITY_MISSING`。
- P1-4 Given blkno 越界 / 关系非 heap，When 调用 VM 端点，Then 分别 400 `BLKNO_OUT_OF_RANGE` / 404 `NOT_HEAP_TABLE`，且**不**触发 `pg_visibility` 查询。
- P1-5 Given `pg_visibility` 查询返回 0 行（防御场景），Then 端点返回 200 且三布尔均为 false。
- P1-6 Given 无 VM fork 的表（从未 VACUUM），When 调用 VM 端点，Then 返回 200，`allVisible`/`allFrozen` 为 false。

## 开放问题（待用户确认）

1. **Install 按钮覆盖范围**：仅覆盖 `pg_visibility`（`VISIBILITY_MISSING`），还是同时覆盖 `pageinspect`/`pg_walinspect` 的既有文本错误？建议：**仅覆盖 `pg_visibility`**（聚焦本项、风险小；泛化是纯增量，可另立工作项）。
2. **Install 按钮动作**：调用专门的 `POST /api/extensions/install`（建议），还是仅重新拉取 VM 端点（复用自动安装重试）？建议：**专门 install 端点**（语义清晰、可独立测试、可复用）。
3. **VM 展示位置**：heap 页 meta-stats 条（建议），还是独立 detail 面板区块？建议：**meta-stats 条**（与既有 block 统计并排，零布局改动）。

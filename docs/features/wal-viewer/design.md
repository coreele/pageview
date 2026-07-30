# Design: wal-viewer

## 背景

在既有 pg-page-viewer monorepo 上增量增加 **WAL 模式**：chrome 切换 Page / WAL；WAL 数据经 `pg_walinspect`（PG15+）结构化查询，主视图为宽元数据 record 列表。路径 `full`；Spec 已确认（含 LSN 预填、批次硬错误、connect 按模式校验）。

本 Design 只定模块边界、分层、选型与批次阈值；API/错误/验收以 Spec 为准；布局与状态见 `ui-design.md`。

## 方案对比与决策

### 1. 包边界（Page vs WAL）

| 方案 | 概要 | 优点 | 缺点 |
|---|---|---|---|
| A | WAL 类型/映射写进 `page-core` | 少一个包 | 域混杂；page-core 禁止 Node 且面向页字节，与 WAL 结构化行无关 |
| B | **新建 `packages/wal-core`**；server 查库 + 映射；web 只消费 DTO/类型 | 与 Page 路径分离；纯函数可 Vitest；符合 Spec「可新建专用包」 | 多一个 workspace 包 |
| C | 无共享包；server 内联映射，web 自建类型 | 改动面小 | 前后端字段易漂移；阈值/FPI 判定难单测共享 |

**决策:** 采用 **B**。

| 包 | 职责 | 禁止 |
|---|---|---|
| `packages/page-core` | 既有 heap 页解析（不变） | 承载 WAL 类型或 SQL |
| `packages/wal-core` | WAL record 类型、`pg_walinspect` 行 → DTO 映射、FPI 判定辅助、**批次阈值常量与校验纯函数** | Node/`pg`/DOM；发起 SQL；伪造原始字节 hex |
| `apps/server` | Fastify 路由、会话、`pg_get_wal_records_info` / `pg_current_wal_lsn` 代理、扩展与版本门禁、错误映射 | `CREATE EXTENSION`；用 `get_raw_page` 冒充 WAL；截断/部分返回超限批次 |
| `apps/web` | Page / WAL 模式壳、WAL 列表与 FPI/hex 占位 UI、调用 WAL API | 依赖 page 32B grid 布局合同渲染 WAL；拼装 WAL 原始 hex |

依赖方向：

```text
apps/web ──▶ packages/page-core     # Page 模式（既有）
apps/web ──▶ packages/wal-core      # 类型 / FPI 辅助（可选轻量）
apps/web ──▶ apps/server (HTTP)
apps/server ──▶ packages/wal-core   # 行映射 + 批次阈值校验
apps/server ──▶ PostgreSQL (pg)
packages/page-core ✖ packages/wal-core   # 互不依赖
```

### 2. WAL 数据落点

| 方案 | 概要 | 优点 | 缺点 |
|---|---|---|---|
| A | **服务端执行 `pg_walinspect`，返回结构化 JSON；浏览器不解析 WAL 文件** | 与 Spec「结构化信息、非自解 WAL」一致；无原始字节义务 | 大区间加重 DB/server |
| B | 服务端读 WAL 文件自解析 | 不依赖扩展 | 违反 Spec；权限与格式风险高 |
| C | 服务端返回字节 + 前端解析 | 对称 page-core | v1 禁止原始 hex；无必要 |

**决策:** 采用 **A**。v1 不提供单条 LSN 专用接口（批次载荷已含选中所需字段）；可选后续再加。

### 3. Connect 与扩展校验（裁决落地）

| 方案 | 概要 | 优点 | 缺点 |
|---|---|---|---|
| A | Connect 仍强制 `pageinspect`；WAL 另检 | Page 路径改动小 | 违反「不强制两者皆有」与 P1-3 |
| B | **Connect 仅连通 + 记录版本；扩展按模式在请求时校验** | 符合裁决；缺一扩展不拆整会话 | 须改现有 connect 行为 |
| C | Connect 探测两扩展并写入 capability，缺则仍可连 | 前端可预提示 | 探测失败语义需额外合同 |

**决策:** 采用 **B**（可附带只读 capability 提示，非强制）。

| 时机 | 校验 |
|---|---|
| `POST /api/connect` / env 自动连 | 连通性 + `SELECT version()`；**不**因缺 `pageinspect` 或 `pg_walinspect` 而失败 |
| Page：`/api/tables`、schema、pages | 要求已连接 + **`pageinspect` 可用**；缺失 → 明确错误 + 自行 `CREATE EXTENSION` 指引 |
| WAL：`/api/wal/*` | 要求已连接 + **主版本 ≥ 15** + **`pg_walinspect` 可用**；缺失/过低 → 明确错误；**禁止**伪造成功列表 |

特权：文档对齐官方——调用 `pg_walinspect` 函数通常需足够权限（常见为超级用户或显式授权）；应用不代建扩展、不代授权。

### 4. API 分层（路径名为建议，语义对齐 Spec）

| 能力 | 接口 | 说明 |
|---|---|---|
| WAL 批次 | `GET /api/wal/records?startLsn=&endLsn=` | SQL：`pg_get_wal_records_info($1::pg_lsn, $2::pg_lsn)`；映射为 Spec 字段；经 `wal-core` 阈值校验 |
| 当前 LSN | `GET /api/wal/current-lsn` | `pg_current_wal_lsn()`（或等价）；供「一键填入」；**不**自动触发批次加载 |
| Page 既有 | connect / session / tables / schema / pages | 成功路径语义不变；仅将 `pageinspect` 门禁从 connect 移到 Page 路由 |

错误体沿用既有 `{ code, message, nextStep }`。建议 WAL 专用码（实现可等价命名，语义不变）：

| code | 条件 |
|---|---|
| `NOT_CONNECTED` | 未连接 |
| `PG_VERSION_UNSUPPORTED` | 主版本 &lt; 15 |
| `WALINSPECT_MISSING` | 无/不可用 `pg_walinspect` |
| `WAL_BATCH_TOO_LARGE` | 触及下文任一硬阈值 |
| `BAD_LSN` / 映射后的权限/区间错误 | 无效 LSN、权限、服务端报错 |

**禁止**：响应含 WAL 原始字节数组/hex 作为主载荷；`CREATE EXTENSION`；超限时截断或部分结果。

### 5. 批次过大 = 硬错误（阈值决策）

裁决：过大则**明确失败**；**禁止**截断/部分结果。

| 阈值 | 值 | 依据 |
|---|---|---|
| **R1 记录条数** | **≤ 2 000** 条/次 | 学习/调试场景够用；DOM 列表可保持可交互；超过则浏览成本高于缩小 LSN 区间 |
| **R2 响应体大小** | 序列化 JSON **≤ 2 MiB** | 防超长 `description`/`block_ref` 撑爆内存与传输；结构化行通常远小于此 |
| **R3 LSN 跨度（预检）** | `endLsn - startLsn` **≤ 16 MiB**（一个默认 WAL 段） | 在调用 `pg_get_wal_records_info` **之前**拒绝过大扫描，降低 DB/server 无界成本；跨度用 `pg_lsn` 差值语义（字节近似） |

执行顺序（server + `wal-core`）：

1. 校验 LSN 格式与 `start ≤ end`；
2. **R3** 失败 → 立即 `WAL_BATCH_TOO_LARGE`（不查库）；
3. 查询全量区间行（不 `LIMIT` 截断业务结果）；
4. **R1** 或映射后估计/**实测 R2** 失败 → 丢弃结果，返回同一硬错误码 + nextStep（缩小区间 / 降低密度）；**禁止**返回前 N 条。

空区间（0 条且未超阈值）→ 成功空列表（P1-1），不是硬错误。

### 6. 选中与批次刷新

换批次成功后：**清空选中**（不保留跨批次 LSN 选中）。可预期、实现简单。FPI 展开态随行：新批次默认全部折叠。

### 7. 前端与技术栈

- 沿用 TypeScript + pnpm、Fastify + `pg`、React + Vite；新建 `wal-core` + Vitest；WAL 列表自研，不引入重型表组件。
- **本项不新增** light/dark 合同；复用既有 theme token。
- `mode ∈ { page, wal }`；WAL 子状态见 Spec。Page 与 WAL **主工作区组件树分离**（禁止 StructureMap/32B grid 承载 WAL）。

## 关键数据流

```text
[已连接会话 — 不强制两扩展]
        │
        ├─ mode=page ─▶ /api/tables|schema|pages ─▶ 校验 pageinspect ─▶ get_raw_page ─▶ page-core
        │
        └─ mode=wal
              ├─ GET /api/wal/current-lsn ─▶ pg_current_wal_lsn（可选填入控件）
              └─ GET /api/wal/records?start&end
                    │  校验 PG≥15 + pg_walinspect
                    │  R3 预检 → pg_get_wal_records_info
                    │  wal-core 映射 → R1/R2 → JSON records[]
                    ▼
                 web：一行一条列表 / 选中 / FPI 折叠 / hex 占位
```

## 与 Spec 合同对齐

| Spec / 裁决 | Design 落实 |
|---|---|
| Page/WAL 路径分离 | §1–2、§7；独立 `/api/wal/*` |
| 结构化字段义务 | server 映射 + `wal-core` 类型 |
| 批次硬错误、禁截断 | §5 R1/R2/R3 |
| LSN 必填；可填当前；不盲拉 | §4 current-lsn；UI 不自动加载 |
| connect 按模式校验 | §3 |
| 无 WAL 原始 hex；无代建扩展 | §2、§4 |
| 主题不新增 | §7（沿用既有） |

## 模块影响

- 新建 `packages/wal-core`；workspace / 根脚本纳入 typecheck/test。
- `apps/server`：connect 去掉强制 `pageinspect`；Page 路由补校验；新增 WAL 路由与错误码。
- `apps/web`：chrome 模式切换；WAL 视图与 API 客户端；Page 视图保持可用。
- README（中英）：WAL 模式、PG15+、`pg_walinspect`、自行建扩展、v1 无原始 hex、批次上限说明。

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| Connect 不再强制 pageinspect | 旧习惯「连上即可用 Page」变为首拉表才发现缺扩展 | 错误文案 + nextStep；README 说明；可选 session capability 提示 |
| R3=16MiB 对稀疏大跨度过严 | 合法稀疏区间被拒 | nextStep 提示缩小跨度；阈值集中在 `wal-core` 常量便于调 |
| 先全量查询再 R1 失败 | 已耗 DB | R3 预检为主；文档劝用窄区间；后续可加 count 策略但不在 v1 截断返回 |
| 无 PG15+ / 无扩展环境 | L3 阻塞 | Plan 区分 L2（wal-core）与 L3 实库；记录恢复条件 |
| 误用 page grid 渲染 WAL | P0-3 失败 | UI 独立组件；Review 对照 ui-design |

## 对 Plan 与 Developer 的要点

### Plan

- 顺序：`wal-core`（类型+阈值）→ server（connect 门禁迁移 + WAL API）→ web（模式切换 + 列表/FPI/占位）→ 文档 → 实库冒烟。
- 实施分支：`wal-viewer`（禁止在 `main` 直接实施）。
- Review `required`：进入 QA 前须 Approve。

### Developer

- 超限只返回硬错误，永不 `records.slice`。
- Page 成功路径与 `get_raw_page` 不变；WAL 禁止碰 page 字节 API。
- 密码与安全约定沿用既有。

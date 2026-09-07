# Plan: oid-numeric-guard

> **确认门禁：awaiting-plan-approval**。待用户确认后 Manager 持久化并进入 `planned`。

## 元信息

- 工作项标识: oid-numeric-guard
- sub-feature-id: oid-numeric-guard（未拆分）
- 依据 Spec: **N/A**（fast，Spec 门禁 `skipped`；以 [main.md](main.md) 登记范围为依据：index-viewer QA DEF-2（Low）与 Review F1 —— 非数字 oid 返回误导性 400 `BAD_LSN` + WAL nextStep）
- 依据 Design / UI/UX: **N/A**（Design 门禁 `skipped`；UI 表面 `none`，见「UI/UX」节）
- 路径等级: fast
- Review 门禁: **skipped**（fast：单点守卫修复，L2 测试覆盖，登记时已裁定）
- 源分支: `oid-numeric-guard`（自 `main` 创建并检出；**禁止**在 `main` 直接实施）
- 目标分支: `main`
- 最低验证层: **L2（server Vitest 单测 + typecheck）**
  - 理由：变更仅为路由参数守卫（纯输入校验分支），可用既有 inject + stub pool 模式完整单测；无前端改动、无新 API 面，不需要集成层取证。
- **适用对象**：Developer / QA（Review skipped）。**前置条件**：本 Plan 已确认。**操作步骤**：T1–T5 → QA。**预期结果**：验证命令全绿、qa-report Pass。**失败处理**：quality.md §6 记缺口；QA Fail 回 Developer。

## 适用工程规范

- [documentation.md](../../../agents/standards/documentation.md)
- [git.md](../../../agents/standards/git.md)（源 `oid-numeric-guard` → 目标 `main`）
- [quality.md](../../../agents/standards/quality.md)
- [security.md](../../../agents/standards/security.md)（无新认证/输入面；禁止提交 `.env`/凭据）

## UI/UX: N/A

UI 表面为 `none`：前端仅以列表返回的数字 oid 构造 URL，本项修复的是手工构造 URL 的服务端健壮性，无任何界面变更（无 `ui-design.md`，Design 门禁 `skipped`）。

## 目标摘要

带 `:oid` 路由对非数字 / 非法整数 oid 统一前置校验，返回 400 `BAD_OID`（错误形状沿用 `{code, message, nextStep}`，message 含实际输入，nextStep 指示从列表重新选择），不再落入 pg `22P02` → `BAD_LSN` + WAL nextStep 的误导路径。

**错误码定名 `BAD_OID`**：与既有 `BAD_BLKNO`（参数校验族 `BAD_<参数名>`）命名一致；`NOT_INDEX` / `NOT_HEAP_TABLE` 属存在性 404 族，语义不合。

**守卫条件**：`Number.isInteger(oid) && oid >= 1 && oid <= 4294967295`。oid 为无符号 4 字节（0 是 `InvalidOid` 保留值，负数非法）；上界拦截超范围输入（如 `1e20`），否则会以溢出错误落回误导路径（BAD_LSN/INTERNAL）。

## 现状锚点（调研结论）

非数字 oid（如 `abc`）→ `Number("abc")` = NaN 原样作为查询参数 → 真实 PG 报 `22P02`（invalid input syntax for type oid）→ `mapPgError` 的 22P02 分支 → `BAD_LSN` + WAL nextStep。**受影响路由共 3 条**（`apps/server/src/app.ts`）：

| 路由 | 现状（非数字 oid） | 目标 |
|---|---|---|
| `GET /api/tables/:oid/pages/:blkno` | 400 `BAD_LSN`（误导） | 400 `BAD_OID`（在任何目录查询前拦截） |
| `GET /api/indexes/:oid/pages/:blkno` | 400 `BAD_LSN`（误导），DEF-2/F1 记录 | 400 `BAD_OID`（在 NOT_INDEX 查询前拦截） |
| `GET /api/tables/:oid/schema` | 同型问题：NaN 直接进 `WHERE c.oid = $1` | 400 `BAD_OID`（同型修复，纳入本项） |

其余路由不受影响：`/api/tables`、`/api/indexes` 列表无 oid 参数；WAL 路由无 oid。列表端点数值均来自查询行，正常。注：stub pool 忽略参数，既有测试观察不到该缺陷（NaN 不会触发 22P02），故红测直接断言新守卫行为。

## 任务拆解

### T1 — 分支

- **完成条件**: 自 `main` 创建并检出 `oid-numeric-guard`；不在 `main` 实施。
- **触碰路径**: git 工作树
- **验收映射**: git.md §1

### T2 — 红测（TDD 先行）

- **完成条件**: 新建 `apps/server/tests/oid-guard.test.ts`（复用 indexes.test.ts 的 inject + stub pool 模式），断言下述用例返回 **400、code=`BAD_OID`、body 含 `message`（含原始输入字样，如 `abc`）与 `nextStep`**，且实现前这些断言失败（当前返回 404/200 或误导码）：
  - 3 条路由 × 非法 oid 集 `{abc, 1.5, -1, 0, 99999999999999999999}`；
  - 守卫序：`/api/indexes/abc/pages/0` 在 relation 查询前返回 `BAD_OID`（先于 ①NOT_INDEX）；
  - 网关序不变：未连接时 `/api/tables/abc/pages/0` 仍 401 `NOT_CONNECTED`（守卫在网关之后）。
- **触碰路径**: `apps/server/tests/oid-guard.test.ts`（新文件）
- **验收映射**: 「验收」V1–V3

### T3 — 实现统一守卫

- **完成条件**: `app.ts` 增加模块级辅助（如 `invalidOidReply(raw)` 或 `parseOidParam`），在 3 条路由的 `requirePageinspect` 之后、**任何目录查询之前**校验 `req.params.oid`；非法时经 `appError(400, "BAD_OID", ...)` 返回，message 形如 `Invalid oid "abc"`（含实际输入），nextStep 按端点族指示（tables：从表列表重选；indexes：从索引列表重选）。T2 全绿。
- **触碰路径**: `apps/server/src/app.ts`
- **验收映射**: V1–V3

### T4 — 回归：既有 404/400 序不变

- **完成条件**: 合法数字但不存在 → 仍 404 `NOT_HEAP_TABLE` / `NOT_INDEX`；非整数或负 blkno → 仍 400 `BAD_BLKNO`；越界 blkno → 仍 400 `BLKNO_OUT_OF_RANGE`；indexes 守卫序 ①–④（数值 oid 场景）不变。既有 `indexes.test.ts` 全绿；table page 端点今日无直接路由测，在 `oid-guard.test.ts` 补最小回归块（unknown oid → NOT_HEAP_TABLE、bad blkno → BAD_BLKNO、越界 → BLKNO_OUT_OF_RANGE）。
- **触碰路径**: `apps/server/tests/oid-guard.test.ts`
- **验收映射**: V4

### T5 — 文档、验证与交接记录

- **完成条件**: 双语 README Troubleshooting 各增一行 `BAD_OID`（见文档影响）；写 `dev-notes.md`（命令输出摘要、L2 达标声明）；跑全量验证命令并全绿。
- **触碰路径**: `README.md`、`README.zh-CN.md`、`workflow/archive/2026/oid-numeric-guard/dev-notes.md`
- **验收映射**: V5、quality.md §1/§2

## 依赖与顺序

T1 → T2（红）→ T3（转绿）→ T4（回归）→ T5（文档 + 记录）→ QA。T3 依赖 T2 的红；T4/T5 依赖 T3。Review skipped，无 Review 环节。

## 触碰路径

| 路径 | 任务 | 动作 |
|---|---|---|
| `apps/server/tests/oid-guard.test.ts` | T2, T4 | 新建 |
| `apps/server/src/app.ts` | T3 | 修改（3 处路由 + 辅助函数） |
| `README.md` / `README.zh-CN.md` | T5 | Troubleshooting 各 +1 行 |
| `workflow/archive/2026/oid-numeric-guard/dev-notes.md` | T5 | 新建 |

## 验证命令

```bash
# L2 — 定向与全量单测
pnpm --filter server test
# L2 — 类型
pnpm --filter server typecheck
# 仓库级回归（可选，防跨包意外）
pnpm -r test && pnpm -r typecheck
```

## 验收（fast，无 Spec——可测条目）

- **V1**: 3 条路由对 `{abc, 1.5, -1, 0, 99999999999999999999}` 返回 400、`code=BAD_OID`、`message` 含实际输入、`nextStep` 存在且指示重新选择。
- **V2**: 错误形状沿 `{code, message, nextStep}`，经 `appError` 构造，不出现 `BAD_LSN`/WAL 文案。
- **V3**: 守卫序——401 `NOT_CONNECTED` / 400 `PAGEINSPECT_MISSING` 网关仍最先；`BAD_OID` 先于目录查询（indexes 端点先于 ①NOT_INDEX）。
- **V4**: 回归——数值但未知 oid 仍 404 `NOT_HEAP_TABLE`/`NOT_INDEX`；`BAD_BLKNO`、`BLKNO_OUT_OF_RANGE`、`INDEX_NOT_BTREE` 序与码不变；既有测试套件全绿。
- **V5**: 双语 README Troubleshooting 各含 `BAD_OID` 行。

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | N/A——守卫逻辑自解释（`app.ts` 内注释标 ⓪ 序即可），无新模块/配置；dev-notes.md 记录验证（T5） |
| 用户文档 | `README.md` 与 `README.zh-CN.md` 的 Troubleshooting 表各增一行 `BAD_OID`（手工构造 URL 时可见；工作项已预估此行） |
| 运维文档 | N/A——无部署、监控、配置变更 |

## 无法执行验证时的处理

若 pnpm/vitest 环境不可用：按 quality.md §6 在 `dev-notes.md` 记录原因（环境障碍）、风险（守卫行为未经机器验证即进入 QA）与恢复条件（环境恢复后补跑全部命令）；禁止静默跳过。

## 交接顺序

1. Developer：T1–T5 完成、L2 全绿、`dev-notes.md` 就绪 → 交 QA（Review 门禁 `skipped` 已在登记时裁定，无需 Reviewer `Approve`）。
2. QA：按本 Plan V1–V5 与 L2 证据独立验收，结论写 `qa-report.md`（Pass/Fail/Blocked）。
3. QA Pass 后：待用户授权合并；Manager 在源分支置 `done` 并按 git.md §1.4 一次提交（含 qa-report 与 STATUS）。

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-09-02 | 初稿（Planner；fast 路径，依据工作项记录范围 + 代码调研） |

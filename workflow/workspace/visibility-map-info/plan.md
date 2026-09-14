# Plan: visibility-map-info

## 元信息

- 依据 Spec: `workflow/workspace/visibility-map-info/spec.md`
- 依据 Design: N/A（`skipped`：无模块边界/分层/选型决策，沿用既有 auto-install 守卫与 meta-stats 展示模式）
- 依据 UI: N/A（范围含可见界面但无信息架构/布局/交互决策——meta-stats 条新增一个 meta-item 与一个按钮，复用既有样式）
- 路径等级: standard
- Review 门禁: required
- 最低验证层: unit + build + static
- 验证命令:
  - `pnpm test`（page-core / wal-core / server / web 全量单测）
  - `pnpm -r typecheck`
  - `pnpm -r build`
- 预期证据: 三条命令均退出码 0；新增测试用例名出现在 `pnpm test` 输出且通过；typecheck/build 零错误。

## 目标摘要

为当前加载的 heap block 展示 visibility map 状态（`all_visible` / `all_frozen` / 页头提示 `pd_all_visible`），依赖 `pg_visibility` 扩展：缺失时按既有守卫自动 `CREATE EXTENSION IF NOT EXISTS pg_visibility`，失败时 web 在 VM meta-item 位置显示 **Install pg_visibility** 按钮，点击走 `POST /api/extensions/install`，成功后刷新 VM。

## 任务拆解

1. **server 守卫**（`apps/server/src/session.ts`）：`ExtensionGate` 类型与三处常量加入 `pg_visibility`；新增 `VISIBILITY_GATE`、`VISIBILITY_NEXT`、错误码 `VISIBILITY_MISSING`；新增 `GATES` 查找表与 `gateFor(ext)`；新增 `installExtension(pool, ext)`（对白名单 ext 跑 `ensureExtension`）与 `requirePgVisibility(pool)`。（完成条件：单测可 import 并验证门配置、可调用性探针、nextStep 文案）
2. **server 路由**（`apps/server/src/app.ts`）：`mapPgError` 增加 `VISIBILITY_MISSING` 分支；新增 `GET /api/tables/:oid/pages/:blkno/visibility`（守卫链同 spec，查询 `pg_visibility($1,$2::bigint)`，200 返回 `{oid,blkno,qualifiedName,allVisible,allFrozen,pdAllVisible}`，0 行按全 false）；新增 `POST /api/extensions/install`（白名单校验 + `installExtension`）。（完成条件：注入测试覆盖 200/400/404/401 全分支）
3. **server 单测**：扩展 `apps/server/tests/extension-auto-install.test.ts` 增 pg_visibility 门（P0-2/P0-3/P0-6/P1-1/P1-2/P1-3 同构用例）；新增 visibility 路由与 install 端点用例（P0-1/P0-7/P1-4/P1-5）。（完成条件：P0 全绿）
4. **server 集成烟测**（`apps/server/src/integration-smoke.ts`）：`autoInstallSmoke` 增 pg_visibility 段（DROP → 调 visibility 端点 → 复查已重装），`finally` 重建列表加入 `pg_visibility`。（完成条件：可选，需真实 PG；见验证缺口）
5. **web API**（`apps/web/src/api.ts`）：新增 `VisibilityInfo` 类型、`fetchVisibility(oid,blkno)`、`installExtension(ext)`。（完成条件：`api.test.ts` 覆盖解析与错误）
6. **web 视图**（`apps/web/src/App.tsx`）：新增 `vm`/`vmError` 状态；`loadBlk` 并行拉取 visibility 且非致命（独立 try/catch，失败只写 vmError 不写全局 error）；heap meta-stats 条新增 VM meta-item（成功显示三项布尔，`VISIBILITY_MISSING` 时显示 Install 按钮 + 原因）；Install 点击 → `installExtension("pg_visibility")` → 成功后重拉 VM；选择切换 / `resetPageView` 清空 vm 状态。（完成条件：typecheck 通过；手动冒烟路径可达）
7. **web 单测**（`apps/web/src/api.test.ts`）：`fetchVisibility`/`installExtension` 的解析与错误契约（P0-5 的 API 侧）。渲染侧无组件测试基建，由 e2e/manual 覆盖（见验证缺口）。
8. **文档**：`README.md` 与 `README.zh-CN.md`——Requirements 增 `pg_visibility`；Scope「No … FSM/VM …」改为「VM 只读展示」；Troubleshooting 增 `VISIBILITY_MISSING` 行；连接表单自动安装文案补 `pg_visibility`。（完成条件：P0-8 双语一致）

## 依赖与顺序

1 → 2 → 3 → 4（3、4 依赖 1/2）→ 5 → 6 → 7（5 先于 6）→ 8。任务 4 为可选项（真实 PG 集成，本地可能不可用），不阻塞 unit+build+static 验收。

## 触碰路径

- `apps/server/src/session.ts`
- `apps/server/src/app.ts`
- `apps/server/tests/extension-auto-install.test.ts`（扩展）
- `apps/server/src/integration-smoke.ts`
- `apps/web/src/api.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/api.test.ts`
- `README.md`
- `README.zh-CN.md`

## 验收与验证

| ID | 要求或命令 | 预期证据 | 结果（实施后填） |
|---|---|---|---|
| P0-1 | `GET /api/tables/:oid/pages/:blkno/visibility`（已启用 pg_visibility） | 200，`allVisible/allFrozen/pdAllVisible` 布尔 | |
| P0-2 | pg_visibility 缺失 → 该端点 | 自动 `CREATE EXTENSION IF NOT EXISTS pg_visibility` + 复查通过，200 | |
| P0-3 | 42501 安装被拒 → 该端点 | 400 `VISIBILITY_MISSING`，message 含 PG 原因，nextStep 含 `CREATE EXTENSION pg_visibility`（非 403） | |
| P0-4 | heap 页已加载且 VM 成功 | meta-stats 条显示 all-visible/all-frozen/pd_all-visible | |
| P0-5 | VM 返回 `VISIBILITY_MISSING` | 页照常渲染 + Install pg_visibility 按钮 + 失败原因；点击成功刷新、失败显示原因 | |
| P0-6 | pg_visibility 已启用 → Page/VM 端点 | 零 DDL（无 CREATE EXTENSION） | |
| P0-7 | `POST /api/extensions/install` 白名单缺失扩展 / 未知 ext | 200 `{installed:true}` / 400 `BAD_REQUEST` | |
| P0-8 | README 双语 | Requirements 提 pg_visibility；Scope 不再列 VM 为不支持；Troubleshooting 增 `VISIBILITY_MISSING` | |
| P1-1 | 失败后手工装好 → 再次请求 | 成功（无负面缓存） | |
| P1-2 | 并发守卫 | 幂等，无 already-exists 伪错 | |
| P1-3 | 安装成功但复查未通过 | 400 `VISIBILITY_MISSING` | |
| P1-4 | blkno 越界 / 非 heap | 400 `BLKNO_OUT_OF_RANGE` / 404 `NOT_HEAP_TABLE`，不触发 pg_visibility 查询 | |
| P1-5 | 0 行 / 无 VM fork | 200，三布尔 false | |
| P1-6 | 无 VM fork 的表 | 200，`allVisible/allFrozen=false` | |

## 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| server 集成烟测（任务 4，pg_visibility 段） | 需真实 PostgreSQL 16（`pnpm test:integration` 依赖 `.env`/PG），本地环境可能不可用 | 只覆盖「DROP → 端点自动重装」的端到端链路缺失，由单测 P0-2/P0-6 的 SQL 序列断言兜底 | CI integration job（postgres:16 服务）或本地配好 `.env` 后 `pnpm test:integration` |
| web 渲染侧（VM meta-item 与 Install 按钮的 DOM 行为） | 仓库无 React 组件测试基建（web 测试均为纯逻辑），App.tsx 无渲染测试 | 按钮点击/刷新链路仅 manual/e2e 覆盖 | Playwright e2e 或手动冒烟 |

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | N/A（无独立开发文档，代码内注释即说明） |
| 用户文档 | `README.md`、`README.zh-CN.md`（Requirements/Scope/Troubleshooting + 连接表单文案） |
| 运维文档 | N/A（无运维脚本变更） |

## 交接顺序

1. Developer 实施与自验 →
2. Reviewer（Review 门禁 required 时）→
3. QA 验收 →
4. 用户授权合并 → Manager 第三阶段文档提交（`done`）→ 合入 → 结束

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-09-14 | 初版（Spec 已获用户确认，三处裁决按建议：按钮仅覆盖 pg_visibility、专门 install 端点、meta-stats 展示） |

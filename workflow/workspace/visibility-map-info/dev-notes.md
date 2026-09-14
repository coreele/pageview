# Dev Notes: visibility-map-info

## 实现摘要

- **server 守卫**（`apps/server/src/session.ts`）：`ExtensionGate` 扩展到 `pg_visibility`；新增 `VISIBILITY_GATE` / `VISIBILITY_NEXT` / `VISIBILITY_MISSING`；新增 `ExtensionName` 白名单类型、`GATES` 查找表、`installExtension(pool, ext)`、`requirePgVisibility(pool)`、`verifyPgVisibility(client)`。复用既有 `ensureExtension`（存在性 → 缺失则裸 `CREATE EXTENSION IF NOT EXISTS` → 复查，失败就地转 `*_MISSING`）。
- **server 路由**（`apps/server/src/app.ts`）：`mapPgError` 增 `VISIBILITY_MISSING` 分支；新增 `GET /api/tables/:oid/pages/:blkno/visibility`（守卫链 oid/blkno/relkind/越界 → `requirePgVisibility` → `pg_visibility($1,$2::bigint)`，0 行按全 false）；新增 `POST /api/extensions/install`（白名单校验 → `installExtension`）。
- **server 测试**：扩展 `extension-auto-install.test.ts`（stub 增加 `relationRow`/`visibilityRow` 注入与 `from pg_visibility(` 派发），新增 pg_visibility 门、visibility 路由、install 端点共 12 条用例。
- **server 烟测**：`integration-smoke.ts` 的 `autoInstallSmoke` 增 pg_visibility 段（DROP → visibility 端点 → 复查已重装），`finally` 重建列表加入 `pg_visibility`。
- **web API**（`apps/web/src/api.ts`）：新增 `VisibilityInfo` 类型、`fetchVisibility(oid,blkno)`、`installExtension(ext)`。
- **web 视图**（`apps/web/src/App.tsx`）：新增 `vm`/`vmError`/`vmInstalling` 状态与 `vmReqRef`（非致命、去抖过期响应）；`fetchVm`/`installVm` 两个回调；`loadBlk` 并行触发 `fetchVm`；`resetPageView`/`onSelectTable` 清空 VM；heap meta-stats 条新增「visibility map」meta-item（成功显示三项布尔，`VISIBILITY_MISSING` 时显示 Install pg_visibility 按钮 + 原因）；连接表单文案补 `pg_visibility`。
- **web 测试**：`api.test.ts` 增 `fetchVisibility` / `installExtension` 共 4 条用例。
- **文档**：README.md / README.zh-CN.md（Requirements、Scope、Troubleshooting、人工回退 SQL）。

## 变更路径

- `apps/server/src/session.ts`
- `apps/server/src/app.ts`
- `apps/server/tests/extension-auto-install.test.ts`
- `apps/server/src/integration-smoke.ts`
- `apps/web/src/api.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/api.test.ts`
- `README.md`
- `README.zh-CN.md`

## 测试先行记录（TDD）

> 说明：本项实现与测试同批落地，未严格走 red-first（先写失败测试再实现）；但对改动前的代码这些用例**必然失败**——`VISIBILITY_MISSING`/`requirePgVisibility`/`installExtension`/`fetchVisibility`/`installExtension`（web）等符号与两个新端点均不存在，`visibility` meta-item 不渲染。替代验证：运行 `pnpm test` 全绿。

| Spec ID / 行为项 | 测试 | 先失败 | 后通过 | 说明 |
|---|---|---|---|---|
| P0-1 200 布尔 VM | `extension-auto-install.test.ts` P0-2/P0-6 用例的响应断言 | — | ✓ | 与实现同批 |
| P0-2 自动安装 pg_visibility | P0-2 用例（SQL 序列 + 200） | — | ✓ | |
| P0-3 42501 → VISIBILITY_MISSING | P0-3 用例 | — | ✓ | |
| P0-4 web 展示三项布尔 | manual（无组件测试基建） | — | — | 见验证缺口 |
| P0-5 Install 按钮 | `api.test.ts` fetchVisibility/installExtension（API 侧）+ manual 渲染 | — | ✓ | 渲染侧 manual |
| P0-6 零 DDL | P0-6 用例 | — | ✓ | |
| P0-7 install 端点 | install 3 用例（成功/未知 ext/失败） | — | ✓ | |
| P0-8 README 双语 | manual（grep + 人读） | — | ✓ | |
| P1-1 无负面缓存 | P1-1 用例 | — | ✓ | |
| P1-2 并发幂等 | P1-2 用例 | — | ✓ | |
| P1-3 复查未通过 | P1-3 用例 | — | ✓ | |
| P1-4 越界/非 heap 不触扩展 | P1-4 两条用例 | — | ✓ | |
| P1-5 0 行 → 全 false | P1-5 用例 | — | ✓ | |
| P1-6 无 VM fork → false | P1-6 用例 | — | ✓ | |

## 验证

| 命令 | 验证层 | 结果摘要 / 证据 |
|---|---|---|
| `pnpm -r typecheck` | static | 0 错误（4 包全部 Done） |
| `pnpm -r build` | build | 成功（server tsc + web vite build 均 Done） |
| `pnpm test` | unit | 609 通过：wal-core 13、page-core 174、server 99（含 extension-auto-install 24）、web 323（含 api 12） |

## 目标分支同步（最终 Review 前）

- 目标分支及提交: `main` = `96c5f73`（= 基线 `96c5f7388b15f3a5dc593d5926b04e2100c49ad4`）
- 同步后源分支 HEAD: 见提交记录（`docs(workflow): visibility-map-info ready for developing` 之后为代码提交）
- 同步方式: N/A（`origin/main` 未移动，源分支可直接 fast-forward，无需 rebase）
- 冲突及处理: N/A
- 同步后复验: N/A（无需同步）

## 文档影响

| 类别 | 已更新路径或交接说明 |
|---|---|
| 开发文档 | N/A（代码内注释即说明，无独立开发文档） |
| 用户文档 | `README.md`、`README.zh-CN.md`（已由 Developer 提交） |
| 运维文档 | N/A |

## 未解决风险 / 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| server 集成烟测 pg_visibility 段 | 需真实 PostgreSQL 16（`pnpm test:integration` 依赖 `.env`/PG），本地未跑 | 「DROP → 端点自动重装」端到端链路未在本机验证；由单测 SQL 序列断言兜底 | CI integration job（postgres:16）或本地配 `.env` 后 `pnpm test:integration` |
| web 渲染侧（VM meta-item / Install 按钮 DOM 行为） | 仓库无 React 组件测试基建 | 按钮点击/刷新链路仅 manual/e2e 覆盖 | Playwright e2e 或手动冒烟 |

## QA 修复回执

> QA `Fail` 后按缺陷 ID 追加，不另建文件。

| 缺陷 ID | 处理 | 摘要 | 验证证据 | 建议复测范围 |
|---|---|---|---|---|
| | | | | |

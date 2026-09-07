# Dev Notes: auto-install-extensions

- 工作项：auto-install-extensions（源分支 `auto-install-extensions`，自 `main` f4d359c 创建）
- 适用对象：Reviewer / QA（实施证据与缺口记录）；前置条件：读取同目录 spec.md 与 plan.md
- 角色：Developer；Review 门禁 required；最低验证层 L2（L3 自动安装段已纳入本地执行）

## 变更路径与提交

| 任务 | 提交 | 路径 |
|---|---|---|
| T1 分支 | （无提交，仅建分支） | 源分支自 main 创建，基线全绿 |
| T2+T1 守卫自动安装 + 单测 | `3cef61a` | `apps/server/src/session.ts`、`apps/server/tests/extension-auto-install.test.ts`（新）、`apps/server/tests/connect-no-preinstall.test.ts`（新）、`apps/server/tests/session-gates.test.ts` |
| T5 L3 自动安装段 | `7765709` | `apps/server/src/integration-smoke.ts` |
| T3 web 一行文案 | `cc83e51` | `apps/web/src/App.tsx` |
| T4 README 双语 | `8cd503e` | `README.md`、`README.zh-CN.md` |

## 实现要点

- 守卫流程（session.ts `ensureExtension`）：存在性检查 → 缺失则一条裸 `CREATE EXTENSION IF NOT EXISTS <ext>`（不带 SCHEMA/VERSION，每请求至多一次）→ 复查同一存在性 + 可调用性检查 → 通过放行；已安装路径零 DDL（查询集合与改前一致）。
- 错误就地转换：安装 SQL 失败即抛既有 `PAGEINSPECT_MISSING` / `WALINSPECT_MISSING`，message 格式 `<ext> extension is missing and automatic installation failed: <PG 原始错误文本>`，nextStep 用修订后常量；PG 原生错误（42501 等）不穿透 `mapPgError`。`app.ts` 零改动（其 `*_MISSING` 分支本就透传 message/nextStep）。
- 幂等：安装抛 `42710 duplicate_object`（及防御性 `42701`）不视为失败，继续复查；复查仍缺 → `*_MISSING`（message 说明 "did not take effect"）。无任何负面缓存（每次守卫重新检查，P1-1 由测试覆盖）。
- 版本门禁：`requireWalCapabilities` 的 PG<15 → `PG_VERSION_UNSUPPORTED` 保持最先（`pool.connect()` 之前），不触库、不发扩展查询、不安装（P0-6 断言 connect 计数为 0）。
- 常量：`PAGEINSPECT_NEXT` / `WALINSPECT_NEXT` 保留超级用户 + `CREATE EXTENSION <name>;` 指引，删除 "will not run" 表述，前缀 "Automatic install failed."。

## TDD 证据

- 红（先写测试后实现）：`pnpm --filter server vitest run` 11 failed / 4 passed —— P0-1..P0-4、P1-1..P1-3 因无自动安装行为失败、session-gates 常量断言失败；P0-5/P0-6/P1-4 为「现状保持」守卫，实现前即绿（符合预期）。
- 绿：实现后 `pnpm --filter server test` → 43/43 passed（server 31 既有 + 12 新增；无既有用例改动语义——indexes.test.ts 的 pageinspect-missing 用例在新流程下语义为「stub 安装成功、复查仍缺 → PAGEINSPECT_MISSING」，断言原样保持并通过；wal.test.ts 的 nextStep 断言未改且仍绿）。

## 验证命令与结果（quality.md §1）

| 命令 | 结果 |
|---|---|
| `pnpm test` | 全绿：wal-core 13、page-core 58、server 43（6 文件）、web 112（10 文件） |
| `pnpm -r typecheck` | 4 包全部 Done，无错误 |
| `pnpm -r build` | 4 包全部 Done，无错误 |
| `pnpm test:integration`（本地 PG 16.11） | exit 0；含 `auto-install (WAL) OK: DROP pg_walinspect -> current-lsn 200 -> re-installed`、`auto-install (Page) OK: DROP pageinspect -> /api/tables 200 -> re-installed`、`Auto-install segment OK`；既有段（heap page / R1 / B-tree oracle / hash guard）无回退 |
| `pnpm test:wal` | exit 0（WAL L3 smoke OK，5 项断言通过） |
| `grep -n "never runs\|will not run\|不会替你" README.md README.zh-CN.md` | 无输出（exit 1） |
| README 双语对应 | Requirements 双语 :44-53（自动安装 + CREATE 权限角色 + 失败报错语义、SQL 块保留为人工回退）、Troubleshooting `*_MISSING` 两行（README.md:112-113 / README.zh-CN.md:110-111）语义一致 |

环境：本地 PostgreSQL 16.11（超级用户），`.env` 已配置（内容未打印、未入库）。

## 验证缺口（承接 plan「验证缺口」节）

1. **L3 安装失败路径不可真实触发**（P0-3/P0-4 实库形态）：本地与 CI 均为超级用户且扩展文件齐备，无法产生真实 42501 / "not available"。风险低：同一就地转换逻辑已由 L2 stub 用例覆盖（响应形状合同不变）。恢复条件：具备非超级用户角色或移除扩展文件的实例时补受限角色 L3 复测（仅失败路径）。
2. **P1-2 真实并发竞态无法自动化复现**：L2 以受控 stub 模拟（多次 CREATE / 42710）；真并发下由 42710 就地处理 + 复查兜底，属 Review 代码审查确认项。
3. 无其他缺口：P1-4 已按 plan 可选路径实现（`vi.mock("pg")` 拦截 Pool，证明 `POST /api/connect` 仅发 `SELECT version()`，不预装），未省略。

## 安全影响（供 Reviewer 检查）

- 触发面：授权/权限语义 + DDL 写操作。server 仅对用户显式连接的库执行 `CREATE EXTENSION IF NOT EXISTS pageinspect|pg_walinspect` 两条裸语句，无其他 DDL；不落盘安装记录；失败信息仅含 PG 服务端错误文本（无凭据回显）。
- 未新增依赖、未触碰认证与输入处理路径；`.env` 未提交（分支全部提交仅含上述路径）。

## 文档影响核对（plan「文档影响」项）

- 开发文档：session.ts / integration-smoke.ts 注释已随实现更新；本 dev-notes 即验证记录。
- 用户文档：README 双语（T4）、App.tsx 连接表单文案（T3）已更新；`apps/web/src/api.test.ts` 零改动（确认为错误处理 stub，不依赖该文案）。
- 运维文档：N/A（plan 裁定，排障语义已入 Troubleshooting）。

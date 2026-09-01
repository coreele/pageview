# Plan: auto-install-extensions

## 元信息

- 工作项标识: auto-install-extensions
- 依据 Spec: workflow/docs/features/auto-install-extensions/spec.md（含已裁决开放问题 1）
- 依据 Design: N/A（Design 门禁为 skipped；UI 表面 gui 仅一行文案，无 ui-design.md，见「UI/UX」）
- 路径等级: standard
- Review 门禁: required（standard；非 skipped）
- 最低验证层: L2（单测 + typecheck + build；理由见「验收」）。L3 自动安装段经评估可行，作为任务 5 纳入本地与 CI
- 验证命令: 见「验收」

## 适用工程规范

- [文档工程](../../standards/documentation.md)
- [Git 协作](../../standards/git.md)
- [质量与验证](../../standards/quality.md)
- [安全](../../standards/security.md)

## 目标摘要

- 守卫改为「检查 → 缺失则 `CREATE EXTENSION IF NOT EXISTS <ext>;` → 复查 → 失败才报既有错误码」。错误码集合不变，`*_MISSING` 语义收窄为「缺失且自动安装失败」，message 附 PG 原始原因，nextStep 改人工指引；已安装路径零 DDL；WAL 版本门禁（PG<15 → `PG_VERSION_UNSUPPORTED`）保持先于扩展检查，不尝试安装。依据 spec「合同」节。
- 同步修订用户可见合同：web 连接表单一行文案（spec 开放问题 1 裁决）与 README 双语（P0-8）。
- 源分支 `auto-install-extensions` 自 `main` 创建（工作项记录）；全部实现、文档与报告在源分支完成。

## UI/UX

- UI 表面 gui，仅 `apps/web/src/App.tsx:1269-1272` 连接表单 `<p className="muted">` 内一句英文文案，替换为裁决文案：`Missing pageinspect / pg_walinspect are installed automatically when needed; failures are reported with the reason.`（前后文不动，不改错误处理，无布局/交互变更）。无 ui-design.md（Design 门禁 skipped），以 spec「开放问题（已裁决）」第 1 条为准。

## 任务拆解

> TDD：任务 2 的关键失败用例先于任务 1 实现编写，两任务交错至全绿。

1. **server 守卫自动安装流程 + 错误就地转换**（`apps/server/src/session.ts`）
   - `verifyPageinspect` / `verifyWalinspect`（或其 require 包装）改为：存在性检查缺失 → `CREATE EXTENSION IF NOT EXISTS pageinspect|pg_walinspect;`（裸语句，不带 SCHEMA/VERSION；同一请求至多一次尝试）→ 重新执行同一存在性 + 可调用性检查（复用既有逻辑）→ 通过即放行。
   - 安装 SQL 失败或复查未通过 → 就地抛既有 gateError：`PAGEINSPECT_MISSING` / `WALINSPECT_MISSING`，message 必须包含 PG 原始错误文本（如 42501 `permission denied to create extension`、`extension "..." is not available`），nextStep 用修订后常量。禁止 PG 原生错误穿透 `mapPgError`（42501 现映射 403 PERMISSION、其余多为 INTERNAL）。
   - 安装抛 `42710 duplicate_object`（并发已建）不视为失败，继续复查（spec 合同 3 幂等要求）。
   - 修订 `PAGEINSPECT_NEXT` / `WALINSPECT_NEXT`（session.ts:104-107）：保留超级用户 + `CREATE EXTENSION <name>;` 人工指引语义，删除「This app will not run CREATE EXTENSION for you」表述。
   - `requireWalCapabilities` 版本门禁保持最前：PG<15 抛 `PG_VERSION_UNSUPPORTED`，不连池、不发扩展查询、不安装（P0-6 现状保持）。
   - 完成条件：`pnpm --filter server typecheck` 通过；任务 2 全部用例绿。
2. **server 单测（先写红测）**（`apps/server/tests/`）
   - 更新 `session-gates.test.ts`「extension gate messages」两处 `will not run CREATE EXTENSION` 断言为新常量合同（含 `CREATE EXTENSION <name>`、超级用户指引、无禁止表述）；核对 `wal.test.ts` 的 `WALINSPECT_MISSING` nextStep 断言仍绿。
   - 沿 `indexes.test.ts` 的 inject + stub pool 模式新增用例，以 stub 捕获的 SQL 序列断言：
     - P0-1/P0-2：缺失 → 发出 `CREATE EXTENSION IF NOT EXISTS ...` → 复查通过 → 请求 200；
     - P0-3：安装抛 42501 → HTTP 400 `*_MISSING`，message 含原因，nextStep 含 `CREATE EXTENSION <name>`，响应体三字段 `{code, message, nextStep}`（P0-7）；
     - P0-4：安装抛 `extension "..." is not available` → 同 P0-3；
     - P0-5：已安装 → SQL 序列无任何 `CREATE EXTENSION`；
     - P0-6：serverVersion=PG14 → `PG_VERSION_UNSUPPORTED`，无 `pg_extension` 查询、无 DDL；
     - P1-1：安装失败后同会话重试（stub 第二次成功）→ 200（无负面缓存）；
     - P1-2：重复/并发触发（stub 对多次 CREATE 幂等成功或抛 42710）→ 全部放行，无 already exists 伪错误；
     - P1-3：安装成功但复查仍缺失 → `*_MISSING`；
     - P1-4（可选）：`vi.mock("pg")` 拦截 Pool 验证 `POST /api/connect` 仅发 `SELECT version()`、不发扩展查询/DDL；若省略，在 dev-notes 记录理由（connect 路径零改动，由 Review 确认）。
   - 核对 `indexes.test.ts` 既有 pageinspect-missing 用例在新流程下的语义（stub 下安装"成功"、复查仍缺 → `PAGEINSPECT_MISSING`），保持或调整断言。
   - 完成条件：`pnpm --filter server test` 全绿；上述编号各至少一条用例（P1-4 除外）。
3. **web 一行文案**（`apps/web/src/App.tsx:1269-1272`）
   - 按「UI/UX」替换该句；`apps/web/src/api.test.ts` 是错误处理 stub、不依赖该文案，零改动。
   - 完成条件：文案与裁决一致；`pnpm --filter web test` 与 `pnpm -r typecheck` 绿。
4. **README 双语修订**（P0-8）
   - `README.md` / `README.zh-CN.md` Requirements 节（双语 :44-52 一带）：删除「never runs / 不会替你执行」承诺，说明缺失时自动安装、需具备 `CREATE` 权限的角色（通常超级用户）、失败时报错并给人工指引；SQL 示例块保留作人工指引。
   - Troubleshooting 两行 `*_MISSING`（README.md:112-113、README.zh-CN.md:109-110）：改「自动安装失败（如权限不足/扩展文件缺失）」语义，指引以超级用户执行 `CREATE EXTENSION <name>;` 或安装扩展文件后重试；双语一致。
   - 完成条件：`grep -n "never runs\|will not run\|不会替你" README.md README.zh-CN.md` 无输出；两文件对应节语义一致。
5. **L3 自动安装段（评估结论：可行）**（`apps/server/src/integration-smoke.ts`）
   - 可行性依据：CI integration job 以 `postgres:16` 超级用户连接（`.github/workflows/ci.yml`）；本地 PG16.11（`.env` 已配置）同为高权限；`DROP EXTENSION` 与守卫自动装回均可在段内完成。
   - 在既有段之后新增（B-tree oracle 直接调用 pageinspect 函数，DROP 须置最后）：`DROP EXTENSION IF EXISTS pg_walinspect` → `GET /api/wal/current-lsn` 期望 200 → 查 `pg_extension` 确认装回；`DROP EXTENSION IF EXISTS pageinspect` → `GET /api/tables` 期望 200 → 确认装回。`finally` 兜底重建扩展，段失败不留残缺状态。
   - CI 无需改动：psql pre-create 步骤保留，为已安装路径（P0-5 端到端）提供前提。
   - 完成条件：本地 `pnpm test:integration` exit 0 且日志含自动安装段 OK；CI integration job 通过。

## 依赖与顺序

- 任务 2 红测 → 任务 1 实现转绿（TDD 交错，同批交付）；任务 5 依赖任务 1；任务 3、4 相互独立，可并行。总顺序：1↔2 → 5 → 3 ∥ 4。

## 触碰路径

- `apps/server/src/session.ts`（守卫流程、NEXT 常量）
- `apps/server/tests/session-gates.test.ts`、`apps/server/tests/wal.test.ts`（断言修订）、守卫安装用例（新文件或并入既有）
- `apps/web/src/App.tsx`（一行文案）
- `README.md`、`README.zh-CN.md`
- `apps/server/src/integration-smoke.ts`（L3 段）
- 新增 `workflow/docs/features/auto-install-extensions/dev-notes.md`（验证记录，Developer 主责）
- 不触碰：`scripts/capture-fixtures.ts` 与 `packages/page-core/fixtures/README.md`（spec 非目标）、`apps/web/src/api.test.ts`、错误码集合、`mapPgError` 其他分支、`connectSession`。

## 验收

> Spec P0/P1 见 spec.md「验收」。映射：P0-1~P0-7 → 任务 1/2（L2）；P0-1/P0-2 端到端 → 任务 5（L3）；P0-8 → 任务 4；P1-1/P1-3/P1-4 → 任务 2；P1-2 真并发见「验证缺口」。

- **最低验证层：L2**。理由：行为变化集中于守卫流程与错误就地转换，全部可用既有 inject + stub pool 单测表达（含 SQL 序列与响应形状断言）；L3 自动安装段可行且纳入任务 5（本地 + CI），但属端到端增强，不设为最低门槛——环境不可达时记缺口，不阻塞 Review/QA。
- 验证命令（可复现）：
  ```bash
  pnpm --filter server test
  pnpm test && pnpm -r typecheck && pnpm -r build
  pnpm test:integration    # 需 .env + 本地 PG16.11；含新增自动安装段
  pnpm test:wal
  grep -n "never runs\|will not run\|不会替你" README.md README.zh-CN.md
  ```
- 预期证据：
  - server vitest 全绿，含新增守卫安装用例（覆盖上述 P0/P1 编号）；
  - typecheck、build 无错误；web 单测绿（任务 3 后）；
  - `pnpm test:integration` exit 0，日志含自动安装段（两扩展 DROP → 请求 200 → `pg_extension` 确认装回）；`pnpm test:wal` exit 0；
  - grep 命令无输出。
- **Review 门禁（required）与进入 QA 条件**：
  - Reviewer `Approve` 为进入 QA 前置。审查重点：守卫流程与 spec 合同逐条一致；错误就地转换无泄漏（42501 不得再走 403 PERMISSION）；测试有效性；文档影响一致。
  - 安全影响检查（security.md 触发面：授权/权限语义、DDL 写操作）：server 仅对用户显式连接的库执行 `CREATE EXTENSION IF NOT EXISTS`、无其他 DDL、不落盘安装记录、失败信息仅含 PG 服务端错误文本；范围与结论记入 `review.md`。
  - Developer 提交 Review 前，将验证命令与结果记入 `dev-notes.md`（quality.md §1）。

## 验证缺口

- **L3 安装失败路径不可达**（P0-3/P0-4 实库形态）：本地与 CI 均为超级用户且扩展文件齐备，无法真实触发 42501 / not available。风险低（同一段就地转换逻辑已由 L2 stub 覆盖，错误形状合同不变）。恢复条件：具备非超级用户角色的实例或移除扩展文件的环境时，补受限角色 L3 复测，范围仅失败路径。
- **P1-2 真实并发竞态**：L2 以受控 stub 模拟并发/重复；真并发下 `duplicate_object`（42710）由任务 1 就地处理兜底，属 Review 代码审查确认项，无法自动化复现罕见竞态。
- 若本地 PG 短暂不可用：L3 段无法执行 → 原因、风险与恢复条件记入 `dev-notes.md`；CI push/PR 后 integration job 仍会覆盖。

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | `apps/server/src/session.ts`、`apps/server/src/integration-smoke.ts` 注释随实现更新；新增 `workflow/docs/features/auto-install-extensions/dev-notes.md` 记录验证结果 |
| 用户文档 | `README.md`、`README.zh-CN.md`（Requirements 与 Troubleshooting，P0-8）；`apps/web/src/App.tsx` 连接表单一行文案 |
| 运维文档 | N/A——本地调试工具，无部署/监控/备份文档；排障语义变更已在用户文档 Troubleshooting 覆盖 |

## 交接顺序

1. Developer 自 `main` 创建并检出 `auto-install-extensions`，按任务 1↔2（TDD）→ 5 → 3∥4 实施；验证全绿后写 `dev-notes.md`，提交 Review。
2. Reviewer（门禁 required）：代码、测试、文档影响与安全检查；`Approve` 后进入 QA，`Request changes` 退回 Developer。
3. QA 依据 spec P0/P1 与本 Plan 验证层独立验收（含 L3 与 README 双语），写 `qa-report.md`。
4. QA Pass 且用户授权后，Manager 按工作项记录在源分支置 `done` 并与未入库报告一次提交，随后合并 `auto-install-extensions` → `main`（git.md）。

Plan 须经当前用户会话确认、Manager 持久化确认结果后方可置 `planned` 并调度 Developer。

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-08-31 | 初稿（Planner：依据已确认 spec、代码/测试/README/CI 现状调研） |

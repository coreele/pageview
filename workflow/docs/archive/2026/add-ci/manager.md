# 工作项记录: add-ci

工作项标识: add-ci
描述: 为 pageview 补齐 CI 与测试脚本基础设施。新增 GitHub Actions 双 Job 工作流（unit + integration）；修复根 `package.json` 的 `test` 脚本漏掉 web 包；将 `apps/server/src/wal-smoke.ts` 提升为正式 npm script 并纳入集成 Job。不含 ESLint/Prettier（另开工作项）。
路径等级: standard
源分支: add-ci
目标分支: main
文档影响: 根 `README.md`（CI 章节与本地测试命令说明，若与脚本不一致则同步）；`workflow/docs/standards/quality.md`（若已声明 CI 守护则补具体命令，否则 N/A）。

> 权威工作流、门禁与状态说明见 [workflow/README.md](../../../README.md)。
> 活跃状态见 [STATUS.md](STATUS.md)。
>
> 文档路径：未拆分，Spec 为 `workflow/docs/features/add-ci/spec.md`（Spec 门禁 skipped，可能不产出）。

## 切片（未拆分时仅一行，sub-feature-id = feature-id）

| sub-feature-id | Spec | Spec 门禁 | Spec 用户确认 | Design 门禁 | UI 表面 | Review 门禁 | 状态 | 后续步骤 |
|---|---|---|---|---|---|---|---|---|
| add-ci | N/A（门禁 skipped） | skipped | not-required | skipped | none | required | done | 已授权合并；待合入 main |

阻塞原因: none
恢复条件:
恢复后的目标状态:

> 2026-08-11: 用户授权调度 Reviewer。
> 2026-08-11: Reviewer 结论 **Approve**（无阻塞项；非阻塞 Comment C1–C3）。`review.md` 已产出（未提交）。Review 门禁 required **已满足**。L3 CI 实跑为核心证据缺口，交 QA。
> 2026-08-11: QA 首轮结论 **Blocked**。L2 独立复测全 Pass（P0-1/2/5/6）；L3（P0-3/4）因 CI 未触发而 Blocked——非实现缺陷，是验证条件未满足。源分支已 push 至 `origin/add-ci`。`qa-report.md` 已产出（未提交）。状态 `qa` → `blocked`。
> 2026-08-11: 用户会话安装 `gh` 并认证。QA 经 `gh pr create` 开 PR #1（`add-ci` → `main`），`pull_request` 触发 CI。两 Job 均 Pass（`unit` 47s/81 tests、`integration` 51s/两 smoke OK）。L3 证据完整（P0-3/4 通过）。QA 第二轮结论 **Pass**。状态 `blocked` → `qa`。PR：https://github.com/coreele/pageview-private/pull/1 ；Actions run：31470389230。**请求用户合并授权**——授权后 Manager 在源分支置 `done` 并一次提交 STATUS/工作项/review/qa-report，再合入 `main`。

阻塞原因:
恢复条件:
恢复后的目标状态:

## 进度笔记

- 2026-08-11: Manager 登记工作项。范围经用户会话确认：CI + 测试脚本修复（不含 lint）。PG 策略：`postgres:16` + `pageinspect` + `pg_walinspect`（PG16 起为 contrib 自带）。门禁判定：Spec skipped（工程基础设施，无业务合同/公开 API/状态转换/错误约定/跨模块合同）；Design skipped（无模块边界/分层/技术选型决策，CI 为 GitHub Actions 标准模式）；Review required（standard 默认）。源分支 `add-ci`、目标分支 `main`。跳过 Spec，直接进入 planning；将产出 `plan.md` 待用户确认后进入 developing。
- 2026-08-11: Planner 完成 `plan.md`（T1 修根 test 脚本 → T2 提升 wal-smoke 为 script → T3 新建 ci.yml 双 Job → T4 文档同步）。最低验证层 L3。状态 `planning` → `awaiting-plan-approval`。单步模式：**不**自动调度 Developer；等待用户确认 Plan。
- 2026-08-11: **Plan 用户确认**（用户回复「ok」）。状态 `awaiting-plan-approval` → `planned` →（调度 Developer）`developing`。源分支 `add-ci`（自 `main` 创建），目标分支 `main`。

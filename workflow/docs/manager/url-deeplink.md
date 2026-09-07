# 工作项记录: url-deeplink

工作项标识: url-deeplink
描述: URL 状态深链：将应用视图状态编码进 URL（mode/kind/table 或 index/blkno/WAL LSN 等，范围由 Spec 定界），支持分享链接、收藏书签、新 tab 并排对照；启动时解析参数还原视图（连接探测→自动加载→失效参数优雅报错）。为后续「右键新 tab 打开」等增强铺路。纯 web 子系统，server/page-core 预计零触碰。
路径等级: standard（常规功能 + 可见行为合同变更；纯 web 新子系统）
源分支: url-deeplink（实施时自 main 创建）
目标分支: main
文档影响: README 双语（Features 增深链一句 + 示例 URL）；细节由 Plan 落实。

> 权威工作流、门禁与状态说明见 [workflow/README.md](../../README.md)。
> 活跃状态见 [STATUS.md](STATUS.md)。

## 切片（未拆分时仅一行，sub-feature-id = feature-id）

| sub-feature-id | Spec | Spec 门禁 | Spec 用户确认 | Design 门禁 | UI 表面 | Review 门禁 | 状态 | 后续步骤 |
|---|---|---|---|---|---|---|---|---|
| url-deeplink | [spec.md](../features/url-deeplink/spec.md) | required（可见行为合同：编码范围/历史粒度/还原行为/错误合同） | approved（2026-09-04 四裁决后通过） | required（已满足：design.md + ui-design.md 已产出） | gui | required | done | 已授权合并（QA 轮次 3 Pass + 复审 Approve）；待 FF 合入 main |

阻塞原因: none
恢复条件: none
恢复后的目标状态: N/A

## 进度笔记

- 2026-09-04 Manager 登记（用户启动路线图②）。背景：应用现零路由/零 URL 机制；路线图讨论确认深链为「分享/书签/并排对照/右键新 tab」多项增强的地基。预览识别的典型裁决点：历史粒度（Load 产生历史 vs 仅 replaceState）、编码范围（table 过滤器/瞬态交互排除）、未连接时还原行为。
- 2026-09-07 用户要求继续 url-deeplink。实现已完成（Review Approve；QA 轮次 1 Blocked）。不得跳过 QA Pass 请求合并。下一步仍为路径 B：先确认并实施 e2e-playwright。
- 2026-09-07 用户确认调度 QA 轮次 2。路径 B 已满足：`e2e-playwright` QA 轮次 1 Pass（`workflow/docs/features/e2e-playwright/qa-report.md`；本地 `pnpm test:e2e` 11 passed）。状态 `blocked` → `qa`。轮次 2 追加到既有 `qa-report.md`；套件与 P0-8 守卫（`6dd36e0`）在分支 `e2e-playwright`（自本项 tip `d452978`），不在源分支 `url-deeplink` tip。合入顺序仍为本项先入 `main`，再合 `e2e-playwright`。
- 2026-09-07 QA 轮次 2 **Fail**（`qa-report.md` 工作区未提交）。D1：源分支 tip `d452978` 已连接形态下 `refreshTables`/`refreshIndexes` 无条件 `setError(null)` 清掉 `BAD_URL_PARAM`（P0-8/M4）；修复已在 `e2e-playwright` `6dd36e0`。用户确认打回修复。状态 `qa` → `developing`。Developer：将 `6dd36e0` 合入源分支 `url-deeplink`，更新 `dev-notes.md`。随后 Reviewer 复审（范围限 App.tsx 两守卫 + P0-8），再 QA 轮次 3（建议 M4 + `pnpm test:e2e`）。
- 2026-09-07 用户确认调度 Reviewer 复审。Developer 已将源分支快进至 `6dd36e0` 并提交回执 `d96b73d`。状态 `developing` → `reviewing`。
- 2026-09-07 Reviewer 复审 D1 **Approve**（`review.md` 工作区追加，未提交）。用户确认调度 QA 轮次 3。状态 `reviewing` → `qa`。
- 2026-09-07 QA 轮次 3 **Pass**。用户授权合并。状态 `qa` → `done`。本提交纳入未入库 `review.md` / `qa-report.md`。随后 FF 合入 `main`。

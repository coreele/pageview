# 工作项: unify-module-radius-spacing

描述: 统一各模块（chrome、pane、panel、tree section、structure / hex / detail / WAL 卡片等）的圆角与间距：建立 CSS 设计令牌并替换散落的临时值，同时把偏大的模块间距整体收小。
目标分支: main
源分支: unify-module-radius-spacing
基线提交: 6033697a152f2f5a1f5c2ce9a9fbc188e3b9921c
文档影响: N/A（纯样式，无用户文档行为变化）

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| standard | skipped | not-required | skipped | required |

> Spec 门禁 skipped：纯视觉样式整理，不新增行为、公开接口、状态转换、错误约定或跨模块合同。Design 门禁 skipped：无模块边界 / 分层 / 技术选型决策，样式改动集中在 `apps/web/src/styles.css`。另出 ui-design.md 固化令牌与映射。

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| done | 已合入，结束 | | | |

## 进度笔记

- 2026-09-13 登记。用户诉求：统一模块圆角与间距，当前间距偏大。现状扫描：`styles.css` 圆角出现 0/1/2/3/4/5/6/8/10/999px/50% 共 11 种值，间距（gap/padding/margin）有 0.05–2rem 数十种临时值。范围限定在模块级容器与其间/内部上下留白，不逐条重排微型元素。无行为合同，Spec 门禁 skipped。
- 2026-09-13 Planner 完成 `ui-design.md` 与 `plan.md`：新增主题无关 `:root` 令牌（`--radius-xs/sm/md/lg/pill/circle`、`--space-1..7`），大表面 10px 收敛到 8px，模块级间距整体收小约 10–20%；新增 `designTokens.test.ts` 以 CSS 契约测试锁定令牌与替换结果。Review required，视觉为 manual 缺口。第一阶段文档提交后进入 developing。
- 2026-09-13 Developer 完成实现并提交 `7ee081d`，`pnpm --filter web test` 309 passed、typecheck、build 全绿；同步 no-op。
- 2026-09-13 Reviewer 结论 `Request changes`：R-1（阻塞）`.chrome-meta` 的 `margin: 0 -0.75rem` 未随 `.chrome` 横向 padding 收小（现 `var(--space-6)`=0.6rem）同步，导致 meta 条每侧外溢约 0.15rem、可能横向滚动；R-2 `.selection-detail` 的 `max-width` calc 仍用旧 gap 0.45rem（现 `var(--space-3)`=0.35rem）。回退 `developing` 修复。
- 2026-09-13 Developer 修复并提交 `1aa7a27`（R-1/R-2 + 新增耦合契约断言），311 passed、typecheck、build 全绿。Reviewer 复评 `Approve`，R-1/R-2 关闭。
- 2026-09-13 QA 结论 `Pass`，V-1..V-8 全过；视觉经 Playwright + 真 PG 三视图（1440×900 / 700×800）核对，无横向溢出，`.chrome-meta` 与 `.chrome` padding 精确反向。无缺陷。进入 merge-approval，等待用户授权。
- 2026-09-13 用户授权合并。置 `done`，第三阶段文档提交后 rebase + fast-forward 合入 `main`，清理源分支。结束（不归档）。

# 工作项记录: next-page-btn

工作项标识: next-page-btn
描述: 在工具栏 Refresh 右侧增加 **Prev** / **Next**。Heap：`blkno ± 1`；B-tree：`btpo_prev` / `btpo_next`。末页/无兄弟时禁用。启用条件同 Refresh（须已加载当前页）。Heap 的 page 统计条须像 index 一样落在选择列表下方（不得在宽屏下与表下拉并排）。来源：用户对工具栏的请求。
路径等级: standard
源分支: next-page-btn（实施时自 main 创建）
目标分支: main
文档影响: 若 README 描述 Load/Refresh 操作，须补 Next；由 Plan 阶段确认。无运维文档影响。

> 权威工作流、门禁与状态说明见 [workflow/README.md](../../README.md)。
> 活跃状态见 [STATUS.md](STATUS.md)。
>
> 文档路径：未拆分，Spec 为 `workflow/docs/features/next-page-btn/spec.md`。

## 切片（未拆分时仅一行，sub-feature-id = feature-id）

| sub-feature-id | Spec | Spec 门禁 | Spec 用户确认 | Design 门禁 | UI 表面 | Review 门禁 | 状态 | 后续步骤 |
|---|---|---|---|---|---|---|---|---|
| next-page-btn | [spec.md](../features/next-page-btn/spec.md) | required | approved | skipped | gui | required | done | 已授权合并（QA Pass + Review Approve）；待 FF 合入 main |

阻塞原因: none
恢复条件: none
恢复后的目标状态: N/A

## 门禁判定

- **路径 standard**：常规 GUI 增强（工具栏按钮 + 复用现有 Load），非单点热修，亦非跨模块新能力。
- **Spec required**：新增用户可见行为与状态转换（blkno 递增、加载、末页禁用/报错）。
- **Spec 用户确认 required**：登记时存在业务歧义。用户 2026-09-01 已裁决（写入 Spec 后仍须确认成文合同）：
  1. 作用面：heap 与 index 工具栏都加。
  2. 「下一页」：heap = 已显示页 `blkno + 1`；btree = `btpo_next` 右兄弟（非关系顺序块号）。Prev 对称：`blkno - 1` / `btpo_prev`。
  3. 末页/无兄弟：禁用 Next（不发越界请求）。Prev 在首页/无左兄弟时同样禁用。
  4. 启用：同 Refresh，须已加载当前页。
  5. 本项包含 Prev。
  6. Heap 的 page 统计条参考 index，放在选择列表下方。
- **Design skipped**：无模块边界 / 分层 / 技术选型；复用现有 `loadBlk` / `loadIndexBlk` 与 blkno 状态。
- **UI 表面 gui**：工具栏按钮。Design 已 skipped，不要求 `ui-design.md`；呈现与禁用合同写入 Spec（样式对齐 Refresh）。
- **Review required**：standard 默认。

## 进度笔记

- 2026-09-01 Manager 登记。未拆分。状态 `backlog`。用户要求在 Refresh 后添加 Next 以获取下一页。后续：调度 Analyst 编写 Spec。
- 2026-09-01 用户裁决 1–5 + heap 统计条放到选择列表下方。状态 `backlog` → `speccing`。调度 Analyst。
- 2026-09-01 Analyst 完成 `spec.md`（refine-docs 已跑）。状态 `speccing` → `awaiting-spec-approval`。待用户确认成文合同。
- 2026-09-01 用户确认 Spec（「ok」）。Spec 用户确认 → `approved`。Design skipped → `planning`。调度 Planner。
- 2026-09-01 Planner 完成 `plan.md`（T1–T6，refine-docs 已跑）。状态 `planning` → `awaiting-plan-approval`。待用户确认 Plan。
- 2026-09-01 用户确认 Plan（「ok」）。状态 `awaiting-plan-approval` → `planned` → `developing`。调度 Developer 于源分支 `next-page-btn`。
- 2026-09-01 用户调度 Reviewer。状态 `developing` → `reviewing`。Review 结论 **Approve**（`review.md` 未提交；C1–C3 非阻塞）。后续：调度 QA。
- 2026-09-01 用户调度 QA。状态 `reviewing` → `qa`。QA 轮次 1 **Pass**（独立 `pnpm test` 214 + 活库边界；浏览器点击按 §6 记录）。`qa-report.md` 未提交。待用户授权合并。
- 2026-09-01 用户授权合并（「合入」）。状态 `qa` → `done`。本提交纳入未入库 `review.md` / `qa-report.md`。随后 FF 合入 `main`。

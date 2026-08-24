# 工作项记录: deleted-tuple-color

工作项标识: deleted-tuple-color
描述: 页结构图中为「被删除的元组」使用与存活元组不同的颜色，便于一眼区分。用户截图将 `xmax != 0` 的两行（1fa0 / 1fc0）标出，作为意图示意。
路径等级: standard
源分支: deleted-tuple-color
目标分支: main
文档影响: README 若列出结构图图例/区域色则同步；无运维文档影响。

> 权威工作流、门禁与状态说明见 [workflow/README.md](../../../README.md)。
> 活跃状态见 [STATUS.md](STATUS.md)。
>
> 文档路径：未拆分，Spec 为 `workflow/docs/features/deleted-tuple-color/spec.md`。

## 切片（未拆分时仅一行，sub-feature-id = feature-id）

| sub-feature-id | Spec | Spec 门禁 | Spec 用户确认 | Design 门禁 | UI 表面 | Review 门禁 | 状态 | 后续步骤 |
|---|---|---|---|---|---|---|---|---|
| deleted-tuple-color | [spec.md](../features/deleted-tuple-color/spec.md) | required | approved | skipped | gui | required | blocked | 用户要求恢复后，先确认是否修订 infomask 判定，再确认 Plan |

阻塞原因: 用户要求暂停（「等后面再说」）。Plan 未确认。用户已质疑 T2 忽略 infomask。
恢复条件: 用户明确要求继续本工作项。
恢复后的目标状态: awaiting-plan-approval（恢复时须先确认判定：仅 `t_xmax` 或排除 `HEAP_XMAX_LOCK_ONLY` / `HEAP_XMAX_INVALID`；若改判定则先修订 Spec 再改 Plan）

## 门禁判定

- **路径 standard**：常规 GUI 展示增强，非单点修复，亦非跨模块新能力。
- **Spec required**：新增用户可见行为合同（何种元组算「被删除」、着色范围、图例）。
- **Spec 用户确认 required**：工作项标注存在业务歧义——PostgreSQL 中「删除」可指 `t_xmax != 0`、`HEAP_XMAX_COMMITTED`、非 `HEAP_XMAX_INVALID`、非 `HEAP_XMAX_LOCK_ONLY`、ItemId `LP_DEAD`，或 UPDATE 产生的旧版本。截图示意偏向 `xmax != 0`，合同须由 Spec 写清并经用户确认。
- **Design skipped**：无模块边界 / 分层 / 技术选型决策；复用既有 `region: "tuple"` 结构图与 CSS token。
- **UI 表面 gui**：结构图着色与图例。Design 已 skipped，不要求 `ui-design.md`；色值与图例合同写入 Spec。
- **Review required**：standard 默认。

## 进度笔记

- 2026-08-24: Manager 登记工作项。未拆分。状态 `backlog`。后续：Analyst 编写 Spec。
- 2026-08-24: Analyst 完成 `spec.md`。用户确认 Spec（「ok」按建议）：判定 `t_xmax !== 0`；图例 `deleted`；色相红/玫红。开放问题关闭。Spec 用户确认 → `approved`。Design skipped → `planning`。
- 2026-08-24: Planner 完成 `plan.md`（T1–T6；Design/UI-UX N/A）。状态 `awaiting-plan-approval`。后续：用户确认 Plan。
- 2026-08-24: 用户质疑 T2 忽略 infomask，并要求暂停。Plan **未**确认。状态 `awaiting-plan-approval` → `blocked`。未建源分支、无实现代码。Spec/Plan 文件保留。

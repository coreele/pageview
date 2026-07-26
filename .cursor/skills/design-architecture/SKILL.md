---
name: design-architecture
description: Use when the Planner must resolve module boundaries, layering, or technology choices before writing a Plan.
---

# design-architecture — 结构设计

## 调用者与门禁

- 调用者：Planner。
- 调用条件：工作项记录中对应 `(feature-id, sub-feature-id)` 的 Design 门禁为 `required`。
- 执行时机：Spec 门禁满足后、Plan 编写前。
- 下文「切片目录」指：未拆分为 `docs/features/<feature-id>/`，已拆分为 `docs/features/<feature-id>/<feature-id>-<sub-feature-id>/`。
- 输入：
  - `docs/manager/<feature-id>.md`；
  - 对应切片的 Spec（Spec 门禁为 `required` 时）：`<切片目录>/spec.md`（必要时并读总览）。
- 产出：`<切片目录>/design.md`。

## 设计范围

仅记录需要决策的结构事项：

- 模块边界与职责；
- 分层及依赖方向；
- 技术选型、备选方案与取舍；
- 决策对模块、迁移、风险和验证策略的影响。

Design 文件必须说明设计背景、约束、候选方案、决策、影响与风险。存在可行替代方案时，必须记录比较依据。

## 边界

API 形状、数据约束、错误约定和行为验收属于 Spec。发现这些合同信息缺失或存在歧义时，必须停止并向 Manager 报告，不得在 `design.md` 中替代 Spec 作出需求决策。

信息架构、交互状态、GUI/CLI 体验与主题策略属于 `design-ui` / `ui-design.md`（当 `UI 表面` 为 `gui` 或 `cli` 时）；不得在本 Skill 中替代完成。

禁止编写实现代码、实施任务拆分、Plan 或工作项状态。禁止修改 `feature-id`，产出必须位于既有 Feature（或其子工作项）目录下。

## 后续步骤

Design 文件完成后返回 Planner。Planner 依据已满足门禁的 Spec、工作项记录和该 Design 文件在同一切片目录编写 `plan.md`。

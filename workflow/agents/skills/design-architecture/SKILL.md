---
name: design-architecture
description: 编写结构设计到 workflow/workspace/<id>/design.md，记录模块边界、分层、依赖方向与技术选型取舍。当工作项 Design 门禁为 required、即 Plan 之前需要先解决结构或选型决策时由 Planner 使用。不用于 API 形状与行为合同（那是 spec.md），也不用于界面设计（那是 design-ui）。
---

# design-architecture — 结构设计

调用者 Planner。调用条件：`workflow/workspace/<id>/main.md` 中 Design 门禁为 `required`。时机：Spec 门禁满足后、Plan 之前。

输入：`main.md`、`spec.md`（Spec 门禁 `required` 时）。产出：`workflow/workspace/<id>/design.md`，模板 [design.md](../../templates/design.md)。

## 范围

只记录**需要决策**的结构事项：模块边界与职责、分层与依赖方向、技术选型与备选取舍、决策对迁移与验证策略的影响。

必须写清设计背景、约束、候选方案、决策、影响与风险。存在可行替代方案时记录比较依据。

## 边界

| 属于别处 | 去向 |
|---|---|
| API 形状、数据约束、错误约定、行为验收 | `spec.md` |
| 信息架构、交互流、布局视觉 | `ui-design.md`（`design-ui`） |
| 任务拆分与验证命令 | `plan.md` |

发现 Spec 合同缺失或歧义时**停止并报告**，不得在 `design.md` 里替代 Spec 作需求决策。

禁止写实现代码、Plan、UI 稿；禁止改 `<id>`、`main.md` 或 [STATUS.md](../../../STATUS.md)；禁止 git 提交（由 Manager 提交）。

## 交接

返回 Planner，由其在同一目录编写 `plan.md`。

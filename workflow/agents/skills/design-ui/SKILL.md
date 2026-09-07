---
name: design-ui
description: 编写界面与交互设计到 workflow/workspace/<id>/ui-design.md，含信息架构、关键流程、布局视觉、组件交互、响应式与无障碍约定。当工作项范围含用户可见界面且存在布局或信息架构决策时，由 Planner 在 Plan 之前使用。纯后端、API、文档或仅文案与小样式调整则跳过；模块边界与技术选型用 design-architecture。
---

# design-ui — 界面与交互设计

调用者 Planner。**不是门禁**，没有状态字段，按范围按需调用。时机：Spec 门禁满足后、Plan 之前，可与 `design-architecture` 先后或并行（二者互不替代）。

输入：`workflow/workspace/<id>/main.md`、`spec.md`（若有）、仓库既有设计系统或布局约定。产出：`workflow/workspace/<id>/ui-design.md`，模板 [ui-design.md](../../templates/ui-design.md)。

## 调用 / 跳过

| 调用 | 跳过 |
|---|---|
| 新增或重做页面、关键界面流、表单向导、导航信息架构 | 纯后端 / API / 脚本 / 文档 |
| 布局层级、视觉方向、组件选用有决策空间 | 仅文案、颜色 token 微调、无布局与信息架构变更 |
| 响应式断点或无障碍行为需要约定 | `fast` 且 Plan 已能写清触碰路径与验收 |

拿不准时：Spec 含用户可见界面且存在开放的布局或交互问题就调用；否则跳过，并在 Plan 元信息把「依据 UI」标 `N/A`。

## 范围

只记录需要决策的事项：用户与关键场景；信息架构与首屏组成；关键流程（步骤、分支、空态 / 加载 / 错误）；布局层级与视觉方向；组件与交互约定（优先复用既有设计系统）；响应式与无障碍要点；对 Plan 与 Developer 的可执行约束。

## 边界

行为合同与验收属 `spec.md`；模块边界与技术选型属 `design.md`；任务拆分与验证命令属 `plan.md`。

发现 Spec 缺必要的可见行为或验收时**停止并报告**，不得在此补写需求合同。禁止写实现代码或 Plan，禁止改 `<id>`、`main.md` 或 [STATUS.md](../../../STATUS.md)，禁止 git 提交（由 Manager 提交）。

## 自检与交接

按模板填写，不适用的节标 `N/A` 并一句说明；有可行替代方案时简要对比并写决策理由。初稿完成后按 [documentation.md](../../standards/documentation.md) §B 原位整理。

返回 Planner。Plan 须引用本文件并把界面任务与验证落成可执行条目，不整份复述。

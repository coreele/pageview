---
name: design-ui
description: >-
  Writes UI/UX design to docs/features/<feature-id>/ui-design.md (or split
  slice path). Invoked by Planner when Design gate is required and UI surface
  is gui or cli. Covers information architecture, states, and surface-specific
  checklists. Theme/dark mode only when Spec requires them. Use when Planner
  must produce ui-design.md before Plan; skip when UI surface is none.
---

# design-ui — 界面与体验设计

## 调用者与门禁

- 调用者：Planner。
- 调用条件：工作项记录中对应切片的 Design 门禁为 `required`，且 `UI 表面` 为 `gui` 或 `cli`。
- 执行时机：`design.md` 存在后（或可与 architecture 同轮完成，但须在 Plan 编写前）、Plan 编写前。
- `UI 表面` 为 `none`：禁止执行本 Skill；在 `design.md` 或 Plan 中记 `UI/UX: N/A`。
- 下文「切片目录」指：未拆分为 `docs/features/<feature-id>/`，已拆分为 `docs/features/<feature-id>/<feature-id>-<sub-feature-id>/`。
- 输入：
  - `docs/manager/<feature-id>.md`（含 `UI 表面`）；
  - 对应切片的 Spec（Spec 门禁为 `required` 时）；
  - `<切片目录>/design.md`（若已存在）；
  - `docs/standards/ui.md`。
- 产出：`<切片目录>/ui-design.md`（模板：`.cursor/docs/_templates/ui-design.md`）。

## 适用与由来

跨 feature 的通用 UI/UX 设计 Skill。light/dark 与具体色板**不是**必选项：CLI、库、无界面切片不适用图形主题；是否多主题、是否深色模式**仅由 Spec 决定**。本 Skill 产出体验与信息设计，不替代 Spec 合同，也不替代 `design-architecture` 的模块与选型。

## 设计范围

每份 `ui-design.md` 必须覆盖：

1. 用户目标、关键任务与信息优先级；
2. 页面或命令流程；
3. 状态：初始、加载、空、成功、错误、部分失败；
4. 信息架构与基础元信息（若 Spec 要求展示元信息，须落到具体字段与位置）；
5. 可访问性、反馈、感知性能；
6. 与 Spec 验收条件的映射；
7. 对 Plan / Developer 的实施与验证要点。

按 `UI 表面` 追加：

### gui

- 布局、视觉层级、密度、响应式；
- 组件与交互状态、键盘与焦点；
- 颜色 / 排版 / 间距 / 数据可视化语义（具体值可在此锁定，或引用已有 token）；
- **主题**：仅当 Spec 要求多主题或深色时定义 token 与切换策略；否则单主题即可，并写明「主题：单主题（Spec 未要求多主题）」。

### cli

- 命令结构、参数与默认行为；
- stdout / stderr、退出码、错误恢复；
- 人类可读与机器可读输出（若 Spec 要求）；
- TTY / 非 TTY、颜色开关（遵循 `NO_COLOR` 等）、交互确认与无障碍终端行为；
- 主题 / 深色：非必须；仅 Spec 要求时定义。

## 边界

- API 形状、数据约束、错误约定、行为验收属于 Spec。发现 Spec 缺失必要界面合同（例如必须展示哪些元信息、是否支持深色）时，**停止**并向 Manager 报告，不得在 `ui-design.md` 中替 Spec 拍板。
- 模块边界、分层、技术选型属于 `design-architecture` / `design.md`。
- 禁止编写业务代码、Plan 任务拆分或修改工作项状态。
- 禁止为所有项目强制深色模式、组件库或品牌风格。

## 执行步骤

1. 确认 `<feature-id>`、`<sub-feature-id>`、Design 门禁与 `UI 表面`。
2. 读取 Spec、`docs/standards/ui.md` 与既有 `design.md`。
3. 按表面选用 gui 或 cli 章节编写 `ui-design.md`。
4. 自检：状态完整；主题策略与 Spec 一致（未要求则不强加）；验收映射无悬空引用。
5. 初稿完成后调用 `refine-docs` 精简并核对语义保全。
6. 返回 Planner：产出路径与是否阻塞（缺 Spec 合同）。

## 后续

Planner 在同一切片编写 `plan.md` 时必须引用本文件（任务、验证证据、文档影响）。Developer / Reviewer / QA 在 `UI 表面` ≠ `none` 时对照本文件与 `docs/standards/ui.md`。

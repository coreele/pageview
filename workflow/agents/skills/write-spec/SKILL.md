---
name: write-spec
description: 编写工作项的需求与行为规格到 workflow/workspace/<id>/spec.md，含背景、非目标、范围、合同与 Given-When-Then 验收条件。当工作项的 Spec 门禁为 required、路径为 full、或 standard 路径存在不清晰的行为合同时由 Analyst 使用。不用于任务拆分（那是 plan.md），fast 路径的小修复跳过。
---

# write-spec — 需求与规格

调用者 Analyst。调用条件：`workflow/workspace/<id>/main.md` 中 Spec 门禁为 `required`。时机：登记之后、Design 或 Plan 之前。

产出：`workflow/workspace/<id>/spec.md`，模板 [spec.md](../../templates/spec.md)。

本 skill 只定义需求与规格；任务拆分属 `plan.md`。

## 调研

必读：用户表述、`workflow/workspace/<id>/main.md`、[WORKFLOW.md](../../../WORKFLOW.md)、相关源码与现有文档。不要求 `plan.md` 已存在。

## 必含内容

背景与目标、非目标、范围与可见行为、合同、验收条件、开放问题。

- 合同覆盖适用的 API、数据、状态与错误约定；不适用写 `N/A`。
- 验收用 Given-When-Then 并标 P0 / P1；**每条 P0 必须可验证**。
- 范围本身无法确定时停止并报告，不要替用户决定。

## 边界

遵循 [documentation.md](../../standards/documentation.md)。禁止写 Plan、Design 或代码，禁止改 `main.md`、[STATUS.md](../../../STATUS.md)、`<id>` 或门禁，禁止 git 提交（由 Manager 提交）。

## 交接

文件留工作树，向 Manager 报告产出路径、自检结果，以及是否需要用户确认（`full`，或 `standard` 标注业务歧义），然后立即返回，不阻塞等待。

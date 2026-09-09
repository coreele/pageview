# 工作项: export-structure-png

描述: Page 模式把当前结构图导出为 PNG（全高、含标题），复制到剪贴板并下载，便于嵌入笔记。
目标分支: main
源分支: export-structure-png
基线提交: 557c125ceb2de352c568c08eeaf085ddd54c6255
文档影响: README / README.zh-CN 功能列表补 Export PNG 一句

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/archive/2026/export-structure-png/`，无子目录、无版本后缀。
> 表内只填枚举、短标签或路径；理由与长说明写进「进度笔记」（见 `workflow/agents/standards/documentation.md` §B）。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| standard | required | not-required | skipped | required |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| archived | | | | |

## 进度笔记

- 2026-09-08 Manager 登记。用户确认前序提案（「可以」）：结构图全高 PNG + 标题 + 剪贴板/下载；chrome Export；快捷键；heap peek 开着则导浮层；不含 Tree/Hex/WAL。路径 `standard`。Spec required（新可见行为）。Spec 用户确认 `not-required`：v1 范围已锁定、无剩余业务歧义（WORKFLOW §7）。Design skipped：栅格化现有 DOM，无新分层。Review required。
- 2026-09-08 Analyst：`spec.md`。Planner：`ui-design.md`、`plan.md`。进入 `developing`。第一阶段文档提交。
- 2026-09-08 Developer：`74634ac`。web 287 / typecheck 0。Review Approve。QA Pass。进入 `merge-approval`。
- 2026-09-09 用户在合并授权前要求：Export 放到右上五个按钮的第一个。状态 `merge-approval` → `developing`。Spec/UI：Export → Tree → Detail → Hex → 主题。
- 2026-09-09 Developer：`7d6e404`。web 287 / typecheck 0。Review Approve。QA 轮次 2 Pass。进入 `merge-approval`。
- 2026-09-09 用户授权合并（「ok」）。状态 `done`。第三阶段提交纳入工作流文档。
- 2026-09-09 FF 合入 `main`（`52e59da`，实现 `7d6e404`）并归档至 `workflow/archive/2026/export-structure-png/`。

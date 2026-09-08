# 工作项: table-tree-nav

描述: Table 模式把表名放进左侧导航（表 → 块），拿掉次带表下拉。Index 模式的下拉与 B-tree 树不变。
目标分支: main
源分支: table-tree-nav
基线提交: cd6dd9be3285a08586975437d0192173fa42a826
文档影响: README 中英树面板 / 选表入口

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/workspace/table-tree-nav/`，无子目录、无版本后缀。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| standard | required | approved | skipped | required |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| developing | Developer 实施 | | | |

## 进度笔记

- 2026-09-08 Manager 登记。用户确认「从 table 模式开始」：导航列选表，去掉表下拉；Index 下拉第二步再谈。路径 `standard`：新选表路径与树面板出现时机。Spec required + 用户确认。Design skipped：不改 server、不新分层。Review required。
- 2026-09-08 Analyst：`spec.md`。进入 `spec-approval`。
- 2026-09-08 用户确认 Spec（「ok」）。Planner：`ui-design.md`、`plan.md`。进入 `developing`。

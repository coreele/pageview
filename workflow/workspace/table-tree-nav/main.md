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
| done | 合入 main | | | |

## 进度笔记

- 2026-09-08 Manager 登记。用户确认「从 table 模式开始」：导航列选表，去掉表下拉；Index 下拉第二步再谈。路径 `standard`：新选表路径与树面板出现时机。Spec required + 用户确认。Design skipped：不改 server、不新分层。Review required。
- 2026-09-08 Analyst：`spec.md`。进入 `spec-approval`。
- 2026-09-08 用户确认 Spec（「ok」）。Planner：`ui-design.md`、`plan.md`。进入 `developing`。
- 2026-09-08 Developer：`bf7c854`。web test 238 / typecheck 0。`origin/main` `cd6dd9b` 已是祖先。Review **Approve**。QA **Pass**。进入 `merge-approval`。
- 2026-09-08 用户反馈导航层级偏平。回修 `f00465c`（加深缩进、引导线、表选中与当前块高亮分离）。Review 仍 Approve。QA 轮次 2 Pass。待合入提交改为 `f00465c`。
- 2026-09-08 用户反馈色块拉大表/块间隔。回修 `7fcae3c`（文字 accent、收紧行距）。QA 轮次 3 Pass。待合入提交改为 `7fcae3c`。
- 2026-09-08 用户反馈再点表名应收起。回修 `7a0897a`。QA 轮次 4 Pass。待合入提交改为 `7a0897a`。
- 2026-09-08 用户授权合并后反馈栏间拥挤。回修 `9dac4e3`（gutter + 拖动调宽）。QA 轮次 5 Pass。待合入提交改为 `9dac4e3`。合入暂缓，等用户再确认。
- 2026-09-08 用户反馈 hex 右侧裁切。回修 `a323460`（默认与结构图等分、上限 1600）。QA 轮次 6 Pass。待合入提交改为 `a323460`。
- 2026-09-08 用户授权合并（「ok」）。状态 `done`。第三阶段提交纳入工作流文档。

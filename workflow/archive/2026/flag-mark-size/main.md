# 工作项: flag-mark-size

描述: 详情里 ○/● 类 flag 清单的点亮圆点过小。统一换成更大的 CSS 圆点，覆盖 ItemId flags、index `t_info`、位带 `?` 参考列表。不改位格条方块。
目标分支: main
源分支: flag-mark-size
基线提交: 7a3339e2c5691acaa531c6139810c717290d540a
文档影响: N/A（用户文档未描述 ○/● 字号）

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/archive/2026/flag-mark-size/`。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| fast | skipped | not-required | skipped | skipped |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| archived | | | | |

## 进度笔记

- 2026-09-08 Manager 登记。用户：「全局优化一下同类型的 flag 标记，点亮的小黑点太小了」。路径 `fast`：纯视觉、同一标记三处。Spec/Design skipped。Review skipped：对照 CSS 与既有清单即可。
- 2026-09-08 Planner：`ui-design.md`、`plan.md`。进入 `developing`。
- 2026-09-08 Developer：`FlagMark` CSS 圆点。提交 `d3cdfd7`。Review skipped。QA Pass。进入 `merge-approval`。
- 2026-09-08 用户授权合并（「ok」）。状态 `done`。第三阶段提交纳入工作流文档。
- 2026-09-08 FF 合入 `main`（`70957c7`，实现 `d3cdfd7`）并归档至 `workflow/archive/2026/flag-mark-size/`。

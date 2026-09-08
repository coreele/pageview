# 工作项: chrome-toggles

描述: chrome 上 Detail / Hex / Tree 用颜色表示开闭，固定文案不再 Show/Collapse 切换；主题按钮改为日月图标，去掉 Theme: 前缀。
目标分支: main
源分支: chrome-toggles
基线提交: 3af2644dbbaab1a3cf2515440cdde1bb26525f60
文档影响: README 中英树面板一句改为固定 Tree 开关

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/archive/2026/chrome-toggles/`，无子目录、无版本后缀。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| fast | skipped | not-required | skipped | skipped |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| archived | | | | |

## 进度笔记

- 2026-09-08 Manager 登记。用户合入 tree-nav-ui 后要求：三开关用颜色表示是否开启；主题按钮用日月图标，去掉 Theme:。路径 `fast`。Spec/Design/Review skipped。
- 2026-09-08 Planner：`ui-design.md`、`plan.md`。进入 `developing`。
- 2026-09-08 Developer：固定文案 + `--on` 色态 + 日月 SVG。提交 `43145ae`。Review skipped。QA Pass。进入 `merge-approval`。
- 2026-09-08 用户授权合并（「ok」）。状态 `done`。第三阶段提交纳入工作流文档。
- 2026-09-08 FF 合入 `main`（`925705f`，实现 `43145ae`）并归档至 `workflow/archive/2026/chrome-toggles/`。

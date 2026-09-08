# 工作项: chrome-order

描述: chrome 开关改为 Tree、Detail、Hex；深色模式月亮按钮补与开态开关相同的底色。
目标分支: main
源分支: chrome-order
基线提交: e3851e4d97808a1792b80e61baa4906c1af00e31
文档影响: N/A（不改 README 合同句）

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/archive/2026/chrome-order/`，无子目录、无版本后缀。
> 表内只填枚举、短标签或路径；理由与长说明写进「进度笔记」（见 `workflow/agents/standards/documentation.md` §B）。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| fast | skipped | not-required | skipped | skipped |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| archived | | | | |

## 进度笔记

- 2026-09-08 Manager 登记。用户圈右上角：深色月亮底太空，三开关点亮时月亮像没亮；顺序改为 Tree、Detail、Hex。路径 `fast`：仅 chrome 顺序与主题钮底色。Spec/Design/Review skipped。
- 2026-09-08 Planner：`ui-design.md`、`plan.md`。进入 `developing`。
- 2026-09-08 Developer：`de90bf6`。web 271 / typecheck 0。Review skipped。QA Pass。进入 `merge-approval`。
- 2026-09-08 用户授权合并（「chrome-order 可以合并」）。状态 `done`。第三阶段提交纳入工作流文档。
- 2026-09-08 FF 合入 `main`（`6150727`，实现 `de90bf6`）并归档至 `workflow/archive/2026/chrome-order/`。

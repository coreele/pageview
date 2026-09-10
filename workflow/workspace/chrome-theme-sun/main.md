# 工作项: chrome-theme-sun

描述: 浅色主题下太阳钮使用与 Tree/Detail/Hex 开态相同的 accent 浅底，与深色月亮一致。
目标分支: main
源分支: chrome-theme-sun
基线提交: 8033de99b6e672effb8734d9d122c24335f72a1f
文档影响: N/A（不改 README）

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/workspace/chrome-theme-sun/`，无子目录、无版本后缀。
> 表内只填枚举、短标签或路径；理由与长说明写进「进度笔记」（见 `workflow/agents/standards/documentation.md` §B）。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| fast | skipped | not-required | skipped | skipped |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| done | 合入后归档 | | | |

## 进度笔记

- 2026-09-09 Manager 登记。用户对照浅色：太阳钮白底描边，三开关有 accent 浅底；深色月亮已有底。路径 `fast`：把主题钮底色从仅 dark 提到 `.chrome-theme`。chrome-order 曾明确跳过浅色太阳。Spec/Design/Review skipped。
- 2026-09-09 Planner：`ui-design.md`、`plan.md`。进入 `developing`。第一阶段文档提交。
- 2026-09-09 Developer：`2a10e02`。web 293 / typecheck 0。Review skipped。QA Pass。进入 `merge-approval`。
- 2026-09-10 用户授权合并（「都允许合并(rebase)」）。状态 `done`。第三阶段文档提交。

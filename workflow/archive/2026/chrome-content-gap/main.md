# 工作项: chrome-content-gap

描述: 收紧 chrome 元信息条与下方三栏之间的空隙（去掉 meta 条多余 min-height，减小 `.main` 顶 padding）。
目标分支: main
源分支: chrome-content-gap
基线提交: c8f1f24488d7306802af56b07f77cb9efa609884
文档影响: N/A（未合入；用户取消空隙调整）

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/archive/2026/chrome-content-gap/`，无子目录、无版本后缀。
> 表内只填枚举、短标签或路径；理由与长说明写进「进度笔记」（见 `workflow/agents/standards/documentation.md` §B）。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| fast | skipped | not-required | skipped | skipped |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| cancelled | 用户要求恢复时从本归档重新登记 | 用户拒绝合入（「不要合并，取消调整 gap 工作项」）。实现未合入 `main`。 | 用户明确要求继续本工作项。 | planning |

## 进度笔记

- 2026-09-09 Manager 登记。用户圈元信息行与三栏之间的深色空隙，问是否偏大。路径 `fast`：只改 chrome-meta 高度与 `.main` 顶距。Spec/Design/Review skipped。
- 2026-09-09 Planner：`ui-design.md`、`plan.md`。进入 `developing`。第一阶段文档提交。
- 2026-09-09 Developer：`d7dd8f3`。web 295 / typecheck 0。Review skipped。QA Pass。进入 `merge-approval`。
- 2026-09-09 用户取消合入（「不要合并，取消调整 gap 工作项」）。状态 `cancelled`。实现 `d7dd8f3` 未合入 `main`；源分支丢弃。归档至 `workflow/archive/2026/chrome-content-gap/`。

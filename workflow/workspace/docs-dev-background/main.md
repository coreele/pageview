# 工作项: docs-dev-background

描述: 在双语 README 的快速开始中写明前后端后台启动方式（日志重定向 + `&`），并在故障排查中补充「只起了 web、API 未起」时的 `HTTP_500`。
目标分支: main
源分支: docs-dev-background
基线提交: 0c9aada6dfaa136178c48b831ada133eb41622d8
文档影响: `README.md`、`README.zh-CN.md`

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/workspace/docs-dev-background/`，无子目录、无版本后缀。
> 表内只填枚举、短标签或路径；理由与长说明写进「进度笔记」。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| fast | skipped | not-required | skipped | skipped |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| developing | Developer 实施 | | | |

## 进度笔记

- 2026-09-09 Manager 登记。独立 worktree（本树 `pageview-wordmark` 在 merge-approval）。路径 `fast`：只改 README 启动说明。Spec/Design skipped：无产品行为合同、无选型。Review skipped：fast，对照文档命令与已跑通的后台进程验收。用户要求后台起前端并把前后端后台启动写进 README。
- 2026-09-09 Planner 完成 `plan.md`。进入 `developing`。

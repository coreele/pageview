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
| done | 合入 main | | | |

## 进度笔记

- 2026-09-09 Manager 登记。独立 worktree（本树 `pageview-wordmark` 在 merge-approval）。路径 `fast`：只改 README 启动说明。Spec/Design skipped：无产品行为合同、无选型。Review skipped：fast，对照文档命令与已跑通的后台进程验收。用户要求后台起前端并把前后端后台启动写进 README。
- 2026-09-09 Planner 完成 `plan.md`。进入 `developing`。
- 2026-09-09 Developer：双语 README 后台启动 + `HTTP_500` 排查。代码/文档提交 `9e6354b`。Review skipped → QA。
- 2026-09-09 QA 轮次 1 Pass（`9e6354bcb1772acacf277aeb983c1c9d93b5d602`）。进入 `merge-approval`，待用户授权合并。
- 2026-09-09 用户授权合并（「ok」）。合入前发现目标 `main` 已至 `7f54bd6`（pageview-wordmark 已归档），源分支无法 FF。stash `workflow/` 后 rebase；无冲突。实现提交变为 `a49f777`。QA 轮次 2 Pass。状态 `done`。第三阶段提交纳入关闭文档。

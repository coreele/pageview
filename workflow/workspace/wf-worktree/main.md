# 工作项: wf-worktree

描述: 规范并行 worktree 落在仓库根 `.worktree/<id>`，合入成功后拆除附加 worktree；同步 ggnote 通用工作流。
目标分支: main
源分支: wf-worktree
基线提交: 359280956ed634e303aa1dfc0efacfdad5cbeb8e
文档影响: N/A（流程机制；pageview `.gitignore` 排除 `.worktree/`）

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/workspace/wf-worktree/`，无子目录、无版本后缀。
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

- 2026-09-10 Manager 登记。用户确认：合入成功拆除附加 worktree；附加树放到项目根 `.worktree/<id>`；并同步 `/home/jason/space/ggnote/workflow`。路径 `fast`：只改流程机制与 gitignore。Spec/Design skipped：无产品行为合同。Review skipped：fast，对照规范条文与 gitignore。本项主树干净，源分支在仓库根检出，不另开附加树。
- 2026-09-10 Planner：`plan.md`。进入 `developing`。第一阶段文档提交。
- 2026-09-10 Developer：`3cb3d03`。ggnote 同步提交 `640c19c`（分支 `wf-worktree`）。Review skipped。QA Pass。进入 `merge-approval`。
- 2026-09-10 用户授权合并（「ok」）。状态 `done`。第三阶段文档提交。

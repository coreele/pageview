# 工作项: drop-load-refresh

描述: Page 分为 Tree（目录浏览、精简次带）与 Single（无树、现次带按 blkno 查页）；树里再点当前 blk 即 Refresh。
目标分支: main
源分支: drop-load-refresh
基线提交: 5482949620a8b27520151991939d1245c7ff5829
文档影响: README 中英 Tree/Single；e2e 按模式点树或 Load

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/workspace/drop-load-refresh/`，无子目录、无版本后缀。
> 表内只填枚举、短标签或路径；理由与长说明写进「进度笔记」（见 `workflow/agents/standards/documentation.md` §B）。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| standard | required | approved | skipped | required |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| developing | Developer 实施 | | | |

## 进度笔记

- 2026-09-08 Manager 登记。用户圈 Page 次带（Table/Index · blkno · Load · Refresh · Prev/Next）：清掉不再需要的控件；Refresh 改为树里点 blk 加载、再点当前 blk 刷新。路径 `standard`：选页/刷新入口与历史记录合同。Spec required + 用户确认。Design skipped：继续用 `loadBlk` / `loadIndexBlk({ refresh })`，不新分层。Review required。
- 2026-09-08 Analyst：`spec.md`。进入 `spec-approval`。
- 2026-09-08 用户问「为啥 Single 还开 Tree」。澄清：Single 从不打开目录；那句话只是草稿里的空态提示，已从 Spec 删掉。
- 2026-09-08 用户确认 Spec（「ok」）。Planner：`ui-design.md`、`plan.md`。进入 `developing`。

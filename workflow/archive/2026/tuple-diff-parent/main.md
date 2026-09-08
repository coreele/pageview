# 工作项: tuple-diff-parent

描述: Refresh diff 时，tuple 任一字段有字节变化则整行 tuple 高亮（xmax/cid/nullbits 等未变零字节不再漏标）。
目标分支: main
源分支: tuple-diff-parent
基线提交: e3851e4d97808a1792b80e61baa4906c1af00e31
文档影响: N/A（未合入；用户要求保持现有字段级 diff）

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/archive/2026/tuple-diff-parent/`，无子目录、无版本后缀。
> 表内只填枚举、短标签或路径；理由与长说明写进「进度笔记」（见 `workflow/agents/standards/documentation.md` §B）。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| fast | skipped | not-required | skipped | skipped |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| cancelled | 用户要求恢复时从本归档重新登记 | 用户拒绝合入（「既然没有问题就不要动了」）。实现未合入 `main`。 | 用户明确要求继续本工作项。 | planning |

## 进度笔记

- 2026-09-08 Manager 登记。用户 Refresh 插入后的 heap 页：新 tuple 行只有 xmin/ctid/列等变过的格有 diff 框，xmax=0、cid=0、nullbits 不亮。根因：按字节 diff，free space 原是 0。路径 `fast`：结构图已支持 `tuple-N` 父 id，补 `structureAffectedByDiff` 发出它。Spec/Design/Review skipped。
- 2026-09-08 Planner：`plan.md`。进入 `developing`。
- 2026-09-08 Developer：`56bd3b5`。web 270 / typecheck 0。Review skipped。QA Pass。进入 `merge-approval`。
- 2026-09-08 用户取消合入（「既然没有问题就不要动了」；仅授权 `chrome-order`）。状态 `cancelled`。实现 `56bd3b5` 未合入 `main`；源分支与 worktree 已丢弃。归档至 `workflow/archive/2026/tuple-diff-parent/`。

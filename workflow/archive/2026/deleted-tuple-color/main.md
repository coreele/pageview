# 工作项: deleted-tuple-color

描述: 页结构图中为「被删除的元组」使用与存活元组不同的颜色，便于一眼区分。用户截图将 `xmax != 0` 的两行（1fa0 / 1fc0）标出，作为意图示意。
目标分支: main
源分支: deleted-tuple-color
基线提交: 639b0bc463d8241f84a326f4a085c02929ed554b
文档影响: README 若列出结构图图例/区域色则同步；无运维文档影响。

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/archive/2026/deleted-tuple-color/`。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| standard | required | approved | skipped | required |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| cancelled | 用户要求恢复时从本归档重新登记 | 用户要求暂停（「等后面再说」）。Plan 未确认。用户已质疑 T2 忽略 infomask。 | 用户明确要求继续本工作项。 | planning |

## 进度笔记

- 2026-09-07 工作流迁移：机制改为 `workflow/WORKFLOW.md` + `workflow/agents/`；本记录由 `manager.md` 转为 `main.md`，产物平铺到 `workflow/archive/2026/deleted-tuple-color/`。旧状态机名称（awaiting-*-approval 等）按新枚举对齐。原状态 `blocked`（用户暂停 infomask 判定，Plan 未确认，从未建源分支）。新工作流要求目标分支工作树不挂活跃项，故本轮调度关闭为 `cancelled`；`spec.md` / `plan.md` 保留。恢复时 Manager 从本归档复制产物、新建源分支并重新登记（可用同 id，须先移出 archive）。恢复后目标 `planning`：须先确认判定（仅 `t_xmax`，或排除 `HEAP_XMAX_LOCK_ONLY` / `HEAP_XMAX_INVALID`）；若改判定则先修订 Spec 再改 Plan。
- 历史字段 UI 表面: gui（新模板已取消该列）。

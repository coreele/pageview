# 工作项: next-page-btn

描述: 在工具栏 Refresh 右侧增加 **Prev** / **Next**。Heap：`blkno ± 1`；B-tree：`btpo_prev` / `btpo_next`。末页/无兄弟时禁用。启用条件同 Refresh（须已加载当前页）。Heap 的 page 统计条须像 index 一样落在选择列表下方（不得在宽屏下与表下拉并排）。来源：用户对工具栏的请求。
目标分支: main
源分支: next-page-btn
基线提交: 84123bce206fcf3606c238e127f1e26c64ae2a0a
文档影响: 若 README 描述 Load/Refresh 操作，须补 Next；由 Plan 阶段确认。无运维文档影响。

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/archive/2026/next-page-btn/`。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| standard | required | approved | skipped | required |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| archived |  |  |  |  |

## 进度笔记

- 2026-09-07 工作流迁移：机制改为 `workflow/WORKFLOW.md` + `workflow/agents/`；本记录由 `manager.md` 转为 `main.md`，产物平铺到 `workflow/archive/2026/next-page-btn/`。旧状态机名称（awaiting-*-approval 等）按新枚举对齐。
- 历史字段 UI 表面: gui（新模板已取消该列）。

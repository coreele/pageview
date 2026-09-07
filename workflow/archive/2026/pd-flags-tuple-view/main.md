# 工作项: pd-flags-tuple-view

描述: 页头 `pd_flags` 位标志解码与展示优化（新增 `decodePdFlags` 公开导出 + 选中详情面板位带 `FlagBitStripSolo`）；tuple 区域结构图渲染重构（单物理行 lane 按列排序、MAXALIGN padding 折叠进下一列、移除重叠的 `data`/`data-gap` 字段）。
目标分支: main
源分支: pd-flags-tuple-view
基线提交: bf701ed9daf1eec06ccf0c10e81e64a77d9361ff
文档影响: `README.md`（如 UI 功能列表提及结构图行为则同步，否则 N/A）；无运维文档影响。

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/archive/2026/pd-flags-tuple-view/`。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| standard | required | not-required | skipped | required |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| archived |  |  |  |  |

## 进度笔记

- 2026-09-07 工作流迁移：机制改为 `workflow/WORKFLOW.md` + `workflow/agents/`；本记录由 `manager.md` 转为 `main.md`，产物平铺到 `workflow/archive/2026/pd-flags-tuple-view/`。旧状态机名称（awaiting-*-approval 等）按新枚举对齐。
- 历史字段 UI 表面: structure map（新模板已取消该列）。

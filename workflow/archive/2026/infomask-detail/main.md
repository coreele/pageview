# 工作项: infomask-detail

描述: 优化 `pg-page-viewer` 左侧 Selection detail 中 `t_infomask` / `t_infomask2` 的呈现：紧凑位格条 + tip/`?`；含合入前 UI 微调（InfomaskBitPair、NATTS 单格、疏朗布局、`decodeInfomask2` set: natts>0）。
目标分支: main
源分支: infomask-detail
基线提交: 97b4f0570c3e41821976ff211ce2feb47570323b
文档影响: 已归档至 `workflow/archive/2026/infomask-detail/`（原 `workflow/archive/2026/infomask-detail/`：spec、plan、dev-notes、review、qa-report）；无独立 Design / ui-design。

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/archive/2026/infomask-detail/`。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| standard | required | approved | skipped | required |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| archived |  |  |  |  |

## 进度笔记

- 2026-09-07 工作流迁移：机制改为 `workflow/WORKFLOW.md` + `workflow/agents/`；本记录由 `manager.md` 转为 `main.md`，产物平铺到 `workflow/archive/2026/infomask-detail/`。旧状态机名称（awaiting-*-approval 等）按新枚举对齐。
- 历史字段 UI 表面: gui（新模板已取消该列）。

## 与其他工作项关系

- 前序 UI 合同参考归档：`workflow/archive/2026/pg-page-viewer/`、`page-diagram-32b`、`layout-chrome-split`、`hex-collapse`。

## 产品澄清 / Spec / Plan / 合并授权

均已于 2026-07-27 用户「ok」确认（详见进度笔记与归档 Spec/Plan）。

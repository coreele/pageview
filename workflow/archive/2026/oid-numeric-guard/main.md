# 工作项: oid-numeric-guard

描述: 非数字 oid（如 `/api/tables/abc/pages/0`、`/api/indexes/abc/pages/0`）现返回误导性的 400 `BAD_LSN` + WAL nextStep。统一加 `Number.isFinite`/整数守卫，两端点返回一致的 400 `BAD_OID`（或等价明确错误码）。来源：index-viewer QA DEF-2（Low）与 Review F1。
目标分支: main
源分支: oid-numeric-guard
基线提交: 173553efc20708dc24f788507abf81b2ef7e47e5
文档影响: 预计 README Troubleshooting 增一行；由 Plan 阶段确认。

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/archive/2026/oid-numeric-guard/`。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| fast | skipped | not-required | skipped | skipped |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| archived |  |  |  |  |

## 进度笔记

- 2026-09-07 工作流迁移：机制改为 `workflow/WORKFLOW.md` + `workflow/agents/`；本记录由 `manager.md` 转为 `main.md`，产物平铺到 `workflow/archive/2026/oid-numeric-guard/`。旧状态机名称（awaiting-*-approval 等）按新枚举对齐。
- 历史字段 UI 表面: none（新模板已取消该列）。

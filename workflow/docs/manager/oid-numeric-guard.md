# 工作项记录: oid-numeric-guard

工作项标识: oid-numeric-guard
描述: 非数字 oid（如 `/api/tables/abc/pages/0`、`/api/indexes/abc/pages/0`）现返回误导性的 400 `BAD_LSN` + WAL nextStep。统一加 `Number.isFinite`/整数守卫，两端点返回一致的 400 `BAD_OID`（或等价明确错误码）。来源：index-viewer QA DEF-2（Low）与 Review F1。
路径等级: fast（范围明确的单点修复）
源分支: oid-numeric-guard（实施时自 main 创建）
目标分支: main
文档影响: 预计 README Troubleshooting 增一行；由 Plan 阶段确认。

> 权威工作流、门禁与状态说明见 [workflow/README.md](../../README.md)。
> 活跃状态见 [STATUS.md](STATUS.md)。

## 切片（未拆分时仅一行，sub-feature-id = feature-id）

| sub-feature-id | Spec | Spec 门禁 | Spec 用户确认 | Design 门禁 | UI 表面 | Review 门禁 | 状态 | 后续步骤 |
|---|---|---|---|---|---|---|---|---|
| oid-numeric-guard | [spec.md](../features/oid-numeric-guard/spec.md) | skipped（fast，范围明确单点修复） | not-required | skipped（无模块边界决策） | none | skipped（fast：单点守卫修复，L2 测试覆盖，登记时裁定） | done | 已授权合并；QA 轮次 1 Pass |

阻塞原因: none
恢复条件: none
恢复后的目标状态: N/A

## 进度笔记

- 2026-08-31 Manager 登记：由 index-viewer QA 轮次 1 DEF-2 与 Review F1 派生。用户暂未要求启动。

- 2026-08-31 Plan 确认（Planner 调研纳入第三条同型路由 /api/tables/:oid/schema）。Developer T1–T5 完成（b07bc92/277b13a/6a16dd9/61265ba；BAD_OID 守卫 1..4294967295；19 红测转绿；server 67+web 112 全绿）。Review 门禁 skipped（fast 裁定）。QA 轮次 1 **Pass**（真库取证：BAD_LSN/WAL 误导消失；V1–V5 全过；边界 4294967295 放行→404、上界外 400；双语 README 对应）。**等待用户合并授权**（授权后：置 done + qa-report.md 一次提交于源分支 → FF 合入 main；不 push）。

- 2026-08-31 **用户授权合并**。Manager 置 done 并与未入库的 qa-report.md 一次提交于源分支；随后 FF 合入 main（不 push）。工作流关闭（index-viewer DEF-2 / Review F1 溯源项随之了结）。

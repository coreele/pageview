# 工作项记录: url-deeplink

工作项标识: url-deeplink
描述: URL 状态深链：将应用视图状态编码进 URL（mode/kind/table 或 index/blkno/WAL LSN 等，范围由 Spec 定界），支持分享链接、收藏书签、新 tab 并排对照；启动时解析参数还原视图（连接探测→自动加载→失效参数优雅报错）。为后续「右键新 tab 打开」等增强铺路。纯 web 子系统，server/page-core 预计零触碰。
路径等级: standard（常规功能 + 可见行为合同变更；纯 web 新子系统）
源分支: url-deeplink（实施时自 main 创建）
目标分支: main
文档影响: README 双语（Features 增深链一句 + 示例 URL）；细节由 Plan 落实。

> 权威工作流、门禁与状态说明见 [workflow/README.md](../../README.md)。
> 活跃状态见 [STATUS.md](STATUS.md)。

## 切片（未拆分时仅一行，sub-feature-id = feature-id）

| sub-feature-id | Spec | Spec 门禁 | Spec 用户确认 | Design 门禁 | UI 表面 | Review 门禁 | 状态 | 后续步骤 |
|---|---|---|---|---|---|---|---|---|
| url-deeplink | [spec.md](../features/url-deeplink/spec.md) | required（可见行为合同：编码范围/历史粒度/还原行为/错误合同） | approved（2026-09-04 四裁决后通过） | required（无路由应用的状态同步架构、URL schema、还原流程） | gui | required | designing | Planner 编写 design.md + ui-design.md + plan.md |

阻塞原因: none
恢复条件: none
恢复后的目标状态: N/A

## 进度笔记

- 2026-09-04 Manager 登记（用户启动路线图②）。背景：应用现零路由/零 URL 机制；路线图讨论确认深链为「分享/书签/并排对照/右键新 tab」多项增强的地基。预览识别的典型裁决点：历史粒度（Load 产生历史 vs 仅 replaceState）、编码范围（table 过滤器/瞬态交互排除）、未连接时还原行为。

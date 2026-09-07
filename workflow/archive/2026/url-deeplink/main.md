# 工作项: url-deeplink

描述: URL 状态深链：将应用视图状态编码进 URL（mode/kind/table 或 index/blkno/WAL LSN 等，范围由 Spec 定界），支持分享链接、收藏书签、新 tab 并排对照；启动时解析参数还原视图（连接探测→自动加载→失效参数优雅报错）。为后续「右键新 tab 打开」等增强铺路。纯 web 子系统，server/page-core 预计零触碰。
目标分支: main
源分支: url-deeplink
基线提交: 2b54fa0559d5e02b04c671b041341694334ffb03
文档影响: README 双语（Features 增深链一句 + 示例 URL）；细节由 Plan 落实。

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/archive/2026/url-deeplink/`。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| standard | required | approved | required | required |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| archived |  |  |  |  |

## 进度笔记

- 2026-09-07 工作流迁移：机制改为 `workflow/WORKFLOW.md` + `workflow/agents/`；本记录由 `manager.md` 转为 `main.md`，产物平铺到 `workflow/archive/2026/url-deeplink/`。旧状态机名称（awaiting-*-approval 等）按新枚举对齐。
- 历史字段 UI 表面: gui（新模板已取消该列）。

# 工作项: add-ci

描述: 为 pageview 补齐 CI 与测试脚本基础设施。新增 GitHub Actions 双 Job 工作流（unit + integration）；修复根 `package.json` 的 `test` 脚本漏掉 web 包；将 `apps/server/src/wal-smoke.ts` 提升为正式 npm script 并纳入集成 Job。不含 ESLint/Prettier（另开工作项）。
目标分支: main
源分支: add-ci
基线提交: e9280f291dc0258474cdfbd47b26fe9931dbbf72
文档影响: 根 `README.md`（CI 章节与本地测试命令说明，若与脚本不一致则同步）；`workflow/agents/standards/quality.md`（若已声明 CI 守护则补具体命令，否则 N/A）。

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/archive/2026/add-ci/`。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| standard | skipped | not-required | skipped | required |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| archived |  |  |  |  |

## 进度笔记

- 2026-09-07 工作流迁移：机制改为 `workflow/WORKFLOW.md` + `workflow/agents/`；本记录由 `manager.md` 转为 `main.md`，产物平铺到 `workflow/archive/2026/add-ci/`。旧状态机名称（awaiting-*-approval 等）按新枚举对齐。
- 历史字段 UI 表面: none（新模板已取消该列）。

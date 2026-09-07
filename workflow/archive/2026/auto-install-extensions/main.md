# 工作项: auto-install-extensions

描述: 扩展缺失时自动安装：server 端在 pageinspect / pg_walinspect 守卫检测到缺失时，自动执行 `CREATE EXTENSION IF NOT EXISTS` 并复查；安装失败（非超级用户、扩展文件缺失、版本不支持等）才返回既有错误码（message 附失败原因，nextStep 给人工步骤）。同步修订 README 双语中「The app never runs CREATE EXTENSION for you」的合同表述与相关错误提示。
目标分支: main
源分支: auto-install-extensions
基线提交: f65388c188e905d4d28c415278da5da9d58b2195
文档影响: README.md / README.zh-CN.md（Requirements 与相关表述）；细节由 Plan 落实。

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/archive/2026/auto-install-extensions/`。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| standard | required | approved | skipped | required |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| archived |  |  |  |  |

## 进度笔记

- 2026-09-07 工作流迁移：机制改为 `workflow/WORKFLOW.md` + `workflow/agents/`；本记录由 `manager.md` 转为 `main.md`，产物平铺到 `workflow/archive/2026/auto-install-extensions/`。旧状态机名称（awaiting-*-approval 等）按新枚举对齐。
- 历史字段 UI 表面: gui（仅连接表单一行文案，已裁决纳入）（新模板已取消该列）。

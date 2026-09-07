# 工作项: index-key-decode

描述: index tuple 键字节按索引列类型解码为可读值：server 提供索引列类型信息（pg_index/pg_attribute/pg_am/opclass），解析层按类型 OID 解码（int2/4/8、bool、text/varchar/bpchar、date/timestamp、uuid、numeric 等由 Spec 定界），web 详情面板在现有键字节 hex 旁展示解码值；不支持的表达式/类型优雅降级为仅 hex（现有形态不变）。来源：index-viewer Spec 开放问题 3 裁决「另立项」。
目标分支: main
源分支: index-key-decode
基线提交: bdf3d07106e059613b5fda5718c39181a0dbec23
文档影响: README 双语（Features 索引节补一句）；细节由 Plan 落实。

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/archive/2026/index-key-decode/`。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| standard | required | approved | required | required |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| archived |  |  |  |  |

## 进度笔记

- 2026-09-07 工作流迁移：机制改为 `workflow/WORKFLOW.md` + `workflow/agents/`；本记录由 `manager.md` 转为 `main.md`，产物平铺到 `workflow/archive/2026/index-key-decode/`。旧状态机名称（awaiting-*-approval 等）按新枚举对齐。
- 历史字段 UI 表面: gui（详情面板键值展示）（新模板已取消该列）。

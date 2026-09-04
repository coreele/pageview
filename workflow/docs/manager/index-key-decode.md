# 工作项记录: index-key-decode

工作项标识: index-key-decode
描述: index tuple 键字节按索引列类型解码为可读值：server 提供索引列类型信息（pg_index/pg_attribute/pg_am/opclass），解析层按类型 OID 解码（int2/4/8、bool、text/varchar/bpchar、date/timestamp、uuid、numeric 等由 Spec 定界），web 详情面板在现有键字节 hex 旁展示解码值；不支持的表达式/类型优雅降级为仅 hex（现有形态不变）。来源：index-viewer Spec 开放问题 3 裁决「另立项」。
路径等级: standard（常规功能 + server API 扩展 + 可见行为变更）
源分支: index-key-decode（实施时自 main 创建）
目标分支: main
文档影响: README 双语（Features 索引节补一句）；细节由 Plan 落实。

> 权威工作流、门禁与状态说明见 [workflow/README.md](../../README.md)。
> 活跃状态见 [STATUS.md](STATUS.md)。

## 切片（未拆分时仅一行，sub-feature-id = feature-id）

| sub-feature-id | Spec | Spec 门禁 | Spec 用户确认 | Design 门禁 | UI 表面 | Review 门禁 | 状态 | 后续步骤 |
|---|---|---|---|---|---|---|---|---|
| index-key-decode | [spec.md](../features/index-key-decode/spec.md) | required（新增可见行为与 API 合同） | approved（2026-08-31 两裁决后通过） | required（已满足：design.md + ui-design.md 已产出） | gui（详情面板键值展示） | required | planned | Developer 实施 T1–T9（源分支 index-key-decode） |

阻塞原因: none
恢复条件: none
恢复后的目标状态: N/A

## 进度笔记

- 2026-08-31 Manager 登记（用户指示完成路线图优先级①的第二部分）。前置事实：index-viewer 已交付 B-tree 页解析与键字节 hex 展示（t_info nulls/vars 位、键 range）；本项在其上加「类型感知解码」。与 oid-numeric-guard 并列属优先级①。

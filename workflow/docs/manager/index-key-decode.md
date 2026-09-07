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
| index-key-decode | [spec.md](../features/index-key-decode/spec.md) | required（新增可见行为与 API 合同） | approved（2026-08-31 两裁决后通过） | required（已满足：design.md + ui-design.md 已产出） | gui（详情面板键值展示） | required | done | 已授权合并；QA 轮次 1 Pass + Review Approve |

阻塞原因: none
恢复条件: none
恢复后的目标状态: N/A

## 进度笔记

- 2026-08-31 Manager 登记（用户指示完成路线图优先级①的第二部分）。前置事实：index-viewer 已交付 B-tree 页解析与键字节 hex 展示（t_info nulls/vars 位、键 range）；本项在其上加「类型感知解码」。与 oid-numeric-guard 并列属优先级①。

- 2026-09-04 Developer T1–T9 完成（10 提交 5af344b→e80590d，含两次会话中断续做；T2 步进规则 6 处以 oracle 冻结并经 Manager 记入 design.md 修订记录；pivot pad 实测：尾 TID 恒在 [itemlen−6,itemlen)，键区计算本正确，fixture-builder 修复+回归；388 tests、L3 新段退出 0）。Reviewer 审阅 **Approve**（0 阻塞；步进规则逐条核验一致；3 Minor：BOM 剥离/测试死代码/冒烟注释失实）。QA 轮次 1 **Pass**（25 索引探针、2457 元组 UTC ::text 对照、µs 边界 8 例、降级实测；QA-D1..D3=Reviewer Minor 同源，开放-延后；UI 视觉 9 项待浏览器）。**等待用户合并授权**（授权后：置 done + review.md/qa-report.md/design 修订一次提交于源分支 → FF 合入 main；不 push）。

- 2026-09-04 **用户授权合并**。Manager 置 done 并与未入库的 review.md/qa-report.md、design.md 修订记录一次提交于源分支；随后 FF 合入 main（不 push）。工作流关闭。遗留（均非阻塞）：QA-D1..D3（BOM 剥离/死代码/注释虚报，延后小修批次+定向复审）、浏览器视觉 9 项补测、BC 年份局限（已记录）。

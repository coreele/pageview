# 工作项记录: auto-install-extensions

工作项标识: auto-install-extensions
描述: 扩展缺失时自动安装：server 端在 pageinspect / pg_walinspect 守卫检测到缺失时，自动执行 `CREATE EXTENSION IF NOT EXISTS` 并复查；安装失败（非超级用户、扩展文件缺失、版本不支持等）才返回既有错误码（message 附失败原因，nextStep 给人工步骤）。同步修订 README 双语中「The app never runs CREATE EXTENSION for you」的合同表述与相关错误提示。
路径等级: standard（server 行为与错误合同变更，范围明确）
源分支: auto-install-extensions（实施时自 main 创建）
目标分支: main
文档影响: README.md / README.zh-CN.md（Requirements 与相关表述）；细节由 Plan 落实。

> 权威工作流、门禁与状态说明见 [workflow/README.md](../../README.md)。
> 活跃状态见 [STATUS.md](STATUS.md)。

## 切片（未拆分时仅一行，sub-feature-id = feature-id）

| sub-feature-id | Spec | Spec 门禁 | Spec 用户确认 | Design 门禁 | UI 表面 | Review 门禁 | 状态 | 后续步骤 |
|---|---|---|---|---|---|---|---|---|
| auto-install-extensions | [spec.md](../features/auto-install-extensions/spec.md) | required（错误约定与可见行为合同变更） | approved（2026-08-31 裁决开放问题后通过） | skipped（无模块边界/分层/选型决策——沿现有守卫层加安装步骤） | gui（仅连接表单一行文案，已裁决纳入） | required | done | 已授权合并；QA 轮次 1 Pass + Review Approve |

阻塞原因: none
恢复条件: none
恢复后的目标状态: N/A

## 进度笔记

- 2026-08-31 Manager 登记。来源：用户使用 WAL 模式遇到 `WALINSPECT_MISSING`（需手动 `CREATE EXTENSION pg_walinspect`），指示改为自动安装、失败再报错（含 pageinspect）。注意：此举推翻 pg-page-viewer/wal-viewer 以来「app 不执行 CREATE EXTENSION」的既有合同（README 明文），spec 需正式修订该合同并让 Reviewer 关注安全面（DDL 写操作、权限语义）。main 当前领先 origin 21 提交未 push（用户指示），本项自本地 main 分支。

- 2026-08-31 Developer T1–T5 完成（3cef61a/7765709/cc83e51/8cd503e/b1e0314；226 tests、integration 退出 0 含自动安装段）；Manager 独立核验通过。Reviewer 审阅 **Approve**（4 项 Info 非阻塞：F1 SQL 参数化风格、F2 L3 失败路径环境不可达、F3 防御性 42701、F4 smoke finally 信号弱；白名单 DDL 无注入面）。QA 轮次 1 **Pass**（零缺陷；P0 8/8——实库 DROP→自动装回取证、临时受限角色真实 42501 证据、README/web 文案 0 残留；P0-6 无 PG14 实例如实标注）。**等待用户合并授权**（授权后：置 done + review.md/qa-report.md 一次提交于源分支 → FF 合入 main；按惯例不 push）。

- 2026-08-31 **用户授权合并**。Manager 置 done 并与未入库的 review.md/qa-report.md 一次提交于源分支；随后 FF 合入 main（不 push）。工作流关闭。遗留（均非阻塞）：F1 SQL 参数化风格、F4 smoke finally 信号（Info 建议）；P0-6 无 PG14 实例仅 stub 断言。

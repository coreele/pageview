---
name: refine-docs
description: Use when a spec.md, design.md, ui-design.md, plan.md, dev-notes.md, review.md, or qa-report.md draft is complete before validation or handoff (including files under a split sub-work-item directory).
---

# refine-docs

精简 `spec.md`、`design.md`、`ui-design.md`、`plan.md`、`dev-notes.md`、`review.md` 或 `qa-report.md`（未拆分在 feature 根目录；已拆分在 `<feature-id>-<sub-feature-id>/` 子目录），保持语义与可验证性不变。每次只处理一份文件。

## 执行契约

1. 读取初稿、对应模板和直接依据。
2. 列出不可丢失的信息：
   - `必须`、`禁止`、`允许`等规范强度，以及条件、例外、否定；
   - ID、数值、路径、命令、版本、状态和枚举值；
   - 合同、验收条件、证据、结论、风险、阻塞和恢复条件；
   - 模板必填字段及文档类型要求。
3. 原位精简：
   - 一个事实只保留一次，放在最相关的小节；
   - 结论先行，证据紧随其后；
   - 验收或 Review 条目保持“要求 → 证据 → 结果”，不得用执行证据替代原要求；
   - 阻塞条目保持“未验证项 → 原因 → 风险 → 恢复条件 → 复测范围”；
   - 删除背景铺垫、同义复述、无信息过渡句和重复总结；
   - 并列事实使用列表或既有模板结构。
4. 对照初稿逐项确认不可丢失的信息仍存在，再按模板检查结构。
5. 无法确认删除是否安全时保留原文；不以字数或压缩率驱动删减。

只修改当前角色主责的文档，不补写或推断缺失事实，不改变合同、结论、门禁或角色职责。模板存在缺失字段时报告缺项，由文档作者补充；不得猜测字段值。

## 示例

精简前：

> P0-2 要求超过 10 MiB 的文件返回 `IMPORT_FILE_TOO_LARGE`，且不得创建数据库记录。10 MiB + 1 byte 文件返回该错误码，新增记录为 0，因此 P0-2 已通过。这里再次说明，错误码正确并且数据库没有产生记录。

精简后：

> P0-2：超过 10 MiB 的文件必须返回 `IMPORT_FILE_TOO_LARGE`，且不得创建数据库记录。实测 10 MiB + 1 byte 文件返回该错误码，新增记录为 0。结果：通过。

保留要求、边界值、结论、错误码和副作用证据，仅删除复述。

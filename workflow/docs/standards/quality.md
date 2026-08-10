# 质量与验证规范

## 目的与适用范围

本规范规定开发者验证、测试层级、静态检查和完成定义（Definition of Done）。

**主责角色：** Developer（执行验证）、Reviewer（检查测试与影响）、QA（独立验收）。

## 1. 开发者验证

Developer 必须在提交 Review 前执行与变更范围匹配的验证，至少包括：

- **单元测试** — 覆盖新增或修改的逻辑路径；
- **构建** — 确认项目可成功编译或打包；
- **静态检查** — 运行仓库配置的 linter、类型检查或格式化检查；
- **集成验证** — 当变更涉及模块间交互、API 契约或数据流时，执行必要的集成测试或手工验证。

验证命令与结果须记录在对应切片目录的 `dev-notes.md`（未拆分：`workflow/docs/features/<feature-id>/dev-notes.md`；已拆分：`workflow/docs/features/<feature-id>/<feature-id>-<sub-feature-id>/dev-notes.md`）或 Plan 指定的位置。

## 2. Plan 验证声明

每个 Plan 必须声明：

| 声明项 | 说明 |
|---|---|
| 最低验证层 | 本工作项必须达到的验证层级（如：单元测试 + 构建、或含集成测试） |
| 验证命令 | 可复现的具体命令（如 `npm test`、`cargo test`、`pytest`） |
| 预期证据 | 通过时的可观察输出（如：全部用例 Pass、零 linter 错误、构建成功日志摘要） |

Plan 未声明验证要求的，Developer 不得开始实施。

## 3. Reviewer 检查项

Reviewer 审阅时必须检查：

- **测试有效性** — 测试是否覆盖关键路径；是否存在仅断言恒真或缺失边界情形的测试；
- **文档影响** — 实现是否与 Plan「文档影响」项一致（参见 [documentation.md](./documentation.md)）；
- **安全影响** — 变更是否触发安全审阅条件（参见 [security.md](./security.md)）。

Review 结论须明确上述三项的检查结果。

## 4. QA 独立验收

QA 必须依据 Spec 和 Plan 执行独立验收，不得仅依赖 Developer 或 Reviewer 的自述结论。

验收范围包括：

- Spec 中的验收条件与行为合同；
- Plan 中声明的验证层与预期证据；
- 适用时的回归测试（确保未引入既有功能退化）。

验收结论写入对应切片目录的 `qa-report.md`（未拆分：`workflow/docs/features/<feature-id>/qa-report.md`；已拆分：`workflow/docs/features/<feature-id>/<feature-id>-<sub-feature-id>/qa-report.md`），结论为 Pass、Fail 或 Blocked。Git 仓库中报告的提交时机见 [git.md](./git.md) §1.4：`Pass` 待合并授权期间不单独提交；用户授权 `done` 时与状态一次提交。

## 5. 完成定义（Definition of Done）

工作项达到完成定义须同时满足：

| 条件 | 说明 |
|---|---|
| 实现完成 | Plan 中全部任务已实现 |
| 验证通过 | 开发者验证与 Plan 声明的最低验证层均已通过 |
| 适用文档更新 | Plan「文档影响」项中声明的文档已更新或已标记 N/A |
| Review 要求满足 | Review 门禁为 `required` 时须取得 Approve |
| QA Pass | QA 验收结论为 Pass |
| 合并门禁满足 | 用户已授权合并（或非 Git 下授权完成）；Git 仓库可用时合并前置条件见 [git.md](./git.md)。**`done` 在授权后写入，不等待合入完成** |

任一条件未满足时，工作项不得标记为 `done`。

## 6. 无法执行验证时的处理

测试或检查因环境、依赖、权限或基础设施原因无法执行时，须：

1. **记录原因** — 说明无法执行的具体障碍；
2. **评估风险** — 说明跳过或降级验证对质量的影响；
3. **声明恢复条件** — 明确何种条件满足后可补执行验证。

上述记录须写入 `dev-notes.md`、QA 报告或工作项记录的「阻塞原因 / 恢复条件」字段。

**禁止静默跳过** — 未记录原因与风险的验证缺口不得进入 QA Pass 或合并阶段。

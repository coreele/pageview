# 工作项: single-relation-select

描述: 在 single（Tree 关闭）模式下恢复 table / index 选择能力：可直接挑选堆表或 B-tree 索引并输入 blkno 加载，无需打开 Tree 目录。
目标分支: main
源分支: single-relation-select
基线提交: ed8437c78c39d8d526989fc387551dfeffda6c4c
文档影响: README.md、README.zh-CN.md（Tree 关闭时的选择行为描述）

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| standard | required | not-required | skipped | required |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| planning | Planner 编写 ui-design.md 与 plan.md | | | |

## 进度笔记

- 2026-09-13 登记。范围：`browseMode === "single"` 时工具栏缺少 relation（table / index）选择，只能加载已选中的关系。需求明确，无业务歧义，故 Spec 用户确认填 `not-required`；Design 门禁 skipped（单组件内 UI 增补，无模块/分层/技术选型决策），另出 ui-design.md。
- 2026-09-13 Analyst 完成 `spec.md`：13 条 P0，覆盖选表/选索引加载、blkno/Load、Refresh/Prev/Next、深链回放、回 Tree 反映选中、空态与 0 块/非 B-tree 门禁；明确须改写 `treeNavUi.test.ts` 的旧断言并同步 README。无开放问题。进入 planning。

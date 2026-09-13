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
| done | 已合入，结束 | | | |

## 进度笔记

- 2026-09-13 登记。范围：`browseMode === "single"` 时工具栏缺少 relation（table / index）选择，只能加载已选中的关系。需求明确，无业务歧义，故 Spec 用户确认填 `not-required`；Design 门禁 skipped（单组件内 UI 增补，无模块/分层/技术选型决策），另出 ui-design.md。
- 2026-09-13 Analyst 完成 `spec.md`：13 条 P0，覆盖选表/选索引加载、blkno/Load、Refresh/Prev/Next、深链回放、回 Tree 反映选中、空态与 0 块/非 B-tree 门禁；明确须改写 `treeNavUi.test.ts` 的旧断言并同步 README。无开放问题。进入 planning。
- 2026-09-13 Planner 完成 `ui-design.md` 与 `plan.md`。最低验证层 unit + static + build；验证命令 `pnpm --filter web test`、`pnpm --filter web typecheck`、`pnpm build`。设计要点：关系下拉仅在 single 门控内，复用 `.table-select` / `.index-select` 皮肤与 `indexView.ts` 文案函数，新增 `relationSelect.ts` 纯函数，选择即选中并自动 Load blk 0（0 块/非 B-tree 除外）。第一阶段文档提交 `00fc72f`。进入 developing。
- 2026-09-13 Developer 完成实现并提交 `e4186cd`（`feat(web): pick table or index in single-mode toolbar`），`dev-notes.md` 留工作树。`pnpm --filter web test` 301 passed、typecheck、build 全绿；目标分支 `main` 未移动，同步为 no-op。
- 2026-09-13 Reviewer 结论 `Approve`（无阻塞项；3 条非阻塞观察：`indexHint` 渲染顺序、源码扫描断言偏弱、`indexesFetched` 失败态为既有行为），写入 `review.md`。
- 2026-09-13 QA 结论 `Pass`，13/13 P0 通过（P0-1..P0-11 为活浏览器 + 活 PG 直接验证；P0-12 与 P0-13 索引半部为静态间接验证并注明）。无缺陷。进入 merge-approval，等待用户授权。
- 2026-09-13 用户授权合并。置 `done`，第三阶段文档提交后 rebase + fast-forward 合入 `main`，清理源分支。结束（不归档）。

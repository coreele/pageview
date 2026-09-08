# 工作项: btree-tree-view

描述: 在 Page 模式的 B-tree 索引浏览上增加与 hex/detail 同类的可选树面板（Show tree / Collapse tree），默认折叠，不替换三联区、不新增第三 chrome 模式。
目标分支: main
源分支: btree-tree-view
基线提交: 872e7f62a9f68b152082a72f570a92ff10535daa
文档影响: README.md / README.zh-CN.md 索引浏览节说明树开关。不改 URL。

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/archive/2026/btree-tree-view/`。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| full | required | approved | required | required |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| archived | | | | |

## 进度笔记

- 2026-09-07 Manager 登记。用户：「开树结构视图任务，可选视图」。路径 `full`。Spec/Design/Review `required`。基线 `872e7f6`。
- 2026-09-07 Analyst 初稿 Spec（互斥 structure\|tree）。进入 `spec-approval`。
- 2026-09-07 用户确认并改交互：「tree 视图做和 detail/hex 一样做类似开关即可」。Spec 重写为 chrome Show/Collapse tree、默认折叠、三联区保留、URL 不编码。开放问题全部裁决。Spec 用户确认 `approved`。
- 2026-09-07 Planner：`design.md`（client 按需 raw page + page-core 纯函数 + 独立树缓存）、`ui-design.md`、`plan.md`。进入 `developing`。
- 2026-09-07 Developer：实现树开关面板。代码提交 `fe9d523`。已 rebase `origin/main` `872e7f6`。Review Approve。QA Pass。进入 `merge-approval`。
- 2026-09-07 用户反馈树列过宽（`0.28fr` / `22rem` 在宽屏占约四分之一，内容仅两行）。回 `developing` 收窄为 `fit-content(13rem)`。提交 `36b5ff3`。Review 复审 Approve。QA 轮次 2 Pass。再入 `merge-approval`。
- 2026-09-08 用户扩大范围：「tree 功能同步到 table 模式，允许单独开工作项也可以在此工作项完成」。本项内完成：表页同样 Show tree，列出该表索引并展开 B-tree 页拓扑。Spec 增 P0-9/P0-10，修订 P0-3/P0-7。提交 `3dae723`。Review Approve。QA 轮次 3 Pass。再入 `merge-approval`。
- 2026-09-08 用户更正：「table 模式本身的导航，它没有 tree 结构就是一个列表了」。回 `developing`。Spec P0-9/P0-10 改为堆块号扁平列表；点行 `loadBlk`，不切 index、不列索引。`3dae723` 的森林实现作废。
- 2026-09-08 Developer 提交 `d086861`。Review Approve。QA 轮次 4 Pass。再入 `merge-approval`。
- 2026-09-08 用户授权合并（「ok」）。状态 `done`。第三阶段提交纳入工作流文档。
- 2026-09-08 FF 合入 `main`（`8f873a8`，实现 `d086861`）并归档至 `workflow/archive/2026/btree-tree-view/`。

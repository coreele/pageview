# 工作项: index-tree-nav

描述: 左侧导航分成 table / index 两段（可设最大高度、可完全折叠）；Index 选索引走树，拿掉次带表过滤器与索引下拉。
目标分支: main
源分支: index-tree-nav
基线提交: 1d20b6e8066dc21bcda630061e12ec4b67c295ae
文档影响: README 中英树面板 / Index 选索引入口

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/archive/2026/index-tree-nav/`，无子目录、无版本后缀。
> 表内只填枚举、短标签或路径；理由与长说明写进「进度笔记」（见 `workflow/agents/standards/documentation.md` §B）。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| standard | required | approved | skipped | required |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| archived | | | | |

## 进度笔记

- 2026-09-08 Manager 登记。用户草图：导航列分 **table** / **index** 两段，均设最大高度、允许完全折叠；此前 table-tree-nav 把 Index 下拉列为第二步。路径 `standard`：新选索引路径、Tree 出现时机、与 Table 段共存。Spec required + 用户确认。Design skipped：继续用 `/api/indexes` 与既有 btree 树，不新分层。Review required。
- 2026-09-08 Analyst：`spec.md`。进入 `spec-approval`。
- 2026-09-08 用户确认 Spec（「ok」）。Planner：`ui-design.md`、`plan.md`。进入 `developing`。
- 2026-09-08 Developer：`d057759`。web test 259 / typecheck 0。`origin/main` `1d20b6e` 已是祖先。Review **Approve**。QA **Pass**。进入 `merge-approval`。
- 2026-09-08 用户反馈目录文案挤、分区弱。回修 `8a78057`（去 schema/`N blk`，TABLE/INDEX 大写分区头）。Review 仍 Approve。QA 轮次 2 Pass。待合入提交改为 `8a78057`。
- 2026-09-08 用户反馈索引名旁 btree 标记多余。回修 `161dde9`。QA 轮次 3 Pass。待合入提交改为 `161dde9`。
- 2026-09-08 用户反馈 leaf/L0/root 多余。回修 `4d129b2`（页行只留 meta）。QA 轮次 4 Pass。待合入提交改为 `4d129b2`。
- 2026-09-08 用户反馈三角形过多。回修 `8f16e2b`（段标题保留三角，表/索引/块改 icon）。QA 轮次 5 Pass。待合入提交改为 `8f16e2b`。
- 2026-09-08 用户反馈块图标丑、索引与块轮廓撞车。回修 `ca4f5ee`（索引钥匙、块折角页）。QA 轮次 6 Pass。待合入提交改为 `ca4f5ee`。
- 2026-09-08 用户修订：取消表/索引过滤。回修 `b933a8c`（INDEX 始终全量；深链不按 table 丢 index）。QA 轮次 7 Pass。待合入提交改为 `b933a8c`。
- 2026-09-08 用户授权合并（「ok」）。状态 `done`。第三阶段提交纳入工作流文档。
- 2026-09-08 FF 合入 `main`（`5de1b51`，实现 `b933a8c`）并归档至 `workflow/archive/2026/index-tree-nav/`。

# 工作项: index-tree-nav

描述: 左侧导航分成 table / index 两段（可设最大高度、可完全折叠）；Index 选索引走树，拿掉次带表过滤器与索引下拉。
目标分支: main
源分支: index-tree-nav
基线提交: 1d20b6e8066dc21bcda630061e12ec4b67c295ae
文档影响: README 中英树面板 / Index 选索引入口

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/workspace/index-tree-nav/`，无子目录、无版本后缀。
> 表内只填枚举、短标签或路径；理由与长说明写进「进度笔记」（见 `workflow/agents/standards/documentation.md` §B）。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| standard | required | approved | skipped | required |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| developing | Developer 实施 | | | |

## 进度笔记

- 2026-09-08 Manager 登记。用户草图：导航列分 **table** / **index** 两段，均设最大高度、允许完全折叠；此前 table-tree-nav 把 Index 下拉列为第二步。路径 `standard`：新选索引路径、Tree 出现时机、与 Table 段共存。Spec required + 用户确认。Design skipped：继续用 `/api/indexes` 与既有 btree 树，不新分层。Review required。
- 2026-09-08 Analyst：`spec.md`。进入 `spec-approval`。
- 2026-09-08 用户确认 Spec（「ok」）。Planner：`ui-design.md`、`plan.md`。进入 `developing`。

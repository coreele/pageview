# 工作项: btree-tree-view

描述: 在 Page 模式的 B-tree 索引浏览上增加与 hex/detail 同类的可选树面板（Show tree / Collapse tree），默认折叠，不替换三联区、不新增第三 chrome 模式。
目标分支: main
源分支: btree-tree-view
基线提交: 872e7f62a9f68b152082a72f570a92ff10535daa
文档影响: README.md / README.zh-CN.md 索引浏览节说明树开关。不改 URL。

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/workspace/btree-tree-view/`，无子目录、无版本后缀。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| full | required | approved | required | required |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| developing | Developer 实施 | | | |

## 进度笔记

- 2026-09-07 Manager 登记。用户：「开树结构视图任务，可选视图」。路径 `full`。Spec/Design/Review `required`。基线 `872e7f6`。
- 2026-09-07 Analyst 初稿 Spec（互斥 structure\|tree）。进入 `spec-approval`。
- 2026-09-07 用户确认并改交互：「tree 视图做和 detail/hex 一样做类似开关即可」。Spec 重写为 chrome Show/Collapse tree、默认折叠、三联区保留、URL 不编码。开放问题全部裁决。Spec 用户确认 `approved`。
- 2026-09-07 Planner：`design.md`（client 按需 raw page + page-core 纯函数 + 独立树缓存）、`ui-design.md`、`plan.md`。进入 `developing`。

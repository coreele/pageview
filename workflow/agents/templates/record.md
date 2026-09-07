# 工作项: <id>

描述:
目标分支: main
源分支: <id>
基线提交: <sha>
文档影响:

> **本文件须保存为 `workflow/workspace/<id>/main.md`**，不要沿用模板名 `record.md`。
> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/workspace/<id>/`，无子目录、无版本后缀。
> 表内只填枚举、短标签或路径；理由与长说明写进「进度笔记」（见 `workflow/agents/standards/documentation.md` §B）。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| fast \| standard \| full | required \| skipped | required \| not-required \| approved \| rejected | required \| skipped | required \| skipped |

> `Review=skipped` 仅限 `fast`。非 Git 仓库的三个 Git 字段填 `N/A`。改动门禁须按 WORKFLOW.md §3.2 在进度笔记留痕。
> `plan.md`、`dev-notes.md`、`qa-report.md` 无条件必需，不在本表中，也不可跳过。

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| backlog | | | | |

> 无阻塞则后三列留空。状态取值见 WORKFLOW.md §3。

## 进度笔记

-

# 工作项: index-key-cell

描述: 索引结构图里 tuple 的 `key` 格只有标签、没有值。填入解码键值（有列元数据时）或紧凑 hex 预览，与 tid/info 格一致。
目标分支: main
源分支: index-key-cell
基线提交: 381c63c3f6a9ed5921f3ee64ff02b63252f194f5
文档影响: N/A（README 未描述结构图 key 格文案）

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/workspace/index-key-cell/`，无子目录、无版本后缀。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| fast | skipped | not-required | skipped | skipped |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| developing | Developer 实施 | | | |

## 进度笔记

- 2026-09-08 Manager 登记。用户：「index 模式，key 值没有在图中显示」。路径 `fast`：结构图 key 格漏了 `valueText`，补齐即可。Spec/Design/Review skipped。

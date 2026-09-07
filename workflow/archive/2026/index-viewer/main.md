# 工作项: index-viewer

描述: 在现有 Page（heap）/ WAL 可视化基础上，新增索引（index）页面可视化：识别索引对象、获取索引页 raw page、解析 B-tree 页面结构（metapage / internal / leaf、ItemId、index tuple、高键等）并在 web UI 展示。范围（仅 B-tree 还是含 hash/gist 等）由 Spec 阶段明确。
目标分支: main
源分支: index-viewer
基线提交: 26ed591a51cbcb0ad96b754e1571516525ed7a55
文档影响: 预计需更新 README / README.zh-CN（新 index 模式功能与前置条件）；可能新增索引解析相关开发文档。细节由 Plan 阶段落实。

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/archive/2026/index-viewer/`。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| full | required | approved | required | required |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| archived |  |  |  |  |

## 进度笔记

- 2026-09-07 工作流迁移：机制改为 `workflow/WORKFLOW.md` + `workflow/agents/`；本记录由 `manager.md` 转为 `main.md`，产物平铺到 `workflow/archive/2026/index-viewer/`。旧状态机名称（awaiting-*-approval 等）按新枚举对齐。
- 历史字段 UI 表面: gui（新模板已取消该列）。

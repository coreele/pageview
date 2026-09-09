# 工作项: gutter-grip

描述: 栏间拖动手柄改短、改淡，去掉深色下通栏高亮青条的压迫感。
目标分支: main
源分支: gutter-grip
基线提交: fb41f4097617e49d012d8dc6a8de5749ad0a6068
文档影响: N/A（不改 README）

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/archive/2026/gutter-grip/`，无子目录、无版本后缀。
> 表内只填枚举、短标签或路径；理由与长说明写进「进度笔记」（见 `workflow/agents/standards/documentation.md` §B）。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| fast | skipped | not-required | skipped | skipped |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| archived | | | | |

## 进度笔记

- 2026-09-09 Manager 登记。用户圈树与结构图之间的竖条：通栏、深色下亮青，压迫。路径 `fast`：只改 `.split-gutter::after` 长度与亮度。拖动命中区与调宽逻辑不改。Spec/Design/Review skipped。
- 2026-09-09 Planner：`ui-design.md`、`plan.md`。进入 `developing`。第一阶段文档提交。
- 2026-09-09 Developer：`623383d`。web 289 / typecheck 0。Review skipped。QA Pass。进入 `merge-approval`。
- 2026-09-09 用户授权合并（「合并」）。状态 `done`。第三阶段提交纳入工作流文档。
- 2026-09-09 FF 合入 `main`（`27f80cd`，实现 `623383d`）并归档至 `workflow/archive/2026/gutter-grip/`。

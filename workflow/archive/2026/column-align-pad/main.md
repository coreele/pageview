# 工作项: column-align-pad

描述: 结构图把列间 MAXALIGN padding 折叠进下一列的视觉 range，使固定宽度列（如 `items.price real`）看起来长短不一。修订 `pd-flags-tuple-view` P0-4：列格子只覆盖解码字节，padding 不再挂在列名/列值上。来源：用户对 `public.items` 页 0 的 `price` 格子宽度质疑。
目标分支: main
源分支: column-align-pad
基线提交: e81da020f48c59e50120118b38b4640a9267415c
文档影响: 若 README / 结构图说明仍写「padding 折叠进下一列」，须同步；由 Plan 阶段确认。无运维文档影响。

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/archive/2026/column-align-pad/`。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| standard | required | approved | skipped | required |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| archived |  |  |  |  |

## 进度笔记

- 2026-09-07 工作流迁移：机制改为 `workflow/WORKFLOW.md` + `workflow/agents/`；本记录由 `manager.md` 转为 `main.md`，产物平铺到 `workflow/archive/2026/column-align-pad/`。旧状态机名称（awaiting-*-approval 等）按新枚举对齐。
- 历史字段 UI 表面: gui（新模板已取消该列）。

## 取证（登记时，活库 `public.items` blk 0）

表：`id int4`、`name text`、`price float4`（`attalign=i`）。`price` 存储恒为 4 字节。

| lp | 行 | name | name 存储 | pad | price 实际 | 当前视觉 price |
|---|---|---|---|---|---|---|
| 0 | banana / 0.5 | 6 字符 | 7B | 1B | 4B | 5B |
| 1 | apple / 1.25 | 5 字符 | 6B | 2B | 4B | 6B |
| 2 | cherry / 3 | 6 字符 | 7B | 1B | 4B | 5B |
| 3 | id=4 / `''` / 9 | 空串 | 1B | 3B | 4B | 7B |
| 4 | id=5 | NULL | 不占空间 | — | NULL | 无格 |

`lp_len` 40/40/40/36/28 与头+列+padding 合计一致。存储与解码无误；误导来自视觉折叠。

约束（给 Spec / Plan，非合同）：不得回退单 lane；不得再生成与列格重叠的 `data`/`data-gap-*`。

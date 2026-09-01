# 工作项记录: column-align-pad

工作项标识: column-align-pad
描述: 结构图把列间 MAXALIGN padding 折叠进下一列的视觉 range，使固定宽度列（如 `items.price real`）看起来长短不一。修订 `pd-flags-tuple-view` P0-4：列格子只覆盖解码字节，padding 不再挂在列名/列值上。来源：用户对 `public.items` 页 0 的 `price` 格子宽度质疑。
路径等级: standard
源分支: column-align-pad（实施时自 main 创建）
目标分支: main
文档影响: 若 README / 结构图说明仍写「padding 折叠进下一列」，须同步；由 Plan 阶段确认。无运维文档影响。

> 权威工作流、门禁与状态说明见 [workflow/README.md](../../README.md)。
> 活跃状态见 [STATUS.md](STATUS.md)。
>
> 文档路径：未拆分，Spec 为 `workflow/docs/features/column-align-pad/spec.md`。

## 切片（未拆分时仅一行，sub-feature-id = feature-id）

| sub-feature-id | Spec | Spec 门禁 | Spec 用户确认 | Design 门禁 | UI 表面 | Review 门禁 | 状态 | 后续步骤 |
|---|---|---|---|---|---|---|---|---|
| column-align-pad | [spec.md](../features/column-align-pad/spec.md) | required | approved | skipped | gui | required | done | 已授权合并（QA Pass + Review Approve）；待 FF 合入 main |

阻塞原因: none
恢复条件: none
恢复后的目标状态: N/A

## 门禁判定

- **路径 standard**：修订已验收的结构图视觉合同（`pd-flags-tuple-view` P0-4），非单点热修，亦非跨模块新能力。
- **Spec required**：改变列字段视觉 range、选中/hex 高亮覆盖范围，以及 padding 是否作为独立字段出现；属用户可见行为合同。
- **Spec 用户确认 required**：工作项标注存在展示歧义——padding 可表现为独立 `pad` 格、留空、或纹理叠加；选中 padding 时详情与 hex 高亮合同须写清。且须显式废止/替换 P0-4「折叠进下一列」。Analyst 给出推荐方案后由用户确认。
- **Design skipped**：无模块边界 / 分层 / 技术选型决策；继续用 `deriveStructureFields` + 单 lane CSS grid。
- **UI 表面 gui**：结构图列格与（若有）padding 格。Design 已 skipped，不要求 `ui-design.md`；呈现合同写入 Spec。
- **Review required**：standard 默认。须守住 P0-3/P0-7（禁止再引入重叠 `data-gap-*` / 第二行 data）。

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

## 进度笔记

- 2026-09-01 Manager 登记。未拆分。状态 `backlog`。用户要求评估 `items.price` 格子宽度差：判定需修正（视觉合同误导，非存储缺陷）。后续：调度 Analyst 编写 Spec。
- 2026-09-01 用户授权「继续」。状态 `backlog` → `speccing`。调度 Analyst。
- 2026-09-01 Analyst 完成 `spec.md`（refine-docs 已跑）。状态 `speccing` → `awaiting-spec-approval`。待用户确认开放问题 1–3（建议默认：独立 pad 格、含列尾空档、不加图例 chip）。
- 2026-09-01 用户确认 Spec：开放问题 **1=a 留空**、**2=是（列尾至 dataRange.end 与列间同一规则：不并入列）**、**3=否（不加图例 chip）**。Spec 用户确认 → `approved`。Analyst 按裁决改写合同。Design skipped → `planning`。调度 Planner。
- 2026-09-01 Planner 完成 `plan.md`（T1–T6，refine-docs 已跑）。状态 `planning` → `awaiting-plan-approval`。待用户确认 Plan。
- 2026-09-01 用户确认 Plan（「ok」）。状态 `awaiting-plan-approval` → `planned` → `developing`。调度 Developer 于源分支 `column-align-pad`。
- 2026-09-01 Developer 完成 T1–T6（TDD 先红后绿；L2 202 tests / typecheck / build 绿；浏览器手测按 §6 记缺口）。未提交。后续：调度 Reviewer。
- 2026-09-01 用户调度 Reviewer。状态 `developing` → `reviewing`。Review 结论 **Approve**（`review.md` 未提交；C1–C3 非阻塞）。后续：调度 QA。
- 2026-09-01 用户调度 QA。状态 `reviewing` → `qa`。QA 轮次 1 **Pass**（独立 `pnpm test` 202 + 活库 `items` oracle；浏览器目视按 §6 记录）。`qa-report.md` 未提交。待用户授权合并。
- 2026-09-01 用户授权合并（「ok」）。状态 `qa` → `done`。本提交纳入未入库 `review.md` / `qa-report.md`。随后 FF 合入 `main`。

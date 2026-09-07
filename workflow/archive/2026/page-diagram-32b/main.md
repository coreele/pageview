# 工作项: page-diagram-32b

描述: 将核心页展示改为按 32 字节一行对齐的结构图：字段名/边界可见、点击高亮，中间 free space 可折叠，并与底部 hex（同行宽 32B）双向联动高亮。视觉参考 PostgreSQL 页布局示意图，排版可优化，不必像素复刻。
目标分支: main
源分支: page-diagram-32b
基线提交: 97b4f0570c3e41821976ff211ce2feb47570323b
文档影响: 已归档至 `workflow/archive/2026/page-diagram-32b/`（原 `workflow/archive/2026/page-diagram-32b/`：spec.md、design.md、ui-design.md、plan.md、dev-notes.md、review.md、qa-report.md）；可能修订 README 中页视图说明。前序能力见归档 `workflow/archive/2026/pg-page-viewer/`。

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/archive/2026/page-diagram-32b/`。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| full | required | approved | required | required |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| archived |  |  |  |  |

## 进度笔记

- 2026-09-07 工作流迁移：机制改为 `workflow/WORKFLOW.md` + `workflow/agents/`；本记录由 `manager.md` 转为 `main.md`，产物平铺到 `workflow/archive/2026/page-diagram-32b/`。旧状态机名称（awaiting-*-approval 等）按新枚举对齐。
- 历史字段 UI 表面: gui（新模板已取消该列）。

## 参考资产（供 Analyst / Planner）

- 用户参考图（示意图，非最终像素稿）: `/Users/zhougangjie/.cursor/projects/Users-zhougangjie-Space-pageview/assets/page_header_tuple-60f738fc-cf75-4be7-b83e-0465348f214c.png`
- 图示要点（登记引用，非最终 UI）:
  - 整页按 PageHeader / ItemId 数组 / free space / HeapTuple 自下而上（或等价经典布局）表达
  - Header：pd_lsn(xlogid/xrecoff)、checksum|flags、pd_lower、pd_upper、special|version、prune_xid
  - ItemId：off|flag|len；含 LP_UNUSED / LP_NORMAL / LP_REDIRECT / LP_DEAD
  - 中间 free space（可折叠）
  - Tuple：t_xmin/t_xmax/t_cid、ctid(BlockId/Offset)、infomask2/infomask、hoff、列数据等
  - 标注提示：infomask 事务/MVCC/锁（动态）；infomask2 元组结构/属性（静态）

## 用户明确需求要点（须写入 Spec 合同）

1. 核心页面展示改为「结构图」形式（可比参考图更美观、优化排版，不必像素级复刻）
2. 一行宽度 = 32 字节（页视图按 32B 分行对齐）
3. 每个字段位置展示对应字段名/信息，并画出字段边界
4. 点击字段后在结构图内高亮
5. 中间 free space 仍可折叠（保留既有能力）
6. 与底部 hex 对应：结构图选中 ↔ hex 高亮联动
7. hex 也按 32B 一行显示（与结构图行宽一致）

### 增量需求（2026-07-26 第二轮，待 Spec 修订 + 用户确认）

参考截图（当前 UI 现状，非像素稿）: `/Users/zhougangjie/.cursor/projects/Users-zhougangjie-Space-pageview/assets/image-c491b6d4-43b6-4638-ab5c-c6a60c1742cc.png`

8. **格内具体数值**：字段格宽度足够时，在标签外展示该字段的具体可读值（如 `t_xmin`/`t_xmax` 的事务号）；窄格沿用缩写 + tooltip/详情（Q2 合同不回退）。
9. **点击详情保留**：点击仍打开/更新既有 Selection detail，且详情与格内数值一致（同一解析来源）。
10. **hex 自动定位**：点击结构图字段后，底部 hex 自动滚动使该字段高亮区间进入可视区（256 行 32B 网格下免长滚）。

## QA 首轮（2026-07-26）— Fail

结论: **Fail**。报告：[qa-report.md](qa-report.md)。验收版本：`page-diagram-32b` @ `7baece2`。

缺陷:

| ID | 严重程度 | 状态 | 摘要 |
|---|---|---|---|
| DEF-001 | High | closed | P0-12：高偏移 hex 自动定位；根因 gap/padding 未计入滚动几何。已修 @ `9d828e7`；QA 回归 Pass 关闭 |

已补齐手测：首轮 P0-1..P0-8 / P1-1/P1-2 + 增量 1–7（其中手测 4 / P0-12 曾失败）。L2/集成均 Pass。Q7 展开本身 Pass。不请求合并。

建议复测：修后 Review 再 Approve → QA 回归 P0-12 / Q7 / 手测 4–5。

## Plan 用户确认（2026-07-26）

结论: **批准 Plan**（用户回复「ok」；同时授权调度 Developer）。Plan 路径：[plan.md](plan.md)（T1–T9，依据 design.md / ui-design.md）。状态 `awaiting-plan-approval` → `planned` → `developing`。

已知设计裁决（实施须遵循）:
- 结构图 DOM+CSS Grid；App 单一权威 ByteRange 双向联动。
- ItemId 位域视觉三分，选中/hex 高亮共享整 4B slot。
- P1-3（infomask 图注）按 Q4 默认 N/A。

分支（调度 Developer 前置已满足）: 源 `page-diagram-32b` · 目标 `main`。Developer 须自 `main` 创建并检出源分支后实施（禁止在 `main` 上直接改代码）。

## Plan 增量用户确认（2026-07-26 第二轮）

结论: **批准增量 Plan**（用户回复「ok」；同时授权调度 Developer）。Plan 路径：[plan.md](plan.md)（T10–T15，覆盖 P0-10..P0-12 与 Q7；T1–T9 语义保留）。状态 `awaiting-plan-approval` → `planned` → `developing`。

增量实施须遵循:
- T10 收编工作区未提交视觉改动（StructureMap/HexDump/styles/structure-fields），dev-notes 记来源与影响。
- T11–T15：主值同源、格内值模式与宽度判定、详情同源、hex 自动定位 + Q7 折叠自动展开、手测与文档。
- 分支已记录：源 `page-diagram-32b` · 目标 `main`（当前已在源分支）。

## Spec 用户确认（2026-07-26）

Spec 路径: [workflow/archive/2026/page-diagram-32b/spec.md](spec.md)

结论: **批准 Spec**（用户回复「ok」）。范围 P0-1..P0-9、P1-1..P1-3 及既有 `pg-page-viewer` 基线合同语义保留。`Spec 用户确认` → `approved`。

开放问题 Q1–Q6 裁决（**全部采纳 Analyst 推荐默认**，权威决议记录于此，Planner 须据此设计）:

| ID | 议题 | 已确认裁决（= Analyst 推荐） |
|---|---|---|
| Q1 | 垂直方向 | 低偏移在上（Header/ItemId 上、free 中、tuple 下），与 hex 同向；禁止整页倒置 |
| Q2 | 窄字段标签 | 格内缩写/截断，全文经 tooltip 或详情区；禁止因标签省略/合并字段边界 |
| Q3 | 跨行字段 | 整字段单一选中；各行画片段；点击任一片段或 hex 区间内任一字 → 全字段 + hex 连续区间同步 |
| Q4 | infomask 图注 | 不纳入本项 P0；保留既有逐位解读；如纳入则为可选 P1-3 |
| Q5 | free 折叠视觉 | 紧凑断裂带 + `free space` 标签与真实 `[start,end)`/字节数；不为折叠区铺满空 32B 行；折叠控件可发现且可键盘操作 |
| Q6 | hex 地址标注 | 行首 = 该行首字节页内绝对偏移，十六进制 ≥4 位；32 字节/行；ASCII 旁路可选（若有须对齐且不破坏点选） |

> 注：Spec 正文中 Q1–Q6 的「待确认」措辞语义上已由本决议关闭；Planner 以本卡决议为准。既有 P0/P1 语义不得删改。

## Spec 增量用户确认（2026-07-26 第二轮）

结论: **批准增量 Spec**（用户回复「ok」）。P0-10 格内数值、P0-11 详情一致、P0-12 hex 自动定位纳入合同；既有 P0-1..P0-9 / P1-1..P1-3 与 Q1–Q6 决议语义不变。`Spec 用户确认` → `approved`（全量）。

开放问题 Q7 裁决（采纳 Analyst 推荐默认）:

| ID | 议题 | 已确认裁决 |
|---|---|---|
| Q7 | 选中变化时 hex 处于折叠 | **自动展开后再按 P0-12 定位**（非仅在已展开时滚动） |

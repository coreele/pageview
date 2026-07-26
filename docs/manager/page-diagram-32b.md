# 工作项记录: page-diagram-32b

工作项标识: page-diagram-32b
描述: 将核心页展示改为按 32 字节一行对齐的结构图：字段名/边界可见、点击高亮，中间 free space 可折叠，并与底部 hex（同行宽 32B）双向联动高亮。视觉参考 PostgreSQL 页布局示意图，排版可优化，不必像素复刻。
路径等级: full
源分支: page-diagram-32b
目标分支: main
文档影响: 新建 `docs/features/page-diagram-32b/`（预期 spec.md；Design 门禁 required 时另有 design.md、ui-design.md、plan.md；后续 dev-notes / review / qa-report）。可能修订 README 中页视图说明。前序能力见归档 `docs/archive/2026/pg-page-viewer/`。

> 权威工作流、门禁与状态说明见 manager 规范。
> 活跃状态见 [STATUS.md](STATUS.md)。
>
> 文档路径：未拆分 Spec 为 `docs/features/page-diagram-32b/spec.md`。

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

## 切片（未拆分，sub-feature-id = feature-id）

| sub-feature-id | Spec | Spec 门禁 | Spec 用户确认 | Design 门禁 | UI 表面 | Review 门禁 | 状态 | 后续步骤 |
|---|---|---|---|---|---|---|---|---|
| page-diagram-32b | [spec.md](../features/page-diagram-32b/spec.md) | required | approved（含增量 P0-10..P0-12） | required | gui | Approve（复审 @ 9d828e7） | done | 已授权合入；等待 Merge Executor 合入 main 后归档 |

阻塞原因: none
恢复条件: N/A
恢复后的目标状态: N/A

## QA 首轮（2026-07-26）— Fail

结论: **Fail**。报告：[qa-report.md](../features/page-diagram-32b/qa-report.md)（未提交）。验收版本：`page-diagram-32b` @ `7baece2`。

缺陷:

| ID | 严重程度 | 状态 | 摘要 |
|---|---|---|---|
| DEF-001 | High | closed | P0-12：高偏移 hex 自动定位；根因 gap/padding 未计入滚动几何。已修 @ `9d828e7`；QA 回归 Pass 关闭 |

已补齐手测：首轮 P0-1..P0-8 / P1-1/P1-2 + 增量 1–7（其中手测 4 / P0-12 曾失败）。L2/集成均 Pass。Q7 展开本身 Pass。不请求合并。

建议复测：修后 Review 再 Approve → QA 回归 P0-12 / Q7 / 手测 4–5。

## Plan 用户确认（2026-07-26）

结论: **批准 Plan**（用户回复「ok」；同时授权调度 Developer）。Plan 路径：[plan.md](../features/page-diagram-32b/plan.md)（T1–T9，依据 design.md / ui-design.md）。状态 `awaiting-plan-approval` → `planned` → `developing`。

已知设计裁决（实施须遵循）:
- 结构图 DOM+CSS Grid；App 单一权威 ByteRange 双向联动。
- ItemId 位域视觉三分，选中/hex 高亮共享整 4B slot。
- P1-3（infomask 图注）按 Q4 默认 N/A。

分支（调度 Developer 前置已满足）: 源 `page-diagram-32b` · 目标 `main`。Developer 须自 `main` 创建并检出源分支后实施（禁止在 `main` 上直接改代码）。

## Plan 增量用户确认（2026-07-26 第二轮）

结论: **批准增量 Plan**（用户回复「ok」；同时授权调度 Developer）。Plan 路径：[plan.md](../features/page-diagram-32b/plan.md)（T10–T15，覆盖 P0-10..P0-12 与 Q7；T1–T9 语义保留）。状态 `awaiting-plan-approval` → `planned` → `developing`。

增量实施须遵循:
- T10 收编工作区未提交视觉改动（StructureMap/HexDump/styles/structure-fields），dev-notes 记来源与影响。
- T11–T15：主值同源、格内值模式与宽度判定、详情同源、hex 自动定位 + Q7 折叠自动展开、手测与文档。
- 分支已记录：源 `page-diagram-32b` · 目标 `main`（当前已在源分支）。

## Spec 用户确认（2026-07-26）

Spec 路径: [docs/features/page-diagram-32b/spec.md](../features/page-diagram-32b/spec.md)

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

## 门禁判定理由

- 路径等级 `full`：核心页主视图改为新的结构图形态与交互合同（32B 对齐、字段边界、点击高亮、hex 双向联动），属新能力/体验重塑；合同需落成并经用户确认。
- Spec 门禁 `required` 且 Spec 用户确认 `required`：`full` 强制。
- Design 门禁 `required`：结构图渲染与布局模型（含 32B 行网格、字段边界绘制、free space 折叠与行对齐共存）、结构图↔hex 选中/高亮同步架构需正式决策；技术选型（如 DOM/SVG/canvas）与前端分层边界可能调整。
- UI 表面 `gui`：面向最终用户的核心页主视图；Design=`required` 且表面为 gui，故 Planner 在 Plan 前须调用 `design-ui` 产出 `ui-design.md`。主题/深色模式是否变更由 Spec 决定（本项用户未要求改主题，默认沿用既有）。
- Review 门禁 `required`：`full` 强制。
- 未拆分：单一核心视图增强，范围可控。
- 分支：目标 `main`，源 `page-diagram-32b`（调度 Developer 前由实施方自 `main` 创建并检出）。

## 进度笔记

- 2026-07-26: 用户经 `/manager`（「ma」同义）登记新工作项。前序 `pg-page-viewer` 已合入 `main` 并归档。路径等级 full，门禁与 UI 表面判定完成。状态 `backlog` → `speccing`。单步模式：调度 Analyst 编写 Spec（引用参考图路径与 7 条明确需求）；完成后进入 Spec 用户确认，不擅自进入 Design/Plan/实现。
- 2026-07-26: Analyst 完成 `docs/features/page-diagram-32b/spec.md`（含 P0-1..P0-9、P1-1..P1-3、开放问题 Q1–Q6）。状态 `speccing` → `awaiting-spec-approval`。单步模式：**不**调度 Planner；等待当前用户会话确认 Spec 与 Q1–Q6 裁决。
- 2026-07-26: **用户确认 Spec**（回复「ok」），Q1–Q6 全部采纳 Analyst 推荐默认（决议见「Spec 用户确认」节）。`Spec 用户确认` → `approved`。状态 `awaiting-spec-approval` → `designing`。调度 [planner](ce896f48-9c92-4183-8738-ec5d693c0fbb)：依 Spec + Q1–Q6 决议 + 参考图产出 `design.md`（Design 门禁 required）→ `ui-design.md`（UI 表面 gui，须调用 design-ui）→ `plan.md`。Planner 完成后进入 `awaiting-plan-approval`。单步模式：**不**调度 Developer，Plan 须经用户确认。
- 2026-07-26: Planner（[planner](ce896f48-9c92-4183-8738-ec5d693c0fbb)）完成 `design.md`（185 行）、`ui-design.md`（164 行）、`plan.md`（185 行，T1–T9）。技术选型：结构图 DOM+CSS Grid（非 SVG/Canvas）；App 单一权威 `ByteRange` 双向联动；`deriveStructureFields`/`resolveFieldAt` 派生进 page-core（不改 `parsePage` 语义）；free 折叠断裂带不铺空行；ItemId 位域视觉三分但选中共享整 4B slot。验收映射覆盖 P0-1..P0-9、P1-1/P1-2；P1-3（infomask 图注）按 Q4 默认 N/A。开放风险：无「必须改后端/解析语义」阻塞（若实施发现冲突则停扩范围回 Analyst）。Design 门禁 required 已满足（design.md 存在）；UI 表面 gui 的 ui-design.md 已产出。状态 `designing` → `planning`（短暂）→ `awaiting-plan-approval`。单步模式：**不**调度 Developer；等待当前用户会话确认 Plan。
- 2026-07-26: **用户确认 Plan 并授权调度 Developer**（回复「ok」）。Plan approved。状态 `awaiting-plan-approval` → `planned` → `developing`。分支已记录：源 `page-diagram-32b` → 目标 `main`。调度 Developer：自 `main` 创建/检出源分支，按 Plan T1–T9 TDD 实施，产出 `dev-notes.md` 与开发者验证证据。单步模式：Developer 完成后更新状态为 `reviewing` 并**请求**用户授权调度 Reviewer；**不**自动调度 Reviewer。
- 2026-07-26: Developer（[developer](efa3510e-dfeb-436b-9a25-df0ea132e983)）完成实施。Manager 核验：当前分支 `page-diagram-32b`（非 main）；领先 `main` 3 commits：`eb28aba` page-core derive/resolve · `f5c1bff` web 32B 结构图+hex 联动 · `3ab1df8` feature docs+README。`dev-notes.md` 已产出。T1–T9 均标完成；P1-3 N/A。验证：`page-core` test Pass（19）、`pnpm -r typecheck/build` Pass、`test:integration` Pass（`public.qa_cross` 8192）。**缺口**：浏览器 UI 手测 P0-1..P0-8 / P1-1/P1-2 未做（记入 dev-notes；不阻塞进入 Review，但阻塞 QA Pass 前须补）。STATUS/工作项卡仍未入库（留关闭窗口）。状态 `developing` → `reviewing`。单步模式：**不**调度 Reviewer；等待用户授权。
- 2026-07-26: **Spec 回退登记（第二轮增量需求，并入本工作项）**。用户经 `/manager` 提出：格内具体数值（宽度足够时，如 xmin/xmax）、点击详情保留一致、hex 自动滚动定位（要点 8–10，参考截图已记入「参考资产」下方）。判定：同一视图与交互合同的范围增量，不另立工作项；`full` 路径下增量条款须经用户确认。状态 `reviewing` → `speccing`；`Spec 用户确认` `approved` → `required`（仅针对增量；既有 P0-1..P0-9 / P1-1..P1-3 与 Q1–Q6 决议语义**不得删改**）。既有 `design.md`/`plan.md`/`ui-design.md` 待 Spec 确认后由 Planner 增量修订。**工作区事实**：源分支领先 main 3 commits 之外，另有未提交改动（`apps/web/src/{StructureMap,HexDump}.tsx`、`styles.css`、`packages/page-core/src/structure-fields.ts`）——疑似治理流程外的视觉优化，Manager 不提交不回退，交后续 Developer 阶段收编并在 dev-notes 说明。调度 Analyst 增量修订 spec.md（续编号 P0-10 起）。单步模式：完成后进入 `awaiting-spec-approval`，不调度 Planner。
- 2026-07-26: Analyst（[analyst](f1e6d55e-0521-45d7-8efe-c5ffca0e8d74)）完成增量 Spec 修订：**P0-10** 格内数值（宽度足够 = 完整主显示串无溢出/无省略截断，否则回退 Q2 标签模式）、**P0-11** 详情一致（同源同格式，禁止两套解读）、**P0-12** hex 自动定位（非 hex 发起的选中变化滚动一次，区间首字节行进入可视区、宜近顶 1/3；已可见/同区间不强制滚）。开放问题 **Q7**：选中变化时 hex 若处于折叠——推荐默认「自动展开后再定位」。既有 P0-1..P0-9 / P1-1..P1-3 语义无改动；Q1–Q6 不重开。状态 `speccing` → `awaiting-spec-approval`。单步模式：**不**调度 Planner；等待用户确认增量 Spec + Q7 裁决。
- 2026-07-26: **用户确认增量 Spec**（回复「ok」）：P0-10/P0-11/P0-12 批准；Q7 采纳推荐默认（hex 折叠时自动展开后再定位）。`Spec 用户确认` → `approved`（全量）。状态 `awaiting-spec-approval` → `designing`。调度 Planner 增量修订 design.md / ui-design.md / plan.md（覆盖 P0-10..P0-12 + Q7；既有已确认合同与 Q1–Q6 不变；Plan 须计划收编工作区未提交视觉改动并要求 Developer 在 dev-notes 说明）。单步模式：Planner 完成后进入 `awaiting-plan-approval`，**不**调度 Developer。
- 2026-07-26: Planner（[planner](eb4e5b2f-4946-4327-9312-2654c856454e)）完成增量修订：`design.md` 185→295 行（决策 6–10：`StructureField.valueText` 主值单一来源、宽度判定 = 度量 + `cellCapacityChars`/`chooseCellContent` 纯函数含 1 字符余量、hex 定位 = `computeHexScrollTarget` 近顶 1/3 + `hexLocate.nonce` 驱动、Q7 折叠先展开再由挂载后首次 effect 定位、增量逻辑测试归 page-core/web 纯函数）；`ui-design.md` 164→209 行（值/标签三档、定位视觉与 reduced-motion、状态表 +5）；`plan.md` 185→263 行（**新增 T10–T15**：T10 收编工作区未提交视觉改动并记 dev-notes、T11 主值同源、T12 值模式与宽度判定、T13 详情同源、T14 hex 定位+Q7、T15 增量手测与文档）。验收映射：P0-10(T11+T12)、P0-11(T11+T13)、P0-12(T14)、Q7(T14)；既有 T1–T9 / P0-1..P0-9 语义不变。风险：度量类须浏览器手测证明；第一轮手测缺口与增量手测一并补齐后方可 QA Pass。状态 `designing` → `planning`（短暂）→ `awaiting-plan-approval`。单步模式：**不**调度 Developer；等待用户确认增量 Plan。
- 2026-07-26: **用户确认增量 Plan 并授权调度 Developer**（回复「ok」）。增量 Plan（T10–T15，含 Q7）approved。状态 `awaiting-plan-approval` → `planned` → `developing`。分支已记录：源 `page-diagram-32b` → 目标 `main`（当前已在源分支）。调度 Developer：按 Plan T10–T15 TDD 实施（含 T10 收编工作区未提交视觉改动），更新 `dev-notes.md` 与验证证据。单步模式：完成后置 `reviewing` 并**请求**用户授权调度 Reviewer；**不**自动调度 Reviewer。
- 2026-07-26: Developer（[developer](371b90c0-ffa1-46a0-9de9-888f91c0e8e1)）完成增量实施。Manager 核验：当前分支 `page-diagram-32b`；相对 `main` 共 9 commits（本轮新增含 `888b19b` T10 收编视觉、`1a2dd8b` 增量 docs、`27794d3` valueText/helpers、`a7fcb5d` 格内值+hex 定位、`e12d1e9` 防手动展开重滚、`7baece2` 验证证据）。T10–T14 完成；T15 部分（L2/集成 Pass，**增量手测 1–7 未做**）。验证：`page-core` test Pass（29）、typecheck/build Pass、`test:integration` Pass。T10：纳入视觉改动并规整 Q5 free 文案，偏离无。工作区仍有未入库：`docs/manager/**`；另 `dev-notes.md` 有相对最后 commit 的修改（工作树脏，待关闭窗口或补提交）。状态 `developing` → `reviewing`。单步模式：**不**调度 Reviewer；等待用户授权。手测缺口不阻塞进入 Review，但阻塞 QA Pass 前须补。
- 2026-07-26: **用户授权调度 Reviewer**（回复「ok」）。状态保持 `reviewing`，立即调度 Reviewer 审阅源分支 `page-diagram-32b`（相对 `main` 的全量实现：T1–T9 + 增量 T10–T15；含格内数值、详情同源、hex 自动定位/Q7、视觉收编及既有 32B 合同）。按 `git.md` §1.4，Reviewer **只写不提交** `review.md`。工作区可能含未入库 `dev-notes.md` 修改与 `docs/manager/**`——审阅以源分支 commits + 工作树现状为准。单步模式：完成后按结论更新并返回；**不**自动调度 QA/Developer。
- 2026-07-26: Reviewer（[reviewer](55ac0aec-a56d-4962-bafa-80795eb95a33)）完成审阅。版本：`page-diagram-32b` @ `7baece2`（领先 main 9 commits；无未提交源码）。结论：**Approve**（无阻塞项；非阻塞 Comment C1–C4）。独立取证：page-core test 29 Pass、typecheck/build Pass。手测缺口（增量 1–7 + 首轮 P0-1..P0-8/P1-1/P1-2）**不**阻塞 Approve，**阻塞 QA Pass**。报告：`docs/features/page-diagram-32b/review.md`（未提交）。Review 门禁 `required` **已满足**。状态保持 `reviewing`（单步：不自动进 QA）。下一步：等待用户授权调度 QA。
- 2026-07-26: **用户授权调度 QA**（回复「ok」）。入口门禁核验：Plan（含增量 T10–T15）已确认；Review 结论 Approve；源/目标分支已记录（`page-diagram-32b` → `main`）。状态 `reviewing` → `qa`，立即调度 QA 独立验收并产出 `qa-report.md`（只写不提交）。须覆盖 P0-1..P0-12、P1-1/P1-2、Q7，以及 Review/dev-notes 记载的浏览器手测缺口（首轮 + 增量清单）。单步模式：完成后按结论更新并返回；`Pass` 后请求合并授权，**不**自动合并；`Fail` → developing。
- 2026-07-26: QA（[qa](488c67dc-0702-432b-9a2b-d9aeab83af10)）首轮结论：**Fail**。验收版本 `7baece2`。手测已补齐（首轮 + 增量 1–7）。L2/集成 Pass。缺陷 **DEF-001**（High）：P0-12 高偏移 hex 自动定位失败（CSS `gap`/padding 未计入滚动几何；`fromTopRatio≈1.31`）。Q7 展开 Pass，定位随 P0-12 Fail。报告：`qa-report.md`（未提交）。状态 `qa` → `developing`。不请求合并。单步模式：**不**自动调度 Developer；等待用户授权后修 DEF-001，再 Review → QA 回归。
- 2026-07-26: **用户授权调度 Developer 修 DEF-001**（回复「ok」）。状态保持 `developing`，立即调度 Developer：TDD 修复 P0-12 滚动几何（计入 `.hex` CSS gap/padding）；验证含浏览器手测 4–5 与 Q7 展开路径；更新 `dev-notes.md` 缺陷修复回执。单步模式：完成后置 `reviewing` 并**请求** Reviewer 复审授权；**不**自动调度 Reviewer；不合并。
- 2026-07-26: Developer（[developer](57605599-fd2a-4ecc-93e1-9a7823c32166)）完成 DEF-001 修复。Manager 核验：分支 `page-diagram-32b`；新 commit `9d828e7`（相对 main 共 10 commits）。`computeHexScrollTarget` 增加 `rowGapPx`/`paddingTopPx`；HexDump 度量后传入；page-core test Pass（31）；typecheck/build Pass；开发者手测 4–5 / Q7 Pass。DEF-001 → fixed（待 QA 关闭）。`dev-notes.md` 已有修复回执。状态 `developing` → `reviewing`。单步模式：**不**自动调度 Reviewer；等待用户授权复审。不合并。
- 2026-07-26: **用户授权 Reviewer 复审**（回复「ok」）。状态保持 `reviewing`，立即调度 Reviewer：重点核验 DEF-001 @ `9d828e7`（gap/padding 计入滚动几何、nonce/不抢滚、页尾夹取可见性）；确认无新阻塞。按 `git.md` §1.4 只写不提交 `review.md`。单步模式：完成后按结论更新；Approve → 请求 QA 回归授权；Request changes → developing；**不**自动调度 QA；不合并。
- 2026-07-26: Reviewer 复审（[reviewer](4a3c736f-5a0d-4a88-9286-125bfafcd75d)）结论：**Approve**。版本：`page-diagram-32b` @ `9d828e7`。DEF-001 修复核验通过（gap/padding 几何、仅 scrollTo、nonce 不抢滚、页尾夹取、TDD）。独立取证 page-core test 31 Pass。无新阻塞项。`review.md` 已更新（未提交）。Review 门禁 **已重新满足**。状态保持 `reviewing`。下一步：等待用户授权调度 QA 回归（关闭 DEF-001）。不合并。
- 2026-07-26: **用户授权调度 QA 回归**（回复「ok」）。入口门禁核验：Plan（含增量）已确认；Review 复审 Approve @ `9d828e7`；分支已记录。状态 `reviewing` → `qa`，立即调度 QA 在同一 `qa-report.md` 追加回归轮次：关闭 DEF-001（P0-12 / Q7 / 手测 4–5）并抽查受影响范围，确认无新缺陷。报告只写不提交。单步模式：完成后按结论更新；`Pass` → 请求合并授权，**不**自动合并；`Fail` → developing。
- 2026-07-26: QA 回归（[qa](e1d0789c-ad86-4260-8bc6-6cf7886d0357)）轮次 2 结论：**Pass**。验收版本 `page-diagram-32b` @ `9d828e7`（领先 `main` 10 commits，无未提交源码）。**DEF-001 → closed**：P0-12 手测 4 Pass（首字节行入可视区；页尾夹取 `fromTopRatio≈0.90`；`deltaExpected=0`，naive 偏差 ≈109px）；Q7 Pass；手测 5 不抢滚 Pass；抽查 P0-4/5/7/8/10/11 无回归。L2：page-core test 31 Pass、typecheck/build Pass；L3：`test:integration` Pass（`public.qa_cross` 8192）。无新缺陷（未开 DEF-002+）。报告：`qa-report.md`（**未提交**，与 `review.md` 一并留至关闭窗口一次提交）。合并前置 1–4 已满足，缺第 5 项（用户合并授权）。状态保持 `qa`。单步模式：**不**合并、**不**置 `done`；等待当前用户会话的明确合并授权（源 `page-diagram-32b` → 目标 `main`）。
- 2026-07-26: **用户明确授权合入**（回复「ok」：源 `page-diagram-32b` → 目标 `main`）。合并前置核验：Plan（含增量）已确认；Review 复审 Approve @ `9d828e7`；QA 回归 Pass，DEF-001 closed；分支已记录。状态 `qa` → `done`。在源分支一次提交未入库的 `review.md` / `qa-report.md` 与 STATUS/工作项记录（不提交 `.env`；**不** push）。随后调度 Merge Executor 本地合入 `main`；合入成功后归档本工作项。本消息未授权 push 远程。

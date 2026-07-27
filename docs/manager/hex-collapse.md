# 工作项记录: hex-collapse

工作项标识: hex-collapse
描述: 继续优化 `pg-page-viewer`：使右边 HEX 视图也支持折叠，并与左侧 Free space 折叠、顶部「Collapse hex」及整体暗色双栏布局保持协调。范围限定为前端交互/呈现；不改 `page-core` 解析语义。
路径等级: standard
源分支: hex-collapse
目标分支: main
文档影响: 已归档至 `docs/archive/2026/hex-collapse/`（原 `docs/features/hex-collapse/`：spec.md、plan.md、dev-notes.md、review.md、qa-report.md）；含滚动条主题色样式合入。无独立 Design。

> 权威工作流、门禁与状态说明见 [docs/README.md](../README.md)。
> 活跃状态见 [STATUS.md](STATUS.md)。
>
> 文档路径（已归档）：`docs/archive/2026/hex-collapse/`。

## 与其他工作项关系

- `fix-dev-web-page-core`：仍为 `done`、用户已授权合并、**待合入 main**。本项实现须在源分支 `hex-collapse` 上进行；**不擅自合入** `fix-dev-web-page-core`。若合入前 `main` 尚未包含该修复，Developer 须基于当时目标分支策略处理（以 Manager/用户后续指示为准），禁止在 `main` 上直接实施本项。
- 前序 UI 合同参考归档：`docs/archive/2026/layout-chrome-split/`（含整栏 Collapse/Show hex）、`page-diagram-32b`、`pg-page-viewer`。

## 参考资产

- 当前 UI 截图（2026-07-27）：`C:\Users\admin\.cursor\projects\d-AStudy-Space-pageview/assets/c__Users_admin_AppData_Roaming_Cursor_User_workspaceStorage_82874710c750b3b98380c20e0e5f9b3d_images_image-4dd80884-510d-40c7-a4df-72bc552f0c05.png`
- 图示要点（登记引用，非最终像素稿）：
  - 左侧 Free space 已有「Collapse free space」折叠条
  - 顶栏已有「Collapse hex」（整栏显隐，既有合同见 layout-chrome-split）
  - 右侧 HEX 当前为连续滚动字节流（截图中大量 `00`），尚无与左侧 free-space 对等的**视图内**折叠呈现

## 产品澄清（已确认，2026-07-27）

用户已确认，以下为**已定范围**（Analyst / 后续角色不得重新打开 A/B 歧义）：

1. **范围 = B**：HEX **视图内**按区间折叠（类似左侧 Free space）。**不是**仅整栏折叠 A，也**不是** A+B。顶栏既有「Collapse hex」整栏显隐**保留不变**（本项不以其为交付目标）。
2. **折叠对象**：仅折叠 **free space** 对应字节区间，且与左侧 Free space **联动**。明确排除「大段重复字节（如连续 00）即可折叠」方案。
3. **既有行为**：必须保留结构图 ↔ hex **双向高亮**与 **自动滚动**等既有合同，不得回退。

历史选项 A / A+B /「任意重复字节」仅作决策记录，不再作为开放问题。

## Spec 确认与合同修订（2026-07-27，实质变更 → 须修订 Spec 后再批）

相对初版 Spec 的开放问题 Q1/Q2 与「Collapse/Expand」切换合同，用户确认如下（**覆盖**初版切换/展开语义）：

1. **折叠态策略（覆盖原 Q1 / 展开合同）**
   - 仍与左侧 Free space **联动、同一呈现语义**（两侧一致）。
   - **只保留折叠态**；**取消 free space 的展开态**。
   - 左侧也**不要**再提供「Expand free space」；结构图与 hex 中非空 free space **始终**以折叠/断裂带呈现，**不再**支持展开为逐字节单元格或结构图展开条。
   - 原「Collapse/Expand free space」切换控件：须在 Spec 中写清为**一并移除**或改为**仅展示态**（无展开入口）；若永远折叠，可去掉可切换布尔态或恒为折叠（由 Analyst 在修订稿写死推荐合同）。
2. **选中行为（覆盖原 Q2）**：**取消展开**；选中 free 时 **高亮断裂带**即可（不自动展开 hex 字节）。

判定：上述修订指令已由 Analyst 落地；**用户于 2026-07-27 答复「ok」批准修订后 Spec 全文**（见下节）。

## Spec 用户确认（approved，2026-07-27）

用户答复「ok」= **批准** `docs/features/hex-collapse/spec.md` 修订稿全文，包括：始终折叠、移除 Expand/Collapse free space 控件、选中仅高亮断裂带、覆盖前序 Q5、保留双向高亮/自动滚动/顶栏 Collapse hex/不改 page-core。

Spec 用户确认字段 → **approved**。Design skipped → 直接进入 Plan；调度 Planner。**Plan 须另经用户确认**后方可 `planned` / 调度 Developer。

## Plan 用户确认（approved，2026-07-27）

用户答复「ok」= **批准** `docs/features/hex-collapse/plan.md` 全文，按 T1–T9 实施。

分支已记录：源 **`hex-collapse`** → 目标 **`main`**。实现须在源分支上进行，**禁止**在 `main` 直接实施。

## 合并授权（approved，2026-07-27）

用户答复「ok」= **授权**将源分支 **`hex-collapse`** 合入目标分支 **`main`**。

合入前源分支关闭提交须纳入：STATUS/`done`、本工作项记录、`review.md`、`qa-report.md`，以及工作区已有的滚动条主题色优化（`apps/web/src/styles.css`）。**禁止**丢弃该 scrollbar 改动；**禁止**纳入无关 fixture CRLF 噪声。

## 切片（未拆分，sub-feature-id = feature-id）

| sub-feature-id | Spec | Spec 门禁 | Spec 用户确认 | Design 门禁 | UI 表面 | Review 门禁 | 状态 | 后续步骤 |
|---|---|---|---|---|---|---|---|---|
| hex-collapse | [spec.md](../features/hex-collapse/spec.md) | required | approved（2026-07-27「ok」） | skipped（理由：无新模块边界/分层/技术选型；在既有 `apps/web` hex 与结构图交互上增量） | gui | Approve @ 2ab3da5 | done | 用户已授权合并；待 Merge Executor 合入 main；合入后归档 |

阻塞原因: none
恢复条件: N/A
恢复后的目标状态: N/A

## 门禁判定理由

- 路径等级 `standard`：既有页查看器上的 GUI 交互增强；非从零能力/跨模块架构，但存在**新交互行为合同**与公开 UI 语义，超出 `fast` 单点修复。
- Spec 门禁 `required`：新增 HEX 内 free-space 折叠及与左侧联动等行为合同；现含「始终折叠 / 取消展开」对前序 page-diagram-32b Q5 切换语义的显式修订。
- Spec 用户确认 **approved**（2026-07-27）：用户确认修订稿全文。
- Plan 用户确认 **approved**（2026-07-27「ok」）。
- Design 门禁 `skipped`：预期仍为纯前端、不改 `page-core`；无分层或选型争议。**不要求** `ui-design.md`。
- UI 表面 `gui`：面向最终用户的图形界面。主题/深色模式沿用既有合同，本项不默认扩展主题范围。
- Review 门禁 `required`：`standard` 强制 Reviewer `Approve` 后方可进 QA。
- 源分支 / 目标分支：`hex-collapse` → `main`（调度 Developer 前已填写）。

## 进度笔记

- 2026-07-27：Manager 登记 `hex-collapse`；路径 `standard`；Spec/Review required；Design skipped；UI `gui`；源分支 `hex-collapse` → 目标 `main`。识别 A/B 折叠语义歧义；**单步编排停在用户澄清**，暂不调度 Analyst。注明与 `fix-dev-web-page-core`（待合入 main）关系；不擅自合并。
- 2026-07-27：用户确认产品澄清：范围 **B**；仅折叠 free space 且与左侧联动；保留双向高亮与自动滚动。状态 `backlog` → `speccing`；调度 Analyst 编写 Spec。
- 2026-07-27：Analyst 产出 `docs/features/hex-collapse/spec.md`（10×P0；开放 Q1 hex 侧控件、Q2 选中是否自动展开）。状态 `speccing` → `awaiting-spec-approval`。确认前不调度 Planner。
- 2026-07-27：用户对 Spec 提出实质修订：取消 free 展开态与 Expand 控件；始终折叠/断裂带；选中仅高亮断裂带。状态 `awaiting-spec-approval` → `speccing`；调度 Analyst 修订 Spec；修订稿仍须用户确认后才可进 Plan。
- 2026-07-27：Analyst 就地修订 `spec.md`（12×P0 + 1×P1；关闭 Q1/Q2；覆盖 page-diagram-32b Q5）。状态 `speccing` → `awaiting-spec-approval`。确认前不调度 Planner。
- 2026-07-27：用户「ok」批准修订后 Spec。状态 `awaiting-spec-approval` → `planning`；调度 Planner 编写 `plan.md`（无 ui-design）。Plan 确认前不调度 Developer。
- 2026-07-27：Planner 产出 `docs/features/hex-collapse/plan.md`（T1–T9）。状态 `planning` → `awaiting-plan-approval`。确认前不调度 Developer。
- 2026-07-27：用户「ok」批准 Plan。状态 `awaiting-plan-approval` → `planned` → `developing`；调度 Developer（源分支 `hex-collapse` ← `main`）。
- 2026-07-27：Developer 完成 T1–T9（分支 `hex-collapse`，commit `2ab3da5`）；L2 验证 Pass；`dev-notes.md` 已写。状态 `developing` → `reviewing`；调度 Reviewer。
- 2026-07-27：Reviewer **Approve**（`review.md`，相对 `2ab3da5`；未提交）。状态 `reviewing` → `qa`；调度 QA。
- 2026-07-27：QA **Pass**（`qa-report.md` 未提交）。等待用户合并授权：`hex-collapse` → `main`。授权后 Manager 置 `done` 并与未入库 review/qa 报告一次提交，再由 Merge Executor 合入。**未合并。**
- 2026-07-27：用户「ok」授权合并。状态 `qa` → `done`。源分支关闭提交纳入 STATUS/工作项/`review.md`/`qa-report.md` + scrollbar 样式（`styles.css`）；排除 fixture CRLF。调度 Merge Executor 合入 `main`；合入后归档。

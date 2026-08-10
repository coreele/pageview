# 工作项记录: pg-page-viewer

工作项标识: pg-page-viewer
描述: PostgreSQL heap 表页内部结构可视化网页应用。连接真实 PG，经 pageinspect `get_raw_page()` 实时浏览；本地工具部署模型；含 infomask 逐位解读、tuple 列值解码、HOT 链/ctid 追踪、DML 前后刷新对比、hex dump 联动视图。第一版仅 heap 表页。
路径等级: full
源分支: pg-page-viewer
目标分支: main
文档影响: 已归档至 `workflow/docs/archive/2026/pg-page-viewer/`（原 `workflow/docs/features/pg-page-viewer/`：spec.md、design.md、ui-design.md、plan.md、dev-notes.md、review.md、qa-report.md）；项目 README 与部署/使用说明随实现产出

> 权威工作流、门禁与状态说明见 manager 规范。
> 活跃状态见 [STATUS.md](STATUS.md)。
>
> 文档路径（已归档）：`workflow/docs/archive/2026/pg-page-viewer/spec.md` 等。

## 切片（未拆分，sub-feature-id = feature-id）

| sub-feature-id | Spec | Spec 门禁 | Spec 用户确认 | Design 门禁 | UI 表面 | Review 门禁 | 状态 | 后续步骤 |
|---|---|---|---|---|---|---|---|---|
| pg-page-viewer | [spec.md](../archive/2026/pg-page-viewer/spec.md) | required | approved | required | gui | required | done | 已合入 main 并归档；无后续 |

阻塞原因: none
恢复条件: N/A
恢复后的目标状态: N/A

## Spec 用户确认（2026-07-26）

结论: 批准 Spec（采纳下列裁决与范围补充后）。

开放问题裁决:
1. PG 主版本: 以 PostgreSQL 16.11 为文档声明与测试夹具基准（可写「以 16.11 验证；兼容同主版本系列」）。
2. 连接入口: 支持环境变量（UI 必填路径保留；env 可选，明确为「支持 env」）。
3. pageinspect 缺失: 仅提示用户自行安装/启用；禁止应用代执行 `CREATE EXTENSION`。
4. 跨页 HOT/ctid: 默认仅标注跨块；允许用户点击后再加载目标页（标注 + 点击加载）。行为合同须写清；优先级合理判定（建议可交互加载为 P0 或明确 P1）。
5. 系统表: 仅用户表（不列 `pg_catalog` 等）。

范围补充（必须写入 Spec，不可仅笔记）:
- 空洞压缩（free space visual compression）: 真实页 8KB；当 tuple 少、物理占用小时，结构图中大片 free space 不得按真实比例占满视口。须对空洞/大片空白做可视化压缩（或等价布局策略），在仍能表达 `pd_lower`/`pd_upper` 与增长方向的前提下，优先保证 header、ItemId、tuple 与交互可读性。至少一条 Given-When-Then 验收。

> 注（2026-07-26 回退）：上述批准仅覆盖当时范围（P0-1..P0-12、P1-1..P1-3）。因新增 UI/UX 需求，`Spec 用户确认` 已重置为 `required`；既有条目语义不得删改，增量条款须重新确认。

## Spec 用户确认（2026-07-26，增量 UI/UX）

结论: 批准增量 Spec（外观与主题、基础元信息、UI/UX 质量范围与合同；验收 P0-13..P0-20、P1-4）。既有 P0-1..P0-12 / P1-1..P1-3 语义保留。Analyst 已将裁决写入 `spec.md` 并关闭开放问题；`Spec 用户确认` → `approved`。

开放问题裁决（全部采纳 Analyst 建议）:
1. 默认主题: 跟随系统 `prefers-color-scheme`；无法读取时默认 light。不改为固定 light/dark。
2. 主题跨会话记忆: 第一版不强制，保持 P1-4；不升为 P0。
3. tuple 计数定义: 等于 NORMAL ItemId 对应的 HeapTuple 条数。
4. PG 版本展示粒度: 展示服务端报告的完整版本串。
5. 元信息必显清单: 全部采纳 Analyst 推荐必显表（连接 host/port/database/user 不含密码、完整 PG 版本串、表限定名+OID、blkno、总块数、页大小、`pd_lower`/`pd_upper`/free space 字节、ItemId 总数与各 LP 状态计数、tuple 计数按第 3 条定义）。无降级、无增补。

## Plan 用户确认（2026-07-26）

结论: 批准 Plan（`workflow/docs/features/pg-page-viewer/plan.md`，含 T1–T11、依据 ui-design、验收映射含 P0-13..P0-20）。状态 `awaiting-plan-approval` → `planned`。

## 门禁判定理由

- 路径等级 `full`：全新能力（从零建应用），范围与合同尚未落成文档。
- Spec 门禁 `required` 且用户确认 `required`：`full` 强制。
- Design 门禁 `required`：模块边界（core 解析包 / 后端薄代理 / 前端）、技术选型（Fastify+pg、React+Vite、浏览器侧解析）需正式决策。
- UI 表面 `gui`：面向最终用户的图形界面；Design=`required` 且表面为 gui，故 Planner 在 Plan 前须调用 `design-ui` 产出 `ui-design.md`。主题/深色模式是否需要由 Spec 决定（本项用户已明示要求深色模式）。
- Review 门禁 `required`：`full` 强制。
- 未拆分：单一应用首版，范围可控，无需拆分。

## 进度笔记

- 2026-07-26: 登记工作项，路径等级 full，门禁判定完成。工作区非 Git 仓库：提交/合并操作跳过；建议在调度 Developer 前初始化 Git 并补填分支信息。状态 backlog → speccing，调度 Analyst 编写 Spec。
- 2026-07-26: Analyst 完成 `workflow/docs/features/pg-page-viewer/spec.md`（176 行）。Spec 含 5 项开放问题（均有默认建议）：PG 版本范围（默认 14+）、连接入口是否支持环境变量（默认 UI 必填 + env 可选）、是否代执行 CREATE EXTENSION（默认否）、跨页 ctid 是否自动加载（默认否）、是否列出系统表（默认否）。状态 speccing → awaiting-spec-approval，等待用户确认 Spec（full 强制）。
- 2026-07-26: 用户批准 Spec，并给出 5 项开放问题裁决 + 空洞压缩范围补充。状态 awaiting-spec-approval → speccing，调度 Analyst 修订 spec.md（关闭开放问题、同步合同/验收、纳入空洞压缩）。
- 2026-07-26: Analyst 完成 Spec 修订（开放问题全部关闭；跨块点击加载 P0-6；空洞压缩 P0-11；env 连接 P0-12）。Spec 用户确认 → approved。状态 speccing → designing。调度 Planner：先 design.md（Design 门禁 required），再 plan.md。工作区仍非 Git；调度 Developer 前须 init Git 并补填源/目标分支。
- 2026-07-26: Planner 完成 `design.md`（160 行）与 `plan.md`（172 行）。Design 定稿：pnpm 三包（page-core / server / web）、浏览器侧解析、env 启动自动建连且 UI 可覆盖、空洞压缩在 web 布局层。Plan：T1–T10。状态 designing → planning（短暂）→ awaiting-plan-approval。等待用户确认 Plan。工作区仍非 Git。
- 2026-07-26: **Spec 回退登记**（用户新增 UI/UX 需求）。切片补填 `UI 表面: gui`（切片表对齐新版 manager-feature 模板）。状态 `awaiting-plan-approval` → `speccing`；`Spec 用户确认` `approved` → `required`（新增范围须重新确认）。治理层已引入 `design-ui` Skill、`workflow/docs/standards/ui.md`、`UI 表面` 字段（无独立 UX 门禁；light/dark 非全局强制，本项由 Spec 明确要求）。既有已批准语义（P0-1..P0-12、P1-1..P1-3）不得删改；Analyst 增量补充：深色模式（可验证验收含主题切换与默认主题）、基础元信息字段清单与可见性、对齐 `workflow/docs/standards/ui.md` GUI 底线的可验证 UI/UX 条款（续编号如 P0-13 起）。现有 `design.md` / `plan.md` 因 Spec 变更须在 Spec 重新确认后由 Planner 修订；届时 Planner 须调用 `design-ui` 产出 `ui-design.md`。调度 Analyst 修订 Spec。工作区仍非 Git。
- 2026-07-26: Analyst 完成 Spec 增量修订（[analyst](079908a9-00a1-4e25-ae71-ad996b333619)）：新增外观与主题、基础元信息可见性、UI/UX 质量三节；验收 P0-13..P0-20、P1-4；新增 5 项开放问题。既有 P0-1..P0-12 / P1-1..P1-3 语义保留。状态 `speccing` → `awaiting-spec-approval`。等待用户确认增量 Spec 与开放问题裁决。单步模式：不调度 Planner。
- 2026-07-26: 用户批准增量 Spec（P0-13..P0-20、P1-4 及外观/元信息/UI·UX 范围与合同），并对 5 项开放问题全部采纳 Analyst 建议。状态 `awaiting-spec-approval` → `speccing`。调度 Analyst 修订 `spec.md`（关闭开放问题、同步范围/合同/验收正文、去掉「待确认」措辞；不得删改既有 P0-1..P0-12 / P1-1..P1-3）。单步模式：本步完成后进入 `designing`，不连续调度 Planner。
- 2026-07-26: Analyst 完成 Spec 修订（[analyst](9ad80e62-9cc5-45a7-bb0f-210e6a5e553f)）：开放问题全部关闭并写入正文；确认门禁改为已确认。Spec 用户确认 → approved。状态 `speccing` → `designing`。单步模式：不调度 Planner；等待用户授权后再调度 Planner（修订 design/plan，产出 ui-design.md）。工作区仍非 Git。
- 2026-07-26: 用户授权调度 Planner。状态保持 `designing`，调度 [planner](b3c2757c-07b4-4f33-9655-b56412c8cd2c)：修订 design.md、产出 ui-design.md、修订 plan.md。单步模式：Planner 完成后停在 Plan 确认门禁，不调度 Developer。
- 2026-07-26: Planner 完成 Design/UI Design/Plan 修订。`design.md` 增量：主题仅前端、元信息多源（含 `serverVersion`）。新建 `ui-design.md`（Context strip、light/dark、键盘与状态矩阵）。`plan.md` 扩为 T1–T11（新增 T8 元信息；原 T8–T10 顺延），验收映射含 P0-13..P0-20、P1-4。状态 `designing` → `planning`（短暂）→ `awaiting-plan-approval`。等待用户确认 Plan。工作区仍非 Git；调度 Developer 前须 init Git 并补填源/目标分支。
- 2026-07-26: **Plan 用户确认**（用户确认 `workflow/docs/features/pg-page-viewer/plan.md`，含 T1–T11、ui-design、P0-13..P0-20）。状态 `awaiting-plan-approval` → `planned`。工作区现已是 Git 仓库：当前在 `main`，**尚无任何 commit**（`.cursor/**` 已 staged；`docs/` 仍 untracked）。已补填目标分支 `main`、源分支 `pg-page-viewer`。按 `workflow/docs/standards/git.md`：须在目标分支有基线 commit 后，再由 Developer 自 `main` 创建源分支实施。本步不调度 Developer、不执行 `git commit`（提交须由当前用户会话明确授权）。下一步：等待用户授权「初始提交」和/或「调度 Developer」。
- 2026-07-26: 用户授权调度 Developer。分支前置条件核验通过：`main` 已有基线 commit `2b83f71`（`.cursor/` + `docs/`），工作树干净；源分支 `pg-page-viewer` 尚未创建，由 Developer 自 `main` 创建并检出后实施。工作项记录分支字段（源 `pg-page-viewer` / 目标 `main`）与 STATUS 一致。状态 `planned` → `developing`，调度 Developer 实施 Plan T1–T11。注：`plan.md` 中「工作区非 Git / Git 规范 N/A」为 Plan 定稿时的事实，现已过时——仓库已初始化，实施须遵守 `workflow/docs/standards/git.md`（源分支实施、Conventional Commits、分波次提交）；此为事实更新，不改变 Plan 合同，Developer 不得改写 Plan。单步模式：Developer 完成后按证据更新状态并返回，**不**连续调度 Reviewer。
- 2026-07-26: **合并授权请求驳回（过早）**。用户发出「允许合入」，但当前状态 `reviewing`：Review 门禁 `required` 尚未取得 Reviewer `Approve`（`review.md` 不存在），QA 未执行（`qa-report.md` 不存在），且存在已登记的 L3 证据缺口（QA `Pass` 前必须补齐）。按 manager 规范「QA 未达到 `Pass` 不得请求合并授权」，本次授权**不予采纳、不留作预授权**——QA `Pass` 后须由当前用户会话重新明确授权合并。状态保持 `reviewing`，不执行任何合并。下一步：等待用户授权调度 Reviewer。
- 2026-07-26: **用户授权调度 Reviewer**（回复「ok」）。状态保持 `reviewing`，调度 Reviewer 审阅源分支 `pg-page-viewer`（相对 `main` 的实现差异 + Plan T1–T11 / Spec / design / ui-design / dev-notes）。Review 门禁 `required`：须取得 `Approve` 后方可进入 QA。按 `git.md` §1.4，Reviewer **只写不提交** `review.md`。单步模式：Reviewer 完成后按结论更新状态并返回，**不**连续调度 QA/Developer。
- 2026-07-26: Reviewer（[reviewer](a9f2f15d-2121-4eb8-af94-6ad01ead2e11)）完成审阅。版本：`pg-page-viewer` @ `1c7dfc6`。结论：**Request changes**。阻塞项 **R1**：`apps/server/src/app.ts` `GET /api/tables/:oid/schema` 对 `pg_type` 使用 INNER JOIN，丢弃 `attisdropped`（`atttypid=0`）列，违反 Spec / P1-3（含 DROP 时亦破坏 P0-4）。L3/UI 证据缺口独立判定为**不**阻塞 Review，但阻塞 QA Pass。报告：`workflow/docs/features/pg-page-viewer/review.md`（未提交）。状态 `reviewing` → `developing`。单步模式：**不**自动调度 Developer；等待用户授权后调度 Developer 修 R1（+回归测），再 Reviewer 复审。按 `git.md` §1.4，Request changes 退回时可将报告与状态一并提交，本步暂不单独提交，留待关闭窗口或用户另行授权提交。
- 2026-07-26: **用户授权 Reviewer 复审**（回复「ok」）。Manager 核验：源分支仍为 `pg-page-viewer`，HEAD `1c7dfc6`；修复变更目前在工作区未提交（含 `apps/server/src/catalog.ts` LEFT JOIN/`pg_relation_size`、`app.ts`/`index.ts` 死锁路径、`integration-smoke` R1 DROP COLUMN、`apps/server/tests/`、`dev-notes.md` QA 修复回执）。状态 `developing` → `reviewing`，立即调度 Reviewer 复审：重点核验 R1 已关，并审阅 blocks（`pg_relation_size/8192`）与 connect 死锁相关变更。按 `git.md` §1.4，Reviewer 只写不提交 `review.md`。单步模式：复审完成后按结论更新并返回，**不**连续调度 QA/Developer。
- 2026-07-26: Reviewer 复审（[reviewer](bf65201b-5426-493b-8a96-c5cb2eeb1bcc)）结论：**Approve**。版本：`pg-page-viewer` @ `1c7dfc6` + 工作区未提交修复。R1 **closed**（LEFT JOIN + 可失败单元回归 + integration DROP COLUMN 通过）。blocks/`pg_relation_size` 与 connect 死锁修复无新阻塞。报告已更新 `workflow/docs/features/pg-page-viewer/review.md`（未提交）。Review 门禁 `required` **已满足**。状态保持 `reviewing`（单步：不自动进 QA）。浏览器 P0-13..P0-20 等证据缺口仍**阻塞 QA Pass**（不回退 Approve）。下一步：等待用户授权调度 QA。注：修复代码与 review.md 仍未入库；调度 QA 前建议由当前用户会话授权在源分支提交修复（或由 Developer 提交），以免 QA 基于不稳定工作树。
- 2026-07-26: **用户授权调度 QA**（回复「ok」）。入口门禁核验：Plan 已确认；Review 结论 Approve（复审）；源/目标分支已记录（`pg-page-viewer` → `main`）。用户未授权 commit：修复与 `review.md` 仍在工作区未入库，QA 须验收含工作区变更的当前树，**Manager 不擅自 commit**。状态 `reviewing` → `qa`，立即调度 QA 独立验收并产出 `qa-report.md`（只写不提交）。已知 P0-13..P0-20 等可能阻塞 Pass——由 QA 如实判定。单步模式：QA 完成后按结论更新并返回；`Pass` 后须再请求合并授权，**不**自动合并。
- 2026-07-26: QA（[qa](7486d02f-a755-4acb-9147-29a3716e52bf)）首轮结论：**Pass**。验收版本：`pg-page-viewer` @ `1c7dfc6` + 工作区未提交修复。覆盖：L2/L3、Spec P0/P1（含浏览器 P0-13..P0-20、跨块 P0-6、R1 DROP）、文档/安全/UI。缺陷/阻塞：none。报告：`workflow/docs/features/pg-page-viewer/qa-report.md`（未提交；按 `git.md` §1.4 待合并授权窗口**禁止**单独提交报告）。状态保持 `qa`。下一步：**请求用户合并授权**（`pg-page-viewer` → `main`）。授权后 Manager 置 `done`，并将 STATUS/工作项记录与未入库 `review.md`/`qa-report.md`（及尚未入库的修复代码，若仍未提交）按流程一次整理提交后合入；本步不合并。
- 2026-07-26: **用户合并授权**（回复「ok」，源 `pg-page-viewer` → 目标 `main`）。门禁核验：Plan 已确认；Review Approve；QA Pass；分支已记录；用户明确授权。状态 `qa` → `done`。按 `git.md` §1.4：在源分支先提交未入库修复代码，再将 STATUS/`done`、工作项记录与 `review.md`/`qa-report.md` 一次关闭提交（**不**提交 `.env`）。随后调度 QA 兼任 Merge Executor 合入 `main`；合入后归档 Feature 目录。Manager **不**亲自执行 merge。
- 2026-07-26: 关闭提交：`5c40139` fix(server) R1/blocks/connect；`a58e30d` docs done + review/qa。Merge Executor（[qa](991cc733-4be4-4525-9abd-dbe7ebaafc30)）本地 **fast-forward** 合入成功：`main` = `pg-page-viewer` = `a58e30d`；未 push；未提交 `.env`。父项归档：`workflow/docs/features/pg-page-viewer/` → `workflow/docs/archive/2026/pg-page-viewer/`；STATUS 活跃列表清空并记入归档区。
- 2026-07-26: Developer（[developer](bf36c20f-2b92-453f-982c-ab736b3d9d6b)）完成实施。Manager 独立核验：当前分支 `pg-page-viewer`（非 `main`），领先 `main` 5 个 Conventional Commits（`aa4cf7e` 脚手架 / `ce1c6c4` page-core / `6995b38` server / `2e69975` web / `1c7dfc6` README+dev-notes）；`dev-notes.md` 已产出；`spec.md`/`design.md`/`ui-design.md`/`plan.md`/`workflow/docs/manager/**` 未被 Developer 改动。任务完成度：T1–T3、T5–T10 完成（含 P1-4 主题记忆）；T4 部分完成（仓库夹具为合成页，非 PG 16.11 实采，采集脚本与流程已文档化）；T11 部分完成（README + dev-notes 完成，L3 与 UI 手测未做）。验证证据：L2 通过（`page-core` 10 tests、`pnpm -r typecheck`、`pnpm -r build`）；`server test:integration` 阻塞 exit 2（无 `.env`/`DATABASE_URL`/`PG*`，无可调用 `get_raw_page` 的会话）。**达到 L2，未达 Plan 声明的最低 L3**。已知证据缺口（不阻塞 Review，但 **QA `Pass` 前必须补齐**）：P0-1/2/6/7/10/12 等实库项、P0-13..P0-20 浏览器手测、实页 HOT/跨块夹具；恢复条件与复测范围见 `dev-notes.md`。状态 `developing` → `reviewing`。按 `git.md` §1.1/§1.4，本次 STATUS 与工作项记录变更**暂不单独提交**，留待关闭窗口一次提交。单步模式：**不**调度 Reviewer，等待用户授权。

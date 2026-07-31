# 工作项记录: wal-viewer

工作项标识: wal-viewer
描述: 在现有 pg-page-viewer（heap page 可视化）上新增 WAL 模式：顶部 chrome 提供 Page / WAL 模式切换；WAL 与 Page 的 UI/数据路径分开。WAL 主视图为一批 record 列表（一行一条），展示更宽的元数据行（LSN、resource manager、record type、长度等）；v1 不做原始字节 hex；含 FPI 的 record 默认折叠。数据来自 `pg_walinspect` 结构化信息（PG15+）。
路径等级: full
源分支: wal-viewer
目标分支: main
文档影响: README / README.zh-CN 需说明 WAL 模式与 PG15+/`pg_walinspect` 依赖；feature 文档按流程产出于 `docs/features/wal-viewer/`（spec、design、ui-design、plan、dev-notes、review、qa-report）。

> 权威工作流、门禁与状态说明见 [docs/README.md](../README.md)。
> 活跃状态见 [STATUS.md](STATUS.md)。
>
> 文档路径：`docs/features/wal-viewer/spec.md`（未拆分，无子目录）。

## 产品共识（用户口头确认 · 写入供 Analyst Spec 使用；不得擅自扩大范围）

1. **模式**：顶部 chrome 增加 Page / WAL 模式切换；Page 与 WAL UI/数据路径分开。
2. **WAL 主视图**：一批 record 列表（**一行一条 record**），更宽的元数据行（LSN、resource manager、record type、长度等）；**不要硬套** page 的 32B/行 grid（那是 page 结构图↔hex 对齐用的）。
3. **交互**：点击一条 record 可选中；v1 **hex dump 暂不可用**（占位或说明即可）。数据来自 `pg_walinspect` 结构化信息（PG15+），不是反向拼 hex。
4. **FPI**：若 record 含 FPI，**默认折叠**（只显示长度/标记）；避免未压缩 8KB 撑爆列表。展开也仅元信息，不渲染 8KB 内容。
5. **Hex**：Page 侧仍是 `get_raw_page` 原始字节；WAL v1 不做原始字节 hex。将来 PG17+ `pg_get_wal_block_info` 或其它路径再增强，**不在本工作项 v1 范围**。
6. **定位**：同一 monorepo；可复用 `apps/server` / `apps/web`；解析可新建 `packages/wal-core` 或等价方案（具体边界留给 Design/Plan，Manager 只记需求方向）。
7. **依赖**：WAL 路径最低 **PostgreSQL 15+** + `pg_walinspect`；扩展由用户自行 `CREATE EXTENSION`，应用不代建（与现有 pageinspect 约定一致）。

## 切片（未拆分，sub-feature-id = feature-id）

| sub-feature-id | Spec | Spec 门禁 | Spec 用户确认 | Design 门禁 | UI 表面 | Review 门禁 | 状态 | 后续步骤 |
|---|---|---|---|---|---|---|---|---|
| wal-viewer | [spec.md](../features/wal-viewer/spec.md) | required | approved | required | gui | required | developing | 用户目视确认 UI 打磨；Developer 提交 → Review → QA 轮次 5；Pass 后再请求合并授权 |

阻塞原因: none
恢复条件: N/A
恢复后的目标状态: N/A

## Spec 用户确认（2026-07-30）

结论: 批准整份 Spec（`docs/features/wal-viewer/spec.md`）。`Spec 用户确认` → `approved`。

开放问题裁决:
1. **LSN 预填**：**采纳默认** — 必填 start/end LSN；可一键填入当前 WAL LSN；进入 WAL 模式时**不**自动盲拉大范围。
2. **批次过大**：**硬错误** — 结果过大时明确失败；**不要**截断或部分结果。阈值由 Design/Plan 选定。
3. **connect 扩展校验**：**采纳默认** — 不强制 `pageinspect` 与 `pg_walinspect` 两者皆有；按模式分别校验（Page → pageinspect；WAL → pg_walinspect + PG15+）。

## Plan 用户确认（2026-07-30）

结论: 批准 Plan（`docs/features/wal-viewer/plan.md` 全文）。用户回复「ok」。状态 `awaiting-plan-approval` → `planned` →（调度 Developer）`developing`。

确认范围（全部采纳）:
1. 硬阈值 **R1≤2000 / R2≤2MiB / R3≤16MiB**（禁截断/部分结果）
2. **connect 门禁迁移**（按模式校验扩展；不强制两者皆有）
3. 任务 **T1–T6**
4. 源分支 **`wal-viewer`** → 目标 **`main`**（禁止在 main 直接实施）

## 产品变更：Fill current LSN → recent window（2026-07-30）

结论: 用户回复「ok」，批准未合并前修订「填入当前 LSN」行为。合并授权**尚未**给予。状态 `qa`（Pass）→ `speccing`（修订 Spec/Design/Plan 后实施并复审/回归）。

新行为（合同增量，不得擅自扩大）:
1. **end LSN** = `pg_current_wal_lsn()`（current tip）
2. **start LSN** = 基于 tip 向前推算，使区间大约包含 **最近 ~20 条** WAL record（不足 20 则有多少给多少）
3. Fill **仍不自动 Load**；填入可用窗口后，用户点 Load 应看到最新约 20 条，**不是** tip 点查 Empty batch
4. 建议服务端 recent-window 能力（如 `GET /api/wal/recent-window?limit=20`，或扩展 current-lsn 返回 `{ startLsn, endLsn, count }`）；启发式扩窗；若结果 &gt;20 则取尾 20 并把 start 回填为该批最早 record 的 start_lsn；遵守 R1/R2/R3，禁截断假成功；已删段可读错误

既有裁决保留：必填 start/end、不盲拉、批次硬错误、按模式扩展校验。P1-2 及可见行为须随 Spec 修订；Design/Plan 轻改后实施。

## 门禁判定理由

- 路径等级 `full`：新能力（WAL 模式）、跨模块（web/server/可能新包）、范围需 Spec 固化。
- Spec 门禁 `required`；Spec 用户确认现为 `approved`（2026-07-30）。
- Design 门禁 `required`：Page vs WAL 模块边界、`wal-core` vs 扩展 page-core、API 分层需正式决策。
- UI 表面 `gui`：面向最终用户的图形界面；Design=`required` 且表面为 gui，故 Planner 在 Plan 前须调用 `design-ui` 产出 `ui-design.md`。主题/深色模式是否需要由 Spec 决定，不因存在 GUI 而默认强制。
- Review 门禁 `required`：`full` 强制。
- 未拆分：单一 WAL 模式 v1，共识范围可控，无需拆分。
- 分支：目标 `main`；源 `wal-viewer`（未拆分，source ≈ feature-id）。调度 Developer 前须在源分支实施。

## 进度笔记

- 2026-07-30: 登记工作项 `wal-viewer`。用户已口头确认产品方向（见「产品共识」）；正式走工作流（`/manager do it`）。路径 `full`；门禁 Spec/Design/Review 均为 required；UI 表面 gui；源分支 `wal-viewer` → 目标 `main`。状态 backlog → speccing。单步编排：调度 Analyst 编写 Spec；完成后进入 `awaiting-spec-approval`，不越过 Spec 用户确认。
- 2026-07-30: Analyst（[analyst](296fe3c9-ee11-47ae-aa26-a6484cb6e3e7)）完成 `docs/features/wal-viewer/spec.md`（约 200 行；P0×12 / P1×3）。7 条产品共识已固化为合同与验收。开放问题 3 项（均有默认建议）：① LSN 预填（必填起终点；可一键填当前 LSN；不自动盲拉）；② 批次上限（以用户区间为准；过大则硬错误或可见截断，Design 定阈值）；③ connect 扩展校验（不强制两者皆有；按模式分别校验）。主题：不新增 light/dark 条款。状态 `speccing` → `awaiting-spec-approval`。单步模式：停在 Spec 用户确认门禁；不调度 Planner。
- 2026-07-30: **Spec 用户确认**。用户批准整份 Spec；开放问题裁决见上文「Spec 用户确认（2026-07-30）」（LSN 预填采纳默认；批次过大=硬错误非截断；connect 按模式分别校验）。`Spec 用户确认` → `approved`。状态 `awaiting-spec-approval` → `designing`。调度 Planner：Design required + UI gui → `design.md` + `ui-design.md`，再 `plan.md`。单步可连续至 Plan 写出并进入 `awaiting-plan-approval`，不越过 Plan 用户确认。
- 2026-07-30: Planner（[planner](22330478-a3e7-4cfd-9f7c-7596bbe381b4)）完成 `design.md`、`ui-design.md`、`plan.md`。关键决策：新建 `packages/wal-core`；API `GET /api/wal/records` + `GET /api/wal/current-lsn`；connect 仅连通/版本，扩展按模式校验；批次硬阈值 R1≤2000 / R2≤2MiB / R3≤16MiB（禁截断）。Plan T1–T6；源分支 `wal-viewer`。状态 `designing` → `planning`（短暂）→ `awaiting-plan-approval`。单步模式：停在 Plan 用户确认门禁；不调度 Developer。
- 2026-07-30: **Plan 用户确认**（用户回复「ok」）。批准 plan.md 全文（硬阈值、connect 门禁迁移、T1–T6、源 `wal-viewer`→目标 `main`）。状态 `awaiting-plan-approval` → `planned` → `developing`。调度 Developer 在源分支 `wal-viewer` 实施（禁止 main 直接改代码）；完成后写 `dev-notes.md`。单步可连续 Review/QA 一轮，不得越过合并授权。
- 2026-07-30: Developer（[developer](729cc2ee-0ee7-498c-bf59-a38944aa5276)）完成 T1–T6。分支 `wal-viewer` commits：`af53055` wal-core / `207d061` server / `c7ac540` web / `47a15df` docs+dev-notes。L2 全绿；Page L3 OK；WAL L3 阻塞（缺 `pg_walinspect`）。状态 `developing` → `reviewing`。调度 Reviewer；Approve 后进 QA。按 git.md §1.4，Reviewer 只写不提交 `review.md`。
- 2026-07-30: Reviewer（[reviewer](cc1ce7c3-ae54-4b7a-b4d3-cab0567432ff)）结论 **Approve**（`wal-viewer` @ `47a15df`）。无阻塞项；WAL L3/UI 手测缺口交 QA。报告：`docs/features/wal-viewer/review.md`（未提交）。Review 门禁 required **已满足**。状态 `reviewing` → `qa`。调度 QA；Pass 后请求合并授权，**不**自动 done/合并。
- 2026-07-30: QA（[qa](41ea4cec-b632-4aaf-b05a-de3f6b3233b0)）首轮结论 **Fail**。报告：`docs/features/wal-viewer/qa-report.md`（未提交）。**DEF-1**（High）：Fill current LSN（start=end=current）→Load 得 500 INTERNAL，应空列表或可读 BAD_LSN（P1-1/P1-2/P0-11）。**DEF-2**（Medium）：已删 segment 等同弱 nextStep。状态 `qa` → `developing`。调度 Developer 修复；full 路径修复后须重新 Review Approve，再 QA 回归。不请求合并授权。
- 2026-07-30: Developer（[developer](8e4a3467-804f-43cf-aa1e-32fb629b15d8)）修复 DEF-1/DEF-2。commit `4188823`：tip LSN → `200 {records:[]}`；walinspect 区间错误 → `BAD_LSN`+可执行 nextStep。`wal-smoke`/server tests 绿。状态 `developing` → `reviewing`。调度 Reviewer 复审。
- 2026-07-30: Reviewer 复审（[reviewer](db8d0a24-2b90-4505-b774-b7b95a27d5f6)）结论 **Approve**（`wal-viewer` @ `4188823`）。DEF-1/DEF-2 关闭依据成立。报告已更新 `review.md`（未提交）。状态 `reviewing` → `qa`。调度 QA 在同一 `qa-report.md` 追加回归轮次。
- 2026-07-30: QA 回归（[qa](a4193d1b-8d4e-409c-aec1-52de7fc23237)）结论 **Pass**（`wal-viewer` @ `4188823`）。DEF-1/DEF-2 **closed**。报告已追加轮次 2（未提交；待合并授权窗口禁止单独提交）。状态保持 `qa`。**请求用户合并授权**：源 `wal-viewer` → 目标 `main`。授权前不标 `done`、不合并。
- 2026-07-30: **产品变更（未合并前）**。用户「ok」批准改造 Fill current LSN → recent ~20 window（见「产品变更：Fill current LSN → recent window」）。合并授权仍未给予。状态 `qa` → `speccing`。调度 Analyst 修订 Spec（至少 P1-2与相关可见行为）；随后 Planner 轻改 design/ui-design/plan → Developer → Reviewer → QA 回归；再次 Pass 后仍请求合并授权，不标 done、不 merge。
- 2026-07-30: Analyst（[analyst](f05d5ea2-2f85-44e0-93c9-c1ed016a43e8)）完成 Spec 增量修订（Fill → recent ~20；P1-2 更新）。用户产品变更「ok」视为本增量 Spec 已确认（`approved` 保持）。状态 `speccing` → `designing`。调度 Planner 轻改 design/ui-design/plan。
- 2026-07-30: Planner（[planner](3a62e75d-701b-4f67-9cd0-0db10901802c)）轻改 design/ui-design/plan：API `GET /api/wal/recent-window?limit=20`；任务 T3Δ/T5Δ/T6Δ。增量 Plan 随产品变更「ok」视为已确认。状态 `designing` → `planned` → `developing`。调度 Developer 在 `wal-viewer` 实施；完成后 Reviewer → QA；Pass 后仍请求合并授权。
- 2026-07-30: Developer（[developer](08ed1300-4e99-4ae9-a6f4-fc67732d70d6)）完成 T3Δ/T5Δ/T6Δ。commits：`1c4ec07` server recent-window / `996ee8f` web Fill / `6ac260b` docs。L2 绿；wal-smoke recent-window count:20。状态 `developing` → `reviewing`。调度 Reviewer。
- 2026-07-30: Reviewer（[reviewer](a3c2db4d-497e-4f9f-a7b1-183a12912d38)）结论 **Approve**（`wal-viewer` @ `6ac260b`）。recent-window/Fill 增量无阻塞。报告已更新（未提交）。状态 `reviewing` → `qa`。调度 QA 回归（重点 P1-2；抽查原 P0）。
- 2026-07-30: **恢复中断工作流**。门禁核验：Plan/增量产品变更已确认；Review Approve @ `6ac260b`；源 `wal-viewer`；`qa-report.md` 尚无 recent-window 回归轮次。状态保持 `qa`，立即调度 QA 追加轮次 3（P1-2 + recent-window 契约 + P0 抽查）。Pass 后请求合并授权；不标 done、不 merge、不单独提交报告。
- 2026-07-30: QA 轮次 3（[qa](21b76482-da9f-4f2a-b0e8-68863f1af3f6)）结论 **Pass**（`wal-viewer` @ `6ac260b`）。P1-2 recent-window API + Fill→不自动 Load→约 20 条 UI 已实锤；DEF-1/2 未回退；无新缺陷。报告已追加轮次 3（未提交；待合并授权窗口禁止单独提交）。状态保持 `qa`。**请求用户合并授权**：源 `wal-viewer` → 目标 `main`。授权前不标 `done`、不合并。
- 2026-07-30: **产品变更（未合并前 · UI 列布局）**。用户要求 WAL 列表：仅显示 **start / end LSN**，**不显示 prev**；**xid 提前为第二列**（API 仍可透出 prev）。合并授权仍未给予。状态 `qa` → `developing`。轻改 `ui-design.md` + Web 实现 → Review → QA；Pass 后再次请求合并授权。
- 2026-07-30: 实现列表列布局（commit `5690895`）：行内仅 start→end；xid 为第二列；`ui-design`/`spec` 已对齐。状态 `developing` → `reviewing`。调度 Reviewer；Approve 后 QA 回归（抽查列布局 + 不回退 P1-2）。
- 2026-07-30: Reviewer（[reviewer](f52c5fca-f913-4956-93b5-3a7297d79394)）结论 **Approve**（`wal-viewer` @ `5690895`）。列布局无阻塞。报告已更新（未提交）。状态 `reviewing` → `qa`。调度 QA 轮次 4（列布局 + P1-2 抽查）。
- 2026-07-30: QA 轮次 4（[qa](19875afd-fbfa-471d-83d6-b9b6e41ecfc1)）结论 **Pass**（`wal-viewer` @ `5690895`）。列布局实锤：列表仅 start→end、无 prev、xid 第二列；P1-2 抽查通过（Fill 不自动 Load，Load 20 条）。无新缺陷。报告已在同一 `qa-report.md` 追加轮次 4（未提交；待合并授权窗口禁止单独提交）。状态保持 `qa`。**请求用户合并授权**：`wal-viewer` → `main`；授权前不标 `done`、不合并。
- 2026-07-31: **用户目视审阅 UI 打磨并同意继续**（「视觉效果我已审阅，同意继续」）。**非**合并授权（未给出字面 merge/合入 main）。事实：HEAD 仍为 `5690895`；其后有大量未提交 UI 增量（`App.tsx` / `WalView.tsx` / `styles.css`：表头字段表、recent 20 一键填窗+Load、Load 新旧差异高亮、Collapse detail、外框圆角卡片、表头/选中/diff 配色等）。QA Pass 后未入库实现 → **不得**直接合入。状态 `qa` → `developing`。调度 Developer：在源分支 `wal-viewer` **仅提交**上述 web UI 打磨；排除 `_qa-*`、`test-results/`、`packages/page-core/fixtures/*` 噪声；**禁止**单独提交 `review.md`/`qa-report.md`。提交后更新 `dev-notes.md` → Reviewer Approve → QA 追加轮次 5（抽查 UI + 不回退 P1-2/recent 20）→ Pass 后再请求合并授权。

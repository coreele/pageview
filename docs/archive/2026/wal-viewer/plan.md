# Plan: wal-viewer

## 元信息

- 工作项标识: wal-viewer（sub-feature-id = wal-viewer，未拆分）
- 依据 Spec: docs/features/wal-viewer/spec.md
- 依据 Design: docs/features/wal-viewer/design.md
- 依据 UI Design: docs/features/wal-viewer/ui-design.md（`UI 表面: gui`）
- 路径等级: full
- Review 门禁: **required**（进入 QA 前须 Reviewer `Approve`）
- 源分支: `wal-viewer` → 目标: `main`（**禁止在 main 直接实施**）
- 最低验证层: **L3** — Spec 成功标准依赖真实 `pg_walinspect`（P0-2/6/7、**P1-2 recent-window** 等）；`wal-core` 阈值/映射单测为 L2 基线；UI 对照 `ui-design.md` 手测补证。无 PG15+/扩展时仅宣称 L2，实库 P0/P1-2 记阻塞与恢复条件
- **Plan 确认**：**增量已随 2026-07-30 产品变更确认**（用户「ok」Fill → recent ~20）。**勿再等待**另一次 Plan 确认门禁；Manager 持久化后即可 `planned` → 调度 Developer。
- 验证命令:

```bash
# L2 — wal-core（无 PG 亦可）
pnpm --filter wal-core test
pnpm --filter wal-core typecheck

# L2 — 回归既有 page-core / server 单测 + 全仓类型
pnpm --filter page-core test
pnpm --filter server test
pnpm -r typecheck

# L3 — 实库（需 PostgreSQL ≥15 + 已 CREATE EXTENSION pg_walinspect；Page 回归另需 pageinspect）
#   连接 → GET /api/wal/recent-window?limit=20 → 断言 {startLsn,endLsn,count}；count≈min(20,可用)
#   → GET /api/wal/records?startLsn&endLsn（用上一步窗口）→ 列表条数与 count 一致；非 tip 点查空
#   超 R1/R2/R3 → WAL_BATCH_TOO_LARGE 且无部分 records
#   缺扩展 / PG<15 / 已删段 → 明确错误；进程内无 CREATE EXTENSION
# UI 手测：Fill「填入最近窗口」不自动 Load → Load 见约 20 条；模式切换；FPI；hex 占位；Page hex；错误可读
```

## 适用工程规范

- [文档工程](../../standards/documentation.md)
- [Git 协作](../../standards/git.md)
- [质量与验证](../../standards/quality.md)
- [安全](../../standards/security.md)
- [UI/UX](../../standards/ui.md)

## 目标摘要

按已确认 Spec 与 Design，在源分支 `wal-viewer` 交付 WAL 模式（T1–T6 **已完成**基线）。**本轮增量**：实现 `GET /api/wal/recent-window`（启发式扩窗、>limit 取尾回填 start、遵守 R1/R2/R3、已删段可读错误）；UI Fill 改为「填入最近窗口」（非 tip 双填、不自动 Load）；Load 后见约 20 条（P1-2）。硬阈值与 connect 按模式校验不变。

完成定义：P0 保持；**P1-2 新行为可演示**；`dev-notes.md` 记本增量验证；Review **重新 Approve** 后方可交 QA 回归。

**UI/UX:** 见 `ui-design.md`（非 N/A）。

## 任务拆解

> T1–T6 已在 `wal-viewer` 落地。下列 **T3Δ / T5Δ / T6Δ** 为本产品变更增量；未改动的 T1/T2/T4 无需重做。

### T1 — `packages/wal-core`：类型、映射、批次阈值 ✅ 已完成

- 触碰: `packages/wal-core/**`、`pnpm-workspace.yaml`、根/`package.json` 脚本
- 完成条件: Spec 字段类型；映射；R1/R2/R3；Vitest；禁止截断辅助 API
- 验收映射: P0-2、P0-8、批次裁决
- **本增量**: 可选导出扩窗辅助纯函数（非必须；启发式可留 server）

### T2 — Server：connect 门禁迁移 + Page 路由校验 ✅ 已完成

- 触碰: `apps/server/src/session.ts`、`apps/server/src/app.ts`、相关测试
- 完成条件: Connect 不强制扩展；Page/WAL 按模式校验
- 验收映射: P0-10、P1-3

### T3 — Server：WAL API ✅ 基线已完成 · **T3Δ 增量**

- 触碰: `apps/server/src/wal.ts`、`app.ts`、`apps/server/tests/**`、`wal-smoke.ts`
- 基线完成条件（已有）:
  - `GET /api/wal/current-lsn`（tip only；保留）
  - `GET /api/wal/records?startLsn&endLsn` + R1/R2/R3；空区间成功；错误体可读
- **T3Δ 完成条件**:
  - 新增 **`GET /api/wal/recent-window?limit=20`**（默认 20；`limit` ≤ R1）
  - 成功体：`{ startLsn, endLsn, count }`；`endLsn` = tip；启发式扩窗见 `design.md` §4.1
  - 结果 > limit：取尾 `limit` 条并回填 `startLsn` = 该批最早 `start_lsn`；`count = limit`
  - 探测查询遵守 R1/R2/R3；超限 → `WAL_BATCH_TOO_LARGE`；**禁止**截断假成功
  - 已删/不可读段 → `BAD_LSN`（或等价）+ nextStep；**禁止**静默空成功
  - 更新 nextStep 文案：指向「填入最近窗口」/ Fill recent window（废止「Fill current LSN」指引）
  - 单测/冒烟覆盖：窗口成功、>limit 取尾、门禁失败、可选已删段映射
- 验收映射: P0-2、P0-6、P0-7、P0-11、P1-1、**P1-2（后端）**

### T4 — Web：chrome 模式切换 + 会话保留 ✅ 已完成

- 触碰: `apps/web/src/App.tsx`、样式
- 验收映射: P0-1、P0-12、P1-3

### T5 — Web：WAL 查询、列表、选中、FPI、hex 占位 ✅ 基线已完成 · **T5Δ 增量**

- 触碰: `apps/web/src/api.ts`、`WalView.tsx`、相关样式/文案
- **T5Δ 完成条件**:
  - 按钮/文案：**「填入最近窗口」**（废止「Fill current LSN」）
  - Fill → `GET /api/wal/recent-window` → 写入 start/end；**不**自动 Load
  - 成功后再 Load → 列表约 20 条（或更少）；**禁止** tip 点查 Empty 冒充成功
  - Fill 失败：可见错误；**不得**把起终点写成假成功窗口
  - idle 提示与错误 nextStep 与 ui-design 一致
- 验收映射: P0-3..P0-5、P0-8、P0-9、P0-11、P1-1、**P1-2**；ui-design Fill 流程

### T6 — Page 回归与文档 ✅ 基线已完成 · **T6Δ 增量**

- 触碰: `README.md`、`README.zh-CN.md`、`docs/features/wal-viewer/dev-notes.md`
- **T6Δ 完成条件**:
  - README（中英）若仍写「填入当前 LSN」→ 改为 recent ~20 窗口说明
  - `dev-notes.md` 追加本增量验证证据（recent-window + UI Fill → Load）
  - Page hex 回归仍通过（P0-10）
- 验收映射: P0-10、P0-12、文档影响；**P1-2**

## 依赖与顺序

```text
（基线 T1–T6 已完成）
T3Δ → T5Δ → T6Δ
```

建议执行：T3Δ → T5Δ → T6Δ；同分支 `wal-viewer` 提交。

## 触碰路径

| 区域 | 路径 |
|---|---|
| Server 增量 | `apps/server/src/wal.ts`、`app.ts`、`apps/server/tests/**`、`wal-smoke.ts` |
| Web 增量 | `apps/web/src/api.ts`、`WalView.tsx`、相关文案 |
| 用户文档 | `README.md`、`README.zh-CN.md` |
| 开发记录 | `docs/features/wal-viewer/dev-notes.md` |

**不触碰:** `docs/manager/**`；`packages/page-core` 业务逻辑（除非回归修复）；扩大 Spec 范围。

## 验收

对照 Spec **P0-1 … P0-12** 与 **P1-1 … P1-3**（**P1-2 以 recent ~20 为准**）；UI 证据对照 `ui-design.md`。

| 层 | 预期证据 |
|---|---|
| L2 wal-core | Vitest 全绿；阈值边界无「假截断成功」API |
| L2 server | recent-window 单测绿；既有 records/tip 回归绿 |
| L2 回归 | page-core / `pnpm -r typecheck` 通过 |
| L3 API | recent-window 返回窗口；records 加载非空（有 WAL 时）；已删段/超限可读硬错误 |
| L3 UI | Fill 不自动 Load；Load 后约 20 行；无 tip Empty 冒充；模式/FPI/hex/Page 回归 |
| 文档 | README + dev-notes 反映 recent window |

### 无法验证时

| 缺口 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| L3 WAL / P1-2 | 无 PG≥15 或无 `pg_walinspect` | recent-window 未实锤 | 提供 PG15+ 并启用扩展后补跑 |
| L3 Page 回归 | 无 `pageinspect` | P0-10 弱 | 启用 pageinspect 后补测 |
| UI 手测 | 无浏览器联调 | Fill/Load 流程遗漏 | `pnpm dev:server` + `dev:web` 勾完清单 |

禁止静默跳过：记入 `dev-notes.md` 与工作项阻塞字段（由 Manager）。

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | `docs/features/wal-viewer/dev-notes.md`（本增量验证与偏离） |
| 用户文档 | `README.md`、`README.zh-CN.md`（Fill = recent ~20；废止 tip 双填表述） |
| 运维文档 | N/A — 本地单人工具，无新增部署/监控合同 |

## Review 门禁与进入 QA

1. Developer 在 `wal-viewer` 完成 **T3Δ / T5Δ / T6Δ**，验证写入 `dev-notes.md`。
2. **Review 门禁 required** → 调度 Reviewer **复审**；须 **Approve**（对照修订后 Spec + Design §4.1 + ui-design Fill + 本 Plan 增量）。
3. Approve 后 Manager 方可进入 QA 回归；QA 重点 **P1-2**，并回归既有 P0/关闭缺陷。
4. **本增量 Plan 确认已随 2026-07-30 产品变更 ok**；Planner **不**再阻塞于 Plan 确认；Manager 直接 `planned` → Developer。

## 交接顺序

1. **Manager** 持久化本增量（产品变更已 ok）→ 状态 `planned` → `developing`
2. **Developer** 在源分支 `wal-viewer` 实施 T3Δ → T5Δ → T6Δ
3. **Reviewer** 复审 Approve
4. **QA** 回归（重点 P1-2）
5. 用户授权合并后走 git 规范合入 `main`（合并授权仍须另取）

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-07-30 | 初稿：Design/UI 对齐；R1/R2/R3；任务 T1–T6 |
| 2026-07-30 | 增量：T3Δ recent-window；T5Δ Fill UI；T6Δ 文档；P1-2；确认门禁随产品变更 ok |

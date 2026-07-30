# Dev notes: wal-viewer

- 工作项: wal-viewer（未拆分）· 分支 `wal-viewer` · 2026-07-30

## 任务完成度

| 任务 | 状态 | 摘要 |
|---|---|---|
| T1 wal-core | 完成 | 类型/映射/`hasFpi`；R1=2000、R2=2MiB、R3=16MiB；无截断 API |
| T2 connect + Page 门禁 | 完成 | connect 仅连通+version；Page 路由 `requirePageinspect` |
| T3 WAL API | 完成 | `/api/wal/current-lsn`、`/api/wal/records`；超限硬错误、无部分 records；tip 空批次 |
| T4 chrome 模式切换 | 完成 | Page \| WAL；主区整树切换；会话保留 |
| T5 WAL UI | 完成 | 必填 LSN、填入当前不盲拉、列表/选中/FPI 折叠/hex 占位 |
| T6 文档与回归 | 完成 | README 中英；Page/WAL L3 OK |

## 变更路径

`packages/wal-core/**`；`apps/server/src/{session,app,wal,wal-smoke}.ts`、`tests/**`；`apps/web/src/{App,WalView,api}.tsx|ts`、`styles.css`；workspace `package.json`；`README.md`、`README.zh-CN.md`；本文件。

未改: `docs/manager/**`、`page-core` 业务逻辑、已确认 Spec/Design/Plan、`qa-report.md`、`review.md`。

## 验证证据

### L2

- `pnpm --filter wal-core test` → 13 passed
- `pnpm --filter wal-core typecheck` → OK
- `pnpm --filter page-core test` → 31 passed
- `pnpm --filter server test` → 11 passed（含 tip 空批次 / walinspect 错误映射）
- `pnpm -r typecheck` → OK

### L3 Page

- `pnpm test:integration` → OK（`public.tb` blk0=8192；PG 16.10）

### L3 WAL

- `pnpm --filter server exec tsx src/wal-smoke.ts` → **OK**
  - `current-lsn` 200
  - tip 点查 `start=end=current` → **200 `{ records: [] }`**
  - R3 超跨度 → 400 `WAL_BATCH_TOO_LARGE`、无 `records`

## QA 缺陷修复回执（2026-07-30）

| 缺陷 ID | 结果 | 修复摘要 | 验证证据 | 建议复测 |
|---|---|---|---|---|
| DEF-1 High | 已修复 | `fetchWalRecords`：`start ≥ pg_current_wal_lsn` 短路为 `[]`（Fill tip 空批次成功，P1-1） | L2 tip 单测；`wal-smoke` tip → 200 `records:[]` | Fill current LSN → Load：空态成功；非 INTERNAL |
| DEF-2 Medium | 已修复 | `classifyWalinspectError`：missing record / removed segment / could not read WAL / start past tip → `BAD_LSN` + `WAL_RANGE_UNAVAILABLE_NEXT`（可执行区间指引）；`mapPgError` 对 XX000 亦走此映射 | L2 消息分类单测；`mapWalGateError` nextStep 断言 | 旧/已删段 LSN → 400 `BAD_LSN` + nextStep 含 Fill/narrow/pg_wal；禁止「Inspect server logs…」 |

未修复项: none

### 建议复测范围（供 QA）

1. P1-1 / P1-2：Fill current LSN → Load → 空批次成功 UI
2. P0-11：已删/不可读 WAL 区间 → 可读 `BAD_LSN` + 可执行 nextStep
3. 回归：`wal-smoke`、宽窗 records 成功路径、R3 硬错误、缺扩展、Page hex
4. Review required → 复审 Approve 后再 QA 回归轮次

## 偏离

- 连接成功后仍拉 `listTables`（Page）；缺 `pageinspect` 时错误可见、会话不断开。
- 无单条 LSN API（Design）。
- `wal-smoke.ts` 为 L3 恢复脚本，非 CI 必跑。

## 建议 Review

- tip 空批次短路；walinspect 错误不再落 INTERNAL；超限永不返回部分 `records`；Fill LSN 不自动 Load。

## 建议状态

`reviewing`（Review required；修复后须重新 Approve 再进 QA）

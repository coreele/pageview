# Dev notes: wal-viewer

- 工作项: wal-viewer（未拆分）· 分支 `wal-viewer` · 2026-07-30

## 任务完成度

| 任务 | 状态 | 摘要 |
|---|---|---|
| T1 wal-core | 完成 | 类型/映射/`hasFpi`；R1=2000、R2=2MiB、R3=16MiB；无截断 API |
| T2 connect + Page 门禁 | 完成 | connect 仅连通+version；Page 路由 `requirePageinspect` |
| T3 WAL API | 完成 | `/current-lsn`、`/records`；超限硬错误；tip 空批次 |
| T3Δ recent-window | 完成 | `GET /api/wal/recent-window?limit=20`；64KiB 指数扩窗；>limit 取尾回填 start；无 `records[]` |
| T4 chrome 模式切换 | 完成 | Page \| WAL；主区整树切换；会话保留 |
| T5 WAL UI | 完成 | 必填 LSN、列表/选中/FPI/hex 占位 |
| T5Δ Fill UI | 完成 | 「填入最近窗口」→ recent-window 写 start/end；**不**自动 Load |
| T6 / T6Δ 文档 | 完成 | README 中英 Fill=recent ~20；本文件增量证据 |

## 变更路径

基线：`packages/wal-core/**`；`apps/server` / `apps/web` WAL 路径；README。

本增量：`apps/server/src/{wal,app,wal-smoke}.ts`、`tests/wal.test.ts`；`apps/web/src/{api,WalView}.{ts,tsx}`；`README.md`、`README.zh-CN.md`；本文件。

未改: `workflow/docs/manager/**`、`page-core` 业务逻辑、Spec/Design/Plan、`qa-report.md`、`review.md`。

## 验证证据

### L2（本增量）

- `pnpm --filter server test` → 17 passed（含 recent-window：limit、取尾回填、扩窗、失败传播、nextStep「Fill recent window」）
- `pnpm --filter server typecheck` / `pnpm --filter web typecheck` → OK
- 回归：`pnpm --filter wal-core test` → 13 passed；`pnpm --filter page-core test` → 31 passed；`pnpm -r typecheck` → OK

### L3 Page

- 既有 `pnpm test:integration` 基线 OK（PG 16.10）；本增量未改 Page 路径

### L3 WAL（本增量）

- `pnpm --filter server exec tsx src/wal-smoke.ts` → **OK**
  - `current-lsn` 200 → `0/12E93E88`
  - tip 点查 → 200 `{ records: [] }`
  - **`recent-window?limit=20`** → 200 `{ startLsn: '0/12E935E8', endLsn: tip, count: 20 }`（无 `records`）
  - 同窗口 `/records` → `count`/`recordLen` = 20
  - R3 超跨度 → 400 `WAL_BATCH_TOO_LARGE`、无 `records`

## QA 缺陷修复回执（2026-07-30）

| 缺陷 ID | 结果 | 修复摘要 | 验证证据 | 建议复测 |
|---|---|---|---|---|
| DEF-1 High | 已修复（后被产品变更取代 Fill 语义） | tip 点查空批次短路 | tip 单测 + smoke | tip 点查仍空成功；Fill 改走 recent-window |
| DEF-2 Medium | 已修复 | walinspect 区间/已删段 → `BAD_LSN` + nextStep | 分类单测 | 已删段可读错误；nextStep 现指向 Fill recent window |

未修复项: none

## 偏离

- 连接成功后仍拉 `listTables`（Page）；缺 `pageinspect` 时错误可见、会话不断开。
- 无单条 LSN API（Design）。
- `wal-smoke.ts` 为 L3 恢复脚本，非 CI 必跑。
- Fill/预填失败时保留既有 start/end（不写假窗口）；错误经 chrome 可见。
- UI 打磨后：侧栏「填入最近窗口」改为 chrome `recent 20`（填窗+Load）；进 WAL 预填仍不自动 Load（P1-2）。

## 建议 Review（历史 recent-window）

- recent-window 启发式与取尾回填；进 WAL Fill 不自动 Load；超限/已删段不假成功；README Fill 文案。

## UI 打磨增量（2026-07-31）

用户目视同意继续（**非**合并授权）。基线 `5690895`。

| 项 | 行为 |
|---|---|
| chrome 控件 | start/end LSN、Load、`recent 20` 上移顶栏；`WalView` 仅列表/详情 |
| 进入 WAL | 已连接预填 recent ~20；**不**自动 Load |
| `recent 20` | 一键填窗并 Load（用户已目视确认） |
| Load diff | 相对上一批 `start_lsn` 高亮新行 + meta `#new`；首轮不高亮 |
| Collapse detail | 折叠详情列，列表扩满 |
| 表头/视觉 | 字段表头；圆角卡片；选中/`--wal-new` diff（含 dark） |

列布局不变：列表仅 start（end 在 title）、无 prev、xid 第二列；prev 仅详情。

变更：`apps/web/src/{App,WalView}.{tsx}`、`styles.css`；本文件；`workflow/docs/manager/{STATUS,wal-viewer}.md`（Manager 已改，本角色未改写）。排除：`_qa-*`、`test-results/`、`sparse.*` fixtures、`review.md`、`qa-report.md`。

### 验证证据（本增量）

- `pnpm --filter web typecheck` → OK
- `pnpm --filter web test` → 20 passed（既有 layout/Infomask；无 WAL 组件单测）
- `pnpm --filter server test` → 17 passed（回归，未改 server）

### 建议复测（QA 轮次 5）

- UI：表头、圆角、选中/diff、Collapse detail、`#new`
- 不回退 P1-2：进 WAL 预填不 Load；手动 Load ≈20；`recent 20` 填+Load ≈20
- 列布局：无 prev、xid 第二列
- 抽查 DEF-1 tip 空批次、DEF-2 可读错误

### 建议状态

`reviewing` → Approve → QA 轮次 5；Pass 后再请求合并授权。

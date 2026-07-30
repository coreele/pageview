# Dev notes: wal-viewer

- 工作项: wal-viewer（未拆分）· 分支 `wal-viewer` · 2026-07-30

## 任务完成度

| 任务 | 状态 | 摘要 |
|---|---|---|
| T1 wal-core | 完成 | 类型/映射/`hasFpi`；R1=2000、R2=2MiB、R3=16MiB；无截断 API |
| T2 connect + Page 门禁 | 完成 | connect 仅连通+version；Page 路由 `requirePageinspect` |
| T3 WAL API | 完成 | `/api/wal/current-lsn`、`/api/wal/records`；超限硬错误、无部分 records |
| T4 chrome 模式切换 | 完成 | Page \| WAL；主区整树切换；会话保留 |
| T5 WAL UI | 完成 | 必填 LSN、填入当前不盲拉、列表/选中/FPI 折叠/hex 占位 |
| T6 文档与回归 | 完成 | README 中英；Page L3 OK；WAL L3 见阻塞 |

## 变更路径

`packages/wal-core/**`；`apps/server/src/{session,app,wal,wal-smoke}.ts`、`tests/**`；`apps/web/src/{App,WalView,api}.tsx|ts`、`styles.css`；workspace `package.json`；`README.md`、`README.zh-CN.md`；本文件。

未改: `docs/manager/**`、`page-core` 业务逻辑、已确认 Spec/Design/Plan。

## 验证证据

### L2

- `pnpm --filter wal-core test` → 13 passed
- `pnpm --filter wal-core typecheck` → OK
- `pnpm --filter page-core test` → 31 passed
- `pnpm --filter server test` → 8 passed
- `pnpm -r typecheck` → OK

### L3 Page

- `pnpm test:integration` → OK（`public.tb` blk0=8192；PG 16.10；DROP COLUMN placeholder OK）

### L3 WAL（阻塞）

| 未验证项 | 原因 | 风险 | 恢复条件 | 复测范围 |
|---|---|---|---|---|
| records 成功路径 / 实库 R3 / FPI / 空批次 | 库无 `pg_walinspect`；`current-lsn` → `WALINSPECT_MISSING`（含自行建扩展指引） | P0-2/3/6–8 成功态未实锤 | `CREATE EXTENSION pg_walinspect;` 后 `pnpm --filter server exec tsx src/wal-smoke.ts` + UI Load | 字段齐全、硬错误无 partial、空区间、列表/FPI/hex |
| UI 手测全清单 | 本会话无浏览器联调 | 键盘/窄屏遗漏 | `dev:server` + `dev:web` 对照 ui-design | 模式往返、选中、错误面板 |

R1/R2/R3 裁决单测在 `wal-core`（L2）。缺扩展失败文案已用实库确认。

## 偏离

- 连接成功后仍拉 `listTables`（Page）；缺 `pageinspect` 时错误可见、会话不断开。
- 无单条 LSN API（Design）。
- `wal-smoke.ts` 为 L3 恢复脚本，非 CI 必跑。

## 建议 Review

- 超限永不返回部分 `records`；WAL UI 不走 StructureMap/32B grid；进入 WAL / Fill LSN 不自动 Load；无 `CREATE EXTENSION`。

## 建议状态

`reviewing`（Review required）

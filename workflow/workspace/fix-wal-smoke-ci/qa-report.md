# QA Report: fix-wal-smoke-ci

> 首测与所有回归写在本文件，按轮次追加；禁止 `qa-report-v2.md`。

## 轮次

| 轮次 | 日期 | 实现版本 | 环境 | 范围 | 结论 |
|---|---|---|---|---|---|
| 1 | 2026-09-09 | `0fab8f31d1377065821449e1f9300137923afa46` | WSL2，仓库 `.env` + 本地 PG | Plan V-1..V-6；对照 CI 失败日志 | Pass |

## 执行命令

| 命令 | 输出摘要 / 证据位置 |
|---|---|
| `git rev-parse HEAD` | `0fab8f31d1377065821449e1f9300137923afa46` |
| `pnpm --filter server test` | 8 files / 86 tests passed；`tests/wal.test.ts` 15 tests |
| `pnpm --filter server exec tsc --noEmit -p tsconfig.json` | exit 0 |
| `pnpm test:wal` | `WAL L3 smoke OK`；recent-window 200 count=20；r3-oversized 400 `WAL_BATCH_TOO_LARGE` hasRecords false |

## 覆盖（对照 Spec 验收与 Plan 验证）

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| V-1 | 窗口 endLsn 等于先前观测 tip → ok | Pass | `wal.test.ts`：「accepts endLsn equal to the previously observed tip」 |
| V-2 | 窗口 endLsn 严格大于观测 tip（CI 值）→ ok | Pass | 用例使用 Actions 日志 `0/2206C50` vs `0/2206CC8`；旧 `endLsn !== lsn` 对此必失败 |
| V-3 | 窗口 endLsn 落后观测 tip → 失败 | Pass | reason=`end_before_observed_tip` |
| V-4 | records 附着或 count 越界 → 失败 | Pass | `records_attached` / `count_out_of_range` / `count_not_integer` |
| V-5 | `pnpm --filter server test` | Pass | 86 passed |
| V-6 | `pnpm test:wal` | Pass | `WAL L3 smoke OK` exit 0 |

## 回归

| 范围 | 结果 | 证据 |
|---|---|---|
| 既有 recent-window helpers（limit / 取尾 / 扩窗 / 失败传播） | Pass | `wal.test.ts` P1-2 块仍在 15 tests 内全部通过 |
| tip 点查空批次 | Pass | smoke `records-point` 200 `records: []` |
| R3 过大区间 | Pass | 400 `WAL_BATCH_TOO_LARGE`，body 无 `records` |
| Fill 响应仍无 `records[]` | Pass | smoke 200 body 仅 startLsn/endLsn/count |

## 文档与安全验收

| 项 | 结果 | 备注 |
|---|---|---|
| 用户可见文档 | Pass | Plan 声明 N/A；Fill 用户语义未改 |
| 运维可执行文档 | Pass | CI 仍 `pnpm test:wal` |
| 安全验证范围 | Pass | 无凭据、无新依赖、无新外部访问；契约只收紧/放宽 LSN 比较 |

## 缺陷

| ID | 严重度 | 摘要 | 状态 | 处理说明 | 验证证据 |
|---|---|---|---|---|---|
| | | | | | |

## 阻塞（Blocked 时必填）

- 原因:
- 风险:
- 恢复条件:
- 复测范围:

## 结论

- 本轮结论: Pass
- 合并: 已授权（等 Manager 置 `done`）

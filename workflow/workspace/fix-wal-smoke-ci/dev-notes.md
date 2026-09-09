# Dev Notes: fix-wal-smoke-ci

## 实现摘要

`/api/wal/recent-window` 在请求时重新读取 tip，`endLsn` 可以严格大于先前 `/api/wal/current-lsn` 的观测值。冒烟原先用字符串全等，CI 上两次调用之间 WAL 前进（`0/2206C50` → `0/2206CC8`）即误杀。抽出 `checkRecentWindowContract`：无 `records`、LSN 可解析、`start ≤ end`、count 在范围内、且 `parseLsn(endLsn) ≥ parseLsn(observed)`。Smoke 共用该函数，失败时打印 reason。

## 变更路径

- `apps/server/src/wal.ts` — `checkRecentWindowContract`
- `apps/server/src/wal-smoke.ts` — 改用契约函数
- `apps/server/tests/wal.test.ts` — 相等 / 前进（CI 日志值）/ 回退 / records 与越界

## 测试先行记录（TDD）

| Spec ID / 行为项 | 测试 | 先失败 | 后通过 | 说明 |
|---|---|---|---|---|
| V-1 相等 tip | `accepts endLsn equal to the previously observed tip` | 未单独跑红；旧 smoke 在相等时本就通过 | 实现后 `pnpm --filter server test` 86 passed | 回归对照 |
| V-2 前进 tip | `accepts endLsn strictly ahead… (CI WAL advance)` 用 CI 值 `0/2206C50` vs `0/2206CC8` | 旧 `endLsn !== lsn` 对此必失败 | 同上通过 | 复现 Actions 竞态 |
| V-3 回退 tip | `rejects endLsn behind the previously observed tip` | 新断言，实现前不存在 | reason=`end_before_observed_tip` | |
| V-4 records/越界 | `rejects records[] attached or count out of range` | 旧 smoke 已覆盖部分 | 通过 | |
| V-5 server test | `pnpm --filter server test` | — | 86 passed（原 81 + 5） | |
| V-6 L3 smoke | `pnpm test:wal` | — | `WAL L3 smoke OK` exit 0 | 本地 tip 未前进；前进路径靠 V-2 |

## 验证

| 命令 | 验证层 | 结果摘要 / 证据 |
|---|---|---|
| `pnpm --filter server test` | unit | 8 files / 86 tests passed；wal.test.ts 15 tests |
| `pnpm --filter server exec tsc --noEmit -p tsconfig.json` | static | 无输出、exit 0 |
| `pnpm test:wal` | integration | `WAL L3 smoke OK`；recent-window 200 count=20；R3 400 `WAL_BATCH_TOO_LARGE` |

## 目标分支同步（最终 Review 前）

- 目标分支及提交: `main` / `d94ef94ae67b7b2f9f377f87ac59bc0178f6415d`（本地 `origin/main`；`git fetch origin main` 因 443 代理失败未刷新）
- 同步后源分支 HEAD: `0fab8f3`（`git rev-parse HEAD` 全长见 QA）
- 同步方式: N/A — 源分支由该基线创建，实现期间目标未在本地移动
- 冲突及处理: N/A
- 同步后复验: 上表三条命令均在 `0fab8f3` 上执行通过

## 文档影响

| 类别 | 已更新路径或交接说明 |
|---|---|
| 开发文档 | N/A — 契约注释在 `checkRecentWindowContract` |
| 用户文档 | N/A |
| 运维文档 | N/A |

## 未解决风险 / 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| Actions `test:wal` 实跑 | 未 push | CI 负载下 tip 前进幅度与本地不同；契约已用 CI 日志值单测 | 合入/push 后看 integration job |
| fetch origin | 本环境 443 经 `127.0.0.1` 失败 | 远程 main 若已前进，合入前需再 rebase | 授权合并前可连通时 `git fetch` |

## QA 修复回执

| 缺陷 ID | 处理 | 摘要 | 验证证据 | 建议复测范围 |
|---|---|---|---|---|
| | | | | |

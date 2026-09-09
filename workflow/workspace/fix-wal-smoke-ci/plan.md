# Plan: fix-wal-smoke-ci

## 元信息

- 依据 Spec: N/A
- 依据 Design: N/A
- 依据 UI: N/A
- 路径等级: fast
- Review 门禁: skipped（fast：单点冒烟契约，单测即可复现竞态）
- 最低验证层: unit + integration
- 验证命令:
  - `pnpm --filter server test`
  - 有 PG 凭据时 `pnpm test:wal`；无凭据时该命令须 exit 2，并在验证缺口记录，不得冒充 L3 通过
- 预期证据:
  - 新增单测覆盖「观测 tip 与窗口 tip 相等 / 窗口 tip 前进 / 窗口 tip 回退」；前进不得失败，回退必须失败
  - 既有 recent-window / R3 / tip 空批次用例不回退
  - 有 PG 时 `pnpm test:wal` 打印 `WAL L3 smoke OK` 且 exit 0

## 目标摘要

修正 `wal-smoke.ts` 对 `/api/wal/recent-window` 的 tip 契约：`endLsn` 是该请求时刻的 live tip，允许严格大于先前 `/api/wal/current-lsn` 的观测值。抽出可单测的契约函数，避免再把两次独立查询做成字符串全等。

## 任务拆解

1. **T1** 在 `apps/server/src/wal.ts` 抽出 `checkRecentWindowContract(body, previouslyObservedLsn, maxCount)`：无 `records`、LSN 可解析、`start ≤ end`、`count` 为 `0..maxCount` 整数、`parseLsn(endLsn) ≥ parseLsn(previouslyObservedLsn)`。完成条件：函数可被单测与 smoke 共用。
2. **T2** 单测复现 CI 竞态：先前 LSN `0/2206C50`、窗口 `endLsn` `0/2206CC8` 必须通过；`endLsn` 落后于观测 tip 必须失败；附带 `records` / 非法 count 仍失败。
3. **T3** `wal-smoke.ts` 改用该函数；失败时打印 `reason`、观测 LSN 与窗口 body（便于以后 CI 诊断）。后续按窗口 `startLsn`/`endLsn` 拉 `/records` 的逻辑不变。
4. **T4** 自验：`pnpm --filter server test`；有凭据则 `pnpm test:wal`。

## 依赖与顺序

T1 → T2 → T3 → T4

## 触碰路径

- 修改：`apps/server/src/wal.ts`、`apps/server/src/wal-smoke.ts`、`apps/server/tests/wal.test.ts`
- 禁触：产品 UI、`/api/wal/recent-window` 响应字段、`windowFromRecords` 的 Fill 语义（`endLsn` 仍为请求时 tip）

## 验收与验证

| ID | 要求或命令 | 预期证据 | 结果（实施后填） |
|---|---|---|---|
| V-1 | 契约：窗口 `endLsn` 等于先前观测 tip | `checkRecentWindowContract` 返回 `ok` | |
| V-2 | 契约：窗口 `endLsn` 严格大于先前观测 tip（CI 日志值） | 返回 `ok`；不得因字符串不等失败 | |
| V-3 | 契约：窗口 `endLsn` 小于先前观测 tip | 返回 `ok: false`，reason 可辨识 | |
| V-4 | 契约：body 含 `records` 或 count 越界 | 返回 `ok: false` | |
| V-5 | `pnpm --filter server test` | 含新契约用例，全部通过 | |
| V-6 | 有 PG 时 `pnpm test:wal` | `WAL L3 smoke OK`、exit 0；无凭据则 exit 2 并记缺口 | |

## 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| Actions `test:wal` 实跑 | 本角色未 push | CI 负载下 tip 前进幅度与本地不同 | 合入/push 后看 integration job 的 `test:wal` |

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | N/A——契约函数注释写在 `wal.ts`；README 的 `test:wal` 入口不变 |
| 用户文档 | N/A——Fill 对用户仍是「end = 当前 tip」 |
| 运维文档 | N/A——CI 仍跑 `pnpm test:wal` |

## 交接顺序

1. Developer 实施与自验 →
2. Reviewer（本项 skipped）→
3. QA 验收 →
4. 用户授权合并 → Manager 第三阶段文档提交（`done`）→ 合入 → 归档

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-09-09 | 初稿 |

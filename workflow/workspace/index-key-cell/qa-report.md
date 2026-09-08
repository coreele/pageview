# QA Report: index-key-cell

> 首测与所有回归写在本文件，按轮次追加；禁止 `qa-report-v2.md`。

## 轮次

| 轮次 | 日期 | 实现版本 | 环境 | 范围 | 结论 |
|---|---|---|---|---|---|
| 1 | 2026-09-08 | `fb2cd56708cb60bb08efb9f8cecef567684312ae` | 本地 pnpm workspace（`origin/main` `381c63c`） | Plan V-1–V-3 + 回归 + static | Pass |
| 2 | 2026-09-08 | `32d47725ca55171ed94e3b99e3027defbd24afbc` | 本地 pnpm workspace（`origin/main` `381c63c`） | 用户要求具体值后的按列解码格 + V-1–V-3 + 回归 + static | Pass |

## 执行命令

| 命令 | 输出摘要 / 证据位置 |
|---|---|
| `pnpm --filter page-core test` | 6 files / 174 passed（含 btree.test 22） |
| `pnpm --filter web test` | 14 files / 218 passed |
| `pnpm --filter page-core typecheck` | 退出码 0 |
| `pnpm --filter web typecheck` | 退出码 0 |

## 覆盖（对照 Spec 验收与 Plan 验证）

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| V-1 | 无元数据时 key 格 hex | Pass | `tuple-0.key` 等于 `keyBytesHexCellText`，长度 >0 且 ≤14 |
| V-2 | 有列元数据时显示解码值 | Pass | `tuple-0.key` 为 `visualOnly`；`tuple-0.col-1` label `"id"`、valueText `"10"`、range 撑满 key 区 |
| V-3 | 过长截断仍有值 | Pass | `clipKeyCellText` 15 字 → 14 且以 … 结尾；多列 join 截断 |
| V-reg | page-core + web | Pass | 174 / 218 |
| V-static | typecheck | Pass | 两包退出码 0 |

## 回归

| 范围 | 结果 | 证据 |
|---|---|---|
| btree 解析 / decode / tree | Pass | page-core 既有用例仍绿 |
| web 结构图 / hex / 索引详情 | Pass | 218 全绿；详情键值区未改；`tuple-N.key` 仍可被选中（visualOnly） |

## 文档与安全验收

| 项 | 结果 | 备注 |
|---|---|---|
| 用户可见文档 | Pass | N/A |
| 运维可执行文档 | Pass | N/A |
| 安全验证范围 | Pass | 无新端点、无新依赖 |

## 缺陷

| ID | 严重度 | 摘要 | 状态 | 处理说明 | 验证证据 |
|---|---|---|---|---|---|
| — | | | | | |

## 阻塞（Blocked 时必填）

- 原因:
- 风险:
- 恢复条件:
- 复测范围:

## 结论

- 本轮结论: Pass
- 合并: 已授权
- 待合入提交: `32d47725ca55171ed94e3b99e3027defbd24afbc`

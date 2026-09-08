# QA Report: flag-mark-size

> 首测与所有回归写在本文件，按轮次追加；禁止 `qa-report-v2.md`。

## 轮次

| 轮次 | 日期 | 实现版本 | 环境 | 范围 | 结论 |
|---|---|---|---|---|---|
| 1 | 2026-09-08 | `d3cdfd76686298a1fe4064cc28f6948d5fb522f1` | 本地 pnpm workspace（`origin/main` `7a3339e`） | Plan V-1–V-3 + static | Pass |

## 执行命令

| 命令 | 输出摘要 / 证据位置 |
|---|---|
| `pnpm --filter web test` | 14 files / 218 tests passed，含 `FlagMark.test.ts` 3 |
| `pnpm --filter web typecheck` | 退出码 0 |

## 覆盖（对照 Spec 验收与 Plan 验证）

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| V-1 | 置位/未置位可区分且直径 0.62rem | Pass | `flagMarkClass`；`styles.css` `.flag-mark` width 0.62rem |
| V-2 | 三处清单无 Unicode 圆点 | Pass | StructureMap / IndexTupleDetail / InfomaskBitStrip 含 `FlagMark`、无 ●○ |
| V-3 | 既有 web 测试 | Pass | 218 passed |
| V-static | typecheck | Pass | 退出码 0 |

## 回归

| 范围 | 结果 | 证据 |
|---|---|---|
| infomask 位格条（方块） | Pass | 未改 `.infomask-bit` 尺寸规则；既有 InfomaskBitStrip 4 例绿 |
| url/index/heap 既有 | Pass | web 218 全绿 |

## 文档与安全验收

| 项 | 结果 | 备注 |
|---|---|---|
| 用户可见文档 | Pass | N/A（README 未描述圆点） |
| 运维可执行文档 | Pass | N/A |
| 安全验证范围 | Pass | 无新依赖、无新端点 |

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
- 待合入提交: `d3cdfd76686298a1fe4064cc28f6948d5fb522f1`

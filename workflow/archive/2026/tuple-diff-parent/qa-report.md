# QA Report: tuple-diff-parent

> 首测与所有回归写在本文件，按轮次追加；禁止 `qa-report-v2.md`。

## 轮次

| 轮次 | 日期 | 实现版本 | 环境 | 范围 | 结论 |
|---|---|---|---|---|---|
| 1 | 2026-09-08 | `56bd3b537510ea839818f7903a13afcedd2cdd11` | 本地 web vitest + tsc；`origin/main` `e3851e4` 为祖先 | 首测 | Pass |

## 执行命令

| 命令 | 输出摘要 / 证据位置 |
|---|---|
| `pnpm --filter web test` | 18 files / 270 passed |
| `pnpm --filter web typecheck` | 退出码 0 |

## 覆盖（对照 Spec 验收与 Plan 验证）

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| V-1 | 任一 tuple 字段 diff → `tuple-N` | Pass | xmin 命中时 `ids.has("tuple-N")` |
| V-2 | 未变兄弟字段借父 id | Pass | xmax 字段 id 不在集合，父 id 在 |
| V-reg | web test | Pass | 270 passed |
| V-static | typecheck | Pass | 退出码 0 |

## 回归

| 范围 | 结果 | 证据 |
|---|---|---|
| findStructureAt / btree special diff / header+free coarse ids | Pass | 同次 vitest 全绿 |

## 文档与安全验收

| 项 | 结果 | 备注 |
|---|---|---|
| 用户可见文档 | Pass | Plan 声明 N/A |
| 运维可执行文档 | Pass | N/A |
| 安全验证范围 | Pass | 无新请求面 |

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
- 合并: 用户拒绝合入（2026-09-08）；实现未进入 `main`
- 待合入提交: 无（`56bd3b537510ea839818f7903a13afcedd2cdd11` 已随源分支丢弃）

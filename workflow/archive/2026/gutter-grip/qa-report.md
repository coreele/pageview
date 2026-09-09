# QA Report: gutter-grip

> 首测与所有回归写在本文件，按轮次追加；禁止 `qa-report-v2.md`。

## 轮次

| 轮次 | 日期 | 实现版本 | 环境 | 范围 | 结论 |
|---|---|---|---|---|---|
| 1 | 2026-09-09 | `623383daf10ce2689a9c532ae329a982bf34f6d7` | 本地 web vitest + tsc；`origin/main` `fb41f40` 为祖先 | 首测 | Pass |

## 执行命令

| 命令 | 输出摘要 / 证据位置 |
|---|---|
| `pnpm --filter web test` | 20 files / 289 passed |
| `pnpm --filter web typecheck` | 退出码 0 |

## 覆盖（对照 Spec 验收与 Plan 验证）

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| V-1 | 柄短且居中 | Pass | `::after` height 2.5rem + translate(-50%, -50%)；无 bottom 0.45rem |
| V-2 | 悬停不纯亮青 | Pass | hover color-mix accent 40% + border |
| V-reg | web test | Pass | 289 passed |
| V-static | typecheck | Pass | 退出码 0 |

## 回归

| 范围 | 结果 | 证据 |
|---|---|---|
| paneSplit 拖动算法 | Pass | 同文件既有 6 测仍绿 |
| chrome / export / tree 单测 | Pass | 同次 vitest 全绿 |

## 文档与安全验收

| 项 | 结果 | 备注 |
|---|---|---|
| 用户可见文档 | Pass | Plan 声明 N/A |
| 运维可执行文档 | Pass | N/A |
| 安全验证范围 | Pass | 无新请求面；仅 CSS |

## 缺陷

| ID | 严重度 | 摘要 | 状态 | 处理说明 | 验证证据 |
|---|---|---|---|---|---|
| — | | | | | |

## 阻塞（Blocked 时必填）

- 原因:
- 风险:
- 恢复条件:
- 复测范围:

## 验证缺口（不阻塞）

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 真机深色对照 | 未在浏览器悬停确认 | 观感仍偏亮或偏短 | 深色下载一页看栏间 |

## 结论

- 本轮结论: Pass
- 合并: 已授权（等 Manager 置 `done`）
- 待合入提交: `623383daf10ce2689a9c532ae329a982bf34f6d7`

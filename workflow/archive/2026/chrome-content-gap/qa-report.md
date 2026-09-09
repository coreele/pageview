# QA Report: chrome-content-gap

> 首测与所有回归写在本文件，按轮次追加；禁止 `qa-report-v2.md`。

## 轮次

| 轮次 | 日期 | 实现版本 | 环境 | 范围 | 结论 |
|---|---|---|---|---|---|
| 1 | 2026-09-09 | `d7dd8f37935259e0b2824135ee88238dce78cd00` | 本地 web vitest + tsc；本地 `main` `c8f1f24` 为祖先 | 首测 | Pass |

## 执行命令

| 命令 | 输出摘要 / 证据位置 |
|---|---|
| `pnpm --filter web test` | 20 files / 295 passed |
| `pnpm --filter web typecheck` | 退出码 0 |

## 覆盖（对照 Spec 验收与 Plan 验证）

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| V-1 | 无 meta 地板高度 | Pass | CSS 无 `--chrome-meta-h`；`.chrome-meta` 无 `min-height` |
| V-2 | main 顶距收紧 | Pass | `.main` `padding: 0.2rem 0.4rem 0.4rem` |
| V-reg | web test | Pass | 295 passed |
| V-static | typecheck | Pass | 退出码 0 |

## 回归

| 范围 | 结果 | 证据 |
|---|---|---|
| chrome 字标 / 开关 | Pass | `chromeToggle.test.ts` 既有用例仍绿 |
| gutter / export / tree | Pass | 同次 vitest 全绿 |

## 文档与安全验收

| 项 | 结果 | 备注 |
|---|---|---|
| 用户可见文档 | Pass | Plan 声明 N/A |
| 运维可执行文档 | Pass | N/A |
| 安全验证范围 | Pass | 仅 CSS 间距 |

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
| 真机对照 | 无浏览器自动化 | 观感仍空或过贴 | 深色 Tree 开着看统计条下沿 |

## 结论

- 本轮结论: Pass
- 合并: 用户拒绝合入（2026-09-09）；实现未进入 `main`
- 待合入提交: 无（`d7dd8f37935259e0b2824135ee88238dce78cd00` 随源分支丢弃）

# QA Report: chrome-order

> 首测与所有回归写在本文件，按轮次追加；禁止 `qa-report-v2.md`。

## 轮次

| 轮次 | 日期 | 实现版本 | 环境 | 范围 | 结论 |
|---|---|---|---|---|---|
| 1 | 2026-09-08 | `de90bf660b5c9e3d7fb96938eaec9afa87c2cb7f` | 本地 web vitest + tsc；`origin/main` `e3851e4` 为祖先 | 首测 | Pass |

## 执行命令

| 命令 | 输出摘要 / 证据位置 |
|---|---|
| `pnpm --filter web test` | 18 files / 271 passed |
| `pnpm --filter web typecheck` | 退出码 0 |

## 覆盖（对照 Spec 验收与 Plan 验证）

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| V-1 | Tree 在 Detail/Hex 左 | Pass | chrome-actions 切片 `btree-tree-panel` 先于 `selection-detail-panel` / `hex-panel` |
| V-2 | 深色月亮同开态底 | Pass | `[data-theme="dark"] .chrome-theme` 含 accent 18% mix |
| V-reg | web test | Pass | 271 passed |
| V-static | typecheck | Pass | 退出码 0 |

## 回归

| 范围 | 结果 | 证据 |
|---|---|---|
| chromeToggle 文案 / 主题图标 / Tree README | Pass | 同次 vitest 全绿 |

## 文档与安全验收

| 项 | 结果 | 备注 |
|---|---|---|
| 用户可见文档 | Pass | Plan 声明 N/A |
| 运维可执行文档 | Pass | N/A |
| 安全验证范围 | Pass | 无新密钥或请求面 |

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
- 合并: 已授权（等 Manager 置 `done`）
- 待合入提交: `de90bf660b5c9e3d7fb96938eaec9afa87c2cb7f`

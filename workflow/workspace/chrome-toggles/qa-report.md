# QA Report: chrome-toggles

> 首测与所有回归写在本文件，按轮次追加；禁止 `qa-report-v2.md`。

## 轮次

| 轮次 | 日期 | 实现版本 | 环境 | 范围 | 结论 |
|---|---|---|---|---|---|
| 1 | 2026-09-08 | `43145ae1ddf3d5a20639497e5f28172edf5cbbd4` | 本地 pnpm workspace（`origin/main` `3af2644`） | Plan V-1–V-3 / V-docs + 回归 + static | Pass |

## 执行命令

| 命令 | 输出摘要 / 证据位置 |
|---|---|
| `pnpm --filter web test` | 16 files / 230 passed（含 chromeToggle 5） |
| `pnpm --filter web typecheck` | 退出码 0 |

## 覆盖（对照 Spec 验收与 Plan 验证）

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| V-1 | 开/关 class 与色态 | Pass | `chromeToggleClass(true)` 含 `--on`；CSS accent 18% mix |
| V-2 | 固定文案 | Pass | `App.tsx` 无 Show/Collapse / `Theme:` |
| V-3 | 主题图标 | Pass | `ThemeGlyph` 含 sun/moon；`themeToggleLabel` 指向下一主题 |
| V-docs | README 中英 | Pass | 无 Show tree / Collapse tree |
| V-reg | web 测试 | Pass | 230 全绿 |
| V-static | typecheck | Pass | 退出码 0 |

## 回归

| 范围 | 结果 | 证据 |
|---|---|---|
| 树导航 / 结构图 / hex / 索引详情 | Pass | 既有 web 用例仍绿 |

## 文档与安全验收

| 项 | 结果 | 备注 |
|---|---|---|
| 用户可见文档 | Pass | README 中英已改 |
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
- 待合入提交: `43145ae1ddf3d5a20639497e5f28172edf5cbbd4`

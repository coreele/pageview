# QA Report: tree-nav-ui

> 首测与所有回归写在本文件，按轮次追加；禁止 `qa-report-v2.md`。

## 轮次

| 轮次 | 日期 | 实现版本 | 环境 | 范围 | 结论 |
|---|---|---|---|---|---|
| 1 | 2026-09-08 | `a2f2bfb79ecdfb28f8014b9ddc8c33c8f9f0ab3b` | 本地 pnpm workspace（`origin/main` `befa08b`） | Plan V-1–V-3 + 回归 + static | Pass |
| 2 | 2026-09-08 | `243f6e376e408b456bc6111ae87c9cc011f93140` | 本地 pnpm workspace（`origin/main` `befa08b`） | 用户反馈收紧 expander 间距 + V-1–V-4 + 回归 | Pass |

## 执行命令

| 命令 | 输出摘要 / 证据位置 |
|---|---|
| `pnpm --filter web test` | 15 files / 225 passed（含 btreeTree 20、treeNavUi 4） |
| `pnpm --filter web typecheck` | 退出码 0 |

## 覆盖（对照 Spec 验收与 Plan 验证）

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| V-1 | kind 拆成 token | Pass | leaf+root → `leaf`,`L0`,`root`；meta → `meta`；heap/loading → `[]` |
| V-2 | expander 非 Unicode | Pass | `BtreeTreePanel.tsx` 无 `▾▸•`；CSS `::before` caret/dot |
| V-3 | 当前行整宽高亮 | Pass | `.btree-tree-row` `width: 100%`；current `box-shadow: inset 2px 0 0 var(--accent)` |
| V-4 | expander 贴近 blk 文案 | Pass | 行 `gap: 0`；expander `width: 0.85rem`；label `padding-left: 0.1rem` |
| V-reg | web 测试 | Pass | 225 全绿 |
| V-static | typecheck | Pass | 退出码 0 |

## 回归

| 范围 | 结果 | 证据 |
|---|---|---|
| btreeTree 展开 / fetch / heap 列表 | Pass | btreeTree 20 仍绿 |
| 结构图 / hex / 索引详情 | Pass | 其余 web 用例仍绿 |

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
- 待合入提交: `243f6e376e408b456bc6111ae87c9cc011f93140`

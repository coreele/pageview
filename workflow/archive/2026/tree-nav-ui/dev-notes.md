# Dev Notes: tree-nav-ui

## 实现摘要

树导航行铺满面板宽度并加左侧 accent 条；`leaf L0 root` 拆成 pill；expander 改为 CSS 三角/圆点（loading 仍显示 `…`）。heap 就绪块不再标 `…` 类型。箭头/圆点槽收窄到 0.85rem，贴着 `blk` 文案。Load / 展开行为与列宽上限未改。

## 变更路径

- `apps/web/src/btreeTree.ts`、`apps/web/src/btreeTree.test.ts`
- `apps/web/src/BtreeTreePanel.tsx`、`apps/web/src/treeNavUi.test.ts`
- `apps/web/src/styles.css`

## 测试先行记录（TDD）

| Spec ID / 行为项 | 测试 | 先失败 | 后通过 | 说明 |
|---|---|---|---|---|
| V-1 | `treeKindTokens` meta / leaf+L0+root / heap+loading | 是（函数不存在） | 是 | |
| V-2 | 面板无 `▾▸•`；CSS caret/dot | 是 | 是 | |
| V-3 | 行 `width: 100%` + current inset bar | 是 | 是 | |
| V-4 | 行 `gap: 0`；expander 宽 0.85rem；label `padding-left: 0.1rem` | 是（仍为 1.35rem / gap 0.15） | 是 | 用户反馈间距过大 |

## 验证

| 命令 | 验证层 | 结果摘要 / 证据 |
|---|---|---|
| `pnpm --filter web test` | unit | 15 files / 225 passed |
| `pnpm --filter web typecheck` | static | 退出码 0 |

## 目标分支同步（最终 Review 前）

- 目标分支及提交: `origin/main` `befa08b181c0674550b1f077147dabd8447b183b`
- 同步后源分支 HEAD: `243f6e376e408b456bc6111ae87c9cc011f93140`
- 同步方式: N/A（基于登记基线，main 未移动）
- 冲突及处理: N/A
- 同步后复验: 上表命令退出码 0

## 文档影响

| 类别 | 已更新路径或交接说明 |
|---|---|
| 开发文档 | N/A |
| 用户文档 | N/A |
| 运维文档 | N/A |

## 未解决风险 / 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 真机扫读 | 本会话未连实例 Load 叶页 | 窄列 pill 换行观感 | 本地 Show tree 对照 `blk 0 meta` / `blk 1 leaf L0 root` |

## QA 修复回执

| 缺陷 ID | 处理 | 摘要 | 验证证据 | 建议复测范围 |
|---|---|---|---|---|
| | | | | |

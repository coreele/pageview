# Dev Notes: chrome-order

## 实现摘要

`.chrome-actions` 内顺序改为 Tree → Detail → Hex。深色 `[data-theme="dark"] .chrome-theme` 使用与 `.chrome-toggle--on` 相同的 accent 18% mix，月亮不再空底。浅色太阳钮未改。折叠条件与 `aria-*` 未动。

## 变更路径

- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/chromeToggle.test.ts`

## 测试先行记录（TDD）

| Spec ID / 行为项 | 测试 | 先失败 | 后通过 | 说明 |
|---|---|---|---|---|
| V-1 | chrome-actions 切片 Tree 先于 Detail/Hex | 否 | 是 | 与接线同批；源码顺序可失败于回退 |
| V-2 | 深色 `.chrome-theme` accent mix | 否 | 是 | 同上 |
| V-reg / V-static | web test + typecheck | — | 是 | 18 files / 271；tsc 0 |

## 验证

| 命令 | 验证层 | 结果摘要 / 证据 |
|---|---|---|
| `pnpm --filter web test` | unit | 18 files / 271 passed |
| `pnpm --filter web typecheck` | static | 退出码 0 |

## 目标分支同步（最终 Review 前）

- 目标分支及提交: `origin/main` `e3851e4d97808a1792b80e61baa4906c1af00e31`
- 同步后源分支 HEAD: `de90bf660b5c9e3d7fb96938eaec9afa87c2cb7f`
- 同步方式: N/A（`origin/main` 已是祖先）
- 冲突及处理: N/A
- 同步后复验: `pnpm --filter web test` 18/271；`pnpm --filter web typecheck` 退出码 0

## 文档影响

| 类别 | 已更新路径或交接说明 |
|---|---|
| 开发文档 | N/A |
| 用户文档 | N/A |
| 运维文档 | N/A |

## 未解决风险 / 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 真机深色对照 | 本会话未开浏览器连库 | 底色仍偏淡 | 深色下三开关全开看月亮 |

## QA 修复回执

| 缺陷 ID | 处理 | 摘要 | 验证证据 | 建议复测范围 |
|---|---|---|---|---|
| | | | | |

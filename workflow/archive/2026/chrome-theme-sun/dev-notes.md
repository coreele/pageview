# Dev Notes: chrome-theme-sun

## 实现摘要

`.chrome-theme` 自身铺 `.chrome-toggle--on` 同款 `color-mix(--accent 18%, --surface)`。删除 `[data-theme="dark"] .chrome-theme` 特例，浅色太阳与深色月亮同底。

## 变更路径

- `apps/web/src/styles.css`
- `apps/web/src/chromeToggle.test.ts`

## 测试先行记录（TDD）

| Spec ID / 行为项 | 测试 | 先失败 | 后通过 | 说明 |
|---|---|---|---|---|
| V-1 | `.chrome-theme` 含 accent mix；无 dark 特例 | 否 | 是 | 与样式同批 |
| V-reg / V-static | web test + typecheck | — | 是 | 20 files / 293；tsc 0 |

## 验证

| 命令 | 验证层 | 结果摘要 / 证据 |
|---|---|---|
| `pnpm --filter web test` | unit | 20 files / 293 passed |
| `pnpm --filter web typecheck` | static | 退出码 0 |

## 目标分支同步（最终 Review 前）

- 目标分支及提交: `origin/main` / 本地 `main` `8033de99b6e672effb8734d9d122c24335f72a1f`
- 同步后源分支 HEAD: `2a10e027a31529c2f0b33763f8e346b311827274`
- 同步方式: N/A
- 冲突及处理: N/A
- 同步后复验: `pnpm --filter web test` 20/293；typecheck 0

## 文档影响

| 类别 | 已更新路径或交接说明 |
|---|---|
| 开发文档 | N/A |
| 用户文档 | N/A |
| 运维文档 | N/A |

## 未解决风险 / 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 真机浅色对照 | 无浏览器工具 | 底仍偏淡 | 浅色看太阳与 Tree 开态 |

## QA 修复回执

| 缺陷 ID | 处理 | 摘要 | 验证证据 | 建议复测范围 |
|---|---|---|---|---|
| | | | | |

# Dev Notes: chrome-toggles

## 实现摘要

Detail / Hex / Tree 固定文案，开态加 `.chrome-toggle--on`（accent 浅底 + 字重）与 `aria-pressed`。主题按钮改为太阳/月亮 SVG，`aria-label` 指向将切到的一侧。README 中英树面板一句同步。

## 变更路径

- `apps/web/src/chromeToggle.ts`、`apps/web/src/chromeToggle.test.ts`、`apps/web/src/ThemeGlyph.tsx`
- `apps/web/src/App.tsx`、`apps/web/src/styles.css`
- `README.md`、`README.zh-CN.md`

## 测试先行记录（TDD）

| Spec ID / 行为项 | 测试 | 先失败 | 后通过 | 说明 |
|---|---|---|---|---|
| V-1 | `chromeToggleClass` + CSS `--on` | 是（模块不存在） | 是 | |
| V-2 | App 无 Show/Collapse / Theme: | 是 | 是 | |
| V-3 | ThemeGlyph sun/moon + next-theme label | 是 | 是 | |
| V-docs | README 无 Show/Collapse tree | 是 | 是 | |
| V-reg | 既有 web | N/A | 是 | 230 |

## 验证

| 命令 | 验证层 | 结果摘要 / 证据 |
|---|---|---|
| `pnpm --filter web test` | unit | 16 files / 230 passed |
| `pnpm --filter web typecheck` | static | 退出码 0 |

## 目标分支同步（最终 Review 前）

- 目标分支及提交: `origin/main` `3af2644dbbaab1a3cf2515440cdde1bb26525f60`
- 同步后源分支 HEAD: `43145ae1ddf3d5a20639497e5f28172edf5cbbd4`
- 同步方式: N/A（基于登记基线）
- 冲突及处理: N/A
- 同步后复验: 上表命令退出码 0

## 文档影响

| 类别 | 已更新路径或交接说明 |
|---|---|
| 开发文档 | N/A |
| 用户文档 | `README.md`、`README.zh-CN.md` |
| 运维文档 | N/A |

## 未解决风险 / 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 真机扫读 | 本会话未连实例 | 开态对比偏弱 | 本地点 Detail/Hex/Tree 与主题 |

## QA 修复回执

| 缺陷 ID | 处理 | 摘要 | 验证证据 | 建议复测范围 |
|---|---|---|---|---|
| | | | | |

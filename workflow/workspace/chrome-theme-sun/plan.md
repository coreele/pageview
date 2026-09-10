# Plan: chrome-theme-sun

## 元信息

- 依据 Spec: N/A
- 依据 Design: N/A
- 依据 UI: `workflow/workspace/chrome-theme-sun/ui-design.md`
- 路径等级: fast
- Review 门禁: skipped（fast：主题钮底色选择器从 dark-only 提到自身）
- 最低验证层: unit + static
- 验证命令:
  - `pnpm --filter web test`
  - `pnpm --filter web typecheck`
- 预期证据: 退出码 0；CSS 扫描浅色太阳与 `--on` 同 mix 通过。

## 目标摘要

`.chrome-theme` 两主题都铺 `.chrome-toggle--on` 同款 accent 浅底；去掉仅 dark 的特例。

## 任务拆解

1. **底色**（完成条件：`.chrome-theme` 块含 accent 18% mix；无 `[data-theme="dark"] .chrome-theme`）
2. **回归**（完成条件：web test + typecheck 绿）

## 依赖与顺序

1 → 2。

## 触碰路径

- `apps/web/src/styles.css`
- `apps/web/src/chromeToggle.test.ts`

不改：App.tsx、ThemeGlyph、README。

## 验收与验证

| ID | 要求或命令 | 预期证据 | 结果（实施后填） |
|---|---|---|---|
| V-1 | 两主题同底 | `.chrome-theme {` 含 `color-mix(... --accent) 18%`；无 dark 特例选择器 | Pass |
| V-reg | web test | 退出码 0 | Pass |
| V-static | typecheck | 退出码 0 | Pass |

## 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 真机浅色对照 | 本会话未必开浏览器 | 底仍偏白 | 浅色看太阳钮与 Tree 开态 |

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | N/A |
| 用户文档 | N/A |
| 运维文档 | N/A |

## 交接顺序

1. Developer 实施与自验 →
2. Review skipped →
3. QA 验收 →
4. 用户授权合并 → Manager 第三阶段文档提交（`done`）→ 合入 → 归档

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-09-09 | 初稿 |

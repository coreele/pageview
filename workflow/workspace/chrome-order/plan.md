# Plan: chrome-order

## 元信息

- 依据 Spec: N/A
- 依据 Design: N/A
- 依据 UI: `workflow/workspace/chrome-order/ui-design.md`
- 路径等级: fast
- Review 门禁: skipped（fast：chrome 顺序与深色主题钮底色）
- 最低验证层: unit + static
- 验证命令:
  - `pnpm --filter web test`
  - `pnpm --filter web typecheck`
- 预期证据: 退出码 0；顺序扫描与深色 `.chrome-theme` 底色用例通过。

## 目标摘要

chrome-actions 顺序 Tree → Detail → Hex；深色月亮按钮使用与开态开关相同的 accent 浅底。

## 任务拆解

1. **顺序**（完成条件：App `.chrome-actions` 内 Tree 按钮在 Detail/Hex 之前）
2. **深色主题钮底**（完成条件：`[data-theme="dark"] .chrome-theme` 与 `.chrome-toggle--on` 同 mix）
3. **回归**（完成条件：web test + typecheck 绿）

## 依赖与顺序

1 与 2 可并行 → 3。

## 触碰路径

- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/chromeToggle.test.ts`

不改：折叠 state、WAL 次带、README、server。

## 验收与验证

| ID | 要求或命令 | 预期证据 | 结果（实施后填） |
|---|---|---|---|
| V-1 | Tree 在 Detail/Hex 左 | App 源码 chrome-actions 切片 Tree 先于 Detail | |
| V-2 | 深色月亮同开态底 | CSS `[data-theme="dark"] .chrome-theme` 含 accent 18% mix | |
| V-reg | web test | 退出码 0 | |
| V-static | typecheck | 退出码 0 | |

## 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 真机深色对照 | 本会话未必开浏览器 | 底色仍偏淡 | 深色下三开关全开看月亮 |

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | N/A（无新 API） |
| 用户文档 | N/A（不改 README 合同句） |
| 运维文档 | N/A |

## 交接顺序

1. Developer 实施与自验 →
2. Review skipped →
3. QA 验收 →
4. 用户授权合并 → Manager 第三阶段文档提交（`done`）→ 合入 → 归档

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-09-08 | 初稿 |

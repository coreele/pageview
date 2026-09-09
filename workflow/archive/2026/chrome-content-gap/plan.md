# Plan: chrome-content-gap

## 元信息

- 依据 Spec: N/A
- 依据 Design: N/A
- 依据 UI: `workflow/archive/2026/chrome-content-gap/ui-design.md`
- 路径等级: fast
- Review 门禁: skipped（fast：meta 条高度与 main 顶距）
- 最低验证层: unit + static
- 验证命令:
  - `pnpm --filter web test`
  - `pnpm --filter web typecheck`
- 预期证据: 退出码 0；CSS 扫描无 meta min-height、`.main` 顶距收紧通过。

## 目标摘要

去掉 chrome-meta 的 50px 地板，把 `.main` 顶 padding 从 0.75rem 收到约 0.2rem，消除统计条与三栏之间的深色空带。

## 任务拆解

1. **meta 高度**（完成条件：无 `--chrome-meta-h`，`.chrome-meta` 无 `min-height`）
2. **main 顶距**（完成条件：`.main` 顶 padding `0.2rem`，不再四边 `0.75rem`）
3. **回归**（完成条件：web test + typecheck 绿）

## 依赖与顺序

1 与 2 同批 → 3。

## 触碰路径

- `apps/web/src/styles.css`
- `apps/web/src/chromeToggle.test.ts`（或并列 CSS 扫描测）

不改：App.tsx、README、server。

## 验收与验证

| ID | 要求或命令 | 预期证据 | 结果（实施后填） |
|---|---|---|---|
| V-1 | 无 meta 地板高度 | 无 `--chrome-meta-h`；`.chrome-meta` 块无 `min-height` | Pass |
| V-2 | main 顶距收紧 | `.main` 含 `padding: 0.2rem` 起头，无四边 `0.75rem` | Pass |
| V-reg | web test | 退出码 0 | Pass |
| V-static | typecheck | 退出码 0 | Pass |

## 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 真机对照 | 本会话未必开浏览器 | 仍觉得空或过贴 | 深色 Tree 开着看统计条下沿 |

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
| 2026-09-09 | 用户取消合入；实现未进入 `main` |

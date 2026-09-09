# Plan: gutter-grip

## 元信息

- 依据 Spec: N/A
- 依据 Design: N/A
- 依据 UI: `workflow/workspace/gutter-grip/ui-design.md`
- 路径等级: fast
- Review 门禁: skipped（fast：gutter 伪元素长短与亮度）
- 最低验证层: unit + static
- 验证命令:
  - `pnpm --filter web test`
  - `pnpm --filter web typecheck`
- 预期证据: 退出码 0；CSS 扫描短柄高度与 hover mix 通过。

## 目标摘要

`.split-gutter::after` 改为居中短柄；默认淡、悬停用 accent 与 border 的 mix，不再通栏纯 accent。

## 任务拆解

1. **短柄**（完成条件：`::after` 用 `height` + 垂直居中，不再 `top`/`bottom` 拉满）
2. **淡色**（完成条件：默认 muted mix；hover/focus 为 accent 40% + border，无纯 `--accent`）
3. **回归**（完成条件：web test + typecheck 绿）

## 依赖与顺序

1 与 2 同批 → 3。

## 触碰路径

- `apps/web/src/styles.css`
- `apps/web/src/paneSplit.test.ts`（或并列 CSS 扫描测）

不改：`PageSplit.tsx`、`paneSplit.ts` 算法、README、server。

## 验收与验证

| ID | 要求或命令 | 预期证据 | 结果（实施后填） |
|---|---|---|---|
| V-1 | 柄短且居中 | CSS `::after` 含 `height` 与 `translate(-50%, -50%)`，无通栏 top/bottom | Pass |
| V-2 | 悬停不纯亮青 | hover `::after` 背景为 color-mix 含 accent 与 border | Pass |
| V-reg | web test | 退出码 0 | Pass |
| V-static | typecheck | 退出码 0 | Pass |

## 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 真机深色对照 | 本会话未必开浏览器 | 仍偏亮或偏短难找 | 深色下载一页看栏间短柄 |

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | N/A |
| 用户文档 | N/A（不改 README） |
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

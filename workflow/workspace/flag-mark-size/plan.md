# Plan: flag-mark-size

## 元信息

- 依据 Spec: N/A
- 依据 Design: N/A
- 依据 UI: `workflow/workspace/flag-mark-size/ui-design.md`
- 路径等级: fast
- Review 门禁: skipped（fast：CSS 圆点替换 Unicode，对照清单即可）
- 最低验证层: unit + static
- 验证命令:
  - `pnpm --filter web test`
  - `pnpm --filter web typecheck`
- 预期证据: web 测试退出码 0（含 FlagMark 用例）；typecheck 无错误。

## 目标摘要

详情 ○/● flag 清单的点亮圆点改为更大的 CSS 圆，三处共用 `FlagMark`。不改位格条、不改解码。

## 任务拆解

1. **`FlagMark` + 样式**（完成条件：`.flag-mark--set` / `--unset` 直径 0.62rem；单测 class；源码无 ●/○）
2. **三处接线**（完成条件：ItemId `.flag-list`、index `t_info`、位带 `?` 参考列表均用 `FlagMark`）
3. **回归**（完成条件：既有 web 测试绿；不改 page-core）

## 依赖与顺序

1 → 2 → 3。

## 触碰路径

- `apps/web/src/FlagMark.tsx`（新）
- `apps/web/src/FlagMark.test.ts`（新）
- `apps/web/src/StructureMap.tsx`
- `apps/web/src/IndexTupleDetail.tsx`
- `apps/web/src/InfomaskBitStrip.tsx`
- `apps/web/src/styles.css`

不改：`packages/**`、`apps/server/**`、README。

## 验收与验证

| ID | 要求或命令 | 预期证据 | 结果（实施后填） |
|---|---|---|---|
| V-1 | 置位/未置位标记可区分且大于字形点 | `FlagMark` 渲染 `--set` / `--unset`；CSS 直径 0.62rem | |
| V-2 | 三处清单不用 Unicode 实心/空心圆点 | `apps/web/src` 源码无 ● 与 ○ | |
| V-3 | 既有 web 测试不回退 | `pnpm --filter web test` 退出码 0 | |
| V-static | `pnpm --filter web typecheck` | 退出码 0 | |

## 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 真机扫读 | 最低层无 e2e | 暗色下对比不足 | 本地 light/dark 各看 ItemId 与 t_info |

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | N/A：无新公开 API |
| 用户文档 | N/A：README 未描述 ○/● |
| 运维文档 | N/A：无部署变化 |

## 交接顺序

1. Developer 实施与自验 →
2. Review skipped →
3. QA 验收 →
4. 用户授权合并 → Manager 第三阶段文档提交（`done`）→ 合入 → 归档

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-09-08 | 初稿 |

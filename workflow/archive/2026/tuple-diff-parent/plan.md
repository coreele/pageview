# Plan: tuple-diff-parent

## 元信息

- 依据 Spec: N/A
- 依据 Design: N/A
- 依据 UI: N/A（结构图已按 `tuple-N` 父 id 整行着色）
- 路径等级: fast
- Review 门禁: skipped（fast：补已约定的 coarse tuple 父 id）
- 最低验证层: unit + static
- 验证命令:
  - `pnpm --filter web test`
  - `pnpm --filter web typecheck`
- 预期证据: 退出码 0；xmin 有 diff 时集合含 `tuple-N`，xmax 格因此视为 diff。

## 目标摘要

`structureAffectedByDiff` 在任一 `tuple-N.*` 字段命中字节 diff 时同时写入 `tuple-N`，结构图整行高亮。不改 `diffByteRanges`（hex 仍按变过的字节）。

## 任务拆解

1. **父 id**（完成条件：命中 `tuple-6.t_xmin` 时 ids 含 `tuple-6`）
2. **单测**（完成条件：未重叠的 xmax 仍通过 `isFieldDiff` 语义——集合含父 id）
3. **回归**（完成条件：web test + typecheck 绿）

## 依赖与顺序

1 与 2 同批 → 3。

## 触碰路径

- `apps/web/src/diff.ts`
- `apps/web/src/diff.test.ts`

不改：page-core、`diffByteRanges`、HexDump、server。

## 验收与验证

| ID | 要求或命令 | 预期证据 | 结果（实施后填） |
|---|---|---|---|
| V-1 | 任一 tuple 字段 diff → 写入 `tuple-N` | 单测 ids.has(`tuple-N`) | Pass |
| V-2 | 未变字节的兄弟字段可借父 id 高亮 | xmin 区间 diff 时有 `tuple-N`，不必 xmax 区间也在 diffs 里 | Pass |
| V-reg | web test | 退出码 0 | Pass |
| V-static | typecheck | 退出码 0 | Pass |

## 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 真机插入 Refresh | 本 worktree 未连库点 Refresh | 结构图观感 | 插入一行后 Refresh 看整行框 |

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | N/A |
| 用户文档 | N/A（README 仍写 Refresh 字节 diff；结构图整行是呈现） |
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
| 2026-09-08 | 用户取消合入；本 Plan 未落地到 `main` |

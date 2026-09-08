# Dev Notes: tuple-diff-parent

## 实现摘要

`structureAffectedByDiff` 在命中任一 `tuple-N.*` 时同时写入 `tuple-N`。结构图 `isFieldDiff` 已认这个父 id，插入后仍为 0 的 xmax/cid/nullbits 会跟变过的 xmin/列一起出 diff 框。`diffByteRanges` 未改，hex 仍只标变过的字节。

**未合入 `main`。** 用户取消本项；`56bd3b5` 已随源分支丢弃。

## 变更路径

- `apps/web/src/diff.ts`
- `apps/web/src/diff.test.ts`

## 测试先行记录（TDD）

| Spec ID / 行为项 | 测试 | 先失败 | 后通过 | 说明 |
|---|---|---|---|---|
| V-1 | 命中 xmin 时 ids 含 `tuple-N` | 否 | 是 | 原测试只断言 startsWith tuple-，已收紧 |
| V-2 | xmin 区间 diff 有父 id、无 xmax 字段 id | 是 | 是 | 呈现靠父 id |
| V-reg / V-static | web test + typecheck | — | 是 | 18 files / 270；tsc 0 |

## 验证

| 命令 | 验证层 | 结果摘要 / 证据 |
|---|---|---|
| `pnpm --filter web test` | unit | 18 files / 270 passed |
| `pnpm --filter web typecheck` | static | 退出码 0 |

## 目标分支同步（最终 Review 前）

- 目标分支及提交: `origin/main` `e3851e4d97808a1792b80e61baa4906c1af00e31`
- 同步后源分支 HEAD: `56bd3b537510ea839818f7903a13afcedd2cdd11`
- 同步方式: N/A（worktree 从 `origin/main` 建支，已是祖先）
- 冲突及处理: N/A
- 同步后复验: `pnpm --filter web test` 18/270；typecheck 0

## 文档影响

| 类别 | 已更新路径或交接说明 |
|---|---|
| 开发文档 | N/A |
| 用户文档 | N/A |
| 运维文档 | N/A |

## 未解决风险 / 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 真机插入 Refresh | 本 worktree 未连库 | 结构图观感 | 插入一行 Refresh 看整行框 |

## QA 修复回执

| 缺陷 ID | 处理 | 摘要 | 验证证据 | 建议复测范围 |
|---|---|---|---|---|
| | | | | |

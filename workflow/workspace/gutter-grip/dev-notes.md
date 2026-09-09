# Dev Notes: gutter-grip

## 实现摘要

`.split-gutter::after` 改为垂直居中短胶囊（`2.5rem`），默认 `text-muted` 40% mix。hover/focus 加长到 `3.5rem`，背景为 accent 40% + `--border`，不再通栏纯 `--accent`。10px 按钮命中区与拖动逻辑未改。

## 变更路径

- `apps/web/src/styles.css`
- `apps/web/src/paneSplit.test.ts`

## 测试先行记录（TDD）

| Spec ID / 行为项 | 测试 | 先失败 | 后通过 | 说明 |
|---|---|---|---|---|
| V-1 | CSS `::after` height + 居中 translate | 否 | 是 | 与样式同批 |
| V-2 | hover 为 accent/border mix | 否 | 是 | 断言无纯 `--accent` |
| V-reg / V-static | web test + typecheck | — | 是 | 20 files / 289；tsc 0 |

## 验证

| 命令 | 验证层 | 结果摘要 / 证据 |
|---|---|---|
| `pnpm --filter web test` | unit | 20 files / 289 passed |
| `pnpm --filter web typecheck` | static | 退出码 0 |

## 目标分支同步（最终 Review 前）

- 目标分支及提交: `origin/main` `fb41f4097617e49d012d8dc6a8de5749ad0a6068`
- 同步后源分支 HEAD: `623383daf10ce2689a9c532ae329a982bf34f6d7`
- 同步方式: N/A
- 冲突及处理: N/A
- 同步后复验: `pnpm --filter web test` 20/289；typecheck 0

## 文档影响

| 类别 | 已更新路径或交接说明 |
|---|---|
| 开发文档 | N/A |
| 用户文档 | N/A |
| 运维文档 | N/A |

## 未解决风险 / 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 真机深色对照 | 本会话未开浏览器点悬停 | 仍偏亮或柄偏短 | 深色下载一页看栏间短柄 |

## QA 修复回执

| 缺陷 ID | 处理 | 摘要 | 验证证据 | 建议复测范围 |
|---|---|---|---|---|
| | | | | |

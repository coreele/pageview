# Dev Notes: chrome-content-gap

## 实现摘要

去掉 `--chrome-meta-h` 与 `.chrome-meta` 的 `min-height`，竖直 padding 收到 `0.18rem / 0.2rem`。`.main` 改为 `padding: 0.2rem 0.4rem 0.4rem`、`gap: 0.4rem`，统计条下不再露出大块 `--bg`。

**未合入 `main`。** 用户取消本项；`d7dd8f3` 已随源分支丢弃。

## 变更路径

- `apps/web/src/styles.css`
- `apps/web/src/chromeToggle.test.ts`

## 测试先行记录（TDD）

| Spec ID / 行为项 | 测试 | 先失败 | 后通过 | 说明 |
|---|---|---|---|---|
| V-1 | 无 `--chrome-meta-h` / meta `min-height` | 否 | 是 | 与样式同批 |
| V-2 | `.main` 顶距 `0.2rem` | 否 | 是 | 同批 |
| V-reg / V-static | web test + typecheck | — | 是 | 20 files / 295；tsc 0 |

## 验证

| 命令 | 验证层 | 结果摘要 / 证据 |
|---|---|---|
| `pnpm --filter web test` | unit | 20 files / 295 passed |
| `pnpm --filter web typecheck` | static | 退出码 0 |

## 目标分支同步（最终 Review 前）

- 目标分支及提交: 本地 `main` `c8f1f24488d7306802af56b07f77cb9efa609884`
- 同步后源分支 HEAD: `d7dd8f37935259e0b2824135ee88238dce78cd00`
- 同步方式: N/A
- 冲突及处理: N/A
- 同步后复验: `pnpm --filter web test` 20/295；typecheck 0

## 文档影响

| 类别 | 已更新路径或交接说明 |
|---|---|
| 开发文档 | N/A |
| 用户文档 | N/A |
| 运维文档 | N/A |

## 未解决风险 / 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 真机对照 | 无浏览器工具 | 仍空或过贴 | 深色 Tree 开着看统计条下沿 |

## QA 修复回执

| 缺陷 ID | 处理 | 摘要 | 验证证据 | 建议复测范围 |
|---|---|---|---|---|
| | | | | |

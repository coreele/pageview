# Dev Notes: ci-drop-e2e

## 实现摘要

从 `.github/workflows/ci.yml` 删除整个 `e2e` job。本地 `package.json` 的 `test:e2e`、`playwright.config.ts` 与 `e2e/` 未动。README 双语改为 CI 两个 job，并写明 Playwright 仅本地跑。

## 变更路径

- `.github/workflows/ci.yml`
- `README.md`、`README.zh-CN.md`

## 测试先行记录（TDD）

| Spec ID / 行为项 | 测试 | 先失败 | 后通过 | 说明 |
|---|---|---|---|---|
| V-1 无 e2e job | 读 ci.yml job 名 | N/A | `unit`、`integration` 仅此两个 | YAML 删除，无单测；对照文件 |

## 验证

| 命令 | 验证层 | 结果摘要 / 证据 |
|---|---|---|
| 读 `.github/workflows/ci.yml` | static | job 仅为 `unit`、`integration` |
| 读 `package.json` | static | `"test:e2e"` 仍在 |
| 读 README 双语 | static | CI 两个 job；`pnpm test:e2e` 仍在 Development 命令块 |

## 目标分支同步（最终 Review 前）

- 目标分支及提交: `origin/main` = `d652856`
- 同步后源分支 HEAD: `6e30d03`
- 同步方式: rebase
- 冲突及处理: N/A
- 同步后复验: ci.yml 仍无 e2e job

## 文档影响

| 类别 | 已更新路径或交接说明 |
|---|---|
| 开发文档 | README.md、README.zh-CN.md |
| 用户文档 | N/A |
| 运维文档 | N/A |

## 未解决风险 / 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| N/A | | | |

## QA 修复回执

| 缺陷 ID | 处理 | 摘要 | 验证证据 | 建议复测范围 |
|---|---|---|---|---|
| | | | | |

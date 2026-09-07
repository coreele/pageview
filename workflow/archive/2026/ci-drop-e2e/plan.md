# Plan: ci-drop-e2e

## 元信息

- 依据 Spec: N/A
- 依据 Design: N/A
- 依据 UI: N/A
- 路径等级: fast
- Review 门禁: skipped（fast：删除 CI job，对照 YAML/README 即可）
- 最低验证层: static
- 验证命令: `rg -n '^  e2e:' .github/workflows/ci.yml` 无匹配；README 双语不再声称 CI 跑 e2e job；`python3 -c` 或目视 YAML 仍含 `unit` 与 `integration`
- 预期证据: ci.yml 仅两 job；本地 `test:e2e` 脚本仍在 package.json

## 目标摘要

从 GitHub Actions 去掉 `e2e` job，停止把失败的 Playwright 跑进 CI。本地 Playwright 命令与套件不动。

## 任务拆解

1. 删除 `.github/workflows/ci.yml` 的 `e2e:` job（含 postgres service、playwright cache/install、`pnpm test:e2e`、失败 artifact）。
2. 更新 `README.md` / `README.zh-CN.md`：CI 改为两个 job（unit + integration）；保留本地 `pnpm test:e2e` 说明。
3. 自验：ci.yml 无 e2e job；package.json 仍有 `test:e2e`。

## 依赖与顺序

T1 → T2 → T3

## 触碰路径

- `.github/workflows/ci.yml`
- `README.md`、`README.zh-CN.md`
- 禁触：`e2e/**`、`playwright.config.ts`、根 `test:e2e` 脚本

## 验收与验证

| ID | 要求或命令 | 预期证据 | 结果（实施后填） |
|---|---|---|---|
| V-1 | ci.yml 无 `e2e` job | 文件中无 job 名 `e2e` | |
| V-2 | unit 与 integration 仍在 | 两 job 步骤未删 | |
| V-3 | 本地 `pnpm test:e2e` 仍可用 | `package.json` scripts 保留 | |
| V-4 | README 双语 CI 描述为两 job | 不再写 Chromium/`e2e` job | |

## 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| N/A | | | |

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | README.md / README.zh-CN.md Development；dev-notes.md |
| 用户文档 | N/A——无产品行为 |
| 运维文档 | N/A——CI 变更即 ci.yml + README |

## 交接顺序

1. Developer 实施与自验 →
2. Reviewer（skipped）→
3. QA 验收 →
4. 用户授权合并 → Manager 第三阶段 → 合入 → 归档

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-09-07 | 初稿 |

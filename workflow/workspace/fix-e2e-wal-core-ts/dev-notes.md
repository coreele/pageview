# Dev Notes: fix-e2e-wal-core-ts

## 实现摘要

Playwright API webServer 改为 `pnpm exec tsx src/index.ts`（`cwd=apps/server`）。CI 用 Node 20，无法 ESM 加载 `wal-core` 的 `src/index.ts` 导出；本地 Node 24 的 type stripping 会把同一路径跑到 `listen`，所以本地原先绿、Actions 红。tsx 与 `dev:server` 一致。未改 workspace 包 exports。

## 变更路径

- `playwright.config.ts`：`node dist/index.js` → `pnpm exec tsx src/index.ts`
- README 双语未写死 `node dist`，未改

## 测试先行记录（TDD）

| Spec ID / 行为项 | 测试 | 先失败 | 后通过 | 说明 |
|---|---|---|---|---|
| V-1 根因 | Node 20.20.2 执行 `apps/server` 的 `node dist/index.js` | 是：`ERR_UNKNOWN_FILE_EXTENSION` `.ts` `packages/wal-core/src/index.ts` | 对照项，不修 `node dist` | 无法为 Playwright 起进程写单测；用 CI 同版本 Node 复现。风险：仅命令级。替代：CI e2e job |
| V-2 tsx 加载 | Node 20.20.2 + `tsx src/index.ts` `PORT=8798` | N/A（修复路径） | `Server listening at http://127.0.0.1:8798` | 同上 |

## 验证

| 命令 | 验证层 | 结果摘要 / 证据 |
|---|---|---|
| `nvm exec 20 -- node dist/index.js`（cwd `apps/server`，先 `pnpm --filter server build`） | build | 失败：`Unknown file extension ".ts"` for `packages/wal-core/src/index.ts`（与 Actions `WebServer` 日志一致；Node v20.20.2） |
| Node 20 + `tsx/dist/cli.mjs src/index.ts` `PORT=8798` | build | 通过：`Listening on http://127.0.0.1:8798`，无 `ERR_UNKNOWN_FILE_EXTENSION` |
| `pnpm --filter web build` | build | 通过：vite built `dist/assets/index-B8wpTOWK.js` 302.78 kB，56 modules |
| `pnpm test:e2e` | integration | 11 passed (46.5s)。本机 `reuseExistingServer`（8787 已被 `MainThread` 占用），因此套件绿证明回归，不证明 CI 会新拉 tsx 进程。CI 实跑见缺口 |

## 目标分支同步（最终 Review 前）

- 目标分支及提交: `origin/main` = `4f4ce1f`
- 同步后源分支 HEAD: `e9a49df`
- 同步方式: rebase
- 冲突及处理: N/A（已与 origin/main 齐）
- 同步后复验: 配置 diff 仍为 tsx 命令；未再跑全套 e2e

## 文档影响

| 类别 | 已更新路径或交接说明 |
|---|---|
| 开发文档 | README 无需改；本文件 |
| 用户文档 | N/A |
| 运维文档 | N/A |

## 未解决风险 / 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| Actions `e2e` 实跑 | 未 push | CI 上 tsx/PATH 仍可能失败 | push / 合入后看 e2e job |
| 本地未强制新拉 webServer | 8787 已被占用，未杀用户进程 | 未在本机演练 Playwright 启动子进程 tsx | CI `reuseExistingServer: false` |

## QA 修复回执

| 缺陷 ID | 处理 | 摘要 | 验证证据 | 建议复测范围 |
|---|---|---|---|---|
| | | | | |

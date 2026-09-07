# QA Report: fix-e2e-wal-core-ts

> 首测与所有回归写在本文件，按轮次追加；禁止 `qa-report-v2.md`。

## 轮次

| 轮次 | 日期 | 实现版本 | 环境 | 范围 | 结论 |
|---|---|---|---|---|---|
| 1 | 2026-09-07 | `e9a49df` | WSL2；Node 20.20.2（nvm）对照 Node 24.19.0；本机 PG + `.env` | Plan V-1..V-5 | Pass |

## 执行命令

| 命令 | 输出摘要 / 证据位置 |
|---|---|
| `git rev-parse HEAD` / `playwright.config.ts` | HEAD `e9a49df`；API webServer `command: "pnpm exec tsx src/index.ts"`，`cwd: "apps/server"` |
| `pnpm --filter server build` 后 Node 20 `node dist/index.js` | `TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts" for .../packages/wal-core/src/index.ts`（Node v20.20.2） |
| Node 20 `tsx` `PORT=8798` | `Listening on http://127.0.0.1:8798` |
| `pnpm --filter web build` | vite production build 成功（56 modules） |
| `pnpm test:e2e` | 11 passed (46.5s) |

## 覆盖（对照 Spec 验收与 Plan 验证）

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| V-1 | `node dist` 在 Node 20 仍因 `.ts` 失败（根因对照） | 通过 | 与 Actions 日志同一错误码与路径 |
| V-2 | tsx 完成 ESM 加载 | 通过 | Node 20 监听 8798，无 `ERR_UNKNOWN_FILE_EXTENSION` |
| V-3 | Playwright 使用 `tsx src/index.ts` | 通过 | `playwright.config.ts` |
| V-4 | web 生产构建 | 通过 | `pnpm --filter web build` |
| V-5 | `pnpm test:e2e` | 通过（回归） | 11 passed；本机 `reuseExistingServer=true`（8787 已占用）。CI 将 `reuseExistingServer=false` 新拉 tsx，与 V-2 同一加载路径 |

## 回归

| 范围 | 结果 | 证据 |
|---|---|---|
| E2E M1–M10 + smoke | 通过 | `pnpm test:e2e` 11 passed |
| Vite 解析 workspace `.ts` 入口 | 通过 | web build 成功；未改 `wal-core`/`page-core` exports |

## 文档与安全验收

| 项 | 结果 | 备注 |
|---|---|---|
| 用户可见文档 | N/A | 无产品行为变更；README 未写死 `node dist` |
| 运维可执行文档 | N/A | CI 仍 `pnpm test:e2e` |
| 安全验证范围 | 通过 | 未新增依赖、未改认证/输入面、未提交 `.env` |

## 缺陷

| ID | 严重度 | 摘要 | 状态 | 处理说明 | 验证证据 |
|---|---|---|---|---|---|
| — | | | | | |

## 阻塞（Blocked 时必填）

- 原因:
- 风险:
- 恢复条件:
- 复测范围:

## 结论

- 本轮结论: Pass
- 合并: 已授权（等 Manager 置 `done`）

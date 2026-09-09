# QA Report: docs-dev-background

> 首测与所有回归写在本文件，按轮次追加；禁止 `qa-report-v2.md`。

## 轮次

| 轮次 | 日期 | 实现版本 | 环境 | 范围 | 结论 |
|---|---|---|---|---|---|
| 1 | 2026-09-09 | `9e6354bcb1772acacf277aeb983c1c9d93b5d602` | WSL2；8787/5173 已后台监听 | Plan V-1..V-5 | Pass |
| 2 | 2026-09-09 | `a49f7777b181e97825ad28492aacc88743792ed9` | rebase onto `main` `7f54bd6` | 同步后复验 README + 端口 | Pass |

## 执行命令

| 命令 | 输出摘要 / 证据位置 |
|---|---|
| `git rev-parse HEAD` | `9e6354bcb1772acacf277aeb983c1c9d93b5d602`（轮次 1）；rebase 后 `a49f7777b181e97825ad28492aacc88743792ed9` |
| 通读 `README.md` / `README.zh-CN.md` Quick start + Troubleshooting | 后台两行、日志路径、`kill %1 %2`、`HTTP_500` 行均在 |
| `ss -tln \| grep -E '5173\|8787'` | 两端口 LISTEN |
| `curl --noproxy '*' -w '%{http_code}' http://127.0.0.1:5173/api/session` | 200，`connected: true` |

## 覆盖（对照 Spec 验收与 Plan 验证）

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| V-1 | 英文后台启动可复制 | Pass | Quick start 含 `pnpm dev:server >/tmp/pageview-server.log 2>&1 &` 与 web 对应行、URL、停止 |
| V-2 | 中英一致 | Pass | 同一命令、端口、日志路径；说明语句对译 |
| V-3 | `HTTP_500` 排查 | Pass | 指向 8787 未起、先 `pnpm dev:server`、5173 只代理 `/api` |
| V-4 | 文档 A.3 要素 | Pass | 对象=本地开发者；前置=`pnpm install`；步骤=前台/后台块；预期=8787/5173；失败=`HTTP_500` 行 |
| V-5 | 本机两端口 + 代理 session | Pass | LISTEN + HTTP 200 |

## 回归

| 范围 | 结果 | 证据 |
|---|---|---|
| 原前台双终端命令仍在 | Pass | `# Foreground — two terminals` / `# 前台 — 两个终端` 下仍为 `pnpm dev:server` / `pnpm dev:web` |
| 未改 package.json / 应用代码 | Pass | 实现提交只动两份 README |
| rebase 后标题与 main 对齐 | Pass | `# PAGEVIEW`；后台命令块未丢；与 `9e6354b` 的 diff 仅为标题 |

## 文档与安全验收

| 项 | 结果 | 备注 |
|---|---|---|
| 用户可见文档 | Pass | README 为开发启动说明；无功能合同变更 |
| 运维可执行文档 | Pass | 命令可复制；日志在 `/tmp`，不入库 |
| 安全验证范围 | Pass | 无新凭据、无新依赖、无新监听地址 |

## 缺陷

| ID | 严重度 | 摘要 | 状态 | 处理说明 | 验证证据 |
|---|---|---|---|---|---|
| | | | | | |

## 阻塞（Blocked 时必填）

- 原因:
- 风险:
- 恢复条件:
- 复测范围:

## 结论

- 本轮结论: Pass
- 合并: 已授权（等 Manager 置 `done`）

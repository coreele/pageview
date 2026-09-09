# Plan: docs-dev-background

## 元信息

- 依据 Spec: N/A
- 依据 Design: N/A
- 依据 UI: N/A
- 路径等级: fast
- Review 门禁: skipped（fast：双语 README 增补启动说明）
- 最低验证层: manual（无代码路径可单测；验证为文档命令可复制、要素齐全、与实跑端口一致）
- 验证命令:
  - 通读 `README.md` / `README.zh-CN.md` 快速开始与故障排查
  - `ss`/`curl` 确认本机已按该方式后台监听 `8787` 与 `5173`
- 预期证据: 两份 README 含后台启动步骤、预期 URL、停止方式、以及「仅 web」时的 `HTTP_500` 处理；本机两端口在听且 `/api/session` 经 5173 代理为 200

## 目标摘要

开发者能从 README 复制命令，在同一终端后台拉起 API（8787）与 Vite（5173），并知道只起前端时会出现 `HTTP_500`。不新增 npm 脚本或依赖。

## 任务拆解

1. **T1** 英文 `README.md` Quick start：保留前台双终端写法；补后台两行（stdout/stderr 重定向到 `/tmp/pageview-server.log` 与 `/tmp/pageview-web.log`，`&`）；写预期 URL、须两进程都在、同 shell `kill %1 %2` 停止。完成条件：读者不看聊天也能后台启动。
2. **T2** `README.zh-CN.md` 快速开始同等内容。完成条件：中英步骤与路径一致。
3. **T3** 两边 Troubleshooting 增加 `HTTP_500` / “Check the server is running on 127.0.0.1”：原因是 8787 未起，5173 只代理 `/api`。
4. **T4** 对照文档核对本机已后台运行的 server/web。

## 依赖与顺序

T1 → T2 → T3 → T4

## 触碰路径

- 修改：`README.md`、`README.zh-CN.md`
- 禁触：`package.json` 脚本、应用代码、CI

## 验收与验证

| ID | 要求或命令 | 预期证据 | 结果（实施后填） |
|---|---|---|---|
| V-1 | README 英文含后台 `dev:server` / `dev:web`、日志路径、预期 URL、停止方式 | Quick start 可复制 | |
| V-2 | README 中文与英文步骤、端口、日志路径一致 | 对照两文件 | |
| V-3 | 故障排查含仅 web 时的 `HTTP_500` | 指向先起 `pnpm dev:server` | |
| V-4 | 文档 A.3：对象/前置/步骤/预期/失败 | Quick start + Troubleshooting 覆盖 | |
| V-5 | 本机按该方式：8787 与 5173 在听，经 5173 的 `/api/session` 为 200 | `ss` + `curl --noproxy '*'` | |

## 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| N/A | | | |

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | `README.md`、`README.zh-CN.md` Quick start + Troubleshooting |
| 用户文档 | N/A——无产品功能变更；README 开发启动说明属开发文档 |
| 运维文档 | N/A——不改 `workflow/ops/`；后台启动写在仓库 README |

## 交接顺序

1. Developer 实施与自验 →
2. Reviewer（本项 skipped）→
3. QA 验收 →
4. 用户授权合并 → Manager 第三阶段文档提交（`done`）→ 合入 → 归档

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-09-09 | 初稿 |

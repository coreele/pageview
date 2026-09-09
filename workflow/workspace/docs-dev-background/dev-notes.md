# Dev Notes: docs-dev-background

## 实现摘要

双语 README Quick start 增加同一终端后台启动：`pnpm dev:server` / `pnpm dev:web` 重定向到 `/tmp/pageview-*.log` 后 `&`；注明 5173 代理 `/api` 到 8787、同 shell `kill %1 %2`。Troubleshooting 增加仅 web 时的 `HTTP_500`。未改 `package.json`。

## 变更路径

- `README.md`
- `README.zh-CN.md`

## 测试先行记录（TDD）

| Spec ID / 行为项 | 测试 | 先失败 | 后通过 | 说明 |
|---|---|---|---|---|
| V-1..V-4 文档合同 | 通读两份 README | 实施前 Quick start 只有前台两行 | 两文件均含后台命令、日志路径、`kill %1 %2`、`HTTP_500` 行 | 无代码可单测 |
| V-5 实跑端口 | `ss` + `curl` 经 5173 `/api/session` | 本会话曾只有 5173（HTTP_500） | 8787+5173 LISTEN；session 200 `connected:true` | 进程由本会话后台拉起 |

## 验证

| 命令 | 验证层 | 结果摘要 / 证据 |
|---|---|---|
| 对照 README 字符串 | manual | 两文件均含 `dev:server >/tmp/pageview-server.log`、`HTTP_500`、`kill %1 %2` |
| `ss -tln \| grep -E '5173\|8787'` | manual | 两端口 LISTEN |
| `curl --noproxy '*' http://127.0.0.1:5173/api/session` | manual | HTTP 200，`connected: true` |

## 目标分支同步（最终 Review 前）

- 目标分支及提交: `main` / `7f54bd62c128ca3a5a3da4be0dc08c778e9c1f35`（rebase 后）
- 同步后源分支 HEAD: `a49f7777b181e97825ad28492aacc88743792ed9`
- 同步方式: rebase
- 冲突及处理: N/A（rebase 无冲突；stash pop 后 STATUS 自动合并）
- 同步后复验: README 仍含后台命令与 `HTTP_500`；标题为 `# PAGEVIEW`；8787/5173 LISTEN；`/api/session` 经 5173 为 200

## 文档影响

| 类别 | 已更新路径或交接说明 |
|---|---|
| 开发文档 | `README.md`、`README.zh-CN.md` |
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

# 工作项: fix-e2e-wal-core-ts

描述: GitHub Actions `e2e` job 中 Playwright webServer 启动 `node apps/server/dist/index.js` 后，Node 20 ESM 加载 `wal-core` 的 `src/index.ts` 入口失败（`ERR_UNKNOWN_FILE_EXTENSION`）。改为用 `tsx` 启动 E2E API 进程，与 `dev:server` 一致，使 workspace 包的 TypeScript 入口可解析。
目标分支: main
源分支: fix-e2e-wal-core-ts
基线提交: 4f4ce1f2bc7d9aee62c44c5949555476332d60e6
文档影响: README / README.zh-CN Development 节若写死 `node dist` 则同步；否则 N/A。

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/archive/2026/fix-e2e-wal-core-ts/`。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| fast | skipped | not-required | skipped | skipped |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| archived | | | | |

## 进度笔记

- 2026-09-07 Manager 登记。路径 `fast`：CI 单点工具链失败，症状与验收明确。Spec skipped：无产品行为/公开接口合同变更。Design skipped：无模块边界或选型决策。Review skipped：fast，以命令级复现与修复证据验收。用户贴出 Actions 日志即启动。
- 2026-09-07 Planner 完成 `plan.md`。进入 `developing`。第一阶段文档提交后调度 Developer。
- 2026-09-07 Developer：`playwright.config.ts` 改为 tsx；提交 `e9a49df`。Review skipped → QA。
- 2026-09-07 QA 轮次 1 Pass（`e9a49df`）。进入 `merge-approval`，待用户授权合并。
- 2026-09-07 用户授权合并（「ok」）。状态 `done`。第三阶段提交纳入 `dev-notes.md` / `qa-report.md`。
- 2026-09-07 FF 合入 `main`（`4f4ce1f..94d9adb`）。归档至 `workflow/archive/2026/fix-e2e-wal-core-ts/`。

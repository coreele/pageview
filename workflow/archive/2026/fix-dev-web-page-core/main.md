# 工作项: fix-dev-web-page-core

描述: 修复 `pnpm dev:web`（Vite）启动失败：无法解析 workspace 包 `page-core`（`Failed to resolve entry for package "page-core"`）。最小范围使 Vite 能解析 `page-core` 并正常启动开发服务。
目标分支: main
源分支: fix-dev-web-page-core
基线提交: 97b4f0570c3e41821976ff211ce2feb47570323b
文档影响: 已归档至 `workflow/archive/2026/fix-dev-web-page-core/`（`dev-notes.md`、`qa-report.md`）；含 `page-core` 入口改为 `./src/index.ts` 与 README Run 说明。

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/archive/2026/fix-dev-web-page-core/`。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| fast | skipped | not-required | skipped | skipped |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| archived |  |  |  |  |

## 进度笔记

- 2026-09-07 工作流迁移：机制改为 `workflow/WORKFLOW.md` + `workflow/agents/`；本记录由 `manager.md` 转为 `main.md`，产物平铺到 `workflow/archive/2026/fix-dev-web-page-core/`。旧状态机名称（awaiting-*-approval 等）按新枚举对齐。
- 历史字段 UI 表面: none（新模板已取消该列）。

## Plan（用户请求即确认范围）

用户 `/manager` 请求已明确验收与约束，视为 Plan 已确认（2026-07-27）：

1. 根因调查方向（勿臆断，以证据为准）：`page-core` 的 `main`/`module`/`exports`/`types` 指向不存在的 `dist`；未 build；或 Vite 未 alias/解析 workspace 源码。
2. 最小改动使 `pnpm dev:web` 可启动并解析 `page-core`；不做无关重构。
3. 验证：`pnpm dev:web` 启动成功，且不再出现 `Failed to resolve entry for package "page-core"`。
4. 不提交 commit，除非用户另有要求。

## 合并核验（2026-07-27）

用户同意继续处理（「ok」）。Manager 核验结果：

| 证据 | 结果 |
|---|---|
| 源分支 tip | `fix-dev-web-page-core` = `3e789ff` |
| `main` 是否含该 commit | **是**（`git log main` 含 `3e789ff fix(web): resolve page-core entry for Vite dev`） |
| `main..fix-dev-web-page-core` | **空**（源分支无独有未合入提交） |
| `packages/page-core/package.json` on main | 入口已指向源码（修复已在树中） |

结论：**实现已合入 `main`，无需再执行 Merge Executor**。执行归档收尾。

# Plan: fix-e2e-wal-core-ts

## 元信息

- 依据 Spec: N/A
- 依据 Design: N/A
- 依据 UI: N/A
- 路径等级: fast
- Review 门禁: skipped（fast：单点工具链修复，L2 命令复现即可）
- 最低验证层: build
- 验证命令: `pnpm --filter server build` 后 `node apps/server/dist/index.js` 应仍报 `.ts` 扩展名错误（对照根因）；改配置后 `pnpm --filter server exec tsx src/index.ts` 须通过模块加载；`pnpm --filter web build` 不回退；有 PG 时 `pnpm test:e2e`
- 预期证据: 根因命令复现 `ERR_UNKNOWN_FILE_EXTENSION`；tsx 启动不再出现该错误；web 生产构建成功

## 目标摘要

E2E 的 API webServer 改为 `tsx src/index.ts`，使 `wal-core`（及同类 workspace 包）的 `src/index.ts` 导出可被 Node 加载。不改 `wal-core` / `page-core` 的 exports（仍指向源码，以免回归 Vite `dev:web`）。

## 任务拆解

1. **T1** 将 `playwright.config.ts` 中 API webServer 的 `command` 从 `node dist/index.js` 改为 `pnpm exec tsx src/index.ts`（`cwd` 仍为 `apps/server`）。完成条件：配置指向 tsx；`reuseExistingServer` / URL / 超时不变。
2. **T2** 核 `package.json` 的 `test:e2e`：可保留 `pnpm --filter server build` 作为编译门（不依赖其产物启动）。README 双语若写死 `node dist` 则改一句；否则不改。
3. **T3** 自验：复现根因；tsx 加载通过；`pnpm --filter web build`；有 PG 则 `pnpm test:e2e`。

## 依赖与顺序

T1 → T2 → T3

## 触碰路径

- 修改：`playwright.config.ts`；必要时 `README.md` / `README.zh-CN.md`
- 禁触：`packages/wal-core/package.json` 与 `packages/page-core/package.json` 的 exports；`apps/server/src/**`；产品 UI

## 验收与验证

| ID | 要求或命令 | 预期证据 | 结果（实施后填） |
|---|---|---|---|
| V-1 | `pnpm --filter server build && node apps/server/dist/index.js` | 仍为 `ERR_UNKNOWN_FILE_EXTENSION` + `wal-core` `.ts`（根因对照） | |
| V-2 | `pnpm --filter server exec tsx src/index.ts`（可短超时或 Ctrl 前日志） | 不再出现 `ERR_UNKNOWN_FILE_EXTENSION`；进程能完成 ESM 加载 | |
| V-3 | Playwright API webServer 使用 `tsx src/index.ts` | `playwright.config.ts` 命令已改 | |
| V-4 | `pnpm --filter web build` | 成功（Vite 仍解析 workspace `.ts` 入口） | |
| V-5 | 有 PG 凭据时 `pnpm test:e2e` | 套件绿；无凭据则记缺口，不 skip 冒充通过 | |

## 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| Actions `e2e` 实跑 | 本角色未 push | CI 环境差异迟发现 | 合入/push 后看 `e2e` job |

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | README 仅当写死 `node dist` 时改；`dev-notes.md` 记复现与验证 |
| 用户文档 | N/A——无产品行为变更 |
| 运维文档 | N/A——CI 仍跑 `pnpm test:e2e` |

## 交接顺序

1. Developer 实施与自验 →
2. Reviewer（本项 skipped）→
3. QA 验收 →
4. 用户授权合并 → Manager 第三阶段文档提交（`done`）→ 合入 → 归档

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-09-07 | 初稿 |

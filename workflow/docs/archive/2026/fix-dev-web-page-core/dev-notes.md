# Dev Notes: fix-dev-web-page-core

## 实现说明

- 工作项: `fix-dev-web-page-core`（未拆分）；源分支 `fix-dev-web-page-core`（自 `main` 创建）
- 根因: `packages/page-core/package.json` 的 `main`/`types`/`exports` 指向 `./dist/*`，但 `packages/page-core/dist` 在仅 `pnpm install` 后不存在；`apps/web/vite.config.ts` 无 alias。Vite 解析 `page-core` entry 失败；web `tsc` 亦报 `Cannot find module 'page-core'`。
- 修复: 将 workspace 包入口改为源码 `./src/index.ts`（私有 monorepo，唯一消费者为 Vite 打包的 `apps/web`）。`page-core` 的 `build`（产出 `dist/`）仍可用于 L2 编译校验；**不**提交 `dist/`。
- TDD: 工具链入口修复，无自动化单测先行；以复现失败 → 改 exports → `dev:web`/`typecheck` 回归代替。恢复条件：可补 web 解析冒烟测。
- 切片目录无 `plan.md` 文件；Plan 已在工作项记录与用户请求确认。未改 Spec/Design/Plan/manager。未 commit（用户要求）。

## 变更路径

| 路径 | 变更 |
|---|---|
| `packages/page-core/package.json` | `main`/`types`/`exports` → `./src/index.ts` |
| `README.md` | Run：说明 `dev:web` 无需先 build `page-core` |
| `workflow/docs/features/fix-dev-web-page-core/dev-notes.md` | 本文件 |

## 验证证据

前置：`Test-Path packages/page-core/dist` → `False`（验证全程无 dist）。

| 命令 / 检查 | 结果 |
|---|---|
| 修复前症状（终端 `pnpm dev:web`） | `Failed to resolve entry for package "page-core"`（vite:import-analysis） |
| `pnpm --filter web typecheck` | 通过（exit 0） |
| `pnpm --filter page-core test` | 通过（31 tests） |
| `pnpm dev:web` | Vite ready；`http://localhost:5173/` |
| `GET /`、`/src/App.tsx`、`/src/diff.ts`、`/src/StructureMap.tsx`、`/src/HexDump.tsx` | HTTP 200；App 预转换将 `page-core` 解析为 `/@fs/.../packages/page-core/src/index.ts`；日志与响应中**无** `Failed to resolve entry for package "page-core"` |

**达到验证层:** 开发启动可用性（Plan 要求的 `dev:web` 解析成功）。

## 最短启动步骤

```bash
pnpm install
pnpm dev:web      # http://localhost:5173/ — 无需先 pnpm -r build
```

（连库浏览仍需另开 `pnpm dev:server` 与 `.env`。）

## 未验证项

| 未验证项 | 原因 | 风险 | 恢复条件 | 复测范围 |
|---|---|---|---|---|
| 浏览器端到端手测 | 本项仅验收 Vite 解析/启动 | 低：入口已解析到源码 | QA 打开 5173 点按既有 UI | `dev:web` + 可选 `dev:server` |
| `pnpm -r build` 全量 | 非本项最低验收 | 低：page-core `build`/`test` 未改语义 | 需要时跑 `pnpm -r build` | L2 发布前 |

## 文档影响

- 开发文档: `README.md` Run 前置说明；本 `dev-notes.md`
- 用户文档: N/A（无面向最终用户变更）
- 运维文档: N/A

## 建议复测（QA）

1. 干净态（无 `packages/page-core/dist`）下 `pnpm install` → `pnpm dev:web`
2. 确认无 `Failed to resolve entry for package "page-core"`，5173 可访问
3. 可选：连 `dev:server` 做一次 Load 冒烟

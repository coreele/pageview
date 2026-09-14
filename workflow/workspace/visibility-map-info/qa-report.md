# QA Report: visibility-map-info

> 首测与所有回归写在本文件，按轮次追加；禁止 `qa-report-v2.md`。

## 轮次

| 轮次 | 日期 | 实现版本 | 环境 | 范围 | 结论 |
|---|---|---|---|---|---|
| 1 | 2026-09-14 | `1499374` | 本地（无真实 PG） | 首测 | Pass |
| 2 | 2026-09-14 | `bb1a4c8` | 本地（无真实 PG） | 回归（label → VM） | Pass |

## 执行命令

| 命令 | 输出摘要 / 证据位置 |
|---|---|
| `pnpm -r typecheck` | 4 包全部 0 错误 |
| `pnpm -r build` | server tsc + web vite build 成功（dist 产出） |
| `pnpm test` | 609 通过：wal-core 13、page-core 174、server 99、web 323 |

## 覆盖（对照 Spec 验收与 Plan 验证）

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| P0-1 | 已启用 pg_visibility → visibility 端点 200 布尔 | Pass | `extension-auto-install.test.ts` P0-2/P0-6 响应断言（allVisible/allFrozen/pdAllVisible） |
| P0-2 | 缺失 → 自动安装 → 复查 → 200 | Pass | P0-2 用例（SQL 序列 + 200） |
| P0-3 | 42501 → 400 VISIBILITY_MISSING（非 403） | Pass | P0-3 用例 |
| P0-4 | web 展示三项布尔 | Pass（静态核对） | App.tsx meta-stats「visibility map」meta-item 渲染逻辑 + typecheck；DOM 交互见「验证缺口」 |
| P0-5 | VISIBILITY_MISSING → Install 按钮 → 安装后刷新 | Pass（静态核对 + API 单测） | App.tsx 按钮渲染/`installVm` + `api.test.ts` fetchVisibility/installExtension；DOM 交互见「验证缺口」 |
| P0-6 | 已启用 → 零 DDL | Pass | P0-6 用例（createStatements 为空） |
| P0-7 | install 端点（成功/未知 ext/失败） | Pass | install 3 用例 |
| P0-8 | README 双语 | Pass | grep 核对：Requirements/SQL/Scope/Troubleshooting 均含 pg_visibility 与 VISIBILITY_MISSING |
| P1-1 | 无负面缓存 | Pass | P1-1 用例 |
| P1-2 | 并发幂等 | Pass | P1-2 用例 |
| P1-3 | 复查未通过 → VISIBILITY_MISSING | Pass | P1-3 用例 |
| P1-4 | 越界/非 heap 不触扩展 | Pass | P1-4 两条用例（sqlLog 无 pg_visibility/pg_extension/CREATE EXTENSION） |
| P1-5 | 0 行 → 全 false | Pass | P1-5 用例 |
| P1-6 | 无 VM fork → false | Pass | P1-6 用例 |

## 回归

| 范围 | 结果 | 证据 |
|---|---|---|
| 全仓单测 | Pass | `pnpm test` 609/609（四包全绿，既有用例零破坏） |
| 类型与构建 | Pass | `pnpm -r typecheck`、`pnpm -r build` 零错误 |

## 文档与安全验收

| 项 | 结果 | 备注 |
|---|---|---|
| 用户可见文档 | Pass | README.md / README.zh-CN.md 双语一致 |
| 运维可执行文档 | N/A | 无运维脚本变更 |
| 安全验证范围 | Pass | 新端点先 401；`ext` 白名单；坏输入先于扩展使用；安装失败不泄漏为 403 |

## 缺陷

| ID | 严重度 | 摘要 | 状态 | 处理说明 | 验证证据 |
|---|---|---|---|---|---|
| — | | | | | |

## 验证缺口（不阻塞 Pass，已登记）

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| server 集成烟测 pg_visibility 段 | 需真实 PG（`.env`） | 「DROP → 端点自动重装」端到端链路未本机验证 | CI integration job 或 `pnpm test:integration` |
| web 渲染 DOM 行为（按钮点击/刷新） | 无 React 组件测试基建 | 交互链路仅静态核对 | Playwright e2e 或手动冒烟 |

## 阻塞（Blocked 时必填）

- 无

## 轮次 2 说明

- 变化: 仅 `apps/web/src/App.tsx` meta-stats 标签 `visibility map` → `VM`；不影响 Spec P0/P1 任何合同项与既有验证证据。
- 复验: `pnpm -r typecheck` / `pnpm -r build` / `pnpm test`（609/609）均通过；P0-4/P0-8 相关展示与文档仍满足（标签更短，语义不变）。

## 结论

- 本轮结论: Pass（`bb1a4c8`）
- 合并: 待用户授权（等 Manager 置 `done`）

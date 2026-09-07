# Dev Notes: e2e-playwright

## 实现说明

- T1：根 `@playwright/test@1.63.0`；`playwright.config.ts` 双 webServer（server dist :8787 + vite preview :4173）；`globalSetup` 种子 schema `pageview_e2e`（heap_multi ≥8 页、btree、empty、hash、WAL 窗口），失败打印 `E2E blocked:` 并非零退出；`globalTeardown` DROP schema。配置加载时删除 `HTTP_PROXY`/`http_proxy`（本机 7890 代理让 Node 就绪探测得 502）。
- T2–T5：`e2e/smoke.spec.ts` 与 `m1`/`m7`/`m2-m4-m5`/`m6-m8-m9`/`m10`/`m3.spec.ts`。选择器：`select.table-select`、`role=alert`、`.chrome-badge.badge-conn`、表单 label。URL 由 `e2e/helpers/url.ts` 按 `buildUrlState` 规范拼装；oid 读种子文件。M3 自管 sanitized 栈（空串凭据、PORT=8790、preview 4174）。
- T6：`ci.yml` 新增 `e2e` job（postgres:16、扩展、Playwright cache、`playwright install --with-deps chromium`、`pnpm test:e2e`、失败上传 `playwright-report/`）。Actions 实跑待 push。
- T7：README 双语 Development 增加 E2E 命令与三 job 说明。

Plan 禁触 `apps/web/src` 的例外：已连接挂载路径里 `refreshTables`/`refreshIndexes` 的 `setError(null)` 会清掉 `BAD_URL_PARAM`（P0-8）。改为 `preserveRawUrlRef.current` 为真时保留错误。无此修复 M4 在 `.env` 自动连接下恒红。

## 验证证据

| 命令 | 结果 |
|---|---|
| `pnpm exec playwright test` | **11 passed**（52.7s），覆盖 M1–M10 + smoke |
| 故意破坏 | smoke heading → `pg-page-viewer-BREAK` → 1 failed → 还原 → smoke **1 passed**（3.5s） |
| `pnpm test` | wal-core 13 + page-core 158 + server 81 + web 198 = **450** 全绿 |
| `pnpm -r typecheck` / `pnpm -r build` | 4 包 0 错误 |
| `pnpm test:integration` | L3 smoke OK，exit 0 |

## 无法执行

| 项 | 原因 | 风险 | 恢复 |
|---|---|---|---|
| CI e2e job 实跑 | 本角色禁 push | YAML/缓存配置错误迟发现 | 分支 push 后 Actions 绿再补认 |

## QA 修复回执

| 缺陷 ID | 处理 | 摘要 | 验证 | 建议复测 |
|---|---|---|---|---|
| — | — | — | — | — |

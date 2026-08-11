# Dev Notes: add-ci

## 实施摘要

| 任务 | 产出 | commit |
|---|---|---|
| T1 修根 test 脚本 | `package.json`：`pnpm --filter ... test` 链 → `pnpm -r test`（含 web） | `99221cb` |
| T2 wal-smoke 提升 | `apps/server/package.json` 增 `test:wal`；根增 `test:wal` 代理；`wal-smoke.ts` 头注释刷新 | `99221cb` |
| T3 ci.yml | `.github/workflows/ci.yml` 双 Job（unit + integration） | `52bcb68` |
| T4 文档同步 | `README.md` Development 章节 + `.env.example` 注释 | `52bcb68` |

## 关键决策

- **`pnpm -r test` 取代 filter 链**：topological 顺序、自动覆盖所有含 `test` 脚本的包、不会误跑 `test:integration`/`test:wal`（脚本名不同）。
- **PG16 而非 PG15**：`pg_walinspect` 自 PG16 是 contrib 自带，`CREATE EXTENSION` 即用；PG15 需编译安装，CI 中不划算。
- **种子表 `pageview_smoke`**：`integration-smoke.ts:43-47` 要求至少一个 `blocks>0` 的 heap 表；1000 行 INSERT 同时为 `wal-smoke` 的 recent-window 提供 WAL 活动。
- **凭据用 DATABASE_URL 单变量**：`readEnvCredentials`（session.ts:75）优先解析 DATABASE_URL；CI step `env:` 注入一行即可。
- **services health check 用 `pg_isready -U postgres`**：比默认 `pg_isready` 更明确，确保服务 ready 后才跑 smoke。

## 验证证据

| 层 | 命令 | 结果 |
|---|---|---|
| L2 typecheck | `pnpm -r typecheck` | 4 包 Done |
| L2 unit test | `pnpm test` | 81 tests passed（page-core 31 / wal-core 13 / server 17 / web 20） |
| L2 build | `pnpm -r build` | 全部 Done（web vite build OK） |
| 优雅退出 | `pnpm test:wal`（无 .env） | exit=2 + "WAL L3 blocked: no credentials" |
| YAML 合法性 | `python3 yaml.safe_load` | jobs=['unit','integration']，结构正确 |

## 未覆盖的验证（交 QA / Reviewer 确认）

- **L3 CI 实跑**：GitHub Actions 真实跑通需 push 到 `add-ci` 分支后观察 Actions 面板。本地无法验证 service container + 扩展 + 种子 + smoke 的端到端链路。这是本工作项的核心 L3 证据缺口，阻塞 QA Pass。
- **L3 WAL smoke**：本地无 PG16 + pg_walinspect 实例，`test:wal` 的成功路径（recent-window 探测、R3 硬错误）未本地复跑，依赖 CI integration Job。

## 偏离与备注

- 无偏离 Plan 的实现。
- `README.md` 原 Development 章节用了 4 行 `pnpm --filter ...`（已过期），本次改为 `pnpm test` 单行 + 补充 `test:wal` 与 CI 说明——属事实同步，不改变任何合同。
- 未触碰源码逻辑（仅 scripts / workflow / docs / 注释）。

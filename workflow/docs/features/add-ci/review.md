# Review: add-ci

## 审阅范围

- 源分支：`add-ci`（领先 `main` 2 commits）
- 版本：`52bcb68`
- 相对 `main` 全量 diff（6 文件，+90/-9）
- Spec：N/A（门禁 skipped）
- Plan：`workflow/docs/features/add-ci/plan.md`（T1–T4）

## 结论

**Approve**

无阻塞项。实现与 Plan 一一对应、最小变更、无逻辑代码改动（仅 scripts / workflow / docs / 注释）。L2 本地证据齐全。L3（CI 实跑）为核心证据缺口，**不阻塞 Review**，交 QA 在合入前/后核验 GitHub Actions 面板。

## 逐项核验

| Plan 任务 | 实现 | 评价 |
|---|---|---|
| T1 修根 test 脚本 | `package.json:9` `pnpm --filter ...` 链 → `pnpm -r test` | ✅ topological，含 web，不误跑 `test:integration`/`test:wal`（脚本名不同）。本地验证 81 tests 全过（page-core 31 / wal-core 13 / server 17 / web 20） |
| T2 wal-smoke 提升 | `apps/server/package.json` 增 `test:wal`；根增代理；头注释刷新 | ✅ 无凭据 exit=2 + 清晰文案，不挂 CI（CI 中有 DATABASE_URL 走正常路径） |
| T3 ci.yml 双 Job | `.github/workflows/ci.yml`（74 行） | ✅ 见下「CI 配置审查」 |
| T4 文档同步 | `README.md` Development + `.env.example` 注释 | ✅ 命令与 script 一致，无过期信息 |

## CI 配置审查（T3 重点）

| 项 | 实际 | 评价 |
|---|---|---|
| 触发 | `push`/`pull_request` → `main` | ✅ 行业标准。**注意**：push 到 `add-ci` 分支本身不触发，需开 PR 才能在合入前验证（见 C1） |
| unit Job | checkout → pnpm action-setup(9.15.0) → setup-node(20, cache:pnpm) → `install --frozen-lockfile` → typecheck → test → build | ✅ 顺序合理；`cache: pnpm` 依赖根 `pnpm-lock.yaml`（已确认在 git 中且同步） |
| integration service | `postgres:16`，`POSTGRES_PASSWORD: postgres`（默认 user/db=postgres），端口映射 5432 | ✅ PG16 使 `pg_walinspect` 为 contrib 自带，免编译 |
| health check | `pg_isready -U postgres`，2s/5s/10retry（~20s 窗口） | ✅ postgres:16 实测 ~5-10s ready，窗口充足 |
| 扩展创建 | `CREATE EXTENSION IF NOT EXISTS pageinspect / pg_walinspect` | ✅ `postgres` 超级用户有权限；`IF NOT EXISTS` 幂等 |
| 种子数据 | `pageview_smoke` 1000 行 | ✅ 满足 `integration-smoke.ts:43-47` 的 `blocks>0` 前置；INSERT 产生 WAL 供 wal-smoke recent-window |
| env 注入 | job 级 `DATABASE_URL`，所有 step 继承 | ✅ psql 与 pnpm step 共用 |
| smoke 执行 | `pnpm test:integration` → `pnpm test:wal` | ✅ 顺序合理（Page 先，WAL 后，两者独立） |
| YAML 合法性 | `python3 yaml.safe_load` 解析通过 | ✅ jobs=['unit','integration'] |

## 安全审查

- ✅ 无硬编码密钥：`DATABASE_URL` 用 service 容器默认 `postgres:postgres`，非真实凭据。
- ✅ `.env.example` 仅加注释行，无密钥。
- ✅ 无 SQL 注入面：psql 命令为字面量，无用户输入插值。
- ✅ `psql` 在 `ubuntu-latest` runner 预装（`postgresql-client`），无需额外 setup。
- ✅ 未触碰 `app.ts` 的 CORS / 日志配置（本工作项范围外，留待安全专项）。

## 独立取证（L2）

| 检查 | 命令 | 结果 |
|---|---|---|
| typecheck | `pnpm -r typecheck` | 4 包 Done |
| 单元测试 | `pnpm test` | 81 passed |
| 构建 | `pnpm -r build` | 全 Done |
| 优雅退出 | `pnpm test:wal`（无 .env） | exit=2 |
| lockfile 同步 | `pnpm install --frozen-lockfile` | Already up to date |
| 工作树状态 | `git status` | 仅 workflow docs（预期，非源码） |

## 非阻塞 Comment（不回退 Approve）

- **C1（CI 触发策略）**：workflow 仅在 push/PR 到 `main` 时触发。要在合入前验证 CI，须开 PR（`add-ci` → `main`）——这是标准做法，实现正确。Plan P0-3 措辞「push 到 `add-ci` 分支后」略不精确，应为「开 PR 后」或「合入 `main` 后」。**建议 QA 阶段开 PR 触发首次实跑**。
- **C2（Job 依赖，可选优化）**：`integration` 未 `needs: unit`，两者并行。若 unit 失败，integration 仍会起 PG service（~30s 浪费）。对小型项目可接受；未来若 CI 排队变贵可加 `needs: unit`。本次不改。
- **C3（integration-smoke TEMP 表）**：`integration-smoke.ts:78` 用 `CREATE TEMP TABLE` 做 R1 回归——TEMP 表的 catalog 入口跨连接可见性依赖 PG 行为。此为**既有代码**（本 diff 未触碰），若 CI 首跑暴露问题再单开工作项，不属本次 Review 范围。

## 证据缺口（交 QA）

- **L3 CI 实跑**：GitHub Actions 端到端（service 起来 → 扩展 → 种子 → 两个 smoke 通过）须在 PR/合入后核验 Actions 面板。这是本工作项核心 L3，**阻塞 QA Pass**。
- **L3 WAL smoke 成功路径**：本地无 PG16+pg_walinspect，`test:wal` 的 200 路径（recent-window 探测、R3 硬错误）未本地复跑，依赖 CI integration Job。

## 范围确认

- 无 Spec（门禁 skipped），按 Plan P0-1..P0-6 验收条目核验：
  - P0-1 ✅ `pnpm test` 触发 4 包
  - P0-2 ✅ `test:wal` 无凭据 exit=2
  - P0-3 ⏳ CI unit Job（待 PR/合入实跑）
  - P0-4 ⏳ CI integration Job（待 PR/合入实跑）
  - P0-5 ✅ lockfile 未被改动
  - P0-6 ✅ README/.env.example 与 script 一致

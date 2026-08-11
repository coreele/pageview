# Plan: add-ci

## 元信息

- 工作项标识: add-ci
- 依据 Spec: N/A（Spec 门禁 skipped，工程基础设施无业务合同）
- 依据 Design: N/A（Design 门禁 skipped，无模块边界/分层/技术选型决策）
- 路径等级: standard
- Review 门禁: required
- 最低验证层: L3（集成 Job 必须真实起 PG 跑通两个 smoke）
- 验证命令:
  - 本地无 PG：`pnpm install && pnpm -r typecheck && pnpm test && pnpm -r build`
  - 本地有 PG（`.env` 就绪）：追加 `pnpm test:integration && pnpm test:wal`
  - CI：push 到源分支 `add-ci` 后 GitHub Actions 自动跑 unit + integration 两 Job

## 适用工程规范

- [文档工程](../standards/documentation.md)
- [Git 协作](../standards/git.md)
- [质量与验证](../standards/quality.md)
- [安全](../standards/security.md)

## 目标摘要

- 落地 GitHub Actions 双 Job CI：`unit`（无 PG，typecheck + 全量单元测试 + build）、`integration`（postgres:16 service container + 两个扩展，跑两个 smoke）。
- 修复根 `package.json` 的 `test` 脚本漏掉 web 包。
- 将 `wal-smoke.ts` 提升为正式 npm script 并纳入集成 Job。
- 不含 ESLint/Prettier（另开工作项）。

## 任务拆解

1. **T1 修根 `test` 脚本**：`package.json:9` 改为 `pnpm -r test`（topological，含 web，仅运行名为 `test` 的脚本，不会误跑 `test:integration`/`test:wal`）。完成条件：本地 `pnpm test` 触发 web 包的 vitest。
2. **T2 提升 `wal-smoke.ts` 为正式 script**：
   - `apps/server/package.json` 增 `"test:wal": "tsx src/wal-smoke.ts"`。
   - 根 `package.json` 增 `"test:wal": "pnpm --filter server test:wal"`。
   - 完成条件：`pnpm test:wal` 能从 `.env` 读凭据并执行（无凭据时以 exit 2 优雅退出，不挂 CI）。
3. **T3 新建 `.github/workflows/ci.yml`**：
   - 触发：`push` 与 `pull_request` 到 `main`。
   - Job `unit`（runs-on ubuntu-latest）：
     - `actions/checkout@v4`
     - `pnpm/action-setup@v4`（version 9.15.0，与根 `packageManager` 对齐）
     - `actions/setup-node@v4`（node-version 20，`cache: pnpm`）
     - `pnpm install --frozen-lockfile`
     - `pnpm -r typecheck`
     - `pnpm test`
     - `pnpm -r build`
   - Job `integration`（runs-on ubuntu-latest）：
     - `services.postgres`：image `postgres:16`，env `POSTGRES_PASSWORD: postgres`（默认 user/db = postgres），ports `5432:5432`，`options` 含 `pg_isready` health check（`--health-interval 2s --health-timeout 5s --health-retries 10`）。
     - 同上 checkout/pnpm/node/install。
     - 建扩展 + 种子数据（用 `postgres:postgres` 连 `localhost:5432/postgres`）：
       ```
       psql postgresql://postgres:postgres@localhost:5432/postgres -c "CREATE EXTENSION IF NOT EXISTS pageinspect; CREATE EXTENSION IF NOT EXISTS pg_walinspect;"
       psql ... -c "CREATE TABLE pageview_smoke (id int, payload text); INSERT INTO pageview_smoke SELECT g, md5(g::text) FROM generate_series(1,1000) g;"
       ```
       （种子保证 integration-smoke 的「至少一个 blocks>0 的 heap 表」前置；INSERT 产生 WAL 供 wal-smoke recent-window 探测）
     - 注入 env：`DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres`
     - `pnpm test:integration`
     - `pnpm test:wal`
   - 完成条件：两个 Job 均 `actions/run` exit 0。
4. **T4 同步文档**：
   - 根 `README.md`：若已有「本地测试」章节则核对 `pnpm test` / `pnpm test:integration` / `pnpm test:wal` 描述与脚本一致；无则补一小节说明 CI 存在与本地复跑入口。
   - `.env.example`：若未提及 `test:wal` 所需变量则补注释（变量已存在，仅说明用途）。
   - 完成条件：文档命令与实际 script 一致，无过期信息。

## 依赖与顺序

- T1、T2 互相独立，可同提交。
- T3 依赖 T1（CI 的 `pnpm test` 步骤要含 web）与 T2（CI 的 `pnpm test:wal` 要有 script 入口）。
- T4 最后。
- 建议单分支 `add-ci` 上按 T1+T2 → T3 → T4 推进，可分 1~2 个 commit。

## 触碰路径

- `package.json`（根 scripts）
- `apps/server/package.json`（scripts）
- `.github/workflows/ci.yml`（新增；`.github/` 目录新增）
- `README.md`（文档同步，按需）
- `.env.example`（注释，按需）

## 验收

> Spec 门禁 skipped，在此写可测条目（P0）。

- **P0-1**：`pnpm test`（本地无 PG）触发 page-core、wal-core、server、web 四个包的 vitest，全部通过。
- **P0-2**：`pnpm test:wal`（本地无 `.env`）以 exit 2 退出并打印 "WAL L3 blocked: no credentials"（不挂、不 exit 1）。
- **P0-3**：push 到 `add-ci` 分支后 GitHub Actions `unit` Job 通过（typecheck + test + build 全绿）。
- **P0-4**：`integration` Job 通过：postgres:16 service 起来、扩展创建成功、种子表写入、`test:integration` 打印 "L3 smoke OK"、`test:wal` 打印 "WAL L3 smoke OK"。
- **P0-5**：`pnpm-lock.yaml` 未被 CI 改动（`--frozen-lockfile` 通过）。
- **P0-6**：README/`.env.example` 与新 script 一致。

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | `README.md` 补/核对「测试」与「CI」小节；`workflow/docs/standards/quality.md` 若已声明 CI 守护则补命令，否则本次不改（留待 quality 专项）。 |
| 用户文档 | N/A（CI 对最终用户不可见；本地测试命令属开发者面）。 |
| 运维文档 | N/A（无部署变更；CI 配置本身即源代码，self-documenting）。 |

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-08-11 | Planner 起草。范围：CI 双 Job + 修 test 脚本 + wal-smoke 提升。不含 lint。 |

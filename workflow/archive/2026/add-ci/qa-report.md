# QA Report: add-ci

## 验收范围

- 工作项：`add-ci`（Plan P0-1..P0-6；Spec N/A）
- 源分支：`add-ci`（已 push 至 `origin/add-ci`，commit `52bcb68`）
- Review：Approve（无阻塞项；非阻塞 C1–C3）
- QA 执行者：独立上下文，不复用 Developer/Reviewer 证据

## 第一轮（2026-08-11）

### 独立 L2 复测

| 检查 | 命令 | QA 独立结果 | 与 Developer/Reviewer 一致？ |
|---|---|---|---|
| typecheck | `pnpm -r typecheck` | 4 包 Done | ✅ |
| 单元测试 | `pnpm test` | 81 passed（page-core 31 / wal-core 13 / server 17 / web 20） | ✅ |
| 构建 | `pnpm -r build` | 全 Done（web vite OK） | ✅ |
| test:wal 优雅退出 | `pnpm test:wal`（无 .env） | exit=2 + "WAL L3 blocked: no credentials" | ✅ |

**Plan P0 条目核验：**

| 条目 | QA 结论 |
|---|---|
| P0-1 `pnpm test` 触发 4 包 | ✅ Pass |
| P0-2 `test:wal` 无凭据 exit=2 | ✅ Pass |
| P0-5 lockfile 未被改动 | ✅ Pass（`pnpm install --frozen-lockfile` → Already up to date） |
| P0-6 README/.env.example 与 script 一致 | ✅ Pass |

### L3 CI 实跑（核心证据）

| 条目 | QA 结论 |
|---|---|
| P0-3 CI `unit` Job 通过 | **Blocked** |
| P0-4 CI `integration` Job 通过 | **Blocked** |

**阻塞原因：**

1. 源分支 `add-ci` 已 push 至 `origin/add-ci`（push 成功，回显 PR 创建链接）。
2. 但 `.github/workflows/ci.yml` 的触发条件为 `push: branches: [main]` 与 `pull_request: branches: [main]`——**push 到 `add-ci` 分支不触发 CI**（这正是 Review C1 指出的标准行为）。
3. QA 环境无法自动创建 PR：
   - `gh` CLI 未安装，且无 sudo 权限安装；
   - 无 `GITHUB_TOKEN` / `GH_TOKEN` 环境变量；
   - 无法通过 API 创建 PR。
4. 因此 CI 的端到端实跑（service 起来 → 扩展创建 → 种子 → 两个 smoke 通过）**无法在 QA 本轮取得证据**。

### 结论

**Blocked**

- L2 全部 Pass（P0-1, P0-2, P0-5, P0-6）。
- L3（P0-3, P0-4）因 CI 未触发而 Blocked，非实现缺陷，是验证条件未满足。

### 恢复条件

用户会话完成以下任一动作以触发 CI：

1. **开 PR**（推荐）：浏览器访问
   `https://github.com/coreele/pageview-private/pull/new/add-ci`
   创建 `add-ci` → `main` 的 PR，`pull_request` 触发器将运行两个 Job。
2. **或** 直接合入 `main`（本地 FF 或 GitHub 合并），`push: branches: [main]` 触发器将运行两个 Job。

CI 通过后，QA 追加第二轮回归确认 P0-3/P0-4，结论可转 `Pass`。

### 缺陷登记

无实现缺陷。仅 1 项验证条件阻塞（见上）。

### 复测范围（恢复后）

- 仅 L3：`unit` Job 与 `integration` Job 在 GitHub Actions 面板的运行结果（两者皆绿即 P0-3、P0-4 通过）。
- 无需重跑 L2（本轮已全绿，且恢复动作不触碰源码）。

## 第二轮（2026-08-11，恢复后 L3 回归）

### 触发动作

用户会话安装 `gh` CLI 并完成认证。QA 通过 `gh pr create` 创建 PR #1：
`https://github.com/coreele/pageview-private/pull/1`（`add-ci` → `main`）。
`pull_request: branches: [main]` 触发器运行了两个 Job。

### CI 运行结果（GitHub Actions run `31470389230`）

| Job | 状态 | 耗时 |
|---|---|---|
| `unit` | pass | 47s |
| `integration` | pass | 51s |

### 关键日志取证（`gh run view --log`）

**integration Job：**
- `Create extensions`：`CREATE EXTENSION` ×2（pageinspect + pg_walinspect）✓
- `Seed smoke table`：`CREATE TABLE pageview_smoke` + `INSERT ... generate_series(1,1000)` ✓
- `Run pnpm test:integration`：`L3 smoke OK: public.pageview_smoke blk 0 length=8192` ✓
- `Run pnpm test:wal`：`WAL L3 smoke OK` ✓

**unit Job：**
- wal-core：13 passed
- page-core：31 passed
- server：17 passed
- web：20 passed
- 合计 81 tests passed ✓

### Plan P0 全部条目最终结论

| 条目 | 第一轮 | 第二轮 | 最终 |
|---|---|---|---|
| P0-1 `pnpm test` 触发 4 包 | Pass | — | ✅ Pass |
| P0-2 `test:wal` 无凭据 exit=2 | Pass | — | ✅ Pass |
| P0-3 CI `unit` Job 通过 | Blocked | Pass（47s，81 tests） | ✅ Pass |
| P0-4 CI `integration` Job 通过 | Blocked | Pass（51s，两个 smoke OK） | ✅ Pass |
| P0-5 lockfile 未被改动 | Pass | — | ✅ Pass |
| P0-6 README/.env.example 一致 | Pass | — | ✅ Pass |

### 第二轮结论

**Pass**

- 全部 P0 条目（P0-1..P0-6）通过。
- 实现与 Plan 一致；Review C1–C3 非阻塞 Comment 不影响验收（C1 已通过本次 PR 触发实跑验证；C2/C3 为可选优化/范围外）。
- 无缺陷登记。

### 请求

QA 已取得完整 L2 + L3 证据，**请求用户合并授权**。授权后 Manager 在源分支 `add-ci` 将状态置 `done`，并将 STATUS/工作项记录与未入库的 `review.md` / `qa-report.md` **一次提交**（随功能一并合入 `main`）。

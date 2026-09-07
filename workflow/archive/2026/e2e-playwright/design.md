# Design: e2e-playwright

## 背景

url-deeplink QA 轮次 1 因环境无浏览器而 Blocked（M1–M10 无法执行，恢复路径 B 已获用户授权）。本工作项引入 Playwright 无头浏览器 E2E 能力：测试基建（配置、web/服务器编排、PG 种子、CI 接线）+ 首个套件自动化 url-deeplink 手测清单 M1–M10。无产品行为变更（Spec 门禁 skipped，范围以工作项记录为准）。

现状事实（设计前实测）：

- pnpm workspace：`apps/server`（fastify，`HOST`/`PORT` env，默认 127.0.0.1:8787；`index.ts` 依次 `config(../../.env)` + `config()`，listen 后 `tryAutoConnectFromEnv`）；`apps/web`（vite 6，dev 5173，`server.proxy` 硬编码 `/api → http://127.0.0.1:8787`）。
- `GET /api/session` 存在且不依赖连接状态——可作 server 就绪探测端点。
- M3「无 .env」形态可行：dotenv v16.4 `populate` 对已存在键（含空串）不覆盖；`readEnvCredentials`（session.ts:68-93）对空串 `DATABASE_URL`/`PGHOST` 等返回 null。给子进程注入**空串**凭据变量即可同时屏蔽本地 `.env` 与 CI 继承值，且不改 server 代码。
- PG 种子先例：integration-smoke 的 `pageview_smoke_*` schema——`DROP SCHEMA IF EXISTS CASCADE` 幂等重建、`finally` 清理。
- CI（ci.yml）两 job：`unit`（无 DB）+ `integration`（postgres:16 service，超级用户，psql 建扩展与种子表）。
- 环境验证：`@playwright/test@1.63` 类型确认 **webServer 仅顶层（可为数组），TestProject 无项目级 webServer**；bundled chromium 免 sudo 下载至 `~/.cache/ms-playwright` 并 headless 启动成功（实测 1.63.0 / Chrome 153）。
- url-deeplink URL 含 oid，oid 跨库不稳定——用例必须在运行时经 `::regclass` 发现种子对象 oid，不得硬编码。
- 本地 PG16.11 socket `/tmp:5432`；`.env` 在根，dev 即靠其自动连接；分支基线问题见「风险」。

## 方案对比与决策

| # | 方案 | 概要 | 优点 | 缺点 |
|---|---|---|---|---|
| 1a | Playwright 放仓库根 | 根 devDependencies `@playwright/test` + 根 `playwright.config.ts` + `e2e/` 目录 | 套件编排横跨 server+web 两个包，与根脚本先例（`test:integration`）一致；CI job 自根运行 | 根新增 devDeps（现状根无 devDeps） |
| 1b | 放 apps/web | web devDeps + `apps/web/e2e/` | 就近被测 UI | web 配置需拉起 server 包，跨包职责倒挂 |
| 2a | web 用 build+preview | `vite build` 后 `vite preview --port 4173 --strictPort` | 供生产 bundle（用户实际形态）、无 dev 期按需编译/依赖优化竞态、页面加载快 | 需 build 步骤（~10s）；preview 代理需配置 |
| 2b | web 用 dev server | `vite --port 5173` | 无 build、与手测形态一致 | 冷启动按需编译、CI 首访 optimizer 竞态是已知 flake 源；与发布形态有距离 |
| 3a | M3 双栈：spec 内自管理 | `e2e/helpers/m3-stack.ts` 以 `child_process` 拉起 sanitized server（PORT=8790）+ 第二 preview（4174，代理指向 8790），beforeAll/afterAll 生命周期 | 不依赖已确认不存在的项目级 webServer；M3 栈仅按需启动；顶层配置保持双 webServer | ~50 行 spawn/探测/teardown 助手 |
| 3b | 顶层 webServer 数组 4 进程 | 双栈常驻 | 纯配置 | 主栈用例也背 M3 开销；本地 reuse 残留双份进程 |
| 3c | 第二份 playwright 配置 | `playwright.m3.config.ts` 单独跑 M3 | 隔离清晰 | 配置重复维护、报告分裂 |
| 4a | PG 不可达 → loud fail | globalSetup 探测失败即非零退出并打印原因（沿 integration-smoke `exit 2` 先例） | 不静默 skip 冒充通过（quality.md §6） | 无法在无 PG 机器跑套件（预期行为） |
| 4b | PG 不可达 → skip 用例 | 条件跳过 | 表面绿 | 违反「不得静默 skip」约束 |
| 5a | CI 新增独立 `e2e` job | postgres:16 service + 浏览器缓存 + `pnpm test:e2e`，与既有两 job 并行 | 职责清晰；不拖慢既有 job | 新增 job 时长（预计 ~3-4 分钟） |
| 5b | 挂入 integration job | 同 job 串行追加 | 无新 job | 职责混杂、时长叠加、浏览器下载混入 DB job |

**决策：**

1. **位置 = 仓库根**（1a）：`playwright.config.ts`、`e2e/`（specs + `helpers/`）、根 devDependencies `@playwright/test`；e2e 类型检查经 `tsconfig.e2e.json`（`tsc -p tsconfig.e2e.json --noEmit`，纳入 `test:e2e` 链与 CI）。
2. **web 形态 = build + preview**（2a）：生产 bundle 即被测形态，消除 dev 编译竞态。`vite.config.ts` 将 proxy target 参数化为 `process.env.PAGEVIEW_API_TARGET ?? "http://127.0.0.1:8787"` 并显式设置 `preview.proxy`（消除 preview 代理继承不确定性）——纯构建配置变更，无产品行为影响。本地 dev 流程（5173→8787）不变。
3. **server 形态 = 构建产物**：`pnpm --filter server build` 后 `node dist/index.js`（经 `pnpm --filter server exec`，cwd=apps/server，`.env` 解析路径不变）；不用 `tsx watch`。
4. **M3 = spec 内自管理双栈**（3a）：sanitized server 注入空串 `DATABASE_URL`/`PGHOST`/`PGDATABASE`/`PGUSER`/`PGPASSWORD`（本地屏蔽 `.env`、CI 覆盖继承值 → `readEnvCredentials` 为 null → 无自动连接），`PORT=8790`；第二 `vite preview --port 4174 --strictPort` 复用同一 dist、`PAGEVIEW_API_TARGET=http://127.0.0.1:8790`；就绪探测轮询 `/api/session` 与 preview 首页；`test.use({ baseURL })` 覆写。连接面板凭据从 `readEnvCredentials`（e2e 直接 import `../apps/server/src/session.js` 复用，语义与被测 server 完全一致）取得。
5. **PG 不可达 = loud fail**（4a）：globalSetup 连接/种子失败 → 打印 `E2E blocked: ...` 后非零退出，绝不 skip 冒充通过。
6. **CI = 新增独立 `e2e` job**（5a）：复用 integration job 的 postgres:16 service 形态与 psql 建扩展步骤；`actions/cache` 缓存 `~/.cache/ms-playwright`（key 含 `hashFiles('pnpm-lock.yaml')`）；`pnpm exec playwright install --with-deps chromium`（runner 有免密 sudo；本地文档指引免 `--with-deps`，实测依赖已齐）；失败时 `upload-artifact` 上传 `playwright-report/`。

### 编排总览

- **主栈（顶层 webServer 数组，两项）**：① server：`pnpm --filter server exec node dist/index.js`，探测 `http://127.0.0.1:8787/api/session`；② preview：`pnpm --filter web exec vite preview --port 4173 --strictPort`，探测 `http://127.0.0.1:4173/`。`reuseExistingServer: !process.env.CI`。CI 凭据来自 job env `DATABASE_URL` 继承；本地来自根 `.env` 自动连接。
- **构建链**：根脚本 `test:e2e = server build && web build && tsc e2e && playwright test`（CI 直接调 `pnpm test:e2e`，单一路径防漂移）。
- **globalSetup**：复用 `readEnvCredentials`（本地 dotenv 读根 `.env` / CI 读 env）建立 pg 连接；幂等种子（见下）；globalTeardown DROP schema。探测失败 loud fail。
- **种子**（schema `pageview_e2e`，沿 `pageview_smoke_*` 先例）：heap 表 ~3000 行（多块，供 M1/M2/M6/M10 块间导航）；其 btree 索引（index 模式深链）；hash 索引 + 0 块空表（M9 守卫）；种子插入前后各取 `pg_current_wal_lsn()` 得 WAL 窗口（M2/M8/M9 WAL 深链，窗口内必有记录）。oid 由用例运行时 `SELECT '...'::regclass::oid` 发现。
- **稳定性策略**：`strictPort` 全部端口；断言一律 web-first 自动重试（`toHaveURL`/`getByRole`），禁 `networkidle`；`testTimeout 30s`（M3 文件放宽）、`expect 10s`；`retries: CI ? 1 : 0`；`trace: retain-on-failure`、screenshot/video `only-on-failure`、reporter `list + html`；`workers: CI ? 2 : 默认`、`fullyParallel: false`（文件内时序敏感流如 M6 历史链）。共享种子只读 → 跨文件并行安全。

## M1–M10 → Playwright 能力映射

| 项 | 行为 | Playwright 手段 |
|---|---|---|
| M1 | 地址栏时机（选择/切换即时、Load 成功 push、失败/未 Load 不写） | `expect(page).toHaveURL(精确串)`；选择变更后 URL 即变但 `page.goBack()` 不回退（replaceState 无新条目，行为级断言）；Load 失败后 URL 保持 |
| M2 | 已连接还原 + F5 + WAL 预填不覆盖 | `page.goto(含参URL)` → 视图/记录列表呈现断言（meta-stats、spinner 消隐）；`page.reload()` 同路径；WAL recent-20 预填保持 |
| M3 | 未连接还原 → 连接面板 → Connect → 自动加载 | 自管理 sanitized 栈（决策 4）；面板表单按 label 定位（Host/Port/Database/User/Password）；Connect 后同一还原路径断言 |
| M4 | `BAD_URL_PARAM` 三段式、默认视图可用、地址栏原样 | `page.getByRole('alert')` 断言冻结文案（code/message/Next:）；URL 保持原串；默认视图可操作 |
| M5 | 对象层失效（非表/非索引 oid、blkno 越界） | 构造非法 oid/blkno 的 URL → 既有错误码经 `role=alert` 断言 |
| M6 | 历史：块 5→7 后退/前进自动重载；同块重 Load 不新增历史 | `page.goBack()/goForward()` + `toHaveURL` + 视图重载断言；同块重复 Load 后 `goBack()` 直达前一不同条目（无空跳，行为级，不依赖 `history.length`） |
| M7 | 裸 URL 回归 | `goto(baseURL)` → 默认视图、连接探测、无自动加载 |
| M8 | LSN round-trip（`%2F` 与 `/` 双形态） | 以两种编码形态构造 URL goto → 还原；`page.url()` 复制到新 page goto → 等价还原 |
| M9 | P1 抽核（规范化/等价/单 LSN/无 blkno/守卫不发请求/静默丢弃） | URL 等价性断言（`?foo=1&mode=wal` ≡ 规范串）；单 LSN 仅预填不加载；守卫用 `page.on('request')` 计数断言零 `/api/...` 页请求 |
| M10 | 双 tab 并排对照、分享直达 | 同 context `context.newPage()`（或新 context）两个独立 page 各自加载/改块，互不干扰断言 |

## 模块影响

- 新增：根 `playwright.config.ts`、`tsconfig.e2e.json`、`e2e/`（specs、`helpers/db.ts`、`helpers/m3-stack.ts`、global-setup/teardown）；根 devDependencies；`.gitignore` 追加 `playwright-report/`、`test-results/`（`.tmp-*` 已有）。
- 修改：`apps/web/vite.config.ts`（proxy target 参数化 + `preview.proxy`）；根 `package.json` scripts；`.github/workflows/ci.yml`（新 job）；`README.md` / `README.zh-CN.md` Development 节。
- 不触碰：server 源码、web 源码（App 组件零变更，选择器全部复用既有 ARIA/role/label，无需 data-testid）、url-deeplink 全部文档。

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| **分支基线**：url-deeplink 尚未合入 main，工作项记录源分支「自 main 创建」 | 自 main 创建则 M1–M10 用例必然红（深链代码不在） | 提交用户裁决：e2e-playwright 自 `url-deeplink` tip 创建（推荐，套件即 QA 轮次 2 证据载体），合并顺序 url-deeplink 先入 main |
| preview 与 dev 形态差异 | 行为等价性存疑 | 深链逻辑全在应用代码，两形态 bundle 同源；preview 即发布形态，验收口径不弱于手测 |
| e2e 直接 import server `session.ts`（含其 `pg` 依赖解析） | Playwright 加载器解析失败则 helper 失效 | 文件级解析（apps/server/node_modules）按 pnpm 布局应可达；备选：db.ts 内 20 行等价凭据解析器（Plan 记录降级路径） |
| WAL 窗口内记录不可用（检查点/回收） | M2/M8 WAL 断言失败 | 窗口=种子刚写入的记录，立即消费；断言 ≥1 条而非精确计数 |
| CI runner 浏览器系统依赖缺失 | e2e job 红 | `--with-deps`（runner 免密 sudo）+ 二进制缓存；本地实测依赖已齐 |
| CI 接线无法在 push 前实证 | YAML/缓存配置错误迟发现 | 本地跑等价命令 + YAML 结构对照既有 job；Actions 实跑证据在分支 push 后、合并前补认 |
| 偶发 flake（时序/端口） | 假阴性 | web-first 重试断言、strictPort、CI retries=1、trace 留档定位 |

## 对 Plan 与 Developer 的要点

### Plan

- 任务序列：基建（含 vite.config.ts 变更与冒烟用例）→ M1–M10 全量 → CI → 文档；TDD 性质说明（对已交付行为的断言，验证方式=用例失败可检 + 至少 1 次故意破坏实证）。
- 分支基线为 Plan 确认门禁的待确认事项（见风险首行）。
- 最低验证层：新 L4（浏览器 E2E）+ L2/L3 回归不回退。

### Developer

- 断言优先用既有可访问选择器（`role=group`/`aria-pressed` 模式与种类钮、`role=alert` 错误面板、连接表单 label、`chrome-badge`、`meta-stats`）；禁止为测试改动组件代码。
- oid 一律运行时发现；URL 期望串用 helper 按 urlState 规范拼装，不手写魔法串。
- M3 凭据注入必须用**空串**（非 unset）；teardown 必须杀干净双进程。
- 种子/清理仅经 `pageview_e2e` schema；失败 loud，不得以 skip 兜底。

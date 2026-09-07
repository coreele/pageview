# Plan: e2e-playwright

## 元信息

- 工作项标识: e2e-playwright
- 依据 Spec: N/A（Spec 门禁 skipped——纯测试基础设施，无产品行为/公开接口/错误合同变更；范围以 [工作项记录](../../manager/e2e-playwright.md) 为准）
- 依据 Design: workflow/docs/features/e2e-playwright/design.md
- 路径等级: standard
- Review 门禁: required
- 最低验证层: L4（浏览器 E2E——本工作项即建立该层）+ 既有 L2/L3 回归不回退
- 验证命令: `pnpm install` → `pnpm exec playwright install chromium`（一次性）→ `pnpm test:e2e`；回归 `pnpm test && pnpm -r typecheck && pnpm -r build && pnpm test:integration`
- UI/UX: N/A（UI 表面 none；不触碰产品 UI，选择器复用既有 ARIA/role/label）

## 适用工程规范

- [文档工程](../standards/documentation.md)
- [Git 协作](../standards/git.md)（仅 Git 工作区）
- [质量与验证](../standards/quality.md)
- [安全](../standards/security.md)

## 目标摘要

建立 Playwright 无头 E2E 基建（根配置、server+preview 双 webServer 编排、PG 幂等种子、CI 接线），并以首个套件自动化 url-deeplink 手测清单 M1–M10（[ui-design.md](../url-deeplink/ui-design.md)），解阻 url-deeplink QA 轮次 2。**TDD 说明**：M1–M10 为已交付行为（url-deeplink 分支实现）的断言性用例，「先红后绿」不适用；验证方式为**用例失败可检**——断言所锚定的 URL/历史/DOM 契约被破坏时用例变红，并以下述 T7 的故意破坏实证一次红→绿闭环。

## 任务拆解

1. **T1 基建落地**：根 devDependencies `@playwright/test`；`playwright.config.ts`（双 webServer：server dist + preview 4173、globalSetup/Teardown、超时/重试/trace/报告，见 design 决策）；`tsconfig.e2e.json`；根 scripts `test:e2e`（server build && web build && e2e tsc && playwright test）；`.gitignore` 追加 `playwright-report/`、`test-results/`；`apps/web/vite.config.ts` proxy target 参数化（`PAGEVIEW_API_TARGET`）+ `preview.proxy`；`e2e/helpers/db.ts`（复用 `apps/server/src/session.ts` 的 `readEnvCredentials`、幂等种子 `pageview_e2e`：多块 heap 表 + btree + hash + 0 块表 + WAL 窗口、oid 发现）；冒烟 spec（title + connected badge + 种子表可见）。完成：`pnpm test:e2e` 冒烟绿；本地 dev（5173→8787）行为不回退。
2. **T2 M1+M7 用例**：地址栏时机（选择/切换即时、Load 成功 push、失败/未 Load 不写、后退不回退）与裸 URL 回归。完成：两文件用例绿，断言含精确 URL 串与行为级历史判定。
3. **T3 M2+M4+M5 用例**：已连接还原 + F5 + WAL 预填不覆盖；`BAD_URL_PARAM` 冻结文案三段式 + 地址栏原样 + 默认视图可用；对象层失效（非表/非索引 oid、blkno 越界）既有码。完成：全绿，`role=alert` 断言与 ui-design 冻结表逐字一致。
4. **T4 M6+M8+M9 用例**：历史链（块 5→7 后退/前进自动重载、同块重 Load 无空跳）；LSN `%2F`/`/` 双形态 round-trip；P1 抽核（规范化、`?foo=1` 等价、单 LSN 不加载、无 blkno 加载块 0、守卫零请求、index 静默丢弃）。完成：全绿，守卫以请求计数断言。
5. **T5 M10+M3 用例**：双 tab 并排对照互不影响；M3 sanitized 双栈（空串凭据 env、PORT=8790、preview 4174）连接面板流 → Connect → 自动还原。完成：M3 用例在「无自动连接」形态下绿，teardown 双进程净退。
6. **T6 CI 接线**：ci.yml 新增 `e2e` job（postgres:16 service + psql 建扩展 + node20/pnpm + `actions/cache` `~/.cache/ms-playwright`（key 含 lockfile hash）+ `pnpm exec playwright install --with-deps chromium` + `pnpm test:e2e` + 失败上传 `playwright-report/` artifact）。完成：YAML 与既有 job 结构对照无误、本地等价命令全绿；Actions 实跑证据待分支 push 后补认（见「无法执行验证」）。
7. **T7 文档与证据**：README.md / README.zh-CN.md Development 节增 E2E 小节（前置：可达 PG + `.env`/`DATABASE_URL`、一次性 `playwright install chromium`、`pnpm test:e2e`、CI 三 job 说明，双语对齐）；dev-notes.md 记录验证证据 + **故意破坏验证**（临时改 1 处用例期望 → 套件红 → 还原 → 绿，不留痕）。

## 依赖与顺序

T1 → T2 → T3 → T4 → T5（用例依基建与选择器 helper 递进；M3 栈最后因依赖对主栈行为的理解）→ T6（依赖全套件稳定）→ T7（汇总证据）。T2–T5 之间无强依赖，但按此序控制回归面。

## 触碰路径

- 新增：`playwright.config.ts`、`tsconfig.e2e.json`、`e2e/**`（specs + `helpers/` + global-setup/teardown）
- 修改：`package.json`（devDeps + scripts）、`pnpm-lock.yaml`、`.gitignore`、`apps/web/vite.config.ts`、`.github/workflows/ci.yml`、`README.md`、`README.zh-CN.md`、`workflow/docs/features/e2e-playwright/dev-notes.md`
- 禁触：`apps/server/src/**`、`apps/web/src/**`、url-deeplink 与本工作项的既有流程文档

## 验收

> 无 Spec（skipped）；验收=工作项记录范围 + 本节可测条目。

- `pnpm test:e2e` 全绿，覆盖 M1–M10 逐项（映射见 design「M1–M10 → Playwright 能力映射」表）；
- 冒烟与回归全绿：`pnpm test`、`pnpm -r typecheck`、`pnpm -r build`、`pnpm test:integration` 零回退；
- 故意破坏验证红→绿一次，记录于 dev-notes.md；
- M3 在无自动连接形态下经连接面板完成还原（P0-7 形态）；
- CI e2e job 定义完整（Actions 实跑为合并前补认项）；
- README 双语 E2E 小节对齐且命令可复现。

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | `README.md` / `README.zh-CN.md` Development 节（E2E 命令与前置、CI 说明）；`dev-notes.md`（验证证据） |
| 用户文档 | N/A——无用户可见行为变更（README 功能节不受影响） |
| 运维文档 | N/A——无部署/监控面；CI 变更即 `.github/workflows/ci.yml` 自身，README Development 已述 |

## 无法执行验证时的原因、风险与恢复条件

| 情形 | 处置 | 恢复条件 |
|---|---|---|
| PG 不可达 | globalSetup loud fail（非零退出 + `E2E blocked` 原因），**不得 skip 冒充通过** | `pg_ctl -D ~/pgdata` 启动（本地）/ service 就绪（CI） |
| 无法下载浏览器（离线/网络受限） | 记录障碍于 dev-notes；本地套件无法运行 | 网络恢复或 `PLAYWRIGHT_DOWNLOAD_HOST` 镜像；CI 有缓存+`--with-deps` |
| CI 无显示器 | 非阻塞：chromium 默认 headless（本地已实测免 sudo 下载+启动） | N/A |
| CI job 实跑证据（禁 push 于本角色） | YAML 静态对照 + 本地等价命令替代；风险=缓存/依赖配置错误迟发现 | 分支 push 后 Actions 绿截图/日志补认于 QA 前 |

## 交接

1. Developer：完成 T1–T7，dev-notes 记录证据 → 提请 Reviewer；
2. Reviewer（门禁 required）：`review.md` 出 Approve（重点：测试有效性——用例是否真锚定 M1–M10 契约、是否存在恒真断言；文档影响一致性）；
3. QA：独立验收本工作项（复跑命令 + 抽查用例断言强度 + 文档），出 `qa-report.md`；**url-deeplink QA 轮次 2 复用本套件输出作为 M1–M10 证据**（其 qa-report.md 追加轮次 2，优先项 P0-7/P0-11/M8 由套件覆盖，F3/F4 观察项可查 trace 留档）；
4. 用户授权合并（先 url-deeplink 入 main，e2e-playwright 随后，见 design 风险首行）。

**待确认事项（Plan 确认门禁）**：e2e-playwright 源分支基线建议自 `url-deeplink` tip 创建（工作项记录现写「自 main」，但深链实现未入 main，自 main 创建则 M1–M10 必红）；需用户裁决后由 Manager 持久化。

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-09-07 | 初稿（Planner，依据 design.md 与工作项记录） |

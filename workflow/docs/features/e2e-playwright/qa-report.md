# QA Report: e2e-playwright

> QA 独立验收。依据：工作项记录（Spec skipped）+ `plan.md` 验收条目 + `design.md` M1–M10 映射。结论：**Pass**。

## 轮次

| 轮次 | 日期 | 范围 | 结论 |
|---|---|---|---|
| 1 | 2026-09-07 | 首测：Plan 验证命令 + M1–M10 断言抽查 + README/CI YAML + 安全 | Pass |

## 第 1 轮（2026-09-07）

实现版本：源分支 `e2e-playwright` HEAD `33dc7d5`（另含 `6dd36e0`），基线 `url-deeplink` tip。环境：Node v24.19.0；PostgreSQL 16.11 `/tmp:5432`；`@playwright/test@1.63.0`。Review：**Approve**（工作区 `review.md`）。入口：Plan 已确认；Review 门禁 required 已满足。

### 独立复测（本会话执行，非转述）

| 检查 | 命令 | 结果 |
|---|---|---|
| L4 E2E | `pnpm test:e2e` | **11 passed**（49.7s）：smoke、M1、M2、M3、M4、M5、M6、M7、M8、M9、M10 |
| 单测 | `pnpm test` | **450 passed**（wal-core 13、page-core 158、server 81、web 198） |
| 类型检查 | `pnpm -r typecheck` | 四包 Done |
| 构建 | `pnpm -r build` | 四包成功（web vite OK） |
| L3 | `pnpm test:integration` | L3 smoke OK，exit 0 |

### Plan 验收逐项

| 条目 | 结果 | 证据 |
|---|---|---|
| `pnpm test:e2e` 全绿，覆盖 M1–M10 | Pass | 上表 11 例；文件：`e2e/m1.spec.ts`、`m7`、`m2-m4-m5`、`m6-m8-m9`、`m10`、`m3.spec.ts` |
| L2/L3 回归不回退 | Pass | 450 + typecheck + build + integration |
| 故意破坏红→绿记于 `dev-notes.md` | Pass | 记录 smoke heading → `pg-page-viewer-BREAK` → 1 failed → 还原 → 1 passed。源码无残留 `pg-page-viewer-BREAK`（仅 dev-notes 提及） |
| M3 无自动连接形态经连接面板还原 | Pass | `e2e/m3.spec.ts`：sanitized 栈 → disconnected + heading `Connect` → 填凭据 Connect → `waitPageBlk(page, 5)`；本轮 12.0s 绿 |
| CI `e2e` job 定义完整 | Pass（YAML） | `.github/workflows/ci.yml`：postgres:16、扩展、lockfile cache `~/.cache/ms-playwright`、`playwright install --with-deps chromium`、`pnpm test:e2e`、失败上传 `playwright-report/`。Actions 实跑见「无法执行」 |
| README 双语 E2E 小节且命令可复现 | Pass | `README.md` / `README.zh-CN.md` Development：`playwright install chromium`、`pnpm test:e2e`（可达 PG + `.env`/`DATABASE_URL`）、CI 三 job。本轮按该命令跑通 |

### 断言强度抽查（对照 ui-design M1–M10）

抽查结论：断言锚定 URL search、DOM、`role=alert` 冻结文案或网络计数，非恒真。

| ID | 抽查 | 结果 |
|---|---|---|
| M1 | 选择后精确 search；`blkno` 未 Load 不写；Load push 到 `blkno=5`；越界失败 URL 不变；`goBack` 回到选择态 | Pass |
| M2 | 直开块 5 → `reload` 仍块 5；WAL 输入框值 = 种子 LSN | Pass |
| M3 | 见上；URL 保留 `table=` | Pass |
| M4 | `mode=xyz` / `table=abc` / `blkno=-1` / `startLsn=ZZ` 与冻结 message、`BAD_URL_PARAM`、`Next:` 共用句、地址栏 search 原样、默认 heading 可用 | Pass（缺 `kind` 行，见观察项） |
| M5 | `NOT_HEAP_TABLE` / `NOT_INDEX` / `BLKNO_OUT_OF_RANGE` | Pass |
| M6 | 5→7 → `goBack` 块 5 → `goForward` 块 7；Refresh 后再 `goBack` 到块 5（无空跳） | Pass |
| M7 | search `""` +「Select a heap table to begin.」+ 无 Page statistics | Pass |
| M8 | helper 编码 URL 加载后复制到新 tab 还原；`startLsn`/`endLsn` 含 `/` 的 query 亦可加载 | Pass |
| M9 | `?foo=1&mode=wal` 归一为 `mode=wal` 且 not loaded；单 LSN 预填不加载；无 blkno → 块 0；empty/hash 守卫 `pageReqs === []` | Pass |
| M10 | 双 tab 块 5 vs 7；第三 tab 打开 tab A URL 后三者仍独立 | Pass |

### 无法执行（已记录，非静默跳过）

| 未验证项 | 原因 | 风险 | 恢复条件 | 复测范围 |
|---|---|---|---|---|
| GitHub Actions `e2e` job 实跑（Review F4） | 本角色禁 push；Plan 验收将 Actions 标为**合并前补认**，YAML + 本地 `pnpm test:e2e` 为本轮替代 | 缓存 key / `--with-deps` / Node 20 vs 本地 24 差异迟发现 | 源分支 push 或开向 `main` 的 PR 后 Actions `e2e` 绿 | 仅 Actions 面板三 job；无需重跑本地 L2/L4 |

不因此将本轮判 Blocked：Plan「无法执行验证」表与验收条目标明 YAML + 本地等价命令可进 QA Pass。

### 观察项（非缺陷、不阻塞 Pass）

| ID | 摘要 |
|---|---|
| O1（Review F2） | M4 未覆盖冻结表 `kind="xyz"` 行 |
| O2 | M1 未单测 index/WAL Load 成功 URL 与 mode/kind 切换 replace（T2「切换即时」）；M2/M9 有相邻路径 |
| O3（Review F1） | `App.tsx` 两行 `preserveRawUrlRef` 为 Plan 禁触例外；M4 依赖该守卫 |

### 文档与安全

- 开发文档：README 双语命令与三 job 说明与实现一致；`dev-notes.md` 含验证与缺口表。用户/运维文档 N/A（Plan）。
- 安全：无硬编码真实凭据；M3 运行时读 env；`e2e/.seed.json` gitignore。CI `postgres:postgres` 同 integration job。新增依赖仅 `@playwright/test@1.63.0`。无未解决安全问题，允许在授权后合并（就安全而言）。

## UI/UX

> 无本项 `ui-design.md`（`UI 表面=none`）。套件对照 url-deeplink `ui-design.md`，见断言抽查。

| 检查项 | 结果 | 证据 |
|---|---|---|
| Spec 界面相关验收 | N/A | 本项 Spec skipped |
| `workflow/docs/standards/ui.md` 底线 | N/A | 不改产品 UI（F1 两行错误保留，非布局） |
| `ui-design.md` | N/A | 本项无 |

## 缺陷

无。

## 结论

- 总体: **Pass**
- 恢复条件: N/A
- 合并: **待用户授权**。质量门禁已满足（Plan 确认 + Review Approve + QA Pass）。合入顺序：先 `url-deeplink` 入 `main`，再合 `e2e-playwright`。本项 `done` 前建议先做 url-deeplink QA 轮次 2（复用本套件作 M1–M10 证据）。Actions `e2e` 绿为合入前补认。QA 不提交本报告。

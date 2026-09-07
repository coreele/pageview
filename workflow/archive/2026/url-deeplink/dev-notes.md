# Dev Notes: url-deeplink

实施者：Developer（依据 plan.md T1–T7，2026-09-05）。分支 `url-deeplink`（自 `main` 4ab965b 创建）。

## 任务与提交

| 任务 | 提交 | 摘要 |
|---|---|---|
| T1 | （无代码） | 分支创建；基线 `pnpm test`（web 136 + server 81）与 `pnpm -r typecheck` 全绿 |
| T2 | b17b272 | `urlState.ts` parse/build（46 红测先行）；校验镜像 BAD_OID / BAD_BLKNO / wal-core LSN_RE；未知参数忽略；wal 丢弃 kind；LSN `%2F` 与裸 `/` 双形态 |
| T3 | a5d0a8d | `planRestoreActions`（16 红测先行）：wait 门控、load-table/index/wal（blkno 缺省 0）、0 块表与非 B-tree 守卫、不在列表仍加载、过滤器不一致静默丢弃 |
| T4 | 4a6db3a | App 还原接线：挂载解析一次、`pendingRestore`、`tablesFetched`（refreshTables finally）、单一 restore effect（connected+列表门控）、`loadWalRange` 抽取、WAL 预填抑制（P0-6）、`restoreEpochRef` 防 StrictMode 双发 |
| T5 | 74f591b | 同步与历史：3 处 Load 成功提交点 push 标记、集中 sync effect（相等不写）、`urlLoaded` 快照、popstate 复用还原路径（P0-11）、模式/种类 handler 零改动 |
| T6 | 本文件 | L2/L3 输出摘录 + 手测缺口记录（见下） |
| T7 | 同分支后续提交 | README 双语（Features 深链句 + 示例 URL；Troubleshooting `BAD_URL_PARAM`） |

## 验证证据（2026-09-05，分支 url-deeplink @ 74f591b 之后全量复跑）

- `pnpm test`：wal-core 13 + page-core 158 + server 81 + web 198 = **450 全绿**（web 含 urlState 62：parse 合法/非法矩阵、冻结文案逐字、canonical 输出、round-trip、还原判定矩阵）
- `pnpm -r typecheck`：0 错误（4 包全部 Done）
- `pnpm -r build`：0 错误（web bundle 302.76 kB / gzip 91.65 kB）
- `pnpm test:integration`：**退出 0**（L3 smoke、B-tree oracle、auto-install 段零回退；本项纯 web 变更，L3 无新增对象——plan 论证成立）
- 环境事实：PG16.11 socket `/tmp:5432` 在运行；`.env` 存在（未打印内容）

## TDD 说明（T4/T5 无自动化测试的原因）

仓库 vitest 为 node 纯模块环境，无 jsdom / 组件测试基建（沿 `indexView.test.ts` 等先例）；design 决策 1 与 plan 明确「浏览器行为走手测清单，不为单项引入基建」。T4/T5 的判定逻辑全部下沉 `urlState.ts` 纯函数并已红测覆盖；App 层为胶水（effect 接线），按 plan 由 M1–M10 手测覆盖（当前缺口见下）。风险：接线错误只能由手测捕获；恢复条件：浏览器环境补测 M1–M10。

## 实现要点与竞态处理（供 Review 对照 design）

1. **`urlLoaded` 快照替代派生（对 design 决策 2 派生式的必要修正）**：design 原文按「pageView != null 时 loadedBlkno」派生，但既有 Load 失败路径会置空 `pageView`/`loadedBlkno`（P1-1 视图语义，未改动），该派生将导致失败后 URL 丢失 blkno，违反 P0-13（失败地址栏不变）。故 URL 的已加载侧（blkno / WAL 区间）由独立快照 `urlLoaded` 承载：仅在 3 处 Load 成功点写入；选择类失效（`resetPageView`、`onSelectTable`、WAL 模式进入、还原应用）清除对应侧；失败路径永不触碰。
2. **双侧快照**：既有语义下模式切换保留两侧视图（pageView / walRangeMeta 均不清），故 `urlLoaded` 分 page 侧（blkno）与 wal 侧（LSN 对）独立清除/写入，build 按模式取用侧，切换后 URL 与保留视图一致。
3. **还原期间乐观快照**：restore effect 按计划动作预置 `urlLoaded`（load-table/index → blkno；load-wal → LSN 对；none → 清），使加载在途时派生 query 与地址一致——避免中间态 replace 掉初始历史条目（P0-4/F5「地址栏参数保持」）；自动加载失败时地址保留所请求视图（P0-13 语义延伸）。
4. **`urlSyncTick`**：同块 Refresh 成功时目标串不变、memo 依赖（字符串）相等，effect 不会重跑，push 标记会滞留污染下一次写。3 处提交点同时自增 tick 强制 effect 重跑：相等 → 仅清标记不写（同块 Refresh 零重复历史）；不等 → push。
5. **`syncReady` 门控**：`pendingRestore != null` 期间不写地址（含 P0-7 未连接等待、popstate→还原在途），防止把深链/目标条目 replace 掉。
6. **popstate 无回写循环**：popstate 时地址已变，restore 应用后派生 query 与地址相等 → 相等分支不写。
7. **StrictMode**：挂载解析在 useState 初始化器（纯函数，双跑无害）；`restoreEpochRef` 按 `pendingRestore` 对象身份保证同一还原只发一次自动加载；预填抑制 ref 在 mode≠wal 的挂载早期返回后才可能被消费，不受 effect 双跑影响。
8. **在途 Load 竞态（design 风险表 #1 接受）**：popstate 触发新加载时旧加载晚归仍可能覆盖视图（last-write-wins，同双击 Load）；未引入取消机制（超范围）。M6 手测重点。
9. **push 标记归属（design 风险表 #2）**：标记语义=「下一次集中同步用 push」；极端交错下可能多一条选择态 URL 历史（仍为有效视图），无数据/崩溃风险。

## 口径澄清（design 未明说处的实现选择）

- `mode=wal` 下 `kind` 丢弃且**不校验**（Spec「wal 下忽略」）；`table`/`index`/`blkno`/LSN 无论模式均校验格式（「已知参数值非法才报错」）。
- `?blkno=`（空值）按 server `Number()` 口径解析为 0（`?table=` 则因 1..4294967295 报错，与 BAD_OID 行为一致）。
- 后退到「无 blkno 的 table 条目」会按 Spec 还原判定自动加载块 0，Load 成功后 URL 经 push 获得 `blkno=0`（反映实际已加载视图）。
- 单 LSN 深链：还原预填输入框且不自动加载，地址按规范形归一为 `?mode=wal`（编码集只含已加载 LSN）。
- 未知参数（如 `?foo=1`）：行为等价忽略；首次规范写入后从地址栏消失（canonical 形）。

## 手测状态（quality.md §6 缺口记录）

**缺口：M1–M10 全部待浏览器执行。** 原因：本环境无浏览器（chromium/firefox 均不可用）；jsdom 未安装且 design 明确不为单项引入组件测试基建。风险：地址栏时机、history 后退/前进、书签/新 tab、`%2F` 显示形态、错误面板两主题可读性等真实浏览器行为未实证（L2 无法替代）。恢复条件：浏览器 + `pnpm dev:server` + `pnpm dev:web` + 可达 PG（`.env` 自动连接，或 M3 临时移除 `.env` 用手动连接形态）后按 ui-design 清单补测；期间不得以 L2 通过替代手测证据。

| 项 | 覆盖 | 状态 |
|---|---|---|
| M1 地址栏时机（P0-1/2/3、P0-13） | 待浏览器 | Pending |
| M2 已连接还原 + F5 + 预填不覆盖（P0-4/5/6/14） | 待浏览器 | Pending |
| M3 未连接还原（P0-7，需无 `.env` 形态） | 待浏览器 | Pending |
| M4 `BAD_URL_PARAM` 三段式 + 后续 URL 跟随 + 两主题（P0-8） | 待浏览器 | Pending |
| M5 对象层失效复用既有码（P0-9/10） | 待浏览器 | Pending |
| M6 历史后退/前进 + 同块 Refresh（P0-11） | 待浏览器 | Pending |
| M7 裸 URL 回归（P0-12） | 待浏览器 | Pending |
| M8 LSN `%2F`/`/` round-trip | 待浏览器（解析层已单测） | Pending |
| M9 P1 抽核（规范化/未知参数/单 LSN/块 0/守卫/不一致） | 待浏览器（判定层已单测） | Pending |
| M10 并排对照 / 分享 | 待浏览器 | Pending |

## QA 修复回执（D1，2026-09-07）

| 缺陷 ID | 处理 | 摘要 | 验证 | 建议复测 |
|---|---|---|---|---|
| D1 | 已修复 | 源分支 `url-deeplink` **fast-forward** 至 `6dd36e0`（未另 cherry-pick，避免与 `e2e-playwright` 重复提交）。`refreshTables` / `refreshIndexes` 仅在 `preserveRawUrlRef` 为假时 `setError(null)`，已连接自动刷新不再清掉 `BAD_URL_PARAM`。 | 见下 | Review 范围：App.tsx 两守卫 + P0-8。QA 轮次 3：`pnpm exec playwright test e2e/m2-m4-m5.spec.ts -g "BAD_URL_PARAM frozen"` + `pnpm test:e2e`（套件在 `e2e-playwright`） |

TDD：红测已由 QA 轮次 2 隔离探针完成（`d452978` 的 `App.tsx` → M4 `role=alert` 不可见）。源分支无 Playwright（属 `e2e-playwright`），本步不引入套件。绿=合入已在含本提交的树上证实 M4 通过的 `6dd36e0`。

本步 L2/L3（`url-deeplink` @ `6dd36e0`）：`pnpm test` **450**（13+158+81+198）；`pnpm -r typecheck` / `pnpm -r build` 四包 Done；`pnpm test:integration` exit 0。Playwright M4：本分支无 `e2e/`，未跑。原因：套件在 `e2e-playwright`。风险：合入指针错误则 P0-8 仍红。恢复：QA 轮次 3 在含 `6dd36e0` 与套件的树上复跑。

复审范围：`apps/web/src/App.tsx` 两处 `if (!preserveRawUrlRef.current) setError(null)`；不触及 `urlState.ts`。

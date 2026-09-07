# QA Report: url-deeplink

最新轮次结论：**Pass**（轮次 3）。待用户合并授权。

## 轮次

| 轮次 | 日期 | 范围 | 结论 |
|---|---|---|---|
| 1 | 2026-09-07 | 首测：L2/L3 复跑 + P0/P1 逻辑层独立核验（真实实现 65 断言探针）+ App 接线代码级 + Reviewer F1–F5 处置核对 + 文档验收；M1–M10 无浏览器未核验 | Blocked |
| 2 | 2026-09-07 | 路径 B：独立复跑 Playwright M1–M10 + L2/L3；对照 Spec P0/P1 浏览器 Then；源分支 tip 隔离探针 M4 | Fail |
| 3 | 2026-09-07 | D1 回归：源分支含 `6dd36e0`；独立 `pnpm test:e2e`（含 M4）+ L2 | Pass |

## 环境与命令

- 实现：分支 `url-deeplink` tip = **d452978**（本轮 `git log` 确认，与 review.md 一致）。Node 24.19.0；本地 PG 16.11 socket `/tmp:5432` accepting；`.env` 存在（未打印）。工作区仅有 Manager 侧 STATUS/工作项记录变更与本报告，业务代码零漂移。
- 本轮实测无浏览器：chromium/firefox/playfox 均不存在，无 playwright/puppeteer/jsdom（与 dev-notes 缺口记录一致）。
- L2/L3 复跑（全部亲跑，退出 0）：`pnpm test` → wal-core 13 + page-core 158 + server 81 + web 198 = **450 全绿**（urlState 62 例单独复跑确认）；`pnpm -r typecheck` → 4 包 0 错误；`pnpm -r build` → 4 包 Done（web 302.76 kB / gzip 91.65 kB）；`pnpm test:integration` → **退出 0**（L3 smoke / B-tree oracle / auto-install 零回退）。
- QA 独立探针（不依赖 Developer/Reviewer/仓库测试）：esbuild 打包**真实实现** `urlState.ts` → node 断言脚本（临时 /tmp，不入库）→ **65/65 PASS**。

## 覆盖（对照 plan 最低验证层 + spec 验收）

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| L2/L3 | test/typecheck/build/integration | 通过 | 上节；450 绿、0 错、0 错、退出 0 |
| P0-1/2/3 | 表/索引/WAL URL 同步 | 通过（逻辑层+代码级） | 探针：canonical 串逐字 `?mode=page&kind=table&table=T&blkno=5` / `?mode=page&kind=index&table=F&index=I&blkno=0` / `?mode=wal&startLsn=0%2F16B3748&endLsn=0%2F16E9208`；三处 Load 成功提交点 `setUrlLoaded`+`markUrlPush`（App.tsx:510/580/736），失败 catch 不触碰快照与标记；全仓仅 pushState/replaceState，无 `location` 写入（grep） |
| P0-4/5/6 | 已连接还原 + 预填不覆盖 | 通过（逻辑层+代码级） | 探针还原判定矩阵：表/索引/区间齐全→load-*（blkno 缺省 0）、wait 门控（tablesFetched/indexesFetched）；restore effect（App.tsx:843-946）单一入口，`restoreEpochRef` 防双发；预填抑制 `walPrefillSuppressedRef` 仅还原携带 LSN 时置位、消费一次（App.tsx:894 + 748-754） |
| P0-7 | 未连接还原 | 通过（逻辑层+代码级） | 探针：未连接→`wait`；restore effect `!connected` 早退且不清 `pendingRestore`；`onConnect` 重置 fetched 标志并 `refreshTables`（finally 置位 tablesFetched）→ effect 幂等重放；连接面板 JSX 未因深链改形（diff 无结构性变更） |
| P0-8 | BAD_URL_PARAM | 通过（逻辑层+代码级） | 探针 14 组非法值：code/message/nextStep 与 ui-design 冻结表**逐字相等**（含 `table=""` 空值回显、参数名+原值）；挂载 effect `setError`+`preserveRawUrlRef`（App.tsx:405-412），sync effect 空目标跳过写入（975-986）→ 地址栏保留原样；默认视图可用（parse 失败→`pendingRestore=null`）；dist bundle 含冻结 nextStep 与 message 模板（构建产物探针） |
| P0-9/10 | 对象层失效复用既有码 | 通过（逻辑层） | 探针：不在列表 table/index 仍发 load-*（→ 既有 `NOT_HEAP_TABLE`/`NOT_INDEX` 路径）；blkno 上界由对象层 `BLKNO_OUT_OF_RANGE`（server 合同历史特性已证）；无深链专属新码 |
| P0-11 | 后退/前进 | 通过（代码级） | popstate→`parseUrlState`→`setPendingRestore` 复用还原路径含自动重载（App.tsx:1000-1018）；地址已变→派生相等→不回写（无循环）；同块 Refresh 相等分支仅清标记（983-986）+ `urlSyncTick` 强制重跑（211-215）。历史条目运行时行为→M6 |
| P0-12 | 裸 URL 回归 | 通过（逻辑层+代码级） | 探针：空 search→全默认；`isDefaultUrlState`→`pendingRestore=null`→目标空串==地址→零写入，行为同现状 |
| P0-13 | 输入不污染 URL | 通过（代码级） | `targetQuery` 仅派生自 7 字段（选择侧 + `urlLoaded` 快照，App.tsx:965-975），blkno/LSN 输入框 state 不参与；Load 失败路径（loadBlk/loadIndexBlk catch、loadWalRange catch）零触碰 `urlLoaded`/push 标记 |
| P0-14 | 刷新恢复 | 通过（逻辑层） | F5 = 启动还原同路径（挂载 useState 初始化器解析一次，185-190） |
| P1 | 规范化/未知参数/单 LSN/块 0/守卫/不一致 | 通过（逻辑层） | 探针：page→wal 过滤 page 参数（含残留 table/blkno）；`?foo=1&mode=wal` ≡ `?mode=wal`；wal 下 kind 丢弃**且不校验**（page 下校验）；同名首个生效；单 LSN→none（仅输入侧）；0 块表/非 B-tree→none（不发请求）；过滤器不含 index→none（静默丢弃）；round-trip `parse(build(s))≡s` 含 `%2F` 与裸 `/` 双形态、大小写、trim、oid 边界 1/4294967295、`1e2` 与 server `Number()` 口径一致 |
| 校验口径镜像 | BAD_OID/BAD_BLKNO/LSN_RE | 通过 | 本轮逐行对照 server 源码：`parseOidParam`（app.ts:58-71 `Number`+`isInteger`+`1..4294967295`）、`BAD_BLKNO`（app.ts:366-373/595-603）、wal-core `LSN_RE`（index.ts:45,93 trim 后正则）——与 urlState.ts 完全一致 |
| 文档 | README 双语 + dev-notes | 通过 | README.md:41 Features 深链句+示例 URL、:122 `BAD_URL_PARAM` 行；README.zh-CN.md:41/119 对应；nextStep 语义与冻结表一致、双语对齐；dev-notes 证据/竞态/缺口记录在位；`urlState.ts` 顶部公开合同注释在位 |
| 安全 | security.md 适用项 | 通过 | targetQuery 仅 7 已校验字段；凭据不入 URL（urlState.ts 无凭据接触）；LSN 经 URLSearchParams 编解码无注入面；零新增依赖/SQL/API 面；错误面板 React 文本渲染。允许（补测后）合并 |

## UI/UX

| 检查项 | 结果 | 证据 |
|---|---|---|
| Spec 界面相关验收 | 逻辑/代码层如上矩阵全过；浏览器 Then 子句（地址栏内容与时机、历史条目、还原运行时、错误面板呈现、两主题）**未核验-无浏览器** | 见下 M1–M10 表 |
| `workflow/agents/standards/ui.md` 底线 | 通过（代码级） | 零布局变更（diff 无 JSX 结构变更）；错误三段式经既有 `setError`→`role=alert`；复用既有 spinner；无新可聚焦控件/焦点移动 |
| `ui-design.md` 状态与流程 | 逻辑符合（代码级+探针）；冻结文案 5 场景逐字（探针）；M1–M10 待浏览器 | 见下表 |

### M1–M10 处置（无浏览器，逐项 L2 覆盖度）

| 项 | L2/探针已等价覆盖 | 纯浏览器残余 | 状态 |
|---|---|---|---|
| M1 地址栏时机（P0-1/2/3/13） | canonical 串、失败不写、选择即时同步派生、无 location 写入 | 地址栏实际显示、Load 前后时机、不新增历史运行时 | 未核验-无浏览器 |
| M2 已连接还原+F5+预填不覆盖（P0-4/5/6/14） | 还原判定矩阵、预填抑制接线代码级 | 自动加载运行时、三联视图/记录列表呈现、F5 行为 | 未核验-无浏览器 |
| M3 未连接还原（P0-7） | wait 门控、onConnect 幂等重放代码级 | 连接面板置顶形态、连接成功自动加载 | 未核验-无浏览器 |
| M4 BAD_URL_PARAM 呈现（P0-8） | 三段式形状+冻结文案逐字、地址保留逻辑代码级、bundle 含文案 | `role=alert` 面板渲染、默认视图可用性运行时、两主题可读、后续 URL 跟随 | 未核验-无浏览器 |
| M5 对象层失效（P0-9/10） | 不在列表仍加载→既有码路径 | 错误面板实际呈现 | 未核验-无浏览器 |
| M6 历史后退/前进+同块 Refresh（P0-11） | popstate 复用还原、相等不写、tick 机制代码级 | 历史条目数、后退自动重载、在途竞态（F4） | 未核验-无浏览器 |
| M7 裸 URL 回归（P0-12） | 全默认→零写入（探针+代码级） | 连接探测运行时（低风险） | 未核验-无浏览器 |
| M8 LSN round-trip | `%2F`/`/` 双形态 parse/build round-trip（探针+62 例） | 地址栏显示形态 | 未核验-无浏览器 |
| M9 P1 抽核 | 判定层全部（规范化/等价/单 LSN/块 0/守卫/不一致，探针） | 运行时确认（含 F2 归一 UX） | 未核验-无浏览器 |
| M10 并排对照/分享 | 无 L2 等价（纯用户故事） | 全项 | 未核验-无浏览器 |

## Reviewer 发现项处置核对

F1（Minor，dev-notes 机制描述不准）：属实——实测代码路径为还原乐观快照 `replaceState` 归一补 `blkno=0`、push 标记随后被相等分支消费，非「经 push 获得」；终态一致，仅措辞偏差。处置成立（Developer 下次触碰分支时修订 dev-notes，无需复审）。
F2（Minor，启动期归一）：代码证实（parse 成功→syncReady→非规范 URL 即 replaceState 归一）；符合 spec 编码集与 P1 等价条款，dev-notes 已声明。处置成立（M9 补 UX 确认）。
F3（Minor，未连接等待期手动切换被还原覆盖）：代码证实（restore 应用 `state.mode/kind` 无条件覆盖等待期选择）；与 P0-7「连接成功后自动执行同一还原」一致。处置成立（M3 顺带观察）。
F4（Info，在途竞态 last-write-wins）：维持已接受风险，M6 手测重点。
F5（条件项，M1–M10 Pending）：本轮环境复测仍无浏览器 → 转入本报告阻塞结论（见下）。

## 缺陷

| ID | 严重度 | 摘要 | 状态 |
|---|---|---|---|
| — | — | 轮次 1 未发现实现缺陷（逻辑层+代码级全部通过；F1 为 dev-notes 措辞项，非代码缺陷） | — |
| D1 | P0 | 已连接挂载 `refreshTables`/`refreshIndexes` 无条件 `setError(null)`，清掉 `BAD_URL_PARAM`；P0-8/M4 在 `.env` 自动连接下失败 | **closed**（源分支已含 `6dd36e0`；轮次 3 M4 绿） |

## 结论（轮次 1）

- 总体: **Blocked**
- 依据: qa.md「因环境…无法完成关键验收」——本环境无浏览器（chromium/firefox/playwright/jsdom 本轮实测均不可用），M1–M10 无法执行。Plan 最低验证层为「L2 **+** 定向浏览器手测」双必需，其缺口表明文「不得以 L2 通过替代手测证据」，review.md F5 亦裁定该缺口「不得进入 QA Pass」；P0-1..P0-14 的 Then 子句（地址栏内容/时机、历史条目、还原运行时、错误面板呈现）即特性本体，非纯视觉残余。**Pass-附条件不成立**：与 index-viewer 轮次 2 先例的本质区别——彼案关键验收（数据/API 合同）已全部取得无头确定性证据、残余仅视觉呈现，且该 Plan 未将手测列为硬性最低层；本案若附条件放行即构成 Plan 明文禁止的 L2 替代，且 qa.md 结论档位中无「Pass-附条件」。**Fail 不成立**：无可修复不符合项——全部可执行验收（L2/L3、P0/P1 逻辑层、接线代码级、文档、安全）均通过，独立探针 65/65。
- 阻塞原因: 无浏览器联调环境（开发/Review/QA 三轮同因，dev-notes §手测状态已记录）。
- 风险: 地址栏同步时机、浏览器历史粒度（P0-11）、未连接还原呈现（P0-7）、`BAD_URL_PARAM` 面板与两主题、F4 竞态等浏览器运行时合同未实证；接线层错误（若有）仅能由此暴露（App 层无自动化测试，design 决策 1 既定）。
- 恢复条件: 浏览器可用（chromium/firefox 或可运行无头浏览器）+ `pnpm dev:server` + `pnpm dev:web` + 可达 PG（`.env` 自动连接；**M3 需临时移除/清空 `.env` 用手动连接形态**）后按 ui-design M1–M10 逐项补测（优先 P0-7/P0-11/M8；M6 观察 F4、M9 确认 F2、M3 观察 F3），通过后 QA 在本报告追加轮次 2 出最终结论。
- 合并: 不合并（Blocked；禁止请求合并授权）

## 第 2 轮（2026-09-07）

实现版本：检出 `e2e-playwright` HEAD `33dc7d5`（含 `url-deeplink` tip `d452978` + `6dd36e0`）。环境：Node v24.19.0；PostgreSQL 16.11 `/tmp:5432`；`@playwright/test@1.63.0`。入口：Plan 已确认；Review **Approve**；路径 B 已满足。QA 禁止提交本报告。

### 独立复测（本会话，非转述 e2e-playwright QA）

| 检查 | 命令 | 结果 |
|---|---|---|
| L4 / M1–M10 | `pnpm test:e2e` | **11 passed**（40.6s） |
| L2 单测 | `pnpm test` | **450 passed**（wal-core 13、page-core 158、server 81、web 198） |
| 类型 / 构建 | `pnpm -r typecheck` / `pnpm -r build` | 四包 Done |
| L3 | `pnpm test:integration` | L3 smoke OK，exit 0 |
| 源分支隔离 | 临时检出 `d452978` 的 `App.tsx`，rebuild，`playwright test` M4，再还原 HEAD | **M4 Fail**：`getByRole('alert')` 10s 内不可见。HEAD 还原后 dist 哈希回到 `index-B8wpTOWK.js` |

### Spec P0/P1（浏览器 Then；逻辑层轮次 1 已过）

| ID | 结果 | 证据 |
|---|---|---|
| P0-1 / P0-13 | Pass | M1：选择 replace、未 Load 不写、Load push `blkno=5`、越界失败 URL 不变 |
| P0-2 | 残余 | 套件无索引 Load 成功地址栏；轮次 1 逻辑层+同一 `setUrlLoaded` 提交点 |
| P0-3 / P0-6 | Pass | M2 WAL 直开，输入框 = 种子 LSN（预填未覆盖） |
| P0-4 / P0-14 | Pass | M2 直开块 5 + `reload` 仍块 5 |
| P0-5 | 残余 | 套件无索引还原；同一 restore effect |
| P0-7 | Pass | M3 sanitized 栈：disconnected + Connect 面板 + URL 保留 `table=` → Connect → 块 5 |
| P0-8 / M4 | **Fail（源分支）** | `e2e-playwright` HEAD 11 例含 M4 绿；`url-deeplink` tip 无 `6dd36e0` 时 alert 被 `setError(null)` 清掉。见 D1 |
| P0-9 / P0-10 | Pass | M5：`NOT_HEAP_TABLE` / `NOT_INDEX` / `BLKNO_OUT_OF_RANGE` |
| P0-11 | Pass | M6：5→7 → `goBack` 块 5 → `goForward` 块 7；Refresh 后再退无空跳。F4 在途竞态未专项加压 |
| P0-12 | Pass | M7：空 search +「Select a heap table to begin.」 |
| P1 / M8 / M9 / M10 | Pass | M8 `%2F` 与 `/` round-trip；M9 未知参数归一、单 LSN 不加载、块 0、守卫零 `/pages/`；M10 双 tab 独立。F2（启动归一）由 M9 覆盖。F3 等待期切换未专项观察 |

### Plan 最低验证层

- L2：本轮复跑达成。
- 浏览器 M1–M10：路径 B 以 Playwright 替代手测。套件在含 `6dd36e0` 的树上全绿；源分支 tip 的 M4/P0-8 **未通过**。不得以「随后再合 e2e-playwright」作附条件 Pass（与轮次 1 同一口径）。

### UI/UX

| 检查项 | 结果 | 证据 |
|---|---|---|
| Spec 界面相关验收 | Fail（P0-8） | 源分支已连接形态下错误面板不保持；HEAD+fix 下 M4 冻结文案/`role=alert`/地址栏原样通过。主题/深色 Spec 未要求新主题，未测 |
| `ui.md` 底线 | 部分 | 错误须可读且可执行下一步；源分支 connected 路径下 P0-8 面板消失，不满足「错误可读」 |
| `ui-design.md` 状态与流程 | Fail（格式错误态） | M4 冻结四行在 HEAD 通过；缺 `kind` 行（e2e O1，非本轮 Fail 因） |

### 文档与安全

- README 双语 Features 深链句 + 示例 URL、Troubleshooting `BAD_URL_PARAM` 行仍在（轮次 1 已核；本轮抽查路径仍在）。
- 安全：无新增凭据入 URL；本轮未改安全面。D1 非安全缺陷。

### 修复范围（Developer）

- 将 `6dd36e0`（`refreshTables`/`refreshIndexes` 在 `preserveRawUrlRef` 为真时保留 error）cherry-pick 到源分支 `url-deeplink`。
- Review 门禁 required：修复后须重新 Approve（范围限 App.tsx 两守卫 + P0-8）。
- 建议复测：`pnpm exec playwright test e2e/m2-m4-m5.spec.ts -g "BAD_URL_PARAM frozen"` + `pnpm test:e2e`。L2 全量本轮已绿；两行守卫不触及 `urlState`。

## 结论（轮次 2）

- 总体: **Fail**
- 恢复条件: N/A（非 Blocked）
- 合并: 不合并（Fail；禁止请求合并授权）
- 缺陷: **D1** 打开。轮次 1 浏览器缺口已由套件闭合；合入 `url-deeplink` tip 而不含 `6dd36e0` 会在 `.env` 自动连接下违反 P0-8。

## 第 3 轮（2026-09-07）

实现版本：源分支 `url-deeplink` `d96b73d`（含 `6dd36e0`）。套件在 `e2e-playwright` `33dc7d5`（`6dd36e0` 为共同祖先；`App.tsx` 守卫相同）。环境：Node v24.19.0；PostgreSQL 16.11 `/tmp:5432`。入口：Plan 确认；复审 **Approve**。QA 不提交本报告。

### 独立复测

| 检查 | 命令 / 方法 | 结果 |
|---|---|---|
| D1 合入 | `git merge-base --is-ancestor 6dd36e0 url-deeplink` | 成立；tip `d96b73d` |
| L2 | 源分支 `pnpm test` + `pnpm -r typecheck` | **450**；四包 Done |
| L4 / M4 | worktree `e2e-playwright` `pnpm test:e2e` | **11 passed**（49.9s）；其中 M4 **2.2s 绿**（`role=alert` + 冻结文案 + 地址栏原样） |
| 构建对账 | worktree web `index-B8wpTOWK.js` | 与源分支含 fix 的 bundle 同哈希 |

无凭据写入报告。worktree 无 `.env` 时 globalSetup 响亮失败 `E2E blocked: no PG credentials`（exit 1），符合 Plan，不冒充通过。

### D1 / P0-8

要求：已连接形态下 `BAD_URL_PARAM` 面板保持、默认视图可用、地址栏原样。证据：M4 绿。结果：**Pass**。D1 **closed**。

轮次 2 其余 P0/P1/M1–M10 本轮套件全绿，无新 Fail。残余（非缺陷）：M4 缺冻结表 `kind` 行；P0-2/P0-5 套件无索引 Load/还原（逻辑层轮次 1 已过）。

### UI / 文档 / 安全

- UI：P0-8 错误可读（`role=alert` 三段式）本轮浏览器核验通过。`ui.md` 底线满足。
- 文档：README 深链句 / `BAD_URL_PARAM` 行未回退。
- 安全：无新面。允许在授权后合并。

## 结论（轮次 3）

- 总体: **Pass**
- 恢复条件: N/A
- 合并: **待用户授权**。质量门禁已满足（Plan 确认 + Review Approve + QA Pass）。合入顺序：先 `url-deeplink` 入 `main`，再合 `e2e-playwright`。授权后 Manager 在源分支置 `done` 并与未入库 `review.md` / `qa-report.md` 一次提交。QA 不提交本报告。

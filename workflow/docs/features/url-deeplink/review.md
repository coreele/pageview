# Review: url-deeplink

## 审阅范围

- 分支 `url-deeplink`（自 `main` 4ab965b 分出，b17b272→d452978，6 提交），工作区当前检出该分支。
- 变更：`apps/web/src/urlState.ts`（新，248 行）、`apps/web/src/urlState.test.ts`（新，62 例）、`apps/web/src/App.tsx`（+268 行接线）、README 双语、`dev-notes.md`。
- 依据：spec.md（14 P0 + P1，四裁决）、design.md（决策 1–4 + 风险表）、ui-design.md（冻结文案、M1–M10）、plan.md（T1–T7，最低验证层 L2 + 手测）、workflow 标准 documentation/quality/security/git/ui。
- 实现版本：d452978；Reviewer 独立验证于 2026-09-07。

## 独立验证（Reviewer 亲自执行，非复述 Developer）

| 命令 | 结果 |
|---|---|
| `pnpm test` | 450 全绿（wal-core 13 + page-core 158 + web 198 + server 81） |
| `pnpm -r typecheck` | 0 错误（4 包 Done） |
| `pnpm -r build` | 0 错误（web bundle 302.76 kB / gzip 91.65 kB） |
| `pnpm test:integration` | 退出 0（L3 smoke、B-tree oracle、auto-install 零回退） |
| web 测试对账 | main 基线 136 → 分支 198，差值 62 = urlState 新增（独立 worktree 复跑 main 证实） |
| 校验口径镜像 | `urlState.ts` parseOid/parseBlkno/LSN_RE 逐行对照 server `parseOidParam`（app.ts:58-71）、`BAD_BLKNO`（app.ts:366-373/595-603）、wal-core `LSN_RE`（index.ts:45,93）：`Number(raw)`+`Number.isInteger`+范围、trim 后正则，完全一致 |

## 实现正确性结论

### Spec P0 逐项核验（代码位置级）

| ID | 结论 | 核验点 |
|---|---|---|
| P0-1/2/3 | 通过（逻辑层） | 三处 Load 成功提交点置快照+push 标记（App.tsx:510,580,736）；`buildUrlState` 输出与验收串逐字一致（测试断言 `?mode=page&kind=table&table=T&blkno=5` 等）；仅 pushState/replaceState，无整页导航（grep 证实无 location 赋值） |
| P0-4/5/6 | 通过（逻辑层） | 挂载 useState 初始化器解析→`pendingRestore`→restore effect（App.tsx:843-946）connected+列表门控→`planRestoreActions`→既有 load 路径；index 惰性列表经 wait 分支 kick（App.tsx:871）；WAL 预填抑制（App.tsx:894 + 755-765），深链 LSN 不被 recent-20 覆盖；地址栏参数经乐观快照保持（见偏离审查） |
| P0-7 | 通过（逻辑层） | 未连接 restore effect 早退、`pendingRestore` 不清除；`onConnect` 不清 `pendingRestore`，连接+`tablesFetched` 后幂等重放（epoch ref 防双发） |
| P0-8 | 通过（逻辑层） | 解析失败→mount effect `setError(BAD_URL_PARAM)`（App.tsx:405-412）+`preserveRawUrlRef`；sync effect 空目标跳过写入（App.tsx:975-979），地址栏保留原 URL；默认视图可用；文案与 ui-design 冻结表逐字一致（测试断言） |
| P0-9/10 | 通过（逻辑层） | 不在列表的 table/index 仍发加载→server `NOT_HEAP_TABLE`/客户端 `NOT_INDEX`；blkno 越界→既有 `BLKNO_OUT_OF_RANGE`；无深链专属新码（planRestoreActions 测试矩阵覆盖） |
| P0-11 | 通过（逻辑层） | popstate→解析→`setPendingRestore` 复用还原路径含自动重载（App.tsx:1000-1018）；地址已变→派生相等→不回写（无循环）；同块 Refresh 相等分支仅清标记不写（App.tsx:983-986） |
| P0-12 | 通过 | 裸 URL→全默认→`pendingRestore=null`、目标空串与地址相等→零写入，行为同现状 |
| P0-13 | 通过（逻辑层） | blkno/LSN 输入不进 `targetQuery` 派生（仅 `urlLoaded` 快照）；Load 失败 catch 不触碰 `urlLoaded`、不置 push 标记→地址栏不变（`urlLoaded` 快照偏离的核心目的，见下） |
| P0-14 | 通过（逻辑层） | F5 = 启动还原同路径 |

### 偏离审查：`urlLoaded` 双侧快照 vs design 决策 2 派生式

**判定：必要且正确，偏离成立。**

- **必要性**：design 原派生式（`pageView != null` → `loadedBlkno`；`walRangeMeta != null` → LSN）在既有失败路径下不成立——`loadBlk`/`loadIndexBlk` 失败 catch 置空 `pageView`/`loadedBlkno`（App.tsx:514-517,584-587），`loadWalRange` 失败置空 `walRangeMeta`（App.tsx:812-818）。派生式将使失败后 URL 立即丢失 blkno/LSN，直接违反 spec「Load 失败不写入本次参数（地址栏保留失败前视图的 URL）」与 P0-13。快照式是满足该合同的唯一途径（除非改动既有失败路径语义，后者越界）。
- **正确性**：写入仅在 3 处 Load 成功点（510/580/736）；清除点覆盖全部选择类失效（`resetPageView`:317、`onSelectTable`:597、WAL 模式进入:1054、还原应用:889/906）；失败路径零触碰。双侧独立（page 侧 blkno / wal 侧 LSN 对），build 按模式取用侧——与既有「模式切换保留两侧视图」语义一致（切换后 URL 与保留视图对应）。瞬态/heap-peek/主题不参与派生（targetQuery 仅 7 字段，App.tsx:952-962）。
- **收敛性**：成功 Load 后快照被服务端确认值覆写（`data.startLsn/endLsn`、`block`）→ 与派生式等价；失败后快照保留请求值 = P0-13 语义；随后任一选择类动作经清除点正常收敛。
- **还原期乐观快照**（App.tsx:918-927）：预置请求值使在途加载期间派生 query 与地址相等→初始历史条目不被中间态 replace；失败时地址保留请求视图（spec 未要求清除，与 P0-8「便于用户修正」原则一致）。
- **竞态处理读码核验**：`urlSyncTick`（App.tsx:211-215）解决同块 Refresh 时 memo 相等导致 effect 不重跑、push 标记滞留的问题——tick 强制重跑，相等分支清标记不写；`syncReady` 门控（949,968）确保 `pendingRestore != null` 期间（含 P0-7 等待、popstate 在途）零写入；`restoreEpochRef` 按对象身份防 StrictMode 双发（挂载期 effect 双跑时 connected=false 早退，属双保险）；预填抑制 ref 仅在 mode≠wal 挂载早退后被消费，不受双跑影响。在途 Load 竞态（last-write-wins）为 design 风险表 #1 明示接受项，M6 手测重点。

### 测试有效性结论

- 62 例 urlState 测试为真实断言：非法矩阵逐字对照冻结文案（message+nextStep 全串相等）、canonical 输出精确串、round-trip（含 `%2F` 与裸 `/` 双形态）、还原判定矩阵覆盖 spec「还原判定/部分缺失/内部不一致」全部行 + wait 门控 + 守卫。错误实现（如放宽校验、漏过滤参数、判定分支写反）会使测试失败。
- App 接线层（T4/T5）无自动化测试——与 design 决策 1 和 plan 一致（仓库无 jsdom/组件基建，不为单项引入）；判定逻辑已全部下沉纯函数。接线正确性由本 Review 读码核验 + QA 手测兜底，风险已在 dev-notes 记录。
- L2 三命令 + L3 集成 Reviewer 亲自复跑通过（见上表）。

## 文档影响核对

| Plan 声明 | 实现是否一致 | 备注 |
|---|---|---|
| 开发文档 | 一致 | dev-notes.md 含 TDD 证据、实现要点、口径澄清、缺口记录；`urlState.ts` 顶部公开合同注释（改名须向后兼容）存在 |
| 用户文档 | 一致 | README 双语 Features（Shared/共用节）各增深链句 + 示例 URL `?mode=page&kind=table&table=<oid>&blkno=<n>`；Troubleshooting 双语各增 `BAD_URL_PARAM` 行，nextStep 语义与冻结表一致；双语语义对齐 |
| 运维文档 | N/A（Plan 已论证） | 无部署/监控变更 |

## 安全影响核对

| 检查项 | 结果 | 备注 |
|---|---|---|
| 敏感信息 | 通过 | targetQuery 仅由 7 个已校验字段派生（App.tsx:952-962）；host/port/database/user/password 不入 URL（grep 证实 urlState.ts 无凭据接触）；错误面板为唯一新增用户可见输出，经 React 文本渲染 |
| 认证与授权 | N/A | 无认证面变更；深链参数仍走既有 API 守卫（spec 非目标） |
| 输入与外部访问 | 通过 | 参数经枚举/整数/LSN 正则校验才入状态（口径镜像 server）；LSN `%2F` 由 URLSearchParams 编解码，无注入面；无新外部访问 |
| 依赖变更 | 无 | 零新增依赖 |
| 结论 | 无未解决安全问题，允许继续 | 检查范围：URL 读写、错误呈现、参数校验 |

## UI/UX 核对

| 检查项 | 结果 | 备注 |
|---|---|---|
| 对照 Spec 界面验收 | 通过（逻辑层） | 零布局变更（diff 证实无 JSX 结构变更，仅按钮 onClick 增量）；错误经既有 `setError`→`role=alert` 面板；无新组件 |
| 对照 `workflow/docs/standards/ui.md` | 通过 | 错误三段式可读（code/message/nextStep）；无整页跳转/布局改动；复用既有 spinner |
| 对照 `ui-design.md` | 通过（文案）/待 QA（视觉） | 冻结文案 5 场景逐字一致（测试断言）；地址栏时机表/状态表逻辑实现符合；M1–M10 视觉与时机项标「待 QA 手测」 |
| 主题/深色（仅 Spec 要求时） | N/A→沿用现状 | 无新视觉元素；两主题下错误面板可读性列入 M4 |

## 必修项

无（不存在必须在 QA 前修复的问题）。

## 发现项

非阻塞发现（严重度：Minor=建议、Info=记录）：

| ID | 严重度 | 位置 | 问题 | 状态 |
|---|---|---|---|---|
| F1 | Minor | workflow/docs/features/url-deeplink/dev-notes.md「口径澄清」第 3 条 | 「后退到无 blkno 的 table 条目……Load 成功后 URL 经 push 获得 blkno=0」机制描述不准：乐观快照在 Load 完成前即经 replaceState 规范化补上 `blkno=0`，push 标记随后被相等分支消费，不产生 push。终态 URL 与描述一致，仅机制叙述偏差 | 非阻塞（可在 QA 后一并修订 dev-notes） |
| F2 | Minor | apps/web/src/App.tsx:968-996 + urlState.ts:176 | 启动期对「合法但非规范」URL 立即 replaceState 归一：`?foo=1`→裸 URL、单 LSN `?mode=wal&startLsn=A`→`?mode=wal`（输入框保留 A）。符合 spec 编码集（仅已加载 LSN 入码）与 P1 等价条款，dev-notes 已声明；用户可能意外参数从地址栏消失 | 非阻塞；QA M9 抽核确认无困扰 |
| F3 | Minor | apps/web/src/App.tsx:855-876 | 未连接等待期间用户手动切换 mode/kind 会被深链还原覆盖（还原优先）。与 spec「连接成功后自动执行同一还原」及 P0-7 语义一致，属边界行为 | 非阻塞；QA M3 顺带观察 |
| F4 | Info | apps/web/src/App.tsx:460-528,1000-1018 | 在途 Load + popstate 竞态 last-write-wins：旧加载晚归可覆盖新视图并可能多产生一条历史条目。design 风险表 #1 / dev-notes #8 已明示接受（单人本地工具，不引入取消机制） | 已接受风险；M6 手测重点 |
| F5 | 条件项 | dev-notes.md「手测状态」 | M1–M10 全部 Pending（开发环境无浏览器）。按 quality.md §6 与 plan 缺口表记录了原因/风险/恢复条件，未静默跳过。**不得以 L2 通过替代手测证据；QA Pass 前必须补齐浏览器验证（重点 P0-7/P0-11/M8，M3 需无 `.env` 形态）** | 转入 QA 验收前置条件 |

## 结论

**Approve**

- 实现满足 Spec 14 条 P0 与 P1 的代码层合同（浏览器呈现项由 QA 手测闭合）；`urlLoaded` 双侧快照偏离经审查判定必要且正确；测试有效（62 例真实断言 + 既有 388 例零回退）；文档与 Plan 声明一致；安全检查无发现；Git 合规（独立分支、Conventional Commits、仅声明路径、无禁止内容）。
- 手测缺口（F5）按规范记录并作为 QA 验收前置条件携带，不构成本 Review 阻塞项（quality.md §6 允许已记录缺口进入 QA，但不得进入 QA Pass）。

## 后续动作与复审范围

1. Manager 调度 QA：浏览器环境执行 M1–M10（P0-7/P0-11/M8 优先，M3 需临时移除 `.env`）+ L2 复跑 + P0/P1 逐项；结论写 `qa-report.md`。
2. F1–F3 为非阻塞建议：可在 QA 阶段顺带核对，若需修订仅涉及 dev-notes 措辞（F1），由 Developer 在下次触碰该分支时一并处理，无需专程复审。
3. 若 QA 发现实现缺陷退回，复审范围限于缺陷相关代码与测试。

## 复审（D1，2026-09-07）

审阅版本：`url-deeplink` `d96b73d`（`6dd36e0` + 回执）。范围：QA D1 / P0-8；`App.tsx` 两守卫。依据：qa-report 轮次 2、dev-notes 回执、首轮 Approve。

### 结论

**Approve**

无阻塞项。D1 已在源分支以同一提交 `6dd36e0` 合入（fast-forward，非重复 cherry-pick）。未缩减测试或改合同。

### 独立验证（非转述 Developer）

| 检查 | 结果 |
|---|---|
| `git merge-base --is-ancestor 6dd36e0 HEAD` | 成立 |
| `6dd36e0` diff | 仅 `App.tsx` 两行：`refreshTables`/`refreshIndexes` `setError(null)` → `if (!preserveRawUrlRef.current) setError(null)` |
| 读码 | 挂载 parse 失败 effect（408–412）置 `preserveRawUrlRef`；session effect（389–403）`await getSession()` 之后才 `refreshTables`，故自动连接时 ref 已为真。sync 空目标仍跳过写入（981–983）。`refreshIndexes`（775）同守卫 |
| `pnpm test` | **450**（13+158+81+198） |
| `pnpm -r typecheck` / `pnpm -r build` | 四包 Done；web `index-B8wpTOWK.js` 与 QA 轮次 2 含 fix 的 M4 绿构建同哈希 |
| Playwright M4 | 本分支无套件，未跑。原因：`e2e/` 在 `e2e-playwright`。风险：接线时序若被后续改动仍可能清错误。恢复：QA 轮次 3 跑 `-g "BAD_URL_PARAM frozen"` + `pnpm test:e2e` |

### QA 修复核对

| 项 | 结果 |
|---|---|
| D1 对应修复 | 通过：已连接 catalog 刷新不再无条件清 `BAD_URL_PARAM` |
| 未改合同 / 未删测 | 通过：零测试文件变更；`urlState` 未改 |
| 回执 | 通过：`dev-notes.md` 含 D1、FF 说明、L2 证据、建议复测 |

### 文档 / 安全 / UI

- 开发文档：回执在位。用户/运维 N/A（本修复无新用户面文案）。
- 安全：无凭据/依赖变化。允许进入 QA。
- UI：P0-8 错误面板在 connected 路径可保持；视觉仍由 QA M4 闭合。首轮 F1–F4 非本复审范围。

### 必修项

无。

### 后续

Manager 调度 QA 轮次 3（D1/M4 + `pnpm test:e2e`）。本报告不提交。

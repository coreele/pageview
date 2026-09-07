# Design: url-deeplink

## 背景

web 端为无路由单页应用（`apps/web/src/App.tsx`，约 1550 行，零 URL/history 代码，经 grep 证实）。视图状态全部内存态：`mode`、`relationKind`、`selectedOid`（表选择 / index 过滤器复用）、`selectedIndexOid`、`blkno`（输入态）、`walStartLsn`/`walEndLsn`（输入态）；派生展示态 `loadedBlkno`、`pageView`、`walRangeMeta`。连接探测为挂载 effect（`getSession` → connected 则 `refreshTables`）；手动连接 `onConnect` 会重置选择并刷新表列表。index 列表在 `kind=index` 且已连接时懒加载（`indexesFetched` 标志已有；表列表无对应标志）。WAL 进入模式时 recent-20 预填 effect 会覆写两个 LSN 输入框。

Spec（已确认，四裁决）约定：7 参数 schema（`mode/kind/table/index/blkno/startLsn/endLsn`）、选择类即时同步、blkno/LSN 仅 Load 成功同步、每次成功 Load 产生一条历史、启动/后退还原含自动加载、格式层错误新码 `BAD_URL_PARAM`。本设计只决定结构：模块归属、App 接线方式、历史粒度机制、还原编排与竞态。

约束：禁止 server / page-core / wal-core / `api.ts` 触碰；不得触发整页导航；凭据与瞬态不入 URL。

## 方案对比与决策

### 决策 1：URL 编解码与还原判定 = 纯函数模块，App 集中接线

| 方案 | 概要 | 优点 | 缺点 |
|---|---|---|---|
| A（选定） | 新模块 `apps/web/src/urlState.ts`（纯函数，无 DOM）：`parseUrlState` / `buildUrlState` / `planRestoreActions`；App.tsx 用一个集中 sync effect + 显式提交标记接线 | 沿仓库先例（`indexView.ts`、`heapPeek.ts` 等纯模块 + 薄 App 层）；全部 URL 逻辑可 node 环境单测（现有 vitest 仅 `*.test.ts` 纯模块，无 jsdom/组件测试基建）；集中 effect 不遗漏分散的 setState 调用点 | App.tsx 增约一个 effect + 若干 ref 的胶水代码 |
| B | 引入路由库（react-router 等）或自建 hash 路由 | 生态成熟 | 违背「无路由单页 + query 参数」形态；新增依赖解决不了 query-only 深链的核心问题（历史粒度、Load 提交点）；过度工程 |
| C | 在每个变更 handler 内散点调用写 URL | 无集中 effect 的时序问题 | 调用点多（表/索引/过滤器/种类/模式/三种 Load/连接重置/还原），漏一处即不一致；handler 内拿不到批量 setState 后的终态 |

**决策：A。** `urlState.ts` 导出：

- `UrlState`：7 参数的规范形（`blkno: number | null`，null = 未加载不编码；LSN 同理）。
- `parseUrlState(search: string)`：`URLSearchParams` 解析；未知参数名忽略；已知参数值非法 → `{ ok: false, error: AppError }`（`BAD_URL_PARAM`，形状沿 `{code,message,nextStep}`）；`mode=wal` 时丢弃 `kind`（P1「wal 下忽略」）；同名参数取首个出现。校验口径逐参数镜像既有合同：`table`/`index` 同 server `parseOidParam`（`Number(raw)`、`Number.isInteger`、`1..4294967295`；科学计数法等 `Number` 接受的形式与 server 口径一致，不额外收紧）；`blkno` 同 `BAD_BLKNO`（整数 ≥0，上界留给对象层 `BLKNO_OUT_OF_RANGE`）；LSN 同 wal-core `LSN_RE`（`^([0-9A-Fa-f]+)/([0-9A-Fa-f]+)$`，trim 后匹配）。LSN 只做格式校验，start≤end 交给 Load 时的既有 `BAD_LSN`（P0-6 自动加载场景由服务端合同回答，格式层不重复裁决）。
- `buildUrlState(state: UrlState): string`：模式过滤 + 规范输出。全默认（page/table/无选择/无加载）→ 空串（裸 URL）；否则 page 模式输出 `mode,kind,table?,index?,blkno?`（`index` 仅 `kind=index` 时输出；`blkno` 仅已加载时输出，含 0），wal 模式输出 `mode,startLsn?,endLsn?`（page 参数全部移除，P1 规范形）。固定参数顺序（不构成合同，仅为稳定测试与 diff）。
- `planRestoreActions(state, ctx)`：纯判定还原动作（见决策 3）。

### 决策 2：历史粒度 = Load 成功路径置「提交标记」+ 集中 effect 消费 push/replace

| 方案 | 概要 | 优点 | 缺点 |
|---|---|---|---|
| A（选定） | `loadBlk` / `loadIndexBlk` 成功尾部与 `applyWalLoadResult` 置 `urlPushPendingRef.current = true`；集中 sync effect 在目标 query ≠ 当前 `location.search` 时按标记 `pushState`，否则 `replaceState`，消费后清标记 | 提交点与 Spec「Load 成功 = 提交点」一一对应（恰 3 处，grep 可查）；选择/切换类无需任何 handler 改动（effect 自动 replace） | 标记是跨渲染可变状态，需文档化时序 |
| B | diff 新旧 UrlState 推断 push/replace（blkno 变化 = push） | 无标记 | 启发式脆弱：同块 Refresh、还原后首次 push、过滤器变化与块变化的组合难以区分；P0-11 语义靠猜 |
| C | 每次 Load 成功无条件 pushState | 简单 | 同块 Refresh / 同参重载产生不可见重复历史条目，后退「按了没反应」 |

**决策：A，含幂等规则**：目标 query 与当前地址相等时不写 history（同块 Refresh 不产生重复条目——裁决 1 的「后退 = 回到上一个已加载视图」在视图未变时无可回退对象；Toolbar Prev/Next、跨块加载、WAL 区间加载均产生新条目）。sync effect 细节：

- 依据当前状态派生目标 query：`mode`、`relationKind`、`selectedOid`、（index 模式）`selectedIndexOid`、（page 模式且 `pageView != null`）`loadedBlkno`、（wal 模式且 `walRangeMeta != null`）区间 LSN。`pageView`/`walRangeMeta` 在选择与切换时由既有 `resetPageView` / 模式切换清除，天然实现「切换后失效参数移除」。
- 写入前置条件 `syncReady`：初次还原判定完成（决策 3 的 restore effect 首次收敛或判定 `BAD_URL_PARAM`）后才允许写，避免挂载时把深链 replace 掉。
- 空目标保护 `preserveRawUrlRef`：初始解析失败（`BAD_URL_PARAM`）时置位；置位期间目标为空串而地址非空 → 跳过写入（P0-8「地址栏保留原 URL」）；用户首个视图动作（任一选择/切换/Load）后清位，此后正常同步（含连接重置回默认视图时清 URL）。
- `pushState`/`replaceState` 为 SPA 内操作，不触发整页导航（Spec 禁止项）。

### 决策 3：启动/后退还原 = pendingRestore 状态 + 单一 restore effect（连接与列表就绪门控）

| 方案 | 概要 | 优点 | 缺点 |
|---|---|---|---|
| A（选定） | 挂载时解析一次存 `pendingRestore: UrlState \| null`（state）；单一 effect 依 `connected + 列表就绪` 门控应用输入侧状态并按 `planRestoreActions` 自动加载；popstate 复用同路径（`setPendingRestore(解析结果)`） | 未连接（P0-7）与已连接（P0-4..6）同一代码路径；`onConnect` 重置选择后 effect 幂等重放；「后退等价于启动还原」由构造保证 | effect 依赖较多（connected/tables/indexes/标志），需列出依赖清单 |
| B | main.tsx 渲染前解析并注入初始 props | 启动早 | 连接/列表异步使「注入」仍需 App 内等待逻辑；后退路径完全无法复用；双入口维护 |
| C | 还原逻辑写在各 Load handler 内分支 | 无新 effect | 污染全部既有 handler；竞态分支爆炸 |

**决策：A。** 编排时序：

1. **挂载**：`useState` 初始化器解析 `window.location.search`（StrictMode 双跑无害，纯函数）。非法 → `setError(BAD_URL_PARAM)` + 默认视图可用 + `preserveRawUrlRef` 置位；合法且非默认 → `pendingRestore = state`。
2. **restore effect**（deps：`pendingRestore`、`connected`、`tables`、`tablesFetched`、`indexes`、`indexesFetched`）：`pendingRestore` 为空或未连接 → 等待（P0-7：连接面板照常，参数保留在 state 与 URL）。已连接 → 应用输入侧（`setMode`/`setRelationKind`/`setSelectedOid`（index 模式先过 `indexSelectionSurvives` 丢弃不一致选择，复用既有 helper）/`setBlkno`/LSN 输入），再按 `planRestoreActions` 行动：
   - `wait`：page+table 需 `tablesFetched`（新增布尔，`refreshTables` finally 置 true——现状无此标志）；page+index 需 `indexesFetched`（既有，`relationKind=index` 触发懒加载）；未就绪本轮返回，列表到达后 effect 重跑。
   - `load-table(oid, blkno ?? 0)`：`table` 在列表中且 `blocks === 0` → 不加载（既有空表守卫与提示面板）；不在列表 → 仍发加载，由服务端 `NOT_HEAP_TABLE` 回答（P0-9 对象层合同）。
   - `load-index(oid, blkno ?? 0)`：索引在列表且非 B-tree → 不发请求（既有 `canLoadIndex` 守卫 + inline hint）；不在列表 → 调 `loadIndexBlk`，其既有 `indexes.find` 分支给出客户端 `NOT_INDEX`（P0-9）。
   - `load-wal(start, end)`：复用抽取自 `onWalLoad` 的 `loadWalRange(start, end)`（onWalLoad 读 state，还原路径需直传参数，避免 stale state）。
   - 其余组合（无 `table`/无 `index`/单 LSN）→ 仅还原输入侧（P1 部分参数）。
   - 动作落定后 `setPendingRestore(null)`；以 `restoreEpochRef` 防同参数自动加载双发（StrictMode）。
3. **`.env` 自动连接 vs 还原先后**：自动连接（挂载 effect 的 `getSession`）与手动连接共用上述门控——前者在连接+表列表就绪后由同一 effect 收敛，后者在 `onConnect` 重置状态后由 effect 幂等重放（`pendingRestore` 不被 `onConnect` 清除）。两种形态无独立分支。
4. **WAL 预填不覆盖（P0-6）**：还原携带任一 LSN → 置 `walPrefillSuppressedRef`，首次进入 wal 模式的 recent-20 预填跳过（endLsn 留空，Spec P1「或空」允许）；消费一次后清位，后续模式重进恢复既有预填行为（不改动预填对普通用户语义）。
5. **popstate**：监听器解析 `location.search` → `setPendingRestore(结果)`，由同一 effect 完成应用与自动加载（P0-11「等价于启动还原路径」）。会话内历史条目均为本应用写入的规范形；解析失败（防御分支）按挂载错误路径处理。popstate 应用态经 sync effect 派生的目标 query 与地址相等 → 不回写（无循环）。

### 决策 4：瞬态与 heap-peek 隔离确认

sync effect 的派生输入封闭为 7 参数对应的状态（决策 2 列表）；`selectedId`/`highlight`/`hexLocate`/`diffIds`/折叠面板/`heapPeek` 槽位不参与派生，浮层开合不可能泄漏进 URL（Spec 排除集，无泄漏路径）。主题走既有 localStorage，不入 URL。

## 模块影响

| 模块 | 变更 |
|---|---|
| `apps/web/src/urlState.ts`（新） | `UrlState`、`parseUrlState`、`buildUrlState`、`planRestoreActions`（含 `RestoreCtx`/`RestoreAction` 类型）；纯函数、无 DOM、无 React 依赖 |
| `apps/web/src/urlState.test.ts`（新） | 编解码/校验/模式过滤/还原判定单测（node 环境，沿 `indexView.test.ts` 先例） |
| `apps/web/src/App.tsx` | 接线点：①挂载解析 + `pendingRestore` state + `tablesFetched` state + 4 个 ref（`urlPushPending`/`restoreEpoch`/`walPrefillSuppressed`/`preserveRawUrl`）；②`loadBlk`/`loadIndexBlk` 成功尾部、`applyWalLoadResult` 置 push 标记；③restore effect（新）；④预填 effect 加抑制门控；⑤sync effect（新）；⑥popstate 监听 effect（新）；⑦`onWalLoad` 抽出 `loadWalRange` 复用 |
| `apps/web/src/api.ts`、server、page-core、wal-core | **零触碰**（`/api/*` 合同不变） |

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| popstate 与在途 Load 竞态（后退触发新加载时旧加载晚归） | 旧页数据覆盖新视图（既有代码本无加载取消；双击 Load 同型） | 单人本地工具，last-write-wins 可接受；不在本项引入取消机制（超范围）；记入 dev-notes 手测项 |
| Load 成功与选择变更同批次渲染时 push 标记归属错位 | 极端交错下多一条「选择态 URL」历史（仍是有效视图） | 标记语义定为「下一次集中同步用 push」；影响仅为历史条目粒度，无数据/崩溃风险；设计内记录，不为它增加耦合 |
| `URLSearchParams` 将 LSN 的 `/` 编码为 `%2F` | 地址栏显示形态因浏览器而异 | 解析双向兼容（`URLSearchParams` 接受 `%2F` 与裸 `/`）；复制/粘贴/收藏 round-trip 无损；手测清单覆盖 |
| StrictMode 双跑导致自动加载双发 | dev 下重复请求 | `restoreEpochRef` 门控；生产无此模式；既有 `getSession` 双跑为先例 |
| 空 URL 保护与「连接重置后清 URL」冲突 | 默认视图残留旧深链 | `preserveRawUrlRef` 仅在初始解析失败时置位、首个用户动作即清；正常路径连接重置 → 目标空串 → replace 清地址 |
| 手改地址栏触发整页导航 | 与 SPA 同步路径无关 | 整页导航即启动还原路径（正确语义），非本设计处理范围 |

## 对 Plan 与 Developer 的要点

### Plan

- 任务按「纯模块（TDD）→ App 还原接线 → App 同步/历史接线 → 浏览器手测 → 文档」排序；L2 覆盖全部纯函数，浏览器行为（地址栏时机、后退、书签、新 tab）走手测清单（现有 vitest 无组件/jsdom 基建，不为单项引入）。
- 最低验证层预计 **L2 + 定向手测**；server 零改动 → L3 无对象（Plan 内论证）。

### Developer

- 三处 Load 成功提交点必须且只在此三处置 push 标记（`loadBlk`、`loadIndexBlk`、`applyWalLoadResult`）；新增 Load 路径须同步补标记。
- `planRestoreActions` 保持纯函数：所有「等列表 / 守卫 / 丢弃」判定进该函数并配单测，App 只执行动作。
- 复用既有 helper（`indexSelectionSurvives`、`canLoadIndex`、空表分支），不得复刻第二套判定。
- `urlState.ts` 顶部注释声明参数名为公开合同（Spec：改名须向后兼容）。

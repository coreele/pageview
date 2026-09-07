# Plan: url-deeplink

## 元信息

- 工作项标识: url-deeplink（sub-feature-id = url-deeplink，未拆分）
- 依据 Spec: workflow/docs/features/url-deeplink/spec.md（2026-09-04 用户确认通过，含 4 项裁决：历史粒度 / 编码范围 / 未连接还原 / 失效呈现）
- 依据 Design: workflow/docs/features/url-deeplink/design.md
- 依据 UI Design: workflow/docs/features/url-deeplink/ui-design.md（`UI 表面: gui`）
- 路径等级: standard
- Review 门禁: **required**（进入 QA 前须 Reviewer `Approve`）
- 源分支: `url-deeplink`（自 `main` 创建，禁止在 main 直接实施）→ 目标分支: `main`
- 最低验证层: **L2 + 定向浏览器手测**
  - 理由：变更全部位于 `apps/web`（纯函数模块 + App 接线），server/page-core/wal-core 与 `/api/*` 合同零触碰 → L3（实库集成）无新增对象，既有 `pnpm test` 已覆盖 server 回归。地址栏更新时机、history 后退、书签/新 tab、`%2F` round-trip 均为真实浏览器行为，现有 vitest 为 node 纯模块环境（无 jsdom/组件基建，沿仓库先例不为本项引入）→ 按 ui-design 手测清单 M1–M10 补证。
- 验证命令:

```bash
# L2 — 单测 + 类型 + 构建
pnpm test                 # 含 apps/web urlState 单测与既有模块回归
pnpm -r typecheck
pnpm -r build

# 定向手测（需浏览器 + 可达 PG；.env 自动连接或手动连接两形态）
pnpm dev:server           # 终端 1
pnpm dev:web              # 终端 2，按 ui-design M1–M10 清单执行
```

## 适用工程规范

- [文档工程](../../standards/documentation.md)
- [Git 协作](../../standards/git.md)（源分支 `url-deeplink`；报告/STATUS 提交时机见 §交接顺序）
- [质量与验证](../../standards/quality.md)
- [安全](../../standards/security.md)（URL 严禁编码凭据——Spec 合同；无新增 SQL/密钥接触）
- [UI/UX](../../standards/ui.md)

## 目标摘要

按已确认 Spec + Design + UI Design，交付 web 端 URL 深链：`urlState.ts` 纯函数模块（7 参数 parse/build/模式过滤 + 还原判定 `planRestoreActions`）、App 集中接线（选择类 replaceState、三处 Load 成功 pushState 提交点、启动/后退 `pendingRestore` 还原编排含未连接等待与自动加载守卫、WAL 预填不覆盖、`BAD_URL_PARAM` 经既有错误面板呈现）、README 双语用户文档；既有视图行为与 `/api/*` 合同零回退（P0-1..P0-14、P1）。

**UI/UX:** 见 `ui-design.md`（非 N/A）：文案冻结表、手测清单 M1–M10、零布局变更约束纳入 T5/T7 任务与证据。

## 任务拆解（TDD：每任务先写失败测试再实现）

### T1 — 分支与基线

- 触碰: 无代码；`git checkout -b url-deeplink main`
- 完成条件: 源分支就绪；`pnpm test && pnpm -r typecheck` 基线绿。

### T2 — `urlState.ts`：解析与编码（design 决策 1）

- 触碰: `apps/web/src/urlState.ts`（新）、`apps/web/src/urlState.test.ts`（新）
- 完成条件（测试先行）:
  - `parseUrlState`：7 参数合法值矩阵（枚举、oid 边界 `1`/`4294967295`、blkno `0`、LSN 大小写/trim）；非法值矩阵（`mode=xyz`、`kind=x`、`table=abc/-1/0/4294967296/""`、`blkno=-1/1.5`、`startLsn=ZZ/0x1/2`）→ `BAD_URL_PARAM` 且 message 含参数名与原值（逐字对照 ui-design 冻结表）；未知参数忽略（`?foo=1&mode=wal` ≡ `?mode=wal`）；`mode=wal` 丢弃 `kind`；同名参数首个生效；空 search → 全默认。
  - `buildUrlState`：P0-1/2/3 三视图规范串；全默认 → 空串；page→wal 参数过滤；`blkno`/LSN 未加载不编码；固定参数顺序输出。
  - 编解码 round-trip：`parse(build(s)) ≡ s`（含 LSN `/` 与 `%2F` 双形态输入）。
- 验收映射: P0-1/2/3、P0-8、P0-12、P1（规范化/未知参数/忽略）的数据层。

### T3 — `planRestoreActions`：还原判定（design 决策 3）

- 触碰: `apps/web/src/urlState.ts`、`apps/web/src/urlState.test.ts`
- 完成条件（测试先行）:
  - 未连接 / 列表未就绪 → `wait`；表/索引/区间齐全 → 对应 `load-*`（`blkno` 缺省 0）；0 块表、非 B-tree → 不加载分支；`table`/`index` 不在列表 → 仍发加载（对象层既有错误路径）；无 `table`/无 `index`/单 LSN/`kind=index` 无 `index` → 仅还原输入侧。
  - 判定矩阵覆盖 Spec「还原判定」与「部分参数缺失」「内部不一致」全部行。
- 验收映射: P0-4..P0-7 判定层、P1（单 LSN/无 blkno/守卫拦截）。

### T4 — App：还原接线（design 决策 3 + ui-design 流程 2）

- 触碰: `apps/web/src/App.tsx`
- 完成条件:
  - 挂载解析一次；非法 → `setError(BAD_URL_PARAM)`（文案逐字取冻结表）+ 默认视图 + `preserveRawUrlRef`；合法非默认 → `pendingRestore`。
  - restore effect：connected + `tablesFetched`（新增标志，`refreshTables` finally 置位）/`indexesFetched` 门控；应用输入侧（index 选择先过既有 `indexSelectionSurvives`；守卫复用 `canLoadIndex` 与空表分支）；按 `planRestoreActions` 动作调用既有 `loadBlk`/`loadIndexBlk`/新抽 `loadWalRange`（自 `onWalLoad` 重构，行为不变）；`restoreEpochRef` 防双发；落定后清 `pendingRestore`。
  - `onConnect` 重置后 effect 幂等重放（P0-7：连接面板形态不变，连接成功自动还原加载）。
  - WAL 预填 effect：还原携带任一 LSN → 首次进入 wal 模式跳过预填（`walPrefillSuppressedRef`，消费一次）；无深链 LSN 时预填行为零改动。
- 验收映射: P0-4..P0-8、P0-14、P1（单 LSN/守卫/不一致）接线层。

### T5 — App：同步与历史（design 决策 2 + ui-design 流程 1）

- 触碰: `apps/web/src/App.tsx`
- 完成条件:
  - 三处 Load 成功提交点（`loadBlk`/`loadIndexBlk` 成功尾部、`applyWalLoadResult`）置 push 标记；集中 sync effect：派生 7 参数目标 query（瞬态/heap-peek 不参与）→ ≠ 地址时按标记 pushState / 否则 replaceState；相等不写（同块 Refresh 无重复历史）；`syncReady` 与空目标保护（`preserveRawUrlRef`：非法 URL 期间不自动清地址栏，首个用户动作后恢复常规同步）。
  - popstate 监听：解析地址 → `setPendingRestore` 复用还原路径（P0-11 含自动重载）；派生相等不回写（无循环）。
  - 全部为 SPA 内 history 操作，无整页导航；模式/种类切换 handler 零改动（effect 自动 replace）。
- 验收映射: P0-1/2/3、P0-11、P0-13、P1（切换不新增历史/规范化）。

### T6 — 浏览器手测

- 触碰: 无产品代码；`workflow/docs/features/url-deeplink/dev-notes.md`
- 完成条件: 按 ui-design M1–M10 逐项执行并记录结论（含 LSN `%2F` round-trip、后退/前进、书签、新 tab 并排、未连接还原、`BAD_URL_PARAM` 呈现与后续 URL 跟随、两主题下错误面板可读）；L2 三命令输出摘录入 dev-notes。

### T7 — 文档

- 触碰: `README.md`、`README.zh-CN.md`、`workflow/docs/features/url-deeplink/dev-notes.md`
- 完成条件: README 双语 Features（Shared 节）各增深链一句 + 示例 URL（`?mode=page&kind=table&table=<oid>&blkno=<n>`）；Troubleshooting 双语各增 `BAD_URL_PARAM` 行（与冻结表 nextStep 语义一致）；dev-notes 记 T2–T6 证据。

## 依赖与顺序

```text
T1 → T2 → T3 → T4 → T5 → T6 → T7
```

T2 是 T3/T4 的模块前置；T4/T5 均改 `App.tsx` 顺序执行（T5 依赖 T4 的 restore 基础）；T6 依赖 T4+T5 全量行为；T7 收尾（README 可与 T6 并行起草，以实现定稿）。

## 触碰路径

| 区域 | 路径 |
|---|---|
| web | `src/urlState.ts`（新）、`src/urlState.test.ts`（新）、`src/App.tsx` |
| 文档 | `README.md`、`README.zh-CN.md`、`workflow/docs/features/url-deeplink/dev-notes.md` |

**不触碰:** `spec.md`、工作项记录、`workflow/docs/manager/**`；`api.ts`、server、page-core、wal-core 及一切 `/api/*` 合同；`HexDump`/`StructureMap`/`WalView`/`HeapPeekOverlay` 等视图组件；主题机制。

## 验收

Spec P0-1..P0-14、P1 逐项见 `spec.md`；UI 证据对照 `ui-design.md` 验收映射与 M1–M10。

| 层 | 预期证据 |
|---|---|
| L2 | `pnpm test` 全绿（urlState 解析/编码/round-trip/判定矩阵 + 既有 web/server/core 模块零回退）；`pnpm -r typecheck` / `pnpm -r build` 零错误 |
| 手测 | M1–M10 逐项 Pass 记录于 `dev-notes.md`（地址栏时机、还原三形态、错误呈现、历史后退/前进、裸 URL 回归、round-trip、P1 抽核、并排/分享） |
| N/A | L3/L4：无 server/API/实库变更对象（见元信息论证）；server 侧仅被动跑既有回归 |

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | `workflow/docs/features/url-deeplink/dev-notes.md`（TDD 证据、手测结论）；`urlState.ts` 顶部参数名公开合同注释（T2 内） |
| 用户文档 | `README.md` + `README.zh-CN.md` 双语同步：Features 增深链一句 + 示例 URL（Spec 用户故事文档项）；Troubleshooting 增 `BAD_URL_PARAM` 行（新用户可见错误码） |
| 运维文档 | N/A — 本地单人调试工具，无部署/监控/备份变更；连接与扩展前置条件沿用既有说明 |

## 无法执行验证时的处理

| 缺口 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 手测 M1–M10 | 无浏览器联调环境或不可达 PG | 地址栏/历史/还原等浏览器行为未核验（L2 无法替代） | `pnpm dev:server` + `pnpm dev:web` + 可达 PG（`.env` 或手动连接）后按清单补测；期间不得以 L2 通过替代手测证据 |
| 未连接还原（M3） | 环境始终有 `.env` 自动连接 | P0-7 路径未实证 | 临时移除/清空 `.env` 重启 server 补测 |

禁止静默跳过；缺口按 quality.md §6 记录（`dev-notes.md` / 工作项记录阻塞字段）。

## Review 门禁与进入 QA

1. Review 门禁 **required**：Developer 完成 T1–T7 且 L2 + 手测证据入 `dev-notes.md` 后调度 Reviewer；对照 Spec + design.md（决策 1–4、风险表）+ ui-design.md（冻结文案、M1–M10）+ 本 Plan。
2. 取得 `Approve` 后方可进入 QA；`Request changes` → Developer 修复 → 复审。
3. QA 独立验收：逐项 P0/P1 + L2 复跑 + 手测抽核（重点 P0-7/P0-11/M8）；结论写 `qa-report.md`（Pass/Fail/Blocked）。QA Pass 前**不**提交 `review.md`/`qa-report.md`（git.md §1.4）。

## 交接顺序

1. **Plan 确认**（本文件）→ 当前用户会话确认 → Manager 持久化 → 状态 `planned`。
2. **Developer**：自 `main` 创建/检出 `url-deeplink` → T1..T7；全部实现、修复、文档在源分支提交（Conventional Commits）。
3. **Reviewer** 审阅 → Approve。
4. **QA** 验收 → Pass → 请求用户合并授权。
5. 授权后 Manager 在源分支将状态置 `done` 并与未入库的 `review.md`/`qa-report.md` **一次提交**；随后按 git.md 合入 `main`。

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-09-04 | 初稿：T1–T7（TDD）；L2 + 手测 M1–M10 最低验证层（server 零改动，L3 无对象）；冻结文案与清单引自 ui-design；git/文档/交接按标准 |

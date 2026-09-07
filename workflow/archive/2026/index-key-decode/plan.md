# Plan: index-key-decode

## 元信息

- 工作项标识: index-key-decode（sub-feature-id = index-key-decode，未拆分）
- 依据 Spec: workflow/archive/2026/index-key-decode/spec.md（2026-08-31 用户确认通过，含 3 项裁决）
- 依据 Design: workflow/archive/2026/index-key-decode/design.md
- 依据 UI Design: workflow/archive/2026/index-key-decode/ui-design.md（`UI 表面: gui`）
- 路径等级: standard
- Review 门禁: **required**（进入 QA 前须 Reviewer `Approve`）
- 源分支: `index-key-decode`（自 `main` 创建，禁止在 main 直接实施）→ 目标分支: `main`
- 最低验证层: **L3**（`pnpm test:integration` 实库 pageinspect + SQL 对照）+ L2 全绿基线 + 定向浏览器手测
  - 理由：解码正确性的权威判据是 Spec 的 oracle（pageinspect `get_raw_page`+`bt_page_items` 与 ctid 行 SQL 值对照），须真实 PG（CI integration job 为 postgres:16 + pageinspect + 超级用户，已具备）；server 端点形状/守卫（P0-1）同属 API 行为。纯 UI 呈现（徽标/降级标注/截断注/主题）无法自动化，按 ui-design 手测清单补证。
- 验证命令:

```bash
# L2 — 全部单测（page-core 含 btree-decode synthetic + oracle fixture；server 端点；web 纯模块）
pnpm test
pnpm -r typecheck
pnpm -r build

# L2 — 实捕 fixture（可选，任一 PG16 环境执行一次并提交产物）
pnpm exec tsx scripts/capture-fixtures.ts --index public.t_a_b_idx --blkno 1 \
  --out packages/page-core/fixtures/idx-composite   # 另捕各场景，见 fixtures README

# L3 — 实库冒烟（需 .env + PG16 + pageinspect；CI integration job 同口径自动执行）
pnpm test:integration
```

## 适用工程规范

- [documentation.md](../../../agents/standards/documentation.md)
- [git.md](../../../agents/standards/git.md)（源分支 `index-key-decode`；报告/STATUS 提交时机见 §交接顺序）
- [quality.md](../../../agents/standards/quality.md)
- [security.md](../../../agents/standards/security.md)（新增 SQL 仅只读 catalog 查询；无凭据/密钥接触；元数据不含敏感数据）
- [workflow/agents/standards/ui.md](../../../agents/standards/ui.md)

## 目标摘要

按已确认 Spec + Design + UI Design，交付 index tuple 键值解码：`GET /api/indexes/:oid/columns` 元数据端点（pg_attribute/pg_index，含 indkey/indoption 解析）、page-core `decodeIndexTupleKeys`（typoid 策略映射、无逐列对齐步进、pivot 尾 TID 排除、NULL/降级语义）、web 键值区（每列一行 + 徽标 + 降级标注，元数据获取与页面渲染解耦、失败仅 hex）、三层 oracle（synthetic / 实捕 fixture / CI SQL 对照）、既有 index-viewer 与 heap 路径零回退（P0-1..P0-13、P1）。

**UI/UX:** 见 `ui-design.md`（非 N/A）；任务 T6/T7 与手测证据以其为依据。

## 任务拆解（TDD：每任务先写失败测试再实现）

### T1 — 分支与基线

- 触碰: 无代码；`git checkout -b index-key-decode main`
- 完成条件: 源分支就绪；`pnpm test && pnpm -r typecheck` 基线绿。

### T2 — 实捕 fixture 与步进规则冻结（design §3/§6 前置）

- 触碰: `scripts/capture-fixtures.ts`、`packages/page-core/fixtures/idx-*`（新）、`packages/page-core/fixtures/README.md`
- 完成条件:
  - `--index` 增捕 `indexColumns`（与端点同 SQL）与 owning table 行值（UTC 会话按 ctid `::text`）入 oracle.json；
  - 捕获并提交场景：`(a int, b text) INCLUDE (c int)` 复合、含 DESC 列索引、bool/date/timestamp/timestamptz/uuid 单列、nullable 含 NULL、>64 字符与多字节与 >127B（4B varlena 头）text、表达式索引 `lower(name)`、`(a int, j jsonb)`；既有 `btree-internal` fixture 复用为 pivot 对照；
  - 对照 PG16 `indextuple.c`/`itup.h`/`nbtree.h` 核对 design §3 规则表（bitmap 长度、无逐列对齐、pivot 尾 TID 存在性、minus-infinity），偏差记 `dev-notes.md`。
- 验收映射: P0-2..P0-11 的数据基础；风险 R1/R2 缓解。

### T3 — page-core：`decodeIndexTupleKeys` + builder 扩展

- 触碰: `packages/page-core/src/btree-decode.ts`（新）、`types.ts`（如需）、`index.ts`（导出）、`fixture-builder.ts`（null bitmap / pivot nkeyatts+尾 TID / typed payload 组装）、`tests/btree-decode.test.ts`（新）、`tests/btree-oracle.test.ts`（扩展）、`tests/btree.test.ts`（回归）
- 完成条件（测试先行）:
  - synthetic：P0 全类型值约定（int 十进制 BigInt、bool、引号包裹 text、`\xNN` 转义、date/timestamp/timestamptz 微秒与 `Z`/±infinity、uuid 小写连字符）；多列混排步进（无对齐）；NULL bitmap（1B 与 9 列双字节）；pivot 尾 TID 排除、nkeyatts 截断尾列 NULL、minus-infinity；posting keyRange；4B varlena 头与 external 标志、越界 → `error` 且其后降级；未命中 typoid → `unsupported`；
  - oracle fixture：`idx-*` 场景解码值 == oracle 的 ctid 行 SQL 值（时间类按 Spec 格式归一化）；internal pivot == 右子页 hikey；
  - `parseBtreePage`、heap `decode.ts` 既有测试零改动。
- 验收映射: P0-2..P0-9（数据层）、P0-11。

### T4 — server：columns 端点

- 触碰: `apps/server/src/catalog.ts`、`app.ts`、`apps/server/tests/`（新 `index-columns.test.ts` 或并入 `indexes.test.ts`）
- 完成条件（测试先行）:
  - SQL 契约测试（stub pool 沿既有模式）：pg_attribute(attnum≤indnatts) JOIN pg_type、pg_index meta、排序；indkey `"1 2"`/indoption 位解析（hasExpression/isExpression/kind/descending/nullsFirst，include 列恒 false）；
  - 路由测试：守卫序 NOT_CONNECTED → PAGEINSPECT_MISSING → BAD_OID → NOT_INDEX(表 oid) → INDEX_NOT_BTREE(hash)；成功响应形状 == Spec 合同（含 indnatts=3/indnkeyatts=2 例）；
  - 既有 `indexes.test.ts`/heap 路由测试零回退。
- 验收映射: P0-1。

### T5 — web：API 层与元数据状态

- 触碰: `apps/web/src/api.ts`、`App.tsx`、`indexKeyDetail.ts`（新，状态派生部分）、相关 `.test.ts`
- 完成条件:
  - `IndexColumnsResponse` 类型 + `fetchIndexColumns`；
  - `indexColumns` 按 oid 缓存（成功缓存 / 失败不缓存重试 / 连接重建与 refreshIndexes 清空），`ensureIndexColumns` 在 `loadIndexBlk` 内触发——不 await、不 setError、不入 loadState；`loadIndexBlk` 注释更新（Spec 修订「无 schema 调用」合同）；
  - 纯函数单测：缓存命中/miss/清空时序；降级派生（loading/failed/expression → ui-design 文案）。
- 验收映射: P0-12、P0-13（合同面）。

### T6 — web：键值区渲染

- 触碰: `apps/web/src/indexKeyDetail.ts`（行模型）、`IndexTupleDetail.tsx`、`StructureMap.tsx`（prop 透传）、`App.tsx`（renderDetail 注入）、`styles.css`、相关 `.test.ts`
- 完成条件:
  - 键值区置于 Key bytes hex 块之上：每列一行 `{attnum} {name} ({typname}) = {display}`、`NULL`、`include` 徽标、长值 64 字符截断 + 总长注、行级/索引级降级标注、loading 行（文案逐字按 ui-design 冻结表）；
  - metapage 无键值区；hex 按钮及其 onSelectRange 行为零改动；三联区布局不变；
  - 纯函数单测：行格式化、截断注、徽标、降级文案、decodeIndexTupleKeys 输出→行模型映射。
- 验收映射: P0-2..P0-13（呈现面）。

### T7 — P1 扩展

- 触碰: `packages/page-core/src/btree-decode.ts`、`apps/server/src/catalog.ts`（domain 基类型）、`apps/web/src/indexKeyDetail.ts`、`IndexTupleDetail.tsx`、`styles.css`、相关测试
- 完成条件:
  - 解码：numeric（十进制精确串、NaN/Infinity）、float4/float8（±Infinity/NaN）、bytea（`\x…`）+ 单测（synthetic 为主，oracle 种子含 numeric/float 列）；
  - server：`typtype='d'` 以 typbasetype 替换（响应形状不变）+ 路由测试；
  - UI：`↓`/`nulls first` 徽标（indoption）；键值行点击 → hex 区间高亮（id `tuple-{lp}.col-{attnum}`，复用既有机制）；pivot 尾部 heap TID 显示 `(block,offset)`；
  - 若需裁剪 P1 范围，须经当前用户会话决策后由 Manager 记录，不得静默省略。
- 验收映射: Spec P1 各项。

### T8 — 集成冒烟与 CI

- 触碰: `apps/server/src/integration-smoke.ts`、`.github/workflows/ci.yml`（如需种子对象调整）
- 完成条件:
  - 冒烟增 B-tree 解码段（独立 schema、幂等、退出清理）：种子同 T2 场景；`app.inject` 断言 `/api/indexes/:oid/columns` 形状 + 守卫（表 oid/hash/非数字 oid）；取 leaf/internal 页 → `decodeIndexTupleKeys` 与 ctid 行 SQL 值对照（UTC 会话 `::text` 归一化）；表达式索引与 jsonb 降级断言；既有 B-tree 段不回退；
  - CI unit + integration job 全绿；退出码语义沿既有（blocked=2）。
- 验收映射: P0-1..P0-12（实库）、oracle 合同。

### T9 — 文档与交接

- 触碰: `README.md`、`README.zh-CN.md`、`packages/page-core/fixtures/README.md`（T2 内）、`workflow/archive/2026/index-key-decode/dev-notes.md`
- 完成条件: README 双语各补一句（见文档影响表）；dev-notes 记录 T2 规则冻结结果、L2/L3 证据、手测清单结论（ui-design 清单）。

## 依赖与顺序

```text
T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9
```

- T2 是 T3 规则冻结与 oracle 对照前置；T3 是 T5/T6 数据前置；T4 是 T5 联调前置（可 T4 ∥ T3，不同模块）；T6 依赖 T3+T5；T7 依赖 T6；T8 依赖 T3+T4+T6（P1 段依赖 T7）；T9 收尾。

## 触碰路径

| 区域 | 路径 |
|---|---|
| page-core | `src/btree-decode.ts`、`index.ts`、`types.ts`、`fixture-builder.ts`、`fixtures/idx-*`、`tests/btree-decode.test.ts`、`tests/btree-oracle.test.ts`、`tests/btree.test.ts` |
| server | `src/catalog.ts`、`src/app.ts`、`src/integration-smoke.ts`、`tests/*` |
| web | `src/api.ts`、`App.tsx`、`indexKeyDetail.ts`、`IndexTupleDetail.tsx`、`StructureMap.tsx`、`styles.css`、相关测试 |
| 工具/CI | `scripts/capture-fixtures.ts`、`.github/workflows/ci.yml` |
| 文档 | `README.md`、`README.zh-CN.md`、`packages/page-core/fixtures/README.md`、`workflow/archive/2026/index-key-decode/dev-notes.md` |

**不触碰:** `spec.md`、工作项记录、`workflow/archive/2026/**`；`parseBtreePage`、heap 解码语义（`parsePage`/`decode.ts`）与 `/api/tables/*` 合同；Key bytes hex 块行为；WAL 模式任何文件。

## 验收

Spec P0-1..P0-13、P1 逐项见 `spec.md`；UI 证据对照 `ui-design.md` 验收映射。

| 层 | 预期证据 |
|---|---|
| L2 | `pnpm test` 全绿（btree-decode synthetic 全类型/步进/降级、oracle fixture 对照、server 端点形状与守卫序、web 纯模块）；`pnpm -r typecheck` / `-r build` 零错误 |
| L3 | `pnpm test:integration` 退出 0：columns 端点形状/守卫实库一致；leaf/posting/pivot/hikey 解码值 == ctid 行 SQL 值（UTC 归一化）；降级场景（表达式/jsonb）断言通过；既有 B-tree/heap 段不回退 |
| 手测 | ui-design 清单：加载中标注、断连降级、表达式索引、jsonb 混合、NULL/include/截断注、徽标（P1）、行→hex 高亮（P1）、两套主题可读、hex 联动/结构图/Refresh diff 不回退；结论入 `dev-notes.md` |

### 无法执行验证时

| 缺口 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| T2 实捕 fixture | 本地无 PG16/pageinspect | oracle 对照仅剩 CI 实时执行；步进规则冻结证据弱 | 任一 PG16 环境补捕并提交（CI 产物或用户机）；期间 oracle 测试 skip 须显式标注且**不作为通过证据** |
| T8/L3 | CI 不可用或 .env 缺失 | 端点/解码未实锤（Spec oracle 合同未满足） | 恢复 CI / 提供 .env 后补跑；记入工作项阻塞字段（Manager） |
| 手测 | 无浏览器联调 | UI 验收点未核验 | `pnpm dev:server` + `pnpm dev:web` 后按清单补测 |

禁止静默跳过；缺口按 quality.md §6 记录（`dev-notes.md` / 工作项记录）。

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | `workflow/archive/2026/index-key-decode/dev-notes.md`（T2 规则冻结记录、L2/L3/手测证据）；`packages/page-core/fixtures/README.md`（`--index` 新增 oracle 段说明与场景表） |
| 用户文档 | `README.md` + `README.zh-CN.md` 双语同步：Features 索引节各补一句「index tuple 键值按列类型解码展示（支持常见标量类型；不支持时降级为仅 hex）」（Spec P1 文档项；API 节无需新增——端点为内部前端合同，Troubleshooting 无新用户可见错误码） |
| 运维文档 | N/A — 本地单人调试工具，无部署/监控/备份变更；PG 前置条件沿用既有 pageinspect 说明 |

## Review 门禁与进入 QA

1. Review 门禁 **required**：Developer 完成 T1–T9 且 L2/L3/手测证据入 `dev-notes.md` 后调度 Reviewer；对照 Spec + Design（§1–§6 决策与规则表）+ ui-design + 本 Plan。
2. 取得 `Approve` 后方可进入 QA；`Request changes` → Developer 修复 → 复审。
3. QA 独立验收：逐项 P0/P1 + L3 复跑 + 手测抽核；结论写 `qa-report.md`（Pass/Fail/Blocked）。QA Pass 前**不**提交 `review.md`/`qa-report.md`（git.md §1.4）。

## 交接顺序

1. **Plan 确认**（本文件）→ 当前用户会话确认 → Manager 持久化 → 状态 `planned`。
2. **Developer**：自 `main` 创建/检出 `index-key-decode` → T1..T9；全部实现、修复、文档在源分支提交（Conventional Commits）。
3. **Reviewer** 审阅 → Approve。
4. **QA** 验收 → Pass → 请求用户合并授权。
5. 授权后 Manager 在源分支将状态置 `done` 并与未入库的 `review.md`/`qa-report.md` **一次提交**；随后按 git.md 合入 `main`。

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-08-31 | 初稿：T1–T9（TDD）；L3 最低验证层；步进规则冻结前置；oracle 三层（synthetic/实捕/CI）；git/文档/交接按标准 |

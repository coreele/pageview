# Plan: index-viewer

## 元信息

- 工作项标识: index-viewer（sub-feature-id = index-viewer，未拆分）
- 依据 Spec: workflow/docs/features/index-viewer/spec.md（2026-08-28 用户确认通过，含 5 项裁决）
- 依据 Design: workflow/docs/features/index-viewer/design.md
- 依据 UI Design: workflow/docs/features/index-viewer/ui-design.md（`UI 表面: gui`）
- 路径等级: full
- Review 门禁: **required**（进入 QA 前须 Reviewer `Approve`）
- 源分支: `index-viewer`（自 `main` 创建，禁止在 main 直接实施）→ 目标分支: `main`
- 最低验证层: **L3**（`pnpm test:integration` 实库 oracle 对照）+ L2 全绿基线 + 定向浏览器手测
  - 理由：B-tree 字节布局解析正确性的权威判据是 pageinspect oracle（Spec「验证 oracle」合同），须真实 PG（CI integration job 为 postgres:16 + pageinspect + 超级用户，已具备）；server 守卫序（P0-3/P0-11）同属 API 行为，L3 冒烟覆盖。纯 UI 呈现（徽标/位格条/空态/主题）无法自动化，按 ui-design 手测清单补证。
- 验证命令:

```bash
# L2 — 全部单测（page-core 含 btree + btree-oracle；server 含新路由；web 回归）
pnpm test
pnpm -r typecheck
pnpm -r build

# L2 — 实捕 fixture（可选，任一 PG16 环境执行一次并提交产物）
pnpm exec tsx scripts/capture-fixtures.ts --index public.demo_idx --blkno 0 \
  --out packages/page-core/fixtures/btree-meta   # 另捕 leaf/internal/posting

# L3 — 实库冒烟（需 .env + PG16 + pageinspect；CI integration job 同口径自动执行）
pnpm test:integration
```

## 适用工程规范

- [文档工程](../../standards/documentation.md)
- [Git 协作](../../standards/git.md)（源分支 `index-viewer`；报告/STATUS 提交时机见 §交接顺序）
- [质量与验证](../../standards/quality.md)
- [安全](../../standards/security.md)（新增 SQL 仅只读 catalog 查询；无凭据/密钥接触）
- [UI/UX](../../standards/ui.md)

## 目标摘要

按已确认 Spec + Design + UI Design，在 Page 模式内交付 B-tree 索引页可视化：索引发现与双层非 B-tree 拦截、`/api/indexes*` 双端点、`parseBtreePage`（meta/internal/leaf、special space、hikey、posting list，oracle 固化常量）、三联区复用渲染、块导航与 heap TID 跳表、heap 路径零回退（P0-1..P0-12、P1-1..P1-5）。

**UI/UX:** 见 `ui-design.md`（非 N/A）；任务 T5–T8 与手测证据以其为依据。

## 任务拆解（TDD：每任务先写失败测试再实现）

### T1 — 分支与基线

- 触碰: 无代码；`git checkout -b index-viewer main`
- 完成条件: 源分支就绪；`pnpm test && pnpm -r typecheck` 基线绿。

### T2 — 实捕 fixture + oracle 固化（design §4 策略 2/3 的前置）

- 触碰: `scripts/capture-fixtures.ts`、`packages/page-core/fixtures/btree-*`（新）、`packages/page-core/fixtures/README.md`
- 完成条件: `--index` 模式输出页 `.bin/.base64.txt/.meta.json` + oracle JSON（`bt_metap`/`bt_page_stats`/`bt_page_items`）；捕获 metapage、leaf、internal、含 posting 叶页（重复键 int 列索引）四场景并提交；布局常量按 oracle 实测冻结（与 design §4 预期表偏差记 `dev-notes.md`）。
- 验收映射: P0-4..P0-8 的数据基础；风险 R1/R2 缓解。

### T3 — page-core：btree 解析与结构字段

- 触碰: `packages/page-core/src/btree.ts`、`btree-structure.ts`（或并入 structure-fields，择一）、`index.ts`（导出）、`types.ts`（Region 扩枚举）、`fixture-builder.ts`（buildBtreePage）、`tests/btree.test.ts`、`tests/btree-oracle.test.ts`、`tests/structure-fields.test.ts`（回归）
- 完成条件（测试先行）:
  - synthetic 测试：meta/internal/leaf 分类、special 五字段、metapage 六/七字段（v3 不显示 allequalimage）、hikey 判定（含最右页反例）、posting 数量与 TID 列表、t_info 位解析、异常页（magic 不符/越界）产出 warnings 不崩溃、非 8KB 抛 `PageParseError`；
  - oracle 测试：四场景实捕 fixture 解析值 == oracle JSON；
  - `deriveBtreeStructureFields` 覆盖 header/itemid/free/tuple/special/meta 字段与 range；heap `deriveStructureFields` 既有测试不改动。
- 验收映射: P0-4..P0-9（数据层）。

### T4 — server：索引端点与守卫

- 触碰: `apps/server/src/catalog.ts`、`app.ts`、`apps/server/tests/catalog.test.ts`（或新 `indexes.test.ts`）
- 完成条件: `LIST_INDEXES_SQL`/`INDEX_RELATION_SQL` 契约测试（relkind='i'、am join、系统 schema 排除、pg_relation_size、排序）；路由测试（app.inject + stub pool 沿既有模式）覆盖校验序 ①`NOT_INDEX`(404) ②`INDEX_NOT_BTREE`(400，message 含 am 名) ③`BAD_BLKNO` ④`BLKNO_OUT_OF_RANGE`、门禁 `NOT_CONNECTED`/`PAGEINSPECT_MISSING`、成功响应形状；heap 路由测试零改动。
- 验收映射: P0-1、P0-3、P0-11（服务端）。

### T5 — web：API 层与输入侧状态机

- 触碰: `apps/web/src/api.ts`、`App.tsx`、`styles.css`
- 完成条件: `IndexRow` 类型 + `listIndexes`/`fetchIndexPage`；`relationKind` 分段控件 + index select（四要素 option、非 B-tree 标记、invalid 徽标）+ inline hint + Load 禁用逻辑（不发请求）+ `resetPageView` 清除语义 + 元信息条（页类型徽标/level/统计/posting 计数）；新增 `loadIndexBlk`（无 `/schema` 调用）；kind=表路径行为与渲染分支不变。
- 验收映射: P0-1、P0-2、P0-12、P1-2（徽标）。

### T6 — web：三联区 btree 渲染

- 触碰: `apps/web/src/StructureMap.tsx`、`diff.ts`、`hexLayout.ts`（如需 region 适配）、相关 `.test.ts`、`styles.css`（special/meta token 与 legend）
- 完成条件: `StructureMap` 消费 `StructureField[]`+`raw`+`freeRange`（heap 渲染等价，既有测试仅签名适配）；special/meta region 渲染与色签；metapage/空叶页空态说明；`findStructureAt`/`structureAffectedByDiff` 基于 fields 泛化，索引页选中↔hex 双向高亮、Refresh diff 生效；HexDump 零改动验证。
- 验收映射: P0-4..P0-6（呈现）、P0-9、P0-10、P1-4、P1-5。

### T7 — web：详情面板（special/meta/tuple）

- 触碰: `apps/web/src/IndexTupleDetail.tsx`（新）、`StructureMap.tsx`（detail 分支）、`styles.css`
- 完成条件: special 字段详情 + `btpo_flags` 位格条（复用 `FlagBitStripSolo`，hover/聚焦/`?` 合同同基线）；metapage 字段与 allequalimage 条件显示；index tuple 详情（t_tid 语义按页类型、itemlen、t_info 位、hikey/posting 徽标、键字节 hex 截断+计数、posting TID 滚动列表计数完整）；解析警示条（部分失败态）。
- 验收映射: P0-4..P0-8（详情）、解析健壮性、P1-2。

### T8 — web：块导航与 heap TID 跳表

- 触碰: `apps/web/src/App.tsx`、`IndexTupleDetail.tsx`
- 完成条件: `btpo_prev/next`（P_NONE 禁用+标注）、子页 t_tid、`btm_root/fastroot` Load 按钮；`jumpToHeap(tableOid, blkno)`（kind 切换 + 表选中 + 加载；目标表不可见时可读反馈）；posting/leaf TID 行可点。
- 验收映射: P1-1、P1-3。

### T9 — 集成冒烟与 CI

- 触碰: `apps/server/src/integration-smoke.ts`、`.github/workflows/ci.yml`（如需种子对象）
- 完成条件: 冒烟新增 B-tree 段：建重复值列索引（产生 posting）→ 取 meta/leaf/internal 页 → `parseBtreePage` 与 pageinspect 逐字段/TID 比对；hash 索引断言 400 `INDEX_NOT_BTREE`；无效索引断言列表 `valid=false`；退出码语义沿既有（blocked=2）。CI integration job 全绿。
- 验收映射: P0-3、P0-8、oracle 合同（实库）。

### T10 — 文档与交接

- 触碰: `README.md`、`README.zh-CN.md`、`packages/page-core/fixtures/README.md`（T2 内）、`workflow/docs/features/index-viewer/dev-notes.md`
- 完成条件: README 双语更新（见文档影响表）；`dev-notes.md` 记录 T2 常量冻结结果、L2/L3 证据、手测清单结论。

## 依赖与顺序

```text
T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10
```

- T2 是 T3 常量冻结前置；T3 是 T6/T7 数据前置；T4 是 T5 前置；T6 是 T7/T8 前置；T9 依赖 T3+T4；T10 收尾。
- T4 可与 T3 并行（不同模块）；其余按序。

## 触碰路径

| 区域 | 路径 |
|---|---|
| page-core | `src/btree.ts`、`btree-structure.ts`、`index.ts`、`types.ts`、`fixture-builder.ts`、`fixtures/btree-*`、`tests/*` |
| server | `src/catalog.ts`、`src/app.ts`、`src/integration-smoke.ts`、`tests/*` |
| web | `src/api.ts`、`App.tsx`、`StructureMap.tsx`、`IndexTupleDetail.tsx`、`diff.ts`、`styles.css`、相关测试 |
| 工具/CI | `scripts/capture-fixtures.ts`、`.github/workflows/ci.yml` |
| 文档 | `README.md`、`README.zh-CN.md`、`workflow/docs/features/index-viewer/dev-notes.md` |

**不触碰:** `spec.md`、工作项记录、`workflow/docs/manager/**`；heap 解析语义（`parsePage`/`decode*`）与 `/api/tables/*` 合同；WAL 模式任何文件。

## 验收

Spec P0-1..P0-12、P1-1..P1-5 逐项见 `spec.md`；UI 证据对照 `ui-design.md` 验收映射。

| 层 | 预期证据 |
|---|---|
| L2 | `pnpm test` 全绿（含 btree synthetic + oracle fixture 对照、server 校验序、web 泛化回归）；`pnpm -r typecheck` / `-r build` 零错误 |
| L3 | `pnpm test:integration` 退出 0：B-tree 段 oracle 逐字段一致；hash 索引 400；无效索引列出；heap 段不回退 |
| 手测 | ui-design 清单：选择→非 B-tree 拦截→metapage/leaf/internal 加载→选中/hex 联动→导航/跳表→Refresh diff→切换清除→light/dark 可读；结论入 `dev-notes.md` |

### 无法执行验证时

| 缺口 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| T2 实捕 fixture | 本地无 PG16/pageinspect | oracle 对照仅剩 CI 实时执行；常量冻结证据弱 | 任一 PG16 环境补捕并提交（CI 产物或用户机）；期间 oracle 测试 skip 须显式标注且**不作为通过证据** |
| T9/L3 | CI 不可用或 .env 缺失 | server 守卫与 oracle 未实锤 | 恢复 CI / 提供 .env 后补跑；记入工作项阻塞字段（Manager） |
| 手测 | 无浏览器联调 | UI 验收点未核验 | `pnpm dev:server` + `pnpm dev:web` 后按清单补测 |

禁止静默跳过；缺口按 quality.md §6 记录（`dev-notes.md` / 工作项记录）。

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | `workflow/docs/features/index-viewer/dev-notes.md`（验证证据、T2 常量冻结记录）；`packages/page-core/fixtures/README.md`（`--index` 捕获步骤与场景表） |
| 用户文档 | `README.md` + `README.zh-CN.md` 双语同步：Features 增索引页浏览（B-tree only、metapage/internal/leaf、posting）；Scope 节「No indexes」移除/改写；Requirements/Troubleshooting 增 `INDEX_NOT_BTREE`；Repo layout 描述不变（page-core 内扩展） |
| 运维文档 | N/A — 本地单人调试工具，无部署/监控/备份变更；PG 前置条件沿用既有 pageinspect 说明 |

## Review 门禁与进入 QA

1. Review 门禁 **required**：Developer 完成 T1–T10 且 L2/L3/手测证据入 `dev-notes.md` 后调度 Reviewer；对照 Spec + Design（§1–§4 决策与常量表）+ ui-design + 本 Plan。
2. 取得 `Approve` 后方可进入 QA；`Request changes` → Developer 修复 → 复审。
3. QA 独立验收：逐项 P0/P1 + L3 复跑 + 手测抽核；结论写 `qa-report.md`（Pass/Fail/Blocked）。QA Pass 前**不**提交 `review.md`/`qa-report.md`（git.md §1.4）。

## 交接顺序

1. **Plan 确认**（本文件）→ 当前用户会话确认 → Manager 持久化 → 状态 `planned`。
2. **Developer**：自 `main` 创建/检出 `index-viewer` → T1..T10；全部实现、修复、文档在源分支提交（Conventional Commits）。
3. **Reviewer** 审阅 → Approve。
4. **QA** 验收 → Pass → 请求用户合并授权。
5. 授权后 Manager 在源分支将状态置 `done` 并与未入库的 `review.md`/`qa-report.md` **一次提交**；随后按 git.md 合入 `main`。

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-08-28 | 初稿：T1–T10（TDD）；L3 最低验证层；oracle 固化前置；git/文档/交接按标准 |

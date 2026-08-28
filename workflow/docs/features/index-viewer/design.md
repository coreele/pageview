# Design: index-viewer

## 背景

在既有 heap Page 模式与 WAL 模式之上，为 Page 模式增加**索引（B-tree）页**可视化：输入侧可选「表或索引」，索引页经既有 `get_raw_page` 代理取回后按 B-tree 结构（metapage / internal / leaf、special space、index tuple、hikey、posting list）解析并复用三联区域展示。路径 `full`；Spec 已确认（2026-08-28，5 项裁决已固化）。

本 Design 只定模块边界、分层、选型与字节布局策略；API 形状、错误码、行为验收以 `spec.md` 为准；布局与状态见 `ui-design.md`。

调研基线（2026-08-28，main）：`page-core` 导出 `parsePage`/`decode*`/`deriveStructureFields` 等，header/ItemId 读取器为模块私有；`wal-core` 为独立数据源（pg_walinspect 结构化行）的独立包先例；server 路由集中于 `app.ts`、catalog SQL 集中于 `catalog.ts`、守卫 `requirePageinspect` 与错误形状 `{code,message,nextStep}` 齐备；web 端 `mode: page|wal`，Page 态持有单一 `ParsedPage` 并驱动 StructureMap/HexDump/diff。

## 方案对比与决策

### 1. 解析层归属（扩展 page-core vs 新建 index-core）

| 方案 | 概要 | 优点 | 缺点 |
|---|---|---|---|
| A | **`packages/page-core` 内新增自包含 B-tree 模块**（`src/btree.ts` + 结构字段派生），heap 语义零改动 | 同一物理页基座（PageHeaderData / ItemIdData / 8KB / free space 计算与 heap 一致），复用私有 header/ItemId 读取器与 fixture-builder 先例；web Page 模式状态保持单包单一 union 类型；32B 网格 / hex 联动 / diff 基建天然共享 | page-core 体量增大，须靠模块自包含 + 导出面清晰隔离 |
| B | 新建 `packages/index-core`，依赖 page-core 或复制基元 | 对称 wal-core 先例 | wal-core 独立是因为**数据源与生命周期**独立（pg_walinspect 结构化行、独立模式）；B-tree 页同源同模式（`get_raw_page`、Page 模式内），先例不适用。跨包须导出或复制 `parseHeader`/`readItemId` 私有实现，破坏 page-core 现有导出面最小化 |
| C | server 端预解析后返回结构化 JSON | web 简单 | 违反 Spec「页类型、level、btpo 字段仅来自本页 raw bytes 解析」；hex 联动 / diff / 字段级选中失去字节基础 |

**决策：A**。判定依据：① 用户裁决「不新增独立第三模式」——B-tree 是 Page 模式内的一种关系种类，而非新数据源；② 字节基座与 heap 完全共享（页头 24B、ItemId 4B、`pd_lower/pd_upper` free space、8192 校验）；③ web 状态以 `page` 单对象驱动三联区域，跨包类型会让 `StructureMap`/diff 泛化复杂化。

导出面约束（模块自包含，防域混杂）：

| 导出 | 说明 |
|---|---|
| `parseBtreePage(raw): ParsedBtreePage` | 分类 meta/internal/leaf（BTP_META 判定见 §4）+ special space + index tuples + warnings |
| `decodeBtpoFlags(value): FlagBit[]` | btpo_flags 位格（同 `decodePdFlags` 形状，供位格条复用） |
| `deriveBtreeStructureFields(page): StructureField[]` | 与 heap `deriveStructureFields` 同型；`StructureFieldRegion` 扩枚举 `special \| meta` |
| 常量 | `BTREE_MAGIC`、opaque/meta/tuple 布局偏移、BTP_* 位值（§4） |
| fixture builder | `buildBtreePage(...)`（synthetic，L2 无库可测） |

**禁止**：修改 `parsePage`/`decodePageTuples`/`decode*` 等 heap 语义与既有导出；btree 模块不 import heap 解码（仅可 import 通用基元如 `PageParseError`、flags 常量、`parseHeader` 提出的共享 reader）。

### 2. server 端点实现方式

沿用 tables 路由先例，不引入新层：

| 事项 | 决策 |
|---|---|
| SQL | `catalog.ts` 新增 `LIST_INDEXES_SQL`（pg_class relkind='i' JOIN pg_am + pg_index→pg_class 表 + namespace，排除系统/temp schema 同表列表口径；`pg_relation_size/8192` 为 blocks；ORDER BY schema,name）与 `INDEX_RELATION_SQL`（单查询取 relkind、amname、nspname、relname、blocks，供校验序复用） |
| 路由 | `app.ts` 内注册 `GET /api/indexes`、`GET /api/indexes/:oid/pages/:blkno`，风格同 `/api/tables/:oid/pages/:blkno` |
| 守卫 | 复用 `notConnectedReply`（NOT_CONNECTED）+ `requirePageinspect`（PAGEINSPECT_MISSING）+ `mapPgError`；**不新增守卫机制** |
| 校验顺序（Spec 合同） | ① relkind='i' 否则 404 `NOT_INDEX` → ② amname='btree' 否则 400 `INDEX_NOT_BTREE`（message 含检测到的访问方法）→ ③ blkno 整数 ≥0 否则 `BAD_BLKNO` → ④ < blocks 否则 `BLKNO_OUT_OF_RANGE` → `get_raw_page(qualifiedName, blkno)`，响应形状同表页端点 |
| 错误形状 | 一律 `appError` → `{code,message,nextStep}` |

不做 server 端 B-tree 预判（不调 `bt_page_items` 等）；server 仅透传 raw page（Spec 合同）。

### 3. web 端状态建模与组件改动边界

```text
App（Page 模式内）
├─ relationKind: "table" | "index"           # 新增；默认 "table"，现状路径不变
├─ tables/selectedOid（既有） ∥ indexes/selectedIndexOid   # 新增索引列表态
├─ pageView: { kind:"heap", page:ParsedPage } | { kind:"btree", page:ParsedBtreePage, index:IndexRow }
├─ loadBlk（既有，表） ∥ loadIndexBlk（新：仅 fetchIndexPage，无 /schema 调用）
└─ 清除语义：切换 relationKind、切换关系、跳转 → 统一 resetPageView()（page/selectedId/highlight/prevRaw/diffIds/hexLocate），P0-12
```

| 组件 | 改动边界 |
|---|---|
| `StructureMap` | **泛化为 StructureField[] 消费者**：props 由 `page: ParsedPage` 改为 `{ raw, freeRange, fields, … }`；legend 增 special/meta 色签；ItemId/网格/选中/hex 联动逻辑不变。heap 与 btree 各自的 detail 面板由调用方按 `pageView.kind` 分支注入 |
| `IndexTupleDetail`（新组件） | itemoffset、t_tid（internal=子页指针 / leaf=heap TID）、itemlen、t_info 位、hikey/posting 标记、键字节 hex、posting TID 列表、块导航/跳表按钮 |
| `HexDump` | **零改动**（消费 `raw`+`freeRange`；btree free=[pd_lower,pd_upper) 同 heap，special space 属元组后数据区不被折叠） |
| `diff.ts` | `findStructureAt`/`structureAffectedByDiff` 签名改为接受 `StructureField[]`（纯泛化重构，既有 web 测试随签名更新）；`diffByteRanges` 不变 → 索引页 Refresh diff 天然生效 |
| `InfomaskBitStrip` | `FlagBitStripSolo` 直接复用于 btpo_flags / t_info |
| `api.ts` | 新增 `IndexRow` 类型 + `listIndexes()` + `fetchIndexPage(oid, blkno)`（既有 `parseError` 复用） |

P1-3 heap TID 跳转：新增 App 级 `jumpToHeap(tableOid, blkno)`（kind→table、选中表、blkno、loadBlk），与既有 ctid `onLoadCrossBlock`（同关系跨块）并列；两者共用「点击→加载块」交互形态。目标表不在表列表（系统 schema/已删除）时给出可读反馈，不静默失败。

### 4. B-tree 字节布局：模块划分与固化策略

**模块划分**（均在 page-core 内）：

```text
src/btree.ts                 # 布局常量、BTP_* 位定义、decodeBtpoFlags、parseBtreePage、ParsedBtreePage 类型
src/btree-structure.ts       # deriveBtreeStructureFields（或并入 structure-fields.ts，实施择一，勿两处分摊）
src/fixture-builder.ts       # 增 buildBtreePage（synthetic：meta/internal/leaf/posting/异常页）
tests/btree.test.ts          # synthetic 布局与分类测试
tests/btree-oracle.test.ts   # 提交的实捕 fixture × pageinspect oracle JSON 对照
```

**布局常量（预期值；以实捕 fixture × pageinspect oracle 固化为准，见风险 R1）**：

| 结构 | 偏移（页内 / 结构内） | 说明 |
|---|---|---|
| special space | `[8192−16, 8192)`（pd_special=8176） | `btpo_prev` u32 +0 · `btpo_next` u32 +4 · `btpo_level` u32 +8 · `btpo_flags` u16 +12 · `btpo_cycleid` u16 +14 |
| metapage 内容 | `PageGetContents` = 页内 24 起 | `btm_magic` u32 @24（0x053162）· `btm_version` u32 @28 · `btm_root` u32 @32 · `btm_level` u32 @36 · `btm_fastroot` u32 @40 · `btm_fastlevel` u32 @44；v4 另有 `btm_allequalimage` @60（其后为 cleanup 统计字段，Spec 不要求展示） |
| IndexTupleData | 每 tuple 起点 | `t_tid` 6B（bi_hi/bi_lo/posid 各 u16）+0 · `t_info` u16 +6：size=低 13 位（0x1FFF）、0x2000=INDEX_ALT_TID_MASK（leaf 上=posting，否则 NULL bitmap）、0x4000=INDEX_VAR_MASK；tuple 总长用 ItemId lp_len |
| BTP_* 位 | BTP_LEAF/ROOT/DELETED/HALF_DEAD/HAS_GARBAGE/INCOMPLETE_SPLIT | 派生 isRoot、isRightmost（btpo_next=P_NONE=0）、deleted、halfDead、hasGarbage、incompleteSplit |
| 页分类 | blkno 0 且 btm_magic 匹配 → meta；btpo_level>0 → internal；BTP_LEAF → leaf | 偏移不符/越界不崩溃，降级为 warnings（Spec 解析健壮性） |
| hikey 判定 | 非最右页（btpo_next≠0）首个 LP_NORMAL tuple 为 hikey | Spec 合同 |
| posting list | leaf LP_NORMAL 且 t_info&0x2000：TID 数与逆序 TID 列表按 nbtree.h 宏语义（`BTreeTupleGetNPosting`/`PostingItemPointer`）解析 | oracle=`bt_page_items` 的 tids |

**fixture 策略**（沿 page-core 先例）：

1. **synthetic**：`buildBtreePage` 生成 meta/internal/leaf/posting/异常（magic 不符、越界）页，提交仓库 → L2 无库全绿；
2. **实捕**：扩展 `scripts/capture-fixtures.ts` 支持 `--index`（页 bytes + `bt_metap`/`bt_page_stats`/`bt_page_items` 输出 JSON 一并落盘为 oracle）；捕获场景：metapage、internal、leaf、含 posting 叶页（重复键 int 列）；
3. **CI oracle**：`apps/server/src/integration-smoke.ts` 增 B-tree 段——建表+重复值列建索引（PG13+ 自动 dedup 产生 posting）→ 取页 → `parseBtreePage` 与 pageinspect 输出逐字段比对；另建 hash 索引验证 400 `INDEX_NOT_BTREE`、置无效索引验证列表标记。CI integration job（postgres:16 + 超级用户）已具备全部前置；
4. v3 metapage：现役 PG16 多为 v4，v3 路径以 synthetic fixture + 单元断言覆盖（allequalimage 不显示），oracle 仅覆盖 v4——记录为已知验证缺口。

### 5. 数据流

```text
Page 模式
 ├─ kind=table ──▶ /api/tables → schema+page → parsePage（既有，零改动）→ StructureMap(heap)
 └─ kind=index ──▶ /api/indexes（列表：am/标记）
        └─ Load（B-tree 才可发）──▶ /api/indexes/:oid/pages/:blkno → base64 → parseBtreePage
                → deriveBtreeStructureFields → StructureMap(btree) + IndexTupleDetail
                → hex 双向联动 / Refresh diff / 块导航 / P1-3 跳表（jumpToHeap）
```

## 模块影响

| 模块 | 变更 |
|---|---|
| `packages/page-core` | 新增 btree 解析 + 结构字段 + fixture builder + 测试（heap 语义与既有导出不动；`StructureFieldRegion` 扩枚举属兼容扩展） |
| `apps/server` | `catalog.ts` 增 2 个 SQL；`app.ts` 增 2 路由；`integration-smoke.ts` 增 B-tree 段；新增路由单测 |
| `apps/web` | `api.ts` 增类型/调用；`App.tsx` 增 relationKind/索引选择/`pageView` union/jumpToHeap；`StructureMap` 泛化；新增 `IndexTupleDetail`；`diff.ts` 签名泛化；styles 增 special/meta region token |
| `scripts/capture-fixtures.ts` | `--index` 模式 + oracle JSON |
| `README.md` / `README.zh-CN.md` | 双语同步（见 Plan 文档影响） |

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| R1 布局常量与真实 nbtree 不符（opaque 尺寸、flags/xact 偏移、BTP_* 位值在不同 PG 版本有差异） | 解析值错误 → P0-4..8 失败 | 实施顺序固化：先实捕 fixture + oracle 测试（T2）再冻结常量；oracle 与 nbtree.h 双源核对，偏差记 dev-notes 并以 oracle 为准 |
| R2 posting/hikey 语义误读（t_info 位复用、逆序 TID 列表） | P0-7/P0-8 失败 | 按 nbtree.h 宏语义实现；CI 重复值索引 oracle 逐 TID 比对 |
| R3 StructureMap/diff 泛化触碰 heap 路径 | P0-10 回退 | 泛化为纯签名扩展；既有 page-core/web 测试全量回归为完成前置 |
| R4 本地无 PG16 实捕环境 | T2 fixture 缺失，L2 仅 synthetic | 提交前可用 CI 或任一 PG16 环境补捕；oracle 测试支持「fixture 缺失→skip+提示」不算通过证据 |
| R5 索引/表列表与元信息条 UI 密度上升 | 可用性回归 | ui-design.md 锁控件层级；QA 手测覆盖 |
| R6 越权/系统对象暴露 | 安全面扩大 | SQL 排除系统 schema 口径与表列表一致；不新增写操作；Security 标准复核 |

## 对 Plan 与 Developer 的要点

### Plan

- 任务按「布局固化（fixture+oracle）→ 解析 → server → web 状态 → 结构图 → 详情/导航 → 跳表 → 冒烟/CI → 文档」排序，TDD 先红后绿。
- 最低验证层 L3（parser 正确性依赖 pageinspect oracle 实库对照）+ 定向浏览器手测。
- 实施分支：源分支 `index-viewer`（自 `main` 创建），禁止在 main 直接实施。

### Developer

- heap 路径零语义改动是硬约束：任何 `parsePage`/`decode*`/`/api/tables/*` 行为变化即偏离。
- btree 常量集中单处（`btree.ts` 顶部），禁止散落 magic number；偏移与位值以 oracle 测试为冻结依据。
- 解析健壮性：异常页输出 warnings 并继续可解析部分；整页不可解析抛 `PageParseError` → client 映射 `UNSUPPORTED_PAGE`（既有路径）。
- 验证证据（命令、oracle 对照、手测清单）写入 `dev-notes.md`。

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-08-28 | 初稿：page-core 扩展（方案 A）；路由复用 tables 先例；web pageView union + StructureMap 泛化；布局 oracle 固化策略 |

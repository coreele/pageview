# Design: index-key-decode

## 背景

在 index-viewer 交付的 B-tree 页解析（`parseBtreePage`：t_info nulls/vars 位、hikey/pivot/posting 分类、键字节 `keyRange`）与详情面板键字节 hex 之上，增加**类型感知键值解码**：server 新增 `GET /api/indexes/:oid/columns`（`pg_attribute`(索引) + `pg_index` 元数据），解码层按列元数据将键区字节解码为可读值；不支持场景优雅降级为仅 hex。Spec 已确认（2026-08-31，3 项裁决固化），并修订 index-viewer「加载索引页不请求 schema」合同为「附带请求索引列元数据」。

本 Design 只定模块边界、分层与选型；API 形状、降级合同、验收以 `spec.md` 为准；布局与状态见 `ui-design.md`。

调研基线（2026-08-31，main）：heap 路径先例 `packages/page-core/src/decode.ts`（`decodeTupleColumns(page, tuple, columns)` 纯函数，web 薄层调用）；`parseBtreePage` 无参数、warning 降级语义；server `catalog.ts`（SQL 集中）+ `app.ts`（守卫链 NOT_CONNECTED→BAD_OID→NOT_INDEX→INDEX_NOT_BTREE，`/api/tables/:oid/schema` 先例）；web `loadIndexBlk`（仅取 raw page）、`IndexTupleDetail`（Key bytes hex 块）、纯逻辑模块 `indexDetail.ts` 先例；`scripts/capture-fixtures.ts --index` 已输出 `bt_page_items` oracle；CI integration job（postgres:16 + pageinspect）已执行 `integration-smoke.ts` B-tree 段。

## 方案对比与决策

### 1. 解码层归属（核心决策）

| 方案 | 概要 | 优点 | 缺点 |
|---|---|---|---|
| A | **page-core 新增独立模块 `src/btree-decode.ts`：`decodeIndexTupleKeys(raw, tuple, columns)` 纯函数**；`parseBtreePage` 签名与语义零改动 | 与 heap 先例完全对称（`decode.ts` 之于 `parsePage` 两段式）；键区物理布局知识（null bitmap / varlena 头 / pivot 尾 TID）与 `btree.ts` 冻结常量同包同测；L3 冒烟可直接复用（`integration-smoke.ts` 已 import page-core 做实库对照）；不调用即无行为（无元数据时零成本、零风险） | page-core 增一个接受「列元数据」输入的模块；须约束其输入/输出为纯数据结构，不得 import server/web 类型 |
| B | web 层后处理（`apps/web/src/indexKeyDecode.ts`） | 不动 page-core | 物理步进逻辑离开其常量与 oracle 测试基建（`tests/btree-oracle.test.ts` 无法扩展为解码对照）；L3 冒烟无法复用（server 侧 SQL 对照需复制实现）；web 逻辑膨胀 |
| C | `parseBtreePage(raw, { columns })` 可选参数，解析内联解码 | 一次调用出全量结果 | 物理解析耦合 schema：破坏 index-viewer「页类型/字段仅来自本页 raw bytes」合同；页级 warnings 与列级降级语义混杂；既有调用方与 oracle 测试面临签名漂移，威胁 P0-13 回归 |

**决策：A**。理由：① 对称先例（heap 即 parse→decode 两段、web 薄层）；② 解码属物理层知识，与 `btree.ts` 常量（`INDEX_NULL_MASK`、`BT_OFFSET_MASK`、`BT_PIVOT_HEAP_TID_ATTR`）同处最易冻结与回归；③ parse 合同零改动是「既有行为不回退」的最低风险路径；④ L3 实库 SQL 对照需要 server 进程内调用同一解码函数。

类型约束：输入 `IndexColumnMeta`、输出 `DecodedKeyColumn[]`（形状 = Spec「数据/状态」节解码输出模型的子集：`{ attnum, name, typname, status: "value"|"null"|"unsupported"|"error", display?, reason?, range? }`）定义于 page-core；web 从 API 响应映射构造，page-core 不感知 HTTP/错误码。

### 2. 类型→解码器映射组织

- **按 typoid 匹配**（Spec 合同）：纯函数表 `KEY_DECODERS: Record<number, KeyDecoder>`，typoid → `{ read(bytes, offset, keyEnd): { display, next } }`。策略映射集中单处，禁止散落 switch。
- P0 冻结集（PG catalog 常量）：bool 16、int8 20、int2 21、int4 23、text 25、bpchar 1042、varchar 1043、date 1082、timestamp 1114、timestamptz 1184、uuid 2950。P1：numeric 1700、float4 700、float8 701、bytea 17、domain（server 侧解析基类型，§4）。
- 未命中表 → 该列 `unsupported`（reason 含 typname）；该列字节宽度不可知 → **该列及之后全部降级并标注**（Spec 范围 5）。不做 typname 启发式回退——opclass（如 `text_pattern_ops`）不改变存储字节，typoid 已足够（Spec 已裁决）。
- `display` 为全量字符串（不截断——截断属显示层，Spec 约定）；typmod 不参与 P0 解码（varchar(n)/bpchar(n) 字节自描述）。
- 时间类：int64 微秒 + **BigInt 手工 civil 换算**（毫秒以下的微秒尾数独立拼接），date/timestamp/timestamptz 的 `±infinity` 哨兵原样输出；timestamptz 固定 `Z` 后缀（Spec 裁决）。**禁止**复用 heap `decode.ts` 的 `Date.toISOString()`（毫秒精度，不满足 P0-4 微秒合同）；新实现独立编写，heap 路径零改动。

### 3. 键区步进与对齐算法（归属 page-core `btree-decode.ts`）

依 PG 16 `index_form_tuple`（indextuple.c）+ nbtree pivot 语义冻结；实施首个任务以 PG 源码 + 实捕 oracle 双源核对，偏差记 `dev-notes.md`：

| 规则 | 内容 |
|---|---|
| 数据起点 | tuple 起点 + 8B `IndexTupleData` +（hasNulls 时）null bitmap `⌈indnatts/8⌉` B（紧随 t_info，无额外对齐；indnatts 取列元数据长度） |
| NULL | t_info & `INDEX_NULL_MASK` 判 bitmap 存在；第 `attnum−1` 位为 1 → 该列 `null`，**0 字节步进** |
| 定长 by-value | bool 1B · int2 2B · int4/float4/date 4B · int8/timestamp/timestamptz/float8 8B · uuid 16B（逐字节）。**原生字节序（x86_64/aarch64 即小端）**——PG 按 Datum `memcpy` 存储；本仓 oracle fixture（int8 值 367 = `6f 01 00 00 00 00 00 00`）与 heap `decode.ts`（小端，oracle 冻结）双重佐证（注：任务简报「大端」说法有误，以 oracle 为准） |
| 变长 by-ref | text/varchar/bpchar（P1 另加 bytea/numeric）：1B 头（`b&1=1`：len=`b>>1`，内容 len−1）或 4B 头（低 2 位 `00`：len=`w>>2`，内容 len−4）；4B 头含压缩/external 标志 → 该列 `error`（索引键经 detoast 后不应出现；防御降级） |
| 列间步进 | **无逐列对齐**（与 heap `decode.ts` 的 `attalign` 规则根本不同，禁止复用 `alignOffset`）；总 itemlen 为 MAXALIGN，末列后剩余 ≤7B pad 静默容忍 |
| pivot | 尾部 6B `ItemPointerData`（heap TID tiebreaker）不属键属性：keyEnd = tuple end − 6；存在性依 nbtree 语义（v4 下 nkeyatts≥1 的 pivot 恒有尾 TID；minus-infinity——`(ip_posid & BT_OFFSET_MASK)==1`——无键属性亦无尾 TID，T2 冻结）。nkeyatts 从 `ip_posid & BT_OFFSET_MASK − 1` 解出（常量已在 `btree.ts`） |
| 截断尾列 | pivot `nkeyatts < indnatts` → `attnum > nkeyatts` 的列统一 `null`（Spec 裁决：与真实 NULL 不区分；INCLUDE 列在 pivot/hikey 同此规则） |
| posting | `keyRange` 已由 parse 排除 TID 列表（end = start + postingOffset），直接沿用 |
| 越界 | `offset + need > keyEnd` → 该列 `error`（decode error: 原因），其后列边界不可知 → 全部降级标注 |

### 4. server 端点（`catalog.ts` + `app.ts`，沿既有风格，不引入新层）

- SQL：`INDEX_META_SQL`（pg_index → indnatts/indnkeyatts/indkey/indoption）+ `INDEX_COLUMNS_SQL`（pg_attribute(索引 oid) JOIN pg_type，`attnum > 0 AND attnum <= indnatts`，ORDER BY attnum）；守卫复用 `INDEX_RELATION_SQL`（relkind/am/名称，同 pages 路由）。
- indkey/indoption 以 `::text` 取回（如 `"1 2"`/`"1"`），TS 解析：`hasExpression` = indkey 含 0；`kind` = attnum ≤ indnkeyatts ? `key` : `include`；indoption 仅 key 列有值（长度 = indnkeyatts），`descending` = 位 0，`nullsFirst` = 位 1，include 列恒 false。不做 attisdropped 过滤（Spec 裁决：索引无 dropped 占位）。
- 路由 `GET /api/indexes/:oid/columns` 守卫链镜像 pages 端点：NOT_CONNECTED 401 → `requirePageinspect`（PAGEINSPECT_MISSING 400）→ BAD_OID 400 → NOT_INDEX 404 → INDEX_NOT_BTREE 400 → `mapPgError`；响应形状按 Spec 合同冻结。不做 server 端解码（仅元数据透传）。
- P1 domain：SQL 按 `typtype='d'` 以 `typbasetype` 的 typoid/typname 替换（响应形状不变，纯 SQL 变更）。

### 5. web 状态与数据流

```text
loadIndexBlk(oid, blk)
 ├─ fetchIndexPage（既有，不变）
 ├─ ensureIndexColumns(oid)（新）：缓存 miss 时 void fetchIndexColumns(oid)
 │    —— 不 await、不 setError、不阻塞页面渲染（P0-12/P0-13 合同）
 └─ parseBtreePage → pageView（不变）
详情面板（选中 tuple 且非 metapage）
 ├─ columns ok 且 !hasExpression → decodeIndexTupleKeys(page.raw, tuple, meta) → 键值行渲染
 ├─ columns 加载中 → muted loading 行（仅键值区）
 ├─ columns 失败 → 降级标注（含错误 code）
 └─ hasExpression → 索引级降级标注，无行
```

- 缓存：`indexColumns: Map<oid, {status:"ok",data} | {status:"failed",error:{code,message}}>`；成功缓存后同 oid 块导航/Refresh 不再请求；失败不缓存（下次 Load 自动重试）；连接重建与 `refreshIndexes` 成功时清空（防换库/DDL 陈旧）。
- 呈现逻辑（行模型/截断/徽标/降级文案派生）进纯模块 `apps/web/src/indexKeyDetail.ts`（沿 `indexDetail.ts` 先例，可单测）；`IndexTupleDetail` 增 `keyColumns` prop（App 经 `renderDetail` 注入），键值区置于既有 Key bytes hex 块**之上**，hex 块及其点击高亮零改动。
- `api.ts`：`IndexColumnsResponse` 类型 + `fetchIndexColumns(oid)`（复用 `parseError`）。

### 6. oracle / fixture 策略

1. **synthetic（L2）**：`fixture-builder.ts` 扩展——`BuiltBtreeTuple` 增 null bitmap（按 indnatts 写 `⌈n/8⌉` B）、pivot nkeyatts（ip_posid 编码）+ 尾部 heap TID、多列 typed payload 按规则组装；覆盖 P0 全类型、9 列双字节 bitmap、4B varlena 头、越界/截断错误路径。
2. **实捕 fixture（L2 提交产物）**：`capture-fixtures.ts --index` 增捕 ① `indexColumns`（与端点同 SQL 结果集）② owning table 行值（`SET TimeZone='UTC'` 会话按 ctid 取 `::text`）写入 oracle.json；捕获场景：`(a int, b text) INCLUDE (c int)` 复合、含 DESC 列、bool/date/timestamp/timestamptz/uuid 单列、nullable 列含 NULL、>64 字符与多字节 text、表达式索引 `lower(name)`、`(a int, j jsonb)`。既有 `btree-internal` fixture 复用为 pivot/hikey 对照。
3. **CI L3**（`integration-smoke.ts` 增段）：种子同上（独立 schema、幂等、退出清理）；经 `app.inject` 断言 `/api/indexes/:oid/columns` 形状与守卫（表 oid→NOT_INDEX、hash→INDEX_NOT_BTREE、非数字→BAD_OID）；取 leaf/internal 页 → `decodeIndexTupleKeys` → 与 ctid 行 SQL 值对照（时间类 UTC `::text` 后按 Spec 呈现格式归一化再比对）；`bt_page_items.data` hex 与 `keyRange` 字节对照（辅助）。CI integration job 已具备全部前置，无新基建。

## 模块影响

| 模块 | 变更 |
|---|---|
| `packages/page-core` | 新增 `src/btree-decode.ts` + 类型 + `index.ts` 导出；`fixture-builder.ts` 扩展（bitmap/pivot/typed payload）；`tests/btree-decode.test.ts`（synthetic）+ `tests/btree-oracle.test.ts` 扩展（解码对照）；heap 语义与既有导出不动 |
| `apps/server` | `catalog.ts` 增 2 个 SQL；`app.ts` 增 1 路由；`tests/` 增端点用例；`integration-smoke.ts` 增 B-tree 解码段 |
| `apps/web` | `api.ts` 增类型/调用；`App.tsx` 增 `indexColumns` 缓存 + `ensureIndexColumns`；新增 `indexKeyDetail.ts`；`IndexTupleDetail.tsx` 增键值区；`styles.css` 增样式 |
| `scripts/capture-fixtures.ts` | `--index` 增捕 indexColumns + table 行值 oracle |
| `README.md` / `README.zh-CN.md` | 双语 Features 索引节各补一句（见 Plan 文档影响） |

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| R1 步进规则误读（bitmap 长度 / 无逐列对齐 / pivot 尾 TID / minus-infinity） | 多列值错位 → P0-2..P0-9 失败 | T2 首任务实捕 + PG 源码双源冻结再写解码；oracle 逐值对照；偏差记 dev-notes |
| R2 varlena 4B 头 / 压缩-external 标志 | 步进越界或误读 | 防御性列级 `error` 降级；oracle 种子含 >127B text（触发 4B 头）与 >64 字符截断显示 |
| R3 时间微秒精度与 ±infinity 哨兵 | P0-4 失败（`Date` 毫秒精度不足） | BigInt 手工换算；oracle 用微秒尾数互异值 + infinity 行专测 |
| R4 indnatts>8（多字节 bitmap） | NULL 判定错位 | synthetic 9 列用例（机械规则，oracle 可选） |
| R5 bpchar 填充 / text 内嵌引号 | SQL 对照不一致 / 展示歧义 | oracle 种子含 char(n)（尾随空格原样）；内嵌单引号不转义（展示用途非 SQL 字面量，记局限） |
| R6 元数据请求干扰页面加载 | P0-12/P0-13 回退 | 不 await / 不 setError / 不入 loadState；纯函数单测 + 断连手测 |
| R7 表达式 / INCLUDE / pivot 截断混排 | 降级路径错 | 代码路径单一（nkeyatts 比较 + indkey 含 0）；oracle 复合 + 表达式场景覆盖 |

## 对 Plan 与 Developer 的要点

### Plan

- 任务序：fixture/规则冻结 → page-core 解码 → server 端点 → web 状态 → 键值区 → P1 → 集成冒烟 → 文档；TDD 先红后绿。
- 最低验证层 **L3**（解码正确性的权威判据是 pageinspect + SQL 实库对照，Spec oracle 合同）；L2（synthetic + 实捕 fixture）全绿为基线；UI 呈现按 ui-design 手测。
- 实施分支：源分支 `index-key-decode`（自 `main` 创建），禁止在 main 直接实施。

### Developer

- `parseBtreePage`、heap `decode.ts`、`/api/tables/*`、hex 块行为零改动是硬约束；任何此类行为变化即偏离（P0-13）。
- 步进规则常量集中 `btree-decode.ts`；typoid 表集中单处；禁止复用 heap `alignOffset`。
- 时间解码禁用 `Date` 毫秒路径；BigInt 实现独立于 heap `decode.ts`。
- 降级一律局部（列/索引级），绝不弹全局错误或阻塞页面渲染。
- 验证证据（命令、oracle 对照、手测清单）写入 `dev-notes.md`。

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-08-31 | 初稿：解码层归属 page-core 独立模块（方案 A）；typoid 策略映射；步进规则（无逐列对齐、小端、pivot 尾 TID）冻结待 oracle；两查询 + 守卫镜像的端点；web 缓存解耦；synthetic/实捕/CI 三层 oracle |

## 修订记录（2026-08-31，T2 oracle 冻结后由 Manager 补记）

§3 步进规则经 PG16.11 实捕 oracle 校正 6 处（实现以 dev-notes「规则冻结表」为准，Review/QA 勿以 §3 原文判定）：
1. null bitmap 为**固定 4B**（INDEX_MAX_KEYS=32），数据起点 = MAXALIGN(12) = **16**（非 ⌈indnatts/8⌉）
2. bitmap **位反转**：置 1=有值、清 0=NULL
3. **定长列按 attalign 对齐，varlena 不对齐**（原「无逐列对齐」不成立）
4. nkeyatts = posid 直读（无 −1）；minus-infinity 判定为 posid == 0
5. 尾部 heap TID **不恒有**：由 t_info 的 BT_PIVOT_HEAP_TID_ATTR 位指示
6. 小端/时间编码/DESC 原样存储与原文一致

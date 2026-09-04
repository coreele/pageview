# Dev Notes: index-key-decode

实施记录（Developer）。规则以 oracle 实测为准；与 design §3 的偏差逐条列出。

## T2 — 实捕 fixture 与步进规则冻结（2026-08-31）

环境：本地 PostgreSQL 16.11（x86_64 Linux，MAXALIGN=8，socket /tmp）+ pageinspect。
脚本：`scripts/capture-fixtures.ts --index` 扩展（`indexColumns` + `tableRows` oracle）；
产物：`packages/page-core/fixtures/idx-*`（15 个场景，含 `idx-align`、`idx-posting-internal` 两个规则探针场景）。

### 冻结规则表（实测 vs design §3）

| # | 规则 | 实测结论（权威） | design §3 原文 | 偏差 |
|---|---|---|---|---|
| 1 | null bitmap 长度 | **固定分配 `sizeof(IndexAttributeBitMapData)`=4B**（INDEX_MAX_KEYS=32；itup.h 明注「不随属性数变化」）；bitmap 在 [8..12)，[12..16) 为 pad | `⌈indnatts/8⌉ B 紧随 t_info 无额外对齐` | **偏差**：实测数据起点恒为 MAXALIGN(8+4)=16（idx-null2：a=2,b=NULL 元组 len=24=MAXALIGN(16+4)；双 NULL len=16=MAXALIGN(16+0)） |
| 2 | null bitmap 位语义 | **bit 置 1 = 有值；bit 清 0 = NULL**（与 heap 相反；idx-null2 双 NULL → bitmap 全 0；a NULL → 仅 bit1 置位） | `第 attnum−1 位为 1 → 该列 null`（heap 语义） | **偏差**：位语义取反 |
| 3 | 逐列对齐 | **定长 by-value 列按 attalign 对齐；varlena 列不对齐（packed）**（idx-align/探针：text 'ab' 后 int4 从 7→8 对齐；int2 后 text 直接在偏移 2 存放；bool 后 int8 从 6→8 对齐） | `无逐列对齐（禁止复用 alignOffset）` | **偏差**：定长列需对齐。仅 varlena 之间/之后无对齐；解码器自带 attalign 常量表（不 import heap decode.ts，但语义同 heap 的 nominal 对齐） |
| 4 | 小端 | 定长值小端（int8 367 = `6f 01 00 00 00 00 00 00`，date/timestamp/timestamptz/uuid 同） | 小端 | 一致 |
| 5 | pivot nkeyatts 编码 | `nkeyatts = ip_posid & BT_OFFSET_MASK`（**直读，无 −1**；nbtree.h `BTreeTupleGetNAtts`） | `从 ip_posid & BT_OFFSET_MASK − 1 解出` | **偏差**：无 −1（唯一索引 pivot posid=1 且带 1 个键属性，反证 +1 编码不成立） |
| 6 | 尾 TID 存在性 | 由 `ip_posid & BT_PIVOT_HEAP_TID_ATTR(0x1000)` 指示；存在时 6B 紧随键属性（packed，之后 MAXALIGN pad）。出现条件：非唯一索引且边界键前缀不足以区分（t_comp 全部无 TID；t_dup 全部有 TID）。唯一索引全键 pivot 无 TID | `v4 下 nkeyatts≥1 的 pivot 恒有尾 TID` | **偏差**：不恒有；以标志位为准（BTreeTupleSetNAtts 断言 `!heaptid || nkeyatts>0`） |
| 7 | minus-infinity | `ip_posid & BT_OFFSET_MASK == 0`，itemlen=8：无键属性亦无尾 TID → 全列按截断呈现 NULL | `(ip_posid & BT_OFFSET_MASK)==1` | **偏差**：实为 0（idx-composite-internal/既有 btree-internal lp0 双证） |
| 8 | 截断尾列 | pivot `nkeyatts < indnatts` → `attnum > nkeyatts` 列统一 NULL（idx-composite hikey nkeyatts=1：b、c 截断） | 同 | 一致 |
| 9 | varlena 步进 | 1B 头（`b&1=1`，总长 `b>>1`）或 4B 头（低 2 位 `00`，总长 `w>>2`）；总长 >127B 必为 4B 头（200×'C'=304B、100×'多'=304B 实证）；压缩/external 标志（首字节低 2 位 `10`）→ 该列 error | 同 | 一致 |
| 10 | 时间编码 | date=int32 天（2000-01-01 起；±infinity=±INT32 极值）；timestamp/timestamptz=int64 µs（±infinity=±INT64 极值）；timestamptz 存 UTC 瞬时 | 同 | 一致 |
| 11 | DESC 列 | 字节原样存储（int4 值直接出现，仅 indoption 标注），解码规则不变 | 同 | 一致 |
| 12 | INCLUDE | leaf 元组含 include 列（idx-composite item2：a,b,c 三列 packed+align）；pivot/hikey 截断 → NULL | 同 | 一致 |
| 13 | 表达式索引 | indkey=[0]；索引 pg_attribute 仍有 attnum=1 行（attname='lower'，typname=text） | 同 | 一致（整体降级由元数据 hasExpression 驱动） |
| 14 | unsupported 列 | 无步进策略 → 该列 `unsupported` 且其后全部降级（idx-jsonb：a 正常、j 之后无列） | 同 | 一致 |

### 结论

design §3 的「无逐列对齐」「⌈indnatts/8⌉ bitmap」「位=1 为 NULL」「nkeyatts−1」「minus-inf==1」「pivot 恒有尾 TID」六处在实测下不成立/不完整，**实现以本表为准**（用户已授权：oracle 与文档冲突时以 oracle 为准实现并汇报）。权威依据：本地 PG16.11 server 头文件
`/home/jason/app/pgdebug/include/postgresql/server/access/{itup.h,nbtree.h}` + 上述实捕字节。

### T2 验证证据

- 捕获命令（每场景一次，`--blkno` 见 fixtures README 表）全部 `statsError=null, itemsError=null`；
- `indexColumns`/`tableRows` oracle 抽检：idx-composite 行值与种子 SQL 一致（如 (2,'b037',1)）、idx-posting-internal pivot 边界行 k=1/3 与 pivot 键一致；
- 捕获脚本为手工开发工具（仓库先例：无自动化测试），其行为验证 = 产物检视（上表）；T3 以 oracle 测试消费这些产物形成回归保护。

## T3 — page-core decodeIndexTupleKeys（2026-08-31）

- 新增 `src/btree-decode.ts`：`decodeIndexTupleKeys(page, tuple, columns)` 纯函数 + typoid 策略表（KEY_COLUMN_SPECS，单点集中）；BigInt 手工 civil 换算（未用 Date/毫秒路径，heap decode.ts 未复用未改动）；`fixture-builder.ts` 扩展 `presentAttnums`（反转 bitmap）/`pivotNKeyAtts`/`pivotHeapTid`；`index.ts` 导出。
- 测试（TDD 先红 36 失败后绿）：`tests/btree-decode.test.ts` 30 例（P0 全类型、多列混排步进+对齐+range、NULL bitmap 1B/9 列双字节、pivot 尾 TID 排除、nkeyatts 截断、minus-infinity、posting、4B varlena、压缩/external 防御、越界/截断降级、unsupported 级联、尾 pad 容忍）；`tests/btree-oracle.test.ts` 增 16 场景解码对照（每元组 vs UTC 会话 ctid 行 ::text，含 hikey=右页首键断言、internal pivot 截断/递增、尾 TID pivot==边界行、jsonb 降级、表达式元数据标记）。
- 修正记录（测试红阶段暴露的测试自身错误，非实现缺陷）：date 8932=2024-06-15（非 8944）、timestamp µs 常量 770529923456123、bool ::text 输出即 'true'/'false'、hikey=右页边界键（非本页最大值）。
- `parseBtreePage`/heap `decode.ts` 零改动；既有 btree.test.ts 45 例零改动零回退。

## T4 — server columns 端点（2026-08-31）

- `catalog.ts` 增 `INDEX_META_SQL`（indnatts/indnkeyatts/indkey/indoption::text）+ `INDEX_COLUMNS_SQL`（pg_attribute(索引) JOIN pg_type，attnum≤indnatts，ORDER BY attnum）+ `parseIntVector`；无 attisdropped 过滤（Spec 裁决：索引无 dropped 占位）。
- `app.ts` 增 `GET /api/indexes/:oid/columns`：守卫链镜像 pages 端点（NOT_CONNECTED 401 → requirePageinspect（PAGEINSPECT_MISSING 400）→ BAD_OID 400 → NOT_INDEX 404 → INDEX_NOT_BTREE 400 → mapPgError）；响应形状按 Spec 合同（oid/schema/name/qualifiedName/accessMethod/indnatts/indnkeyatts/hasExpression/columns[10 字段]）。
- indoption 实测补充（本地 pg_index 实证）：`(a DESC, b)` → "3 0"（PG 显式记录 DESC 默认 NULLS FIRST 位）；`(a DESC NULLS LAST, b)` → "1 0"。位解析：bit0=DESC、bit1=NULLS FIRST；include 列恒 false。
- 测试（TDD 先红 12 失败后绿）：`tests/index-columns.test.ts` 12 例（守卫序全链、响应形状逐字段（含 indnatts=3/indnkeyatts=2+include）、DESC|NULLS_FIRST 位、表达式 indkey 0、空 indoption、SQL 契约断言）；既有 indexes/heap 路由测试零回退。

## 验证证据汇总（本批 T1–T4）

- L2：`pnpm test` 全绿 — wal-core 13 + page-core 95（含新增 btree-decode 30 + oracle 解码 16）+ server 79（含新增 12）+ web 112；`pnpm -r typecheck`、`pnpm -r build` 零错误。
- L3：`pnpm test:integration` 退出 0（本地 PG16.11：B-tree oracle 段、heap R1、auto-install 段零回退；本批未加新 L3 段——T8 才加）。
- T1 基线：分支创建前 main@a66e2db 上 250 测试全绿 + typecheck 零错误。

## 未解决风险 / 后续注意

- 本地 PG 由 Developer 本次会话启动（pg_ctl -D ~/pgdata，socket /tmp），供 T2 实捕与 L3 冒烟；后续批次（T5–T9）若需实库，同一方式启动。
- 步进规则表偏差（bitmap 固定 4B/位反转/定长列对齐/nkeyatts 直读/minus-inf==0/尾 TID 按标志位）已按用户裁决以 oracle 为准实现；Reviewer 复核时请对照 dev-notes 规则表而非 design §3 原文。
- t_comp 种子 b 定长 4 字符，混合长度对齐由 idx-align（变长 b）与探针场景锁定；BC 年份（y≤0）日期格式未覆盖（PG ::text 会带 BC 后缀，我们的 civil 输出为负年份）——起出 P0 验收范围，T7/P1 可补。
- idx-null 捕获页含 1 个垃圾 LP_NORMAL 元组（页复用残留，无 oracle 行值）；解码器容忍（bytes 不足/越界降级路径存在），未做专门断言。

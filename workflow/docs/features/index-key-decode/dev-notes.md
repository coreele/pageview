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

## T5/T6 — web 元数据状态与键值区渲染（2026-09-01，前会话已提交）

- T5（3e88fb5）：`api.ts` 增 `IndexColumnsResponse`/`fetchIndexColumns`；`App.tsx` `indexColumns` 按 oid 缓存（成功粘滞/失败不缓存重试/连接重建与 refreshIndexes 清空），`ensureIndexColumns` 在 `loadIndexBlk` 内触发（不 await/不 setError/不入 loadState）；纯模块 `indexKeyDetail.ts` 缓存时序与降级派生单测。
- T6（e43cb83）：键值区置于 Key bytes hex 之上（每列一行/NULL/include 徽标/64 字符截断注/行级与索引级降级标注/loading 行，文案逐字按 ui-design 冻结表）；`IndexTupleDetail`/`StructureMap`/`App` 注入；纯函数单测覆盖行模型/截断/徽标/降级/decode→行映射。metapage 无键值区；hex 块零改动。

## 前会话中断的在制改动评估（本会话处置，2026-09-01）

中断时工作区有 6 个未提交文件，逐一评估结论：

| 文件 | 内容 | 处置与理由 |
|---|---|---|
| `page-core/src/btree-decode.ts` | T7 numeric/float4/float8/bytea 策略与解码器 | **保留并修正**：结构与方向正确；float 定点/科学计数阈值原写 7/15，经实库+源码冻结为 5/14（见 T7 节），timestamp 尾零裁剪补齐 |
| `page-core/tests/btree-decode.test.ts` | 上述类型的 synthetic 测试 | **保留并修正**：float 期望值按实库重写；其“captured from real PG”注释当时并无实捕证据，本会话已用探针实库对照补齐 |
| `apps/server/src/catalog.ts` | domain → typbasetype 替换 SQL | **保留**：实测索引元数据 dm 列正确返回 numeric(1700) |
| `apps/server/tests/index-columns.test.ts` | domain SQL 契约 + 响应形状测试 | **保留**（与实现一致） |
| `apps/web/src/indexKeyDetail.ts` | ↓/nulls first 徽标、keyRowId、pivotHeapTidText | **保留**：pivotHeapTidText 读 [end−6,end) 与 PG 一致（见 pivot pad 节） |
| `apps/web/src/indexKeyDetail.test.ts` | 上述单测 | **保留**：其 pivotHeapTidText 用例当时为红（合成 builder 布局与实库发散，见下节），本会话修 builder 后转绿 |

无丢弃项。design.md 工作区的“Manager 补记”修订节为 Manager 所有，本会话未触碰、未提交。

## Pivot 尾 TID / itemlen pad 实测结论（本会话，2026-09-01）

中断前线索怀疑“itemlen 含尾 TID 之后的 MAXALIGN pad，keyEnd=range.end−6 把 pad 误计入键区”。实测（本地 PG16.11，dup-text 索引内页/hikey + int4 INCLUDE 索引 pivot）+ 本地源码树 `~/postgres`（stock 16.11，git status 干净）双源结论：

1. **尾 TID 恒在 `[itemlen−6, itemlen)`**，无“TID 之后 pad”——否则 `nbtree.h BTreeTupleGetHeapTID`（读 `IndexTupleSize−6`）本身会错；实测尾 TID 与 ctid 行 SQL 值一一对应。
2. 真实布局：`keytuple = MAXALIGN(8+bitmap?+keys)`（index_form_tuple 结果），带尾 TID 的 pivot `itemlen = MAXALIGN(keytuple+6)`，故键 datum 末端与 TID 之间有 ≤7B（keytuple 已对齐时恒 2B）**零 pad**；posting 列表起点同理为 MAXALIGN 后的 keytuple 末端（ip_blkid 偏移）。
3. 解码器 `keyEnd = range.end − 6`（= TID 起点）**实测正确无需改**：列步进只消费各列真实 datum 字节，永不踩入 pad；oracle fixture 16 场景 + 冒烟 16 个尾 TID pivot 对照全过。
4. **真正的问题在合成 fixture-builder**：它把尾 TID 紧贴键 datum 写入（非 [end−6)），键长 ≠ 0 mod 8 时与实库布局发散，掩盖 pad 语义（前会话 pivotHeapTidText 测试因此红）。修复：builder 按 PG 布局写（`maxalign8(maxalign8(data+key)+6)`，TID 置末 6B），并补红→绿回归测试 2 例（布局字节断言 + pad 容忍解码）。

## T7 — P1 类型扩展（2026-09-01）

- 解码：numeric（short/long 双格式、base-10000、NaN/±Infinity）、float4/float8（IEEE 754 小端）、bytea（`\x`+小写 hex）入 `KEY_COLUMN_SPECS` 策略表；domain 由 server SQL 侧替换基类型后直接命中。
- **格式冻结证据（实库）**：临时探针脚本 seed 全形状后 `decodeIndexTupleKeys` vs UTC 会话 `::text`：numeric 22 形状（1e±300、1e63/64、dscale 尾零保留、NaN/±Inf、64 位 π）、float4 14、float8 17、bytea 5、domain 替换——全部一致。在制版本的 float 阈值（7/15）与实库冲突（1e7→`1e+07` 非 `10000000`；首版探针 INSERT 未真正入库 float 电池致误判）：按 `~/postgres/src/common/{f2s.c,d2s.c}` `to_chars`（定点 iff `−4≤exp≤5`(f4)/`≤14`(f8)，printf 默认阈值）修正后全绿。
- 顺带修复（TDD 先红）：timestamp/timestamptz 小数秒尾零裁剪（µs=1370 → `.00137`，PG ::text 口径；T2/T6 种子未踩中尾零故未暴露）。
- server：`INDEX_COLUMNS_SQL` 域列 `typtype='d'` → typbasetype 替换（响应形状不变，纯 SQL 变更）+ 契约/路由测试。
- UI：`↓`/`nulls first` 徽标（仅 key 列，indoption 位）；键值行可点击（`<button>`，Tab/Enter/Space）→ hex 高亮该列字节区间（id `tuple-{lp}.col-{attnum}`，复用既有 onSelectRange）；pivot 尾部 heap TID 在 itemlen 行显示 `(block,offset)`（`pivotHeapTidText`，BT_PIVOT_HEAP_TID_ATTR 门控）。
- BC 年份（y≤0）：plan T7 完成条件不含，按“处理或记录”裁决记录局限（见未解决风险）。

## T8 — 集成冒烟与 CI（2026-09-01）

- `integration-smoke.ts` 新增 `indexKeyDecodeSmoke` 段（独立 schema `pageview_smoke_ixkd`，幂等 seed，finally 清理，单连接 `SET TimeZone='UTC'`）：
  - `/api/indexes/:oid/columns` 形状（kd_mix 复合、kd_desc 的 DESC|NULLS FIRST 位）+ 守卫（表 oid 404 NOT_INDEX / hash 400 INDEX_NOT_BTREE / `abc` 400 BAD_OID）经 `app.inject`；
  - leaf/posting 全量对照：11 个索引（P1 四型 + date/timestamp/timestamptz/uuid/bool + 复合含 NULL/空串/多字节/长值 + dup text 含 posting），10569 个元组 decode == ctid 行 UTC `::text`（归一化：text 族加引号、时间空格→T、`+00`→`Z`）；
  - internal 页尾 TID pivot：16 个 pivot 键 == 尾 TID ctid 行 SQL 值（断言 >0 防静默跳过）；
  - 降级：表达式索引 hasExpression、(int,jsonb) 首列正常/次列 `unsupported type: jsonb`、纯 jsonb 单列全降级；
- 既有段零回退（B-tree list/metapage/internal/leaf/posting + hash guard + heap R1 + auto-install）；退出码 0；blocked=2 语义不变。
- CI：integration job 已运行 `pnpm test:integration`，**零改动**（seed 全部自带）。

## T9 — 文档（2026-09-01）

- README.md / README.zh-CN.md：Features 索引节各补一句键值解码（含类型集、徽标/高亮、降级）。
- 本 dev-notes 补齐 T5–T9 记录。

## 验证证据汇总（T5–T9 批）

- L2：`pnpm test` 全绿 — wal-core 13 + page-core 158 + server 81 + web 136；`pnpm -r typecheck`、`pnpm -r build` 零错误。
- L3：`pnpm test:integration` 退出 0（含新 index-key-decode 段，证据见 T8 节；既有段零回退）。
- 探针脚本（pivot-probe.ts / p1-format-probe.ts）：一次性证据工具，不入库（不在 plan 触碰路径）；其检查已由 T8 冒烟段永久化。

## 手测清单（ui-design；浏览器项待补测）

自动化无法覆盖的 UI 视觉/交互项，**待浏览器手测**（`pnpm dev:server` + `pnpm dev:web`）后回填结论：

- [ ] loading 标注：页面先渲染，选中元组键值区单行 `loading column metadata…`，随后自动变行
- [ ] 断连降级：元数据失败仅键值区单行标注（含 code），页面/hex/结构图正常
- [ ] 表达式索引：索引级 `expression index — key values not decoded (hex only)`，无行，页面正常
- [ ] jsonb 混合：a 正常行 + j 行 `unsupported type: jsonb`，其后列省略
- [ ] NULL/include 徽标/长值截断注/↓/nulls first 徽标呈现
- [ ] 键值行点击 → hex 对应字节区间高亮（Tab 可达，:focus-visible 可见）
- [ ] 两套主题（light/dark）下键值区可读
- [ ] hex 双向联动/结构图选中/Refresh diff 不回退
- [ ] pivot 尾 TID `(block,offset)` 显示

## 未解决风险 / 后续注意

- 本地 PG 由 Developer 本次会话启动（pg_ctl -D ~/pgdata，socket /tmp），供 T2 实捕与 L3 冒烟；后续批次（T5–T9）若需实库，同一方式启动。
- 步进规则表偏差（bitmap 固定 4B/位反转/定长列对齐/nkeyatts 直读/minus-inf==0/尾 TID 按标志位）已按用户裁决以 oracle 为准实现；Reviewer 复核时请对照 dev-notes 规则表而非 design §3 原文。
- t_comp 种子 b 定长 4 字符，混合长度对齐由 idx-align（变长 b）与探针场景锁定；BC 年份（y≤0）日期格式未覆盖（PG ::text 带 `BC` 后缀，我们 civil 输出负/零年）——超出 P0 验收范围且 plan T7 完成条件不含，按“处理或记录”记录局限，后续可补。
- 手测清单（上节）为浏览器待办，UI 验收点未核验前不应视 P0-13/P1 视觉项为已证。
- idx-null 捕获页含 1 个垃圾 LP_NORMAL 元组（页复用残留，无 oracle 行值）；解码器容忍（bytes 不足/越界降级路径存在），未做专门断言。

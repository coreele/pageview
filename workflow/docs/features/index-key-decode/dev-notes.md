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
- 捕获脚本为手工开发工具（仓库先例：无自动化测试），其行为验证 = 产物检视（上表）；T3 将以 oracle 测试消费这些产物形成回归保护。

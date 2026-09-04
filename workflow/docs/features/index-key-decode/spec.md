# Spec: index-key-decode

> 需求与规格（Plan 之前完成）。任务拆解见后续同目录 `plan.md`。
>
> **feature-id**：`index-key-decode` · **sub-feature-id**：`index-key-decode`（未拆分）

## 背景与目标

- index-viewer（已交付）提供 B-tree 页解析（page-core `parseBtreePage`：t_info nulls/vars 位、hikey/pivot/posting 分类、键字节 `keyRange`）与 web 详情面板键字节 hex（64B 截断、点击高亮）。
- 本项目：**index tuple 键字节按索引列类型解码为可读值**，展示在详情面板现有键字节 hex 旁（hex 保留）；server 新增索引列类型元数据端点（`pg_attribute`(索引关系) + `pg_index`）。
- 类型信息来源：索引关系自身的 `pg_attribute`（attnum 1..indnatts，atttypid 即 btree 存储 datum 类型，opclass 如 `text_pattern_ops` 不改变字节形态）与 `pg_index`（indkey/indnkeyatts/indoption）。
- **修订既有合同**：index-viewer Spec「加载索引页不请求表列 schema」修订为：加载索引页附带请求索引列元数据 `GET /api/indexes/:oid/columns`（索引自身属性，非表 `/api/tables/:oid/schema`）；其余 index-viewer P0 不回退。
- 用户已裁决（不得更改）：①键值解码展示、hex 保留；②不支持类型/表达式索引优雅降级为仅 hex + 标注原因；③不做 collation 语义比较、不做键→heap 行反查。

## 非目标

- 不做 collation 语义比较/排序解释：text 族仅按字节解码展示，不同 collation 下的字节序含义不解释。
- 不做键→heap 行反查：解码值不可点击跳行；leaf TID 跳转维持既有机制。
- 不支持非 B-tree 索引（既有 `INDEX_NOT_BTREE` 守卫不变）。
- 不解码表达式索引（indkey 含 0 → 整体降级）。
- 不修改键字节 hex 呈现（64B 截断、range 点击高亮）、结构图、Refresh diff 等既有行为。
- 不做 UI 布局重排：键值区具体布局归后续 ui-design。

## 范围与可见行为

1. **类型元数据获取**：选定 B-tree 索引加载页面时，web 额外获取该索引列元数据；获取失败不阻塞页面查看（降级为 hex-only）。
2. **键值区**：internal/leaf 页每个 index tuple（普通 leaf、posting、pivot downlink、hikey）在现有 Key bytes hex 旁显示按键列顺序的解码值列表，每列一行：`{序号} {列名} ({typname}) = {值}`；NULL 显示 `NULL`；不可解码列显示原因。metapage 无键值区。
3. **支持类型集（P0）**：`int2`、`int4`、`int8`、`bool`、`text`、`varchar`、`bpchar`、`date`、`timestamp`、`timestamptz`、`uuid`（按 typoid 匹配）。
   **P1 扩展**：`numeric`、`float4`、`float8`、`bytea`、domain（基类型在支持集时按基类型解码）。
4. **值呈现约定**：
   - 整数：十进制全精度（BigInt，无溢出）。
   - bool：`true` / `false`。
   - text 族：单引号包裹；UTF-8 解码，不可解码字节以 `\xNN` 转义；超过 64 字符截断显示 `…` 并标注总长（镜像 hex 64B 截断口径）。
   - date：`YYYY-MM-DD`（2000-01-01 起算天数）；`infinity` / `-infinity` 哨兵原样显示。
   - timestamp：微秒精度 `YYYY-MM-DDTHH:MM:SS[.ffffff]`（按存储值展示，无时区后缀）。
   - timestamptz：同格式 + `Z`（**固定 UTC 呈现**，不随浏览器时区变化）。
   - uuid：小写连字符 8-4-4-4-12。
   - numeric（P1）：十进制精确串；`NaN`/`Infinity` 原样。
5. **降级合同**（均不弹全局错误、不影响页面/结构图/hex）：
   - 表达式索引（indkey 含 0）：整个索引 hex-only，标注 `expression index`。
   - 列类型不在支持集：该列显示 `unsupported type: {typname}`，其余列照常解码；若该列字节无法结构化步进导致后续列边界不可知，该列及之后全部降级并标注原因。
   - 元数据请求失败：hex-only，标注原因（含错误 code）。
   - 解码结构性错误（字节不足等）：该列 `decode error: {原因}`，hex 保留。
6. **NULL / 多列 / INCLUDE / 降序**：
   - t_info nulls 位 → 按 null bitmap 判定该列为 NULL；pivot/hikey 被 suffix-truncation 截掉的尾列同样呈现 NULL（不区分，记录为局限）。
   - 多列索引按 indkey 顺序逐列解码。
   - INCLUDE 列在 leaf 元组中解码并标注 `include`；在 pivot/hikey 中被截断 → NULL。
   - indoption 降序列（P1）：列名旁 `↓` 标注；DESC 不改变存储字节，解码规则不变。

## 合同

### API / 接口

新增 `GET /api/indexes/:oid/columns`（与 `/api/tables/:oid/schema` 对称）：

- 门禁链与错误码镜像 `/api/indexes/:oid/pages/:blkno`：NOT_CONNECTED 401 → BAD_OID 400（oid 非法）→ NOT_INDEX 404（relkind≠'i'）→ INDEX_NOT_BTREE 400（am≠btree）；pg 错误走既有 `mapPgError`。
- 响应形状：
  ```json
  {
    "oid": 24576, "schema": "public", "name": "t_a_b_idx",
    "qualifiedName": "public.t_a_b_idx", "accessMethod": "btree",
    "indnatts": 3, "indnkeyatts": 2, "hasExpression": false,
    "columns": [
      { "attnum": 1, "name": "a", "typoid": 23, "typname": "int4", "typmod": -1,
        "kind": "key", "isExpression": false, "descending": false, "nullsFirst": false }
    ]
  }
  ```
- SQL 来源与语义：`pg_attribute`(attrelid=索引 oid) LEFT JOIN `pg_type`；`pg_index` 提供 indnkeyatts/indkey/indoption；`hasExpression` = indkey 数组含 0；`kind`：attnum ≤ indnkeyatts 为 `key`，否则 `include`；`descending` = indoption 对应位 & 0x0001；`nullsFirst` = & 0x0002；按 attnum 升序返回（索引属性顺序即解码顺序）。索引无 dropped 属性占位（表 DROP COLUMN 会连带删索引），无需 attisdropped。

### 数据 / 状态

- 解码输入（逻辑模型）：tuple 的 `keyRange` 字节 + t_info（nulls 位）+ 列元数据（顺序、typoid/typname、key/include）。
- 解码输出模型：每列 `{ attnum, name, typname, status: "value"|"null"|"unsupported"|"error", display?, reason?, range? }`；`range` 为该列消耗的字节区间（供 P1 hex 高亮）；索引级 `degradedReason`（`expression index` / `metadata unavailable`）。
- 键属性字节边界遵循 PG `index_form_tuple` 的 packed 存储：null bitmap（存在时）紧随 t_info，长度 ⌈indnatts/8⌉；变长列按 varlena 头（1B/4B）步进；heapkeyspace pivot 元组尾部 heap TID（6B）不属键属性，不计入键值区。具体偏移由 Design/Plan 依 PG 源码冻结并以 oracle 验证；Spec 只约束最终值与 SQL 可对照。
- web 状态：列元数据按 index oid 缓存；页面渲染与元数据获取解耦（元数据缺失/失败仅影响键值区）；两者齐备后显示键值区。解码层归属（page-core 扩展 vs web 内）由 Design 决定。

### 错误与约束

- 降级规则见范围 5；降级为 hex-only 即 index-viewer 现状形态。
- 长值截断（64 字符 + 总长）仅为显示层，解码值本身不截断。
- 既有 index-viewer 行为（hex 联动、heap 路径、metapage、posting TID、守卫链）不得回退（验收 P0-13）。

## 验收（Given-When-Then）

Oracle = pageinspect（`get_raw_page` + `bt_page_items`）+ SQL 对照；时间类对照在会话 `SET TimeZone='UTC'` 下以 `::text` 输出为基准。

### P0

- **P0-1 列元数据端点**：Given 种子 B-tree 复合索引（`(a int, b text) INCLUDE (c int)` 与含 DESC 列索引），When `GET /api/indexes/:oid/columns`，Then 响应形状与 API 合同一致（indnkeyatts 拆分、descending/nullsFirst、hasExpression=false）；Guard：非数字 oid → 400 BAD_OID、表 oid → 404 NOT_INDEX、hash 索引 → 400 INDEX_NOT_BTREE。
- **P0-2 整数解码**：Given 唯一 int 索引 leaf 页，When 选中任一非 pivot 元组，Then 键值区该列值 = SQL `SELECT k FROM t WHERE ctid='{t_tid}'` 之值；hex 区不变。
- **P0-3 text 族解码**：Given `(name text)` 索引（种子含空格、多字节 UTF-8、>64 字符值），When 选中元组，Then 解码值与 ctid 行 SQL 值一致（引号包裹；超长截断 + 总长标注）。
- **P0-4 date/timestamp/timestamptz/uuid/bool**：Given 各类型单列索引，When 选中元组，Then 解码值与 ctid 行 `::text`（UTC 会话）一致：timestamptz 带 `Z`、timestamp 无后缀、微秒精度一致、uuid 小写连字符、bool true/false。
- **P0-5 NULL**：Given nullable 列索引含 nulls 位元组，When 选中，Then 该列显示 NULL，与 ctid 行 `IS NULL` 对照。
- **P0-6 多列**：Given `(a int, b text)` 复合索引，When 选中元组，Then 按序显示两列（列名+类型+值），均与 ctid 行对照。
- **P0-7 posting 元组**：Given dedup 触发的 posting 元组，When 选中，Then 其键值 = postingTids 任一 TID 对应行的 SQL 值。
- **P0-8 hikey / internal pivot**：Given 唯一 int 索引非最右 leaf 页，When 选中 hikey，Then 其值 = 右兄弟页首个数据元组（若该页存在自身 hikey 则跳过）的解码值，且 = 该数据元组 TID 行 SQL 值；Given internal 页指向非最右子页 C 的 pivot downlink，Then pivot 值 = C 页 hikey 值（单列唯一索引无截断），且 pivot 尾部 heap TID 字节不计入键值区。
- **P0-9 INCLUDE**：Given `(a) INCLUDE (b)` 索引 leaf 元组，Then 显示 a 与 b（b 标注 include），与 ctid 行对照；同索引 hikey 中 b 为 NULL。
- **P0-10 表达式索引降级**：Given `(lower(name))` 表达式索引，When 加载任一页并选中元组，Then 仅 hex + 标注 `expression index`；页面正常加载。
- **P0-11 不支持类型降级**：Given `(a int, j jsonb)` 复合索引，Then a 列正常解码、j 列显示 `unsupported type: jsonb`；纯 jsonb 单列索引整体 hex-only + 同标注。
- **P0-12 元数据失败降级**：When columns 请求失败（模拟未连接/断连），Then 页面照常渲染、hex-only + 标注原因（含 code）。
- **P0-13 回归**：Given 本项合入后，Then heap 表路径与既有 index-viewer P0（索引列表、metapage、hex 双向联动、posting TID 列表、守卫链）行为不变。

### P1

- numeric（十进制精确串、NaN/Infinity）、float4/float8（含 ±Infinity/NaN 哨兵）、bytea（`\x…`）、domain 基类型解析。
- descending 列 `↓` / nulls-first 标注（indoption）。
- 键值区每列点击 → hex 中该列字节区间高亮（复用既有 selection/highlight 机制）。
- pivot 尾部 heap TID 在详情面板显示为 `(block,offset)`。
- README 双语 Features 索引节补一句（文档影响，Plan 落实）。

## 开放问题（已裁决）

2026-08-31 用户确认 Spec 通过，裁决：

1. **timestamptz 时区呈现：维持固定 UTC（`Z`）**（与既有 heap 解码约定一致，确定性对照）。
2. **P1 类型集边界：维持**（numeric/float4/float8/bytea/domain 置 P1，首版控范围）。
3. pivot 截断尾列与真实 NULL 统一呈现 NULL：已定，记录局限。

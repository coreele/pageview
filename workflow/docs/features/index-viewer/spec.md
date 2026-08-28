# Spec: index-viewer

> 需求与规格（Plan 之前完成）。任务拆解见后续同目录 `plan.md`。
>
> **feature-id**：`index-viewer` · **sub-feature-id**：`index-viewer`（未拆分）
>
> **确认记录**：路径 `full`；Spec 用户确认 required。**2026-08-28 用户确认通过**，5 个开放问题一并裁决（见文末「开放问题」）。
>
> **Design 门禁**：`required`。模块边界（扩展 page-core vs 新建 index-core 包；UI 与 Page 模式的关系）由后续 `design.md` 决定，本文件对解析层归属保持中立。
>
> **适用对象 / 前置条件**：面向 Planner（Design/Plan）与 QA；前置为已连接 PostgreSQL 实例、已启用 `pageinspect`、存在用户 B-tree 索引。验收时可用 `pageinspect.bt_metap` / `bt_page_items` 作为对照 oracle。

## 背景与目标

现状：Page 模式仅支持 heap 表（relkind='r'），WAL 模式独立。用户已明确范围（2026-08-28）：

1. 仅支持 **B-tree** 索引；
2. **不新增独立第三模式**——在现有 Page 模式内识别「表或索引」，加载索引页时自动切换为索引页解析与展示；
3. UI/UX 为本项重点。

目标：

1. 用户在 Page 模式可选择表**或**索引；索引可发现（含访问方法标注）。
2. 加载 B-tree 索引页后，按页面类型（metapage / internal / leaf）展示结构：页头、ItemId、index tuple（含高键、posting list）、special space（`BTPageOpaqueData`）、metapage 元信息（`BTMetaPageData`）。
3. 检测到非 B-tree 索引时给出明确反馈，前后端双层拦截。
4. 复用既有结构图 / hex 联动 / 选中详情 / Refresh diff 交互，heap 页行为不回退。

## 非目标

- hash / gist / spgist / brin / gin 索引页的解析与展示（仅提供「不支持」反馈）
- 新增独立 UI 模式（无第三 mode 按钮）
- index tuple 键字节按索引列类型解码为可读值（已裁决另立项；本项仅展示键字节 hex）
- WAL 模式任何变更
- 修改 `parsePage` 等 heap 解析语义；修改 `/api/tables/*` 既有合同
- 非 8KB 页（BLCKSZ ≠ 8192）支持
- 索引页的写入、REINDEX、VACUUM 等管理操作

## 范围与可见行为

### 在范围

1. **关系选择（Page 模式输入侧）**
   - Page 模式输入侧支持选择关系种类「表 / 索引」（具体控件形态归 ui-design.md）；默认仍为表，现状路径不变。
   - 索引列表：列出用户 schema 下的索引，每项显示 qualifiedName、访问方法、块数、所属表名；系统 schema 排除（口径见 API 合同）。
   - 非 B-tree 索引**可见但标记不可用**（显示访问方法名 + 仅支持 B-tree 的原因）；选中后 Load 禁用且不发起页面请求。
   - 无效索引（`indisvalid = false`）列出并标记（裁决：不隐藏，便于发现；标记仅为提示，仍可加载）。
2. **索引页加载与自动切换**
   - 选中 B-tree 索引后输入 blkno（默认 0，即 metapage）Load；raw page 仍经 server 代理 `get_raw_page(qualifiedName, blkno)` 获取。
   - 加载成功后，同一结构图 / hex / 详情三联区域内自动呈现索引页解析结果；元信息条显示：索引 qualifiedName+oid、访问方法、#blocks、blkno、页类型（meta/internal/leaf）、btpo_level、lower/upper/free、ItemId 计数、#tuples（posting tuple 计入并另行计数）。
   - 表 ↔ 索引切换时清除旧页、选中与高亮（与现有表间切换一致），无残留状态。
   - 加载索引页不请求表列 schema（无 `/schema` 调用）。
3. **各页面类型展示（结构图可选中字段 + hex 联动 + 选中详情）**
   - **所有页通用**：页头（现状 9 字段）；ItemId 数组（现状）；元组区；**special space**（`pd_special` 至页尾）：`btpo_prev`、`btpo_next`、`btpo_level`、`btpo_flags`、`btpo_cycleid`，其中 `btpo_flags` 复用既有位格条交互合同（hex + 位格 + hover/聚焦 + `?` 参考，同 pd_flags / infomask 基线）。
   - **metapage（blkno 0）**：ItemId 区为空时显示空态说明；`PageGetContents` 起的 `btm_magic`、`btm_version`、`btm_root`、`btm_level`、`btm_fastroot`、`btm_fastlevel`；`btm_allequalimage` 仅在 `btm_version ≥ 4` 时显示。页类型标记 **meta**。
   - **internal（`btpo_level > 0`）**：页类型标记 internal + level；index tuple 的 `t_tid` 为子页指针（block, offset=0 语义）；非最右页首 tuple 标记 **hikey（高键）**。
   - **leaf（BTP_LEAF）**：页类型标记 leaf；index tuple 的 `t_tid` 为 heap TID；非最右页首 tuple 标记 hikey；posting list tuple（dedup，PG13+）标记为 posting 并显示 TID 数与 TID 列表（列表超长可滚动/截断，计数完整）。
   - **index tuple 详情**：选中任一 index tuple 显示 itemoffset、`t_tid`、itemlen、`t_info` 位（size/nulls/vars）、hikey/posting 标记、键字节 range 与 hex。
4. **块导航（同索引内）**：`btpo_prev`、`btpo_next`、internal tuple 子页 `t_tid`、metapage `btm_root`/`btm_fastroot` 的块号可点击加载当前索引对应 blkno（交互形态同现有 ctid 跨块加载）。
5. **错误与空态合同**见「合同 → 错误与约束」。

### 明确保留（不削弱）

- heap 表路径：选表、schema 解码、tuple 详情、diff、hex 联动行为完全不变
- 结构图 32B/行网格、free space 呈现、选中↔hex 双向高亮、Refresh diff（对索引页同样生效）
- 错误呈现样式（`code: message` + `Next: …`）、连接与 pageinspect 门禁合同
- light/dark 主题；新增区块复用既有 token

## 合同

### API / 接口

新增两个端点（命名沿 `/api/tables` 风格）；既有端点不变。

| 端点 | 合同 |
|---|---|
| `GET /api/indexes` | 门禁：已连接 + `requirePageinspect`（同 `/api/tables`）。响应 `{ indexes: [{ oid, schema, name, qualifiedName, accessMethod, blocks, tableOid, tableQualifiedName, valid }] }`；来源 `pg_class`(relkind='i') join `pg_am`、`pg_index`→`pg_class`(表)，排除系统 schema（`pg_catalog`、`information_schema`、`pg_toast` 及 temp schema，同表列表口径）；`blocks = pg_relation_size/8192`；按 schema、name 排序。`valid` = `indisvalid` |
| `GET /api/indexes/:oid/pages/:blkno` | 门禁：已连接 + `requirePageinspect`。校验顺序：① oid 存在且 relkind='i'，否则 404 `NOT_INDEX`；② `accessMethod = 'btree'`，否则 400 `INDEX_NOT_BTREE`；③ blkno 整数 ≥0（400 `BAD_BLKNO`）且 < blocks（400 `BLKNO_OUT_OF_RANGE`）。响应 `{ oid, blkno, qualifiedName, byteLength, pageBase64 }`（同表页端点形状）；经 `get_raw_page(qualifiedName, blkno)` |

### 数据 / 状态

| 概念 | 合同 |
|---|---|
| 索引页解析模型 | 解析层归属（page-core 扩展 vs 新包）由 Design 决定；Spec 只约定输出：页面分类 `meta \| internal \| leaf`（依据 BTP_META / btpo_level / BTP_LEAF），派生标记 isRoot、isRightmost、deleted、halfDead、hasGarbage、incompleteSplit；special space 五字段与 metapage 六/七字段（见范围 3）；index tuple 列表（itemoffset、t_tid、itemlen、t_info nulls/vars 位、hikey 标记、posting 标记 + TID 列表、键字节 range）。字段语义以 PostgreSQL `nbtree`（`BTPageOpaqueData` / `BTMetaPageData` / `IndexTupleData`）为准，字节偏移布局由 Plan 落实 |
| hikey 判定 | 非最右页（`btpo_next` 有效）首个 LP_NORMAL tuple 为高键；最右页无高键 |
| web 状态 | Page 模式内新增关系种类状态（table \| index）与选中索引；heap 页状态机（idle/loading-page 等）复用；切换关系或种类即清除 page/选中/高亮/diff |
| 元信息来源 | 页类型、level、btpo 字段仅来自本页 raw bytes 解析，不依赖 server 端预判；server 仅透传 raw page |
| 验证 oracle | 展示值须与 `pageinspect.bt_metap('idx')`、`bt_page_items('idx', blkno)` 输出一致（QA 对照） |

### 错误与约束

| 约束 | 合同 |
|---|---|
| `INDEX_NOT_BTREE`（400） | message 含检测到的访问方法名；nextStep 指示改选 B-tree 索引或表。client 在选择侧先行拦截（禁用 Load + 说明），server 端点为最终守卫，双层不互相替代 |
| `NOT_INDEX`（404） | oid 不存在或 relkind ≠ 'i'；nextStep 指示从索引列表重选 |
| 复用错误码 | `NOT_CONNECTED`(401)、`PAGEINSPECT_MISSING`(400)、`BAD_BLKNO`(400)、`BLKNO_OUT_OF_RANGE`(400)、`BAD_PAGE`(500) 语义与表页端点一致；client `UNSUPPORTED_PAGE`（非 8KB）沿用 |
| 错误形状 | 一律 `{ code, message, nextStep }`；UI 呈现「原因 + 可执行下一步」，禁止裸错误码 |
| 空态 | metapage ItemId 空区、无 tuple 叶页：显示说明性空态，不显示为错误 |
| 解析健壮性 | 页数据异常（如 metapage magic 不符、字段越界）不得崩溃：可解析部分照常展示，异常处以警告标注；整页无法解析时报 `UNSUPPORTED_PAGE` 类错误 |
| 禁止 | server 不执行 `CREATE EXTENSION`、不运行任何预判 SQL 改动；本项不改 heap 解码与 `/api/tables/*` 合同 |

## 验收（Given-When-Then）

### P0

- **P0-1 索引发现**  
  Given 已连接且库中存在用户索引（含 ≥1 个非 B-tree），  
  When 在 Page 模式切换到索引选择，  
  Then 列出索引（qualifiedName、访问方法、blocks、所属表），非 B-tree 项带不可用标记；列表与 `pg_class`/`pg_indexes` 口径一致（系统 schema 除外）。

- **P0-2 非 B-tree 客户端反馈**  
  Given 选中访问方法为 hash 的索引，  
  When 尝试加载，  
  Then Load 不可用并显示含访问方法名的原因与下一步（改选 B-tree/表），且未发起 `/api/indexes/:oid/pages/…` 请求。

- **P0-3 服务端守卫**  
  Given 已连接，  
  When `GET /api/indexes/<hash索引oid>/pages/1`，  
  Then 返回 400，body 为 `{ code: "INDEX_NOT_BTREE", message, nextStep }`（非 5xx）。

- **P0-4 metapage 展示**  
  Given 选中 B-tree 索引、blkno=0，  
  When Load，  
  Then 页类型标记 meta；显示 btm_magic/version/root/level/fastroot/fastlevel（version ≥ 4 另有 allequalimage），各项与 `pageinspect.bt_metap` 输出一致；ItemId 空区有空态说明。

- **P0-5 叶页展示**  
  Given blkno 指向叶页，  
  When Load，  
  Then 页类型标记 leaf；展示 ItemId、index tuples（itemoffset、t_tid、itemlen、nulls/vars 位）、special 区 btpo_* 与 btpo_flags 位格条；tuple 明细与 `pageinspect.bt_page_items` 一致。

- **P0-6 内页展示**  
  Given blkno 指向 internal 页（level > 0），  
  When Load，  
  Then 页类型标记 internal + level；tuple 的 t_tid 呈现为子页指针；与 `bt_page_items` 一致。

- **P0-7 高键标记**  
  Given 任一非最右页（叶或内页），  
  When 查看首 tuple，  
  Then 标记 hikey；最右页首 tuple 无该标记。

- **P0-8 posting list**  
  Given PG13+ 且存在 dedup 生成的 posting tuple 的叶页，  
  When 查看该 tuple，  
  Then 标记 posting 并显示 TID 数与 TID 列表，与 `bt_page_items` 的 tids 一致。

- **P0-9 hex 双向联动**  
  Given 已加载索引页，  
  When 在结构图选中 btm_root / btpo_prev / 任一 index tuple 字段，再在 hex 点击同偏移字节，  
  Then 双向高亮与选中详情均正确（含 metapage 与 special space 字段）。

- **P0-10 heap 不回退**  
  Given 已加载索引页后切回任一 heap 表，  
  When 加载表页，  
  Then 表路径行为（schema 列解码、元信息条、diff、hex）与本项之前一致；往返切换无残留状态。

- **P0-11 错误合同**  
  Given 选中 B-tree 索引，  
  When 分别输入越界 blkno、未连接请求、非整数 blkno，  
  Then 依序得到 `BLKNO_OUT_OF_RANGE`、`NOT_CONNECTED`、`BAD_BLKNO`，均为 `{code, message, nextStep}` 形状。

- **P0-12 切换反馈**  
  Given 已加载某索引页且存在选中/高亮，  
  When 切换为另一索引或任一表，  
  Then 旧页、选中、高亮、diff 立即清除，元信息条反映新关系。

### P1

- **P1-1 块导航**：btpo_prev/btpo_next、internal 子页 t_tid、btm_root/fastroot 块号可点击加载当前索引对应页。
- **P1-2 特殊状态提示**：deleted / half-dead / has-garbage / incomplete-split / root 标记在页类型附近提示（依据 btpo_flags）。
- **P1-3 leaf heap TID 跳转**（已裁决纳入本项）：点击叶页 tuple 的 heap TID 切换到所属表并加载对应块。
- **P1-4 Refresh diff 回归**：对索引页 Refresh 产生字节级 diff 高亮，行为同 heap 页。
- **P1-5 主题可读**：新增区块（special/meta/索引 tuple）在 light/dark 下均可辨读。

## 开放问题（已裁决）

2026-08-28 用户确认 Spec 通过，5 个开放问题按以下结论裁决：

1. **索引列表组织：全局平铺**（含所属表列），不按表分组；分组可作后续增强。
2. **leaf 页 heap TID 跳转（P1-3）：纳入本项**。
3. **键值按列类型解码：另立项**（本项仅展示键字节 hex，非目标不变）。
4. **无效索引：列出并标记**（不隐藏；与非 B-tree 同样可见便于发现）。
5. **PG 版本下限：btm_version 3 与 4 均支持解析**（v3 不显示 allequalimage，v4+ 显示）；运维/验收以现有 CI 环境为准。

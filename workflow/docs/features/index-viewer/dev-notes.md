# Dev Notes: index-viewer

> Developer 实施记录（T1–T10 逐任务追加；本批 T1–T4）。
> 依据：spec.md（行为合同）· design.md §4（预期常量，**以 oracle/PG16 头文件实测为准**）· plan.md。

## T1 — 分支与基线（2026-08-28）

- `git checkout -b index-viewer main`（自 5d0e3d9）；无代码触碰，无提交。
- `pnpm test` 全绿：page-core 32 · server 17 · web 20 tests。
- `pnpm -r typecheck` 4 包零错误。

## T2 — 实捕 fixture + 常量冻结（2026-08-28）

### 环境

- 本地 PG 16.11（socket）；pageinspect 原未安装，由操作者按 fixtures README 前置合同手动
  `CREATE EXTENSION pageinspect`（捕获脚本/应用零 CREATE EXTENSION，合同保持）。
- 种子对象（操作者手动建，README 已固化步骤）：`pageview_fx.demo_dup(k int, i%50, 30000 行)` →
  `demo_dup_k_idx`（dedup posting）；`pageview_fx.demo_uniq(k int, 唯一, 50000 行)` →
  `demo_uniq_k_idx`（root=3 内页 / 多叶页）。均 ANALYZE。

### 交付物（已提交）

- `scripts/capture-fixtures.ts` 新增 `--index` 模式：页 `.bin/.base64.txt/.meta.json` +
  `.oracle.json`（bt_metap 仅 blkno 0；bt_page_stats/bt_page_items；metapage 上两者记 22023
  错误串「block 0 is a meta page」而非数据）。
- 四场景实捕：`btree-meta`(blk0) / `btree-internal`(root=3) / `btree-leaf`(blk1) /
  `btree-posting`(dup idx blk1，posting 132 TIDs 实证)。`fixtures/README.md` 更新。

### TDD 例外记录（developer.md「无法自动化测试先行」条款）

`scripts/capture-fixtures.ts` 属离线开发工具，scripts/ 无测试基建。验证 = 实际执行四场景捕获，
oracle JSON 与独立探针输出一致；fixture 由 T3 `tests/btree-oracle.test.ts` 消费形成自动化回归。
风险低；恢复条件：T3 oracle 测试落地。

### 常量冻结：design §4 预期 vs 实测（实测为准；源=实捕 oracle + PG16.11 头文件
`access/itup.h`、`access/nbtree.h` 双源核对）

| 项 | design §4 预期 | 实测 | 结论 |
|---|---|---|---|
| special space [8176,8192)，prev u32@8176 / next u32@8180 / level u32@8184 / flags u16@8188 / cycleid u16@8190 | 同左 | 字节读数 == bt_page_stats（leaf: 0/2/0/flags=1；root: 0/0/1/flags=2）；nbtree.h BTPageOpaqueData | 一致 |
| btm_magic u32@24 = 0x05362 | 同左 | 340322 == 0x05362（bt_metap + 字节双证） | 一致 |
| btm_version@28 / root@32 / level@36 / fastroot@40 / fastlevel@44 | 同左 | 4/3/1/3/1 == bt_metap | 一致 |
| btm_allequalimage | @60（其后为 cleanup 字段） | **@64**：PG16 布局为 delpages u32@48 → float8 last_cleanup_num_heap_tuples@56（8 对齐，52–55 pad）→ bool@64；bt_metap allequalimage=true 与字节 64==1 一致 | **偏差 D1**（以 @64 实施） |
| t_info：size=0x1FFF、0x2000=INDEX_ALT_TID_MASK、0x4000=INDEX_VAR_MASK | 同左 | itup.h：SIZE=0x1FFF、ALT(AM_RESERVED)=0x2000、VAR=0x4000、**NULL=0x8000**；实测 vars↔0x4000、nulls↔0x8000 | 一致；design「0x2000…否则 NULL bitmap」括注不准（NULL 位独立为 0x8000）→ **偏差 D2（措辞）** |
| posting 判定与布局 | 「t_info&0x2000（leaf 上=posting）」 | 精确语义：t_info ALT 位 + **ip_posid 的 BT_IS_POSTING=0x2000**；nTIDs = posid & BT_OFFSET_MASK(0x0FFF)；**TID 数组起点 = ip_blkid（元组内偏移 postingoffset，非固定+16；实测=16 系 8B 头+8B int 键巧合）**；TID 存储顺序与 bt_page_items tids 输出一致（实测首 (0,50) 末 (29,46)，无反转） | **偏差 D3（补充精确定义）** |
| BTP_* 位值 | 仅列名未定值（列举顺序隐含 HALF_DEAD=0x08、HAS_GARBAGE=0x10、INCOMPLETE_SPLIT=0x20） | nbtree.h：LEAF=0x01、ROOT=0x02、DELETED=0x04、**META=0x08、HALF_DEAD=0x10、HAS_GARBAGE=0x40、INCOMPLETE_SPLIT=0x80**；metapage flags=0x08、leaf=0x01、root=0x02 实测印证 | **偏差 D4（补定值）** |
| 页分类 | blkno 0 且 btm_magic 匹配 → meta | parseBtreePage 无 blkno 入参，按 nbtree P_ISMETA（BTP_META 位）判 meta，magic 不符降级 warning（见 T3） | 实施备注（语义等价） |
| hikey | 非最右页首个 LP_NORMAL tuple | spec 合同；btree-posting/leaf 实捕印证 | 一致 |

结论：D1–D4 均以实测实施并冻结于 `src/btree.ts` 常量区；spec.md 所有字段值语义未受影响。

### 验证命令与输出摘要（T2）

```bash
pnpm --filter server exec tsx ../../scripts/capture-fixtures.ts \
  --index pageview_fx.demo_uniq_k_idx --blkno 0 --out packages/page-core/fixtures/btree-meta
# → Wrote …btree-meta.{bin,base64.txt,meta.json,oracle.json} (statsError="block 0 is a meta page", …)
# 另三场景 statsError=null, itemsError=null（见 README 场景表）
```

（注：上述 `--filter server exec` 使相对 out 落于 apps/server 下，产物已移至
`packages/page-core/fixtures/`；README 示例为仓库根 `pnpm exec tsx scripts/…`，路径解析正确。）

## T3 — page-core btree 解析（2026-08-28）

- 新增 `src/btree.ts`（常量 + parseBtreePage + decodeBtpoFlags + 类型）、
  `src/btree-structure.ts`（deriveBtreeStructureFields，special/meta region）；
  `fixture-builder.ts` 增 `buildBtreePage`（meta v3/v4/badMagic、internal、leaf、posting、
  越界 ItemId 告警用例）；`structure-fields.ts` Region 枚举扩展 `special|meta`（叠加式）；
  `parse.ts` 仅对 parseHeader/readItemId 加 `export`（共享 reader，零行为变化）；
  `index.ts` 导出 btree 面。
- TDD：先写 `tests/btree.test.ts`（16 例）+ `tests/btree-oracle.test.ts`（4 场景）确认红灯
  （模块缺失 20 例失败）→ 实现 → 绿灯。**oracle 抓到两处真问题**：① BTREE_MAGIC 初值
  0x05362 少一位（应为 0x053162=340322）；② 捕获 root 为最右页，首元组无 hikey（P0-7 反例）
  ——均已修正（实现与测试各自对应）。
- 验证：`pnpm --filter page-core test` → 52 passed（既有 heap 32 例零改动 + 新 btree 20 例）；
  `pnpm -r typecheck` / `pnpm -r build` 全绿（web 对 region 无穷尽检查，枚举扩展无破坏）。

## T4 — server 索引端点与守卫（2026-08-28）

- `catalog.ts` 增 `LIST_INDEXES_SQL`（relkind='i' + pg_am/pg_index/表 namespace join、系统/temp
  schema 排除同表列表、pg_relation_size/8192、ORDER BY schema,name、indisvalid）与
  `INDEX_RELATION_SQL`（oid→relkind/amname/nspname/relname/blocks）。
- `app.ts` 增 `GET /api/indexes`、`GET /api/indexes/:oid/pages/:blkno`；校验序① NOT_INDEX(404)
  →② INDEX_NOT_BTREE(400，message 含实测 am 名)→③ BAD_BLKNO→④ BLKNO_OUT_OF_RANGE；
  门禁 notConnectedReply + requirePageinspect 复用；响应形状同表页端点；heap 路由零改动。
- TDD：先写 `tests/indexes.test.ts`（stub pool + app.inject：校验序优先级、门禁、成功形状、
  列表映射）与 `catalog.test.ts` 新增 SQL 契约四例 → 红灯（14 例失败）→ 实现绿灯。
- 实库探针（未提交脚本，事后删除）：真库上 `/api/indexes` 列表正确（btree/hash、valid、
  blocks、所属表）；hash 索引→400 `INDEX_NOT_BTREE`（message 含 "hash"）；不存在 oid→404
  `NOT_INDEX`；btree blkno 0→200 且 parseBtreePage 得 meta/root=1/allequalimage=true；
  blkno 99999→400 `BLKNO_OUT_OF_RANGE`。
- 验证：`pnpm --filter server test` → 31 passed（既有 17 例零改动 + 新 14 例）。

### 环境备注（风险，后续批次注意）

本机存在双连接目标：仓库 `.env`（libpq 关键字串）指向 `postgres` 库，而进程无 env 时
socket 默认落到 `jason` 库（T2 种子与 fixture 捕获所在地）。`readEnvCredentials()` 对
libpq 关键字串 `new URL` 解析失败后回退 PG* 键，`pnpm test:integration` 实际连 `.env`
目标（postgres 库，当前通过）。**T9 增 B-tree 冒烟段时须自建种子对象（现状 smoke 即如此），
不要依赖 T2 本地种子存在**；两库均无凭据泄露风险（未打印 .env 内容）。

## 本批（T1–T4）汇总验证

```text
pnpm test            → wal-core 13 · page-core 52 · web 20 · server 31，全绿
pnpm -r typecheck    → 4 包 Done（零错误）
pnpm -r build        → 4 包 Done
pnpm test:integration→ L3 smoke OK（heap 段不回退；B-tree 段待 T9）
```

未解决风险/遗留：

1. v3 metapage 仅 synthetic 覆盖（本地 PG16 仅产 v4）——design §4 已列为已知验证缺口，
   T9 CI 同样只覆盖 v4；v3 路径依赖 buildBtreePage 单测。
2. 环境双目标（见上）——T9 落地时冒烟段需自带种子。
3. `pnpm test` 中 web 对新 region 的渲染适配属 T6，本批仅保证类型层不破坏。

---

## T5 — web API 层与输入侧状态机（2026-08-28）

提交 `0cbf811`。触碰：`api.ts`、`indexView.ts`（新）、`App.tsx`、`styles.css`、
`api.test.ts`/`indexView.test.ts`（新）。

- api.ts：`IndexRow`/`IndexPageResponse` 类型 + `listIndexes()`/`fetchIndexPage(oid, blkno)`；
  复用既有 `parseError`（错误形状 `{code,message,nextStep}` 原样透传）。
- indexView.ts（纯函数，可测）：option 四要素文案 `qualifiedName (am · N blk · → table)`、
  非 B-tree「✕」前缀、invalid「· invalid」后缀、title（hash：仅支持 B-tree 索引页解析 /
  indisvalid=false，可加载，仅供检视）、P0-2 hint 文案（含 am 名）、`canLoadIndex`
  （非 B-tree 永 false；invalid B-tree 可加载）、页类型徽标 meta / internal·LN / leaf +
  P1-2 芯片（root/deleted/half-dead/garbage/split-unfinished）、level 文本（meta=—）。
- App.tsx：`relationKind` 分段控件（表|索引，复用 Page|WAL 的 mode-switch 皮肤）；kind=索引
  分支：index select（全局平铺、超长截断+title）· blkno（默认 0、placeholder 0=metapage）·
  Load（非 B-tree 时 disabled+title，triggerLoadIndex 双重守卫不发请求）· Refresh ·
  loading-indexes spinner；`resetPageView()`（page/selectedId/highlight/prevRaw/diffIds/
  hexLocate，P0-12）；`loadIndexBlk`（仅 fetchIndexPage+parseBtreePage，无 /schema 调用）；
  `pageView: {kind:heap|btree}` union 驱动；btree 元信息条（index/oid·am·#blocks·blkno·页类型
  徽标+芯片·level·lower/upper/free·ItemId 分解·#tup(posting N)）。kind=表控件层级与渲染
  分支零改动（仅结构等价适配 pageView union）。

### 与 ui-design 对应（T5 范围）

| ui-design 条目 | 实现 |
|---|---|
| 控件层级（分段→select→blkno→Load→Refresh→spinner） | App.tsx chrome-controls，同槽不新增纵向层级 |
| option 四要素/✕前缀/·invalid 徽标/title | indexView.formatIndexOption/indexOptionTitle |
| inline hint（danger 色、含 am 名与下一步） | `nonBtreeHint` → chrome 内 `index-hint-inline` |
| Load 禁用不发请求 | `canLoadIndexBlk`（state 门控 + trigger 守卫） |
| 元信息条两行式内容与徽标/level/统计/posting 计数 | btree meta-stats 分支 |
| 空态文案（选择一个索引开始… / 无用户索引…） | 主区 muted panel |

### 验证（T5）

```bash
pnpm --filter web test        # 40 passed（+20：api 5 · indexView 15）
pnpm --filter web typecheck   # 零错误
pnpm --filter web build       # 通过
```

App.tsx 的 React 接线（分段控件交互、重连重置、列表懒加载 effect）无 React 渲染测试基建
（仓库 web 测试均为纯逻辑 .test.ts，无 jsdom/@testing-library），按 developer.md 记录：
不可自动化的行为以纯函数抽取覆盖 + dev-notes 手测清单替代；风险低（状态逻辑简单），
恢复条件=引入组件测试基建（超出本项范围）。

## T6 — 三联区 btree 渲染（2026-08-28）

提交 `8cd6a64`。触碰：`diff.ts`、`StructureMap.tsx`、`App.tsx`、`styles.css`、
`diff.test.ts`（新）。

- diff.ts：`findStructureAt(fields, offset)` / `structureAffectedByDiff(fields, diffs)` 改为
  `StructureField[]` 消费者（纯签名扩展）；保留 header/free 粗粒度兼容 id；
  `diffByteRanges` 不变 → 索引页 Refresh diff 天然生效。
- StructureMap：props `page` → `{raw, freeRange, fields}`；heap 详情抽出为 `HeapDetail`
  （渲染等价，DOM 序不变）；共享 `ItemIdFlagDetail`；legend 增 special/meta 色签（仅当
  fields 含该 region，heap 输出不变）；空态文案由调用方 `emptyStateText` 控制；
  选中/hex 联动/32B 网格逻辑零改动。
- App.tsx：`fields` memo 按 pageView.kind 派生；btree 三联区接入（结构图+hex+双向高亮）；
  metapage/空叶页空态说明（非错误）；索引 Refresh 计算字节 diff。
- styles.css：`--region-special = color-mix(accent 20%, surface)`、
  `--region-meta = color-mix(region-header 60%, region-free)`，light/dark 各定义一次；
  cell 渐变/左条纹与 legend 同构。
- HexDump.tsx：零改动（`git diff` 为空验证；free 折叠对 btree 同样适用，special 区
  8176..8192 属 cells 正常渲染）。

### 验证（T6）

```bash
pnpm --filter web test        # 52 passed（+12 diff.test.ts）
pnpm -r typecheck / -r build  # 全绿
pnpm test                     # 全仓回归：13/52/31/52 全绿（既有 web 测试零改动）
```

diff.test.ts 以 page-core `resolveFieldAt`/旧粗粒度 id 语义为 parity oracle（heap 0..4095
逐字节对照），另覆盖 btree special/meta/tuple 命中与 diff。

## T7 — 详情面板 special/meta/tuple（2026-08-28）

提交 `64da04b`。触碰：`indexDetail.ts`（新）、`IndexTupleDetail.tsx`（新）、
`StructureMap.tsx`（BtreeStructureDetail 分支）、`App.tsx`、`styles.css`、
`indexDetail.test.ts`（新）。

- indexDetail.ts（纯函数）：`formatBytesPreview`（64B 截断+全长计数）；`tInfoRows`
  （size=低13位；ALT 0x2000 按D3 区分 posting/pivot；VAR 0x4000；NULL 0x8000 独立【D2】）；
  `tidRole`（internal→child、leaf→heap、posting/pivot/deleted/half-dead→none+替代说明，
  ui-design「t_tid 语义被覆盖不跳转」）；`metapageRows`（六字段；btm_allequalimage 仅
  v4+【D1 偏移 64 由 parser 冻结】）；`findTupleBySelection`。
- IndexTupleDetail：`lp[N] index tuple · itemoffset M` + hikey/pivot/posting×N 低饱和徽标；
  t_tid 语义行（按钮位 T8 接线）；itemlen+t_info hex；t_info 位「值+语义行」列表（不造
  第二套位格条）；键字节按钮（点击→选中→hex 高亮）；posting TID 滚动列表
  （max-height 160px，计数完整；解析失败时 ⚠ 且计数保留）。
- BtreeStructureDetail：special 五字段行（值+range，可点选→hex 联动）；选中 btpo_flags 时
  复用 `FlagBitStripSolo` 位格条（hover/聚焦 tip + `?` 全量参考，合同同 pd_flags 基线）；
  metapage 字段行 + magic 不符 ⚠；ItemId 复用 ItemIdFlagDetail；header 字段走面板头。
- App.tsx：解析警示条（结构区上方，warning 色，非 error-panel，文案
  「页数据异常：…；可解析部分照常展示」）；--warning token 双主题定义。

### 验证（T7）

```bash
pnpm --filter web test        # 67 passed（+15 indexDetail.test.ts）
pnpm -r typecheck / -r build  # 全绿
pnpm test                     # 13/52/31/67 全绿
```

## T8 — 块导航与 heap TID 跳表（2026-08-28）

提交 `00be322` + hint 位置修正 `f0ad576`。触碰：`blockNav.ts`（新）、
`StructureMap.tsx`、`IndexTupleDetail.tsx`、`App.tsx`、`styles.css`、
`blockNav.test.ts`（新）。

- blockNav.ts（纯函数）：`siblingNav`（btpo_prev/next；P_NONE=0 → null +
  leftmost/rightmost 标注）；`resolveJumpTable`（目标表可见性）；`heapJumpError`
  （TABLE_NOT_LISTED 可读反馈：含 oid 与所属表名 + 下一步）。
- BtreeStructureDetail：btpo_prev 行旁「← Load blk N」、btpo_next 行旁「Load blk N →」
  （P_NONE 时禁用并显示 ← leftmost / rightmost →）；meta 行「→ Load root」/
  「→ Load fastroot」。
- IndexTupleDetail：internal t_tid「Load child blk N」；leaf t_tid「在所属表打开 blk N」；
  posting TID 行可点（title=在所属表打开该块 P1-3）。
- App.tsx：`loadIndexBlock`（同索引导航，保留输入侧上下文）；`jumpToHeap(tableOid, blkno)`
  （kind 切表 + 选中表 + resetPageView + 加载；表不在列表→TABLE_NOT_LISTED，不静默失败）。

### 验证（T8）

```bash
pnpm --filter web test        # 74 passed（+7 blockNav.test.ts）
pnpm -r typecheck / -r build  # 全绿
pnpm test                     # 13/52/31/74 全绿
```

## 本批（T5–T8）汇总验证

```text
pnpm test            → wal-core 13 · page-core 52 · server 31 · web 74，全绿
pnpm -r typecheck    → 4 包 Done（零错误）
pnpm -r build        → 4 包 Done
```

HexDump 零改动、heap 解析语义与 /api/tables/* 合同零触碰（git diff 范围仅 web/src 新增与
App/StructureMap/diff/styles；StructureMap/diff 泛化属纯签名扩展，既有 web 测试零改动、
断言语义不变）。

## 手测清单（T5–T8，供 QA/浏览器联调；均「待浏览器手测」）

前置：`pnpm dev:server` + `pnpm dev:web`，连接 PG16（含 pageview_fx.demo_dup_k_idx /
demo_uniq_k_idx 种子或任意 btree/hash 索引）。

1. 待浏览器手测｜选择：切「索引」→ 列表 spinner → 四要素 option；切回「表」→ 现状路径不变。
2. 待浏览器手测｜非 B-tree 拦截（P0-2）：选中 hash 索引 → inline hint（danger、含 am 名）
   + Load 禁用；DevTools Network 无 /api/indexes/:oid/pages/* 请求。
3. 待浏览器手测｜meta/leaf/internal 加载：blkno 0 → meta 徽标 + ItemId 空态说明；
   root/leaf 页 → internal·LN/leaf 徽标 + special 色签 + legend。
4. 待浏览器手测｜选中/hex 联动（P0-9）：点 btm_root/btpo_prev/任一 tuple 字段 → hex 高亮
   + 滚动定位；hex 点击 → 反向选中详情。
5. 待浏览器手测｜详情：btpo_flags 位格条（hover/聚焦 tip、? 参考）；metapage 六/七字段
   （v4 含 allequalimage）；tuple 的 t_tid 语义/t_info 位/键字节截断/posting 列表滚动计数。
6. 待浏览器手测｜导航/跳表（P1-1/P1-3）：←/→ Load blk（P_NONE 禁用+leftmost/rightmost）；
   Load root/fastroot；internal 子页 Load child；leaf TID/posting 行点击切表加载。
7. 待浏览器手测｜Refresh diff（P1-4）：加载索引页 → 改表数据（INSERT/UPDATE）→ Refresh →
   字节 diff 高亮（同 heap 形态）。
8. 待浏览器手测｜切换清除（P0-12）：索引↔表↔另一索引 → 旧页/选中/高亮/diff 清除，
   元信息条随新关系刷新。
9. 待浏览器手测｜light/dark（P1-5）：special/meta 区、徽标/芯片、警示条两主题可辨读。
10. 待浏览器手测｜invalid 索引：列出且带 · invalid 徽标，Load 可用。

补充说明（无法自动化项的处置）：React 接线、视觉呈现（配色/徽标/位格条/空态/主题）
无组件测试基建，均归入上表手测；可纯逻辑化的部分（文案、门控、位语义、导航目标）
已全部抽取为 .test.ts 覆盖（本批 +54 例）。option 的 title tooltip 在 Chromium 下不
显示（浏览器限制，Firefox 可见）——四要素文案本体在 option 文本内，信息不丢失。

# Dev Notes: index-viewer

> Developer 实施记录（T1–T10 逐任务追加；T1–T10 已全部完成）。
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

## T9 — 集成冒烟与 CI（2026-08-28）

提交 `2b35e8e`（含 T4 后遗留的未提交接线：server devDep `page-core` + lockfile +
parseBtreePage import）。触碰：`apps/server/src/integration-smoke.ts`、
`apps/server/package.json`、`pnpm-lock.yaml`；**`.github/workflows/ci.yml` 零改动**
（B-tree 段种子自包含，integration job postgres:16 + 超级用户 + 双扩展已具备全部前置）。

### 种子策略（自建、幂等、自清理）

- 专用 schema `pageview_smoke_ix`：入口 `DROP SCHEMA IF EXISTS … CASCADE` 保幂等，
  finally 块内再 DROP（验证连跑两次退出 0，事后探针确认无残留 schema）；不依赖库中
  任何既有对象（规避 T4 记录的「连接目标可能是 postgres 或 jason 库」双目标风险）。
- `uq`（50000 唯一 int 键）→ `uq_k_idx`（btree，多层树：root=3 level=1 内页）+
  `uq_k_hash`（hash，守卫 oracle）；`dup`（30000 行重复键）→ `dup_k_idx`，重复度
  [50,10,2] 逐级重试直到产生 posting（实跑首轮 g%50 即命中 blk26：11 posting/1272 TIDs）。
- PG13+ 版本门控（dedup 前置）：低于 13 退出 2（blocked 语义沿既有：环境缺失=2，
  断言失败=1）。

### B-tree 段断言与实跑输出（`pnpm test:integration` 退出 0）

```text
B-tree list OK: 68 indexes; seeds btree x2 (valid=true) + hash x1
B-tree metapage OK: pageview_smoke_ix.uq_k_idx blk0 (v4 root=3 level=1 allequalimage=true)
B-tree internal OK: pageview_smoke_ix.uq_k_idx blk3 (level=1, 137 downlinks)
B-tree leaf OK: pageview_smoke_ix.uq_k_idx blk1 (367 tuples, hikey first)
B-tree posting OK: pageview_smoke_ix.dup_k_idx blk26 (11 posting tuples, 1272 TIDs)
hash guard OK: 400 INDEX_NOT_BTREE (message mentions "hash")
B-tree smoke seed cleaned up (schema dropped)
L3 smoke OK: public.items blk 0 length=8192        ← heap 段不回退
R1 schema placeholders OK (1 dropped)
B-tree segment OK: list/metapage/internal/leaf/posting oracle + hash guard
```

断言明细：①列表每项含 boolean `valid` 且种子 btree 项 valid=true、am/tableQualifiedName/
blocks 正确；②metapage 六字段+allequalimage 与 `bt_metap` 逐字段相等且无解析警示；
③内页（btm_root 导航）：special 五字段==`bt_page_stats`、逐元组 itemoffset/ctid/
itemlen/nulls/vars==`bt_page_items`、全部 pivot 且子页块号>0；④普通叶页（非最右）：
同上逐字段+首元组 hikey（P0-7）、postingTupleCount=0；⑤posting 叶页：逐元组比对+
每 posting count>1 且 TID 列表与 oracle tids 逐项相等、全页 TID 总数==oracle 总和
（P0-8）；⑥hash 索引经 API 取页→400 `INDEX_NOT_BTREE`、message 含 "hash"、
nextStep 非空（P0-3）。

### 无效索引断言的简化（偏离 plan T9 原文，已授权的推荐做法）

Plan 原文「无效索引断言列表 `valid=false`」无法在不变更目录/不越权的前提下实现：
PG 无 `CREATE INDEX … INVALID` 语法，`REINDEX`/`UPDATE pg_index` 属 catalog 写入
（spec 禁止 server 端预判 SQL 改动；smoke 亦不应改系统目录）。采用任务指示的简化：
断言列表响应的 `valid` 字段契约（每项必有 boolean）+ 种子索引 valid=true，
`valid=false` 的渲染路径（`· invalid` 徽标，T5 indexView.canLoadIndex 允许加载）
由 L2 单测覆盖。风险：低（字段映射直通 `indisvalid`，T4 catalog 契约测试已锁 SQL）。

## T10 — 文档与交接（2026-08-28）

- `README.md` / `README.zh-CN.md` 双语同步：Features 新增「Index pages (B-tree)」/
  「索引页（B-tree）」小节（索引浏览/页面类型/高键与 posting/块导航/拦截）；Scope 改写
  「No (non-B-tree) indexes, FSM/VM, or system catalogs」；Requirements 标注索引浏览仅
  B-tree（建议 PG13+）；Quick start「table or index + blkno」；Development 的
  test:integration 注释更新；Troubleshooting 增 `INDEX_NOT_BTREE`。双语逐节对应。
- `packages/page-core/fixtures/README.md`：T2 已完整覆盖（--index 捕获步骤、四场景表、
  种子草图、PG13+ dedup 说明），本轮仅核对，零改动。
- 本 dev-notes 收尾（本节）。

## T1–T10 汇总：三层证据状态

| 层 | 状态 | 证据 |
|---|---|---|
| L2 | 全绿 | `pnpm test` 13/52/31/74（共 170）；`pnpm -r typecheck` 4 包零错误；`pnpm -r build` 4 包 Done（末批复跑见上） |
| L3 | 退出 0 | `pnpm test:integration`：heap 段不回退 + B-tree 段六组断言全过（本节输出）；CI integration job 同口径自动执行（种子自包含） |
| 手测 | 待浏览器手测 | 上文「手测清单（T5–T8）」10 项均未执行（无浏览器联调环境）；前置 `pnpm dev:server` + `pnpm dev:web` |

### 遗留风险（全量）

1. **v3 metapage 仅 synthetic 覆盖**：本地 PG16 与 CI 均只产 v4；v3（无 allequalimage）
   路径依赖 `buildBtreePage` v3 单测（design §4 已列为已知缺口，spec 裁决 5 明确支持
   但验收以现役环境为准）。
2. **手测 10 项未执行**：UI 呈现（徽标/位格条/空态/主题/导航点击/跳表/diff）待
   QA 或用户浏览器补测；恢复条件与清单见上表。
3. **环境双连接目标**：smoke 已自建种子规避（本批）；不影响其他路径。
4. option title tooltip 在 Chromium 不显示（T5 记录，浏览器限制非缺陷）。

### 给 Reviewer 的建议阅读顺序

1. `spec.md` 验收 P0-1..P0-12 / P1-1..P1-5 对照 `design.md` §1–§4（方案 A 导出面约束、
   路由守卫序、布局常量表 + D1–D4 偏差）与 `ui-design.md`；
2. 提交序列（5b71d55→2b35e8e，每任务一提交）按 T3→T4→T5→T6→T7→T8→T9 浏览；
3. 数据层：`packages/page-core/src/btree.ts`（常量区头部注释含 oracle 冻结依据）→
   `tests/btree-oracle.test.ts`（四场景实捕 oracle）→ `src/btree-structure.ts`；
4. 服务层：`apps/server/src/catalog.ts`（两条 SQL）→ `app.ts` /api/indexes*
   （校验序①→④）→ `tests/indexes.test.ts`；
5. web 层：`api.ts`/`indexView.ts` → `App.tsx`（pageView union/resetPageView/
   loadIndexBlk/jumpToHeap）→ `StructureMap.tsx`+`diff.ts` 泛化（heap 等价性）→
   `IndexTupleDetail.tsx`/`indexDetail.ts`/`blockNav.ts`；
6. L3：`apps/server/src/integration-smoke.ts` B-tree 段（本节输出为实跑证据）；
7. 文档：双语 README 与本 dev-notes 的 D1–D4 偏差表。

heap 零回退硬约束的全局证据：`parse.ts` 仅加 export、heap 测试文件零改动、
HexDump 零改动、/api/tables/* 合同零触碰（git diff 范围可核）。

---

## QA 轮次 1 缺陷修复回执（2026-08-31）

依据 qa-report.md 轮次 1 结论 Fail（DEF-1 Open 退回 Developer；DEF-2 已确认·建议后续小项）。

### DEF-1（Medium）metapage 伪 ItemId — 已修复

- **处理结果**：已修复（单提交，Conventional Commits：
  `fix(page-core): treat metapage as zero items per nbtree semantics`）。
- **修复摘要**：实现层选在 **`parseBtreePage`（packages/page-core/src/btree.ts）**：
  ItemId 数组读取移到页分类之后，`pageType === "meta"` 时按 nbtree 语义置 0 ItemId
  （真实 PG16 metapage pd_lower 越过 BTMetaPageData 内容，v4=72，泛型读取器会把
  [24..72) 误读为 12 个伪 ItemIdData）。选解析层的理由：ItemId 数组属页字节语义
  （该区间在 meta 页是 BTMetaPageData 而非 ItemIdData[]），在此单点修复可同时保证
  ParsedBtreePage（itemIds、stats.itemIdTotal/lp* 计数）与结构字段派生、web 元信息条
  （读 `stats.itemIdTotal`）三者一致，web 端零代码改动（空态文案 App.tsx 对 meta 页
  无条件提供，ItemId 计数随 stats 归零）。附带消除 QA 指出的 synthetic 盲区：
  `fixture-builder.ts` 的 buildBtreePage meta 页 pd_lower 改为真实布局
  （v4=24+48=72 / v3=64，与实捕 fixture 一致），synthetic meta 测试不再能隐藏同类缺陷。
- **TDD 证据（先红后绿）**：先用实捕 fixture
  `packages/page-core/fixtures/btree-meta.base64.txt`（真实 pd_lower=72）新增 4 例回归：
  - 红（修复前）：page-core `tests/btree.test.ts` →
    `× treats the metapage as zero ItemIds … → expected [ …(12) ] to have a length of +0 but got 12`；
    web `apps/web/src/diff.test.ts`（反向选中）→
    `× … itemIdTotal → expected 12 to be +0`、`× offset 24: expected 'itemid' to be 'meta'`
    （即 DEF-1 特征：offset 32 命中伪 itemid-2 而非 btm_root）；
  - 绿（修复后）：上 4 例全过（六字段+allequalimage 反向选中命中、无 itemid 字段、
    stats 归零、[48..64) cleanup 区不再命中伪 itemid——该区未建模为可点字段，null 为
    预期非缺陷）。
- **验证证据**：
  - `pnpm test` → wal-core 13 · page-core 54（52+2）· server 31 · web 76（74+2）
    共 **174 全绿**（既有 170 零回退）；
  - `pnpm -r typecheck` → 4 包 Done；`pnpm -r build` → 4 包 Done；
  - `pnpm test:integration` → **退出 0**（B-tree 段六组断言全过含 metapage oracle）。
- **建议复测范围**：P0-4（metapage 展示：元信息条 ItemId=0/空态文案/六+1 字段）、
  P0-9（metapage hex 双向联动：实捕或真实页 [24..48) 反选 btm_magic/version/root/
  level/fastroot/fastlevel、64 反选 allequalimage）、DEF-1b/c（结构图无伪 ItemId 段）、
  实捕 fixture 反向选中回归（本轮已自动化）；浏览器补证归入轮次 2 手测清单项 3/4。

### DEF-2（Low）非数字 oid → 400 BAD_LSN — 不修复（已确认处置）

- **处理结果**：不修复。理由：QA/Reviewer 均已确认非本项回归——与既有
  `/api/tables/abc` 同型行为，而「修改 `/api/tables/*` 既有合同」属本项 spec 明确
  非目标；单独为 /api/indexes 加守卫会造成两端行为分叉。风险：低（错误仍为 400
  形状，仅 code/nextStep 误导）。恢复条件/后续建议：另立独立小工作项，为两组端点
  统一加 `Number.isFinite(Number(oid))` 守卫（即 Reviewer F1）。

## UI 文案英文化变更回执（2026-08-31，需求变更：QA Pass 后、合并授权前）

依据：spec.md 修订记录 2026-08-31 + ui-design.md「修订附页：英文文案表（权威）」。
仅替换用户可见字符串（含 main 既有「未连接」→ `Not connected`，用户直接授权微扩），
不改逻辑/结构/样式；文案逐条取自英文文案表。

- **变更范围（8 文件）**：
  - `apps/web/src/indexView.ts` — 非 B-tree option title ×2、inline hint；
  - `apps/web/src/indexView.test.ts` — 3 处断言期望文案同步（结构不变，非弱化）；
  - `apps/web/src/blockNav.ts` — 跳表失败 message/nextStep（`（所属表 X）`→` (owning table X)`）；
  - `apps/web/src/indexDetail.ts` — t_info ALT/VAR/NULL 位说明 ×4、t_tid 角色 note ×4；
  - `apps/web/src/IndexTupleDetail.tsx` — internal/leaf 角色、跳表按钮、键字节
    title/label/(empty)/截断计数、posting 标题、TID 行 title、解析失败警示；
  - `apps/web/src/StructureMap.tsx` — special 不可读、btm_magic 警示（0x053162）；
  - `apps/web/src/App.tsx` — Table/Index 分段、空索引 option+panel、初始空态、
    加载提示、页数据异常警示、metapage/空叶页空态、Not connected；
  - `apps/web/src/diff.test.ts` — 注释英文化（顺手）。
- **grep 残留结论**：`grep -rPn '[\x{4e00}-\x{9fff}]' apps/web/src --include='*.ts'
  --include='*.tsx'` → **0 命中**（用户可见=0，注释亦清零）；全角标点复查亦 0。
- **验证证据**：`pnpm test` → wal-core 13 · page-core 54 · server 31 · web 76 共
  **174 全绿**；`pnpm -r typecheck` exit 0（4 包）；`pnpm -r build` 成功（web dist 产物）；
  `pnpm test:integration` → **退出 0**（B-tree 段 + hash guard + L3 smoke 全过）。
- **建议复测范围（QA 轮次 3）**：文案断言核对（对照 ui-design 英文文案表逐条）；
  P0-2 hint 语言（含 option title / Load 禁用 title）；空态/警告语言（空索引列表、
  初始空态、metapage/空叶页空态、页数据异常/special/magic/posting 警示、TABLE_NOT_LISTED
  跳表失败）；Not connected；既有回归（heap 路径、hex/diff、两主题）。

## DEF-3 修复回执（2026-08-31，QA 轮次 3）

- **缺陷**：DEF-3（Low）— `apps/web/src/StructureMap.tsx:696` metapage hint 残留全角括号
  U+FF08/FF09（`metapage（PageGetContents @24）· v{...}`），296dc44 文案英文化漏改。
- **处理结果**：已修复 — `metapage（PageGetContents @24）· v{...}` →
  `metapage (PageGetContents @24) · v{...}`（仅全角括号→半角 ASCII 括号，`·` U+00B7 与
  其余文本不动）。单行文案变更，无逻辑/结构/样式改动。
- **复查命令与结论**：`grep -rPn
  '[\x{ff01}-\x{ff5e}\x{3000}\x{2018}\x{2019}\x{201c}\x{201d}]' apps/web/src
  apps/web/*.html`（CSS 经 find 展开）→ **0 命中**；未发现其它用户可见全角残留。
- **验证证据**：`pnpm test` → server 31 · web 76 共 107 全绿（page-core/wal-core 本轮
  输出未含，上一回执已 174 全绿）；`pnpm -r typecheck` → 4 包全部 Done、exit 0。
  单行 JSX 文案变更，不触及 server/API/page-core，integration 不受影响。
- **建议复测范围**：StructureMap metapage hint 显示（选中 metapage 顶部提示行，
  两主题）；全角字符扫描复测（同上 grep 命令）；L2 回归（index-viewer 结构面板
  其余 hint/字段行显示不受影响）。

## 变更 2 回执：Index 模式选择交互重构（2026-08-31，QA 轮次 4 Pass 后、合并授权前）

依据：spec.md 修订记录变更 2 + ui-design.md「修订附页 2：Index 模式选择交互（权威）」。
纯 client 过滤，API/server/page-core 零改动。

- **触碰文件（3）**：
  - `apps/web/src/indexView.ts` — `IndexRowLike` 增 `oid/tableOid`；新增纯函数
    `filterIndexesByTable`（null=All tables → 全列；否则 tableOid 匹配）、
    `indexSelectionSurvives`（规则 1 重置判定）；`formatIndexOption`/`indexOptionTitle`
    增可选 `omitTableSuffix` 模式（过滤态去 `· → 所属表` 后缀，title 同步）；
  - `apps/web/src/App.tsx` — Index 模式 chrome 增 table 过滤器 select（置于 index
    select 前，默认项 `All tables`，title=`Filter indexes by table`，复用 tables
    数据源）；index select 改列 `filteredIndexes`；`onSelectIndexFilter`（仅过滤不
    加载）；`onSwitchRelationKind` 增过滤存活复核；主区空态按过滤结果门控并补
    `No indexes for this table` 面板；
  - `apps/web/src/indexView.test.ts` — 增 11 用例（过滤集合 ×3、存活判定 ×3、
    过滤态 option 文案 ×3、过滤态 title ×2）；既有断言零改动。
- **修订附页 2 五条规则逐条落实**：
  1. 过滤器/分段控件切换重置 — `onSelectIndexFilter` 与 `onSwitchRelationKind`
     均先 `resetPageView()`（page/selected/highlight/diff，P0-12 同语义）；
     `indexSelectionSurvives`=false 时再 `setSelectedIndexOid(null)`；存活则保留
     index 选择；
  2. 过滤后无索引 — placeholder 禁用项 `No indexes for this table` + index select
     整体禁用 + Load 因 `selectedIndex==null` 禁用（不发请求）；
  3. 过滤选择复用 `selectedOid`（与 Table 模式同一状态）：Index 模式仅作过滤输入
     不加载；切回 Table 模式自然保留为普通表选择（输入态，不自动加载）；
  4. 文案表增补三项落地 — `All tables`（默认项）、`No indexes for this table`
     （option+主区面板）、`Filter indexes by table`（过滤器 title）；
  5. 选项文本简化 — 浏览全部态保留 `· → 所属表` 后缀（P0-1 四要素）；过滤态
     `omitTableSuffix` 去后缀（仅改 indexView 文案拼接一处 + 接线传参）。
- **Table 模式零改动**：kind=table 分支 JSX/handler 未动；`onSelectTable`/`loadBlk`
  原样；既有 heap 测试断言零改动全绿。
- **TDD 证据**：先写 11 用例 → 红（9 failed/17 passed）→ 实现 → 绿（26/26）。
- **验证证据**：`pnpm test` → wal-core 13 · page-core 54 · server 31 · web **87**
  （76+11）共 **185 全绿**；`pnpm -r typecheck` 4 包 Done exit 0；`pnpm -r build`
  4 包 Done（web dist 产出）；`pnpm test:integration` → **退出 0**（B-tree 段 +
  hash guard + L3 smoke 全过，不受影响已确认）；CJK/全角扫描
  `grep -rPn '[\x{4e00}-\x{9fff}]'` 与 `[\x{ff01}-\x{ff5e}\x{3000}\x{2018}-\x{201d}]`
  （apps/web/src + apps/web/*.html）→ **0 命中**。
- **建议复测范围（QA 轮次 5）**：P0-1（All tables 平铺四要素 vs 过滤态去后缀 +
  title）；过滤器切换重置语义（所选 index 被滤掉→重置；仍在→保留但页视图清除）；
  无索引表（`No indexes for this table` option + Load 禁用）；Index→Table 切回
  过滤选择保留为输入态不自动加载；Table 模式回归（chrome/加载/hex/diff 零变化）；
  两主题下新控件渲染。

## 变更 3 回执：Index 模式选择交互细化（2026-08-31，QA 轮次 5 Pass 后、合并授权前）

依据：spec.md 修订记录变更 3 + ui-design.md「修订附页 3（权威，取代附页 2/F7 冲突处）」。
纯 client 变更，API/server/page-core 零改动。

- **触碰文件（3）**：
  - `apps/web/src/indexView.ts` — 删除 `IndexOptionMode`/`omitTableSuffix` 分支：
    `formatIndexOption` 双态统一 `qualifiedName (am · N blk)`（✕ 前缀 / ` · invalid`
    后缀沿附页 1）；`indexOptionTitle` btree 有效分支统一裸 `qualifiedName`；新增纯函数
    `tablesWithIndexes`（tableOid 去重、含仅非 B-tree 索引表、按 qualifiedName 稳定排序、
    oid 决胜）与 `tableFilterOptions`（首位空默认选项 `{tableOid: null, label: ""}` =
    不过滤）；
  - `apps/web/src/App.tsx` — table 过滤器选项源由 `tables` 改为
    `tableFilterOptions(indexes)`（首项空选项，无「All tables」文本）；禁用条件随数据源
    改为 `indexes.length === 0 || loading-indexes`；4 处 `omitTableSuffix` 传参全部去除
    （option 文本/title/Load 按钮 title/select title）；title 沿
    `Filter indexes by table`；
  - `apps/web/src/indexView.test.ts` — 既有四要素/后缀断言按变更 3 合同改写（双态均无
    后缀、title 双态裸限定名，属需求合同修订非弱化）；新增 `tablesWithIndexes` ×4
    （去重/含非 B-tree 表/排序/空输入）、`tableFilterOptions` ×2（空默认首位/仅空默认）；
    Table 模式与 heap 既有断言零改动。
- **附页 3 五条规则逐条落实**：
  1. table 过滤器无「All tables」文本项，`tableFilterOptions` 首位空选项为默认
     （空=不过滤=全部索引），选项仅含拥有索引的表（client 自 indexes 派生去重，含仅
     非 B-tree 索引表）；title `Filter indexes by table` 不变；
  2. option 文本全量/过滤态均 `schema.name (am · N blk)`，无归属段；✕/invalid 标记沿附页 1；
  3. btree 有效 title 双态均为 `qualifiedName`；非 B-tree/invalid title 沿附页 1 不受过滤影响；
  4. 「No indexes for this table」option 禁用项 + 主区面板 + Load 禁用保留为防御路径；
  5. 重置/存活（`onSelectIndexFilter`/`onSwitchRelationKind` + `indexSelectionSurvives`）、
     过滤不加载、Table 模式零改动均沿附页 2 未动。
- **TDD 证据**：先改/增测试 → 红（web 15 failed/78 passed）→ 实现 → 绿（93/93）。
- **验证证据**：`pnpm test` → wal-core 13 · page-core 54 · server 31 · web **93**
  （87 基线 +6 净增）共 **191 全绿**；`pnpm -r typecheck` 4 包 Done exit 0；
  `pnpm -r build` 4 包 Done（web dist 产出）；`pnpm test:integration` → **退出 0**
  （B-tree 段 + hash guard + L3 smoke 全过）；CJK/全角扫描（apps/web/src +
  apps/web/*.html，`[\x{4e00}-\x{9fff}]` 与
  `[\x{ff01}-\x{ff5e}\x{3000}\x{2018}-\x{201d}]`）→ **0 命中**。
- **建议复测范围（增量，QA 轮次 6）**：P0-1（option 双态均无归属后缀 + btree 有效
  title 裸限定名）；table 过滤器（默认空选项可反选=全部索引；仅列有索引的表，含仅
  hash/gin 索引的表；无「All tables」字样；title）；过滤器选项与 Table 模式表列表
  数据源分离后各自正确；重置/存活、`No indexes for this table` 防御路径、Table 模式
  回归（chrome/加载/hex/diff 零变化）；两主题渲染。

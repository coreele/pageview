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

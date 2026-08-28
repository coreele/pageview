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

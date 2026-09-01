# QA Report: index-viewer

## 轮次

| 轮次 | 日期 | 范围 | 结论 |
|---|---|---|---|
| 1 | 2026-08-31 | 首测：L2/L3 复跑 + P0-1..P0-12 / P1-1..P1-5 独立验收 + 实库 API/oracle 取证 + Reviewer 发现项核对 + 文档验收 | Fail |
| 2 | 2026-08-31 | 回归：DEF-1 复测（活库探针 + 实捕 fixture）+ P0-4/P0-9 受影响面 + internal/leaf ItemId 无回退 + L2/L3 复跑 + DEF-2 状态核对 + 手测清单状态维持 | Pass |
| 3 | 2026-09-01 | 需求变更验收（UI 文案英文化，296dc44）：CJK 扫描 + 文案表抽样 22 条 + 断言核对 + L2/L3 回归 + DEF-1 维持性 | Fail |
| 4 | 2026-09-01 | DEF-3 复测（6bf5191：现值 + 全仓全角/CJK 扫描）+ 最终回归（test/typecheck/build/integration）+ DEF 矩阵维持性核对 | Pass |
| 5 | 2026-09-01 | 需求变更 2 验收（Index 模式选择交互重构，f8e650b）：修订附页 2 五条规则 + P0-1 双态口径（实库探针 20 断言）+ 四命令回归 + DEF 维持性 | Pass |
| 6 | 2026-09-01 | 需求变更 3 验收（选择交互细化，66c595f）：附页 3 五条规则 + P0-1 再修订口径（活库探针 95 断言）+ UI 接线代码级 + 四命令回归 + DEF 维持性 | Pass |
| 7 | 2026-09-01 | 需求变更 4 验收（heap TID 跳转改只读浮层，2463576）：七点合同 + 附页 4 四规则（活库探针 27 断言 + 代码级）+ 四命令回归 + R6-1 登记 + DEF 维持性 | Pass |

## 环境与命令

- 实现：分支 `index-viewer`（1699937..9dab98a，11 提交）；Node 24.19.0；本地 PostgreSQL 16.11（socket /tmp，pageinspect 已启用）；`.env` 连接（内容未打印）。
- L2 复跑（全部退出 0）：
  - `pnpm test` → wal-core 13 · page-core 52 · server 31 · web 74，共 170 全绿；
  - `pnpm -r typecheck` → 4 包零错误；`pnpm -r build` → 4 包 Done。
- L3 复跑：`pnpm test:integration` → **退出 0**。B-tree 段六组断言全过（list 68 / metapage v4 root=3 / internal 137 downlinks / leaf 367 tuples hikey first / posting 11 tuples·1272 TIDs / hash 400 INDEX_NOT_BTREE）；heap 段不回退；种子清理独立复核（postgres/jason 两库 `pageview_smoke%` schema 均无残留）。
- QA 独立实库取证（不依赖 Developer/Reviewer 自述）：自建 `qa_iv_probe` 探针 schema（btree 多级树 + 重复键 posting + hash 守卫，验后已清理，索引数回基线 65）；起真实 server（PORT=8791/.env 目标库）curl 实测 API；以 pageinspect（bt_metap/bt_page_stats/bt_page_items）为 oracle 自写对照脚本逐字段/逐 TID 断言；hex 反向选中以 `findStructureAt` 源码语义复算。
- 无浏览器环境：UI 视觉/交互项标注「未核验-无浏览器」，见风险与恢复条件。

## 覆盖（对照 plan 最低验证层 + spec 验收）

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| L2 | pnpm test / typecheck / build | 通过 | 170 全绿；4 包零错误；4 包 Done（本轮复跑） |
| L3 | test:integration 退出 0 + B-tree oracle + hash 守卫 + heap 不回退 + 种子清理 | 通过 | 本轮复跑输出；两库无 schema 残留 |
| P0-1 | 索引发现 | 通过（API/数据层） | 实测 `/api/indexes` 68 项 == catalog 直查口径（relkind='i' + am/pg_index join、系统/temp schema 排除 0 泄漏、blocks==pg_relation_size/8192、按 schema,name 排序、8 字段形状含 valid）；hash 项可见可列出。option「✕/·invalid」标记渲染未核验-无浏览器（文案逻辑 indexView 单测过） |
| P0-2 | 非 B-tree 客户端反馈 | 部分核验（逻辑通过） | `canLoadIndexBlk`（state 门控）+ `triggerLoadIndex`（触发守卫）双重禁发请求；hint 文案含 am 名与下一步（单测）。按钮禁用视觉与 Network 静默运行时未核验-无浏览器 |
| P0-3 | 服务端守卫 | 通过 | 实测 hash oid → 400 `INDEX_NOT_BTREE`（非 5xx），message 含 "hash"，nextStep 指向 btree/表；hash+坏 blkno 实测仍 ②优先（先于 ③） |
| P0-4 | metapage 展示 | 未通过（DEF-1） | 六+1 字段与 `bt_metap` 独立逐项一致（magic 340322/version 4/root 3/level 1/fastroot 3/fastlevel 1/allequalimage true）、无解析警示；但真实 PG16 metapage pd_lower=72，[24..72) 的 BTMetaPageData 被泛型读为 12 个伪 ItemId（含 1 伪 REDIRECT），空态文案「metapage：无 ItemId」与渲染矛盾（DEF-1b/c） |
| P0-5 | 叶页展示 | 部分核验（数据通过） | qa 探针叶页 367 元组 itemoffset/ctid/itemlen/nulls/vars 与 `bt_page_items` 独立逐项一致；special==bt_page_stats；leaf 徽标/位格条视觉未核验-无浏览器 |
| P0-6 | 内页展示 | 部分核验（数据通过） | root（level=1）137 元组逐项==oracle；isRoot 派生正确；t_tid 呈现语义==oracle ctid（含 minus-inf (1,0)）；internal 徽标视觉未核验 |
| P0-7 | 高键标记 | 部分核验（数据通过） | 独立正反例：非最右叶页首元组 isHikey=true 且其余 false；最右 root 首元组无 hikey（与 oracle 一致）。徽标视觉未核验 |
| P0-8 | posting list | 部分核验（数据通过） | 探针 posting 叶页 9 个 posting 元组 TID 列表与 oracle tids 逐项、顺序一致；postingTidCount 1128==oracle 总和。徽标/滚动列表视觉未核验 |
| P0-9 | hex 双向联动 | **未通过（DEF-1）** | leaf/internal 正常：offset 8176/8188/8190/元组 t_tid 反向选中命中 special.btpo_*/tuple-N.t_tid（独立复算 findStructureAt）。**metapage 失败**：真实页与仓库实捕 fixture btree-meta 均复现 [24..64) 反向选中命中伪 itemid-0..9（如 offset 32→itemid-2），永不命中 btm_magic/version/root/level/fastroot/fastlevel（仅 allequalimage@64 幸免）——违反「含 metapage 字段」合同。根因：测试盲区——diff.test.ts metapage 用 synthetic buildBtreePage（无伪 ItemId）而通过 |
| P0-10 | heap 不回退 | 通过 | parse.ts diff 仅 2 处加 export；HexDump.tsx 零改动；heap 测试文件零改动；L2 heap 32 例 + L3 heap 段全绿；实测 heap API 正常 |
| P0-11 | 错误合同 | 通过 | 实测：表 oid/不存在 oid→404 NOT_INDEX；blkno -1/1.5/abc→400 BAD_BLKNO；99999→400 BLKNO_OUT_OF_RANGE（含范围提示）；无 .env 实例→401 NOT_CONNECTED（两端点）；hash→400 INDEX_NOT_BTREE。全部 {code,message,nextStep} 形状 |
| P0-12 | 切换反馈 | 部分核验（逻辑通过） | `resetPageView()`（page/selectedId/highlight/prevRaw/diffIds/hexLocate）在 onSwitchRelationKind/onSelectIndex/jumpToHeap 调用点核验；元信息条按 pageView.kind 分支。运行时 UI 呈现未核验-无浏览器 |
| P1-1 | 块导航 | 部分核验 | loadIndexBlock/siblingNav（P_NONE→null+leftmost/rightmost 标注）/root/fastroot/child 按钮逻辑与单测过；点击交互未核验-无浏览器 |
| P1-2 | 特殊状态提示 | 部分核验 | pageTypeBadge/芯片派生（btpo_flags→root/deleted/half-dead/garbage/split-unfinished）逻辑与单测过；视觉未核验 |
| P1-3 | heap TID 跳转 | 部分核验 | jumpToHeap（kind 切表+选中+清除+加载；resolveJumpTable 不可见→TABLE_NOT_LISTED 可读反馈）逻辑与单测过；点击未核验 |
| P1-4 | Refresh diff | 部分核验 | diffByteRanges 零改动复用、structureAffectedByDiff 泛化含 meta/special（L2 12 例）；同页重拉 diff 为空的数据层验证过；视觉高亮未核验 |
| P1-5 | 主题可读 | 部分核验 | `--region-special/--region-meta/--warning` 在 styles.css light(:11-18)/dark(:45-52) 各定义一次，legend 色签/cell 渐变齐备；两主题实际可读性未核验-无浏览器 |

## UI/UX

| 检查项 | 结果 | 证据 |
|---|---|---|
| Spec 界面相关验收 | 数据/逻辑层核验如上矩阵；纯视觉呈现（徽标/位格条 hover·?/空态版式/滚动定位/双主题）未核验-无浏览器 | 见覆盖矩阵与风险 |
| `workflow/docs/standards/ui.md` 底线 | 通过（代码级） | 状态完整（初始/加载/空/成功/错误/部分失败警示条）；错误 code+message+Next；分段控件 aria-pressed/:focus-visible 沿用 |
| `ui-design.md` 状态与流程 | 部分不符 | metapage「ItemId 空区=无 ItemId/元组」合同被 12 个伪 ItemId 破坏（DEF-1）；其余控件层级/文案/键盘结构代码级一致 |

## 缺陷

| ID | 严重度 | 摘要 | 状态 |
|---|---|---|---|
| DEF-1 | Medium | 真实 PG16 metapage（pd_lower=72）上 BTMetaPageData 区 [24..72) 被泛型 ItemId 机制读为 12 个伪 ItemId。复现：加载任一真实 B-tree 索引 blkno 0（或解析实捕 fixture `btree-meta.base64.txt`）。期望（P0-9/P0-4/ui-design）：hex 点击 [24..64) 反选 btm_magic/version/root/level/fastroot/fastlevel，结构图 metapage 无 ItemId（空态文案），元信息条 ItemId=0。实际：①反向选中命中伪 itemid-0..9（如 offset 32→itemid-2），永不命中 btm_* 字段；②结构图 12 伪 ItemId 段与 7 meta 段同位碰撞（7 对），与空态文案「metapage：无 ItemId」矛盾；③元信息条显示 ItemId 12 (U11/R1)。单测用 synthetic metapage 故未拦截。修复建议：meta 页按 nbtree 语义置 0 ItemId（parseBtreePage 或 deriveBtreeStructureFields 层），并补实捕 fixture 反向选中回归测试 | **Closed**（修复 c30bf92 + Reviewer 复审 Approve + 轮次 2 复证：活库探针与实捕 fixture 43/43 PASS，见轮次 2 节） |
| DEF-2 | Low | 非数字 oid（/api/indexes/abc/pages/0）→ 400 `BAD_LSN` + WAL nextStep，误导；与既有 /api/tables/abc 同型（实测两端一致），spec 无此合同，非本项回归 | 已确认·建议后续小项统一加 Number.isFinite 守卫（即 Reviewer F1） |

Reviewer 发现项核对：F1（Low）= DEF-2，处置「后续小项」成立；F2（Low，cycleid 断言固定 0 无 oracle 列）属实，风险极低，留待后续补 VACUUM 场景；F3（Info，提交数 11）属实，无需动作；F4（Info，option title Chromium 不显示）属实，浏览器限制非缺陷，手测按 Firefox 或忽略。均不改变本轮结论。

dev-notes 手测清单 10 项状态：1 选择（API 层已核验；spinner/option 视觉未核验）；2 非 B-tree 拦截（逻辑核验；视觉/Network 未核验）；3 三页型加载（数据层核验；徽标/legend 视觉未核验；meta 页受 DEF-1）；4 hex 联动（leaf/special 数据层通过；metapage 因 DEF-1 失败；滚动定位未核验）；5 详情（数据/单测核验；位格条 hover·? 未核验）；6 导航/跳表（逻辑核验；点击未核验）；7 Refresh diff（逻辑核验；视觉未核验）；8 切换清除（代码核验；运行时未核验）；9 light/dark（token 核验；可读性未核验）；10 invalid 徽标（valid 契约+文案单测核验；视觉未核验）。

## 文档与安全

- 用户文档：README 双语（Features/Scope/Requirements/Quick start/Troubleshooting 含 INDEX_NOT_BTREE）逐节对应、fixtures README 含 --index 步骤与四场景表 → 通过。
- 运维文档：N/A（Plan 已声明，成立）。
- 安全：新增 SQL 只读 catalog 查询，oid/get_raw_page 参数化（$1/$2::int），HEAP_BLOCK_SIZE 为源码常量；无凭据接触、无外部依赖新增 → 通过，允许（修复后）合并。

## 结论（轮次 1）

- 总体: **Fail**
- 依据: qa.md「实现存在可修复的不符合项」。DEF-1 为确定性、数据层可复现的 P0-9 违反（metapage hex 反向选中），并破坏 P0-4/ui-design 的 metapage ItemId 空区语义；L2/L3 与其余 P0/P1 数据层验收均通过。纯 UI 视觉项未核验不构成本轮结论依据（关键验收已执行完毕并取得确定性失败证据，非 Blocked）。
- Developer 修复范围: `packages/page-core/src/btree.ts`（或 `btree-structure.ts`）metapage ItemId 语义 + `apps/web/src/diff.test.ts` 以实捕 fixture 补反向选中回归（顺带覆盖 DEF-1c 元信息条计数）。Review 门禁 required：修复后须重新取得 Reviewer Approve，再由 QA 在本报告追加轮次 2 回归（复测 DEF-1 + 受影响范围 P0-4/P0-9 + 手测清单浏览器补证）。
- 恢复条件: N/A（Fail 轮；浏览器手测与 DEF-1 复测归入修复后回归轮次）
- 合并: 不合并

---

## 轮次 2（回归验收，2026-08-31）

### 环境与范围

- 实现：分支 `index-viewer` tip = **c30bf92**（1699937..c30bf92 共 12 提交；修复提交后无新提交），修复范围与回执一致（btree.ts/fixture-builder/两测试文件/dev-notes）；Reviewer 复审 **Approve**（2026-08-31）。环境同轮次 1（本地 PG 16.11 socket /tmp、Node 24.19.0、`.env` 未打印）。
- 范围：DEF-1 复测（重点）＋受影响回归（P0-4/P0-9、internal/leaf ItemId 无回退、L2/L3 复跑）＋DEF-2 状态核对＋手测清单状态维持。依据 dev-notes 回执建议复测范围全部覆盖。

### DEF-1 复测（独立取证，不依赖 Developer/Reviewer 自述）

- 方法：自建活库探针 `qa_iv2_probe`（psql socket 直连，50000 唯一键→btree v4 root=3/level=1）；`get_raw_page` 取 blk0/1/3 base64 + `bt_metap`/`bt_page_items` 为 oracle；自写断言脚本（临时，不提交）直接调用 `parseBtreePage`/`deriveBtreeStructureFields` 与 web `findStructureAt` 真实实现逐项断言。验后 DROP，两库（jason/postgres）`qa_iv2%`/`pageview_smoke%` schema 残留均为 0。
- 结果：**43/43 PASS**，关键断言：
  - 活库 metapage blk0（pd_lower=72）：ItemId 0 个；`stats.itemIdTotal/lp*` 全 0（元信息条 ItemId=0 的数据源）；无解析警示；六字段+allequalimage 与 `bt_metap` 逐项相等（340322/4/3/1/3/1/true）；结构字段 0 个 itemid 段；全页扫描 [24..72) 零伪 itemid 反选命中；[24..48) 逐字节反选命中 btm_magic/version/root/level/fastroot/fastlevel 六字段、@64 命中 btm_allequalimage、[48..64) cleanup 区不命中（未建模，预期 null）。
  - 仓库实捕 fixture `btree-meta.base64.txt`（pd_lower=72）：同口径全部通过。
  - DEF-1b/c 消除：结构图 itemid 字段=0（b）；stats 链归零 + App.tsx 元信息条读 `stats.itemIdTotal`、meta 页空态文案「metapage：无 ItemId / 元组；内容为 BTMetaPageData 元数据」对 pageType=meta 无条件提供（App.tsx:1245-1247）——数据与代码双证（c）。
  - internal/leaf 无回退：活库 blk3（internal level=1）itemIds/tuples=137==`bt_page_items`，首/末元组 (1,(1,0),8)/(137,(138,1),16) 逐项相等；blk1（leaf）367==oracle，首元组 hikey=true，末元组 (367,(1,140),16) 相等。
- 测试有效性独立核对：修复提交测试为纯新增（page-core 54=52+2、web 76=74+2，既有 170 零改动），新增回归均加载实捕 fixture 且设 `pd_lower=72` 防线——无断言弱化、无 fixture 迎合（与复审结论一致）。

### 受影响回归与 L2/L3

- P0-4：六+1 字段==oracle、ItemId=0、空态成立 → **通过**（数据/代码层；纯视觉项维持未核验-无浏览器）。
- P0-9：metapage 反向选中合同恢复（六字段+allequalimage@64）；leaf/internal 选中行为轮次 1 已过，本轮活库 137/367 oracle 复证不回退 → **通过**（数据层）。
- L2 复跑（退出 0）：`pnpm test` → wal-core 13 · page-core 54 · server 31 · web 76，共 **174 全绿**；`pnpm -r typecheck` / `pnpm -r build` → 4 包 Done。
- L3 复跑：`pnpm test:integration` → **退出 0**（B-tree 六组断言全过：list 68/metapage v4/internal 137/leaf 367/posting 11·1272/hash 守卫；heap 段不回退；种子清理独立复核 0 残留）。

### DEF-2 状态核对

- 登记仍为「不修复·后续小项（两端点统一 `Number.isFinite` 守卫，即 Reviewer F1）」，与 dev-notes 回执一致，未误标已修复 → 核对通过。

### 手测清单状态

- 轮次 1 各「未核验-无浏览器」项**维持原状**：本轮复核环境仍无浏览器（chromium/firefox 不存在，无 playwright/puppeteer 依赖）；未因数据层通过而改标通过。

### UI/UX / 文档与安全

- UI/UX：DEF-1 相关合同（metapage 空区语义、元信息条计数、反向选中）已由数据+代码层复证成立；纯视觉项结论同轮次 1（未核验-无浏览器）。
- 文档：修复回执与提交一致（git show 核对）；安全：修复未新增 SQL/输入面，无凭据接触，轮次 1 结论维持。

### 结论（轮次 2）

- 总体: **Pass**
- 依据: qa.md「全部适用验收项通过，不存在未解决缺陷、阻塞或关键证据缺口」——全部可自动化验收项（P0 数据/逻辑层、L2/L3）经本轮独立复跑/复证通过；DEF-1 Closed（活库+fixture 双重确定性证据）；DEF-2 登记后续小项不阻塞；纯视觉/交互手测缺口按 plan「无法执行验证时」表与 quality.md §6 记录了原因/风险/恢复条件（非静默跳过），轮次 1 已裁定其不构成 Blocked 依据，本轮同口径维持。
- 合并就绪条件: ①用户明确授权合并（QA 不自行请求/执行）；②手测余项交接——10 项清单中纯视觉/交互项（spinner/option 视觉、禁用视觉与 Network 静默、徽标/legend/滚动定位、位格条 hover/？、双主题可读性、导航/跳表点击、diff 视觉形态、切换清除运行时）**合并后或浏览器可用时**按 dev-notes 手测清单补测；依据：plan.md 验证缺口表明示手测恢复条件（`pnpm dev:server`+`dev:web`），ui-design.md「浏览器可联调时逐项勾选」，且视觉项不改字节语义（数据层已全证），风险低；③DEF-2/Reviewer F1、F2 由 Manager 登记后续小项；④合并: 待授权（质量条件已满足，报告按 git.md §1.4 留在工作区不提交）

---

## 轮次 3（需求变更验收 + 回归，2026-09-01）

### 环境与范围

- 实现：分支 `index-viewer` tip = **296dc44**（`fix(web): switch all user-visible UI copy to English`，9 文件 = apps/web/src 8 + dev-notes 回执）；`git diff c30bf92..296dc44` 确认未触碰 packages/ 与 apps/server，业务逻辑/样式/结构零改动。环境同前（Node 24.19.0、本地 PG 16.11 socket /tmp、`.env` 未打印）。
- 依据：spec.md 修订记录 2026-08-31、ui-design.md「修订附页：英文文案表（权威，含 F5 补录）」、dev-notes「UI 文案英文化变更回执」、review.md 复审轮次 2 **Approve**（F5 已补录）。

### 变更验收（独立，不依赖 Developer/Reviewer 自述）

- **CJK 扫描**：汉字（U+4E00–9FFF）apps/web 全部 ts/tsx/css/html/json → 0 命中；扩展 CJK 标点/全角（U+3000–303F、U+FF00–FFEF）→ **1 处用户可见命中（DEF-3）**：`StructureMap.tsx:696` metapage 详情段 hint `metapage（PageGetContents @24）· v{btm_version}` 含全角括号 U+FF08/09（hexdump 字节实证 `ef bc 88/89`），由 64da04b 引入、296dc44 未覆盖。dev-notes「全角标点复查亦 0」与实况不符（回执证据缺口）。
- **文案表抽样对照（22 条 ≥ 要求 10 条，逐字）**：全部与权威表一致——`{am}: only B-tree index pages are supported`、`indisvalid=false; loadable for inspection only`、`{am} index page parsing is not supported — B-tree only. Pick a B-tree index or switch back to a table.`（含 em-dash）、`No user indexes (system schemas excluded)`（option+panel 双处）、`Pick an index to start (blkno 0 is the metapage).`、`Enter a blkno and Load (0 = metapage).`、页数据异常 `warnings.join("; ")`（App.tsx:1233）、metapage/空叶页空态、special 不可读警示、`0x053162` magic 警示、F5 补录 `leaf: heap TID`（IndexTupleDetail.tsx:38）、`internal: child page pointer`、`Key bytes [{start}..{end}) — click to highlight in hex`、`… {total} bytes total (showing first 64)`、`posting TIDs ({count}, count complete)`、TID 行 title、`Open blk {n} in owning table`、posting 解析失败警示、跳表失败 message（`(owning table ${name})` 插值）/nextStep、t_info ALT×3/VAR/NULL meaning、t_tid 角色 note×4、`Table`/`Index` 分段、`Not connected`（App.tsx:496/613）。
- **断言核对（git show 296dc44 逐行）**：indexView.test.ts 3 处 `toBe` 原位替换（期望串与新实现逐字一致），describe/it 结构、断言数量不变，无删除/skip/放宽；diff.test.ts 仅注释英文化 → **非弱化**（与复审结论一致）。

### 回归（全部本轮亲跑）

- `pnpm test` → wal-core 13 · page-core 54 · server 31 · web 76 共 **174 全绿**；`pnpm -r typecheck` → 4 包零错误；`pnpm -r build` → 4 包 Done；`pnpm test:integration` → **退出 0**（B-tree 六组 oracle + hash 守卫 + heap 段不回退 + 种子清理）。
- 文案耦合验收点复证：P0-2（hint/option title 含访问方法名且英文，indexView 单测本轮绿；禁用视觉维持未核验-无浏览器）、空态/警告语言（源码逐条见上）、TABLE_NOT_LISTED 反馈（blockNav.ts:39-40 全英文）、`Not connected`（App.tsx:496 message + 613 展示）。

### 轮次 2 结论维持性（DEF-1）

- 296dc44 未触碰 packages/page-core（c30bf92 的 metapage 修复代码逐字节不变）；本轮 L2 复跑含 c30bf92 新增的实捕 fixture 反向选中回归（page-core 54 + web diff.test 14）全绿 → **DEF-1 Closed 维持**（依据 L2 覆盖，未重跑活库探针；轮次 2 的 43/43 证据对象未被本轮变更触及）。DEF-2 登记不变。

### 缺陷

| ID | 严重度 | 摘要 | 状态 |
|---|---|---|---|
| DEF-3 | Low | StructureMap.tsx:696（metapage 详情段 hint）`metapage（PageGetContents @24）· v{btm_version}` 含全角括号 U+FF08/09，用户可见，违反「UI 可见文案一律英文」（表内约定全角→半角，如 `（所属表 X）`→` (owning table X)`）；64da04b 引入，296dc44 及 Developer/Reviewer 的汉字范围扫描未覆盖。复现：选中任一 meta 页字段查看详情段 hint。 | **Open** |

### 结论（轮次 3）

- 总体: **Fail**
- 依据: qa.md「实现存在可修复的不符合项」——DEF-3 为确定性、用户可见的需求变更违反（英文文案合同），且 dev-notes 回执「全角标点复查亦 0」被证伪；其余变更验收（抽样 22 条、断言非弱化）与全部回归（174 绿/typecheck/build/L3 退出 0）通过，轮次 2 结论（DEF-1 Closed）维持。
- Developer 修复范围: `apps/web/src/StructureMap.tsx:696` 全角括号→半角（1 行字符串；无逻辑改动）；建议同步：ui-design 英文文案表按 F5 先例补录该 hint 条目（Manager/文档通道）、修正 dev-notes 全角复查表述。Review 门禁 required：修复后须重新取得 Reviewer Approve，再由 QA 追加轮次 4（复测 DEF-3 + 文案扫描复跑 + 快速回归）。
- 恢复条件: N/A（Fail 轮；浏览器手测余项维持轮次 2 交接不变）
- 合并: 不合并

---

## 轮次 4（DEF-3 复测 + 最终回归，2026-09-01）

### 环境与范围

- 实现：分支 `index-viewer` tip = **6bf5191**（`fix(web): use ASCII parens in metapage hint`）；`git show --stat` 核对仅 2 文件——`apps/web/src/StructureMap.tsx`（1+/1-，即 hint 单行）+ dev-notes「DEF-3 修复回执」追加。工作区业务代码与 6bf5191 零漂移（`git diff 6bf5191 -- apps packages` 为空）。Reviewer 复审轮次 3 **Approve**；F5/F6 已按先例补录 ui-design 文案表（`leaf: heap TID`、`metapage (PageGetContents @24) · v{n}`，本轮核对在表）。环境同前（Node 24.19.0、本地 PG 16.11 socket /tmp、`.env` 未打印）。

### DEF-3 复测（独立取证）

- 现值：StructureMap.tsx:696 == `metapage (PageGetContents @24) · v{meta.btm_version}`，与 ui-design 文案表 F6 条目逐字一致。字节级实证（xxd）：括号为 ASCII `28 50…29`，`·` 为 `c2 b7`（U+00B7 保留），无 U+FF08/09（`ef bc 88/89`）→ 修复确认。
- 全仓扫描（全角 U+FF01–FF5E + U+3000 + 引号变体 U+2018/2019/201C/201D + CJK 汉字 U+4E00–9FFF，apps/web ts/tsx/css/html/json，排除 node_modules）→ **0 命中**；css 经 find 展开及排除 dist 的全量 ts/tsx/html/json 复扫亦 0 命中。轮次 3 的回执证据缺口已消除。
- **DEF-3 → Closed**（现值 + 扫描双证）。

### 最终回归（四命令全部本轮亲跑）

- `pnpm test` → wal-core 13 · page-core 54 · server 31 · web 76 共 **174 全绿**（exit 0）；`pnpm -r typecheck` → 4 包 Done（exit 0）；`pnpm -r build` → 4 包 Done（exit 0）；`pnpm test:integration` → **exit 0**（B-tree 六组 oracle：list 68 / metapage v4 root=3 / internal 137 / leaf 367 / posting 11·1272 / hash 400 INDEX_NOT_BTREE；heap 段不回退；种子清理）。

### 矩阵维持说明

- **DEF-1 Closed 维持**：6bf5191 未触碰 packages/page-core（`git show --stat` 证），c30bf92 修复代码逐字节不变；本轮 L2 含其实捕 fixture 反向选中回归（page-core 54 + web diff.test 14）全绿。依据 L2 覆盖，未重跑活库探针（轮次 2 的 43/43 证据对象未被触及）。
- 轮次 3 文案抽样 22 条对象：6bf5191 在 apps/web 仅改 StructureMap.tsx:696 一行（即 DEF-3 hint 本身），其余采样字符串所在文件零改动，抽样结论维持。
- DEF-2：登记仍为「后续小项」（oid 数字守卫，Manager 已建 oid-numeric-guard.md 跟进），不阻塞。手测余项维持「未核验-无浏览器」原状。

### 结论（轮次 4）

- 总体: **Pass**
- 依据: DEF-3 复测通过（现值 + 扫描 0 命中）；最终回归四命令全过；DEF-1 Closed、轮次 3 抽样结论均经变更范围核对维持；无未解决缺陷、阻塞或关键证据缺口。
- 合并就绪条件（沿轮次 2 口径）: ①用户明确授权合并（QA 不自行请求/执行）；②手测余项（纯视觉/交互 10 项清单）合并后或浏览器可用时按 dev-notes 清单补测（恢复条件 `pnpm dev:server` + `dev:web`）；③DEF-2（Reviewer F1）及 F2 后续小项已由 Manager 登记；④合并: 待授权（报告按 git.md §1.4 留在工作区不提交）。

---

## 轮次 5（需求变更 2 验收 + 回归，2026-09-01）

### 环境与范围

- 实现：分支 `index-viewer` tip = **f8e650b**（`feat(web): table-filtered index selection in Page mode`）；`git show --stat` 核对仅 4 文件——apps/web/src/{App.tsx,indexView.ts,indexView.test.ts} + dev-notes「变更 2 回执」；工作区业务代码与 f8e650b 零漂移。Reviewer 复审轮次 4 **Approve**。环境同前（Node 24.19.0、本地 PG 16.11 socket /tmp、`.env` 未打印；无浏览器）。
- 依据：spec.md 修订记录变更 2（含 P0-1 验收修订）、ui-design.md「修订附页 2：Index 模式选择交互（权威）」+ 修订附页 1（F5/F6/F7 补录）、dev-notes「变更 2 回执」。

### 变更 2 验收（独立取证，不依赖 Developer/Reviewer 自述）

- **方法**：自建活库探针 `qa_iv5_probe`（t_btree 带 btree 索引×2 + t_hash 带 hash 索引 + t_plain 无索引）；起真实 server（PORT=8795/.env 目标库）curl `/api/indexes`；以同口径 catalog SQL 直查为 oracle；自写断言脚本（临时，不提交）导入**真实实现**（apps/web/src/indexView.ts 纯函数）跑 20 断言。验后 DROP schema，两库 `qa_iv5%`/`pageview_smoke%` 残留 0。
- **五条规则核验矩阵**：

| # | 修订附页 2 规则 | 结果 | 证据 |
|---|---|---|---|
| 1 | 过滤器/分段切换重置语义（不在新列表→重置 index 选择+页面视图；存活→保留选择，页面视图仍清除） | 通过 | 代码：`onSelectIndexFilter`（App.tsx:396-403）与 `onSwitchRelationKind`（406-415，覆盖 Table 模式期间过滤器已变路径）均先 `resetPageView()+setSchema(null)`，`indexSelectionSurvives`=false 才 `setSelectedIndexOid(null)`；活库断言 D1-D5（t_btree 索引过滤至本表存活/切 t_hash、t_plain 被丢弃/null 恒存活） |
| 2 | 过滤后无索引：禁用项 `No indexes for this table` + Load 禁用 | 通过 | 活库断言 C4（t_plain→[]）；代码：select disabled（865）+ 禁用 option（884）+ 主区 muted 面板（1221）+ Load 禁用（`canLoadIndexBlk` 要求 selectedIndexOid!=null，458-462；`triggerLoadIndex` 双守卫 464-468，零请求） |
| 3 | 过滤选择仅为输入态；切回 Table 模式保留为普通表选择（不自动加载） | 通过 | 代码级：过滤器复用 `selectedOid`（841-846），`onSelectIndexFilter` 仅 setState+清除、无加载调用；`onSwitchRelationKind` 无加载；Table select 仅 `onSelectTable` 触发（780）。运行时点击未核验-无浏览器 |
| 4 | 文案表增补三项 | 通过 | `All tables`（848）、`No indexes for this table`（884+1221）、`Filter indexes by table`（title，843）逐字==表 |
| 5 | 选项文本双态（过滤去后缀/全量保留四要素） | 通过 | `omitTableSuffix: selectedOid != null` 接线于 option 文本（893）/option title（891）/select title（870）/Load title（934）；活库断言 B1-B4（全量含 `· → 表` 后缀、过滤无后缀、hash ✕ 前缀双态维持） |

- **P0-1 修订口径（双态列表 vs pg_class）**：`/api/indexes` 68 项与 catalog 直查（relkind='i'+am/pg_index join、系统/temp schema 排除、blocks=pg_relation_size/8192、ORDER BY schema,name、8 字段含 valid）**逐字段相等且排序一致**（断言 A1-A3，含探针 3 行 oid/blocks/所属表）；全量态 option 含所属表后缀、过滤态无后缀（B1/B2）——「全部或按表过滤呈现，过滤态可不含后缀」合同成立。API 合同未变（client 侧过滤，`git diff` 证 packages/apps/server 零触碰）。
- **P0-3 活库复证**：hash oid pages/1 → 400 `INDEX_NOT_BTREE`（message 含 "hash"，nextStep 指向 btree/表，非 5xx）。
- **title 双态观察（DEF-4）**：F7 补录表两行行标为 "index option title"，单元格字面为 `schema.name (am · N blk · → owner)` / `schema.name (am · N blk)`（即 option 文本格式）；实现 title 为 `qn · → owner` / 裸 `qn`（活库 INFO 留证）。与复审轮次 4 F7（Info：裸 qualifiedName、文档补录吸收、无需代码改动）及单测断言一致，但表字面与实现 title 不一致——登记 DEF-4，文档通道澄清。

### 回归（四命令全部本轮亲跑）

- `pnpm test` → wal-core 13 · page-core 54 · server 31 · web 87（76+11）共 **185 全绿**（exit 0）；`pnpm -r typecheck` → 4 包 Done（exit 0）；`pnpm -r build` → 4 包 Done（exit 0）；`pnpm test:integration` → **exit 0**（B-tree 六组 oracle + heap 段不回退 + 种子清理）。
- **Table 模式回归（P0-10 链路）**：App.tsx diff hunk 全位于 imports/memo/新 handler/Index 分支 chrome 与面板（@@36/109/379/806/814/870/1153），kind=table JSX、`onSelectTable`/`loadBlk` 零触碰；纯 Table 流 `selectedIndexOid==null` 恒存活（survival 复核 no-op）；L2 web 87 全绿含既有 heap 用例零改动。
- **P0-12 重置语义**：新增调用点 `onSelectIndexFilter`/`onSwitchRelationKind` 均含 `resetPageView()`（page/selectedId/highlight/prevRaw/diffIds/hexLocate）；既有 onSelectIndex/jumpToHeap 调用点不变。
- **英文文案抽样维持**：轮次 3 抽样 22 条中位于本轮触碰文件者逐字复核——Table/Index 分段（758/766）、非 B-tree title/hint、invalid title、`No user indexes (system schemas excluded)`（option 882+panel 1215）、`Pick an index to start…`（1227）、`Enter a blkno and Load…`（1233）、`Not connected`（524/641）；F5 `leaf: heap TID`（IndexTupleDetail.tsx:38）、F6 metapage hint（StructureMap.tsx:696）未触碰文件现值正确；CJK/全角/css 扫描 **0 命中**。
- **断言强度**：indexView.test.ts diff 纯新增（0 删除行，+11 用例：过滤×3/存活×3/option 文案×3/title×2），既有断言零改动，非弱化。

### 维持性（DEF 终态）

- **DEF-1 Closed 维持**：f8e650b 零触碰 packages/page-core（`git diff 6bf5191..f8e650b -- packages/page-core` 为空）；本轮 L2 含实捕 fixture 反向选中回归（page-core 54 + web diff.test）全绿。
- **DEF-3 Closed 维持**：StructureMap.tsx 零触碰；:696 现值==F6 条目；扫描 0 命中。
- **DEF-2 登记不变**（后续小项 oid-numeric-guard，Manager 已登记）。

### 缺陷

| ID | 严重度 | 摘要 | 状态 |
|---|---|---|---|
| DEF-4 | Low | ui-design 修订附页 2「F7 补录」表两行行标 "index option title"，单元格字面（`schema.name (am · N blk · → owner)`/`schema.name (am · N blk)`）实为 option 文本格式；实现 title 为 `qn · → owner`（全量态，T5 起既有）/裸 `qn`（过滤态），与表字面不一致。实现与复审轮次 4 F7 裁定（Info：中性标识符、文档补录吸收、无需代码改动）及单测一致；表如字面解读则代码偏差，如按「title 同步去后缀」解读则一致。用户影响≈0（tooltip 附加信息可由 option 文本获得；Chromium 不显示 option tooltip）。 | **Open**（处置：文档通道澄清——行标改 "index option 文本" 并补 title 实际串，或明示要求代码改为 title=option 文本；非代码缺陷，不阻塞，沿 DEF-2 先例） |

### UI/UX / 文档与安全

- UI/UX：五条规则+P0-1 双态经活库/代码/单测三层核验通过；新增过滤器控件的两主题渲染、option 截断+title 运行时呈现维持「未核验-无浏览器」（同前轮口径，恢复条件 `pnpm dev:server`+`dev:web`）。
- 文档：dev-notes 变更 2 回执与提交一致（触碰文件/规则落实/验证证据核对）；ui-design 修订附页 2 除 DEF-4 表述歧义外逐条对应。安全：纯 client 侧过滤，零新增 SQL/输入面/依赖，无凭据接触，轮次 1 结论维持，允许合并。

### 结论（轮次 5）

- 总体: **Pass**
- 依据: 变更 2 五条规则逐条通过（活库 20 断言 + 代码级接线 + 单测）；P0-1 修订口径双态与 pg_class 一致；四命令回归全过（185/typecheck/build/integration 退出 0）；Table 模式/P0-12/文案抽样回归通过；DEF-1/2/3 终态维持；DEF-4 为文档通道澄清项（Low，非代码缺陷，沿 DEF-2 先例不阻塞）；纯视觉/交互项维持「未核验-无浏览器」原口径（关键验收已取得确定性证据，非 Blocked）。
- 合并就绪条件: ①用户明确授权合并（QA 不自行请求/执行）；②手测余项（纯视觉/交互清单，含新增过滤器控件两主题渲染）合并后或浏览器可用时按 dev-notes 清单补测；③DEF-2/F1、F2 后续小项维持 Manager 登记；④DEF-4 由 Manager 文档通道澄清（一行表述修正，不涉及代码）；⑤合并: 待授权（报告按 git.md §1.4 留在工作区不提交）。

---

## 轮次 6（需求变更 3 验收 + 回归，2026-09-01）

### 环境与范围

- 实现：分支 `index-viewer` tip = **66c595f**（`feat(web): empty-default table filter with indexed tables only`）；`git show --stat` 核对仅 4 文件——apps/web/src/{App.tsx,indexView.ts,indexView.test.ts} + dev-notes「变更 3 回执」；工作区业务代码与 66c595f 零漂移（`git diff 66c595f -- apps packages` 为空）。Reviewer 复审轮次 5 **Approve**。环境同前（Node 24.19.0、本地 PG 16.11 socket /tmp、`.env` 未打印；无浏览器；注：本机 http_proxy 会拦截 localhost，探针 curl 需 `--noproxy '*'`）。
- 依据：spec.md 修订记录变更 3（P0-1 再修订）、ui-design.md「修订附页 3（权威，取代附页 2/F7 冲突处）」+ 附页 1、dev-notes「变更 3 回执」。

### 变更 3 验收（独立取证，不依赖 Developer/Reviewer 自述）

- **方法**：自建活库探针 `qa_iv6_probe`（t_btree 带 btree×2 + t_hash 仅 hash 索引 + t_plain 无索引）；起真实 server（PORT=8796/.env 目标库）curl `/api/indexes`（HTTP 200，68 项 = 基线 65 + 探针 3）；同口径 catalog SQL 为 oracle；自写断言脚本（临时，已删）导入**真实实现**（apps/web/src/indexView.ts 纯函数）95 断言 → **95/95 PASS**。验后 DROP，两库 `qa_iv6%`/`pageview_smoke%` 残留 0，public 索引数回 65。
- **附页 3 五条规则矩阵**：

| # | 规则 | 结果 | 证据 |
|---|---|---|---|
| 1 | 过滤器无「All tables」项、默认空、仅含有索引表 | 通过 | 活库 B1-B8：空默认首位 `{null, ""}`；t_btree/t_hash 在列、t_plain 不在列；全 apps/web/src `All tables` 0 命中；去重（t_btree 两索引→1 项）/排序/数量==tableOid 去重数；代码 App.tsx:850-857 选项源 `tableFilterOptions(indexes)` |
| 2 | 空默认=全量；可反选回全部 | 通过 | 活库 C1/C2：`filterIndexesByTable(idx, null)` 恒等返回全量 68；C3/C4：过滤 btree→2 项/hash→1 项；反选经 option value="" ↔ null（:846-848），运行时点击未核验-无浏览器 |
| 3 | option 文本/title 双态均无归属 | 通过 | 活库 D-*：全量/fBtree/fHash 三态逐项正则 `^(✕ )?qn \(am · N blk\)( · invalid)?$` 且无 ` · → ` 段；title btree 有效双态==裸 qualifiedName（无→），hash title 沿附页 1、✕ 前缀维持 |
| 4 | 「No indexes for this table」防御路径 | 通过 | 活库 E1-E5：存活/重置（null 恒活、在列活、掉出重置、stale 索引掉出）；E4 过滤至无索引表→[] → 代码 :879 禁用 option + :1214 muted 面板 + Load 禁用（`canLoadIndexBlk` 要求 selectedIndexOid!=null，:459-468） |
| 5 | 重置/存活、过滤不加载、Table 模式零改动沿附页 2 | 通过 | `onSelectIndexFilter`/`onSwitchRelationKind`（:398-415）66c595f 仅注释变动，resetPageView+存活判定逻辑不变；Table 模式零改动见回归 |

- **P0-1 再修订口径**：活库 A1-A3——`/api/indexes` 全量 68 项与 catalog oracle（relkind='i'+am/pg_index join、pg_toast/系统/temp schema 排除 0 泄漏、blocks==pg_relation_size/8192、排序、7 字段含 valid）**逐字段相等且排序一致**；归属仅经 ` · → ` 过滤器段表达已由规则 3 双态断言覆盖。API 合同未变（66c595f 零触碰 packages/apps/server）。
- **UI 接线代码级**（无浏览器，如实标注）：table 过滤器 select（:838-858，空默认 value=""、title `Filter indexes by table`、禁用条件随 indexes 数据源）；index select（:860-895，option 文本/title 经 formatIndexOption/indexOptionTitle）；死代码 `omitTableSuffix`/`IndexOptionMode`/`All tables` 全仓 0 命中。两主题渲染/option 截断/运行时点击维持「未核验-无浏览器」（同前轮口径，恢复条件 `pnpm dev:server`+`dev:web`）。

### 回归（四命令全部本轮亲跑）

- `pnpm test` → wal-core 13 · page-core 54 · server 31 · web 93 共 **191 全绿**（exit 0）；`pnpm -r typecheck` → 4 包 Done（exit 0）；`pnpm -r build` → 4 包 Done（exit 0）；`pnpm test:integration` → **exit 0**（B-tree 六组 oracle + heap 段不回退 + 种子清理，两库独立复核 0 残留）。
- **Table 模式回归**：App.tsx 8 hunk（@@43/111/388/407/839/864/888/925）全位于 imports/memo/handler 注释/Index chrome；kind=table JSX（:770-800）数据源 `tables`/`onSelectTable`/`loadBlk` 零触碰，与 Index 过滤器数据源 `tableFilterOptions(indexes)` 分离各自正确。
- **P0-12 重置语义**：新增 0 调用点（66c595f 未改 handler 逻辑）；既有四处 `resetPageView()` 不变。
- **英文文案维持**：CJK（U+4E00–9FFF）/全角（FF01–FF5E/3000/2018–201D）扫描 apps/web/src + html → **0 命中**；`Filter indexes by table` 唯一在位。
- **断言强度**：indexView.test.ts 87→93（+6 净增）为合同修订+新增（Reviewer 轮次 5 已核，非弱化）；本轮 L2 web 93 全绿佐证。

### 维持性（DEF 终态）

- **DEF-1 Closed 维持**：66c595f 零触碰 packages/page-core（`git diff f8e650b..66c595f -- packages apps/server` 为空）；本轮 L2 含实捕 fixture 反向选中回归（page-core 54 + web diff.test）全绿。
- **DEF-3 Closed 维持**：StructureMap.tsx/IndexTupleDetail.tsx 零触碰；扫描 0 命中。
- **DEF-2 登记不变**（后续小项 oid-numeric-guard）。
- **DEF-4**：轮次 5 后 Manager 已修正 F7 表定稿；附页 3 明文取代 F7 冲突处，F7 残留旧字面（全量态 title 含 →）属版本化取代预期，非不一致；实现与附页 3 逐字一致（D-title 断言）。

### UI/UX / 文档与安全

- UI/UX：附页 3 五条规则经活库/代码/单测三层核验通过；纯视觉/交互维持「未核验-无浏览器」。
- 文档：dev-notes 变更 3 回执与提交一致（触碰文件/规则/验证证据核对）；ui-design 附页 3 与实现逐字一致。安全：纯 client 侧派生，零新增 SQL/输入面/依赖，无凭据接触，轮次 1 结论维持，允许合并。

### 结论（轮次 6）

- 总体: **Pass**
- 依据: 变更 3 附页 3 五条规则逐条通过（活库探针 95/95 断言 + UI 接线代码级）；P0-1 再修订口径与 pg_class 一致（系统 schema 排除、归属仅经过滤器）；四命令回归全过（191/typecheck/build/integration 退出 0）；Table 模式/P0-12/英文文案回归通过；DEF-1/2/3/4 终态维持；无未解决缺陷、阻塞或关键证据缺口；纯视觉/交互项维持既口径（非 Blocked）。
- 合并就绪条件: ①用户明确授权合并（QA 不自行请求/执行）；②手测余项（纯视觉/交互清单，含过滤器空选项视觉呈现）合并后或浏览器可用时按 dev-notes 清单补测；③DEF-2/F1、F2 后续小项维持 Manager 登记；④合并: 待授权（报告按 git.md §1.4 留在工作区不提交）。

---

## 轮次 7（需求变更 4 验收 + 回归，2026-09-01）

### 环境与范围

- 实现：分支 `index-viewer` tip = **2463576**（`feat(web): heap page peek overlay for index TID jumps`，基于 66c595f）；`git show --stat` 9 文件（apps/web/src 7 + dev-notes）；`git diff 66c595f..2463576 -- packages apps/server` 零文件 → **纯 web 变更实证**。Reviewer 复审轮次 6 **Approve**（R6-1 非阻塞建议）。环境同前（Node 24.19.0、本地 PG 16.11、`.env` 未打印；无浏览器；探针 curl 需 `--noproxy '*'`）。
- 依据：spec.md 修订记录变更 4（七点合同）、ui-design.md「修订附页 4（权威）」、dev-notes「变更 4 回执」、review.md 复审轮次 6。

### 变更 4 验收（独立取证，不依赖 Developer/Reviewer 自述）

- **方法**：自建活库探针 `qa_iv7_probe`（postgres 库，t_orders 30000 行/192 块 + idx_orders btree/84 块，叶页 blk1 首批 TID→heap blk0 含 id 1..157）；起真实 server（PORT=8797）curl 实测浮层两调用与错误端点；自写断言脚本（临时，已删）导入**真实实现**（heapPeek.ts 纯函数 + page-core 解析链 + findStructureAt）以活库数据复演浮层非 DOM 管线，**27/27 PASS**。验后 DROP + 停 server，两库 `qa_iv7%`/`pageview_smoke%` 残留 0，postgres 用户索引数回 65 基线（jason 库误建探针一并清理）。
- **七点合同矩阵**：

| 点 | 合同 | 结果 | 证据 |
|---|---|---|---|
| ① | TID 触发开浮层，请求参数正确 | 通过 | 活库 A1/A2+C1：`/api/indexes` 66 项含探针（tableOid=50274、tableQualifiedName 正确）→ `heapPeekRequest(index, block)` 产出 `{tableOid, tableQualifiedName, blkno}`（leaf/posting 同一入口 `onJumpToHeap`→`openHeapPeek`，App.tsx:1327-1331）；浮层取页为 `Promise.all([fetchSchema(tableOid), fetchPage(tableOid, blkno)])` 两调用，活库实测 schema 200（id int4/note text）+ page 200/8192（C4-1/2） |
| ② | 三关闭路径等价、状态销毁 | 通过 | 活库 C2：Esc/✕/遮罩三路均汇 `onClose`（HeapPeekOverlay Esc 监听+✕ 按钮+backdrop onClick，overlay 内 stopPropagation）；reducer `close` 从 loading/open/error 任一态→closed，关后迟到响应不复活（C2-4）；关闭=setHeapPeek(null)→key=nonce 卸载。运行时键盘/点击未核验-无浏览器 |
| ③ | 主视图零影响 | 通过 | 代码级：`openHeapPeek` 函数体仅 triggerRef 捕获+nonce 递增+setHeapPeek，`closeHeapPeek` 仅置 null——零 resetPageView/选中/高亮/diff 触碰（resetPageView 调用点 4 处均既有：新连接/onSelectIndex/onSelectIndexFilter/onSwitchRelationKind）；浮层渲染于 `</main>` 后；活库 C3：槽 keys 仅 `request,nonce`、重开同目标 nonce 递增、关后槽 null；单测同口径 |
| ④ | 错误路径浮层内呈现错误合同 | 通过 | 活库 C4-3/4：`/api/tables/50274/pages/99999`→400 `BLKNO_OUT_OF_RANGE` `{code,message,nextStep}`（含 0..191 范围提示）→ reducer error 态保留 request（标题栏可渲染）；浮层 error 面板 `role=alert` `{code}: {message}`+`Next: …`；PageParseError→UNSUPPORTED_PAGE 亦浮层内（代码级） |
| ⑤ | 只读性 | 通过 | 代码级：浮层无 Load/blkno 输入/Refresh；`diffIds=EMPTY_DIFF_IDS` 恒空+`freeDiff=false`；HeapDetail 不传 onLoadCrossBlock→ctid 跳转按钮不渲染、标注 `(cross-block; read-only peek)`（附页 4 规则 3 择一）；选中/hex 联动为浮层局部 state，活库 B3/B4 结构字段+findStructureAt 反选数据链路通 |
| ⑥ | jumpToHeap/TABLE_NOT_LISTED 零残留 | 通过 | `grep -rn 'jumpToHeap|TABLE_NOT_LISTED|resolveJumpTable|heapJumpError' apps/ packages/` → **0 命中**；blockNav.ts 仅删两函数，`siblingNav`（P1-1）零改动 |
| ⑦ | Table 模式与主视图其余不变 | 通过 | App.tsx 5 hunk 全位于 imports/槽 state/openHeapPeak（旧 jumpToHeap 删除）/onJumpToHeap 接线/浮层渲染，kind=table JSX 零触碰；StructureMap 仅 onLoadCrossBlock 可选化（传入路径逐字符等价）；见回归 |

- **附页 4 四规则**：①三路径等价关闭仅销毁浮层（见②）；②body 滚动锁+初始焦点 ✕+关闭返还触发元素（代码级：mount 置/卸载恢复 overflow、`closeBtnRef.focus()`、`triggerRef.current?.focus()`，openHeapPeek 捕获 document.activeElement；运行时未核验-无浏览器）；③只读（见⑤）；④`--overlay-dim` light(:20)/dark(:56) 各定义一次、surface/border/color-mix shadow、z-index 100>conn-popover 20（代码级）。文案表 4 条逐字：`{qn} · blk {N}`/`Close`/`Loading blk {N}…`/错误沿既有合同（活库 D1/D2+error 面板）。
- **浮层管线 oracle**：活库 B1/B2——parsePage+annotateCtidBlocks+decodePageTuples 与浮层同序复演，blk0 解出 157 元组，解码 id 值域 1..157 == psql `ctid<'(1,0)'` oracle；hex@24 反选 itemid-0、tuple-0 起点反选 tuple-0 字段（B4a/b）。
- **视觉项如实标注**：浮层尺寸/遮罩 dim/两主题实际渲染、焦点/滚动锁/Esc 运行时行为、spinner——未核验-无浏览器（同前轮口径，恢复条件 `pnpm dev:server`+`dev:web`）。

### 回归（四命令全部本轮亲跑）

- `pnpm test` → wal-core 13 · page-core 54 · server 31 · web 99 共 **197 全绿**（exit 0）；`pnpm -r typecheck` → 4 包 Done（exit 0）；`pnpm -r build` → 4 包 Done（exit 0）；`pnpm test:integration` → **exit 0**（B-tree 六组 oracle + hash 守卫 + heap 段 + 种子清理）。
- **P1-1 块导航**：`loadIndexBlock`（App.tsx:379-383）与 `onLoadIndexBlock` 接线零改动；浮层 Esc 监听仅挂载期存在，不干扰 Index 模式内导航 → 不受影响。
- **Table 模式**：hunk 级零触碰（见⑦）；ctid 跨块 Load 按钮主视图路径 `onLoadCrossBlock` 传入渲染等价。
- **P0-12**：resetPageView 4 调用点均既有不变；唯一移除点在被删 jumpToHeap 体内（合同⑥废止预期）。
- **英文文案维持**：CJK/全角扫描 apps/web/src+html → **0 命中**；触发文案 `Open blk {N} in owning table` 不变。
- **断言强度**：web 93→99（移除 blockNav 守卫 4 例系合同废止+新增 heapPeek 10 例，Reviewer 已核非弱化）；本轮 L2 全绿佐证。

### 维持性（DEF 终态 + R6-1）

- **DEF-1 Closed 维持**：2463576 零触碰 packages/page-core（diff --stat 0 文件）；L2 含实捕 fixture 反向选中回归全绿。**DEF-3 Closed 维持**：扫描 0 命中。**DEF-2 登记不变**（oid-numeric-guard 后续小项）。**DEF-4**：附页 3 取代 F7 后无新冲突，维持。
- **R6-1 处置**：登记为 DEF-5（Info，后续增强）——无焦点圈闭（Tab 可越出 aria-modal 对话框），Reviewer 裁定非阻塞，不影响本次结论；建议后续迭代加 trap 或 Tab 循环。

### UI/UX / 文档与安全

- UI/UX：七点合同+四规则经活库/代码/单测三层核验；`role=dialog aria-modal` / ✕ aria-label / `:focus-visible` 沿用（ui.md 底线，代码级）；纯视觉/运行时项未核验-无浏览器（如实标注）。
- 文档：dev-notes 变更 4 回执与提交一致（触碰文件/七点落实/验证证据核对；回执 197 绿与亲跑一致）。安全：浮层复用既有 schema/page 端点，零新增 SQL/输入面/依赖，无凭据接触；request 参数为内部 index row 派生值（tableOid/blkno）非自由输入 → 轮次 1 结论维持，允许合并。

### 缺陷

| ID | 严重度 | 摘要 | 状态 |
|---|---|---|---|
| DEF-5 | Info（建议，非阻塞） | HeapPeekOverlay 无焦点圈闭（focus trap），Tab 可越出 aria-modal 对话框；背景 inert 语义未由代码强制。桌面浏览器实际影响有限（Reviewer R6-1 同裁定）。 | **Open**（后续迭代增强：trap 或 Tab 循环；不阻塞验收与合并） |

### 结论（轮次 7）

- 总体: **Pass**
- 依据: qa.md「全部适用验收项通过」——变更 4 七点合同+附页 4 四规则逐条通过（活库探针 27/27 断言 + 代码级接线 + 单测 197 全绿）；四命令回归全过；P1-1/Table 模式/P0-12/英文文案回归通过；DEF-1/2/3/4 终态维持；R6-1 登记为 DEF-5（Info 非阻塞，沿 Reviewer 裁定）；纯视觉/运行时项维持「未核验-无浏览器」既口径并如实标注（非 Blocked）。
- 合并就绪条件: ①用户明确授权合并（QA 不自行请求/执行）；②手测余项（纯视觉/交互清单，含浮层运行时：Esc/✕/遮罩三路径、焦点返还、滚动锁、两主题 dim）合并后或浏览器可用时按 dev-notes 清单补测（恢复条件 `pnpm dev:server`+`dev:web`）；③DEF-2/F1、F2 后续小项维持 Manager 登记；④DEF-5（R6-1）由 Manager 登记后续增强；⑤合并: 待授权（报告按 git.md §1.4 留在工作区不提交）。

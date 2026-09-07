# Review: index-viewer

## 审阅范围

- 实现版本：分支 `index-viewer`（自 main `5d0e3d9` 分出），提交 `1699937..9dab98a` 共 **11** 个（任务说明称 12，以 `git log main..index-viewer` 实际为准；dev-notes 提交记录与实际一一对应）。
- 变更范围：packages/page-core（btree 模块 + 4 组实捕 fixtures + 测试）、apps/server（两端点 + 集成冒烟）、apps/web（输入侧/三联区/详情/导航）、scripts/capture-fixtures.ts、README 双语、dev-notes.md。
- 依据：spec.md（P0-1..P0-12 / P1-1..P1-5）、design.md（§1–§4 决策与常量表）、ui-design.md、plan.md（T1–T10、L3 最低验证层）、standards（documentation/quality/security/git/ui）。
- Reviewer 独立验证（2026-08-31，本地 PG 16.11）：
  - `pnpm test` → wal-core 13 · page-core 52 · server 31 · web 74，全绿（170）；
  - `pnpm -r typecheck` → 4 包零错误；`pnpm -r build` → 4 包通过；
  - `pnpm test:integration` → **退出码 0**：B-tree 段 6 组断言全过（list 68 indexes / metapage v4 root=3 / internal 137 downlinks / leaf 367 tuples hikey first / posting 11 tuples·1272 TIDs / hash 400 INDEX_NOT_BTREE），heap 段不回退，种子 schema 已清理。

## 实现正确性

**结论：满足 Spec 合同与 Plan 完成条件，无阻塞缺陷。**

P0 逐项核对（代码位置级，全部通过）：

| ID | 实现落点 | 核对结果 |
|---|---|---|
| P0-1 | catalog.ts `LIST_INDEXES_SQL`（relkind='i' + pg_am/pg_index join、系统/temp schema 排除同表列表、pg_relation_size/8192、ORDER BY schema,name、indisvalid）；app.ts `/api/indexes`；App.tsx index select + indexView.formatIndexOption 四要素 | 通过（L3 实库 + SQL 契约测试） |
| P0-2 | indexView.ts `canLoadIndex`；App.tsx `canLoadIndexBlk`（状态门控）+ `triggerLoadIndex`（触发守卫）+ Load `disabled` + `nonBtreeHint`（含 am 名） | 通过；非 B-tree 不可能发起请求（双重守卫，代码路径核查） |
| P0-3 | app.ts 校验②（app.ts:442-460，message 含实测 am 名、nextStep 指向 btree/表）；indexes.test.ts ② + L3 hash 守卫 | 通过（实测 400 非 5xx，message 含 "hash"） |
| P0-4 | btree.ts meta 分类（BTP_META 位，P_ISMETA 语义）+ BTM_* 偏移；BtreeStructureDetail meta 分支；oracle 测试 btree-meta（六字段+allequalimage 逐字段==bt_metap）；L3 断言 | 通过 |
| P0-5/P0-6 | btree.ts internal（btpo_level>0）/leaf（BTP_LEAF）分类 + tuple 解析；oracle 四场景逐元组对照；L3 逐字段比对 | 通过 |
| P0-7 | btree.ts hikey 判定（非最右页首个 LP_NORMAL）；oracle internal 场景为最右页反例（无 hikey）、leaf 场景首元组 hikey；synthetic 正反例；L3 断言 | 通过 |
| P0-8 | btree.ts posting（ALT 位 + ip_posid BT_IS_POSTING=0x2000、count=posid&0x0FFF、TID 数组起点=元组内 ip_blkid 偏移，D3）；oracle posting 132 TIDs 逐项相等；L3 1272 TIDs 总数==oracle | 通过 |
| P0-9 | deriveBtreeStructureFields（meta@24..65、special@8176..8192、tuple t_tid/t_info/key）；StructureMap fields 消费 + onHexSelect→findStructureAt 反向选中；diff.test.ts 双向命中 | 通过（数据/逻辑层；视觉定位待 QA 手测） |
| P0-10 | parse.ts 仅加 export（readItemId/parseHeader）；structure-fields.ts 仅扩 Region 枚举；HexDump.tsx `git diff` 为空；heap 测试文件零改动；HeapDetail 抽取保留 DOM 序与空态原文案 | 通过（含下述 parity 独立复验） |
| P0-11 | app.ts 校验③④ + notConnectedReply/requirePageinspect 门禁；indexes.test.ts 显式验证序优先级（①优先于坏 blkno、②优先于③） | 通过 |
| P0-12 | App.tsx `resetPageView()`（page/selectedId/highlight/prevRaw/diffIds/hexLocate）；onSwitchRelationKind/onSelectIndex/jumpToHeap 均调用；元信息条按 pageView.kind 分支 | 通过 |

P1 抽样（P1-1..P1-5 全查）：块导航（blockNav.siblingNav P_NONE 禁用+leftmost/rightmost 标注、root/fastroot/child 按钮）✓；P1-2 芯片（pageTypeBadge）✓；P1-3 jumpToHeap（TABLE_NOT_LISTED 可读反馈，不静默失败）✓；P1-4 Refresh diff（loadIndexBlk refresh 分支复用 diffByteRanges）✓；P1-5 token 双主题已定义，实际可读性待 QA 手测。

**Developer 自报注意点复核**（均属实）：

1. diff.ts/StructureMap 泛化 heap 等价性：diff.test.ts parity 段为真逐字节对照（0..4095 逐 offset 比对 id/range/kind vs page-core `resolveFieldAt`，断言未弱化）；Reviewer 另以独立脚本对 0..8191 全页对照，**0 不匹配**。
2. 常量冻结 D1–D4 与实现/oracle 一致：btree.ts `BTM_ALLEQUALIMAGE_OFF=40`（内容起点 24 → 绝对 64，D1）、`INDEX_NULL_MASK=0x8000`（D2）、posting 起点语义按 ip_blkid 变偏移（D3，oracle 测试实测首 (0,50) 末 (29,46) 无反转）、BTP_* 定值（META=0x08/HALF_DEAD=0x10/HAS_GARBAGE=0x40/INCOMPLETE_SPLIT=0x80，D4）——与 PG16 nbtree.h/itup.h 及实捕 oracle.json 三方一致；`BTREE_MAGIC=0x053162=340322` 与 oracle 双证。
3. 校验序实现与测试见上表 P0-3/P0-11。
4. P0-2 门控见上表。
5. heap 零改动：page-core src 全部删除行仅 3 行（两处函数签名改 export、Region 枚举扩展），无 heap 语义变更。

已知缺口（dev-notes 如实声明，评估为可接受）：v3 metapage 仅 synthetic 覆盖（本地/CI 均为 PG16=v4；spec 裁决 5 明确 v3 支持但验收以现役环境为准）；无效索引 L3 断言简化为 valid 字段契约（`valid=false` 渲染路径由 L2 indexView 测试覆盖，偏离理由充分且已授权）。

## 测试有效性

**结论：覆盖关键路径、边界与失败情形，能因错误实现而失败；达到 L3 最低验证层。**

- oracle 测试为真对照：四场景实捕 fixture 缺失时 **throw 而非 skip**（不构成假绿）；逐字段/逐 TID 与 pageinspect 输出相等；TDD 曾抓到两处真问题（magic 初值、最右页无 hikey），证明测试有鉴别力。
- 守卫序测试显式验证优先级交叉（坏 oid+坏 blkno→NOT_INDEX；hash+坏 blkno→INDEX_NOT_BTREE），非仅单例覆盖。
- L3 冒烟自建种子（专用 schema 幂等自清理，实测连跑清理无残留）、重复度 [50,10,2] 重试产生 posting、逐元组逐 TID 比对。
- React 接线无组件测试基建：纯逻辑已全部抽取为 .test.ts（indexView/indexDetail/blockNav/diff/api +54 例），剩余视觉/交互归手测清单——处置符合 quality.md §6（记录原因/风险/恢复条件，未静默跳过）。

## 文档影响核对

| Plan 声明 | 实现是否一致 | 备注 |
|---|---|---|
| 开发文档（dev-notes、fixtures/README） | 一致 | dev-notes 含 T1–T10 逐任务证据、D1–D4 偏差表、遗留风险；fixtures README 含 --index 捕获步骤与四场景表 |
| 用户文档（README 双语） | 一致 | 两文件 +21/-12 对称；Features/Scope/Requirements/Quick start/Troubleshooting 逐节对应；「PG13+ 建议（dedup posting）」表述准确（btm_version 4 为 PG13+）；`INDEX_NOT_BTREE` 排障条目与实现 message/nextStep 一致 |
| 运维文档 | N/A 成立 | 本地单人调试工具，无部署/监控变更（Plan 已声明） |

手测 10 项均如实标注「待浏览器手测」，未冒充已验证——诚实性核查通过。

## 安全影响核对

| 检查项 | 结果 | 备注 |
|---|---|---|
| 敏感信息 | 通过 | fixtures `.meta.json` 仅含 rel/blkno/mode/capturedAt；oracle JSON 仅 pageinspect 输出；dev-notes/README 无连接串、主机名、凭据；`.env` 未入库 |
| 认证与授权 | N/A（无新增面） | 沿用既有本地连接模型，无认证变更 |
| 输入与外部访问 | 通过 | 新增 SQL 均只读 catalog 查询；oid 经 `$1` 参数化，qualifiedName/blkno 经 `get_raw_page($1,$2::int)` 参数化；`HEAP_BLOCK_SIZE` 插值为源码常量（8192）非用户输入；无外部网络访问 |
| 依赖变更 | 通过 | 仅新增 workspace 内部依赖 `page-core: workspace:*`（server devDep，供冒烟脚本；app.ts 运行时不 import，仍为透明 raw-page 代理）；无外部新依赖 |

处置状态：无未解决安全问题，允许进入 QA。冒烟 DDL（CREATE SCHEMA/TABLE/INDEX）限测试脚本专用 schema 且幂等清理，沿既有 heap smoke 先例，不违反「server 运行时只读」合同（app.ts 端点零 DDL/DML）。

## UI/UX 核对

对照方式：ui-design.md 合同逐条映射至代码（控件层级/文案/状态/键盘焦点/tab index 结构均为静态可核验项）；视觉呈现与交互手感**待 QA 手测**（下表标注）。

| 检查项 | 结果 | 备注 |
|---|---|---|
| 对照 Spec 界面验收（P0-1/2/4..9/12、P1 全部） | 通过（代码级） | 四要素 option/✕前缀/·invalid 徽标/inline hint/Load 禁用/页类型徽标+芯片/键字节 64B 截断+计数/posting 滚动列表（max-height 160px、计数完整）/空态文案逐字匹配 ui-design |
| 对照 `workflow/agents/standards/ui.md` | 通过（代码级） | 状态完整（初始/加载/空/成功/错误/部分失败均有呈现）；错误为 `code: message + Next:`；分段控件 aria-pressed、role=group、:focus-visible 沿用既有；警示条 warning 色非 error-panel |
| 对照 `ui-design.md` | 通过（代码级） | 控件同槽不新增纵向层级；heap 控件层级零改动；special/meta token=ui-design 指定派生式；deleted/half-dead t_tid 替代说明不跳转 |
| 主题/深色（Spec 要求 light/dark） | 待 QA 手测 | `--region-special/--region-meta/--warning` light/dark 各定义一次（styles.css:11-52），legend 色签与 cell 渐变齐备；两主题实际可读性（P1-5）须浏览器核验 |

**待 QA 手测项**（Reviewer 无法浏览器核验，不默认通过）：dev-notes 手测清单 10 项（选择/拦截/三页型加载/hex 双向定位/详情/导航跳表/Refresh diff/切换清除/light-dark/invalid）。

## 必修项

| ID | 位置 | 问题 | 状态 |
|---|---|---|---|
| — | — | 无 | — |

> 无阻塞项。以下为非阻塞建议（不影响进入 QA）：

## 发现项（按严重度）

| ID | 严重度 | 位置 | 问题 | 处置建议 |
|---|---|---|---|---|
| F1 | Low | apps/server/src/app.ts:425（及既有 :286/:323 同型） | 非数字 oid（`/api/indexes/abc/pages/0`）→ `Number()`=NaN → PG 22P02 → 400 `BAD_LSN`（WAL 相关 nextStep），误导而非 404 `NOT_INDEX`。**既有 `/api/tables/abc/pages/0` 行为完全一致（Reviewer 实测）**，属按 design「沿 tables 先例」延续的既有怪癖，非本项回归；Spec 对非数字 oid 无合同（P0-11 仅覆盖 blkno，正常） | 后续小项统一：oid 加 `Number.isFinite` 守卫 → NOT_INDEX（两端点一并修） |
| F2 | Low | packages/page-core/tests/btree-oracle.test.ts:71 | `btpo_cycleid` 断言固定 0 而非对照 oracle（`bt_page_stats` 无该列，无法对照）；cycleid 非零场景无实捕覆盖 | 风险极低（u16 直读无语义分支）；可留待后续捕获含 VACUUM 场景时补 |
| F3 | Info | 任务说明 | 提交数实为 11（非 12）；与 dev-notes 记录一致，无缺失 | 无需动作 |
| F4 | Info | apps/web/src/App.tsx:812（index select） | option 的 title tooltip 在 Chromium 不显示（浏览器限制）；Developer 已如实记录，四要素信息本体在 option 文本内不丢失 | 无需动作；QA 手测按 Firefox 或忽略 |

## 结论

**Approve**

- L2/L3 由 Reviewer 亲自复跑全绿（integration 退出码 0）；P0-1..P0-12 代码位置级核对通过；heap 零回退有源码级+全页 parity 证据；安全无未解决问题；文档双语一致；手测缺口已按 quality.md §6 如实记录且属 QA 阶段职责。
- Review 门禁（required）满足，可进入 QA。

## 后续动作与复审范围

1. Manager 调度 QA：按 plan 手测清单（10 项）+ L3 复跑 + P0/P1 抽验；`qa-report.md` 结论 Pass/Fail/Blocked。
2. QA 手测重点：P1-5 双主题可读性、hex 滚动定位、位格条 hover/聚焦/`?`、导航/跳表点击、Refresh diff 视觉形态、切换清除。
3. F1/F2 建议登记后续小项（不阻塞本项）；若 QA 阶段发现缺陷走 Developer 修复 → Reviewer 复审（范围限缺陷相关）。
4. review.md 按 git.md §1.4 留在工作区，QA Pass 待合并授权期间不提交。

---

## 复审轮次（QA 修复复审，2026-08-31）

### 范围

- 对象：提交 **c30bf92**（`fix(page-core): treat metapage as zero items per nbtree semantics`，单提交）。触碰 5 文件：`packages/page-core/src/btree.ts`、`src/fixture-builder.ts`、`tests/btree.test.ts`、`apps/web/src/diff.test.ts`、`dev-notes.md`（回执）。业务代码仅 page-core 两文件，web/server 源码零改动。
- 依据：qa-report.md 轮次 1（DEF-1 Open / DEF-2 已确认）、dev-notes「QA 轮次 1 缺陷修复回执」、spec P0-4/P0-9、ui-design（metapage 空态语义）、reviewer.md「QA 修复复审」要求。

### DEF-1 修复正确性（独立核对，非复述回执）

- **internal/leaf 不受影响**：ItemId 读取循环代码逐行未变，仅移至页分类之后并以 `pageType !== "meta"` 守卫；分类仅依赖 special space 的 btpo_flags/btpo_level，不依赖 ItemIds，顺序调整无副作用。special 不可读时降级为 leaf（ItemId 照读），heap 式降级路径保留。L3 实证：internal 137 downlinks / leaf 367 tuples / posting 11·1272 TIDs 断言全过；单测 corruptLpOffset（itemIdTotal=2）用例仍绿。
- **stats→web 一致性链条**：`stats.itemIdTotal/lp*` 均派生自 itemIds 数组 → meta 页归零；App.tsx:993 元信息条读 `btreePage.stats.itemIdTotal`，meta 空态文案无条件提供（App.tsx:1246）→ DEF-1b/c（结构图伪段、元信息条计数 12）在 web 零改动下自然消除，与 ui-design「metapage：无 ItemId / 元组」空态合同一致。
- **回归测试用实捕 fixture**：page-core 与 web 两处新增用例均加载 `fixtures/btree-meta.base64.txt` 并以 `expect(pd_lower).toBe(72)` 设防（真实捕获，meta.json 记录 2026-08-28 源自 pageview_fx.demo_uniq_k_idx），非仅 synthetic。断言覆盖：零 ItemId/stats 归零/无警告、结构字段无 itemid、[24..48) 逐字节反选 btm_*、64 反选 allequalimage、[48..64) 永不命中伪 itemid——与 DEF-1 三个症状一一对应。

### 规避检查

- **fixture-builder pd_lower 变更（24→72/64）判定为「让 synthetic 更真实」，非迎合实现**：独立对照 PG16 nbtree 布局推演——BTMetaPageData v4：6×u32(24B)+delpages u32@24+pad+float8@32..40+bool@40，MAXALIGN→sizeof 48，pd_lower=24+48=**72**；v3（无 allequalimage，PG11/12 结构）sizeof 40→**64**——与实捕 fixture 及本地 PG16.11 活捕页（均 72）吻合。方向上该变更使 synthetic 变**严**：若回归到泛型读取，synthetic meta 页也会产出 12 伪 ItemId 而被测试拦截（修复前 pd_lower=24 正是 QA 指出的盲区根因）；实现修复本身与 pd_lower 取值无关（meta 页无论 pd_lower 多少均 0 ItemId）。不存在以改 fixture 换绿灯的因果。
- **断言无弱化**：两测试文件 diff 为纯新增（103 insertions / 0 deletions），既有 170 例零改动且全绿。

### DEF-2 处置核对

不修复理由成立：spec「非目标」明列「修改 `/api/tables/*` 既有合同」，而该行为与 `/api/tables/abc` 同型（既有怪癖非本项回归）；单修 /api/indexes 会造成两端点行为分叉。处置与 QA 建议（后续小项统一加 `Number.isFinite` 守卫，即本报告 F1）一致。

### 独立验证证据（Reviewer 亲自执行，2026-08-31，本地 PG 16.11 socket /tmp:5432）

1. `pnpm test` → wal-core 13 · page-core **54** · server 31 · web **76**，共 **174 全绿**（既有 170 零回退）；
2. `pnpm -r typecheck` → 4 包零错误；`pnpm -r build` → 4 包 Done；
3. `pnpm test:integration` → **退出 0**（B-tree 六组断言全过含 metapage oracle；heap 段不回退；smoke 种子已清理）；
4. **活库独立复证**（自建 `review_iv_probe` 探针 schema + 新建 btree 索引，`bt_metap` 为 oracle，验后 DROP，残留 schema=0）：活捕 blk0 pd_lower=72、pageType=meta、ItemId=0、stats 全零、warnings 空；六字段+allequalimage 与 oracle 逐项相等；`findStructureAt` 于 [24..48) 逐字节命中各自 btm_* 字段、64 命中 btm_allequalimage、[48..64) 无伪 itemid。仓库实捕 fixture 同套断言同样全过。

### 发现项

| ID | 严重度 | 位置 | 问题 | 处置 |
|---|---|---|---|---|
| — | — | — | 无新增发现（[48..64) cleanup 字段未建模为可点字段属合同内行为：spec/ui-design 仅要求六字段+v4 allequalimage；测试已显式注明该区 null 为预期） | 无需动作 |

### 复审结论

**Approve**

- DEF-1 修复正确、无 internal/leaf 回退、无测试弱化、无 fixture 迎合；DEF-2 处置符合 spec 非目标；修复回执与实际提交一致。
- 后续建议：Manager 调度 **QA 轮次 2 回归**（范围：DEF-1 复测 + P0-4/P0-9 受影响面 + 手测清单浏览器补证项 3/4 + L3 复跑）；本报告按 git.md §1.4 留在工作区不提交。

---

## 复审轮次 2（用户需求变更：UI 文案英文化，2026-09-01）

### 范围与依据

- 对象：提交 **296dc44**（`fix(web): switch all user-visible UI copy to English`），分支 index-viewer。共 9 文件：apps/web/src 8 文件（App.tsx、IndexTupleDetail.tsx、StructureMap.tsx、blockNav.ts、indexDetail.ts、indexView.ts、indexView.test.ts、diff.test.ts）+ dev-notes.md（回执）；回执「8 文件」指 apps/web/src，一致。
- 依据：spec.md 修订记录 2026-08-31（UI 可见文案一律英文；「未连接」微扩授权）、ui-design.md「修订附页：英文文案表（2026-08-31，权威）」、dev-notes「UI 文案英文化变更回执」。

### 文案逐条对照（独立，非复述回执）

- diff 全部替换串与英文文案表逐字核对：**30 处中 29 处完全一致**（含插值变量 `{am}`/`{oid}`/`{n}`/`{start}..{end})`/`{total}`/`{count}`、em-dash、大小写与句点）。结构性转换均按表：warnings join `；`→`; `、magic `0x53162`→`0x053162`、TID 行 title 移除「（P1-3）」注记、ALT 位说明移除「（D3）」注记；JSX 两处折行拼接后逐字一致。
- 唯一表外串：`leaf: heap TID`（IndexTupleDetail.tsx:38）——表仅收录 internal 变体；旧中文即 `leaf：heap TID`，仅全角冒号→半角，语义未变（F5，Info，非阻塞）。
- 测试断言同步：indexView.test.ts 3 处期望串与新实现逐字一致；diff.test.ts 仅注释英文化。

### 遗漏检查

- `grep -rPn '[\x{4e00}-\x{9fff}]' apps/web/src` → **0 命中**；扩展 apps/web 全部 ts/tsx/css/html/json → 0；styles.css 伪元素 content 均为 `""`（无中文）。「未连接」→ `Not connected` 已改（App.tsx:613）；apps/server/src 与 packages/ 亦 0 命中，无服务端中文透出风险。

### 规避检查

- diff 除字符串字面量与纯格式折行（长英文串导致的 JSX 换行）外，**无逻辑/结构/样式改动**：className、条件分支、导入、数据流均未触碰。
- 测试仅换期望文案，断言数量/结构不变（3 处 `toBe` 原位替换，无删除/skip/放宽），非弱化。
- 两处代码注释英文化（IndexTupleDetail.tsx 头注、diff.test.ts 行注）属 ui-design 实现注允许的顺手范围。

### 独立验证（Reviewer 亲自执行，2026-09-01）

- `pnpm test` → wal-core 13 · page-core 54 · server 31 · web 76 共 **174 全绿**；
- `pnpm -r typecheck` → 4 包零错误；
- integration 未重跑：296dc44 未触碰 packages/ 与 apps/server/，纯文案替换不影响集成断言（上轮 c30bf92 已亲验退出 0）。

### 发现项

| ID | 严重度 | 位置 | 问题 | 处置 |
|---|---|---|---|---|
| F5 | Info | apps/web/src/IndexTupleDetail.tsx:38 | `leaf: heap TID` 无英文文案表条目（表仅含 internal 变体）；为旧中文直接转写，语义/标点规范未变 | 建议文档侧补录表项吸收；无需代码改动 |

### 复审结论

**Approve**

- 文案与权威表逐字一致（29/30，唯一表外串为旧串直接转写，非阻塞）；中文残留 0；规避检查通过（纯字符串替换、测试非弱化）；亲自验证 174 全绿 + typecheck 零错误。
- 后续建议：Manager 调度 **QA 轮次 3**（按 dev-notes 建议范围：文案对照、P0-2 hint、空态/警告语言、Not connected、既有回归）；F5 由文档同步顺带吸收。本报告按 git.md §1.4 留在工作区，不提交。

## 复审轮次 3（QA 修复复审：DEF-3，2026-09-01）

### 复审范围

- 提交 `6bf5191`（fix(web): use ASCII parens in metapage hint），对应 qa-report.md 轮次 3 缺陷 DEF-3 与 dev-notes「DEF-3 修复回执」。

### diff 范围核对（git show 6bf5191 逐行）

- `apps/web/src/StructureMap.tsx:696` 单行：`metapage（PageGetContents @24）` → `metapage (PageGetContents @24)`，仅全角括号 U+FF08/FF09 → 半角 ASCII；`·`（U+00B7）与其余文本不动，无逻辑/结构/样式改动。
- `workflow/archive/2026/index-viewer/dev-notes.md` 追加「DEF-3 修复回执」17 行，无既有内容改动。
- 无其它文件、无越界变更、无测试触碰。

### 独立验证（Reviewer 亲自执行，2026-09-01）

- 全角扫描 `grep -rPn '[\x{ff01}-\x{ff5e}\x{3000}]' apps/web/src apps/web/*.html` → **0 命中**；全部 css（`find apps/web -name '*.css'` 展开，含 src/styles.css 与 dist 产物）逐文件 → 0 命中。
- CJK 汉字扫描（U+4E00–9FFF，同范围 + css）→ **0 命中**，维持既有结论。
- `pnpm test` → wal-core 13 · page-core 54 · server 31 · web 76 共 **174 全绿**。

### 缺陷规避检查

- 修复为确定性字符串替换，非缩减测试或改变合同；断言/测试零触碰；dev-notes 回执与实况一致（本轮扫描亲证 0 命中）。

### 发现项

| ID | 严重度 | 位置 | 问题 | 处置 |
|---|---|---|---|---|
| F6 | Info | ui-design.md 文案表 | `metapage (PageGetContents @24) · v{...}` hint 无表条目（同 F5 先例） | 文档通道按 F5 方式补录；无需代码改动 |

### 复审结论

**Approve**

- DEF-3 修复范围与回执一致；独立扫描（全角/CJK）0 命中；174 全绿亲验。建议 Manager 调度 **QA 轮次 4**（复测 DEF-3 + 文案扫描复跑 + 快速回归）；F5/F6 由 Manager 文档同步顺带吸收。本报告按 git.md §1.4 留在工作区，不提交。

## 复审轮次 4（用户需求变更 2：Index 模式选择交互重构，2026-09-01）

### 复审范围

- 提交 `f8e650b`（feat(web): table-filtered index selection in Page mode），依据 spec.md 修订记录变更 2、ui-design.md「修订附页 2」（权威）与 dev-notes「变更 2 回执」。git 状态：变更已提交，review 报告留工作区。

### 修订附页 2 五条规则逐条核对（git show f8e650b 逐行）

1. **过滤器不加载/重置语义**：`onSelectIndexFilter` 仅 `setSelectedOid`（过滤输入，不发请求）+ `resetPageView()` + `setSchema(null)`；`indexSelectionSurvives`=false 时重置 `selectedIndexOid`，存活则保留。`onSwitchRelationKind` 补过滤存活复核（覆盖 Table 模式期间过滤器已变的路径）。✓
2. **All tables 全量/选中过滤**：`filterIndexesByTable` null→原列表、否则 `tableOid` 精确匹配；index select 渲染 `filteredIndexes`。✓
3. **过滤器选择复用 `selectedOid`**：与 Table 模式同一状态；切回 Table 模式即普通表选择（Table select 仅 `onSelectTable` 时加载，渲染不触发）。✓
4. **无索引禁用**：placeholder 禁用项 `No indexes for this table` + select 整体禁用（`filteredIndexes.length === 0`）+ Load 禁用（`canLoadIndexBlk` 要求 `selectedIndexOid != null`，零请求）+ 主区 muted 面板。✓
5. **后缀双态**：`formatIndexOption`/`indexOptionTitle` 可选 `omitTableSuffix`，接线 `selectedOid != null`；浏览全部态保留 `· → 表` 四要素（P0-1 修订），过滤态去后缀；select/option/Load 三处 title 同步传参。✓

### Table 模式零改动实证

- numstat App.tsx 77+/9-：全部 hunk 位于 imports、`filteredIndexes` memo、新 handler、`onSwitchRelationKind` +3 行、Index 分支 chrome 与 Index 面板；kind=table JSX 分支、`onSelectTable`/`loadBlk`、heap 面板零触碰。
- 唯一共享改动 `onSwitchRelationKind` 存活复核：纯 Table 流 `selectedIndexOid==null` 恒存活为 no-op；混合流重置为规则 1 明确要求，非回归。
- `filteredIndexes` 仅在 `relationKind === "index"` 分支消费。

### 断言强度

- indexView.test.ts 86+/0-：纯新增 11 用例（过滤 ×3、存活 ×3、option 文案 ×3、title ×2），既有断言零删除/零改写，非弱化。

### 独立验证（Reviewer 亲自执行，2026-09-01）

- `pnpm test` → wal-core 13 · page-core 54 · server 31 · web **87**（76+11）共 **185 全绿**；`pnpm -r typecheck` → 4 包零错误。
- CJK 扫描（U+4E00–9FFF）与全角扫描（FF01–FF5E/3000/2018–201D，apps/web/src + html）→ **0 命中**。
- integration 未重跑（抽查说明）：f8e650b 仅触碰 apps/web/* 与 workflow 文档，无 packages//apps/server 变更，API 合同不变（过滤为 client 侧），dev-notes 记录开发者已跑退出 0。

### 规避检查

- 无缩减测试、无合同规避：API/server/page-core 零改动；P0-12 清除链路（page/selected/highlight/diff/hex-locate + schema）在过滤器与分段切换两条路径均亲证存在。

### 发现项

| ID | 严重度 | 位置 | 问题 | 处置 |
|---|---|---|---|---|
| F7 | Info | apps/web/src/indexView.ts:64 | 过滤态 title 退化为裸 `qualifiedName`，修订附页 2 增补文案表未列该串（同 F5/F6 先例，串为中性标识符非语句） | 文档通道补录；无需代码改动 |

### 复审结论

**Approve**

- 五条规则逐条落实；Table 模式等价性有 diff 实证；+11 用例纯新增；185 全绿 + typecheck 零错误 + 双扫描 0 命中亲验。建议 Manager 调度 **QA 轮次 5**（按 dev-notes 建议复测范围：P0-1 双态、过滤器重置/保留语义、无索引表、Index→Table 切回、Table 模式回归、两主题渲染）；F5–F7 由文档同步顺带吸收。本报告按 git.md §1.4 留在工作区，不提交。

## 复审轮次 5（用户需求变更 3：Index 模式选择交互细化，2026-09-01）

### 复审范围

- 提交 `66c595f`（feat(web): empty-default table filter with indexed tables only），4 文件：`apps/web/src/indexView.ts`、`apps/web/src/App.tsx`、`apps/web/src/indexView.test.ts`、`dev-notes.md`（变更 3 回执）。纯 client 变更，API/server/page-core 零触碰。
- 依据：spec.md 修订记录变更 3、ui-design.md「修订附页 3（权威，取代附页 2 与 F7 补录冲突处）」、dev-notes「变更 3 回执」。

### 附页 3 五条规则逐条核对（git show 66c595f 逐行）

1. **table 过滤器**：`tableFilterOptions` 首位 `{tableOid: null, tableQualifiedName: ""}` 空默认（无「All tables」文本，grep 0 命中）；选项源改为 `tableFilterOptions(indexes)`——`tablesWithIndexes` 自 indexes 派生、tableOid 去重、**无 accessMethod 过滤（含仅非 B-tree 索引表）**、qualifiedName 排序 oid 决胜；title `Filter indexes by table` 不变（App.tsx:845）；禁用条件随数据源改为 `indexes.length===0 || loading-indexes`，一致。✓
2. **option 文本双态均无归属段**：`formatIndexOption` 收敛为单一形态 `qualifiedName (am · N blk)`（`omitTableSuffix` 分支整体删除）；`✕ ` 前缀 / ` · invalid` 后缀沿附页 1。✓
3. **option title 双态裸 qualifiedName**：`indexOptionTitle` btree+valid 分支返回 `idx.qualifiedName`；非 B-tree / invalid 沿附页 1（`{am}: only B-tree index pages are supported` / `indisvalid=false; loadable for inspection only`），与英文文案表逐字一致。✓
4. **防御路径保留**：`No indexes for this table` 禁用 option（App.tsx:879）+ 主区 muted 面板（:1214）+ Load 因 `selectedIndex==null` 禁用，本提交未触碰。✓
5. **沿附页 2**：`onSelectIndexFilter`（仅过滤不加载 + `resetPageView` + 存活判定）与 `onSwitchRelationKind` 仅注释更新，逻辑零改动；`filterIndexesByTable`/`indexSelectionSurvives` 语义未变。✓

### 归属性检查（死代码与文案）

- `omitTableSuffix` / `IndexOptionMode` / `All tables` 全 apps/web/src → **0 命中**，无残留死代码；`IndexRowLike.tableQualifiedName` 仍被 `tablesWithIndexes`/过滤器 option 消费，非死字段。
- 文案逐字比对：`public.orders_oid_idx (btree · 12 blk)`（测试期望）、title 裸 `public.orders_oid_idx`、`✕ ` 前缀、` · invalid` 后缀、`Filter indexes by table`、`No indexes for this table`——与附页 3/附页 1 文案表一致。

### Table 模式零改动实证（diff hunk 级）

- App.tsx 18+/25- 全部 8 个 hunk 逐一核验：import +1、3 处纯注释（memo/handler doc）、4 处 Index 分支 chrome（过滤器 select、index select title、option 循环、Load title）；kind=table JSX（App.tsx:770-800）、`onSelectTable`/`loadBlk`、heap 面板、Table select 数据源 `tables` 零触碰。
- indexView.ts 变更限于两个格式化函数签名简化（删可选参数）+ 新增两个纯函数，既有函数行为零改动。

### 断言强度

- web 87 → **93**（+6 净增：`tablesWithIndexes` ×4——去重/含非 B-tree 表/排序/空输入，`tableFilterOptions` ×2——空默认首位/仅空默认）。
- 改写的四要素/后缀断言属变更 3 合同修订（附页 3 取代附页 2 与 F7），且新断言经 `filterIndexesByTable(...).map(...)` 组合验证**双态同文案**，强度不低于原断言；无关既有断言零删除/零放宽；TDD 红（15 failed/78 passed）→ 绿（93/93）。

### 独立验证（Reviewer 亲自执行，2026-09-01）

- `pnpm test` → wal-core 13 · page-core 54 · server 31 · web **93** 共 **191 全绿**；
- `pnpm -r typecheck` → 4 包 Done、零错误；
- CJK（U+4E00–9FFF）与全角（FF01–FF5E/3000/2018–201D）扫描（apps/web/src + html）→ **0 命中**；
- integration 未重跑（抽查说明）：66c595f 仅触碰 apps/web/src 3 文件与 dev-notes，packages//apps/server 零变更，API 合同不变（table 列表 client 侧派生），开发者回执记录 integration 退出 0。

### 规避检查

- 无合同规避：需求由「删除双态分支 + 数据源换 indexes」正构实现，非删除断言或砍功能面；防御路径（规则 4）未以删码方式「满足」新规则。

### 发现项

| ID | 严重度 | 位置 | 问题 | 处置 |
|---|---|---|---|---|
| — | — | — | 无新增（空 label 默认选项为附页 3 规则 1 明确要求的形态） | 无需动作 |

### 复审结论

**Approve**

- 附页 3 五条规则逐条落实；归属性变更无死代码残留、文案逐字一致；Table 模式 hunk 级零触碰；+6 净增断言无弱化；191 全绿 + typecheck 零错误 + 双扫描 0 命中亲验。建议 Manager 调度 **QA 轮次 6**（按 dev-notes 变更 3 建议复测范围：P0-1 双态无归属 + title 裸限定名、过滤器默认空/仅列有索引表/可反选回全部、重置与存活、防御路径、Table 模式回归、两主题渲染）。本报告按 git.md §1.4 留在工作区，不提交。

## 复审轮次 6（用户需求变更 4：heap TID 跳转改为页内只读浮层，2026-09-01）

### 复审范围

- 提交 `2463576`（feat(web): heap page peek overlay for index TID jumps，基于 66c595f），9 文件：`heapPeek.ts`/`HeapPeekOverlay.tsx`/`heapPeek.test.ts`（新）、`App.tsx`、`StructureMap.tsx`、`blockNav.ts`、`blockNav.test.ts`、`styles.css`、`dev-notes.md`。纯 web 变更，API/server/page-core 零触碰。
- 依据：spec.md 修订记录变更 4（七点合同）、ui-design.md「修订附页 4：Heap 页检视浮层（权威）」、dev-notes「变更 4 回执」、ui.md GUI 底线。

### 七点合同逐条核对（git show 2463576 逐行）

1. **① 点击开浮层、不就地切换**：`onJumpToHeap` → `openHeapPeek(heapPeekRequest(pageView.index, block))`（App.tsx:1327-1331），仅写 heapPeek 槽 + nonce；旧 `jumpToHeap`（setRelationKind/setSelectedOid/resetPageView/setSchema/setBlkno/loadBlk 整段）删除。leaf TID 与 posting TID 行同经 `onJumpHeapBlock`（IndexTupleDetail.tsx:67-77 → StructureMap.tsx:766）汇入同一入口，触发文案 `Open blk {N} in owning table` 不变。✓
2. **② 标题 + 三关闭路径**：`overlayTitle` = `` `{tableQualifiedName} · blk {N}` ``；Esc（document keydown）/ ✕ / 遮罩 onClick 三路均汇 `onClose`（overlay 内 stopPropagation 防误关）。✓
3. **③ 三联区复用 + 独立切片 + 主视图零影响**：浮层内 selectedId/highlight/hexLocate 为组件局部 useState；`HeapPeekSlot = {request, nonce} | null` 不含任何主视图字段（测试断言 `Object.keys` 仅有 request/nonce）；开/关不触碰 pageView/selected/highlight/diffIds，P0-12 语义保全。✓
4. **④ 直接取页 + 浮层内错误 + 移除 TABLE_NOT_LISTED**：`Promise.all([fetchSchema(tableOid), fetchPage(tableOid, blkno)])` 无表列表前置守卫；错误态 `role="alert"` 面板 `{code}: {message}` + `Next: {nextStep}`；`PageParseError` → UNSUPPORTED_PAGE 亦在浮层内。`resolveJumpTable`/`heapJumpError` 删除，grep `jumpToHeap|TABLE_NOT_LISTED|resolveJumpTable|heapJumpError` 全 apps/ **0 命中**，无死代码。✓
5. **⑤ 只读检视**：浮层无 Load/blkno 输入/Refresh；`diffIds={EMPTY_DIFF_IDS}` 恒空；`HeapDetail` 不传 `onLoadCrossBlock` → ctid 行无跳转按钮、标注 `(cross-block; read-only peek)`（附页 4 规则 3 择一实现）。✓
6. **⑥ 就地 jumpToHeap 语义废止**：函数与守卫整体删除，见 ④ grep 实证。✓
7. **⑦ Table 模式与其余交互不变**：见下节 diff hunk 级实证。✓

### 附页 4 四条交互规则逐条核对

1. **三方式等价关闭、仅销毁浮层状态** — 关闭 = `setHeapPeek(null)` → 卸载（key=nonce 重挂载获新切片）；reducer `close` 从任一态回 closed（测试覆盖 loading/open/error 三态）。✓
2. **body 滚动锁 + 初始焦点 ✕ + 关闭返还** — mount 置 `body.style.overflow=hidden`、卸载恢复捕获的 prev；mount `closeBtnRef.focus()`；卸载 `triggerRef.current?.focus()`（`openHeapPeek` 捕获 `document.activeElement`）。✓
3. **浮层只读** — 见合同 ⑤。✓
4. **样式沿 token、light/dark 各一次、z-index 高于 chrome** — `--overlay-dim` 双主题 :root 各定义一次；surface/border/color-mix shadow；z-index 100 > conn-popover 20。✓（附页「--space 边距」为设计描述，代码库无此 token，0.75rem 沿库内既有间距惯例，语义等价。）

### Table 模式零改动实证（diff hunk 级）

App.tsx 全部 6 个 hunk 逐一核验：imports（1）、heapPeek 槽 state（1）、jumpToHeap→openHeapPeek+closeHeapPeek（1）、btree `onJumpToHeap` 接线（1）、`</main>` 后浮层条件渲染（1）——kind=table JSX（HeapDetail 于 App.tsx:1260 仍传 `onLoadCrossBlock`，跨块 Load 按钮路径原样）、`onSelectTable`/`loadBlk`/heap 面板零触碰。StructureMap.tsx 变更仅 `onLoadCrossBlock` 可选化 + 条件渲染（传入路径 JSX 逐字符等价）。blockNav.ts 仅删除两函数，`siblingNav` 零改动。

### 断言强度

- 总量 191 → **197**（web 93→99：移除 blockNav TABLE_NOT_LISTED 4 例 + 新增 heapPeek 10 例，净 +6）。
- 移除的 4 例断言对象（`resolveJumpTable`/`heapJumpError`）随合同 ④⑥ 整体废止删除，非弱化；替代行为有对应新增覆盖：错误路径（BLKNO_OUT_OF_RANGE 例断言 error 态保留 request 使标题可渲染）、三态关闭等价、陈旧响应不覆盖（open/error/closed × loaded/error 四组合）、标题与加载文案逐字、槽模型（nonce 递增重开、槽不含主视图字段）。无关既有断言零删除/零放宽。
- DOM 行为（焦点管理/滚动锁/遮罩点击）无组件测试基建——沿 T5 起记录的例外，纯逻辑已全部抽取进 heapPeek.ts 覆盖；已列入 dev-notes 建议复测范围（QA 轮次 7），恢复条件 = 引入 jsdom/@testing-library。可接受。

### 无障碍 / 键盘（ui.md GUI 底线）

- `role="dialog" aria-modal="true" aria-label={title}`；✕ 按钮 `aria-label/title="Close"`；全局 `:focus-visible` 规则（styles.css:101）覆盖浮层全部可聚焦控件，初始焦点在 ✕ 可见。
- 核心路径键盘可完成：触发为按钮、Esc/✕ 可关（ui.md Esc 语义满足）。非阻塞备注：未实现焦点圈闭（Tab 可越出浮层），`aria-modal` 的背景 inert 语义未由代码强制——桌面浏览器实际影响有限，留作后续增强建议，不阻塞。

### 独立验证（Reviewer 亲自执行，2026-09-01）

- `pnpm test` → wal-core 13 · page-core 54 · server 31 · web **99** 共 **197 全绿**；
- `pnpm -r typecheck` → 4 包 Done、零错误；
- grep 死代码扫描（见合同 ④）→ 0 命中；
- integration 未重跑（抽查说明）：2463576 仅触碰 apps/web/src 7 文件与 dev-notes，packages//apps/server 零变更，端点合同不变（schema+page 既有端点复用），开发者回执记录 integration 退出 0。

### 规避检查

- 无合同规避：TABLE_NOT_LISTED 守卫删除是需求变更 ④ 明文要求（其为就地切换选择列表的产物），替代路径（端点错误浮层内呈现）有新增断言覆盖；只读性以「不渲染跳转控件」正构实现而非隐藏。

### 发现项

| ID | 严重度 | 位置 | 问题 | 处置 |
|---|---|---|---|---|
| R6-1 | 建议（非阻塞） | HeapPeekOverlay.tsx | 无焦点圈闭（focus trap），Tab 可越出 `aria-modal` 对话框 | 建议后续迭代加 trap 或 Tab 循环；不影响本次 QA |

### 复审结论

**Approve**

- 七点合同与附页 4 四规则逐条落实（含 grep/断言实证）；Table 模式 hunk 级零改动；197 全绿（+6 净增、移除 4 例属合同废止有替代覆盖）+ typecheck 零错误亲验；焦点/键盘/滚动锁实现符合 ui.md 底线（R6-1 为非阻塞建议）。建议 Manager 调度 **QA 轮次 7**（按 dev-notes 变更 4 建议复测范围：浮层开/关/错误/焦点/Esc 三路径、只读性、主视图零影响、Table 模式回归、两主题、nonce 重置）。本报告按 git.md §1.4 留在工作区，不提交。

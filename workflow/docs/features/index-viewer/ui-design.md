# UI Design: index-viewer

> **UI 表面**：gui
> 依据 Spec：`workflow/docs/features/index-viewer/spec.md` · 依据 Design：`design.md` · 依据标准：`workflow/docs/standards/ui.md`
> 主题：沿用应用既有 light/dark 双主题（Spec「明确保留」节要求；新增区块复用/派生既有 token，不新增切换机制）。

## 目标与任务

- **主目标**：在 Page 模式内选择索引并浏览 B-tree 页（metapage/internal/leaf）的结构、hex 与元组详情，交互与 heap 页同构。
- **关键任务（优先级）**：切到索引选择 → 识别目标索引（含非 B-tree / 无效标记）→ Load（默认 blkno 0 = metapage）→ 扫读结构图 / hex / 详情三联区 → 经块导航或 heap TID 跳转继续探索。
- **信息优先级**：结构三联区 > 输入侧（关系种类 + 选择器 + blkno + Load）> 元信息条 > 详情面板；连接区（既有）不变。

## 信息架构与元信息

### 输入侧控件层级（chrome-controls 内，Page 模式）

```text
[ 表 | 索引 ]  ← 关系种类分段控件（新；默认「表」；样式同 Page|WAL 模式切换）
  ├─ kind=表（现状，零改动）：table select · blkno · Load · Refresh
  └─ kind=索引：
       index select（下拉，全局平铺）
         option 文案：schema.name (btree · 12 blk · → public.orders)
         非 B-tree option：前缀「✕」+ 原文案（hash · …）；title=「hash：仅支持 B-tree 索引页解析」
         无效索引 option：后缀「· invalid」徽标；title=「indisvalid=false，可加载，仅供检视」
       inline hint（选中非 B-tree 时显示，danger 色）：
         「hash 索引暂不支持页解析 — 仅支持 B-tree。请改选 B-tree 索引或切回表。」
       blkno（number input，默认 0；placeholder 提示 0=metapage）
       Load（选中非 B-tree 时 disabled + title 说明；B-tree 有效索引可点）
       Refresh（已加载索引页后可用，行为同 heap）
       loading-indexes spinner（列表请求期间，同 loading-tables 形态）
```

- 选择器单行可辨识四要素：qualifiedName、访问方法、块数、所属表（Spec 范围 1）；超长截断 + title 全文。
- 非 B-tree **可选不可加载**（Spec P0-2 合同：选中后 Load 禁用、不发请求、原因含访问方法名）；无效索引可选可加载。

### 元信息条（meta-stats，索引页加载后）

```text
index: public.orders_oid_idx (oid 24576) · am: btree · #blocks: 12
blkno: 0 · page: meta · level: —
lower/upper/free: 24/8104/8080 · ItemId: 0 · #tup: 0 (posting 0)
```

- 页类型徽标：`meta` / `internal·L2` / `leaf`；其后追加 P1-2 状态芯片（存在时）：`root` `deleted` `half-dead` `garbage` `split-unfinished`（btpo_flags 派生，次要字重）。
- heap 页元信息条不变（P0-10）。

### 主区三联结构（复用，布局不变）

```text
┌ 结构图（32B/行网格）────────┬─ Hex dump ────┐
│ header(9字段) → ItemId[] →  │ 与结构图双向   │
│ free space → index tuples → │ 高亮联动；     │
│ [meta 区仅 blkno0] →        │ Refresh diff   │
│ special space(8176..8192)   │ 高亮同 heap    │
├─ 选中详情（detail 面板）────┴────────────────┤
│ header/ItemId 详情：同 heap                 │
│ special 字段 + btpo_flags 位格条（新）       │
│ metapage 字段（新，仅 meta 页）             │
│ index tuple 详情（新）                      │
└─────────────────────────────────────────────┘
```

- **region 配色**：header/itemid/free/tuple 沿用既有 region token；新增 `special`（`color-mix(--accent 20%, --surface)`）与 `meta`（`color-mix(--region-header 60%, --region-free)`）两个派生变量，light/dark 各定义一次；legend 增两枚色签。P1-5 以两主题下正文对比可读为准（QA 手测点）。
- metapage 页结构图：ItemId 空区显示空态说明「metapage：无 ItemId / 元组；内容为 BTMetaPageData 元数据」（非错误）；无 tuple 叶页同理说明。
- special space 始终完整渲染（8176..8192 为数据区，不折叠；hex 同步）。

### 详情面板内容（选中驱动，复用 detail 折叠按钮）

| 选中对象 | 面板内容 |
|---|---|
| special 字段（任一） | 字段名+值+range；块导航：`btpo_prev` 值旁 `← Load blk N`、`btpo_next` 旁 `Load blk N →`（值为 0=P_NONE 时禁用并标注「leftmost/rightmost」） |
| `btpo_flags` | 值 hex + 位格条（hex + 位格 + hover/聚焦 tip + `?` 全量参考，合同同 pd_flags / infomask 基线；`FlagBitStripSolo` 复用） |
| metapage 字段（meta 页 `PageGetContents` 起） | `btm_magic`（hex）、`btm_version`、`btm_root`（`→ Load root`）、`btm_level`、`btm_fastroot`（`→ Load fastroot`）、`btm_fastlevel`；v4+ 另有 `btm_allequalimage`（v3 不显示） |
| index tuple（结构图或 hex 选中） | 见下节 |
| header / ItemId | 同 heap 现状 |

**index tuple 详情**：

```text
lp[3] index tuple · itemoffset 3
t_tid (4,2) [internal: 子页指针 → Load child blk 4] / [leaf: heap TID → 在 public.orders 打开 blk 7]
itemlen 24 · t_info 0x0018（size=24 · nulls · vars 位以列表/位格呈现）
标记：hikey（非最右页首 tuple）/ posting（N=42 tids）
键字节 [8024..8040) hex: 00 00 00 01 …（截断 64B + 全长计数；点击选中→hex 高亮）
posting TID 列表（可滚动区，max-height ~160px；每行 (blk,off) 可点击 → 跳所属表对应块；计数完整显示）
```

- t_info 位以「值 + 语义行」呈现（size/nulls/vars）；不再造第二套位格条组件，复用列表样式即可（信息量小）。
- 删除/半死页（deleted/half-dead）t_tid 区显示替代说明（此时 t_tid 语义被覆盖），不做子页跳转。

## 流程

1. 连接成功 → chrome 出现 `[ 表 | 索引 ]`；默认「表」，现状路径与提示不变。
2. 切「索引」→ 请求 `GET /api/indexes`（spinner）→ 平铺列表；旧页/选中/高亮/diff 立即清除（切回「表」同理，P0-12）。
3. 选中 B-tree 索引 → blkno 置 0；Load → `loading-page` → 三联区按页类型渲染；不做 `/schema` 调用。
4. 块导航（`btpo_prev/next`、子页 t_tid、`btm_root/fastroot`、posting/leaf heap TID）→ 点击加载/跳转；同索引内导航保留输入侧上下文；P1-3 跳表切换 kind=表并加载对应块。
5. Refresh → 字节 diff 高亮（行为同 heap，P1-4）。
6. 切换关系/种类/关系本身 → 回到步骤 2 的清除语义。

## 状态

| 状态 | 呈现 | 用户可执行动作 |
|---|---|---|
| 初始（kind=索引，未选） | 空提示面板「选择一个索引开始（blkno 0 为 metapage）」 | 选索引；切回表；连接区操作 |
| 加载中 | 列表 spinner（loading-indexes）或 Load 按钮 spinner + 主区保留旧布局骨架（不整页跳动） | 等待；Esc/再次切换取消触发 |
| 空态 | ① 无用户索引：「无用户索引（系统 schema 除外）」；② metapage/空叶页：结构图内说明性空态（非错误） | 改选；切表 |
| 成功 | 三联区 + 元信息条（页类型/level/统计） | 选中；导航；跳表；Refresh；diff |
| 错误 | 既有 error-panel：`code: message` + `Next: …`（含 `INDEX_NOT_BTREE`/`NOT_INDEX`/`BLKNO_OUT_OF_RANGE`/`BAD_BLKNO`/`PAGEINSPECT_MISSING`/`NOT_CONNECTED`/`UNSUPPORTED_PAGE`） | 按 nextStep 修正重试 |
| 部分失败（解析警告） | 结构图上方警示条（warning 色，非 error-panel）：「页数据异常：{原因}；可解析部分照常展示」；对应字段在详情标注 ⚠ | 继续浏览；换块；Refresh |

- 切换/加载失败不残留旧页选中态；错误与空态互斥呈现（错误优先）。

## 表面专属设计

### gui

- **布局与层级**：chrome/meta-stats/main 三层结构不变；索引输入控件占位与表路径同槽（不新增纵向层级）；detail 面板沿用底部可折叠。
- **密度与响应式**：等宽字体用于 blkno/tid/offset；option 文案超长截断 + title；窄屏（<960px）沿用既有堆叠规则，不为本项新增断点。
- **焦点与键盘**：

| 步 | 控件 | 键位 |
|---|---|---|
| 种类切换 | 表/索引分段 | Tab；Enter/Space |
| 索引选择 | select | Tab；Enter 展开；↑↓ 选择 |
| blkno | number input | Tab；Enter → Load |
| Load/Refresh | 按钮 | Enter/Space |
| 结构图字段 | field-cell | Tab；Enter/Space 选中（既有） |
| 块导航/跳表按钮 | 行内按钮 | Tab；Enter/Space |

  `:focus-visible` 沿用既有焦点轮廓；位格条 hover/聚焦 tip 沿用基线。
- **视觉语义**：danger=非 B-tree hint 与错误；warning=解析警示条；页类型徽标与状态芯片用次要边框芯片（不新增强色）；posting/hikey 标记为低饱和徽标，不与 diff 高亮色冲突。
- **主题策略**：不新增主题机制；新增 `special/meta` region token 于 light/dark 两块各定义；P1-5 验收点=两主题下特殊区/metag 区/徽标可辨读。

### cli

N/A（`UI 表面=gui`）。

## 与 Spec 验收映射

| Spec 验收 ID | 本设计落点 |
|---|---|
| P0-1 索引发现 | index select 平铺 option 四要素；系统 schema 由 API 口径排除 |
| P0-2 非 B-tree 客户端反馈 | option 可选 + inline hint（含访问方法名）+ Load 禁用、不发请求 |
| P0-3 服务端守卫 | 错误态呈现 `INDEX_NOT_BTREE`（实现层；UI 保证形状呈现） |
| P0-4 metapage | 页类型徽标 meta；详情字段六/七项；ItemId 空态说明 |
| P0-5 叶页 | leaf 徽标；ItemId/index tuples/special 区/btpo_flags 位格条 |
| P0-6 内页 | internal·LN 徽标；t_tid 子页指针按钮 |
| P0-7 高键 | 首 tuple `hikey` 徽标（最右页无） |
| P0-8 posting list | `posting` 徽标 + N + 滚动 TID 列表（计数完整） |
| P0-9 hex 双向联动 | 结构字段（含 special/meta）选中↔hex 高亮（复用既有机制） |
| P0-10 heap 不回退 | kind=表路径控件/行为零改动；切换清除语义 |
| P0-11 错误合同 | error-panel 形状；blkno 校验序呈现 |
| P0-12 切换反馈 | resetPageView 语义；元信息条随新关系刷新 |
| P1-1 块导航 | special/meta 详情与子页 t_tid 的 Load 按钮 |
| P1-2 特殊状态提示 | 页类型徽标旁状态芯片 |
| P1-3 heap TID 跳转 | leaf t_tid / posting TID 行点击 → 表模式加载对应块 |
| P1-4 Refresh diff | 复用既有 diff 高亮 |
| P1-5 主题可读 | special/meta token 双主题定义；QA 手测点 |

## 对 Plan / Developer 的要点

- 实施顺序：输入侧（种类切换+选择+清除语义）→ 三联区 btree 渲染 → 详情/位格条 → 导航/跳表 → 空态/警告/主题核验；每步对照上表验收项。
- 「零改动」红线：kind=表的控件层级、heap 详情面板、hex/位格条既有合同不得重排。
- 验证证据：手测清单（选择→加载→选中→导航→跳表→Refresh→两主题）写入 `dev-notes.md`；浏览器可联调时逐项勾选。

## 开放阻塞

无。Spec 已含全部必要界面合同（元信息字段、错误形状、双主题保留、列表口径、P1 裁决）。

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-08-28 | 初稿：控件层级、三联区复用、状态表、验收映射 |
| 2026-08-31 | 用户需求变更（合并授权前）：**UI 可见文案一律英文**（见 spec.md 修订记录）。本文此前冻结的中文文案作废，以下英文文案表为唯一权威；布局/层级/状态不变 |

## 修订附页：英文文案表（2026-08-31，权威）

所有用户可见字符串必须为英文。对应关系（旧中文 → 新英文）：

| 位置 | 英文文案 |
|---|---|
| 分段控件 | `Table` / `Index` |
| 非 B-tree option title | `{am}: only B-tree index pages are supported` |
| invalid option title | `indisvalid=false; loadable for inspection only` |
| 非 B-tree inline hint（danger） | `{am} index page parsing is not supported — B-tree only. Pick a B-tree index or switch back to a table.` |
| 空索引列表（option + panel） | `No user indexes (system schemas excluded)` |
| 索引初始空态 | `Pick an index to start (blkno 0 is the metapage).` |
| 索引加载提示 | `Enter a blkno and Load (0 = metapage).` |
| 页数据异常警示 | `Page data anomalies: {warnings joined by "; "}. Parseable parts are shown as-is.` |
| metapage 空态（结构图） | `metapage: no ItemIds / tuples; content is BTMetaPageData` |
| metapage 字段区 hint | `metapage (PageGetContents @24) · v{n}`（复审 F6 补录） |
| 空叶页空态（结构图） | `empty page: no index tuples; no key data, structure still browsable` |
| internal t_tid 说明 | `internal: child page pointer` |
| leaf t_tid 说明 | `leaf: heap TID`（复审 F5 补录） |
| 键字节 title | `Key bytes [{start}..{end}) — click to highlight in hex` |
| 键字节空值 | `(empty)` |
| 键字节截断计数 | `… {total} bytes total (showing first 64)` / `{total} bytes total` |
| posting TIDs 标题 | `posting TIDs ({count}, count complete)` |
| TID 行 title | `Open this block in the owning table` |
| 跳表按钮 | `Open blk {n} in owning table` |
| posting 解析失败警示 | `⚠ posting TID list parse failed (out of range); count preserved` |
| special 不可读警示 | `⚠ special space unreadable (invalid pd_special)` |
| magic 不符警示 | `⚠ btm_magic does not match 0x053162 — metadata may be untrustworthy; parseable parts are shown as-is` |
| 跳表失败 message | `Target table not in table list: oid {oid} (owning table {name}); it may be in a system schema or dropped` |
| 跳表失败 nextStep | `Switch to Table and select the target table manually.` |
| t_info ALT 位说明 | `set — posting list: t_tid reinterpreted as TID count + list offset` / `set — pivot tuple: t_tid reinterpreted as pivot metadata (heap TID + attribute bits)` / `unset — t_tid is a plain pointer` |
| t_info VAR/NULL 位 meaning | `variable-length key columns present (vars)` / `key contains NULLs (nulls bitmap present)` |
| t_tid 角色 note（deleted/half-dead） | `deleted / half-dead page: t_tid bytes are reused (non-pointer); jump disabled` |
| t_tid 角色 note（posting） | `posting tuple: t_tid encodes TID count and list offset; use the TID list rows below to jump` |
| t_tid 角色 note（pivot/hikey） | `pivot tuple (e.g. hikey): t_tid is pivot metadata, not a jumpable pointer` |
| metapage 无 tuple note | `no index tuples on metapage` |
| main 既有未连接文案 | `Not connected`（用户授权一并英文化） |

实现注：测试断言随文案同步更新（属需求变更，非测试弱化）；代码注释中文可顺手英文化但不强制。

## 修订附页 2：Index 模式选择交互（2026-08-31，权威，取代初稿「输入侧控件层级」中 kind=索引分支）

Table 模式分支不变（现状零改动）。Index 模式 chrome 控件层级：

```text
[ Table | Index ]                    ← 分段控件（不变）
  └─ kind=Index:
       table select（过滤器，含默认项 "All tables"；复用表列表数据源；选择仅过滤，不加载页面）
       index select（下拉）
         未选 table（All tables）：列全部用户索引；option 文本保留所属表后缀
           schema.name (btree · 12 blk · → public.orders)
         已选 table：仅列该表索引；option 文本去除所属表后缀
           schema.name (btree · 12 blk)
         非 B-tree / invalid 标记、hint、Load 门控、Refresh、spinner 均沿修订附页 1 合同
       blkno · Load · Refresh（不变）
```

交互规则：

1. 过滤器或分段控件切换后：若当前所选 index 不在新列表中 → 重置 index 选择与页面视图（page/selected/highlight/diff，同 P0-12 语义）；仍在列表中则保留 index 选择但清除未加载状态不强制（页面视图仍按 P0-12 清除）。
2. 过滤后该表无索引：index select 显示禁用项 `No indexes for this table`；Load 禁用。
3. Table select 在 Index 模式下的选择仅为过滤输入；切回 Table 模式时该选择保留为普通表选择（输入态，不自动加载）。
4. 空态/文案补充（英文文案表增补）：

| 位置 | 英文文案 |
|---|---|
| table 过滤器默认项 | `All tables` |
| 过滤后无索引 option（禁用） | `No indexes for this table` |
| table 过滤器 title（Index 模式） | `Filter indexes by table` |

5. 选项文本简化裁决（Manager，2026-08-31）：过滤态去后缀、浏览全部态保留——保持 P0-1 可辨识目的；如用户要求全部去除，仅改 indexView 文案拼接一处。

| 位置（Index 模式） | 英文文案（F7 补录；DEF-4 澄清后定稿，与实现 indexView.ts 逐字一致） |
|---|---|
| index option 文本（浏览全部态） | `schema.name (am · N blk · → owner)`；✕ 前缀 / ` · invalid` 后缀沿附页 1 |
| index option 文本（过滤态） | `schema.name (am · N blk)`（去所属表段） |
| index option title（btree 有效，浏览全部态） | `qualifiedName · → tableQualifiedName` |
| index option title（btree 有效，过滤态） | `qualifiedName`（裸限定名） |
| index option title（非 B-tree / invalid） | 沿附页 1，不受过滤影响 |

## 修订附页 3：Index 模式选择交互细化（2026-08-31，权威，取代附页 2 与 F7 补录中与之冲突处）

1. **table 过滤器**：无「All tables」文本项；**默认为空选项**（空=不过滤=全部索引）；选项**仅列出拥有索引的表**（含仅非 B-tree 索引的表；client 从 indexes 派生 tableOid 去重）；title 沿 `Filter indexes by table`。
2. **index option 文本**：全量与过滤态**均无归属段**——`schema.name (am · N blk)`；✕ 前缀 / ` · invalid` 后缀沿附页 1。
3. **index option title**：btree 有效——全量与过滤态均为 `qualifiedName`；非 B-tree / invalid 沿附页 1，不受过滤影响。
4. 「No indexes for this table」空态保留为防御路径（如列表刷新后索引消失的瞬态）。
5. 其余交互规则（重置/存活、过滤不加载、Table 模式零改动）沿附页 2。

## 修订附页 4：Heap 页检视浮层（2026-08-31，权威）

**触发**：Index 模式下 leaf tuple TID 行 / posting TID 列表行的既有可点元素（文案 `Open blk N in owning table` 不变）；点击打开浮层（不再就地跳转）。

**结构**：

```text
┌ 遮罩（backdrop，半透明 dim，点击关闭）────────────────────┐
│ ┌ 浮层（近全屏：四周留 --space 边距，max 尺寸受视口约束）──┐ │
│ │ 标题栏: {tableQualifiedName} · blk {N}        [✕ Close] │ │
│ │ 内容区（内部滚动）: 三联区（结构图 | hex | 详情）堆页渲染  │ │
│ │  - loading: spinner + `Loading blk {N}…`                 │ │
│ │  - error:   `{code}: {message}` + `Next: {nextStep}` 面板 │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**交互规则**：
1. Esc / ✕ / 遮罩点击三种方式等价关闭；关闭仅销毁浮层状态，主视图不动。
2. 打开时 body 滚动锁定；初始焦点置 ✕；关闭后焦点返还触发元素。
3. 浮层内堆页为只读检视：无 Load/blkno 输入/Refresh/diff/二级跳转（含其中 ctid 点击不导航，标注 title 即可或不渲染跳转按钮——实现择一，保持只读）。
4. 样式沿既有 token（surface/border/shadow/dim），light/dark 各定义一次；z-index 高于 chrome。

**文案表增补（英文）**：

| 位置 | 英文文案 |
|---|---|
| 浮层标题 | `{tableQualifiedName} · blk {N}` |
| 关闭按钮（aria-label/title） | `Close` |
| 加载态 | `Loading blk {N}…` |
| 错误态 | 沿既有错误呈现合同（`{code}: {message}` + `Next: …`） |

# Design: page-diagram-32b

## 背景

在已合入的 `pg-page-viewer` 之上，将主视图从**区块列表**改为 **32 字节一行**的页结构图，并与 hex（同行宽 32B）共用单一 `ByteRange` 双向联动。路径 `full`；Spec 与 Q1–Q6 已由工作项记录确认。本 Design 只定模块边界、分层、选型与数据流；布局/交互见 `ui-design.md`。

**第二轮增量（2026-07-26）**：第一轮（P0-1..P0-9、Q1–Q6）已实现于源分支 `page-diagram-32b`。本次增补 P0-10（格内可读值）、P0-11（详情与格内同源）、P0-12（hex 自动定位）与 Q7（折叠时先自动展开再定位）的结构决策，见「增量决策（第二轮）」。**既有决策不推翻**：DOM + CSS Grid、App 单一权威 `ByteRange`、`deriveStructureFields`/`resolveFieldAt` 派生进 `page-core`、ItemId 位域选中整 4B、free 折叠断裂带不铺空行。增量基线为**当前文件现状**（含工作区未提交改动，见「对 Developer」与 `plan.md` T10）。

**约束摘要（不可偏离）**

- 垂直：低偏移在上（header → ItemId → free → tuple），与 hex 同向；禁止整页倒置（Q1）。
- 行宽：结构图与 hex 均为 32B/行；8KB → hex 256 行（Q6）。
- Free：折叠仅为 UI 态；紧凑断裂带 + 真实 `[start,end)`/字节数；不为折叠区铺满空 32B 行；展开仍空洞压缩（Q5）；禁止破坏字节映射。
- API：**N/A**；沿用 raw + schema；禁止仅下发预渲染图。`page-core` 解析语义保留；本项预期纯前端。
- 值模式：仅当完整主显示串可无溢出、无省略截断落入该格时进入；否则回退 Q2 标签模式。**禁止**合并字段边界或截断主串冒充「宽度足够」（P0-10）。
- 格内主值与 Selection detail 主值**必须同源同格式**；禁止两套解读（P0-11）。
- Hex 自动定位仅由**非 hex 面板**发起的选中变化触发，每次变化最多滚动一次；区间未变或首字节行已可见时禁止强制再滚（P0-12）。
- 非目标：连接/表目录/API、主题合同、infomask 常驻图注（P0；可选 P1-3）、像素复刻、新造与详情/解析层不同的数值格式体系。

## 方案对比与决策

### 1. 结构图渲染技术

| 方案 | 概要 | 优点 | 缺点 |
|---|---|---|---|
| A | **DOM + CSS Grid（每逻辑 32B 行为一 grid；字段为跨列 cell）** | 原生点击/键盘/`title`/ARIA；跨行字段 = 多片段同 `fieldId`；样式与既有 token 一致；调试易 | 节点数随字段数增长；超长 ItemId 数组需注意密度 |
| B | SVG 单画布 | 精确矢量边框 | 命中测试与 a11y 自建；与现有 React 详情区割裂 |
| C | Canvas | 大页绘画像素快 | 命中/键盘/选中同步成本高；不符本工具可访问底线 |

**决策: A（DOM + CSS Grid）**。8KB 页字段级 DOM 远小于「每字节一节点」；free 折叠/压缩不生成空行。若后续实测主线程卡顿，再对 **hex**（固定 8192 可点目标）做虚拟化，结构图优先保持 DOM。

水平：列 = 字节槽 `0..31`。字段 `[start,end)` 切成按行片段；片段列跨度 = 该行内字节数。禁止为美化合并相邻不同字段边界（Q2）。

### 2. 选中状态与同步

| 方案 | 概要 | 优点 | 缺点 |
|---|---|---|---|
| A | **App 持有 `selectedId` + 权威 `highlight: ByteRange`；结构图与 hex 只读渲染** | 与现网一致；单一真相；diff 样式可并存 | 须把 `findStructureAt` 升到字段级 |
| B | 结构图/hex 各持选中再同步 | — | 双真相，易漂移 |
| C | 仅存 fieldId，双方各自算 range | 少存一份 | 易算岔；违反「单一 ByteRange」合同 |

**决策: A**。

- 结构图点击片段 → `onSelect(fieldId, field.range)` → 更新二者。
- Hex 点字节 → `resolveFieldAt(page, offset)`（字段级；未映射则单字节 range，与现行为兼容）→ 同步 `selectedId` + `highlight`。
- 跨行：同一 `fieldId` / 同一 `ByteRange`；任一片段或区间内任一字 → 全片段 + hex 连续区间高亮（Q3 / P1-2）。
- Diff：既有 `diffIds` / `--diff`；与选中 / `--hex-hl` 可区分（样式归 UI）。

### 3. 字段级字节映射的数据结构

现状：`ParsedPage` 仅有粗粒度 `range`（整 header / 整 ItemId / 整 tuple / free）；`StructureMap` 按块列表渲染；`findStructureAt` 只命中块。

Spec 要求可点字段边界。**不改变** `parsePage` 对字节的解释；**增量**派生可选择单元：

```text
StructureField = {
  id: string;           // 稳定：如 header.pd_lower、itemid-3、itemid-3.len、tuple-1.t_xmin、free
  label: string;        // 展示名（可缩写）
  fullLabel: string;    // tooltip/详情全文
  range: ByteRange;     // 半开、页内绝对偏移；hex 与高亮权威
  region: "header" | "itemid" | "free" | "tuple";
  parentId?: string;    // 可选：子段归属（如 ItemId 视觉子标签）
  valueText?: string;   // 可选：单行主显示串（见决策 6；缺省 = 恒标签模式）
}
```

| 方案 | 概要 | 优点 | 缺点 |
|---|---|---|---|
| A | **纯函数 `deriveStructureFields(page): StructureField[]` 放 `page-core`；web 只布局** | Vitest 可测映射；与「区间映射」职责一致；不改 API/解析语义 | core 表面略增 |
| B | 仅在 `apps/web` 内联偏移表 | 零 core 改动 | 映射难单测；易与 parse 偏移漂移 |
| C | 改 `parsePage` 输出树替换现类型 | — | 风险大；易被视为改解析合同 |

**决策: A**。`parsePage` / `decodePageTuples` 行为与返回值语义不变；`deriveStructureFields` 只读 `ParsedPage`（及已知 PG 布局常量，与 `parse.ts` 同源）。

**区域规则**

| 区域 | 字段单元 | `range` 规则 |
|---|---|---|
| Header | `pd_lsn` 可分 xlogid/xrecoff、checksum、flags、`pd_lower`/`pd_upper`/`pd_special`、pagesize/version、`pd_prune_xid` 等 | 各子字段真实字节区间（与现解析偏移一致） |
| ItemId | 每 slot 至少可选中；UI 画 `off`/`flag`/`len`（或等价）视觉分段 | **位域共享 4 字节**：任一段选中 → 该 ItemId 的完整 4B `range`（字节级唯一真相）；LP 状态仍可辨 |
| Free | 整段 `[pd_lower, pd_upper)` | 已有 `freeSpace.range` |
| Tuple | `t_xmin`/`t_xmax`/`t_cid`、ctid 组成、`infomask`/`infomask2`、`hoff`、用户数据（按列 `DecodedColumn.range` 或整块 `dataRange`） | 与 parse/decode 已有区间一致；未知/TOAST 沿用基线 |

窄标签：格内缩写；全文经 `fullLabel` → tooltip 和/或详情区（Q2 / P1-1）。**禁止**合并相邻不同字段的边界。

### 4. 32B 行模型与 free 折叠共存

| 概念 | 合同落实 |
|---|---|
| 逻辑行 | `row = floor(offset / 32)`；行内列 = `offset % 32`；字段切分为每行至多一段 |
| Hex 行 | 恒为 `ceil(pageSize/32)`；行首 = 行首字节偏移，hex ≥4 位；与折叠无关（Q6） |
| 结构图行高 | **非**「256 行等比画布」。有字段的逻辑行渲染 grid；free 占用区：展开 = 既有空洞压缩条；折叠 = 更矮断裂带 + 标签 + `[start,end)`/字节数（Q5） |
| 折叠态 | `freeCollapsed: boolean` 仅 web；不改 `ParsedPage`、不改 hex 内容/行数 |
| 映射 | 选中始终用真实 `ByteRange`；布局 Y 与偏移解耦（延续基线「布局坐标 ⊥ 字节区间」） |

| 方案 | free 折叠实现 | 取舍 |
|---|---|---|
| A | **条件渲染：折叠时用单行 `FreeSpaceBand` 替换 free 的多行/压缩区** | 简单；天然不铺空 32B 行 |
| B | 仍生成 free 覆盖的全部逻辑行再 `display:none` | 易误铺空行；违背 Q5 |

**决策: A**。

### 5. 模块边界

```text
apps/web
  StructureMap（重写为 32B 结构图）──▶ deriveStructureFields / resolveFieldAt
  HexDump（16→32；地址 Q6）
  App（selectedId + highlight；freeCollapsed；接线不变）
  diff.ts（structureAffectedByDiff 可升到字段 id；粗粒度仍可）
       │
       ▼
packages/page-core
  parse / decode（语义不变）
  + deriveStructureFields, resolveFieldAt（或等价命名）
  ByteRange（已有）

apps/server ─ 本项不改（API N/A）
```

| 允许 | 禁止 |
|---|---|
| 重写/拆分 `StructureMap`、改 `HexDump`、App 增加折叠态与字段级 resolve | 删减基线 flag/列解码/HOT/ctid/刷新对比/主题/元信息 |
| core 增加派生字段列表与命中函数 + 单测 | 改 pages API 主载荷；服务端预渲染结构图 |
| 局部 CSS（结构图/hex） | 整页倒置；为美化合并字段边界；折叠破坏 hex 映射 |

## 增量决策（第二轮：P0-10..P0-12 / Q7）

### 6. 格内主值的来源（P0-10 / P0-11）

现状：`StructureField` 只有 `label` / `fullLabel`；Selection detail 显示 `fullLabel` 与既有 flag/列子块；**无**任何字段主值格式化点。

| 方案 | 概要 | 优点 | 缺点 |
|---|---|---|---|
| A | **`deriveStructureFields` 增补可选 `valueText`（单一格式化点，page-core）；结构图格与 Selection detail 同读该串** | 同源同格式即结构性保证（P0-11 无法漂移）；可 Vitest 锁格式；纯增字段，不改解析语义 | `page-core` 需持有展示串（已有 `fullLabel` 先例） |
| B | web 内各自格式化（格内一处、详情一处） | 无 core 改动 | 两套解读风险（违反 P0-11）；难单测 |
| C | 新增独立格式化包/层 | 职责纯净 | 为一组标量新增分层，收益不抵成本 |

**决策: A**。`StructureField` 增补 `valueText?: string`（**可选**，缺省表示该字段无单行主显示串，恒为标签模式）。`parsePage` / `decodePageTuples` 语义与返回值不变；`valueText` 只由已解析值组装。web **禁止**为结构图或详情另写主值格式化。

**格式表（沿用既有「可读格式」，不新造体系）**

| 字段 | `valueText` |
|---|---|
| `pd_lsn.xlogid` / `pd_lsn.xrecoff` | 沿用既有 `header.pd_lsn` LSN 展示的对应段 |
| `pd_checksum` / `pd_flags` | `0x` 十六进制 |
| `pd_lower` / `pd_upper` / `pd_special` | 十进制 |
| `pd_pagesize_version` | `<pageSize>/<pageVersion>` |
| `pd_prune_xid` | 十进制（xid） |
| ItemId slot（parent，4B） | `off=<offset> len=<length>`（与 `fullLabel` 中同一数值来源与格式） |
| ItemId `off` / `flag` / `len`（`visualOnly`） | 十进制 / `0x` 十六进制 / 十进制；与 parent 同源 |
| `t_xmin` / `t_xmax` / `t_cid` | 十进制 |
| `t_ctid` | `(<block>,<offset>)`（与详情 ctid 同格式） |
| `t_infomask` / `t_infomask2` | `0x` 十六进制 |
| `t_hoff` | 十进制 |
| 列字段 | `NULL`（`col.null`）否则解码层 `col.display`；`toasted` 追加与详情相同的 TOAST 标记 |
| `free` / `nullbits` / `data` 等无单行主串 | **不设** `valueText` → 恒标签模式 |

### 7. 「宽度足够」的判定机制（P0-10）

| 方案 | 概要 | 优点 | 缺点 |
|---|---|---|---|
| A | **单点度量 + 纯判定函数**：每渲染批次度量一次（字符宽 + 字节列宽），`page-core` 纯函数按字符预算判定 | 随视口/缩放自适应；判定可 Vitest 锁定；O(1) 度量，无逐格布局抖动 | 需一个度量 hook 与 1 字符安全余量 |
| B | 把字节列宽固定为 `ch` 单位，预算写成静态常量 | 完全无度量 | 需改 `1fr` 弹性网格为固定列；字体回退时预算失真 |
| C | 逐格两遍渲染（先渲染值再比较 `scrollWidth`/`clientWidth`） | 最贴近真实渲染 | 数百格两遍布局 + 闪烁；难单测 |
| D | 纯 CSS（container query / `text-overflow`） | 无 JS | 无法按文本长度择内容，只能截断——违反 P0-10 |

**决策: A**。

- 度量：结构图内一个隐藏等宽探针得到 `charWidthPx`；对一行 `.structure-row-grid` 度量得到 `byteColWidthPx`（= (网格宽 − 31×gap) / 32）；`ResizeObserver` 在容器尺寸/缩放变化时重算。度量只发生在 web（DOM 层）。
- 判定：`page-core` 增纯函数（DOM 无关，与既有 `splitFieldIntoRowSegments`、`STRUCTURE_BYTES_PER_ROW` 同层）：
  - `cellCapacityChars(spanBytes, metrics)` → 该格内容区可容纳的等宽字符数，减去内边距/边框与 **1 字符安全余量**；
  - `chooseCellContent({ label, valueText, capacityChars })` → `{ mode: "value", showLabel }` 或 `{ mode: "label" }`。规则：`valueText` 存在且 `valueText.length ≤ capacity` → 值模式；此时标签行独立判定（缩写后 `≤ capacity` 才并存，否则仅值 + tooltip/详情提供名称）。否则标签模式。
- 跨行字段：**按片段**判定，`valueText` 只在**最宽片段**（并列取最低偏移）渲染一次，其余片段保持标签模式；避免同一值重复出现或被行边界截断。
- CSS 不变量：值元素 `white-space: nowrap`；格 `overflow: hidden` 防止侵入邻格；值模式**不得**依赖 `text-overflow: ellipsis` 兜底（省略即判 P0-10 失败）。安全余量与 `ResizeObserver` 共同保证不出现裁切。
- 标签缩写沿用 web 现有 `abbreviateLabel`（Q2），不上移 core。

### 8. Hex 自动定位机制（P0-12）

| 方案 | 概要 | 优点 | 缺点 |
|---|---|---|---|
| A | **hex 滚动容器上 `scrollTo`，目标由行几何算术算出（纯函数）** | 只滚 hex 容器，不牵动 `.main`（布局稳定）；可精确近顶 1/3；「已可见 → 不滚」易判定并可单测 | 需自算目标位置 |
| B | `rowEl.scrollIntoView({ block: "center" })` | 一行代码 | 会连带滚动祖先滚动容器，结构图跳动；无 1/3 控制；难表达「已可见不滚」 |
| C | 引入虚拟化列表的 `scrollToIndex` | 顺带解决性能 | 引入虚拟化属既有性能储备项，超出本次增量 |

**决策: A**。

- 几何：hex 行高恒定，度量首行高度一次，`firstRow = floor(start / 32)`、`lastRow = floor((end − 1) / 32)`，无需为 256 行持有 ref。
- 纯函数（`page-core`）：`computeHexScrollTarget({ firstRow, lastRow, rowHeightPx, containerHeightPx, contentHeightPx, currentScrollTop, anchorRatio = 1/3 })` → `number | null`。`null` 表示**不滚**（首字节行已完整可见）。否则目标 = `rangeTop − anchorRatio × containerHeight`，并夹取到 `[0, contentHeight − containerHeight]`；当整段高度 ≤ 容器高度时再夹取使 `rangeBottom` 也可见（末尾行不足一屏时以内容末端为界）。
- 触发与防循环：App 持 `hexLocate: { offset, nonce } | null`。选中入口统一走 `selectByteRange(id, range, origin)`；`origin === "hex"` **不**产生 locate；`origin !== "hex"` 且 `range` 与当前权威 `highlight` **不同**时 `nonce + 1`。`HexDump` 的 `useEffect` **只**依赖 `nonce`（不依赖 `highlight` 对象标识），因此重渲染、用户手动滚动、同区间重复点击均不触发滚动。
- 动效：`scrollTo({ behavior })`，`prefers-reduced-motion: reduce` 时用 `auto`。
- 范围：只滚动 hex 滚动容器（Spec 合同即为「进入 hex 滚动容器可视区」）。**允许**（非验收要求）在 hex 面板整体完全位于 `.main` 视口之外时，附带一次最小幅度的 `.main` 滚动使 hex 面板可见；部分可见时**禁止**滚 `.main`。

### 9. Hex 折叠态自动展开与状态归属（Q7）

- `hexCollapsed`（已有）与 `hexLocate`（新增）均归 **App**；`HexDump` 保持只读渲染 + 自身容器 ref，不持选中或折叠真相。
- Q7：`origin !== "hex"` 的选中变化发生时，若 `hexCollapsed === true`，App 在同一次处理中 `setHexCollapsed(false)` 并递增 `nonce`。`HexDump` 重新挂载后其 effect 首次运行即执行定位——**先展开、后定位**，无需额外时序编排（禁止用 `setTimeout` 猜测时序）。
- 折叠按钮文案与 `aria` 状态由同一 `hexCollapsed` 派生，自动展开后即刻一致（可发现性见 `ui-design.md`）。

### 10. 增量纯逻辑的测试归属

| 方案 | 概要 | 优点 | 缺点 |
|---|---|---|---|
| A | **判定/几何纯函数放 `page-core`，DOM 度量留 web** | 复用既有 `pnpm --filter page-core test`，零新工具链；与 core 已有 32B 行/列布局纯函数同层（先例：`splitFieldIntoRowSegments`） | core 表面再增两个视图无关的纯函数 |
| B | 为 `apps/web` 引入 vitest 后就地单测 | 归属更纯 | 新增工具链与根 `test` 脚本改动，本次增量收益不抵成本 |

**决策: A**（B 记为备选：将来需要组件级测试时再引入）。

## 关键数据流

```text
raw + schema → parsePage / decodePageTuples → ParsedPage
                    │
                    ▼
         deriveStructureFields(page) → StructureField[]（含可选 valueText）
                    │
        ┌───────────┴───────────────────────┐
        ▼                                   ▼
  StructureMap（32B grid；度量 →       HexDump（32B/行，256 行；容器 ref）
   chooseCellContent 选值/标签模式；          ▲
   Selection detail 读同一 valueText）        │ computeHexScrollTarget(nonce 变化时滚一次)
        │                                   │
        └── selectByteRange(id, range, origin) ──▶ App: selectedId + highlight
                                                   + hexCollapsed（Q7 自动展开）
                                                   + hexLocate{offset, nonce}（origin ≠ hex 且区间变化）
```

## 与 Spec / Q 对齐

| 项 | Design 落实 |
|---|---|
| P0-1 / Q1 | 32B 逻辑行；低偏移在上；DOM 顺序 header→ItemId→free→tuple |
| P0-2 / Q2 | `StructureField` 边界 + 标签/缩写 |
| P0-3..P0-5 / Q3 | 单一 `highlight`；字段级 resolve；跨行同 id/range |
| P0-6 / Q6 | Hex 32B；偏移 ≥4 hex 位；行数 ceil(n/32) |
| P0-7/P0-8 / Q5 | `freeCollapsed` + FreeSpaceBand；映射测选中邻接字段 |
| P0-9 | 非像素；装饰归 UI |
| Q4 / P1-3 | 不纳入 P0；保留详情区逐位解读；P1-3 可选常驻图注 |
| API N/A | 不改 server |
| P0-10 / Q2 | 决策 6 的 `valueText` + 决策 7 的度量与 `chooseCellContent`；不足则回退缩写标签，边界不合并 |
| P0-11 | 格与详情同读 `valueText`（决策 6），web 无第二个格式化点 |
| P0-12 | 决策 8：`hexLocate` nonce + `computeHexScrollTarget`；hex 发起的选中不产生 locate |
| Q7 | 决策 9：App 先 `setHexCollapsed(false)` 再由 `HexDump` 挂载后 effect 定位 |

## 模块影响

- **必改（第一轮）**：`packages/page-core` 增加 `deriveStructureFields` / `resolveFieldAt` + Vitest；`apps/web` 的 `StructureMap.tsx`（可拆子组件/CSS）、`HexDump.tsx`、`App.tsx`（`freeCollapsed`、字段级命中）、`diff.ts`（改调字段级 resolve；diff id 粒度可保留粗或升字段）。
- **必改（第二轮增量）**：
  - `packages/page-core/src/structure-fields.ts`（或同层新文件）：`StructureField.valueText?`、`cellCapacityChars`、`chooseCellContent`、`computeHexScrollTarget` + Vitest；`index.ts` 导出。
  - `apps/web/src/StructureMap.tsx`：度量 hook（探针 + `ResizeObserver`）、格内值/标签模式渲染、Selection detail 主值行；`deriveStructureFields` 结果按 `page` 记忆化（`useMemo`），避免每次渲染重建含 `valueText` 的字段表。
  - `apps/web/src/HexDump.tsx`：容器 ref + 行高度量 + `nonce` 驱动的一次性滚动。
  - `apps/web/src/App.tsx`：`selectByteRange(id, range, origin)`、`hexLocate` 状态、Q7 自动展开。
  - `apps/web/src/styles.css`：值/标签两行格内排版、hex 定位后的行强调（见 `ui-design.md`）。
- **不改**：`apps/server/**`、连接/表 API、主题合同、Context strip 字段集（除非结构图局部间距）、`parsePage` / `decodePageTuples` 语义。
- **回归**：基线 flag/列值/HOT/ctid/refresh diff/主题/元信息/键盘须保留；结构图与 hex 的键盘可达**不得**因值模式或自动滚动回退。

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| ItemId `off/flag/len` 非字节对齐 | 子标签与 hex 区间误解 | Design 已定：视觉三段、选中共享 4B `range`；写入 UI/Plan 验收说明 |
| 字段派生偏移与 `parse.ts` 漂移 | 错高亮 | 常量与 parse 同源；core 单测锁区间 |
| 256×32 hex DOM 性能 | 滚动卡顿 | 先保持与现 8192 节点同量级；必要时再虚拟化 hex（不改合同） |
| 误改 parse 语义或加 API | 超 Spec | 仅派生函数；server 不动；若发现必须改 API/语义 → **停止并回 Manager/Analyst**（见下） |
| 折叠实现误改 hex 行/内容 | P0-8 失败 | 折叠测只断言结构图高度/文案；hex 行数与选中偏移独立断言 |
| 字体回退/亚像素使度量偏乐观 | 值被裁切或省略（P0-10 失败） | 判定含 1 字符安全余量；`ResizeObserver` 重算；手测覆盖窄/宽两种视口与一档浏览器缩放 |
| 格内值与详情格式漂移 | P0-11 失败 | 唯一格式化点在 `valueText`；单测锁 xid/`0x`/ctid/列 `display` 格式；Review 检查 web 无第二处格式化 |
| 自动滚动与用户手动滚动互抢 | 跳动、无法阅读（P0-12 失败） | effect 只依赖 `nonce`；区间未变不递增；首字节行已可见返回 `null` |
| Q7 展开后定位时序错乱 | 展开却停在页首 | 依赖 `HexDump` 挂载后 effect 自然时序；**禁止** `setTimeout` 猜测时序；手测从折叠态直接点页尾字段 |
| 值模式导致格内节点数/重排增加 | 大页滚动变卡 | 度量 O(1) 且每批次一次；派生字段记忆化；如实测卡顿按既有储备先虚拟化 hex |

### 开放风险（需 Manager / Analyst 时）

**当前无已知「必须改后端或解析语义」的阻塞。** 若实施中发现：标准堆页字段边界无法在不修改 `parsePage` 语义的前提下导出、或必须新增服务端结构载荷，则 **禁止自行扩范围**；在 `dev-notes` 记录冲突并回退 Manager 修订 Spec。

ItemId 位域共享 4B 选中区间、`StructureField.valueText` 增补（纯附加，不改解析语义）、值模式的字符预算判定与 hex 定位几何均已在本 Design 裁决，**不**视为 Spec 冲突。

## 对 Plan 与 Developer 的要点

### Plan

- 第一轮顺序（已实施）：core 字段派生 + 单测 → Hex 32B → 结构图 grid/跨行/选中 → free 折叠 → 双向联动与映射回归 → UI 精修（窄标签/键盘）→ 基线回归手测 → 文档。
- 第二轮增量顺序：收编工作区未提交视觉改动 → `valueText` + 单测 → 格内值模式（度量 + 判定纯函数 + 单测）→ 详情主值同源 → hex 自动定位与 Q7（几何纯函数 + 单测）→ 手测与文档。
- 验证：L2 映射/切分/格式/判定/几何单测 + typecheck/build；L3 有 PG 时手测 P0；无 PG 时夹具+手测结构/hex（记录恢复条件）。
- Review 门禁 `required`：进入 QA 前须 Approve。

### Developer

- 源分支 `page-diagram-32b`（自 `main`）；勿在 main 直接改。
- 保持「布局 Y ⊥ ByteRange」；折叠不碰 hex 数据。
- 保留详情区 infomask 逐位解读；P1-3 默认不做，除非排期明确纳入。
- 不像素复刻参考图；不改主题 light/dark 合同。
- 增量基线为**文件现状**：工作区已有未提交的视觉优化改动（`StructureMap.tsx`、`HexDump.tsx`、`styles.css`、`structure-fields.ts` 的标签缩写）。先按 `plan.md` T10 审视并收编，再叠加增量，保持提交原子性。
- 主值只从 `valueText` 取；**禁止**在结构图或详情内另写格式化。
- 自动滚动仅限 hex 滚动容器；**禁止**移动键盘焦点或改变选中语义。

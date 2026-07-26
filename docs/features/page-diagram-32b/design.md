# Design: page-diagram-32b

## 背景

在已合入的 `pg-page-viewer` 之上，将主视图从**区块列表**改为 **32 字节一行**的页结构图，并与 hex（同行宽 32B）共用单一 `ByteRange` 双向联动。路径 `full`；Spec 与 Q1–Q6 已由工作项记录确认。本 Design 只定模块边界、分层、选型与数据流；布局/交互见 `ui-design.md`。

**约束摘要（不可偏离）**

- 垂直：低偏移在上（header → ItemId → free → tuple），与 hex 同向；禁止整页倒置（Q1）。
- 行宽：结构图与 hex 均为 32B/行；8KB → hex 256 行（Q6）。
- Free：折叠仅为 UI 态；紧凑断裂带 + 真实 `[start,end)`/字节数；不为折叠区铺满空 32B 行；展开仍空洞压缩（Q5）；禁止破坏字节映射。
- API：**N/A**；沿用 raw + schema；禁止仅下发预渲染图。`page-core` 解析语义保留；本项预期纯前端。
- 非目标：连接/表目录/API、主题合同、infomask 常驻图注（P0；可选 P1-3）、像素复刻。

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

## 关键数据流

```text
raw + schema → parsePage / decodePageTuples → ParsedPage
                    │
                    ▼
         deriveStructureFields(page) → StructureField[]
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
  StructureMap（32B grid，      HexDump（32B/行，256 行）
   free 折叠仅影响高度）              │
        │                       │
        └──── onSelect / onSelectOffset ────▶ App: selectedId + highlight
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

## 模块影响

- **必改**：`packages/page-core` 增加 `deriveStructureFields` / `resolveFieldAt` + Vitest；`apps/web` 的 `StructureMap.tsx`（可拆子组件/CSS）、`HexDump.tsx`、`App.tsx`（`freeCollapsed`、字段级命中）、`diff.ts`（改调字段级 resolve；diff id 粒度可保留粗或升字段）。
- **不改**：`apps/server/**`、连接/表 API、主题合同、Context strip 字段集（除非结构图局部间距）。
- **回归**：基线 flag/列值/HOT/ctid/refresh diff/主题/元信息/键盘须保留。

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| ItemId `off/flag/len` 非字节对齐 | 子标签与 hex 区间误解 | Design 已定：视觉三段、选中共享 4B `range`；写入 UI/Plan 验收说明 |
| 字段派生偏移与 `parse.ts` 漂移 | 错高亮 | 常量与 parse 同源；core 单测锁区间 |
| 256×32 hex DOM 性能 | 滚动卡顿 | 先保持与现 8192 节点同量级；必要时再虚拟化 hex（不改合同） |
| 误改 parse 语义或加 API | 超 Spec | 仅派生函数；server 不动；若发现必须改 API/语义 → **停止并回 Manager/Analyst**（见下） |
| 折叠实现误改 hex 行/内容 | P0-8 失败 | 折叠测只断言结构图高度/文案；hex 行数与选中偏移独立断言 |

### 开放风险（需 Manager / Analyst 时）

**当前无已知「必须改后端或解析语义」的阻塞。** 若实施中发现：标准堆页字段边界无法在不修改 `parsePage` 语义的前提下导出、或必须新增服务端结构载荷，则 **禁止自行扩范围**；在 `dev-notes` 记录冲突并回退 Manager 修订 Spec。

ItemId 位域共享 4B 选中区间已在本 Design 裁决，**不**视为 Spec 冲突。

## 对 Plan 与 Developer 的要点

### Plan

- 顺序：core 字段派生 + 单测 → Hex 32B → 结构图 grid/跨行/选中 → free 折叠 → 双向联动与映射回归 → UI 精修（窄标签/键盘）→ 基线回归手测 → 文档。
- 验证：L2 映射/切分单测 + typecheck/build；L3 有 PG 时手测 P0；无 PG 时夹具+手测结构/hex（记录恢复条件）。
- Review 门禁 `required`：进入 QA 前须 Approve。

### Developer

- 源分支 `page-diagram-32b`（自 `main`）；勿在 main 直接改。
- 保持「布局 Y ⊥ ByteRange」；折叠不碰 hex 数据。
- 保留详情区 infomask 逐位解读；P1-3 默认不做，除非排期明确纳入。
- 不像素复刻参考图；不改主题 light/dark 合同。

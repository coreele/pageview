# Plan: page-diagram-32b

## 元信息

- 工作项标识: page-diagram-32b
- sub-feature-id: page-diagram-32b（未拆分）
- 依据 Spec: docs/features/page-diagram-32b/spec.md
- 依据 Design: docs/features/page-diagram-32b/design.md
- 依据 UI Design: docs/features/page-diagram-32b/ui-design.md（`UI 表面: gui`）
- 路径等级: full
- Review 门禁: **required**（进入 QA 前须 Reviewer `Approve`）
- 源分支: `page-diagram-32b`（Developer 自 `main` 创建并检出；本 Plan 不执行 git）
- 目标分支: `main`
- 最低验证层: **L2 + 定向 L3/手测** — 字段派生/行切分/命中、以及增量的主值格式（`valueText`）、格宽判定（`chooseCellContent`）、hex 定位几何（`computeHexScrollTarget`）均用 Vitest（L2）；typecheck + build；结构图↔hex↔折叠↔值模式↔自动定位以浏览器手测（有 PG 时走真实页；无 PG 时用已有夹具/前端已加载页）。**选择理由**：区间映射、主值格式、宽度判定与滚动几何均为纯函数，L2 可确定性锁定；其余合同依赖真实布局与滚动，只能由浏览器手测证明；API 与解析语义未变，故不要求新 server 集成测（API N/A），实库集成测仅作取页回归
- 验证命令:

```bash
# L2 — page-core（derive/resolve + valueText 格式 + 格宽判定 + hex 定位几何）
pnpm --filter page-core test

# L2 — 类型与构建
pnpm -r typecheck
pnpm -r build

# 可选 L3 — 实库冒烟（环境有 PG 时；本项不改 server，用于回归取页）
pnpm test:integration

# UI 手测（dev）
pnpm dev:server   # 若需实库
pnpm dev:web
# 清单见「验收」「手测清单（增量）」与 ui-design.md
```

**手测清单（增量 P0-10..P0-12 / Q7）**

1. 宽格值：选中含 NORMAL tuple 的页，确认 `t_xmin`/`t_xmax` 格内显示十进制事务号且未被截断/省略。
2. 详情一致：点击同一字段，Selection detail 的主值与格内串完全相同（含格式）。
3. 回退：缩窄浏览器窗口或提高缩放至该串放不下 → 该格回退缩写标签，边界未合并、未出现截断值或省略号。
4. 自动定位：折叠 hex → 点击页尾（高偏移）tuple 字段 → hex 自动展开并滚动一次，高亮首字节行进入可视区（近顶约 1/3）。
5. 不抢滚：重复点击同一字段不再滚动；手动滚动 hex 后无新选中不被拉回；在 hex 内点选字节不触发滚动。
6. 键盘：Tab 聚焦字段格 + Enter 激活 → 同样定位，且焦点仍在该字段格。
7. 主题：light/dark 下值文本、行强调、选中/diff 高亮均可读且可区分。

## 适用工程规范

- [文档工程](../../standards/documentation.md)
- [Git 协作](../../standards/git.md)（源分支 `page-diagram-32b` → `main`）
- [质量与验证](../../standards/quality.md)
- [安全](../../standards/security.md)（本项无新认证/输入面；禁止提交 `.env`/凭据）
- [UI/UX](../../standards/ui.md)

## 目标摘要

将页结构主视图改为 **32B 行**结构图（字段边界可见、点击高亮、free 可折叠），hex 改为 **32B/行**并与结构图共用权威 `ByteRange` 双向联动。依据已确认 Spec P0-1..P0-9、P1-1..P1-3 与 Q1–Q6；技术选型为 DOM/CSS Grid + `deriveStructureFields`（见 `design.md`）；体验见 `ui-design.md`。不改 API/解析语义；保留基线 flag/列值/HOT/ctid/diff/主题/元信息。

**第二轮增量（T10–T15）**：依据已确认增量 Spec P0-10（格宽足够时格内显示完整主值，否则回退 Q2 标签）、P0-11（Selection detail 与格内主值同源同格式）、P0-12（非 hex 发起的选中变化后 hex 自动定位一次）与 Q7（折叠时先自动展开再定位）。落实 `design.md` 决策 6–10：主值唯一来源 `StructureField.valueText`；格宽由「单点度量 + `page-core` 纯判定函数」判定；hex 定位用容器 `scrollTo` + 纯几何函数 + `nonce` 防重复/防循环；`hexCollapsed` / `hexLocate` 归 App。**T1–T9 与既有已确认合同语义不变。**

完成定义：P0-1..P0-12 全部可演示或可测通过；P1-1/P1-2 覆盖；P1-3 默认 N/A（除非明确纳入）；工作区未提交视觉改动已收编并在 `dev-notes.md` 说明来源与影响；`dev-notes.md` 记录偏离；Review `Approve` 后交 QA。

## 任务拆解

### T1 — 分支与基线确认

- 触碰: （git 工作树；无文档必改）
- 完成条件: 自 `main` 创建并检出 `page-diagram-32b`；确认现网 `StructureMap`/`HexDump`/`page-core` 可构建；明确本项只增改 web + 可选 core 派生 API

### T2 — `page-core`：字段派生与命中

- 触碰: `packages/page-core/src/**`（如 `structure-fields.ts` 或等价）、`types` 导出、`tests/**`
- 完成条件:
  - `deriveStructureFields(page)` 产出 header 子字段、每 ItemId、free、tuple 主要 header 字段及列/data 区间（与 Spec 表一致）
  - ItemId 视觉子标签若导出：选中 `range` = 该 slot 完整 4B（Design 裁决）
  - `resolveFieldAt(page, offset)` 返回字段级 id+range（优先最具体字段）
  - 纯函数；**不**改变 `parsePage`/`decodePageTuples` 语义
  - Vitest：夹具页上关键字段 `[start,end)`、跨行字段切分辅助（或 web 侧切分测）、命中样例

### T3 — Hex：32B 行与地址（P0-6 / Q6）

- 触碰: `apps/web/src/HexDump.tsx`、相关 CSS
- 完成条件: `bytesPerRow = 32`；行首偏移 hex ≥4 位；行数 = `ceil(raw.length/32)`（8192→256）；点选/键盘仍回调偏移；高亮仍读同一 `highlight`；ASCII 旁路可选（若做则对齐且不破坏点选）

### T4 — 结构图：32B Grid 与字段边界（P0-1、P0-2 / Q1、Q2）

- 触碰: `apps/web/src/StructureMap.tsx`（可拆子组件）、`apps/web` 样式
- 完成条件:
  - 主视图为结构图而非旧区块列表；逻辑行 32B；垂直低偏移在上
  - 相对顺序 header → ItemId → free → tuple
  - 字段边界可见；标签可读或缩写；不合并相邻不同字段边界
  - 点击字段 → 调用既有 `onSelect(id, range)`；选中态可区分（P0-3）
  - 跨行字段多片段同选中（为 P1-2 打底）

### T5 — Free 折叠（P0-7 / Q5）

- 触碰: `StructureMap`（或 `FreeSpaceBand`）、`App.tsx`（`freeCollapsed` 状态）
- 完成条件: 折叠 → 紧凑断裂带 + `free space` + 真实跨度/字节数；不铺空 32B 行；展开 = 空洞压缩；控件可发现且键盘可操作；**不**改 hex 内容/行数

### T6 — 双向联动与映射回归（P0-4、P0-5、P0-8 / Q3）

- 触碰: `App.tsx`、`diff.ts`（`findStructureAt` → 字段级或改调 `resolveFieldAt`）
- 完成条件:
  - 结构图选中 → hex 高亮完整字段区间（跨行连续）
  - hex 点选映射字段 → 结构图该字段（含所有片段）高亮
  - free 折叠后选中紧邻 ItemId 与某 tuple 字段 → hex 区间正确，不错位
  - diff 高亮与选中样式仍可区分

### T7 — 窄标签与跨行验收（P1-1、P1-2）

- 触碰: 结构图标签/`title`、详情区 `fullLabel`
- 完成条件: 过窄字段 hover/聚焦/选中可得全名；跨行点击任片段或 hex 内任一字 → 全片段 + hex 整段同步

### T8 — P1-3 与基线回归

- 触碰: 按需；默认 **不**实现 P1-3
- 完成条件:
  - P1-3：默认 N/A，在 `dev-notes.md` 注明「未纳入」；若产品要求纳入，则侧注不遮挡网格且不替代逐位解读
  - 回归手测：flag/infomask 详情、列解码、HOT/ctid 跨块、Refresh diff、主题切换、Context strip、非 8KB 错误不渲染结构图

### T9 — 文档与开发记录

- 触碰: `README.md`（若页视图说明仍写 16B/列表则更新）、`docs/features/page-diagram-32b/dev-notes.md`
- 完成条件: README 用户可见说明与 32B 结构图一致（若无需改则 `dev-notes` 写 N/A 理由）；`dev-notes` 记录验证命令结果、偏离、P1-3 状态

### T10 — 收编工作区未提交的视觉优化改动（增量前置）

- 触碰: `apps/web/src/StructureMap.tsx`、`apps/web/src/HexDump.tsx`、`apps/web/src/styles.css`、`packages/page-core/src/structure-fields.ts`（既有未提交改动）；`docs/features/page-diagram-32b/dev-notes.md`
- 完成条件:
  - 逐项审视工作区未提交改动（`git diff` 为准；含 hex 单元由 `span[role=button]` 改为 `<button>`、结构图区域分节/图例、标签缩写、CSS 重整），判定**纳入**或**规整后纳入**；确认其不违反既有合同：32B 行宽与 hex 行数、字节映射、Q2 不合并边界、键盘可达与 `:focus-visible`、light/dark 可读、`parsePage`/`decodePageTuples` 语义未改
  - 与增量功能改动**分开提交**（如 `refactor(web): 结构图与 hex 视觉规整`），保持提交原子性（`git.md` §2）；`.env`/凭据禁止入库
  - 若某项与本 Plan/`ui-design.md` 冲突：**禁止**默默保留，须调整为符合合同或在 `dev-notes.md` 记为偏离并说明理由
  - `dev-notes.md` 记录：这些改动的**来源**（治理流程外的视觉优化，Manager 未提交未回退）、收编范围、对 P0-1..P0-9 的影响评估、复跑的验证命令结果
  - 收编后重跑 `pnpm --filter page-core test`、`pnpm -r typecheck`、`pnpm -r build`

### T11 — `page-core`：主值单一来源 `valueText`（P0-10、P0-11）

- 触碰: `packages/page-core/src/structure-fields.ts`、`src/index.ts`、`tests/structure-fields.test.ts`
- 完成条件:
  - `StructureField` 增补**可选** `valueText?: string`；无单行主显示串的字段（`free`、`nullbits`、`data*`）**不设**该字段
  - 按 `design.md` 决策 6 格式表产出：xid 十进制（`t_xmin`/`t_xmax`/`pd_prune_xid`）、`pd_lsn` 段沿用既有 LSN 展示、flag/checksum/infomask 用 `0x` 十六进制、偏移/长度十进制、`pd_pagesize_version` 为 `<pageSize>/<pageVersion>`、`t_ctid` 为 `(<block>,<offset>)`、列字段用 `NULL` 或解码层 `display`（含 TOAST 标记）、ItemId slot 为 `off=<offset> len=<length>`
  - 纯函数；**不**改 `parsePage`/`decodePageTuples` 语义与返回值；既有单测不改语义
  - Vitest：夹具页上锁定上述各类 `valueText` 字符串；断言无 `valueText` 的字段集合

### T12 — 结构图格内值模式与宽度判定（P0-10）

- 触碰: `packages/page-core/src/structure-fields.ts`（或同层新文件）+ `tests/**`；`apps/web/src/StructureMap.tsx`、`apps/web/src/styles.css`
- 完成条件:
  - `page-core` 纯函数：`cellCapacityChars(spanBytes, metrics)`（含内边距/边框扣减与 **1 字符安全余量**）、`chooseCellContent({ label, valueText, capacityChars })` → 值模式（含 `showLabel`）或标签模式
  - web 侧度量：等宽探针得字符宽、`.structure-row-grid` 度量得字节列宽，`ResizeObserver` 在尺寸/缩放变化时重算；**每渲染批次一次**度量，不逐格测量
  - 值模式渲染：值不截断、`white-space: nowrap`、不侵入邻格；两行堆叠（缩写标签行 + 值行）仅在标签行亦可容纳时出现；否则仅值 + `title`（全名 + 主值）
  - 跨行字段：`valueText` 只在最宽片段（并列取最低偏移）渲染一次，其余片段保持标签模式；片段选中/高亮同步不回退（Q3 / P1-2）
  - ItemId `off|flag|len` 三分内按同一规则显示值或标签；选中仍为整 4B
  - 宽度不足或无 `valueText` → 回退 Q2 标签模式；**禁止**合并边界、截断主值或用省略号显示主值
  - `deriveStructureFields` 结果按 `page` 记忆化（`useMemo`）
  - Vitest：容量计算（含边界值与安全余量）、三种择取结果（值+标签 / 仅值 / 标签）

### T13 — Selection detail 主值同源（P0-11）

- 触碰: `apps/web/src/StructureMap.tsx`（Selection detail 区）、`apps/web/src/styles.css`
- 完成条件: 选中任一可解析字段时详情打开/更新，显示 `fullLabel` + **同一** `valueText` 串；既有 ItemId flag、infomask 逐位、HOT/ctid、列值子块保留在主值下方；web 内**不存在**第二处主值格式化代码（Review 检查项）

### T14 — Hex 自动定位与折叠自动展开（P0-12、Q7）

- 触碰: `packages/page-core/src/structure-fields.ts`（或同层新文件）+ `tests/**`；`apps/web/src/App.tsx`、`apps/web/src/HexDump.tsx`、`apps/web/src/styles.css`
- 完成条件:
  - `page-core` 纯函数 `computeHexScrollTarget({ firstRow, lastRow, rowHeightPx, containerHeightPx, contentHeightPx, currentScrollTop, anchorRatio })` → `number | null`（`null` = 首字节行已完整可见，不滚）；目标近顶 `anchorRatio`（默认 1/3），夹取到 `[0, contentHeight − containerHeight]`；整段可容纳时再夹取使末行可见
  - App：统一入口 `selectByteRange(id, range, origin)`；`origin === "hex"` **不**产生 locate；`origin !== "hex"` 且区间与当前 `highlight` 不同 → `hexLocate` 的 `nonce + 1`；Q7：若 `hexCollapsed` 则同一次处理内 `setHexCollapsed(false)`
  - `HexDump`：容器 ref + 首行行高度量；`useEffect` **只**依赖 `nonce`；`scrollTo({ behavior })`，`prefers-reduced-motion: reduce` 时用 `auto`；**禁止** `scrollIntoView` 牵动祖先容器、**禁止** `setTimeout` 猜测展开时序
  - 首字节行短暂强调（`--hex-locate`，与 `--hex-hl`/`--diff`/`--field-selected` 可区分）+ `aria-live="polite"` 播报；焦点**不**移动
  - 滚动只发生在 hex 容器；主区滚动仅在 hex 面板完全不可见时最小幅度附带一次
  - Vitest：向下长距离定位、向上定位、已可见返回 `null`、页尾夹取、整段跨多行、区间高度大于容器

### T15 — 增量验证、文档与回归

- 触碰: `docs/features/page-diagram-32b/dev-notes.md`；`README.md`（仅当用户可见说明需覆盖格内值/自动定位时）
- 完成条件: 执行「手测清单（增量）」7 项并留证据（截图或逐条说明）；重跑全部验证命令并记录结果；回归 T8 基线清单（flag/列值/HOT/ctid、Refresh diff、主题、strip、非 8KB 错误不渲染结构图）；`dev-notes.md` 记录 P0-10..P0-12/Q7 落实点、T10 收编说明、未执行验证的原因与恢复条件

## 依赖与顺序

```text
T1 → T2 → T3 ─┐
         └→ T4 → T5 → T6 → T7 → T8 → T9
T3 ∥ T4（T3 可不依赖字段派生先改行宽；T6 起必须字段级 resolve）

T9 → T10 ─┬→ T11 ─┬→ T12 ─┐
          │       └→ T13 ─┤
          └→ T14 ─────────┴→ T15
T10 为增量前置（先收编再叠加）；T12、T13 均依赖 T11 的 `valueText`；T14 与 T11–T13 可并行
```

波次：分支 → core 派生单测 → hex 32B ∥ 结构图 → free 折叠 → 联动 → P1/回归 → 文档 →（增量）收编工作区改动 → `valueText` → 值模式 ∥ hex 自动定位 → 详情同源 → 增量手测与文档。

## 触碰路径

| 区域 | 路径 |
|---|---|
| Core（推荐） | `packages/page-core/src/**`（`structure-fields.ts`、`index.ts`）、`packages/page-core/tests/**` |
| Web | `apps/web/src/StructureMap.tsx`、`HexDump.tsx`、`App.tsx`、`diff.ts`、`styles.css` |
| Server | **不改** |
| 文档 | `docs/features/page-diagram-32b/dev-notes.md`；可能 `README.md` |

## 验收

> 权威 Given-When-Then：`spec.md`。下表为任务映射与证据期望。

| ID | 映射任务 | 预期证据 |
|---|---|---|
| P0-1 | T4 | 手测/截图：32B 结构图，顺序与 Q1 方向 |
| P0-2 | T2、T4 | 手测：header/ItemId/tuple 字段边界可辨；单测锁关键 range |
| P0-3 | T4 | 手测：选中与未选中可区分 |
| P0-4 | T6 | 手测：结构图 → hex 整段高亮 |
| P0-5 | T6 | 手测：hex → 结构图字段高亮 |
| P0-6 | T3 | 手测或计数：32B/行、偏移格式、256 行 |
| P0-7 | T5 | 手测：折叠/展开文案与控件键盘 |
| P0-8 | T6 | 手测：折叠后邻接字段 hex 不错位 |
| P0-9 | 全程 | 验收不以未像素复刻失败 |
| P1-1 | T7 | 手测：窄字段全文可达 |
| P1-2 | T4、T6、T7、T12 | 手测：跨行同步高亮；主值只出现在最宽片段一次 |
| P1-3 | T8 | N/A 或可选实现说明 |
| P0-10 | T11、T12 | 单测：`valueText` 格式与容量/择取判定；手测清单 1 与 3（宽格显示完整值；变窄后回退标签、边界未合并、无省略截断） |
| P0-11 | T11、T13 | 手测清单 2 截图对比（格内与详情主值逐字符一致）；Review 确认 web 无第二处主值格式化 |
| P0-12 | T14 | 单测：`computeHexScrollTarget` 六类用例；手测清单 4/5/6（定位近顶 1/3、重复点击与 hex 自身点选不滚、键盘激活同样定位且焦点不动） |
| Q7 | T14 | 手测清单 4：折叠态点击 → hex 自动展开后定位；折叠按钮文案与 `aria-expanded` 同步 |

**UI/UX：** 对照 `ui-design.md`（布局、FreeSpaceBand、格内值与标签优先级、Hex 自动定位与折叠自动展开、焦点、token）；非 `N/A`。

**基线回归：** T8 清单 + T15 增量回归；不得删除既有 P0 能力，键盘可达不回退。

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | `docs/features/page-diagram-32b/dev-notes.md`（必填；含 T10 收编说明与增量落实点）；`packages/page-core` 新导出（`valueText`、`cellCapacityChars`、`chooseCellContent`、`computeHexScrollTarget`）在包内简短注释 |
| 用户文档 | 若根 `README.md` 仍描述 16 字节 hex 或列表式结构图 → 更新为 32B 结构图说明；增量能力（格内数值、hex 自动定位）若影响用户可见说明则一并更新；否则 N/A 并在 dev-notes 说明 |
| 运维文档 | N/A（无部署/API/运维变更） |

## Review 与进入 QA

1. Developer 完成 T1–T15（T1–T9 已实施；本轮为 T10–T15），验证命令通过并写入 `dev-notes.md`。
2. **Review 门禁 required**：调度 Reviewer；须 `Approve` 后方可进入 QA（可先写 `review.md`，提交时机见 `git.md`）。
3. QA 依据 Spec + Plan + `ui-design.md` 独立验收 → `qa-report.md`。
4. 交接顺序：**Implement → Review（Approve）→ QA →（用户授权）done/合并**。

## 无法执行验证时

| 情形 | 原因 | 风险 | 恢复条件 | 复测范围 |
|---|---|---|---|---|
| 无本机 PG | 无法实库加载页 | P0 实页路径未证 | 启动 PG 16.x + pageinspect 或使用已捕获夹具在 UI 加载 | P0-1..P0-8 手测 |
| 无图形环境 | 无法手测结构图 | UI 验收缺口 | 本地浏览器或提供录屏 | ui-design 清单 |
| 无浏览器可交互（仅能跑单测） | 值模式度量、自动滚动与 Q7 依赖真实布局，纯单测无法覆盖 | P0-10/P0-12/Q7 未证；仅纯函数层有证据 | 本地浏览器手测或录屏 | 手测清单（增量）7 项 |

第一轮已知缺口（沿用）：浏览器 UI 手测 P0-1..P0-8 / P1-1 / P1-2 未执行，记录于 `dev-notes.md`；进入 QA Pass 前须补齐，与增量手测清单一并完成。

**禁止**静默跳过；记入 `dev-notes` / 工作项阻塞字段。

## 安全

本项不新增连接或密钥面。禁止提交 `.env`、真实连接串。Review 安全项：无新触发域则记「无增量安全影响」。

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-07-26 | Planner 初稿：design + ui-design + plan；待用户确认 Plan |
| 2026-07-26 | Planner 增量修订：覆盖已确认增量 Spec P0-10..P0-12 与 Q7；新增 T10（收编工作区未提交视觉改动）、T11（`valueText` 单一来源）、T12（格内值模式与宽度判定）、T13（详情主值同源）、T14（hex 自动定位 + Q7 自动展开）、T15（增量验证与文档）；补充增量手测清单与验收映射；T1–T9 语义未改；待用户确认 Plan |

# Plan: next-page-btn

> **确认门禁：awaiting-plan-approval**。待用户确认后 Manager 持久化并进入 `planned`。

## 元信息

- 工作项标识: next-page-btn
- sub-feature-id: next-page-btn（未拆分）
- 依据 Spec: `workflow/docs/features/next-page-btn/spec.md`
- Spec 确认: **approved**（2026-09-01）
- 依据 Design / UI/UX: **N/A**（Design 门禁 `skipped`；按钮样式与禁用文案在 Spec）
- 路径等级: standard
- Review 门禁: **required**（进入 QA 前须 Reviewer `Approve`）
- 源分支: `next-page-btn`（自 `main` 创建并检出；**禁止**在 `main` 直接实施）
- 目标分支: `main`
- 最低验证层: **L2（web 单测、全仓 test、typecheck、build）+ 定向手测（两处按钮、heap ±1、btree 兄弟、末页禁用、统计条在下）**
  - 理由：目标/禁用为纯函数可单测；工具栏接线、P0-8 布局、P0-7 非 refresh 需手测或带 fetch mock 的组件测。
- **适用对象**：Developer / Reviewer / QA。**前置条件**：Spec 已确认、本 Plan 已确认。**操作步骤**：T1–T6 → Review Approve → QA。**预期结果**：验证命令全绿且手测完成（或 quality.md §6 记缺口）。**失败处理**：写入 `dev-notes.md`；Review `Request changes` 回 Developer。

## 适用工程规范

- [文档工程](../../standards/documentation.md)
- [Git 协作](../../standards/git.md)（源 `next-page-btn` → 目标 `main`）
- [质量与验证](../../standards/quality.md)
- [安全](../../standards/security.md)（无新端点/认证；禁止提交 `.env`/凭据）
- [UI](../../standards/ui.md)（gui：焦点可见、disabled 可感知；不新增主题）

## 目标摘要

Refresh 右侧 `Prev` / `Next`：heap 按已显示页 `blkno ± 1`，btree 按 `siblingNav`；边界禁用且不请求。Heap `meta-stats` 永远在选择行下方。Spec：**8×P0 + 4×P1**。

## 现状锚点

| 位置 | 基线 | 本项目标 |
|---|---|---|
| `App.tsx` 工具栏 | Load + Refresh；`blkno` 同时驱动输入框与 Load | 同排加 Prev/Next；**显示页块号**与输入框分离（否则 P1-1 无法成立：改输入会毁掉已显示 blk） |
| `blockNav.ts` `siblingNav` | 详情区左右兄弟 | btree 工具栏复用；**禁止**另写一套 `blkno±1` |
| `.meta-controls-row` | `flex-wrap` 行：heap 控件短时统计条会跑到表下拉**右侧** | 列堆叠：`chrome-controls` 上、`meta-stats` 下（heap 与 index 共用） |
| README | Page：table/index + blkno + Load；Index：详情区 sibling | 补工具栏 Prev/Next 一句 |

## 任务拆解

### T1 — 分支

- **完成条件**: 自 `main` 创建并检出 `next-page-btn`。不在 `main` 实施。
- **触碰路径**: git 工作树
- **验收映射**: git.md

### T2 — 翻页纯函数（TDD）

- **完成条件**:
  - 新增 web 纯模块（建议 `apps/web/src/pageToolbarNav.ts`，名称可改）：
    - `heapPageNav(loadedBlkno, blocks)` → `{ prev, next }`（`number | null`）；`loadedBlkno === 0` → `prev=null`；`loadedBlkno >= blocks-1` 或 `blocks<=1` → `next=null`。
    - btree：直接使用既有 `siblingNav`；`special` 缺失时两目标均为 `null`。
    - `toolbarNavEnabled(hasPage, loading, oid)` 与 Refresh 同条件。
    - `navButtonTitle(kind, dir, target)`：有目标 → `blk {n}`；heap 无目标 → `first block` / `last block`；btree 无目标 → `leftmost` / `rightmost`。
  - 单测覆盖 P0-3/4/5/6 的目标与禁用、P1-3 文案。本任务结束时对空模块先红后绿。
- **触碰路径**: `apps/web/src/pageToolbarNav.ts`（新）、`apps/web/src/pageToolbarNav.test.ts`（新）；`blockNav.ts` **禁止改语义**
- **验收映射**: P0-3…P0-6 目标计算、P1-3

### T3 — 工具栏接线

- **完成条件**:
  - table 与 index 的 Refresh 右侧均为 Prev、Next；样式非 primary。
  - 启用：`toolbarNavEnabled`。目标：heap 用 **loaded 块号**（成功 Load 写入；`pageView` 清空则无）；index 用当前 `btreePage.special` 的 `siblingNav`。点击：`loadBlk` / `loadIndexBlk` **不传** `{ refresh: true }`；成功后输入框与 loaded 块号均为目标 blk。
  - `target == null` 时 `disabled`，onClick 不调用 fetch。
  - HeapPeek / WAL **不加**这两钮。详情区 `Load blk N` 不改。
- **触碰路径**: `apps/web/src/App.tsx`（必要时极小拆分按钮，避免复制两套逻辑出错）
- **验收映射**: P0-1、P0-2、P0-7、P1-1、P1-2、P1-4 浮层/WAL

### T4 — 统计条堆叠

- **完成条件**: `.meta-controls-row`（或等价 class）纵向堆叠，宽屏 heap 统计条不在 table 下拉右侧。字段集合不变。Index 统计同样在控件行下。
- **触碰路径**: `apps/web/src/styles.css`；仅当 JSX 结构阻碍堆叠时改 `App.tsx` 包裹
- **验收映射**: P0-8

### T5 — 用户文档

- **完成条件**: `README.md` / `README.zh-CN.md` Page 或 Index 节各补一句：工具栏 Prev/Next（heap 顺序块；btree 左右兄弟；边界禁用）。不与详情区 sibling 描述冲突。
- **触碰路径**: 上述 README；`dev-notes.md` 记改了哪几行
- **验收映射**: 文档影响

### T6 — 开发者验证关门

- **完成条件**: 下方命令全绿；手测清单完成或 §6 记缺口；`dev-notes.md` 含证据与禁止面（`apps/server`、`page-core` 解析、HeapPeek 工具栏零需求变更）；不改 STATUS；交 Review。
- **触碰路径**: `workflow/docs/features/next-page-btn/dev-notes.md`
- **验收映射**: 全部

## 依赖与顺序

```text
T1 分支
  → T2 纯函数先红后绿
    → T3 App 接线（含 loadedBlkno）
      → T4 CSS 堆叠 → T5 README → T6 验证关门 → Review → QA
```

T3 与 T4 可并行，但关门前两者都要完成。

## 触碰路径（汇总）

| 路径 | 预期变更 |
|---|---|
| `apps/web/src/pageToolbarNav.ts` + `*.test.ts` | **新增** heap 目标/启用/title |
| `apps/web/src/App.tsx` | 按钮、loaded 块号、非 refresh Load |
| `apps/web/src/styles.css` | meta 行纵向堆叠 |
| `README.md` / `README.zh-CN.md` | Prev/Next 一句 |
| `workflow/docs/features/next-page-btn/dev-notes.md` | **新增** |
| `apps/web/src/blockNav.ts` | **禁止改 siblingNav 语义** |
| `apps/server/**`、`packages/page-core/**` | **禁止**（无新 API、无解码变更） |
| `HeapPeekOverlay.tsx` | **禁止**加 Prev/Next |

## 验收

见 `spec.md` P0-1…P0-8、P1-1…P1-4。本 Plan 不复述 Given-When-Then。

## 验证计划

### 验证命令

```bash
pnpm --filter web test
pnpm test
pnpm -r typecheck
pnpm -r build
pnpm dev:web
```

### 预期证据

| 检查 | 通过证据 |
|---|---|
| web test | heap/btree 目标与禁用、title、enabled 用例绿；既有 `blockNav` / App 相关测绿 |
| `pnpm test` | 全仓绿 |
| typecheck / build | 零错误 |
| 手测 | 见清单；无浏览器则 §6 |

### Spec 验收映射

| ID | 要点 | 主要证明 |
|---|---|---|
| P0-1 | 两处 Refresh 后 Prev/Next | 手测（+ JSX 存在） |
| P0-2 | 未 Load / loading 禁用 | 单测 `toolbarNavEnabled` + 手测 |
| P0-3 | heap ±1 | 单测 `heapPageNav` + 手测 |
| P0-4 | heap 0 / last 禁用无请求 | 单测 null 目标 + 手测 |
| P0-5 | btree 兄弟块号 | 单测接 `siblingNav` + 手测非连续 blk |
| P0-6 | 无兄弟 / 无 special 禁用 | 单测 + 手测 metapage |
| P0-7 | 非 refresh（无本跳 diff） | 手测：Next 后无 Refresh 式 diff |
| P0-8 | 统计在选择列表下 | 手测宽视口 |
| P1-1 | 脏输入仍用显示页 | 手测（loaded vs input 分离） |
| P1-2 | 详情 Load blk 仍在 | 手测 |
| P1-3 | title 文案 | 单测 |
| P1-4 | Load/Refresh/换表/WAL | 手测回归 |

### 建议 QA 范围

- **必测** P0-1…P0-8。
- **回归** Refresh diff、详情 sibling、HeapPeek 无新钮、切 WAL。
- **抽查** 网络面板：末页点 Next 无 `/pages/` 请求；btree Next 的 blk ≠ `+1`（选一棵有兄弟且块号不连续的索引，若活库没有则用 page-core fixture 页 + 手测工具栏禁用/可点与 `btpo_next` 一致）。

### 手测清单（开发者）

1. Table：Load 中间页 → Next 为 k+1、Prev 回 k；blk0 Prev 禁用；末页 Next 禁用。
2. 改 blkno 输入未 Load → Next 仍按已显示页 +1。
3. Index：metapage 两钮禁用；有 `btpo_next` 的叶页 Next 加载该兄弟。
4. 详情 special 仍有 `Load blk N →`。
5. 宽屏 heap：统计条在表下拉下方，不在右侧。
6. Refresh 仍对**输入框** blk 生效并出 diff；Next 后无该 diff。
7. HeapPeek / WAL 无 Prev/Next。

## Review 与进入 QA

- Review **required**：实现 + 测试 + `dev-notes.md` → Reviewer；**Approve** 后方可 QA。
- QA 依据 Spec + 本 Plan 写 `qa-report.md`（Pass / Fail / Blocked）。

## 文档影响

| 类别 | 更新路径或 N/A |
|---|---|
| 开发文档 | `dev-notes.md`（必做） |
| 用户文档 | `README.md`、`README.zh-CN.md` 各补 Prev/Next |
| 运维文档 | **N/A** — 无部署/监控/排障变更 |

## 风险与回退

| 风险 | 影响 | 缓解 |
|---|---|---|
| 仍用单一 `blkno` 状态 | P1-1 失败 | T3 必须引入 loaded 块号（或等价） |
| btree 误用 ±1 | 跳到非兄弟页 | 只调用 `siblingNav`；手测块号不连续 |
| 禁用仍发请求 | 越界错误面板 | `disabled` + 目标 null 不调 load |
| CSS wrap 未改干净 | P0-8 失败 | 列方向而非只靠按钮把行撑满 |

**回退**：源分支 `git revert`；不影响 `main`。

### 无法执行验证时

记录原因 → 未证的 P0 → 恢复条件 → `dev-notes.md`。**禁止**静默跳过。无浏览器：P0-1/7/8 与手测 1–7 降为单测 + JSX/CSS 核对，并按 quality.md §6 登记。

## 交接顺序

1. 用户确认本 Plan → Manager 持久化 → `planned` → 调度 Developer。
2. Developer：T1–T6 于 `next-page-btn`；`dev-notes.md`；**不**改 STATUS。
3. Reviewer：`review.md`；须 `Approve`。
4. QA：`qa-report.md`；Pass 后请示合并授权。
5. 授权后 Manager 在源分支置 `done`，与未入库报告一次提交；再合入 `main`。

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-09-01 | 初稿：T1–T6；Design skipped；loaded 块号与 CSS 堆叠 |

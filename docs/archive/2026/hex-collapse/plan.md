# Plan: hex-collapse

> **确认门禁：待用户确认 / awaiting-plan-approval**（2026-07-27）。用户确认并经 Manager 持久化后，方可置 `planned` 并调度 Developer。Planner **不**自行改 STATUS / 工作项记录，**不**调度 Developer。

## 元信息

- 工作项标识: hex-collapse
- sub-feature-id: hex-collapse（未拆分）
- 依据 Spec: `docs/features/hex-collapse/spec.md`（**approved**，2026-07-27 用户「ok」）
- 依据 Design / UI/UX: **N/A**（Design 门禁 `skipped`；不写 `design.md` / `ui-design.md`；GUI 验收以 Spec 为准）
- 路径等级: standard
- Review 门禁: **required**（进入 QA 前须 Reviewer `Approve`）
- 源分支: `hex-collapse`（自 `main` 创建并检出；**禁止**在 `main` 直接改）
- 目标分支: `main`
- 最低验证层: **L2（web 布局测 + `pnpm test` 回归 + typecheck/build）+ 定向浏览器手测**
  - **理由**：新逻辑为 hex 呈现/偏移几何与拆除可切换态 → 纯函数 L2；选中/滚动/顶栏 Collapse hex → 手测。**禁止**改 `packages/page-core`；无新 API → 不强制新集成测。

## 适用工程规范

- [文档工程](../../standards/documentation.md)
- [Git 协作](../../standards/git.md)（源 `hex-collapse` → 目标 `main`）
- [质量与验证](../../standards/quality.md)
- [安全](../../standards/security.md)（无新认证/输入面；禁止提交 `.env`/凭据）

## 目标摘要

结构图 + hex 对非空 free（`page.freeSpace.range`）**始终**断裂带联动；**移除** Collapse/Expand free space 与可切换态；选中仅高亮断裂带；滚动按折叠后几何；`hexCollapsed` 整栏显隐正交不回退。纯前端；**禁止**改 `page-core` / API。覆盖 `page-diagram-32b` Q5。Spec：**12×P0 + 1×P1**。

## 现状锚点（实施时对照）

| 位置 | 现状 | 本项目标 |
|---|---|---|
| `App.tsx` | `freeCollapsed` + `onToggleFreeCollapsed`；`hexCollapsed` 整栏 | 去掉 free 可切换态；**保留** `hexCollapsed` |
| `StructureMap.tsx` / `FreeSpaceBand` | Collapse/Expand 按钮；collapsed 样式可选 | 恒折叠断裂带；无切换控件 |
| `HexDump.tsx` | 连续 32B 逐字节单元格；滚动按 `offset/32` 行号 | 非空 free → 断裂带；滚动用折叠后呈现行 |
| `packages/page-core` | 解析 / `deriveStructureFields` / `computeHexScrollTarget` | **不改动** |

与 `fix-dev-web-page-core`：不擅自合入；实现仅在 `hex-collapse` 分支。

## 任务拆解

> 建议 TDD：先写/扩纯布局测（红）→ 实现（绿）→ 接线 UI → 手测回归。每项含完成条件与验收映射。

### T1 — 分支与基线

- **完成条件**:
  - 自 `main` 创建并检出 `hex-collapse`（若已存在则检出并确认基于正确目标）。
  - `pnpm -r typecheck` 与 `pnpm --filter web build` 在改前可通过（或记录已知基线失败并在 `dev-notes.md` 注明）。
  - 确认工作树不在 `main` 上实施。
- **触碰路径**: git 工作树（无业务代码）
- **验收映射**: 分支门禁（git.md）；为 P0-11 回归铺底

### T2 — Hex 折叠呈现：纯布局辅助（TDD）

- **完成条件**:
  - 新增 `apps/web` 纯函数（建议 `hexLayout.ts`）：输入含 `raw.length`、`freeRange`、`bytesPerRow = 32`；产出呈现序列 + `offset → 呈现行`。
  - 序列须支持：非 free 单元格段；非空 free 单一断裂带（真实 `[start,end)`/字节数）；不对齐 32B 时同行 free 前/后仍为单元格；`end <= start` → 无断裂带（连续行）。
  - **禁止**：重复字节折叠、折叠非 free、改 `page-core`。
  - 新增 web 单测（建议 Vitest；其它选型记入 `dev-notes.md`）：空 free、对齐/不对齐、仅 free 折叠、呈现行数 ≪ 展开 free、`offset → 行`。TDD：先红后绿。
- **触碰路径**: `apps/web/src/hexLayout.ts`（或等价）、测试与 `apps/web/package.json` script
- **验收映射**: P0-1、P0-5、P0-9、P0-12（布局层）

### T3 — `HexDump`：始终折叠 free + 选中断裂带

- **完成条件**:
  - 用 T2 布局渲染：非空 free → 可辨识断裂带（`free space` + 真实跨度/字节数；可对齐 `.free-break*`，不要求像素复刻）。
  - 点断裂带 → id `"free"` + 权威 `ByteRange`（`onSelectOffset(free.start)` + `findStructureAt` 或显式回调均可）。
  - 非 free 点选/高亮不变；同一 `highlight`；**禁止**折叠错位。
  - 非断裂带呈现行：行首绝对偏移 hex ≥4 位；断裂带自标跨度。
  - `App` 传入 `freeSpace.range`；**不**引入 free 展开布尔。
- **触碰路径**: `HexDump.tsx`、`App.tsx`、`styles.css`
- **验收映射**: P0-1、P0-5、P0-6（hex）、P0-9

### T4 — 结构图：恒折叠 + 移除 Collapse/Expand

- **完成条件**:
  - 移除 Collapse/Expand free space（及 `aria-expanded` 切换）；去掉 `(compressed)` 等暗示可展开的文案。
  - 非空 free 恒断裂带；空 free 无折叠/断裂带 UI。
  - 删除 `freeCollapsed` / `setFreeCollapsed` / `onToggleFreeCollapsed`（App + StructureMap + FreeSpaceBand）。
  - 选中 free → 高亮断裂带；无展开入口。
- **触碰路径**: `StructureMap.tsx`、`App.tsx`、`styles.css`（可删 `.free-toggle`）
- **验收映射**: P0-2、P0-3、P0-4、P0-6（结构图）、P0-12

### T5 — 联动一致与双向高亮回归

- **完成条件**: 两侧非空 free 同为断裂带且跨度一致；非 free 双向高亮不回退；free 选中两侧同一 `ByteRange` 可区分。
- **触碰路径**: `App.tsx`、`StructureMap.tsx`、`HexDump.tsx`；`diff.ts` 默认不动
- **验收映射**: P0-3、P0-6、P0-7

### T6 — 自动滚动按折叠后几何

- **完成条件**:
  - 非 hex 发起且区间变、hex 可见 → 滚至目标首字节**呈现行**入可视区（T2 `offset→行` + 既有导出 `computeHexScrollTarget`；**不改** `page-core` 源码）。
  - 同区间不强制再滚；hex 内发起 **禁止**拉滚。
  - `hexCollapsed` 时先 Show hex 再定位（既有逻辑不回退）；locate-flash 不错行。
- **触碰路径**: `HexDump.tsx`、必要时 `App.tsx`
- **验收映射**: P0-8、P0-10（交叉）

### T7 — 顶栏 `hexCollapsed` 正交 + page-core 不动

- **完成条件**:
  - 主带 Collapse/Show hex 不变；hex 面板无整栏折叠；Show hex 后 free 仍断裂带。
  - **无** `packages/page-core/**` 业务 diff；`pnpm --filter page-core test` 全绿；P0-11 证据写入 `dev-notes.md`。
- **触碰路径**: 核对 `App.tsx` chrome；**禁止**改 `page-core`、`apps/server` API
- **验收映射**: P0-10、P0-11

### T8 — P1 diff 可辨 + 文档

- **完成条件**: free+diff 时两侧断裂带可辨（复用 `.diff`）；`README.md` 去掉「可 Expand / foldable」误导；写 `dev-notes.md`（偏离、验证证据、限制）。
- **触碰路径**: `styles.css`（若需）、`README.md`、`docs/features/hex-collapse/dev-notes.md`
- **验收映射**: P1-1；文档影响

### T9 — 开发者验证关门

- **完成条件**: 跑下方验证命令；手测清单勾完或按 quality.md §6 记 Blocked；证据入 `dev-notes.md`；不改 STATUS；交 Review。
- **触碰路径**: `dev-notes.md`
- **验收映射**: 全部 P0 + P1-1

## 依赖与顺序

```text
T1 分支
 └─ T2 hexLayout 纯函数 + 测试（TDD）
      └─ T3 HexDump 接线
      └─ T4 StructureMap / App 去切换态（可与 T3 并行，合并前须集成）
           └─ T5 联动/高亮回归
                └─ T6 滚动几何
                     └─ T7 整栏正交 + core 不动确认
                          └─ T8 diff 样式 + README/dev-notes
                               └─ T9 验证关门 → Review → QA
```

## 触碰路径（汇总预估）

| 路径 | 预期变更 |
|---|---|
| `apps/web/src/hexLayout.ts`（或等价） | **新增** 呈现布局 / offset→行 |
| `apps/web/src/**/*.test.ts` + `apps/web/package.json` | **新增** web 单测与 script |
| `apps/web/src/HexDump.tsx` | 折叠渲染、选中、滚动 |
| `apps/web/src/StructureMap.tsx` | 去 toggle；恒折叠 |
| `apps/web/src/App.tsx` | 删 `freeCollapsed`；向 HexDump 传 free range |
| `apps/web/src/styles.css` | hex 断裂带、清理 toggle |
| `apps/web/src/diff.ts` | 默认不动；仅必要时微调 |
| `README.md` | 折叠语义文案 |
| `docs/features/hex-collapse/dev-notes.md` | **新增** |
| `packages/page-core/**` | **禁止改** |
| `apps/server/**` | **禁止改** |

## 验证计划

### 验证命令

```bash
# L2 — web 纯布局（T2 引入的 script；名称以 package.json 为准）
pnpm --filter web test

# L2 — page-core / server 回归（本项不改其语义，必须仍通过）
pnpm test

# L2 — 类型与构建
pnpm -r typecheck
pnpm -r build

# 可选 L3 — 有 PG 时取页冒烟（不改 API；回归用）
pnpm test:integration

# UI 手测
pnpm dev:server   # 若需实库
pnpm dev:web
```

### 预期证据

| 检查 | 通过证据 |
|---|---|
| `web test` | 布局/映射用例全 Pass |
| `pnpm test` | page-core + server 既有用例全 Pass |
| typecheck / build | 零错误；web 产物成功 |
| 手测 | 下表 P0/P1 可观察行为成立；记入 `dev-notes.md` |

### Spec 验收映射（开发者自测 + 建议 QA）

| ID | 要点 | 主要证明 |
|---|---|---|
| P0-1 | Hex 非空 free → 断裂带 | 手测 + 布局测 |
| P0-2 | 结构图恒断裂带 | 手测 |
| P0-3 | 两侧一致 | 手测 |
| P0-4 | 无 Expand/Collapse free 控件 | 手测（DOM/文案） |
| P0-5 | 不按重复字节折叠 | 手测 + 布局测 |
| P0-6 | 选中高亮断裂带、不展开 | 手测 |
| P0-7 | 双向高亮不回退 | 手测 |
| P0-8 | 自动滚动按折叠几何 | 手测 |
| P0-9 | 局部行与偏移 | 手测 + 布局测 |
| P0-10 | 顶栏 Collapse hex 不回退 | 手测 |
| P0-11 | 不改 page-core/API | git diff 无 core；`pnpm test` |
| P0-12 | 空 free 无折叠 UI | 手测或夹具 + 布局测 |
| P1-1 | diff 可辨 | 手测（Refresh） |

### 建议 QA 范围

- **必测** P0-1..P0-12（Spec GWT）；**P1-1**（有 diff 时）。
- **回归**：双向高亮；非 hex 发起滚动（含先 Show hex）；32B/行首偏移；主带 Collapse hex 唯一入口；宽屏分栏。
- **非目标抽查**：无重复字节折叠、无 free 展开入口、无 `page-core` diff。

### 手测清单（开发者）

1. 大块非空 free：两侧断裂带；无 Collapse/Expand free。
2. 选中 free：仅高亮断裂带，无逐字节展开。
3. 页尾 tuple：折叠后正确呈现行入视；同字段不重复滚；hex 内点选不拉滚。
4. Collapse hex → 点字段 → Show hex 并定位；再显隐后 free 仍断裂带。
5. free 不对齐 32B：同行前后单元格；边界映射正确。
6. tuple 内长 `00`：仍为单元格，无额外折叠带。
7. Refresh → free diff：断裂带可辨。
8. 空 free（若有夹具）：无断裂带/折叠 UI。

## Review 与进入 QA

- Review **required**：T1–T9 + `dev-notes.md` → Reviewer；**Approve** 后方可 QA；`Request changes` 回 Developer。
- QA 依据 Spec + 本 Plan，写 `qa-report.md`（Pass/Fail/Blocked）。

## 文档影响

| 类别 | 更新路径或 N/A |
|---|---|
| 开发文档 | `docs/features/hex-collapse/dev-notes.md`（必做）；代码旁注释仅在非显而易见时 |
| 用户文档 | `README.md`（更新 free/hex 折叠表述；若与实现一致且已无误导可在 dev-notes 注明「已核无需改」） |
| 运维文档 | **N/A** — 无部署/监控/排障变更 |

## 风险与回退

| 风险 | 影响 | 缓解 / 回退 |
|---|---|---|
| 滚动仍按未折叠行号 | P0-8 失败、错位 | T2 强制 offset→呈现行单测；手测页尾字段 |
| 局部行实现简化成「整行替换」 | P0-9 失败 | 布局测覆盖不对齐起止；禁止只删整行 |
| 误改 page-core | P0-11 / 范围失控 | PR/自检禁止 core diff；回退相关提交 |
| 去掉 `freeCollapsed` 漏传 props | 编译失败或死控件残留 | typecheck；P0-4 文案检索 |
| 与待合入 `fix-dev-web-page-core` 基线漂移 | 合并冲突 | 仅在 `hex-collapse` 实施；冲突交 Manager，不擅自合 main |
| web 无既有 test runner | T2 受阻 | 本项允许新增 Vitest（或等价）；失败则 Blocked 并记恢复条件 |

**回退**：源分支上 `git revert` 相关提交（已共享历史不用破坏性 reset）；保留顶栏 `hexCollapsed` 与解析行为不受损。

### 无法执行验证时

- **记录**原因（无 PG、无浏览器、依赖安装失败等）→ **评估**风险（哪条 P0 未证）→ **恢复条件**（环境就绪后重跑命令/手测）→ 写入 `dev-notes.md` / 工作项阻塞字段（由 Manager）。**禁止**静默跳过。

## 交接顺序

1. **本 Plan** 经用户确认 → Manager 持久化 → 状态 `planned` → 调度 Developer。
2. Developer：T1–T9 于 `hex-collapse`；`dev-notes.md`；**不**改 STATUS。
3. Reviewer：`review.md`；须 `Approve`。
4. QA：`qa-report.md`；Pass 后待用户授权合并。
5. Manager：授权后源分支置 `done` 并按 git.md 一次提交报告/STATUS；Merge Executor 合入 `main`。

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-07-27 | 初稿（refine-docs）：Design skipped；T1–T9；awaiting-plan-approval |

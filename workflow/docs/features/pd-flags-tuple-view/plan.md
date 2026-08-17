# Plan: pd-flags-tuple-view

> **确认门禁：awaiting-plan-approval**（2026-08-17）。用户在登记时已预先授权完整流程（「按照标准流程补充完整缺乏的步骤，做好 review 和 QA 校验，没有问题允许提交并 push」，记录于 manager 工作项进度笔记），条件为 Review Approve + QA Pass 且无阻塞项；任一环节有问题即停下请示。据此本 Plan 视为已获确认，Manager 持久化后进入 `planned`。

## 元信息

- 工作项标识: pd-flags-tuple-view
- sub-feature-id: pd-flags-tuple-view（未拆分）
- 依据 Spec: `workflow/docs/features/pd-flags-tuple-view/spec.md`（用户确认 not-required，无业务歧义）
- 依据 Design / UI/UX: **N/A**（Design 门禁 `skipped`；复用 infomask-detail 位格条合同与既有 CSS grid 模式）
- 路径等级: standard
- Review 门禁: **required**（进入 QA 前须 Reviewer `Approve`）
- 源分支: `pd-flags-tuple-view`（自 `main` 创建并检出；**禁止**在 `main` 直接实施）
- 目标分支: `main`
- 最低验证层: **L2（page-core + web 单测、typecheck、build）+ 定向浏览器手测（单行渲染、pd_flags 位带）**
  - 理由：核心变更均为可单测纯函数（`decodePdFlags`、`deriveStructureFields`、`groupSegmentsIntoLanes`）；视觉重叠修复需手测佐证。
- **特殊性**：实现代码已由用户预先完成于工作区（随分支迁移至源分支）。Developer 阶段为**核对/补强型**——对照 Spec/Plan 核查实现与测试覆盖、补缺口、跑验证、写 `dev-notes.md`；不做超出 Spec 的重写。

## 适用工程规范

- [文档工程](../../standards/documentation.md)
- [Git 协作](../../standards/git.md)（源 `pd-flags-tuple-view` → 目标 `main`）
- [质量与验证](../../standards/quality.md)
- [安全](../../standards/security.md)（无新认证/输入面；禁止提交 `.env`/凭据）

## 目标摘要

页头 `pd_flags` 位级解码与选中位带（对齐 infomask-detail 合同）；tuple 结构图改单物理行 lane、列前 padding 折叠、移除重叠 `data`/`data-gap-*` 字段。Spec：**7×P0 + 2×P1**。

## 现状锚点（实施时对照）

| 位置 | 基线 | 本项目标 |
|---|---|---|
| `packages/page-core/src/flags.ts` | 无 PD 位解码 | 新增 `decodePdFlags` + PD 常量 |
| `packages/page-core/src/index.ts` | 导出 3 个解码函数 | 增导出 `decodePdFlags`（及常量） |
| `packages/page-core/src/structure-fields.ts` | 生成 `data-gap-*` 填缝字段；列 range=解码值 | 移除填缝；列视觉起点前伸折叠 padding；无列时保留整体 `data` |
| `apps/web/src/structureLayout.ts` | 按 tuple 拆多 lane | 恒单 lane 按 `(colStart,colEnd,id)` 排序 |
| `apps/web/src/StructureMap.tsx` | 多 lane 纵向堆叠 | 取 lane[0] 单行渲染；选中 `header.pd_flags` 显示 `FlagBitStripSolo` |
| `apps/web/src/InfomaskBitStrip.tsx` | 仅 `InfomaskBitPair` | 新增 `FlagBitStripSolo` 单条位带 |
| `apps/web/src/styles.css` | `.structure-row-lanes`/`-lane` 多行样式 | 删除之；`.field-cell { grid-row: 1 }` |

## 任务拆解

> 本项实现已存在；各任务按「核对 → 补测 → 记录证据」执行，发现实现与 Spec 偏离时修复并在 `dev-notes.md` 记录。

### T1 — 分支与基线

- **完成条件**:
  - 源分支 `pd-flags-tuple-view` 已自 `main` 创建并检出（含用户预实现的工作区改动）；已确认不在 `main` 上实施。
  - 记录基线：`git status` 干净度（预期仅本工作项改动）；无 `package-lock.json`（已删，pnpm 项目）。
- **触碰路径**: git 工作树
- **验收映射**: 分支门禁（git.md）

### T2 — pd_flags 解码与导出（核对 + 单测）

- **完成条件**:
  - `decodePdFlags` 位定义/顺序/UNKNOWN 聚合与 Spec P0-1 合同一致；`index.ts` 导出齐全。
  - `packages/page-core/tests/parse.test.ts` 覆盖：0x0、单置位、混合置位、残余位 UNKNOWN、合法值无 UNKNOWN。
- **触碰路径**: `packages/page-core/src/flags.ts`、`src/index.ts`、`tests/parse.test.ts`
- **验收映射**: P0-1

### T3 — pd_flags 选中位带（核对 + 测试）

- **完成条件**:
  - `FlagBitStripSolo` 复用 `InfomaskBitStrip` 内部组件，交互合同（hex、hover/聚焦、`?` 参考、Close）与 infomask-detail 一致；选中 `header.pd_flags` 时渲染。
  - `formatInfomaskHex` 对 `pd_flags` 标签的输出有测试（`pd_flags=0x4`）。
- **触碰路径**: `apps/web/src/InfomaskBitStrip.tsx`、`InfomaskBitStrip.test.ts`、`StructureMap.tsx`
- **验收映射**: P0-2、P1-2

### T4 — 列 padding 折叠与字段集收敛（核对 + 单测）

- **完成条件**:
  - 有列 tuple：无 `.data`/`.data-gap-*` 字段；列 `end`=解码值；视觉 `start ≤ 解码 start` 且 ≥ `dataRange.start`；排序按 offset。
  - 无列 tuple：保留整体 `data` 字段（range=完整 dataRange）。
  - `structure-fields.test.ts` 覆盖上述断言（含 P0-3/4/5）。
- **触碰路径**: `packages/page-core/src/structure-fields.ts`、`tests/structure-fields.test.ts`
- **验收映射**: P0-3、P0-4、P0-5

### T5 — 单 lane 布局与单行渲染（核对 + 单测 + 样式）

- **完成条件**:
  - `groupSegmentsIntoLanes` 恒返回单 lane（空输入 `[[]]` 约定保留），排序键 `(colStart, colEnd, field.id)`；跨 tuple 段与 itemid 段同行平铺有测试。
  - `StructureMap.tsx` 渲染 lane[0]；`.field-cell { grid-row: 1 }`；删除 `.structure-row-lanes`/`.structure-row-lane` 且无残留引用（样式与 TSX 双查）。
  - `structureLayout.test.ts` 更新为单 lane 语义。
- **触碰路径**: `apps/web/src/structureLayout.ts`、`structureLayout.test.ts`、`StructureMap.tsx`、`styles.css`
- **验收映射**: P0-6、P0-7

### T6 — 回归与不回退核查

- **完成条件**:
  - tuple header 字段集/range、列值文本、infomask 位带、ItemId flags、选中↔hex 高亮不回退（手测 + 既有测试绿）。
  - `apps/server`、`parsePage` 语义零 diff（`git diff main --stat` 核对触碰面）。
- **触碰路径**: 无新增（核查）
- **验收映射**: P1-1

### T7 — 开发者验证关门

- **完成条件**: 跑下方验证命令全绿；手测清单完成或按 quality.md 记 Blocked；证据与偏离写入 `dev-notes.md`；不改 STATUS；交 Review。
- **触碰路径**: `workflow/docs/features/pd-flags-tuple-view/dev-notes.md`
- **验收映射**: 全部

## 依赖与顺序

```text
T1 分支/基线（已完成）
  ├─ T2 pd_flags 解码 ─┐
  ├─ T3 位带组件/接线 ─┤（T3 依赖 T2 的导出）
  ├─ T4 列折叠/字段集 ─┤
  └─ T5 单 lane/渲染 ──┴─ T6 回归核查 → T7 验证关门 → Review → QA
```

## 触碰路径（汇总预估）

| 路径 | 预期变更 |
|---|---|
| `packages/page-core/src/flags.ts` | 新增 `decodePdFlags` + PD 常量 |
| `packages/page-core/src/index.ts` | 新增导出 |
| `packages/page-core/src/structure-fields.ts` | 列折叠重构；移除 data-gap |
| `packages/page-core/tests/parse.test.ts` | 新增 pd_flags 用例 |
| `packages/page-core/tests/structure-fields.test.ts` | 更新字段集断言 |
| `apps/web/src/InfomaskBitStrip.tsx` | 新增 `FlagBitStripSolo` |
| `apps/web/src/InfomaskBitStrip.test.ts` | pd_flags 标签用例 |
| `apps/web/src/StructureMap.tsx` | 单行渲染 + pd_flags 位带 |
| `apps/web/src/structureLayout.ts` | 单 lane 简化 |
| `apps/web/src/structureLayout.test.ts` | 单 lane 语义用例 |
| `apps/web/src/styles.css` | 删多 lane 样式；`grid-row: 1` |
| `README.md` | 核对；若 UI 描述与新行为不符则同步（可在 dev-notes 记「已核无需改」） |
| `workflow/docs/features/pd-flags-tuple-view/dev-notes.md` | **新增** |
| `apps/server/**` | **禁止改** |
| `packages/page-core/src/parse.ts` / `decode.ts` | **禁止改**（解析语义） |

## 验证计划

### 验证命令

```bash
# L2 — 单测
pnpm --filter page-core test
pnpm --filter web test
pnpm test          # 全仓回归

# L2 — 类型与构建
pnpm -r typecheck
pnpm -r build

# UI 手测
pnpm dev:web       # 结合既有 fixture/实库页
```

### 预期证据

| 检查 | 通过证据 |
|---|---|
| page-core test | `decodePdFlags` 用例 + 既有解析用例全 Pass |
| web test | `groupSegmentsIntoLanes`/`FlagBitStrip`/布局用例全 Pass |
| `pnpm test` | 三包全绿 |
| typecheck / build | 零错误 |
| 手测 | 单行渲染无第二行 data；pd_flags 位带可用 |

### Spec 验收映射（开发者自测 + 建议 QA）

| ID | 要点 | 主要证明 |
|---|---|---|
| P0-1 | decodePdFlags 位解码 | page-core 单测 |
| P0-2 | pd_flags 选中位带 | 手测 + 组件测试 |
| P0-3 | 无重叠 data 字段 | structure-fields 单测 |
| P0-4 | padding 折叠进下一列 | structure-fields 单测 |
| P0-5 | 无列 tuple 保留整体 data | structure-fields 单测 |
| P0-6 | 单 lane 排序 | structureLayout 单测 |
| P0-7 | 单行渲染无第二行 | 手测（+ grid-row 样式核查） |
| P1-1 | 回归不回退 | 手测 + 全量单测 |
| P1-2 | 主题可读 | 手测（light/dark） |

### 建议 QA 范围

- **必测** P0-1..P0-7（单测复跑 + 手测 P0-2/P0-7）+ P1-1/P1-2。
- **回归**：infomask 位带、ItemId flags、选中↔hex 高亮、列值文本、未知类型页（整体 data）。
- **非目标抽查**：`apps/server`、`parse.ts`/`decode.ts` 无 diff。

### 手测清单（开发者）

1. 含多 tuple 页：每 cell part 单行，无第二行 "data" 重叠。
2. 选中 `header.pd_flags`：位带 + hex + hover/聚焦 + `?` 参考。
3. 选中 tuple 列字段：详情值文本正确；hex 双向高亮。
4. 未知类型/无 schema 页：整体 `data` 字段仍在。
5. light/dark 下位带与网格可读。

## Review 与进入 QA

- Review **required**：实现 + 测试 + `dev-notes.md` → Reviewer；**Approve** 后方可 QA；`Request changes` 回 Developer。
- QA 依据 Spec + 本 Plan，写 `qa-report.md`（Pass/Fail/Blocked）。

## 文档影响

| 类别 | 更新路径或 N/A |
|---|---|
| 开发文档 | `workflow/docs/features/pd-flags-tuple-view/dev-notes.md`（必做） |
| 用户文档 | `README.md` 核对；与新行为一致则记「已核无需改」 |
| 运维文档 | **N/A** — 无部署/监控/排障变更 |

## 风险与回退

| 风险 | 影响 | 缓解 / 回退 |
|---|---|---|
| padding 折叠后视觉区间互相覆盖错序 | 选择/高亮错位 | 单测断言单调性；手测页首尾 tuple |
| 移除 `data-gap` 后未知列数据不可寻址 | 部分字节无字段 | Spec 明确仅视觉收敛；hex 侧寻址不受影响；`resolveFieldAt` 回归 |
| 单行渲染 cell 过多挤压 | 可读性 | 手测大 tuple 页；必要时列宽由既有 grid 承担 |
| 误改解析语义 | P0 回归失败 | diff 核对禁止面；page-core 既有测试 |
| `FlagBitStripSolo` 交互与 Pair 不一致 | 体验断层 | 复用同一内部组件；对照 infomask-detail 手测 |

**回退**：源分支 `git revert` 相关提交；不影响 `main`。

### 无法执行验证时

- **记录**原因 → **评估**风险（哪条 P0 未证）→ **恢复条件** → 写入 `dev-notes.md` / 工作项阻塞字段（由 Manager）。**禁止**静默跳过。

## 交接顺序

1. 本 Plan 视为已确认（用户预先授权）→ Manager 持久化 → `planned` → 调度 Developer。
2. Developer：T1–T7 于 `pd-flags-tuple-view`；`dev-notes.md`；**不**改 STATUS。
3. Reviewer：`review.md`；须 `Approve`。
4. QA：`qa-report.md`；Pass 后凭用户预先授权合并（有阻塞则停）。
5. Manager：源分支置 `done` 并按 git.md 一次提交报告/STATUS；合入 `main` 并 push。

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-08-17 | 初稿：补齐型工作项（用户预实现）；Design skipped；T1–T7 |

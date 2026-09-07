# Plan: deleted-tuple-color

> **确认门禁：awaiting-plan-approval**（2026-08-24）。待用户确认后 Manager 持久化并进入 `planned`。

## 元信息

- 工作项标识: deleted-tuple-color
- sub-feature-id: deleted-tuple-color（未拆分）
- 依据 Spec: `workflow/archive/2026/deleted-tuple-color/spec.md`
- Spec 确认: **approved**（2026-08-24）。开放问题按建议关闭：判定 `t_xmax !== 0`；图例 `deleted`；色相红/玫红（hex 由实现选可读值）。
- 依据 Design / UI/UX: **N/A**（Design 门禁 `skipped`；色值与图例合同在 Spec）
- 路径等级: standard
- Review 门禁: **required**（进入 QA 前须 Reviewer `Approve`）
- 源分支: `deleted-tuple-color`（自 `main` 创建并检出；**禁止**在 `main` 直接实施）
- 目标分支: `main`
- 最低验证层: **L2（page-core + web 单测、typecheck、build）+ 定向浏览器手测（着色、图例、light/dark）**
  - 理由：判定为纯函数，可单测；底色/图例/主题对比需手测。
- **适用对象**：Developer / Reviewer / QA。**前置条件**：Spec 已确认。**操作步骤**：T1–T6 → Review Approve → QA。**预期结果**：验证命令全绿且手测清单完成（或 quality.md §6 记缺口）。**失败处理**：失败写入 `dev-notes.md`；Review `Request changes` 回 Developer。

## 适用工程规范

- [documentation.md](../../../agents/standards/documentation.md)
- [git.md](../../../agents/standards/git.md)（源 `deleted-tuple-color` → 目标 `main`）
- [quality.md](../../../agents/standards/quality.md)
- [security.md](../../../agents/standards/security.md)（无新认证/输入面；禁止提交 `.env`/凭据）
- [ui.md](../../../agents/standards/ui.md)（gui 底线：对比可读、选中态可辨）

## 目标摘要

结构图中 `t_xmax !== 0` 的 `LP_NORMAL` 元组整段使用删除底色，存活元组保持绿；图例增加 `deleted` chip。Spec：**4×P0 + 3×P1**。

## 现状锚点

| 位置 | 基线 | 本项目标 |
|---|---|---|
| `packages/page-core` | 无删除判定导出 | 导出 `isDeletedHeapTuple`（`t_xmax !== 0`） |
| `apps/web/src/StructureMap.tsx` | 全部 tuple 单元格 `region-tuple` | 删除元组附加 class；图例加 `deleted` |
| `apps/web/src/styles.css` | `--region-tuple` 绿 | 新增 `--region-tuple-deleted`（light/dark） |
| ItemId `.lp-dead` | 半透明 + 删除线 | **不改** |

## 任务拆解

### T1 — 分支

- **完成条件**: 自 `main` 创建并检出 `deleted-tuple-color`。
- **触碰路径**: git 工作树
- **验收映射**: git.md 分支门禁

### T2 — 判定函数与单测（P0-1）

- **完成条件**:
  - `isDeletedHeapTuple(tuple): boolean`：`header.t_xmax !== 0` → `true`，否则 `false`；**不**读 infomask。
  - 放在 `packages/page-core/src/flags.ts`（与 HEAP_XMAX_* 同文件，便于对照「故意忽略 infomask」）。
  - `index.ts` 导出该函数；既有导出不变。
  - 单测：`t_xmax` 为 `0` / `1` / `14170`；`t_xmax !== 0` 且 infomask 含 `HEAP_XMAX_INVALID` 或 `HEAP_XMAX_LOCK_ONLY` 仍为 `true`。
- **触碰路径**: `packages/page-core/src/flags.ts`、`src/index.ts`、`tests/parse.test.ts`（或同包新测文件）
- **验收映射**: P0-1

### T3 — 结构图 class 接线（P0-2、P0-3）

- **完成条件**:
  - 从 `field.id` 匹配 `^tuple-(\d+)\.`，在 `page.tuples` 中取对应项，调用 `isDeletedHeapTuple`；禁止在 web 再写 `xmax` 比较。
  - 删除态单元格 class 含 `tuple-deleted`（`region` 仍为 `"tuple"`，不扩展 `StructureFieldRegion`）。
  - 存活元组、header、ItemId、free **不加**该 class。
  - 可测辅助：page-core 导出 `isDeletedStructureField(page, field): boolean`（id 前缀 + `isDeletedHeapTuple`），供 web 调用与单测 P0-2/P0-3（无 React）。
- **触碰路径**: `packages/page-core/src/flags.ts` 或 `structure-fields.ts`、`src/index.ts`、对应测试、`apps/web/src/StructureMap.tsx`
- **验收映射**: P0-2、P0-3

### T4 — 样式与图例（P0-4、P1-1）

- **完成条件**:
  - CSS 变量 `--region-tuple-deleted`：light 与 dark 各一红/玫红值，与 `--region-tuple` / header / itemid / free 可分辨。
  - `.field-cell.tuple-deleted`（及 dark 覆盖）使用该 token；选中 overlay 仍走既有 `--field-selected`，不得盖掉存活/删除区分。
  - 图例在 `tuple` chip 后增加 `deleted` chip，class 使用同一 token；既有四项文案与顺序不变。
- **触碰路径**: `apps/web/src/styles.css`、`apps/web/src/StructureMap.tsx`
- **验收映射**: P0-4、P1-1

### T5 — 不回退与文档

- **完成条件**:
  - `LP_DEAD` ItemId 仍为 `.lp-dead`（半透明 + 删除线），不用 `--region-tuple-deleted`。
  - `parsePage` / 列解码 / 单 lane / padding 折叠 / 字段 range **零行为变更**（禁止面 diff 核对）。
  - `README.md`（及中文 README 若有对等句）在结构图功能列表注明删除元组异色。
- **触碰路径**: `README.md`、`README.zh-CN.md`（若存在对等句）；禁止面见下表
- **验收映射**: P1-2、P1-3

### T6 — 开发者验证关门

- **完成条件**: 验证命令全绿；手测清单完成或按 quality.md §6 记缺口；`dev-notes.md` 写证据；不改 STATUS；交 Review。
- **触碰路径**: `workflow/archive/2026/deleted-tuple-color/dev-notes.md`
- **验收映射**: 全部

## 依赖与顺序

```text
T1 分支
  → T2 isDeletedHeapTuple
    → T3 结构图接线
      → T4 CSS + 图例
        → T5 回归/README → T6 验证关门 → Review → QA
```

## 触碰路径（汇总）

| 路径 | 预期变更 |
|---|---|
| `packages/page-core/src/flags.ts` | `isDeletedHeapTuple`（+ `isDeletedStructureField`） |
| `packages/page-core/src/index.ts` | 导出上述函数 |
| `packages/page-core/tests/parse.test.ts` 或新测文件 | P0-1 / P0-2 / P0-3 |
| `apps/web/src/StructureMap.tsx` | class + 图例 chip |
| `apps/web/src/styles.css` | `--region-tuple-deleted` 与 `.tuple-deleted` |
| `README.md` / `README.zh-CN.md` | 结构图一句 |
| `workflow/archive/2026/deleted-tuple-color/dev-notes.md` | **新增** |
| `apps/server/**` | **禁止改** |
| `packages/page-core/src/parse.ts` / `decode.ts` | **禁止改** |
| `StructureFieldRegion` 枚举 | **禁止扩** |
| ItemId `.lp-dead` 规则 | **禁止改语义** |

## 验证计划

### 验证命令

```bash
pnpm --filter page-core test
pnpm --filter web test
pnpm test
pnpm -r typecheck
pnpm -r build
pnpm dev:web
```

### 预期证据

| 检查 | 通过证据 |
|---|---|
| page-core test | `isDeletedHeapTuple` / `isDeletedStructureField` 用例 + 既有用例 Pass |
| web test | 既有布局/位带用例 Pass |
| `pnpm test` | 全仓绿 |
| typecheck / build | 零错误 |
| 手测 | 删除行异色、图例 `deleted`、light/dark 可辨、LP_DEAD ItemId 未改 |

### Spec 验收映射

| ID | 要点 | 主要证明 |
|---|---|---|
| P0-1 | `t_xmax !== 0` 判定，忽略 infomask | page-core 单测 |
| P0-2 | 删除元组整段 `tuple-deleted` | `isDeletedStructureField` 单测 + 手测底色 |
| P0-3 | 同行异色；非 tuple 不加 class | 同上 |
| P0-4 | 图例 `deleted` 同源 token | 手测 + CSS/TSX 核对 |
| P1-1 | light/dark 五类可辨；选中 overlay | 手测 |
| P1-2 | ItemId `LP_DEAD` 不回退 | 手测 + 样式 diff |
| P1-3 | hex 联动 / 单 lane / 字段值 | 既有单测 + 手测 |

### 建议 QA 范围

- **必测** P0-1..P0-4；手测 P0-2/P0-4 与 P1-1。
- **回归** P1-2、P1-3：选中↔hex、单 lane、列值、infomask 位带、`LP_DEAD` ItemId。
- **非目标抽查**：`parse.ts`/`decode.ts`/`apps/server` 无 diff；hex dump 色未改。

### 手测清单（开发者）

1. 含 `xmax=0` 与 `xmax≠0` 的页：删除元组整段异色，存活仍绿。
2. 同行混排时 header / ItemId / free 不误用删除色。
3. 图例 `deleted` chip 与删除单元格同色系。
4. light 与 dark 下五类区域可辨；选中后仍能区分存活/删除。
5. `LP_DEAD` ItemId 仍为半透明 + 删除线。
6. 点击删除元组字段：hex 双向高亮仍可用。

## Review 与进入 QA

- Review **required**：实现 + 测试 + `dev-notes.md` → Reviewer；**Approve** 后方可 QA；`Request changes` 回 Developer。
- QA 依据 Spec + 本 Plan，写 `qa-report.md`（Pass / Fail / Blocked）。

## 文档影响

| 类别 | 更新路径或 N/A |
|---|---|
| 开发文档 | `dev-notes.md`（必做） |
| 用户文档 | `README.md`；`README.zh-CN.md` 若有对等「Structure diagram」句则同步 |
| 运维文档 | **N/A** — 无部署/监控/排障变更 |

## 风险与回退

| 风险 | 影响 | 缓解 / 回退 |
|---|---|---|
| `xmax≠0` 含行锁/中止事务 | 假阳性着色 | Spec 已接受；不读 infomask |
| 删除色对比不足 | P1-1 失败 | 对照 `--danger` 选值；两主题手测 |
| 选中 overlay 盖住底色差 | 无法区分 | overlay 保持半透明；手测 selected |
| 误改解析或 LP_DEAD | 回归失败 | 禁止面 diff；既有测试 |

**回退**：源分支 `git revert`；不影响 `main`。

### 无法执行验证时

记录原因 → 评估未证 P0 → 恢复条件 → 写入 `dev-notes.md`。**禁止**静默跳过。浏览器手测不可用时：P0-2/P0-4/P1-1 降为 CSS/class 结构性证据 + quality.md §6。

## 交接顺序

1. 用户确认本 Plan → Manager 持久化 → `planned` → 调度 Developer。
2. Developer：T1–T6 于 `deleted-tuple-color`；`dev-notes.md`；**不**改 STATUS。
3. Reviewer：`review.md`；须 `Approve`。
4. QA：`qa-report.md`；Pass 后请示合并授权。
5. 授权后 Manager 在源分支置 `done`，与未入库报告一次提交；再合入 `main`。

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-08-24 | 初稿：T1–T6；Design skipped；判定确认 `t_xmax !== 0` |

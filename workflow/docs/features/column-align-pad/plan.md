# Plan: column-align-pad

> **确认门禁：awaiting-plan-approval**。待用户确认后 Manager 持久化并进入 `planned`。

## 元信息

- 工作项标识: column-align-pad
- sub-feature-id: column-align-pad（未拆分）
- 依据 Spec: `workflow/docs/features/column-align-pad/spec.md`
- Spec 确认: **approved**（2026-09-01）。开放问题：1=a 留空；2=是（列尾空洞不并入末列）；3=否（无 pad 图例）。
- 依据 Design / UI/UX: **N/A**（Design 门禁 `skipped`；留空无新控件，合同在 Spec）
- 路径等级: standard
- Review 门禁: **required**（进入 QA 前须 Reviewer `Approve`）
- 源分支: `column-align-pad`（自 `main` 创建并检出；**禁止**在 `main` 直接实施）
- 目标分支: `main`
- 最低验证层: **L2（page-core + web 单测、typecheck、build）+ 定向手测（items 列宽、空洞、hex 不误选列）**
  - 理由：`deriveStructureFields` / `resolveFieldAt` 为纯函数可单测；空洞留空与无第二行 data 需目视。
- **适用对象**：Developer / Reviewer / QA。**前置条件**：Spec 已确认、本 Plan 已确认。**操作步骤**：T1–T6 → Review Approve → QA。**预期结果**：验证命令全绿且手测完成（或 quality.md §6 记缺口）。**失败处理**：写入 `dev-notes.md`；Review `Request changes` 回 Developer。

## 适用工程规范

- [文档工程](../../standards/documentation.md)
- [Git 协作](../../standards/git.md)（源 `column-align-pad` → 目标 `main`）
- [质量与验证](../../standards/quality.md)
- [安全](../../standards/security.md)（无新认证/输入面；禁止提交 `.env`/凭据）
- [UI](../../standards/ui.md)（gui 底线：布局稳定、无第二行重叠）

## 目标摘要

废止列前 padding 折叠：列格 range = 解码 range；`dataRange` 内空洞（含列尾至 `lp_len`）留空、无 `pad-*`。Spec：**7×P0 + 3×P1**。

## 现状锚点

| 位置 | 基线 | 本项目标 |
|---|---|---|
| `packages/page-core/src/structure-fields.ts` | `visualStart` 前伸吸收 padding | 列 range 与 `columns[].range` 全等；不生成 `pad-*` / `data-gap-*` |
| `packages/page-core/tests/structure-fields.test.ts` | `drawn.start ≤ 解码 start` | `drawn.start === 解码 start`；空洞无字段；`resolveFieldAt(空洞)=null` |
| `apps/web` | 单 lane + 列格吞 pad | 无新组件；grid 空白列即空洞；hex 未映射走既有 `byte-N` |
| 图例 | 四色 region | **不**加 `pad` chip |

## 任务拆解

### T1 — 分支

- **完成条件**: 自 `main` 创建并检出 `column-align-pad`。不在 `main` 实施。
- **触碰路径**: git 工作树
- **验收映射**: git.md

### T2 — 单测先红（TDD）

- **完成条件**:
  - 有列且列间/首前/列尾存在 ≥1B 空洞的 fixture 或注入 `columns[].range` 的 tuple：`col-*`.range 与解码全等；不存在 `pad-*` 与 id 以 `.data` 开头的字段；空洞内偏移 `resolveFieldAt` 为 `null`。
  - `items` 类两行：变长 text 长度不同 + 其后 4B 列，两行该列 span 均为 4。
  - NULL 后非空列：`range.start` 仍为解码起点（P1-1）。
  - 无有效列且 `dataRange` 非空：仍有整体 `data`（P0-7）。
  - 既有「`start ≤ 解码 start`」断言改为全等；本任务结束时这些新断言相对当前实现为 **失败**（红）。
- **触碰路径**: `packages/page-core/tests/structure-fields.test.ts`（必要时最小 fixture 辅助，不改 `parse.ts`/`decode.ts` 语义）
- **验收映射**: P0-1、P0-2、P0-3、P0-5、P0-7、P1-1

### T3 — 去掉折叠

- **完成条件**:
  - 删除 `visualStart` 前伸；列字段 `range` 直接用解码区间。
  - 不新增 `pad-*`；有列时仍不生成 `.data` / `data-gap-*`。
  - T2 用例转绿；相邻列 `start` 单调允许 gap。
- **触碰路径**: `packages/page-core/src/structure-fields.ts`
- **验收映射**: P0-1、P0-3、P0-6 字段集部分

### T4 — web 未映射字节

- **完成条件**:
  - `findStructureAt` 在空洞上为 `null`（与 `resolveFieldAt` 一致）；hex 点击仍走既有 `byte-N`，不误选相邻列。`diff.test.ts` 或等价用例锁一条空洞偏移。
  - 不改 `groupSegmentsIntoLanes` 单 lane 合同；不为空洞加覆盖层。
- **触碰路径**: `apps/web/src/diff.ts`（仅当行为不符）、`apps/web/src/diff.test.ts`；原则上 **不改** `StructureMap.tsx` / `styles.css` / 图例
- **验收映射**: P0-4、P0-5、P0-6 渲染部分、P1-3

### T5 — 文档核对

- **完成条件**:
  - `README.md` / `README.zh-CN.md` 未写「padding 折叠进下一列」则记「已核无需改」；若有则改一句为「列格对齐解码字节，对齐空档留空」。
  - 图例无 `pad` chip（P 确认 3）。
- **触碰路径**: README 仅在有对等句时；`dev-notes.md` 记录核对结果
- **验收映射**: 非目标图例；文档影响

### T6 — 开发者验证关门

- **完成条件**: 下方命令全绿；手测清单完成或 quality.md §6 记缺口；`dev-notes.md` 含证据与禁止面 diff（`parse.ts`/`decode.ts`/`apps/server` 零语义改动）；不改 STATUS；交 Review。
- **触碰路径**: `workflow/docs/features/column-align-pad/dev-notes.md`
- **验收映射**: 全部

## 依赖与顺序

```text
T1 分支
  → T2 单测先红
    → T3 去掉折叠（转绿）
      → T4 web 空洞命中
        → T5 README 核对 → T6 验证关门 → Review → QA
```

## 触碰路径（汇总）

| 路径 | 预期变更 |
|---|---|
| `packages/page-core/src/structure-fields.ts` | 去掉 visualStart 折叠 |
| `packages/page-core/tests/structure-fields.test.ts` | P0/P1 断言 |
| `apps/web/src/diff.test.ts` | 空洞 `findStructureAt` → null |
| `apps/web/src/diff.ts` / `StructureMap.tsx` / `styles.css` | 仅当既有行为违反 Spec 才改 |
| `README.md` / `README.zh-CN.md` | 仅当有折叠表述 |
| `workflow/docs/features/column-align-pad/dev-notes.md` | **新增** |
| `apps/server/**`、`parse.ts`、`decode.ts` | **禁止改**（解析语义） |
| 图例 / `StructureFieldRegion` | **禁止**加 pad |

## 验收

见 `spec.md` P0-1…P0-7、P1-1…P1-3。本 Plan 不复述 Given-When-Then。

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
| page-core test | 列 range 全等、空洞无字段、`resolveFieldAt(空洞)=null`、无列 `data` 保留；既有用例 Pass |
| web test | 空洞 `findStructureAt` null；单 lane / 位带既有用例 Pass |
| `pnpm test` | 全仓绿 |
| typecheck / build | 零错误 |
| 手测 | `items` 各行 `price` 格同宽；空洞留空；点空洞 hex 不选中 price |

### Spec 验收映射

| ID | 要点 | 主要证明 |
|---|---|---|
| P0-1 | 列 range = 解码 | page-core 单测 |
| P0-2 | 变长 name 下 price span=4 | page-core 单测（+ 手测 items） |
| P0-3 | 空洞无 col/pad/data | page-core 单测 |
| P0-4 | 选中列不含空洞 | 手测 + range 单测 |
| P0-5 | 空洞不命中列 | page-core + web 单测 |
| P0-6 | 无 `.data*`、单 lane | page-core + structureLayout 既有测 |
| P0-7 | 无列整体 data | page-core 单测 |
| P1-1 | NULL 不吞空洞 | page-core 单测 |
| P1-2 | 空洞为底色空隙 | 手测（无浏览器则 §6） |
| P1-3 | 回归 | 全量单测 + 手测选中/hex |

### 建议 QA 范围

- **必测** P0-1…P0-7；手测 P0-2/P0-4/P0-5 与 P1-2（`public.items` blk 0）。
- **回归** P1-3：infomask/pd_flags 位带、ItemId、选中↔hex、无 schema 页 `data`。
- **抽查**：`parse.ts`/`decode.ts`/`apps/server` 无 diff；图例无 `pad`。

### 手测清单（开发者）

1. `public.items` 页 0：apple/banana/cherry 的 `price` 格同宽（4 列字节）。
2. `name` 与 `price` 之间可见空隙；空隙不是 free 带。
3. 选中 `price`：hex 只高亮 4 字节。
4. 点击空隙对应 hex：不选中 `price`/`name`。
5. 无列/未知类型页：整体 `data` 仍在。
6. 单行无第二行 `data`；light/dark 下空隙可辨。

## Review 与进入 QA

- Review **required**：实现 + 测试 + `dev-notes.md` → Reviewer；**Approve** 后方可 QA。
- QA 依据 Spec + 本 Plan 写 `qa-report.md`（Pass / Fail / Blocked）。

## 文档影响

| 类别 | 更新路径或 N/A |
|---|---|
| 开发文档 | `dev-notes.md`（必做） |
| 用户文档 | README 核对；无「折叠」表述则 N/A 并记证据 |
| 运维文档 | **N/A** — 无部署/监控/排障变更 |

## 风险与回退

| 风险 | 影响 | 缓解 |
|---|---|---|
| 空白列被看成渲染缺失 | 误报 bug | 手测对照 hex；QA 知悉「留空是合同」 |
| 列尾空洞被漏掉仍并入末列 | P0-3/确认 2 失败 | 单测覆盖 `dataRange.end` |
| 再引入 data-gap 重叠 | 第二行 data | P0-6 断言 + 禁止面 |
| 误改解码 | 列值错 | 禁止改 `decode.ts`；既有 decode 测 |

**回退**：源分支 `git revert`；不影响 `main`。

### 无法执行验证时

记录原因 → 未证的 P0 → 恢复条件 → `dev-notes.md`。**禁止**静默跳过。无浏览器时：P1-2/手测 1–6 降为 range 单测 + 结构性核对，并按 quality.md §6 登记。

## 交接顺序

1. 用户确认本 Plan → Manager 持久化 → `planned` → 调度 Developer。
2. Developer：T1–T6 于 `column-align-pad`；`dev-notes.md`；**不**改 STATUS。
3. Reviewer：`review.md`；须 `Approve`。
4. QA：`qa-report.md`；Pass 后请示合并授权。
5. 授权后 Manager 在源分支置 `done`，与未入库报告一次提交；再合入 `main`。

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-09-01 | 初稿：T1–T6；Design skipped；确认 留空 + 含列尾空洞 + 无 pad 图例 |

# Plan: infomask-detail

> **确认门禁：待用户确认 / awaiting-plan-approval**（2026-07-27）。用户确认并经 Manager 持久化后，方可置 `planned` 并调度 Developer。Planner **不**自行改 STATUS / 工作项记录，**不**调度 Developer。

## 元信息

- 工作项标识: infomask-detail
- sub-feature-id: infomask-detail（未拆分）
- 依据 Spec: `workflow/docs/features/infomask-detail/spec.md`（**approved**，2026-07-27 用户「ok」）
- 依据 Design / UI/UX: **N/A**（Design 门禁 `skipped`；**禁止**写 `design.md` / `ui-design.md`；**UI/UX: N/A**，呈现与验收以 Spec 为准）
- 路径等级: standard
- Review 门禁: **required**（进入 QA 前须 Reviewer `Approve`）
- 源分支: `infomask-detail`（自当前 `main` 检出；**禁止**在 `main` 直接实施）
- 目标分支: `main`
- 最低验证层: **L2（`pnpm test` + typecheck/build）+ 定向浏览器手测**
  - **理由**：纯前端 Selection detail 呈现；位语义消费既有 `decodeInfomask` / `decodeInfomask2`，**禁止**改 `page-core`；无新 API → 不强制新集成测。L2 锁解码不回退；位格条 / hover·聚焦 / `?` / 主题与垂直空间靠手测（P0-1..P0-8、P1）。
- 验证命令: 见下方「验证计划」

## 适用工程规范

- [文档工程](../../standards/documentation.md)
- [Git 协作](../../standards/git.md)（源 `infomask-detail` → 目标 `main`；未授权不 commit / 不 push）
- [质量与验证](../../standards/quality.md)
- [安全](../../standards/security.md)（无新认证/输入面；禁止提交 `.env`/凭据）
- [UI](../../standards/ui.md)（呈现合同以 Spec 为准；主题沿用既有 light/dark）

## 目标摘要

优化 `pg-page-viewer` 左侧 Selection detail 中 **`t_infomask` / `t_infomask2`** 呈现：以 Spec 为准，统一为**可读 hex + 紧凑位格条**（方块=解码 `FlagBit[]` 一项；**高亮=置位**、未置=低调）+ **hover/键盘聚焦**单格 `name`/`meaning` + 旁侧 **`?`** 打开全量参考（可关闭；非默认占高列表）。零已置仍示 hex + 位格条。**禁止**改 `page-core` 解析/位定义；**禁止**改版 ItemId `lp_flags` 清单；选中详情入口、主值、列解码、HOT/ctid、结构图↔hex 联动不回退。Spec：**8×P0 + 2×P1**。

## 现状锚点（实施时对照）

| 位置 | 现状 | 本项目标 |
|---|---|---|
| `StructureMap.tsx` Selection detail（~504–518） | `t_infomask` / `t_infomask2` 各一 `.flag-list`：hex 行 + 纵向 ○/● `name — meaning` | 改为 hex + 位格条 + hover/聚焦 + `?`；双字段同一组件/模式 |
| 同文件 ItemId（~494–500） | `decodeItemIdFlags` + ○/● 纵向清单 | **保持现状**（Spec 非目标） |
| `styles.css` `.flag-list` / `.set` / `.unset` | 纵向清单样式 | 新增位格条/`?` 样式；ItemId 仍可用原 `.flag-list`（或共享低调/高亮语义时勿破坏 ItemId） |
| `page-core` `flags.ts`：`decodeInfomask` / `decodeInfomask2` | 返回 `FlagBit[]`（含 `HEAP_NATTS` 复合项，`set: true`） | **禁止改**；UI 直接消费，顺序=数组顺序 |
| HOT 摘要 / ctid / Columns | tuple 详情下方既有块 | **不削弱** |

与其它未合入分支冲突交 Manager，不擅自合 `main`。

## 任务拆解

> 纯 UI 接线为主；可选 web Vitest（非强制）。每项含完成条件与 Spec 验收映射。

### T1 — 分支与基线

- **完成条件**:
  - 自当前 `main` 创建并检出 `infomask-detail`（若已存在则检出并确认基于正确目标）。
  - 改前跑通 `pnpm -r typecheck` 与 `pnpm --filter web build`（或记录已知基线失败于 `dev-notes.md`）。
  - 确认工作树**不在** `main` 上实施。
- **触碰路径**: git 工作树（无业务代码）
- **验收映射**: 分支门禁（git.md）；为 P0-7/P0-8 回归铺底

### T2 — 位格条呈现组件（hex + 格 + hover/聚焦 + `?`）

- **完成条件**:
  - 新增可复用呈现单元（建议 `InfomaskBitStrip.tsx`；或内联但双字段须共用同一实现）。输入：字段标签、数值、`FlagBit[]`（来自既有 decode；**禁止**前端另造位定义表）。
  - 默认主区：可读 hex（`0x` + 与 header 一致）+ 位格条（一格=`FlagBit[]` 一项，顺序不变；置位高亮、未置低调）。**禁止**默认纵向 ○/● 或全量名称—含义列表。
  - 单格可 `tabIndex` 聚焦；hover **或** 聚焦展示该格 `name`/`meaning`（可见说明区优先于仅靠 `title`，以满足键盘等价）。
  - 旁侧独立 **`?` 按钮**（或等价）：打开该字段全量参考（名称、含义、置位可辨）；可关闭；打开态**不得**删除位格条（浮层或折叠区均可）。
  - 零已置：仍渲染 hex + 位格条且无置位高亮；`HEAP_NATTS` 等按解码 `set` 高亮，不因数值为 0 删位格条。
  - **禁止**修改 `packages/page-core/**`。
- **触碰路径**: `apps/web/src/InfomaskBitStrip.tsx`（或等价）；可选 `*.test.ts`
- **验收映射**: P0-1..P0-6（组件层）、P0-7（消费 decode 不改写）

### T3 — Selection detail 接线（仅两位字段）

- **完成条件**:
  - 在 `StructureMap.tsx` 中，将 `t_infomask` / `t_infomask2` 的 `.flag-list` 纵向清单替换为 T2 组件：`decodeInfomask(header.t_infomask)` / `decodeInfomask2(header.t_infomask2)`。
  - 双字段同一呈现模式（P0-5）；仅条目集随各自解码结果不同。
  - ItemId `flag-list`、`fullLabel`/主值、HOT 摘要、ctid/跨块、Columns、highlight 字节提示**行为不回退**。
  - 无 `selectedTuple` 时不展示两位格条（与现状一致）。
- **触碰路径**: `apps/web/src/StructureMap.tsx`
- **验收映射**: P0-1、P0-2、P0-5、P0-8；非目标：ItemId 保持清单

### T4 — 样式与主题可读

- **完成条件**:
  - `styles.css`：位格条紧凑布局（显著短于原纵向清单，P1-2）；置位/未置、`?` 控件、单格说明与全量参考在 **light 与 dark** 下可辨（P1-1）；方向简约、美观、现代，贴合既有变量（`--text-muted`、`--accent` 等），**不**新增主题偏好键。
  - 不破坏 ItemId `.flag-list` 可读性；若类名冲突则位格条使用独立 BEM/前缀类。
- **触碰路径**: `apps/web/src/styles.css`
- **验收映射**: P1-1、P1-2；交叉 P0-1 视觉

### T5 — 无障碍与回归核对

- **完成条件**:
  - 位格可键盘聚焦；聚焦与 hover 对单格说明等价；`?` 可键盘激活。
  - 抽样核对：选中 tuple 字段 → Selection detail 打开/更新；结构图↔hex 高亮；列解码与 ctid 入口仍可用；ItemId flags 仍为原清单。
  - `git diff` 确认无 `packages/page-core/**`、无 `apps/server/**` 业务变更。
- **触碰路径**: T2/T3/T4 已改文件；核对用
- **验收映射**: Spec 错误与约束「无障碍」；P0-7、P0-8

### T6 — 文档与开发者验证关门

- **完成条件**:
  - 新增 `workflow/docs/features/infomask-detail/dev-notes.md`（偏离、验证命令输出摘要、手测勾选、限制）。
  - 跑下方验证命令；手测清单完成或按 quality.md §6 记 Blocked（原因/风险/恢复条件）。
  - **不**改 `workflow/docs/manager/STATUS.md` 或工作项记录；交 Review。
  - README：若无用户可见误导表述则 **N/A**（本项为详情面板呈现，当前 README 未描述 ○/● 清单）；若发现误导再改并记入 dev-notes。
- **触碰路径**: `workflow/docs/features/infomask-detail/dev-notes.md`；必要时 `README.md`
- **验收映射**: 全部 P0 + P1；文档影响

## 依赖与顺序

```text
T1 分支与基线
 └─ T2 位格条组件（hex + 格 + hover/聚焦 + ?）
      └─ T3 StructureMap 接线（仅 infomask / infomask2）
           └─ T4 样式 / 主题可读
                └─ T5 a11y + 回归核对（page-core 无 diff）
                     └─ T6 dev-notes + 验证关门 → Review → QA
```

T3 依赖 T2；T4 可与 T3 尾部并行，合并前须集成手测。

## 触碰路径（汇总预估）

| 路径 | 预期变更 |
|---|---|
| `apps/web/src/InfomaskBitStrip.tsx`（或等价） | **新增** 位格条 + `?` 参考 |
| `apps/web/src/StructureMap.tsx` | 替换两位字段纵向清单；ItemId 不动 |
| `apps/web/src/styles.css` | 位格条 / 说明 / `?` 面板样式 |
| `apps/web/src/*.test.ts` | **可选** 展示辅助测 |
| `workflow/docs/features/infomask-detail/dev-notes.md` | **新增** |
| `README.md` | 默认不动；仅有误导时改 |
| `packages/page-core/**` | **禁止改** |
| `apps/server/**` | **禁止改** |

## 验证计划

### 验证命令

```bash
# L2 — page-core / server 回归（本项不改其语义，必须仍通过）
pnpm test

# L2 — 若新增 web 测
pnpm --filter web test

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
| `pnpm test` | page-core + server 既有用例全 Pass（含 `decodeInfomask` 相关） |
| `web test`（若有） | 新增用例全 Pass；无新增则记 N/A |
| typecheck / build | 零错误；web 产物成功 |
| `page-core` diff | 空（或仅无关噪音已说明） |
| 手测 | 下表 P0/P1 可观察行为成立；记入 `dev-notes.md` |

### Spec 验收映射（开发者自测 + 建议 QA）

| ID | 要点 | 主要证明 |
|---|---|---|
| P0-1 | 两位均为位格条；默认无纵向 ○/● 全量列表 | 手测 |
| P0-2 | 各自可读 hex 与 header 同源 | 手测（对照 `valueText`/header） |
| P0-3 | hover 或聚焦 → `name`+`meaning`；格态可分置位 | 手测 |
| P0-4 | `?` → 全量参考可关；主区仍紧凑 | 手测 |
| P0-5 | 双字段同一模式 | 手测 |
| P0-6 | 零已置仍 hex+位格条、无置位高亮（NATTS 例外按解码） | 手测或夹具页 |
| P0-7 | 置位集合=decode；未改 page-core | `pnpm test` + git diff |
| P0-8 | 详情/联动/列/ctid/ItemId 不回退 | 手测 |
| P1-1 | light/dark 可读 | 手测 Theme 切换 |
| P1-2 | 默认垂直占用显著短于原清单 | 手测对比 |

### 建议 QA 范围

- **必测** P0-1..P0-8；**P1-1、P1-2**。
- **回归**：选中字段主值；结构图↔hex；Columns；ctid 跨块；ItemId ○/● 清单仍在。
- **非目标抽查**：无 `page-core` / server API 变更；无 ItemId 改版；无新主题键。

### 手测清单（开发者）

1. 加载含 NORMAL tuple 的页 → 选中 tuple 字段 → Selection detail：`t_infomask` / `t_infomask2` 为 hex + 位格条，无默认纵向 ○/● 全列表。
2. 对照结构图/主值：hex 与 header 一致；置位格高亮与 `decode*` 一致。
3. 鼠标 hover 与 Tab 聚焦某格：均可见该格 `name`/`meaning`。
4. 点 `?`：全量参考含全部位且置位可辨；关闭后仍为紧凑主呈现。
5. 找 `t_infomask==0`（或无解码置位）样例：仍有 hex+位格条、无置位高亮；`t_infomask2` 的 `HEAP_NATTS` 按解码高亮且位格条仍在。
6. 选中 ItemId：仍为 ○/● 纵向清单。
7. Theme 切换 light/dark：格态与面板可读。
8. 目测：同页同选中下，infomask 区域默认高度显著短于改版前纵向清单。

## Review 与进入 QA

- Review **required**：T1–T6 + `dev-notes.md` → Reviewer；**Approve** 后方可 QA；`Request changes` 回 Developer。
- QA 依据 Spec + 本 Plan，写 `qa-report.md`（Pass/Fail/Blocked）。
- Review 门禁是进入 QA 的前置条件，不是调用 Reviewer 的前置条件。

## 文档影响

| 类别 | 更新路径或 N/A |
|---|---|
| 开发文档 | `workflow/docs/features/infomask-detail/dev-notes.md`（必做）；实现中必要旁注仅非显而易见处 |
| 用户文档 | **N/A**（默认）— README 未描述旧 ○/● 清单；若发现误导则改 `README.md` 并在 dev-notes 说明 |
| 运维文档 | **N/A** — 无部署/监控/排障变更 |

## 风险与回退

| 风险 | 影响 | 缓解 / 回退 |
|---|---|---|
| `?` 浮层遮挡详情/滚动 | P0-4 体验差 | 优先折叠区或定位在位格条旁；手测关闭后布局 |
| 仅用 `title` 导致聚焦无说明 | P0-3 / a11y 失败 | 聚焦时须有可见说明或等价；手测 Tab |
| 样式改动波及 ItemId `.flag-list` | P0-8 回归 | 独立类名；手测 ItemId |
| 误改 page-core 位定义 | P0-7 / 范围失控 | PR/自检禁止 core diff；回退相关提交 |
| 在 `main` 上实施 | 分支门禁失败 | T1 强制检出源分支 |

**回退**：源分支上 `git revert` 相关提交（已共享历史不用破坏性 reset）；ItemId 与 page-core 行为不受损。

### 无法执行验证时

- **记录**原因（无 PG、无浏览器、依赖安装失败等）→ **评估**风险（哪条 P0/P1 未证）→ **恢复条件**（环境就绪后重跑命令/手测）→ 写入 `dev-notes.md` / 由 Manager 填工作项阻塞字段。**禁止**静默跳过。

## 交接顺序

1. **本 Plan** 经用户确认 → Manager 持久化 → 状态 `planned` → 调度 Developer。
2. Developer：T1–T6 于 `infomask-detail`；`dev-notes.md`；**不**改 STATUS；**不**在确认前开始实施。
3. Reviewer：`review.md`；须 `Approve`。
4. QA：`qa-report.md`；Pass 后待用户授权合并。
5. Manager：授权后源分支置 `done` 并按 git.md 一次提交报告/STATUS；Merge Executor 合入 `main`。

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-07-27 | 初稿（refine-docs）：Design skipped；T1–T6；源 `infomask-detail`→`main`；awaiting-plan-approval |

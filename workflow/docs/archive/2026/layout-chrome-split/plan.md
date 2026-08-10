# Plan: layout-chrome-split

## 元信息

- 工作项标识: layout-chrome-split（sub-feature-id 同；未拆分）
- 依据 Spec: `workflow/docs/features/layout-chrome-split/spec.md`（已确认；Q1–Q6 含第三轮微调已裁决）
- 依据 Design: `workflow/docs/features/layout-chrome-split/design.md`
- 依据 UI Design: `workflow/docs/features/layout-chrome-split/ui-design.md`
- 路径等级: full
- Review 门禁: **required**（进入 QA 前须 Reviewer `Approve`）
- 源分支: `layout-chrome-split` → 目标: `main`
- UI/UX: 必做（对照 `ui-design.md`）；非 N/A
- 最低验证层: **L2（回归）+ 定向手测**
  - **理由**：无新 `page-core` 纯函数；L2 锁定解析/映射不回退 + web typecheck/build。第四轮为条件渲染与 CSS Grid 布局细化，须浏览器定向手测确认展开/折叠/恢复三态。
- 验证命令:

```bash
# L2 — 既有 core / server（禁止改其语义；须仍通过）
pnpm test

# L2 — 类型与构建
pnpm typecheck
pnpm --filter web build

# 可选 L3 — 实库冒烟（有 PG 时）
pnpm test:integration
```

## 适用工程规范

- [文档工程](../../standards/documentation.md)
- [Git 协作](../../standards/git.md)
- [质量与验证](../../standards/quality.md)
- [安全](../../standards/security.md)
- [UI/UX](../../standards/ui.md)

## 目标摘要

**第四轮增量**（在已完成的 T1–T14 壳层之上）：移除 hex pane 内 `HEX` / `Hex` 标签；折叠时不渲染 hex pane、`Hex collapsed` 或空右列，结构图占满主内容区；主带 Collapse hex / Show hex 仍为唯一入口；Show hex 后宽屏恢复结构图左 ‖ hex 右。不改 `page-core`、server 或 API。

## 基线（已完成，勿重做）

| 任务 | 状态 | 说明 |
|---|---|---|
| T1–T8 | **已完成**（见 `dev-notes.md`） | 侧栏移除、顶栏主控初版、次带元信息、960 分栏、联动/键盘/文档 |
| T9–T14 | **已完成**（见 `dev-notes.md`） | 主/次带重排、Collapse 唯一入口、连接 hover、统计空态与回归 |

本轮 Developer **仅执行 T15–T16**。

## 任务拆解

### T9 — 主带固定顺序 + Collapse 迁入

- **完成条件**:
  - 主带从左到右：**标题 → connected 徽标 → Collapse hex（`page_loaded`）→ Theme**；Collapse 在 Theme **左侧**。
  - `page_loaded` 后 Collapse/Show hex 可发现并可切换 `hexCollapsed`；未加载页不显示该按钮。
  - 表 select / blkno / Load / Refresh **不在**主带。
- **触碰路径**: `apps/web/src/App.tsx`、`apps/web/src/styles.css`
- **验收映射**: P0-4（主带顺序）、P0-5、P0-13（入口位置）

### T10 — 移除 hex 面板内 Collapse（唯一入口）

- **完成条件**:
  - hex `.pane-head` **无** Collapse/Show hex 按钮。
  - 第三轮曾保留 `HEX`/`Hex` 标签与折叠短占位；**该决策由 T15 取代，Developer 不得据此恢复**。
  - 展开**仅**靠主带 Show hex。
- **触碰路径**: `apps/web/src/App.tsx`、`apps/web/src/styles.css`
- **验收映射**: P0-13

### T11 — 次带：表控下移 + 统计空态

- **完成条件**:
  - `connected` 后次带含：表 select、`blkno`、Load、Refresh（可用性规则不变）；可完成选表→blkno→加载；Refresh 仍触发 diff。
  - 表/页统计在控件**之后**；**仅 `page_loaded`** 渲染必显清单（表名+OID、#blocks、blkno、页大小、lower/upper/free、ItemId 与 LP 分项、#tup）。
  - 未选表或未 `page_loaded`：统计区**空白**（整块不渲染）；**禁止** `—` / `N/A` /「未选表」/「加载页后显示」堆砌。
  - 次带**不**常驻长连接串与 PG 版本。
- **触碰路径**: `apps/web/src/App.tsx`、`apps/web/src/styles.css`
- **验收映射**: P0-1、P0-2、P0-4、P0-15

### T12 — 连接详情收入 connected 徽标

- **完成条件**:
  - 默认次带无 host/port/db/user、无 PG 版本占行。
  - hover 徽标显示浮层（全文，无密码）；键盘：徽标可聚焦，`:focus-visible` 显示浮层，并有同源 `title` 兜底。
  - `aria-live` 状态文案行为不回退。
- **触碰路径**: `apps/web/src/App.tsx`、`apps/web/src/styles.css`
- **验收映射**: P0-14、P0-11（连接全文）

### T13 — 分栏与联动回归（不回退）

- **完成条件**:
  - ≥960 + `page_loaded`：仍结构左 ‖ hex 右（约 55/45）；**禁止**宽屏仅上下。
  - &lt;960：上下堆叠仍可用；主带 Collapse/Theme、次带主控仍可达。
  - 双向高亮与 hex 自动滚语义保持（宽/窄各验一路径即可）。
- **触碰路径**: 预期仅确认/微调 `styles.css` / pane 包装；**禁止**为「好看」改回上下为宽屏唯一布局；**禁止**改 `page-core`
- **验收映射**: P0-6、P0-7、P0-8、P0-9、P0-10

### T14 — 验证、dev-notes 与交接

- **完成条件**:
  - 跑通 L2 验证命令；定向手测清单勾选并写入 `dev-notes.md`（本轮增量结果/偏离/未测）。
  - 确认 diff **无** `packages/page-core/**`、`apps/server/**`。
  - README 若仍描述「主带含表控」或「次带常驻连接串」则改写；否则记 N/A。
- **触碰路径**: `workflow/docs/features/layout-chrome-split/dev-notes.md`、`README.md`（若需）
- **验收映射**: P0-10；文档影响；手测证据

以上 T9–T14 为已完成基线，本轮不重做。

### T15 — 移除 Hex 标签与折叠 pane

- **完成条件**:
  - 展开态删除 hex pane 的 `.pane-head` 及 `HEX` / `Hex` 可见标签，HexDump 内容直接呈现。
  - 折叠态不渲染整个 hex pane，不显示 `Hex collapsed` 或其他占位，不保留 pane 边框、间距或空右列。
  - 折叠态 Grid 为单栏，结构图 pane 占满主内容区；主带按钮切为 Show hex，仍是唯一恢复入口。
  - Show hex 后恢复 hex pane；≥960px 恢复结构图左 ‖ hex 右，&lt;960px 恢复上下堆叠。
- **触碰路径**: `apps/web/src/App.tsx`、`apps/web/src/styles.css`
- **验收映射**: Spec P0-6、P0-7、P0-13；`ui-design.md` 第四轮折叠/展开细化

### T16 — 回归验证与交接记录

- **完成条件**:
  - 完成下方第四轮定向手测，截图或等价 DOM/布局证据写入 `workflow/docs/features/layout-chrome-split/dev-notes.md`。
  - 跑通 L2 命令；确认双向高亮、hex 自动滚、Theme、主带唯一切换入口未回退。
  - 确认 scoped diff 无 `packages/page-core/**`、`apps/server/**`；记录未执行项的原因、风险与恢复条件。
- **触碰路径**: `workflow/docs/features/layout-chrome-split/dev-notes.md`
- **验收映射**: P0-5..P0-10、P0-13；文档影响；第四轮手测证据

### P1（可选，不阻塞）

| ID | 内容 | 完成条件 |
|---|---|---|
| P1-1 | 宽屏拖拽分隔 | 未做则 `dev-notes` N/A |
| P1-2 | 极窄顶栏折行 | 主控与（有条件）统计可操作/扫读 |
| P1-3 | 多表过滤 | select 可定位目标表 |

## 依赖与顺序

```text
已完成：T1–T14
本轮：T15 → T16
       └─ T15 DOM 条件渲染与 Grid 单栏同时完成后再验证三态
```

## 触碰路径（汇总）

| 允许 | 禁止 |
|---|---|
| `apps/web/src/App.tsx`、`apps/web/src/styles.css`、`workflow/docs/features/layout-chrome-split/dev-notes.md` | `packages/page-core/**`、`apps/server/**`、改 API 合同、提交 `.env` |

## 验收

见 Spec P0-1..P0-15；UI 落点见 `ui-design.md`。前序归档 P0 回归不得因本项失败。

### 定向手测清单（第四轮必做）

1. **展开态无标签**：page loaded 且 hex 展开时，hex pane 内无 `HEX` / `Hex` 标签，≥960px 仍结构图左 ‖ hex 右。
2. **折叠完全退出**：点击主带 Collapse hex 后，无 `Hex collapsed` 文案、hex pane、边框、间距或残留右列；结构图占满主内容区。
3. **恢复分栏**：点击主带 Show hex 后，hex pane 恢复；≥960px 恢复左右分栏，&lt;960px 恢复上下堆叠；主带仍是唯一切换入口。
4. **能力回归**：展开后抽检结构图→hex 高亮/自动滚与 hex→结构图高亮；Theme 仍可用。

### 预期证据

| 验证 | 证据 |
|---|---|
| `pnpm test` | 全部 Pass |
| `pnpm typecheck` / `pnpm --filter web build` | 零错误；build 成功 |
| 定向手测 | `dev-notes` 逐条；至少保留展开无标签、折叠全宽无右列、Show hex 恢复左右三态截图或等价 DOM/布局证据 |
| 可选 `test:integration` | Pass；或记录无 PG 阻塞 |

## Review 门禁与进入 QA

1. Developer 完成 T15–T16，验证写入 `dev-notes.md`。
2. **Review 门禁 `required`**：Reviewer `Approve` 后方可进入 QA（Plan 预授权**不**豁免 Review）。
3. QA 对照 Spec P0（含 P0-13..15）+ 本 Plan 手测清单；结论写入 `qa-report.md`。
4. 合并须用户另授；禁止自动 merge/push。

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | `workflow/docs/features/layout-chrome-split/dev-notes.md`（本轮必更新） |
| 用户文档 | N/A（仅移除装饰标签/折叠占位；主带操作能力与用户流程不变） |
| 运维文档 | N/A（不改部署/API/env 语义） |

## 无法执行验证时

| 缺口 | 原因 | 风险 | 恢复条件 | 复测范围 |
|---|---|---|---|---|
| 无本机 PG | 无法实库 Load | 布局/空态/徽标可用已连会话或夹具页 | 恢复 PG 16.x + pageinspect | 手测 1–7 |
| 无图形浏览器 | 无法断点/hover 手测 | P0-6/13/14 无法证伪 | Chrome/Safari DevTools | 手测 1–6 |

**禁止**静默跳过；须写入 `dev-notes`。

## 交接顺序

1. **Planner**（本文件）→ Manager：Plan **预授权已续用** → 可 `planned` → `developing`，调度 Developer 执行 **T15–T16**。
2. **Developer**：T15–T16 → 更新 `dev-notes` → 交 Review（**不要**自调 QA）。
3. **Reviewer**：Approve / 变更请求。  
4. **QA**：独立验收 → `qa-report.md`。  
5. **Manager**：用户授权后合并/`done`。

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-07-26 | 初稿：T1–T8；L2+手测；Review required |
| 2026-07-26 | 第三轮增量：T9–T14（主带顺序、Collapse 唯一、次带表控、连接 hover、空态、分栏回归）；验证加 P0-13..15 定向手测 |
| 2026-07-26 | 第四轮 UI 细化：T15–T16（删 Hex 标签；折叠 pane 完全退出/结构图全宽；Show hex 恢复分栏） |

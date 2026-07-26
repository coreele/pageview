# Plan: layout-chrome-split

## 元信息

- 工作项标识: layout-chrome-split（sub-feature-id 同；未拆分）
- 依据 Spec: `docs/features/layout-chrome-split/spec.md`（已确认；Q1–Q6 已裁决）
- 依据 Design: `docs/features/layout-chrome-split/design.md`
- 依据 UI Design: `docs/features/layout-chrome-split/ui-design.md`
- 路径等级: full
- Review 门禁: **required**（进入 QA 前须 Reviewer `Approve`）
- 源分支: `layout-chrome-split` → 目标: `main`
- UI/UX: 必做（对照 `ui-design.md`）；非 N/A
- 最低验证层: **L2（回归）+ 定向 L3/手测**
  - **理由**：本项无新 `page-core` 纯函数；L2 锁定既有解析/映射不回退 + web typecheck/build。布局、断点、顶栏 IA、双向高亮与 hex 自动滚依赖真实视口与 DOM，须浏览器手测（有 PG 时实页；无 PG 时用已加载夹具页/本地已连库）。
- 验证命令:

```bash
# L2 — 既有 core / server（本项禁止改其语义；须仍通过）
pnpm test

# L2 — 类型与构建
pnpm typecheck
pnpm --filter web build

# 可选 L3 — 实库冒烟（有 PG 时；本项不改 server，用于取页回归）
pnpm test:integration
```

## 适用工程规范

- [文档工程](../../standards/documentation.md)
- [Git 协作](../../standards/git.md)
- [质量与验证](../../standards/quality.md)
- [安全](../../standards/security.md)
- [UI/UX](../../standards/ui.md)

## 目标摘要

顶栏主带承接 table/`blkno`/Load/Refresh；次带承接连接详情与页统计必显；删除左侧 Tables 栏；≥960 结构图左 ‖ hex 右（55%/45%），&lt;960 上下堆叠。保留主题、连库状态、双向高亮、hex 自动滚、键盘可达；不改 `page-core`/API。

## 任务拆解

### T1 — 分支与基线确认

- **完成条件**: 在源分支 `layout-chrome-split`（自 `main`）工作；确认工作区无意外改动 `page-core`/`server`；记录基线 `pnpm test` + `pnpm typecheck` 可通过。
- **触碰路径**: 无业务文件（或仅文档已存在）
- **验收映射**: 预备 P0-10

### T2 — 移除左侧专用栏

- **完成条件**: DOM/CSS 中无 Tables/`blkno`/Load 专用 `.nav`（或等价空壳）；`.body` 不再双列；主区可占满水平空间；主控不再依赖侧栏。
- **触碰路径**: `apps/web/src/App.tsx`、`apps/web/src/styles.css`
- **验收映射**: P0-3

### T3 — 顶栏主带：主控上移

- **完成条件**: `connected` 后主带含：连接状态徽标、表 `<select>`/combobox（限定名 + 块数）、`blkno`、Load、Refresh（`page_loaded` 后可用）、Theme；可完成选表→blkno→加载；Refresh 仍触发前序 diff 对比。
- **触碰路径**: `apps/web/src/App.tsx`、`apps/web/src/styles.css`（可选抽 `TopChrome` 子组件同目录）
- **验收映射**: P0-1、P0-2、P0-5（主题入口）

### T4 — 顶栏次带：元信息必显

- **完成条件**: 次带在对应状态展示 Spec 必显清单（连接无密码、PG 版本、表+OID、blkno、#blocks、页大小、lower/upper/free、ItemId 与 LP 分项、#tup）；长文本截断 + `title`/`tooltip`；与主带可区分扫读；结构图+hex 仍为主内容。
- **触碰路径**: `apps/web/src/App.tsx`、`apps/web/src/styles.css`
- **验收映射**: P0-4

### T5 — 主区宽屏左右 / 窄屏上下

- **完成条件**: `page_loaded` 且视口 ≥960px：CSS Grid 左右并排，结构图左、hex 右，初始约 55%/45%，两侧 `minmax(0,…)` 且可达；&lt;960：上下堆叠（图上 hex 下），各自可滚；未加载页不强制空分栏。
- **触碰路径**: `apps/web/src/App.tsx`、`apps/web/src/styles.css`；必要时微调 `StructureMap.tsx` / `HexDump.tsx` 外层 class（**禁止**改 `page-core`）
- **验收映射**: P0-6、P0-7；UI：分栏比例与 pane 滚动

### T6 — 联动与 hex 自动滚动回归

- **完成条件**: 宽屏与窄屏下：结构图选中 → hex 高亮完整区间；hex 点选映射字段 → 结构图高亮；非 hex 发起且区间变化 → hex 滚至首字节行；同区间不强制再滚；hex 内发起不强制拉滚；宽屏双可见时定位不拖垮结构图 pane。`selectByteRange` / `hexLocate` 语义保持。
- **触碰路径**: `apps/web/src/App.tsx`、`apps/web/src/HexDump.tsx`（仅滚动容器/ ref 适配时）
- **验收映射**: P0-8、P0-9

### T7 — 键盘、主题、加载稳定、空/错态

- **完成条件**: 仅键盘可完成选表→blkno→Load→主题；`:focus-visible` 可见；light/dark 切换后顶栏与主区可读；加载/刷新无整页壳层跳动；空表/0 块/错误面板行为不回退。
- **触碰路径**: `apps/web/src/App.tsx`、`apps/web/src/styles.css`、`apps/web/src/theme.ts`（仅当入口接线需要；**禁止**改默认策略语义）
- **验收映射**: P0-5、P0-11、P0-12；状态表（UI）

### T8 — 验证、文档与交接记录

- **完成条件**: 跑通验证命令；手测清单勾选并留证据；`dev-notes.md` 记录结果/偏离/未测项；README 若含侧栏/上下布局描述则改为顶栏+左右（无需改则笔记 N/A）；确认 diff **无** `packages/page-core/**`、`apps/server/**`。
- **触碰路径**: `docs/features/layout-chrome-split/dev-notes.md`、`README.md`（若需）、验证产出
- **验收映射**: P0-10；文档影响

### P1（可选，不阻塞 P0 合入）

| ID | 内容 | 完成条件 |
|---|---|---|
| P1-1 | 宽屏拖拽分隔 | 比例可变且两侧可达；未做则 `dev-notes` 标 N/A |
| P1-2 | 极窄顶栏折行 | 主控与次带可操作/扫读，无不可滚死角 |
| P1-3 | 多表过滤 | select 可定位目标表（滚动或过滤） |

## 依赖与顺序

```text
T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8
         └────────────┘
           T3/T4 可同 PR 内紧耦合；须在 T5 前完成主控唯一入口
```

P1 在 T8 之后或与 T7 穿插，不阻塞 Review/QA 的 P0 路径。

## 触碰路径（汇总）

| 允许 | 禁止 |
|---|---|
| `apps/web/src/App.tsx`、`styles.css`、可选壳层子组件、`StructureMap.tsx`/`HexDump.tsx` 包装级微调、`README.md`、本 feature 文档 | `packages/page-core/**`、`apps/server/**`、改 API 合同、提交 `.env` |

## 验收

见 Spec P0-1..P0-12；UI 落点见 `ui-design.md` 映射表。前序归档 P0 回归不得因本项失败。

### 手测清单（Developer / QA）

1. 已连接：顶栏可选表→blkno→Load；**无**左侧专用栏（P0-1、P0-3）
2. 已加载：顶栏 Refresh 可用且 diff 行为保留（P0-2）
3. 次带必显字段全在；无密码；截断有 title（P0-4）
4. 连接徽标可区分；Theme 切换两主题可读（P0-5）
5. 视口 ≥960：左右并排，图左 hex 右（P0-6）
6. 视口 &lt;960：上下堆叠；主控仍可用（P0-7）
7. 双向高亮宽/窄各一方向（P0-8）
8. 结构图点页尾字段 → hex 自动滚；再点同字段不滚；hex 内点选不滚（P0-9）
9. `pnpm test` 通过；无 page-core/server 业务 diff（P0-10）
10. 键盘走通主路径（P0-11）；加载无整页跳动（P0-12）

### 预期证据

| 验证 | 证据 |
|---|---|
| `pnpm test` | 全部 Pass |
| `pnpm typecheck` / `pnpm --filter web build` | 零错误；build 成功 |
| 手测 | `dev-notes` 逐条结果；建议宽/窄布局截图各至少 1 |
| 可选 `test:integration` | Pass；或记录无 PG 阻塞 |

## Review 门禁与进入 QA

1. Developer 完成 T1–T8，验证写入 `dev-notes.md`。
2. **Review 门禁 `required`**：Reviewer `Approve` 后方可进入 QA（Plan 预授权**不**豁免 Review）。
3. QA 对照 Spec P0 + 本 Plan 手测清单；结论写入 `qa-report.md`。
4. 合并须用户另授；禁止自动 merge/push。

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | `docs/features/layout-chrome-split/dev-notes.md`（必写）；本目录 design/ui/plan 已由 Planner 产出 |
| 用户文档 | `README.md`：若仍描述左侧栏或结构图/hex 仅上下，改为顶栏主控 + 宽屏左右；否则 `dev-notes` 记 N/A |
| 运维文档 | N/A（不改部署/API/env 语义） |

## 无法执行验证时

| 缺口 | 原因 | 风险 | 恢复条件 | 复测范围 |
|---|---|---|---|---|
| 无本机 PG | 无法实库 Load | P0 布局手测可用夹具/已有页；连接路径弱 | 恢复 PG 16.x + pageinspect | 手测清单 1–8、可选 integration |
| 无图形浏览器 | 无法断点手测 | P0-6..P0-9 无法证伪 | 可用 Chrome/Safari DevTools | 手测 5–8 |

**禁止**静默跳过；须写入 `dev-notes`。

## 交接顺序

1. **Planner**（本文件）→ Manager：Plan 预授权已登记 → 状态可 `planned` → `developing`，调度 Developer。  
2. **Developer**：T1–T8 → `dev-notes` → 交 Review（**不要**自调 QA）。  
3. **Reviewer**：Approve / 变更请求。  
4. **QA**：独立验收 → `qa-report.md`。  
5. **Manager**：用户授权后合并/`done`。

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-07-26 | 初稿：Design + UI + Plan；任务 T1–T8；L2+手测；Review required |

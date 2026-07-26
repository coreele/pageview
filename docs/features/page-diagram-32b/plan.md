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
- 最低验证层: **L2 + 定向 L3/手测** — 字段派生/行切分/命中用 Vitest（L2）；typecheck + build；结构图↔hex↔折叠以浏览器手测（有 PG 时走真实页；无 PG 时用已有夹具/前端已加载页）。不要求新 server 集成测（API N/A）
- 验证命令:

```bash
# L2 — page-core（含本项新增 derive/resolve 单测）
pnpm --filter page-core test

# L2 — 类型与构建
pnpm -r typecheck
pnpm -r build

# 可选 L3 — 实库冒烟（环境有 PG 时；本项不改 server，用于回归取页）
pnpm test:integration

# UI 手测（dev）
pnpm dev:server   # 若需实库
pnpm dev:web
# 清单见「验收」与 ui-design.md
```

## 适用工程规范

- [文档工程](../../standards/documentation.md)
- [Git 协作](../../standards/git.md)（源分支 `page-diagram-32b` → `main`）
- [质量与验证](../../standards/quality.md)
- [安全](../../standards/security.md)（本项无新认证/输入面；禁止提交 `.env`/凭据）
- [UI/UX](../../standards/ui.md)

## 目标摘要

将页结构主视图改为 **32B 行**结构图（字段边界可见、点击高亮、free 可折叠），hex 改为 **32B/行**并与结构图共用权威 `ByteRange` 双向联动。依据已确认 Spec P0-1..P0-9、P1-1..P1-3 与 Q1–Q6；技术选型为 DOM/CSS Grid + `deriveStructureFields`（见 `design.md`）；体验见 `ui-design.md`。不改 API/解析语义；保留基线 flag/列值/HOT/ctid/diff/主题/元信息。

完成定义：P0 全部可演示或可测通过；P1-1/P1-2 覆盖；P1-3 默认 N/A（除非明确纳入）；`dev-notes.md` 记录偏离；Review `Approve` 后交 QA。

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

## 依赖与顺序

```text
T1 → T2 → T3 ─┐
         └→ T4 → T5 → T6 → T7 → T8 → T9
T3 ∥ T4（T3 可不依赖字段派生先改行宽；T6 起必须字段级 resolve）
```

波次：分支 → core 派生单测 → hex 32B ∥ 结构图 → free 折叠 → 联动 → P1/回归 → 文档。

## 触碰路径

| 区域 | 路径 |
|---|---|
| Core（推荐） | `packages/page-core/src/**`、`packages/page-core/tests/**` |
| Web | `apps/web/src/StructureMap.tsx`、`HexDump.tsx`、`App.tsx`、`diff.ts`、样式入口 |
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
| P1-2 | T4、T6、T7 | 手测：跨行同步高亮 |
| P1-3 | T8 | N/A 或可选实现说明 |

**UI/UX：** 对照 `ui-design.md`（布局、FreeSpaceBand、焦点、token）；非 `N/A`。

**基线回归：** T8 清单；不得删除既有 P0 能力。

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | `docs/features/page-diagram-32b/dev-notes.md`（必填）；`packages/page-core` 若导出新 API 可在包内简短注释 |
| 用户文档 | 若根 `README.md` 仍描述 16 字节 hex 或列表式结构图 → 更新为 32B 结构图说明；否则 N/A 并在 dev-notes 说明 |
| 运维文档 | N/A（无部署/API/运维变更） |

## Review 与进入 QA

1. Developer 完成 T1–T9，验证命令通过并写入 `dev-notes.md`。
2. **Review 门禁 required**：调度 Reviewer；须 `Approve` 后方可进入 QA（可先写 `review.md`，提交时机见 `git.md`）。
3. QA 依据 Spec + Plan + `ui-design.md` 独立验收 → `qa-report.md`。
4. 交接顺序：**Implement → Review（Approve）→ QA →（用户授权）done/合并**。

## 无法执行验证时

| 情形 | 原因 | 风险 | 恢复条件 | 复测范围 |
|---|---|---|---|---|
| 无本机 PG | 无法实库加载页 | P0 实页路径未证 | 启动 PG 16.x + pageinspect 或使用已捕获夹具在 UI 加载 | P0-1..P0-8 手测 |
| 无图形环境 | 无法手测结构图 | UI 验收缺口 | 本地浏览器或提供录屏 | ui-design 清单 |

**禁止**静默跳过；记入 `dev-notes` / 工作项阻塞字段。

## 安全

本项不新增连接或密钥面。禁止提交 `.env`、真实连接串。Review 安全项：无新触发域则记「无增量安全影响」。

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-07-26 | Planner 初稿：design + ui-design + plan；待用户确认 Plan |

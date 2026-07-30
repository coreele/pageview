# Plan: wal-viewer

## 元信息

- 工作项标识: wal-viewer（sub-feature-id = wal-viewer，未拆分）
- 依据 Spec: docs/features/wal-viewer/spec.md
- 依据 Design: docs/features/wal-viewer/design.md
- 依据 UI Design: docs/features/wal-viewer/ui-design.md（`UI 表面: gui`）
- 路径等级: full
- Review 门禁: **required**（进入 QA 前须 Reviewer `Approve`）
- 源分支: `wal-viewer` → 目标: `main`（**禁止在 main 直接实施**）
- 最低验证层: **L3** — Spec 成功标准依赖真实 `pg_walinspect`（P0-2/6/7 等）；`wal-core` 阈值/映射单测为 L2 基线；UI 对照 `ui-design.md` 手测补证。无 PG15+/扩展时仅宣称 L2，实库 P0 记阻塞与恢复条件
- 验证命令:

```bash
# L2 — wal-core（无 PG 亦可）
pnpm --filter wal-core test
pnpm --filter wal-core typecheck

# L2 — 回归既有 page-core / server 单测 + 全仓类型
pnpm --filter page-core test
pnpm --filter server test
pnpm -r typecheck

# L3 — 实库（需 PostgreSQL ≥15 + 已 CREATE EXTENSION pg_walinspect；Page 回归另需 pageinspect）
# 建议：扩展 server 集成冒烟或手工脚本
#   连接 → GET /api/wal/current-lsn → GET /api/wal/records?startLsn&endLsn
#   断言：结构化字段齐全；超 R1/R2/R3 → WAL_BATCH_TOO_LARGE 且无部分 records
#   缺扩展 / PG<15 → 明确错误；进程内无 CREATE EXTENSION
# UI 手测：chrome 模式切换、列表一行一条、选中、FPI 折叠/展开、hex 占位、Page hex 回归、错误可读
```

## 适用工程规范

- [文档工程](../../standards/documentation.md)
- [Git 协作](../../standards/git.md)
- [质量与验证](../../standards/quality.md)
- [安全](../../standards/security.md)
- [UI/UX](../../standards/ui.md)

## 目标摘要

按已确认 Spec 与 Design，在源分支 `wal-viewer` 交付 WAL 模式：新建 `packages/wal-core`；server 按模式校验扩展并提供 `/api/wal/records` 与 current-lsn；硬阈值 R1≤2000 / R2≤2MiB / R3≤16MiB 超限硬错误禁截断；web chrome 切换 + 独立 WAL 列表 UI（FPI 默认折叠、hex 占位）；README 中英说明依赖。Page 路径保持 `get_raw_page` 可用。

完成定义：P0 全部可演示或可测；P1 尽量覆盖；`dev-notes.md` 记偏离；Review Approve 后方可交 QA。

**UI/UX:** 见 `ui-design.md`（非 N/A）。

## 任务拆解

### T1 — `packages/wal-core`：类型、映射、批次阈值

- 触碰: `packages/wal-core/**`、`pnpm-workspace.yaml`、根/`package.json` 脚本（纳入 filter）
- 完成条件:
  - 导出 Spec 字段语义类型（start/end/prev LSN、xid、resource_manager、record_type、record_length、main_data_length、fpi_length、description、block_ref）
  - 纯函数：SQL 行 → DTO；`hasFpi`（`fpi_length > 0`）；常量 **R1=2000、R2=2MiB、R3=16MiB** 与校验（失败可区分原因）
  - Vitest：映射样例；R1/R2/R3 边界；**禁止**截断辅助 API
- 验收映射: P0-2（字段形态）、P0-8（FPI 判定）、批次裁决

### T2 — Server：connect 门禁迁移 + Page 路由校验

- 触碰: `apps/server/src/session.ts`、`apps/server/src/app.ts`、相关测试
- 完成条件:
  - Connect / env 自动连：**不**因缺 `pageinspect` 或 `pg_walinspect` 失败；仍写 `serverVersion`
  - `/api/tables`、schema、pages：缺 `pageinspect` → 明确错误 + 自行启用指引；**无** `CREATE EXTENSION`
  - 既有 Page 成功路径（有扩展时）语义不变
- 验收映射: P0-10、P1-3、connect 裁决

### T3 — Server：WAL API

- 触碰: `apps/server/src/**`（建议 `wal.ts` 或等价）、测试/集成冒烟
- 完成条件:
  - `GET /api/wal/current-lsn` → 当前 WAL LSN；门禁：已连接 + PG≥15 + `pg_walinspect`
  - `GET /api/wal/records?startLsn&endLsn` → `pg_get_wal_records_info`；经 `wal-core` 映射与 R1/R2/R3；超限 → `WAL_BATCH_TOO_LARGE`（或等价）且 **body 无部分 records**
  - PG&lt;15 / 缺扩展 / 未连接 / 坏 LSN / 权限 → `{ code, message, nextStep }`；空区间 → `records: []` 成功
  - **禁止**主载荷原始字节/hex；**禁止** `CREATE EXTENSION`
- 验收映射: P0-2、P0-6、P0-7、P0-11、P1-1、P1-2（后端）

### T4 — Web：chrome 模式切换 + 会话保留

- 触碰: `apps/web/src/App.tsx`（或拆分壳组件）、样式
- 完成条件:
  - chrome **Page | WAL**；主工作区整树切换；禁止 WAL 塞进 StructureMap
  - 模式切换不要求重输密码；主题控件沿用（不新增主题合同）
- 验收映射: P0-1、P0-12、P1-3；ui-design 模式切换

### T5 — Web：WAL 查询、列表、选中、FPI、hex 占位

- 触碰: `apps/web/src/api.ts`、新建 WAL 视图组件（如 `WalView.tsx` 等）、样式
- 完成条件:
  - 必填 start/end；「填入当前 LSN」调 API 写控件，**不**自动 Load；进入 WAL **不**盲拉
  - 状态：`wal_idle` / `loading` / `loaded` / `selected` / `error` / 空批次呈现对齐 ui-design
  - 一行一条宽元数据列；点击/键盘选中；换批次清空选中
  - FPI 默认折叠；展开仅元信息
  - hex 区仅占位说明；无伪造 dump
  - 错误含原因+下一步（含批次过大）
- 验收映射: P0-3..P0-5、P0-8、P0-9、P0-11、P1-1、P1-2；ui-design 全状态

### T6 — Page 回归与文档

- 触碰: `README.md`、`README.zh-CN.md`（若存在）、必要开发注释；手工/集成回归
- 完成条件:
  - Page 模式加载页 + hex 仍基于 `get_raw_page`（P0-10）
  - README（中英）说明：WAL 模式、PG15+、`pg_walinspect`、自行 `CREATE EXTENSION`、v1 无原始 hex、批次硬上限（R1/R2/R3 摘要）
  - `docs/features/wal-viewer/dev-notes.md`：验证证据、偏离、无 PG 时阻塞
- 验收映射: P0-10、P0-12、文档影响；Spec 文档条款

## 依赖与顺序

```text
T1 → T3
T2 → T3（Page 门禁与 WAL 门禁可并行于 T1 之后，但 T3 合并前 T2 宜先完成）
T1 + T2 + T3 → T4 → T5 → T6
```

建议执行：T1 ∥ T2 → T3 → T4 → T5 → T6。

## 触碰路径

| 区域 | 路径 |
|---|---|
| 新包 | `packages/wal-core/**` |
| Server | `apps/server/src/app.ts`、`session.ts`、新增 WAL 模块、`apps/server/tests/**`、集成冒烟 |
| Web | `apps/web/src/App.tsx`、`api.ts`、新建 WAL UI 文件、既有 theme/css（复用） |
| 工作区 | `pnpm-workspace.yaml`、根 scripts |
| 用户文档 | `README.md`、`README.zh-CN.md` |
| 开发记录 | `docs/features/wal-viewer/dev-notes.md` |

**不触碰:** `docs/manager/**`；`packages/page-core` 业务逻辑（除非意外回归修复）；Spec/本 Plan 确认前改范围。

## 验收

对照 Spec **P0-1 … P0-12** 与 **P1-1 … P1-3**；UI 证据对照 `ui-design.md`。

| 层 | 预期证据 |
|---|---|
| L2 wal-core | Vitest 全绿；阈值边界断言无「返回部分数组」API |
| L2 回归 | page-core / server 既有测试通过；`pnpm -r typecheck` 通过 |
| L3 API | 实库：records 来自 walinspect 字段；超限硬错误；缺扩展/PG&lt;15 失败文案；无 CREATE EXTENSION |
| L3 UI | 模式切换；列表/选中/FPI/hex 占位；空态；Page hex 仍可用；错误可读 |
| 文档 | README 含 WAL/PG15+/扩展/无 hex/上限说明 |

### 无法验证时

| 缺口 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| L3 WAL | 无 PG≥15 或无 `pg_walinspect` | P0-2/6/7 等未实锤 | 提供本机/容器 PG15+ 并启用扩展后补跑 |
| L3 Page 回归 | 无 `pageinspect` | P0-10 弱 | 启用 pageinspect 后补测 |
| UI 手测 | 无浏览器联调 | 状态/键盘遗漏 | `pnpm dev:server` + `dev:web` 联调清单勾完 |

禁止静默跳过：记入 `dev-notes.md` 与工作项阻塞字段（由 Manager）。

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | `docs/features/wal-viewer/dev-notes.md`（验证与偏离）；代码侧 API 行为以实现与 README 为准 |
| 用户文档 | `README.md`、`README.zh-CN.md`（WAL 模式与依赖） |
| 运维文档 | N/A — 本地单人工具，无新增部署/监控合同；依赖说明归用户 README |

## Review 门禁与进入 QA

1. Developer 在 `wal-viewer` 完成 T1–T6，验证写入 `dev-notes.md`。
2. **Review 门禁 required** → 调度 Reviewer；须 **Approve**（对照 Spec + Design + ui-design + 本 Plan）。
3. Approve 后 Manager 方可进入 QA；QA 依据 Spec P0/P1 与本验证计划出 `qa-report.md`。
4. Planner **不**将状态标为 `planned`；须用户确认本 Plan 并由 Manager 持久化后再调度 Developer。

## 交接顺序

1. **用户确认 Plan** → Manager 持久化 → 状态 `planned`
2. **Developer** 检出/使用源分支 `wal-viewer` 实施
3. **Reviewer** Approve
4. **QA** 独立验收
5. 用户授权合并后走 git 规范合入 `main`

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-07-30 | 初稿：Design/UI 对齐；R1/R2/R3 硬阈值；任务 T1–T6 |

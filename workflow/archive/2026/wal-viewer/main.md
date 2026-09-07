# 工作项: wal-viewer

描述: 在现有 pg-page-viewer（heap page 可视化）上新增 WAL 模式：顶部 chrome 提供 Page / WAL 模式切换；WAL 与 Page 的 UI/数据路径分开。WAL 主视图为一批 record 列表（一行一条），展示更宽的元数据行（LSN、resource manager、record type、长度等）；v1 不做原始字节 hex；含 FPI 的 record 默认折叠。数据来自 `pg_walinspect` 结构化信息（PG15+）。
目标分支: main
源分支: wal-viewer
基线提交: 97b4f0570c3e41821976ff211ce2feb47570323b
文档影响: 已归档至 `workflow/archive/2026/wal-viewer/`（原 `workflow/archive/2026/wal-viewer/`：spec、design、ui-design、plan、dev-notes、review、qa-report）；README / README.zh-CN 已说明 WAL 模式与 PG15+/`pg_walinspect` 依赖。

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/archive/2026/wal-viewer/`。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| full | required | approved | required | required |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| archived |  |  |  |  |

## 进度笔记

- 2026-09-07 工作流迁移：机制改为 `workflow/WORKFLOW.md` + `workflow/agents/`；本记录由 `manager.md` 转为 `main.md`，产物平铺到 `workflow/archive/2026/wal-viewer/`。旧状态机名称（awaiting-*-approval 等）按新枚举对齐。
- 历史字段 UI 表面: gui（新模板已取消该列）。

## 产品共识（用户口头确认 · 写入供 Analyst Spec 使用；不得擅自扩大范围）

1. **模式**：顶部 chrome 增加 Page / WAL 模式切换；Page 与 WAL UI/数据路径分开。
2. **WAL 主视图**：一批 record 列表（**一行一条 record**），更宽的元数据行（LSN、resource manager、record type、长度等）；**不要硬套** page 的 32B/行 grid（那是 page 结构图↔hex 对齐用的）。
3. **交互**：点击一条 record 可选中；v1 **hex dump 暂不可用**（占位或说明即可）。数据来自 `pg_walinspect` 结构化信息（PG15+），不是反向拼 hex。
4. **FPI**：若 record 含 FPI，**默认折叠**（只显示长度/标记）；避免未压缩 8KB 撑爆列表。展开也仅元信息，不渲染 8KB 内容。
5. **Hex**：Page 侧仍是 `get_raw_page` 原始字节；WAL v1 不做原始字节 hex。将来 PG17+ `pg_get_wal_block_info` 或其它路径再增强，**不在本工作项 v1 范围**。
6. **定位**：同一 monorepo；可复用 `apps/server` / `apps/web`；解析可新建 `packages/wal-core` 或等价方案（具体边界留给 Design/Plan，Manager 只记需求方向）。
7. **依赖**：WAL 路径最低 **PostgreSQL 15+** + `pg_walinspect`；扩展由用户自行 `CREATE EXTENSION`，应用不代建（与现有 pageinspect 约定一致）。

## Spec 用户确认（2026-07-30）

结论: 批准整份 Spec（`workflow/archive/2026/wal-viewer/spec.md`）。`Spec 用户确认` → `approved`。

开放问题裁决:
1. **LSN 预填**：**采纳默认** — 必填 start/end LSN；可一键填入当前 WAL LSN；进入 WAL 模式时**不**自动盲拉大范围。
2. **批次过大**：**硬错误** — 结果过大时明确失败；**不要**截断或部分结果。阈值由 Design/Plan 选定。
3. **connect 扩展校验**：**采纳默认** — 不强制 `pageinspect` 与 `pg_walinspect` 两者皆有；按模式分别校验（Page → pageinspect；WAL → pg_walinspect + PG15+）。

## Plan 用户确认（2026-07-30）

结论: 批准 Plan（`workflow/archive/2026/wal-viewer/plan.md` 全文）。用户回复「ok」。状态 `awaiting-plan-approval` → `planned` →（调度 Developer）`developing`。

确认范围（全部采纳）:
1. 硬阈值 **R1≤2000 / R2≤2MiB / R3≤16MiB**（禁截断/部分结果）
2. **connect 门禁迁移**（按模式校验扩展；不强制两者皆有）
3. 任务 **T1–T6**
4. 源分支 **`wal-viewer`** → 目标 **`main`**（禁止在 main 直接实施）

## 产品变更：Fill current LSN → recent window（2026-07-30）

结论: 用户回复「ok」，批准未合并前修订「填入当前 LSN」行为。合并授权**尚未**给予。状态 `qa`（Pass）→ `speccing`（修订 Spec/Design/Plan 后实施并复审/回归）。

新行为（合同增量，不得擅自扩大）:
1. **end LSN** = `pg_current_wal_lsn()`（current tip）
2. **start LSN** = 基于 tip 向前推算，使区间大约包含 **最近 ~20 条** WAL record（不足 20 则有多少给多少）
3. Fill **仍不自动 Load**；填入可用窗口后，用户点 Load 应看到最新约 20 条，**不是** tip 点查 Empty batch
4. 建议服务端 recent-window 能力（如 `GET /api/wal/recent-window?limit=20`，或扩展 current-lsn 返回 `{ startLsn, endLsn, count }`）；启发式扩窗；若结果 &gt;20 则取尾 20 并把 start 回填为该批最早 record 的 start_lsn；遵守 R1/R2/R3，禁截断假成功；已删段可读错误

既有裁决保留：必填 start/end、不盲拉、批次硬错误、按模式扩展校验。P1-2 及可见行为须随 Spec 修订；Design/Plan 轻改后实施。

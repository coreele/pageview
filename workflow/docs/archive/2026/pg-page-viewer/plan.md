# Plan: pg-page-viewer

## 元信息

- 工作项标识: pg-page-viewer
- 依据 Spec: workflow/docs/features/pg-page-viewer/spec.md
- 依据 Design: workflow/docs/features/pg-page-viewer/design.md
- 依据 UI Design: workflow/docs/features/pg-page-viewer/ui-design.md（`UI 表面: gui`）
- 路径等级: full
- Review 门禁: required（进入 QA 前须 Reviewer `Approve`）
- 最低验证层: L3 — Spec 成功标准依赖真实 `get_raw_page()`（P0-1）；`page-core` 夹具单测为 L2 基线；主题/元信息/键盘/状态以 UI 手测或组件测补证（P0-13..P0-20）。无 PG 时仅宣称 L2，实库 P0 记阻塞
- 验证命令:

```bash
# L2 — page-core（无 PG 亦可）
pnpm --filter page-core test

# L2/L3 — 类型与构建
pnpm -r typecheck
pnpm -r build

# L3 — 实库冒烟（需 PG 16.11 + pageinspect + 可调用 get_raw_page 的角色）
pnpm --filter server test:integration
# 或文档化的手动脚本：连接 → tables → schema → pages/:blkno → 前端加载一页
# UI 手测清单：主题切换、默认主题、Context strip 必显、键盘核心路径、各状态呈现（对照 ui-design.md）
```

## 适用工程规范

- [文档工程](../../standards/documentation.md)（若尚未落库，实施期按仓库既有文档约定补齐）
- [质量与验证](../../standards/quality.md)（同上）
- [安全](../../standards/security.md)（同上）
- [UI/UX](../../standards/ui.md)（GUI 底线；细节以 `ui-design.md` 为准）
- Git 协作：当前工作区 **非 Git**；规范 N/A，直至 Manager/用户 init 仓库

## 目标摘要

按 Spec 交付本地 heap 页可视化工具：Fastify 薄代理提供连接/表/schema/raw 页（含完整 PG 版本串）；`page-core` 在浏览器解析；web 完成结构图（含空洞压缩）、五项交互、Context strip 元信息、light/dark 主题与 GUI 状态/键盘底线（见 `ui-design.md`）。Design 定稿三包 monorepo、解析落点、主题仅前端、元信息多源拼装。

完成定义：P0（含 P0-13..P0-20）全部可演示或可测通过；P1（含可选 P1-4）尽量覆盖；`dev-notes.md` 记录偏离；Review `Approve` 后方可交 QA。

## 任务拆解

### T1 — Monorepo 脚手架

- 触碰: `package.json`、`pnpm-workspace.yaml`、`tsconfig*.json`、`apps/server`、`apps/web`、`packages/page-core`、根 `README.md`（骨架）、`.env.example`（仅键名）
- 完成条件: `pnpm install` 成功；三包可 `typecheck`；server 默认绑定 `127.0.0.1`；workspace 能链接 `page-core`

### T2 — `page-core`：页解析与区间

- 触碰: `packages/page-core/src/**`、`packages/page-core/tests/**`
- 完成条件: 解析 page header、ItemId（含 LP 状态）、tuple header 字段；输出真实字节区间；非 8192 / 非标准 pagesize → 明确错误；导出可供元信息使用的派生统计（页大小、`pd_lower`/`pd_upper`、free 字节、ItemId 总数与各 LP 计数、NORMAL→tuple 计数）；Vitest 覆盖至少 1 份实页夹具的 header/ItemId/free 边界与计数一致性

### T3 — `page-core`：列解码与 flag 元数据

- 触碰: `packages/page-core/src/**`、夹具 schema JSON
- 完成条件: Spec 所列常见类型可解码；未知类型 → 该列 hex 且不失败整页；TOAST 指针 → TOASTed，不读外部页；`attisdropped` 占位；处理 `attalign` 与 null bitmap；导出 infomask/ItemId flag 位名称供 UI

### T4 — 真实页夹具采集策略

- 触碰: `packages/page-core/fixtures/**`、`scripts/capture-fixtures.*`（或 server 下一次性脚本）
- 完成条件: 文档化「对 PG 16.11 调用 `get_raw_page` → 写入 `.bin`/base64 + schema」流程；仓库内至少提交：稀疏页（供空洞压缩/布局）、含常见类型、含 HOT 或 REDIRECT（若可得）、跨块 ctid（若可得）；脚本 **禁止** `CREATE EXTENSION`

### T5 — Server：连接与会话

- 触碰: `apps/server/src/**`
- 完成条件: `POST /api/connect`（UI 凭据覆盖会话）；启动时 env 完整则自动建连；成功响应（或等价 `GET /api/session`）含非机密 host/port/database/user **与完整 `serverVersion`**；`pageinspect` 缺失 → 指引错误且不进入可浏览；禁止 `CREATE EXTENSION`；凭据仅内存；禁止回传密码；可选 `{ "source": "env" }` 重连

### T6 — Server：tables / schema / pages

- 触碰: `apps/server/src/**`
- 完成条件: `GET /api/tables` 仅 `relkind=r` 用户表 + 块数；`GET /api/tables/:oid/schema` 列元数据齐全；`GET /api/tables/:oid/pages/:blkno` 返回完整页 base64（或等价无损），**不含**解析树主载荷；越界/非表/权限错误可区分；集成测或脚本证明字节来自 `get_raw_page`

### T7 — Web：壳层、主题与连接导航

- 触碰: `apps/web/src/**`
- 完成条件:
  - 按 `ui-design.md` 落地 chrome + Navigator + 主区壳；CSS 变量两套 token；主题默认 `prefers-color-scheme`（不可读 → light）；toggle 可切换 light/dark，主视图/表单/错误均可读（P0-13/P0-14）
  - UI 表单可连接；env 已连时无需再录入即可浏览（P0-12）；选表/blkno 拉 schema+page → `page-core` 解析 → `page_loaded`
  - 错误态含原因 + 可执行下一步（P0-19）；前端不持久化密码（P0-10）
  - 核心路径控件 Tab/`focus-visible` 可达（连接→选表→blkno→Load→主题）（P0-18）
  - P1-4 可选：`localStorage['pg-page-viewer.theme']`；未做则在 `dev-notes` 标明

### T8 — Web：Context strip 元信息

- 触碰: `apps/web/src/**`
- 完成条件: 独立矮分区 Context strip；`connected`/`page_loaded` 按 Spec 必显清单展示（无密码）；页统计仅来自同一 `parsePage` 结果（P0-15）；默认不淹没主结构图（P0-16）；各应用状态有可区分呈现（P0-17）；加载/刷新仅局部指示、壳层稳定（P0-20）

### T9 — Web：结构图 + 空洞压缩 + hex 联动

- 触碰: `apps/web/src/**`
- 完成条件: 展示 header/ItemId/free/tuples 与增长方向；稀疏页 free space **不按真实比例撑满视口**但仍标边界与真实跨度（P0-11）；结构图 ↔ hex 双向高亮真实字节区间（P0-8）；布局坐标与 byte range 分离；两主题下结构图对比可读（P0-13）

### T10 — Web：五项交互余下部分

- 触碰: `apps/web/src/**`
- 完成条件:
  - Flag/infomask hover（或聚焦）逐位解读（P0-3）
  - 列值展示（P0-4）；dropped 占位（P1-3）
  - 同页 HOT/REDIRECT；跨块标注目标块+偏移；**仅点击/键盘激活后**请求目标页，无预取（P0-5/P0-6）
  - 刷新同页保留快照并高亮变更（P0-7）
  - 空表/空页可用说明（P1-1）；越界明确错误（P1-2）

### T11 — 实库冒烟、UI 手测与文档

- 触碰: 根 `README.md`、`workflow/docs/features/pg-page-viewer/dev-notes.md`（实施中由 Developer 维护）
- 完成条件: 对真实 PG 走通 P0-1/P0-2；手测或记录 P0-13..P0-20（含 light+dark 主视图证据、键盘路径、strip 字段）；README 含启动、env、pageinspect/特权说明、仅本机可信、主题说明；密码未进仓库配置

## 依赖与顺序

```text
T1 → T2 → T3
T1 → T5 → T6
T4 可与 T2/T3 并行（先有采集脚本，夹具可迭代补全）
T2+T3+T6 → T7 → T8 → T9 → T10 → T11
```

建议实施波次：脚手架 → core（含夹具）与 server 并行 → web 壳/主题/连接 → 元信息 strip → 可视化/交互 → 实库与 UI 手测/文档。

## 触碰路径

| 任务 | 路径 |
|---|---|
| T1 | 根 workspace、`apps/server`、`apps/web`、`packages/page-core`、`.env.example` |
| T2–T4 | `packages/page-core/**`、`scripts/**` |
| T5–T6 | `apps/server/**` |
| T7–T10 | `apps/web/**`（布局/状态对照 `ui-design.md`） |
| T11 | `README.md`、`workflow/docs/features/pg-page-viewer/dev-notes.md` |

禁止修改：`spec.md`；`design.md` / `ui-design.md`（除非 Manager 回退 Design）；`workflow/docs/manager/**`（非本实施角色）。

## 验收

> 权威条目见 Spec P0/P1；布局/状态/键盘证据对照 `ui-design.md`。下表为任务映射。

| 验收 | 主要任务 | 验证层 | 预期证据 |
|---|---|---|---|
| P0-1 真实页浏览 | T6, T9, T11 | L3 | 对实库 `get_raw_page` 加载后 UI 含 header/ItemId/free/tuple；页 API 响应为 raw |
| P0-2 扩展缺失 | T5, T11 | L3 | 无扩展库连接失败文案含启用指引；不进入浏览态 |
| P0-3 Flag | T3, T10 | L2+L3 | Vitest 位定义；UI hover/聚焦区分置位 |
| P0-4 列解码 | T3, T10 | L2+L3 | 夹具断言常见类型；未知 hex；TOAST 标记 |
| P0-5 HOT/REDIRECT/跨块标注 | T2, T10 | L2+L3 | 夹具或实页可见同页链与跨块标注 |
| P0-6 点击加载无预取 | T10 | L3 | 网络面板/日志：激活前无目标 blk 请求；之后有 |
| P0-7 刷新对比 | T10 | L3 | 外部 DML 后刷新仅高亮变更 |
| P0-8 Hex 联动 | T9 | L2/L3 | 选中结构与 hex 区间一致 |
| P0-9 非 8KB | T2, T7 | L2 | core 对错误长度夹具抛错；UI 不渲染结构图 |
| P0-10 机密不落盘 | T5, T7, T11 | L3/检查 | 无密码写入配置/前端 storage；内存会话 |
| P0-11 空洞压缩 | T9 | L3 | 稀疏页：空白压缩且边界可辨 |
| P0-12 env 连接 | T5, T7 | L3 | 仅 env 启动即可列表/取页 |
| P0-13 深色切换可读 | T7, T9, T11 | L3 | light↔dark 后主视图/strip/控件可读；非仅外壳换肤 |
| P0-14 默认主题 | T7, T11 | L3 | 跟随系统偏好；不可读偏好时 light |
| P0-15 元信息必显 | T2, T5, T8, T11 | L3 | strip 字段齐全且与连接/页一致；无密码 |
| P0-16 元信息不淹没 | T8, T11 | L3 | 结构图仍为主内容；strip 独立矮分区 |
| P0-17 状态完整 | T7, T8, T11 | L3 | 未连接/加载/空/成功/错误可区分 |
| P0-18 键盘可达 | T7, T11 | L3 | 无指针完成连接→选表→blkno→Load→主题；焦点可见 |
| P0-19 错误可读 | T5, T7, T11 | L3 | 失败反馈含原因+下一步 |
| P0-20 布局稳定 | T8, T9, T11 | L3 | 加载/刷新无整页壳层跳动 |
| P1-1..3 | T6–T10 | L2/L3 | 空页/越界/dropped 列符合 Spec |
| P1-4 主题记忆 | T7 | L3/可选 | 实现则刷新后恢复手动主题；否则 `dev-notes` 标明未做 |

### 夹具策略（可复现）

1. PG 16.11 启用 `pageinspect`（人工，应用不代建）。
2. 准备用户表场景 → `get_raw_page` 导出字节 + 当时 schema。
3. 落入 `packages/page-core/fixtures/`，Vitest 只读夹具（L2）。
4. Server integration：同一连接参数现场再调 `get_raw_page`，断言长度 8192 且与抽样夹具一致或可解析（L3）。

### 无法执行验证时

| 未验证项 | 原因 | 风险 | 恢复条件 | 复测范围 |
|---|---|---|---|---|
| P0-1/2/6/7/10/12 等 L3 | 无 PG 16.11 或无 `get_raw_page` 权限 | 集成回归未知 | 提供可达实例与角色；装好扩展 | T5–T11 实库用例 |
| P0-13..P0-20 UI | 无浏览器手测环境 | GUI 回归未知 | 提供可开 `apps/web` 的环境 | T7–T11 UI 清单 |
| 含 HOT/跨块夹具 | 难构造 | P0-5/6 仅手测 | 用受控 UPDATE 生成链后重采夹具 | T4, T10 |

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | `workflow/docs/features/pg-page-viewer/dev-notes.md`（实施记录）；本 `plan.md`/`design.md`/`ui-design.md` 已存在 |
| 用户文档 | 根 `README.md`：安装、启动、连接（UI/env）、pageinspect 与权限、主题切换、仅 heap 用户表、非公网声明 |
| 运维文档 | N/A（本地单机工具，无独立部署/运维手册要求；监听与环境变量写入 README 即可） |

## Review 与交接顺序

1. **Plan 确认（本步）**：用户确认本 Plan → Manager 持久化确认并将状态置 `planned` → 方可调度 Developer。（Planner 不改状态、不直接交开发。）
2. **实施**：Developer 按 T1–T11 执行；维持 Design 边界；对照 `ui-design.md`；更新 `dev-notes.md`。
3. **Review**：路径 `full`，Review 门禁 `required`。实现完成后调度 Reviewer；**进入 QA 前必须 `Approve`**（对照 Spec + `ui.md` + `ui-design.md`）。
4. **QA**：对照 Spec P0/P1 与上表证据；产出 `qa-report.md`。
5. Git：当前非 Git 工作区；合并/PR N/A，直至仓库初始化并由 Manager 补分支信息。

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-07-26 | 初稿：三包架构下的实施任务、L2 夹具 + L3 实库验证、Review/QA 交接 |
| 2026-07-26 | 增量：引用 `ui-design.md`；T5 版本串；T7 主题/键盘；新增 T8 元信息；原 T8–T10 顺延为 T9–T11；验收映射 P0-13..P0-20、P1-4 |

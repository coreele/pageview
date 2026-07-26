# Dev Notes: pg-page-viewer

## 实现说明

- 工作项: `pg-page-viewer`（未拆分）；源分支 `pg-page-viewer`（自 `main` @ `2b83f71` 创建）
- Plan T1–T11 已在源分支落地：pnpm 三包、`page-core` 夹具 Vitest、Fastify 薄代理、React UI（chrome / Context strip / Navigator / 结构图+hex / 五项交互）
- **P1-4 已做**：`localStorage['pg-page-viewer.theme']` 记忆手动主题；禁止存密码
- 偏离:
  - T4 仓库夹具为 `buildSparsePage` **合成页**（含 REDIRECT/HOT/跨块 ctid 场景元数据），非 PG 16.11 `get_raw_page` 实采；采集脚本与流程已文档化，实库可替换
  - Plan 定稿时「非 Git」过时：本实施遵守 `git.md` 分波次 Conventional Commits；**未改** `plan.md`
- 安全: 密码仅 server 内存；`.env.example` 仅键名；默认绑定 `127.0.0.1`；禁止 `CREATE EXTENSION`

## 验证证据

| 命令 | 结果 |
|---|---|
| `pnpm --filter page-core test` | 通过（10 tests） |
| `pnpm -r typecheck` | 通过 |
| `pnpm -r build` | 通过 |
| `pnpm --filter server test:integration` | **未通过/阻塞** exit 2：无 `.env` / `DATABASE_URL`/`PG*`；本机仅见 `psql` 16.0，无已配置可调用 `get_raw_page` 的会话 |

**达到验证层: L2**（未达 Plan 声明的最低 L3）

## 未验证项（阻塞）

| 未验证项 | 原因 | 风险 | 恢复条件 | 复测范围 |
|---|---|---|---|---|
| P0-1/2/6/7/10/12 等 L3 实库 | 无配置好的 PG 16.11 + pageinspect + `get_raw_page` 角色 | 集成回归未知 | 提供可达实例与角色；写本地 `.env`（勿提交）；`CREATE EXTENSION pageinspect` 后跑 `pnpm test:integration` 与 UI 连接冒烟 | T5–T11 实库 |
| P0-13..P0-20 UI 手测 | Developer 环境未做浏览器手测/截图 | GUI 回归未知 | `pnpm dev:server` + `pnpm dev:web`，对照 `ui-design.md` 清单 | T7–T11 UI |
| 实页 HOT/跨块夹具 | 合成夹具覆盖布局；实库链未采 | P0-5/6 仅能部分靠合成+手测 | 受控 UPDATE 后 `pnpm capture-fixtures` | T4, T10 |

## 文档影响

- `README.md`：安装、启动、env、pageinspect/特权、主题、本机可信声明
- `packages/page-core/fixtures/README.md`：夹具采集
- 本文件

## 建议复测（Reviewer / QA）

1. L2 回归：`pnpm --filter page-core test`、`pnpm -r typecheck`、`pnpm -r build`
2. L3：实库 connect → tables → schema → pages → 前端 Load；缺扩展错误含指引且不进浏览
3. UI：light↔dark 主视图可读；Context strip 必显；键盘连接→选表→blkno→Load→主题；加载壳层稳定；跨块点击前无预取

## QA 修复回执

| 缺陷 ID | 处理 | 摘要 | 验证 | 建议复测 |
|---|---|---|---|---|
| — | — | 尚无 QA 缺陷 | — | — |

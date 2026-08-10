# QA Report: pg-page-viewer

## 轮次

| 轮次 | 日期 | 范围 | 结论 |
|---|---|---|---|
| 1 | 2026-07-26 | 首测：工作树（HEAD + 未提交修复）× Spec P0/P1、Plan L2/L3、ui-design、standards | **Pass** |

## 入口门禁

| 条件 | 结果 | 依据 |
|---|---|---|
| Plan 用户确认 | yes | `workflow/docs/manager/pg-page-viewer.md`（2026-07-26） |
| Review Approve | yes | `review.md` 复审 Approve；R1 closed |
| 可验收实现 | yes | `pg-page-viewer` @ `1c7dfc6` + 工作区修复（catalog LEFT JOIN/`pg_relation_size`、connect 死锁、server tests、integration DROP COLUMN 等） |

## 验收版本与环境

| 项 | 值 |
|---|---|
| 分支 | 源 `pg-page-viewer` → 目标 `main` |
| 实现版本 | HEAD `1c7dfc658c37d2cbfa224d5d9361adbf1300b3fe` + **工作区未提交修复**（评当前树，非仅 HEAD） |
| 运行时 | `dev:server` `127.0.0.1:8787`；`dev:web` `localhost:5173`（本机 Vite 仅 `::1`） |
| DB | PostgreSQL **16.0**（Spec 基准 16.11，兼容 16.x）+ `pageinspect`；本地 `.env`/`PG*`（报告无密钥） |
| GUI | Chrome headless + puppeteer-core（`/tmp`，未改仓库依赖） |
| Git | QA 未 commit/push；未合并 |

## 环境与命令

```bash
pnpm --filter page-core test          # 10 pass
pnpm --filter server test             # 4 pass
pnpm -r typecheck && pnpm -r build    # pass
pnpm --filter server test:integration # L3 OK；R1 dropped placeholders OK
```

独立补充：session（无 password、有 `serverVersion`）→ tables（仅用户 heap）→ schema/pages（raw 8192）→ OOR；`qa_nopageinspect` → `PAGEINSPECT_MISSING` + 指引后 `{source:"env"}` 恢复。

截图（`/tmp/qa-pageview/`，未入库）：`page-loaded-theme0/1.png`、`qa_hot-diff.png`、`qa_drop.png`、`qa_xblk.png`、`qa_xblk-after-cross.png`。

## 覆盖（Plan 最低验证层 + Spec）

### Plan 验证层

| 层 | 结果 | 证据 |
|---|---|---|
| L2 | **通过** | page-core / server unit / typecheck / build 均 exit 0 |
| L3 | **通过** | integration 实库；Chrome 手测 P0-13..P0-20 与实库交互 |

### Spec P0

| ID | 要求 → 结果 | 证据 |
|---|---|---|
| P0-1 | 真实页浏览 → **通过** | GUI/API：header/ItemId/free/tuple；raw base64 8192 |
| P0-2 | pageinspect 缺失 → **通过** | `PAGEINSPECT_MISSING` + `CREATE EXTENSION` 指引；不可浏览 |
| P0-3 | Flag/infomask → **通过** | 选中后逐位 ●/○ 可区分 |
| P0-4 | 列解码 → **通过** | GUI int4/text；L2 夹具含 TOAST/未知 hex |
| P0-5 | HOT/REDIRECT/跨块标注 → **通过** | HOT flags；REDIRECT；`Load block N (cross-block)` |
| P0-6 | 跨块点击无预取 → **通过** | `qa_xblk`：先仅 `/pages/0`，点击后 `/pages/3` |
| P0-7 | 刷新对比 → **通过** | Refresh 后 `region.diff` 4/29 |
| P0-8 | Hex 联动 → **通过** | 结构↔hex（header 24B；offset 8160→tuple） |
| P0-9 | 非 8KB → **通过** | page-core Vitest 拒绝错误长度/pagesize |
| P0-10 | 机密不落盘 → **通过** | session 无密码；storage 仅主题键；`.env` 未跟踪 |
| P0-11 | 空洞压缩 → **通过** | free「visually compressed」+ 真实跨度 |
| P0-12 | env 连接 → **通过** | 启动即 `connected`，可列表/取页 |
| P0-13 | 深色可读 → **通过** | light↔dark 截图；主视图/strip 对比可读 |
| P0-14 | 默认主题 → **通过** | 清 storage 后跟随 `prefers-color-scheme` |
| P0-15 | 元信息必显 → **通过** | strip 全量字段；无密码 |
| P0-16 | 不淹没主视图 → **通过** | stripH≈64 ≪ mainH≈792 |
| P0-17 | 状态完整 → **通过** | connected/加载/成功/OOR；未连接与空态有实现 |
| P0-18 | 键盘可达 → **通过** | `focus-visible`；Tab 达主题等（env 已连从选表/Load/主题验） |
| P0-19 | 错误可读 → **通过** | 原因 + `nextStep`/Next |
| P0-20 | 布局稳定 → **通过** | chrome/strip/nav 保留；局部 spinner |

### Spec P1

| ID | 要求 → 结果 | 证据 |
|---|---|---|
| P1-1 | 空表/空页 → **通过** | 空 NORMAL/0 块提示 |
| P1-2 | 越界 → **通过** | `BLKNO_OUT_OF_RANGE` + 下一步 |
| P1-3 | dropped → **通过** | integration R1 + GUI `(dropped)` 占位 |
| P1-4 | 主题记忆 → **通过** | `localStorage['pg-page-viewer.theme']` |

## 回归

L2 全绿；integration（含 DROP）通过。Review 非阻塞 C1–C5/S1 未升为缺陷（strip 必显齐全）。

## 文档

| 检查 | 结果 |
|---|---|
| README 启动/env/pageinspect/主题/非公网 | **通过** |
| `.env.example` 仅键名；`.env` 不入库 | **通过** |
| 禁止代执行 `CREATE EXTENSION` | **通过** |
| 运维手册 | N/A |

## 安全

范围：凭据存储、session 回传、绑定地址、catalog SQL。发现：**none**。合并（安全维）：**允许**（仍须用户授权 + Manager `done`）。

## UI/UX

| 检查项 | 结果 |
|---|---|
| Spec 界面验收（含 P0-13..P0-20） | **通过** |
| `workflow/docs/standards/ui.md` | **通过** |
| `ui-design.md` | **通过** |

## 缺陷

none

## 阻塞信息

none

## 结论

- 总体: **Pass**
- 恢复条件: N/A
- 合并: **待用户授权**（本轮不合并；QA 不提交本报告）

### 交接摘要（Manager）

| 字段 | 值 |
|---|---|
| 工作项标识 | pg-page-viewer |
| 验收版本 | `pg-page-viewer` / HEAD `1c7dfc6` + 工作区未提交修复 |
| 报告路径 | `workflow/docs/features/pg-page-viewer/qa-report.md` |
| 最终结论 | **Pass** |
| 缺陷列表 | none |
| 阻塞信息 | none |
| 建议后续 | 请求合并授权 → 授权后 `done` 并与未入库 `review.md`/`qa-report.md` 一次提交 → 合入 `main` |

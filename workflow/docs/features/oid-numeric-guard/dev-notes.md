# Dev Notes: oid-numeric-guard

- **适用对象**: Developer（交接）、QA（验收依据）、Reviewer（如需事后抽查；本项 Review 门禁 skipped）
- **前置条件**: `oid-numeric-guard` 分支（自 `main` 951268b 创建）；pnpm 可用
- **操作步骤**: 按 plan.md T1→T5 顺序实施，每任务一提交
- **预期结果**: 验证命令全绿（L2）；QA 按 V1–V5 复核

## 实现摘要

- `apps/server/src/app.ts`：新增模块级 `parseOidParam(raw, nextStep)`（`Number.isInteger(oid) && 1 ≤ oid ≤ 4294967295`；oid 为无符号 4 字节整数，0 为 InvalidOid 保留值）。非法时经 `appError(400, "BAD_OID", 'Invalid oid "<raw>" (expected an integer in 1..4294967295)', nextStep)` 返回，`{code,message,nextStep}` 形状，message 含实际输入。
- 3 条路由（`/api/tables/:oid/pages/:blkno`、`/api/indexes/:oid/pages/:blkno`、`/api/tables/:oid/schema`）在 `requirePageinspect` 之后、任何目录查询之前接入守卫（indexes 路由注释标 ⓪，先于 ①NOT_INDEX）。nextStep 按端点族：tables → "Pick a heap table from the table list"；indexes → "Pick an index from the index list"。
- 守卫序（实现后）：401 `NOT_CONNECTED` / 400 `PAGEINSPECT_MISSING` 网关最先 → `BAD_OID` → indexes：①`NOT_INDEX` → ②`INDEX_NOT_BTREE` → ③`BAD_BLKNO` → ④`BLKNO_OUT_OF_RANGE`；tables pages：`BAD_OID` → `BAD_BLKNO` → `NOT_HEAP_TABLE` → `BLKNO_OUT_OF_RANGE`（既有顺序零变化，仅前置 ⓪）。合法 oid（含 1..4294967295 全域数值）行为零变化。
- `apps/server/tests/oid-guard.test.ts`（新建）：18 个参数化用例（3 路由 × {abc, 1.5, -1, 0, 4294967296, 99999999999999999999}；含任务书中的超上界 4294967296 与 plan 的 1e20）+ 守卫序（BAD_OID 前 zero 目录 SQL，经 pool.query 日志证明）+ 网关序（401/400）+ tables 端点回归块（NOT_HEAP_TABLE / BAD_BLKNO / BLKNO_OUT_OF_RANGE）。
- `README.md` / `README.zh-CN.md`：Troubleshooting 各 +1 行 `BAD_OID`（双语对应）。

## 任务-提交

| 任务 | 提交 | 摘要 |
|---|---|---|
| T1 | （无文件变更，无提交） | 分支 `oid-numeric-guard` 自 `main` 创建并检出；基线 pnpm test 43 passed / typecheck 全绿 |
| T2 | b07bc92 | 红测：19 项失败（见下） |
| T3 | 277b13a | 实现 parseOidParam 守卫，19 红转绿 |
| T4 | 6a16dd9 | tables 端点回归块 +3 用例；既有套件零改动 |
| T5 | （本次提交） | 双语 README + dev-notes + 全量验证 |

## 红测呈现方式说明（plan「现状锚点」实证）

stub pool 忽略参数、NaN 不触发 22P02，故单测层观察不到线上误导码 `BAD_LSN`；红测断言目标行为 `BAD_OID`，实现前实际表现为：tables pages / schema 路由 → **200**（stub 对任意参数返回 HEAP_ROW/COLUMN_ROW 走完正常链）；indexes pages 路由 → **200/404**（视 stub 行）。红即「缺少守卫导致的非 400 响应」，与 plan 预期一致。T2 运行证据：`Tests 19 failed | 45 passed (64)`，失败均为 `expected 200/404 to be 400`。

## 验证证据（L2 达标声明）

| 命令 | 时机 | 结果 |
|---|---|---|
| `pnpm test`（根，`pnpm -r test`） | T1 基线 | server 6 文件 43 passed；web Done |
| `pnpm -r typecheck` | T1 基线 | 4 包全部 Done（零错误） |
| `pnpm --filter server test` | T2 红 | 1 failed 文件：**19 failed \| 45 passed** |
| `pnpm --filter server test` + `--filter server typecheck` | T3 后 | 7 文件 **64 passed**；tsc Done |
| `pnpm --filter server test` | T4 后 | 7 文件 **67 passed**（含 indexes.test.ts 10 项零改动全绿） |
| `pnpm test && pnpm -r typecheck` | T5 终验 | server 7 文件 **67 passed**、web 10 文件 **112 passed**、page-core/wal-core Done；typecheck 4 包全部 Done（零错误） |

集成说明：本项纯 server 路由参数守卫，无 DB 行为变更（合法 oid 的 SQL 与参数不变），integration smoke 不受影响，未重跑（plan 最低验证层 L2 已覆盖）。

## 未解决风险 / 偏差

- **refine-docs 未执行**：本 Developer 会话（sub-agent 环境）无 agent 调度工具，无法调用 `refine-docs`。风险：低（dev-notes 已按 documentation.md §3 最低要素自检）。恢复条件：父会话可在 QA 前补跑 refine-docs 并核对语义保全。
- 工作树中 Manager 的 STATUS.md / 工作项记录未提交变更非本角色职责，已保持原样未纳入提交。

## 变更路径

- `apps/server/src/app.ts`（+46/−3）
- `apps/server/tests/oid-guard.test.ts`（新建，163 行）
- `README.md`、`README.zh-CN.md`（各 +1 行）
- `workflow/docs/features/oid-numeric-guard/dev-notes.md`（本文件）

# QA Report: oid-numeric-guard

## 轮次

| 轮次 | 日期 | 范围 | 结论 |
|---|---|---|---|
| 1 | 2026-09-03 | 首测（fast；无 Spec，对照 plan V1–V5；Review 门禁 skipped 合规复核） | Pass |

## 环境与命令

- 分支 `oid-numeric-guard`（HEAD 61265ba），未改动任何代码 / plan / manager 文档；无 git 提交。
- 入口门禁：Plan 确认已持久化（951268b）；工作项记录明确标注 Review 门禁 `skipped`（fast：单点守卫修复，L2 覆盖，登记时裁定）——符合 qa.md「fast 可无 Approve」条件。
- L2 复跑：`pnpm test` → server 7 文件 **67 passed**、web 10 文件 **112 passed**；`pnpm -r typecheck` → 4 包全部 Done（零错误）。
- 真库取证：`PORT=8917 npx tsx src/index.ts` 起真实 server，`/api/session` 确认连接 PostgreSQL 16.11（socket /tmp:5432）；取证后已杀进程、端口已释放。

## 覆盖（对照 plan 最低验证层 L2 + 验收条目 V1–V5）

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| V1 | 3 条路由 × 非法 oid 返回 400 `BAD_OID`、message 含实际输入、nextStep 指示重选 | Pass | 真库：`/api/indexes/abc/pages/0`、`/api/tables/xyz/pages/0`、`/api/tables/1.5/schema` 均 400 `BAD_OID`，message 如 `Invalid oid "abc" (expected an integer in 1..4294967295)`，nextStep 分别指向 index/table list。边界 `0`、`-1`、`4294967296`、`99999999999999999999` 同样 400 `BAD_OID`；单测 oid-guard.test.ts 18 参数化用例 + 真库 curl 双证据 |
| V2 | 错误形状 `{code, message, nextStep}`，经 `appError` 构造，不出现 `BAD_LSN`/WAL 文案 | Pass | 真库全部错误体仅含三字段；**DEF-2 原始症状（BAD_LSN + WAL nextStep 误导）在真库上不再出现**；实现走 `appError(400, "BAD_OID", ...)`（app.ts:55-67） |
| V3 | 守卫序：网关最先；`BAD_OID` 先于目录查询 | Pass | 真库：合法上界 `4294967295` 放行进存在性检查 → 404 `NOT_INDEX`/`NOT_HEAP_TABLE`；`abc` 不再落 22P02→BAD_LSN。stub：401 `NOT_CONNECTED`、400 `PAGEINSPECT_MISSING` 均先于 `BAD_OID`；`pool.query` 日志为空证明 `BAD_OID` 前 zero 目录 SQL（indexes 先于 ①NOT_INDEX） |
| V4 | 回归：数值未知 oid 仍 404；`BAD_BLKNO`/`BLKNO_OUT_OF_RANGE` 序与码不变；既有套件全绿 | Pass | 真库：`/api/indexes/999999/pages/0` → 404 `NOT_INDEX`；`/api/tables/999999/schema` → 404 `NOT_HEAP_TABLE`；真实表 oid 24734：`pages/1.5` → 400 `BAD_BLKNO`、`pages/999999` → 400 `BLKNO_OUT_OF_RANGE`、`pages/0` → 200。L2：既有 indexes.test.ts 10 项零改动全绿，全套 67 passed |
| V5 | 双语 README Troubleshooting 各含 `BAD_OID` 行 | Pass | `README.md:119`、`README.zh-CN.md:116`，语义对应（构造 URL 时使用列表取得的整数 oid `1..4294967295`） |

## UI/UX

> 无 `ui-design.md`（`UI 表面=none`）。

| 检查项 | 结果 | 证据 |
|---|---|---|
| Spec 界面相关验收 | N/A | 无 Spec（fast）；无界面变更 |
| `workflow/agents/standards/ui.md` 底线 | N/A | 同上 |
| `ui-design.md` 状态与流程 | N/A | 不存在，Plan 已裁定 |

## 缺陷

| ID | 严重度 | 摘要 | 状态 |
|---|---|---|---|
| （无） | — | — | — |

备注（非缺陷）：本 QA 会话为 sub-agent 环境，无 agent 调度工具，无法调用 `refine-docs` 精简本报告；风险低（报告已按模板与 documentation.md 要素自检），恢复条件：父会话可补跑 refine-docs 并核对语义保全（与 dev-notes 同型偏差）。

## 结论

- 总体: Pass
- 恢复条件: N/A
- 合并: 待用户授权（源 `oid-numeric-guard` → 目标 `main`；QA 不提交本报告，Manager 按 git.md §1.4 于授权后置 `done` 并一次提交）

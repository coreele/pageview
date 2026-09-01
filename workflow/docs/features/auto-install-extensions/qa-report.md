# QA Report: auto-install-extensions

## 轮次

| 轮次 | 日期 | 范围 | 结论 |
|---|---|---|---|
| 1 | 2026-09-01 | 首测（spec P0-1..P0-8、P1-1..P1-4；L2 复跑 + L3 增强含实库取证；README 双语与 web 文案；F1-F4 处置核对） | Pass |

## 环境与命令

- 分支 `auto-install-extensions` HEAD `b1e0314`（与 review 版本一致）；本地 PostgreSQL 16.11（socket /tmp:5432，超级用户；.env 连接，内容未打印）。server 经 `tsx src/index.ts` 起真实进程 + `curl --noproxy '*'` 实测；DDL 取证用 `ALTER SYSTEM SET log_statement='ddl'`（reload 生效，正控制验证后已于验后 RESET 还原，auto.conf 无残留）。
- 复跑（均 exit 0）：`pnpm test`（wal-core 13 / page-core 58 / server 43 / web 112，共 226 通过 0 失败）；`pnpm -r typecheck`、`pnpm -r build`（4 包全过）；`pnpm test:integration`（含 `auto-install (WAL) OK`、`auto-install (Page) OK`、`Auto-install segment OK`；heap/R1/B-tree oracle/hash guard 既有段无回退）；`pnpm test:wal`（WAL L3 smoke OK）。
- `grep -n "never runs\|will not run\|不会替你" README.md README.zh-CN.md` → 无输出（exit 1）。

## 覆盖（对照 plan 最低验证层 L2 + L3 增强 + spec 验收）

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| P0-1 | pageinspect 缺失自动安装 | Pass（实库） | psql DROP → GET /api/tables **200**（真实表数据）→ `pg_extension` 装回 1.12；pg.log（ddl 级）恰一条 `statement: CREATE EXTENSION IF NOT EXISTS pageinspect`。另 L3 段同构复跑通过 |
| P0-2 | pg_walinspect 缺失自动安装（PG16） | Pass（实库） | psql DROP → GET /api/wal/current-lsn **200**（合法 LSN）→ 装回 1.1；pg.log 恰一条 `CREATE EXTENSION IF NOT EXISTS pg_walinspect` |
| P0-3 | 无权限失败路径（42501） | Pass（**实库**，超出 plan 预期） | 临时受限角色 `qa_nocreate`（NOSUPERUSER，验后已删）起真实 server：HTTP **400**，code=`PAGEINSPECT_MISSING`（未泄漏为 403 PERMISSION），message 含真实 PG 原因 `permission denied to create extension "pageinspect"`，nextStep 含 superuser + `CREATE EXTENSION pageinspect;`、无「will not run」 |
| P0-4 | 扩展文件缺失（not available） | Pass（数据层 stub 证据） | 无法真实触发（移除系统扩展文件不可行）；L2 stub：58P01 → 400 `WALINSPECT_MISSING` + message 含 `extension "pg_walinspect" is not available` + 人工 nextStep + 三字段形状（extension-auto-install.test.ts） |
| P0-5 | 已装零 DDL | Pass（实库） | 装回状态下两模式端点各 200；`log_statement=ddl` 生效期间（CREATE TABLE/DROP TABLE 正控制已入日志）pg.log 增量 DDL 语句数为 **0**。另 L2 sqlLog 断言零 CREATE、代码路径核对（session.ts 存在即仅 SELECT） |
| P0-6 | PG14 版本门禁 | Pass（L2 stub 证据；**未核验-无 PG14 实例**） | 测试断言：serverVersion=14.x → 400 `PG_VERSION_UNSUPPORTED` 且 `sqlLog` 为空、`connects()===0`（不连池不发查询不安装）；无 PG14 实例未做实库复测 |
| P0-7 | 错误形状 `{code,message,nextStep}` + 400 | Pass（实库+代码） | P0-3 真实响应体字段恰为 `['code','message','nextStep']` 排序一致；app.ts `appError` 构造不变、`*_MISSING` 透传分支未动；L2 对 P0-3/P0-4 均断言形状 |
| P0-8 | README 双语 + web 文案 | Pass | 旧表述 grep 零残留；Requirements（en/zh :44-53）双语逐句对应（自动安装 + `CREATE` 权限角色通常超级用户 + 失败报错，SQL 块保留为人工回退）；Troubleshooting（en:113-114 / zh:110-111）自动安装失败语义 + 人工指引，双语一致；App.tsx:1270-1272 与裁决句逐词一致（`<code>` 强调保留，前后文未动）；README.zh-CN.md:32「不会自动 Load」为 WAL 表单既有提示，与本合同无关 |
| P1-1 | 失败后重试无负面缓存 | Pass（实库） | 同一受限 server 不重启：P0-3 400 后超级用户手动 `CREATE EXTENSION` → 重试 /api/tables **200** |
| P1-2 | 并发幂等 | Pass（L2 stub + 代码；真并发竞态未复现，按 dev-notes 缺口口径） | 三用例：42710 竞态全放行、双 CREATE 成功、复用免 DDL 仅一次 CREATE；代码核对 42710/42701 不视为失败、由复查裁决 |
| P1-3 | 安装成功复查未通过 | Pass（数据层 stub 证据） | stub：CREATE 成功但复查仍缺 → 400 `PAGEINSPECT_MISSING`（"did not take effect" 路径），SQL 序列停在第 3 条、无可调用性探针 |
| P1-4 | 连接不预装 | Pass（实库） | 两扩展 DROP 后（count=0）：server 启动自动连接 + `POST /api/connect {"source":"env"}` 均 200 connected；连接后 `pg_extension` 仍 **0**；随后守卫请求装回（终态两扩展在位）。另有 `vi.mock("pg")` L2 用例（连接仅发 `SELECT version()`） |
| 回归 | 既有行为 | Pass | 226 用例全绿；L3 既有段（heap/R1/B-tree oracle/hash guard、WAL smoke）无回退；错误码集合零增删（diff 范围与 plan 触碰路径逐项一致，9 路径，无越界、无 .env/凭据、无依赖变更） |
| 安全 | DDL 范围/权限语义（security.md 触发面） | Pass | 实库全程 pg.log 仅出现两条白名单 `CREATE EXTENSION IF NOT EXISTS`；无其他 DDL、无安装记录落盘、失败信息仅 PG 服务端文本（真实响应无凭据回显） |

### Review 发现项处置核对（F1-F4，均 Info）

| ID | 处置核对 | 状态 |
|---|---|---|
| F1 | session.ts:133,180 拼接 `ext` 现状核对：来源为字面量联合类型模块级白名单常量，无用户输入路径、无注入面；参数化建议留后续工作项 | 已核对，无需本轮处理 |
| F2 | 「P0-3 实库不可达」缺口经 QA 临时受限角色实测**收窄**（P0-3 已有实库证据）；P0-4 残余维持 stub 口径（原因/风险/恢复条件已记 dev-notes，符合 quality.md §6） | 缺口收窄，P0-4 残余已登记 |
| F3 | `42701` 防御性包含核对：在位、无害、plan 已声明 | 已核对，无需处理 |
| F4 | integration-smoke finally 兜底核对：`IF NOT EXISTS` 重建、失败仅 stderr；主体断言失败经 `aiCheck` 抛错仍非零退出 | 已核对，无需处理 |

## UI/UX

> 无 `ui-design.md`（Design 门禁 skipped；UI 表面 gui 仅一行文案）。

| 检查项 | 结果 | 证据 |
|---|---|---|
| Spec 界面相关验收（开放问题 1 裁决文案） | Pass | App.tsx:1270-1272 与裁决原文逐词一致（`<code>` 强调形式保留）；前后文与错误处理未动；web 112 用例全绿（api.test.ts 不依赖该文案，未改动） |
| `workflow/docs/standards/ui.md` 底线 | N/A | 纯文案替换，无布局/交互变更，无 ui-design.md |
| `ui-design.md` 状态与流程 | N/A | 不存在（Design skipped） |

## 缺陷

| ID | 严重度 | 摘要 | 状态 |
|---|---|---|---|
| — | — | 无缺陷（P0-4 实库形态与 P0-6 实库复测为已登记环境缺口，非实现缺陷，见上表标注与 dev-notes） | — |

## 结论

- 总体: **Pass**
- 依据：P0-1/P0-2/P0-5/P0-7/P0-3/P1-1/P1-4 均有实库取证，P0-4/P1-3（stub）、P0-6（无 PG14 实例）、P1-2（真竞态）按 plan/dev-notes 声明口径以 L2 断言覆盖并如实标注；L2 复跑全绿、L3 自动安装段 OK 且既有段无回退；README 双语与 web 文案验收通过；F1-F4 处置核对无未决项；安全验证无发现；无缺陷。验后环境已还原（log_statement 复原、临时角色删除、两扩展装回在位、测试端口释放）。
- 恢复条件: N/A
- 合并: 待用户授权（Pass 已达成；Manager 按 git.md §1.4 决定报告提交时机，QA 不提交本报告）

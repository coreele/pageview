# Review: auto-install-extensions

## 审阅范围

- 工作项：auto-install-extensions（standard，Review 门禁 required）；切片未拆分。
- 审阅版本：分支 `auto-install-extensions` HEAD `b1e0314`（自 main `f4d359c` 分出；提交 3cef61a / 7765709 / cc83e51 / 8cd503e / b1e0314）。
- 依据：spec.md（合同权威）、plan.md、dev-notes.md、standards/documentation|quality|security|git.md、review 模板。
- 差异：`apps/server/src/session.ts`、`apps/server/tests/extension-auto-install.test.ts`（新）、`connect-no-preinstall.test.ts`（新）、`session-gates.test.ts`、`apps/server/src/integration-smoke.ts`、`apps/web/src/App.tsx`、`README.md`、`README.zh-CN.md`、dev-notes.md。触碰路径与 plan「触碰路径」逐项一致，无越界变更。
- 独立验证（Reviewer 亲跑，2026-09-01，本地 PG16.11）：
  - `pnpm test`：226 通过（wal-core 13 + page-core 58 + server 43 + web 112），0 失败；
  - `pnpm -r typecheck`、`pnpm -r build`：4 包全部通过，exit 0；
  - `pnpm test:integration`：exit 0，日志含 `auto-install (WAL) OK`、`auto-install (Page) OK`、`Auto-install segment OK`，既有段（heap/R1/B-tree oracle/hash guard）无回退；
  - `pnpm test:wal`：exit 0（WAL L3 smoke OK）；
  - 实测抽查：psql（socket /tmp:5432）DROP `pg_walinspect` → 起真实 server（tsx，`.env` 自动连接，未打印内容）→ `GET /api/wal/current-lsn` 返回 200 与合法 LSN → `pg_extension` 复查装回；结束后两扩展均恢复在位（无环境残留）。注：首轮 curl 经本机代理得 502，`--noproxy` 直连后正常，与实现无关。

## 实现正确性

**结论：满足 Spec 合同与 Plan 任务，无回归、无越界。**

- 守卫流程（session.ts:171-198 `ensureExtension`）与 spec「合同」逐条一致：存在性检查（:133）→ 缺失时一条裸 `CREATE EXTENSION IF NOT EXISTS <ext>`（:180，无 SCHEMA/VERSION，每请求至多一次）→ 复查同一存在性 + 可调用性检查 → 通过放行；已安装路径仅两条既有 SELECT，零 DDL。
- 错误就地转换（:182-191）：安装 SQL 失败即抛既有 `gateError`，message 格式 `<ext> extension is missing and automatic installation failed: <PG 原文>`；nextStep 用修订常量（:103-108，保留超级用户 + `CREATE EXTENSION <name>;`，无「will not run」表述）。读 `app.ts:45-71` 确认：`mapPgError` 先按 `code === "PAGEINSPECT_MISSING"` 分支透传 message/nextStep，`WALINSPECT_MISSING` 走 `mapWalGateError`（wal.ts:97）同透传——42501 分支（app.ts:90-97，403 PERMISSION）不可达，无泄漏。复查仍缺走「did not take effect」路径（:193-197）。
- 幂等（:183）：`42710`（含防御性 `42701`）不视为失败，由复查裁决，满足 P1-2；无任何负面缓存，P1-1 由逐请求重查满足。
- 版本门禁（:227-237）：`requireWalCapabilities` 的 PG<15 判断在 `pool.connect()` 之前，不连池、不发扩展查询、不安装；P0-6 断言 `connects() === 0` 且 `sqlLog` 为空。
- `connectSession` 零改动（P1-4 现状保持，由 `connect-no-preinstall.test.ts` 以 `vi.mock("pg")` 证明连接仅发 `SELECT version()`）。
- 错误码集合不变：`app.ts` 与常量均未增删错误码；`PG_VERSION_UNSUPPORTED` 等路径未触碰。

## 测试有效性

**结论：覆盖关键路径、边界与失败情形；能因错误实现而失败；验证达到 L2 最低层且含 L3。**

- 新增 12 条（extension-auto-install 11 + connect-no-preinstall 1），覆盖 P0-1..P0-7、P1-1..P1-4 全部编号：
  - SQL 序列断言（sqlLog 逐条：检查→裸安装语句精确字符串→复查→可调用性）使 P0-1/P0-2/P0-5 对语句顺序与零 DDL 敏感；
  - P0-3：stub 安装抛 42501 → 断言 HTTP 400 + `PAGEINSPECT_MISSING` + message 含 PG 原文 + nextStep 含 `CREATE EXTENSION pageinspect`/superuser + 无「will not run」+ 响应体三字段（P0-7 形状），并断言仅一条 CREATE——若错误穿透为 403 PERMISSION 即失败，测试有效；
  - P0-4：58P01「not available」同构覆盖；P0-6：connect 计数 0；P1-2 三种形态（42710 竞态、双成功、复用免 DDL）；P1-3：安装成功复查仍缺（sqlLog 停在第 3 条，无可调用性探针）。
- 既有测试语义核对：`session-gates.test.ts` 断言改为新常量合同（含否定断言）；`wal.test.ts:40` nextStep 断言未改且仍绿（新常量含 `CREATE EXTENSION pg_walinspect`）；`indexes.test.ts` pageinspect-missing 用例断言原样保持，在新流程下语义为「stub 全空 → 安装'成功'→ 复查仍缺 → `PAGEINSPECT_MISSING`」，与 plan 预期一致，43/43 通过。
- TDD 证据（dev-notes：红 11 failed / 4 passed → 绿 43/43）与「现状保持」用例实现前即绿的自述相符。

## UI/UX 核对

无 `ui-design.md`（Design 门禁 skipped；UI 表面 gui 仅一行文案）。以 spec 已裁决开放问题 1 为准。

| 检查项 | 结果 | 备注 |
|---|---|---|
| 对照 Spec 界面验收 | 通过 | App.tsx 连接表单文案与裁决原文逐词一致（`<code>` 强调形式保留），前后文与错误处理未动 |
| 对照 `workflow/agents/standards/ui.md` | N/A | 无 ui-design.md；纯文案替换，无布局/交互变更 |
| 对照 `ui-design.md` | N/A | 不存在（Design skipped） |
| 主题/深色（仅 Spec 要求时） | N/A | Spec 未要求 |

## 文档影响核对

| Plan 声明 | 实现是否一致 | 备注 |
|---|---|---|
| 开发文档 | 一致 | session.ts / integration-smoke.ts 注释随实现更新（守卫流程、T5 段意图与 finally 兜底说明）；dev-notes.md 记录命令、结果、TDD 与缺口（quality.md §1） |
| 用户文档 | 一致 | README 双语：Requirements（en:44-53 / zh:44-53）删除「never runs / 不会替你」承诺，改述自动安装 + `CREATE` 权限角色（通常超级用户）+ 失败报错语义，SQL 块保留并标注人工回退；Troubleshooting 两行（en:113-114 / zh:110-111）改自动安装失败语义 + 人工指引。`grep "never runs\|will not run\|不会替你"` 无输出（Reviewer 亲验，exit 1）。App.tsx 文案见 UI/UX 节；`apps/web/src/api.test.ts` 零改动确认（不依赖该文案） |
| 运维文档 | N/A（plan 裁定） | 本地调试工具，排障语义已在用户文档 Troubleshooting 覆盖 |

双语一致性：Requirements 与 Troubleshooting 对应节逐句语义对齐（en/zh 行号映射如上），无单侧遗漏。fixture 采集脚本及其 README 未触碰（spec 非目标，确认未动）。

## 安全影响核对

范围：授权/权限语义 + DDL 写操作（security.md §2 触发面）；输入处理（SQL 构造）一并检查。

| 检查项 | 结果 | 备注 |
|---|---|---|
| 敏感信息 | 通过 | 分支提交仅含声明的 9 个路径，无 `.env`/凭据混入（`git log --name-only` 核验）；.env 内容未打印、未入库；无安装记录落盘 |
| 认证与授权 | 通过 | DDL 权限语义变更系用户裁决的产品行为（spec 背景 #3）；server 仅对用户显式连接的库执行两条白名单 `CREATE EXTENSION IF NOT EXISTS`，无其他 DDL；失败仅返回 PG 服务端错误文本（无凭据回显） |
| 输入与外部访问 | 通过 | `CREATE EXTENSION IF NOT EXISTS ${gate.ext}`（session.ts:180）与存在性检查 `extname = '${ext}'`（:133）的插值来源为 `ExtensionGate.ext`，类型为字面量联合 `"pageinspect" \| "pg_walinspect"`（:145），仅由模块级常量 PAGEINSPECT_GATE/WALINSPECT_GATE 构造，无用户输入路径，类型系统约束——无注入面。见发现项 F1 |
| 依赖变更 | 通过 | 未新增/升级依赖 |

处置状态：无未解决安全问题；允许进入 QA。

## 必修项

| ID | 位置 | 问题 | 状态 |
|---|---|---|---|
| — | — | 无阻塞项 | — |

## 发现项（全部非阻塞，Info 级）

| ID | 位置 | 问题 |
|---|---|---|
| F1 | apps/server/src/session.ts:133,180 | 两处 SQL 以模板字符串拼接 `ext`。当前为字面量联合类型白名单常量，无注入风险；但拼接样式若被后续复制改造为接收动态值会引入注入面。建议（后续工作项可选）：改参数化查询（`$1`）或在注释中显式标明白名单约束 |
| F2 | （环境限制，非代码） | P0-3/P0-4 实库失败路径（42501 / not available）本地与 CI 均不可真实触发，由 L2 stub 覆盖同一段就地转换逻辑；dev-notes 已记原因、风险与恢复条件（受限角色/缺文件实例补测），符合 quality.md §6 |
| F3 | apps/server/src/session.ts:183 | `42701`（duplicate_column）非 `CREATE EXTENSION` 竞态的真实错误码，防御性包含无害；属 plan 已声明的防御性处理 |
| F4 | apps/server/src/integration-smoke.ts:333-341 | finally 兜底重建失败仅记 stderr、不改变该点退出码。可接受：主体断言失败时进程已因 `aiCheck` 抛错非零退出；主体成功时兜底为 `IF NOT EXISTS` no-op。极端场景（主体成功后权限中途丢失）仅缺 stderr 之外的失败信号 |

## 结论

**Approve**

- 实现满足 spec P0-1..P0-8、P1-1..P1-4 合同；测试有效且覆盖全部验收编号；文档影响与 plan 一致（双语一致）；安全检查无未解决问题；Git 合规（分支自 main f4d359c、提交符合 Conventional Commits、原子性、无禁止提交项）。无阻塞项，满足进入 QA 条件。

## 后续动作

- 建议后续角色：QA（依据 spec P0/P1 与 plan 验证层独立验收，含 L3 与 README 双语；L3 失败路径缺口按 dev-notes 记录处理）。
- 复审范围（如 QA 修复触发）：仅被修复文件与对应回归；F1-F4 为 Info 级建议，不要求本轮处理。
- review.md 留在工作区，按 git.md §1.4 由 Manager 决定提交时机；Reviewer 不做任何 Git 提交。

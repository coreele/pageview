# Review: pg-page-viewer

## 审阅范围

| 项 | 值 |
|---|---|
| 工作项 | `pg-page-viewer`（未拆分） |
| 路径 / 门禁 | full；Review required；UI 表面 gui |
| 首轮版本 | 分支 `pg-page-viewer` @ `1c7dfc658c37d2cbfa224d5d9361adbf1300b3fe`（`main...` 5 commits） |
| 复审版本 | 同 HEAD `1c7dfc6` + **工作区未提交修复**（`catalog.ts`、`app.ts`/`index.ts`、`integration-smoke.ts`、`apps/server/tests/`、`vitest.config.ts`、package 变更） |
| 依据 | spec / design / ui-design / plan / dev-notes；standards `{documentation,quality,security,git,ui}`；`docs/manager/pg-page-viewer.md`；上一轮 R1 open |
| 复审复验 | `pnpm --filter server test`（4 pass）；故意改 INNER JOIN → 该测 fail 后还原；`pnpm --filter page-core test`（10 pass）；`pnpm --filter server typecheck`；`pnpm --filter server test:integration` → `R1 schema placeholders OK (1 dropped)`（PG 16.0） |
| 未做 | 浏览器 UI 手测；全量 P0-13..P0-20 证据 |
| 排除 | 未评 `docs/manager/**` 状态正文；本报告不 commit |

## 结论

**Approve**（复审）

R1 **closed**。无新阻塞项。L3/UI 证据缺口仍**阻塞 QA Pass**，不阻塞本 Approve。

---

## 首轮（Request changes）

**Request changes** — 阻塞 R1。L3/UI 缺口本身不阻塞进入 QA；R1 未修复并复审前不得进入 QA。

| ID | 位置 | 问题 | 状态 |
|---|---|---|---|
| R1 | `apps/server/src/app.ts` `GET /api/tables/:oid/schema` | INNER `JOIN pg_type`：删除列 `atttypid=0` 丢行，schema 无 `attisdropped` 占位 → 解码错位。违反 Spec / P1-3；含 DROP 时亦破坏 P0-4。core 单测测不到服务端遗漏。 | **closed（复审）** |

实现：除 R1 外主路径对齐 Spec/Design/Plan。测试：L2 有效、未达 Plan 最低 L3、L2 测不到 R1。文档/安全/Git 通过；UI 代码层对齐、缺浏览器证据。

非阻塞发现（仍开放）：

| 级别 | ID | 位置 | 说明 |
|---|---|---|---|
| Medium | C1 | `apps/web/src/styles.css` | `--strip-h` + `overflow: hidden` 可能裁切 P0-15 |
| Medium | C2 | `StructureMap.tsx` | 同页 HOT/ctid 偏文案 |
| Medium | C3 | `decode.ts` | `numeric` 多为 hex |
| Low | C4 | Navigator | ↑↓ vs Tab |
| Low | C5 | `parse.test.ts` | `beforeAll` 重写 fixtures |
| Low | S1 | CORS `origin: true` | `HOST=0.0.0.0` 时面扩大 |

---

## 复审轮次

重点：R1 关闭（P1-3 / 含 DROP 的 P0-4）；`pg_relation_size/8192`；connect `release`→`pool.end` 与 listen 先于 env 连；C1–C5/S1 不强制关闭。

### R1 状态：**closed**

| 检查 | 证据 | 结果 |
|---|---|---|
| SQL 保留 dropped | `catalog.ts` `SCHEMA_COLUMNS_SQL`：`LEFT JOIN pg_type`；`COALESCE` typname/typoid；`mapSchemaColumnRow` null → dropped/0 | 通过 |
| API 接线 | `app.ts` 使用 `SCHEMA_COLUMNS_SQL` + `mapSchemaColumnRow` | 通过 |
| 解码合同 | `page-core` `decode.ts` 对 `attisdropped` 占位并推进偏移 | 通过（既有） |
| 单元可失败 | 改 INNER JOIN → `catalog.test.ts` fail（exit 1）；还原后 4 pass | 通过 |
| 实库 DROP | integration：TEMP 表 DROP `b` 后 schema 须 `length>=3` 且含 `attisdropped`；实测 `R1 schema placeholders OK (1 dropped)` | 通过 |

满足 Spec attisdropped / P1-3；含 DROP 时 schema 齐全，不再破坏 P0-4 列序。

### blocks 变更

表列表与页越界改用 `(pg_relation_size(oid)/8192)::int`，不再读 `relpages`。主 fork 磁盘块数避免 ANALYZE 前为 0；参数化 OID、无新注入。单元断言含 `pg_relation_size` 不含 `relpages`；integration 要求 `blocks >= 1`。新阻塞：**none**。

### connect 死锁修复

失败路径先 `client.release()` 再 `pool.end()`；`finally` 仅未释放时 release。`index.ts`：`listen` 后 `tryAutoConnectFromEnv`；附带 `connectionTimeoutMillis: 10_000`。非阻塞：listen 后至 env 连上前短暂未连接；与 UI connect 可能竞态（本机单用户可接受）。新阻塞：**none**。

### 实现正确性

**通过。** 首轮其余结论维持；R1/blocks/死锁对齐 Spec/Plan；未改 spec/design/ui-design/plan。

### 测试有效性

| 项 | 结果 |
|---|---|
| Server Vitest（4） | LEFT JOIN / blocks SQL / dropped 映射 / 字节→块数；**能因 INNER JOIN 回归失败** |
| Integration R1 | DROP COLUMN 路径可失败；本机通过（PG 16.0） |
| page-core L2 | 10 pass |
| Plan L3 / UI | integration 可达；浏览器 P0-13..P0-20 仍缺 → **阻塞 QA Pass，不阻塞 Approve** |

### 文档影响

`dev-notes.md` 已记 R1/blocks/死锁回执；用户/运维无强制变更；无真实密钥。

### 安全影响

范围：上轮 + catalog SQL、vitest、connect 释放/超时。敏感信息、`$1` OID、依赖：通过。未解决安全问题：**none**。

### Git 合规

源分支 `pg-page-viewer`；HEAD `1c7dfc6`；修复未提交；无禁止项入库；本报告不 commit（`git.md` §1.4）。

### UI/UX

无前端 diff。代码层对齐；P0-13..P0-20 缺浏览器证据 → **阻塞 QA Pass，不单独 Request changes**。C1–C4 仍开放。

### L3 / UI 证据缺口（独立判定）

| 未验证项 | 原因 | 风险 | 恢复条件 | 复测范围 | Review |
|---|---|---|---|---|---|
| 浏览器 P0-13..P0-20 | 无手测清单证据 | GUI 回归未知 | `dev:server`+`dev:web` 对照 ui-design | T7–T11 UI | 不单独 Request changes；**阻塞 QA Pass** |
| 实页 HOT/跨块夹具 | 合成夹具为主 | P0-5/6 偏手测 | `capture-fixtures` | T4, T10 | 同上 |

复审已跑通 integration（含 R1）；缺口收窄为 UI 手测与可选实页夹具。

### 发现项（复审后）

| 级别 | ID | 状态 | 说明 |
|---|---|---|---|
| High | R1 | **closed** | 见上 |
| Medium/Low | C1–C5, S1 | open（非阻塞） | 同首轮；无新阻塞 |

### 后续动作

1. Manager：Review 门禁满足 → 调度 QA。
2. QA Pass 前：浏览器 P0-13..P0-20；建议含 DROP 解码可见性与 HOT/跨块。
3. C1–C3 可选，不挡进 QA。
4. 修复提交由 Manager/Developer 按 `git.md`（Reviewer 不提交）。

## 交接摘要（Manager）

| 字段 | 值 |
|---|---|
| 工作项标识 | pg-page-viewer |
| 审阅版本 | `pg-page-viewer` / HEAD `1c7dfc658c37d2cbfa224d5d9361adbf1300b3fe` + **工作区未提交修复** |
| 报告路径 | `docs/features/pg-page-viewer/review.md` |
| 最终结论 | **Approve** |
| R1 状态 | **closed** |
| 阻塞项 | none |
| 建议后续 | Manager 调度 QA；QA Pass 前补齐 UI 手测（及建议 DROP/HOT） |

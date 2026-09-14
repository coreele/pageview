# Review: visibility-map-info

## 审阅范围

- 实现版本 / 提交: `1499374` `feat(page,wal): show heap block visibility map with pg_visibility auto-install`（源分支 `visibility-map-info`，基线 `96c5f73`；`origin/main` 未移动，可直接 fast-forward）
- 依据: `plan.md`；`spec.md`（Design/UI 均为 N/A）

## 实现正确性

- 守卫复用 `ensureExtension`，pg_visibility 门与既有两门同构：存在性 → 裸 `CREATE EXTENSION IF NOT EXISTS` → 复查（存在性 + 可调用性）→ 失败就地转 `VISIBILITY_MISSING`。无越界改动。
- `GET /api/tables/:oid/pages/:blkno/visibility` 守卫链顺序正确：`parseOidParam` → blkno 整数 → `PAGE_RELATION_SQL`（relkind='r'）→ blkno 越界 → `requirePgVisibility` → VM 查询。P1-4 语义（坏输入不触发扩展安装）成立。
- VM 查询 `pg_visibility($1, $2::bigint)` 别名到 `allVisible/allFrozen/pdAllVisible`，0 行按全 false——与 Spec 合同一致。
- `POST /api/extensions/install` 白名单校验先于任何 pool 使用（未知 ext 零 SQL）；`installExtension` 走同一 `ensureExtension`，失败错误码正确。
- web `fetchVm` 非致命、以 `vmReqRef` 去抖过期响应；`installVm` 先安装再重拉，`vmInstalling` 防重复提交；VM 状态在 `resetPageView`/`onSelectTable` 正确清理。渲染仅当 `heapPage && selectedTable`，索引路径不展示 VM（符合 Spec 非目标）。

## 测试有效性

- server 单测 12 条新增用例覆盖 P0-1/P0-2/P0-3/P0-6/P0-7/P1-1..P1-6：既断言响应形状，也断言 SQL 序列（存在性×2、`CREATE EXTENSION IF NOT EXISTS pg_visibility`、callable 探针、零 DDL、坏输入零扩展查询）。这些用例对改动前的代码必然失败（新端点/符号不存在），非恒真断言。
- web `api.test.ts` 新增 4 条覆盖 `fetchVisibility`/`installExtension` 的成功与 `VISIBILITY_MISSING` 错误契约，并断言 install 请求的 method/body。
- 渲染侧（VM meta-item / Install 按钮 DOM 行为）无组件测试基建，由 plan「验证缺口」登记为 manual/e2e——与仓库现状一致，非本项引入的缺口。

## 文档影响核对

| Plan 声明 | 实现是否一致 | 备注 |
|---|---|---|
| 开发文档 | 一致（N/A） | 无独立开发文档 |
| 用户文档 | 一致 | README.md / README.zh-CN.md：Requirements + SQL 回退 + Scope（VM 只读展示）+ Troubleshooting `VISIBILITY_MISSING`；连接表单文案补 `pg_visibility` |
| 运维文档 | 一致（N/A） | 无运维脚本变更 |

## 安全影响核对

| 检查项 | 结果 | 处置状态 | 备注 |
|---|---|---|---|
| 敏感信息 | 通过 | — | 无密钥/凭据；错误信息仅回传 PG 服务端返回文本 |
| 认证与授权 | 通过 | — | 新端点均先 `notConnectedReply`（401）；安装失败不泄漏为 `PERMISSION`，就地转 `*_MISSING` |
| 输入与外部访问 | 通过 | — | `ext` 白名单枚举校验；oid/blkno 守卫链先于扩展使用；`CREATE EXTENSION IF NOT EXISTS` 仅对白名单名称拼接（无用户输入注入面） |
| 依赖变更 | 通过 | — | 无新增依赖 |

## 必修项

| ID | 位置 | 问题 | 状态 |
|---|---|---|---|
| — | | | |

## 非阻塞建议

- `apps/web/src/App.tsx` 的 VM meta-item 在「加载中」用 `loading…` 占位，与后端 VM 请求非常快匹配良好；若未来 VM 慢可考虑 skeleton，非本项必需。
- `POST /api/extensions/install` 目前仅被 `pg_visibility` 按钮使用，白名单已含三扩展，泛化后续工作项零改动即可复用。

## 结论

Approve

## 后续动作与复审范围

- 进入 QA；QA 以 `1499374` 为对象，逐条核对 Spec P0/P1 与 Plan 验收表。

## 复审（轮次 2）

- 提交: `bb1a4c8`（在 `1499374` 之上，仅 UI 文案修订）
- 变化: `apps/web/src/App.tsx` 将 heap meta-stats 标签 `visibility map` 改为 `VM`；无逻辑、接口或文档变化。
- 验证: `pnpm -r typecheck` / `pnpm -r build` / `pnpm test`（609）均全绿。
- 结论: Approve（`bb1a4c8`）

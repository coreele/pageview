# Dev Notes: infomask-detail

## 实现说明

- 工作项: `infomask-detail`（未拆分）；源分支 `infomask-detail` ← `main`
- 行为: Selection detail 中 `t_infomask` / `t_infomask2` 改为可读 hex + 紧凑位格条（高亮=置位）+ hover/聚焦单格说明 + `?` 全量参考；ItemId `lp_flags` 仍为纵向 ○/● 清单
- TDD: `formatInfomaskHex` / decode 消费契约 Vitest（红：模块缺失）→ `InfomaskBitStrip` → StructureMap 接线 → 样式
- **禁止**改 `packages/page-core` / `apps/server` 业务（本项无其业务 diff）
- 未改 Spec / Plan / manager 工作项或 STATUS

## Plan 任务

| 任务 | 状态 |
|---|---|
| T1 分支与基线 | 完成（检出 `infomask-detail`；改前 `pnpm -r typecheck` + `pnpm --filter web build` Pass） |
| T2 位格条组件 | 完成（`InfomaskBitStrip.tsx` + `formatInfomaskHex`；消费传入 `FlagBit[]`） |
| T3 StructureMap 接线 | 完成（仅替换两位字段；ItemId `.flag-list` 保留） |
| T4 样式 / 主题 | 完成（`.infomask-bit-strip*`；沿用 `--accent` / `--text-muted` / `--surface`；未新增主题键） |
| T5 a11y + 回归核对 | 完成（格 `tabIndex={0}`；`?` 为 button；`git diff` 无 page-core/server 业务变更） |
| T6 文档与验证关门 | 完成（本文件；验证命令见下；手测见未验证项） |

## 变更路径

| 路径 | 变更 |
|---|---|
| `apps/web/src/InfomaskBitStrip.tsx` | 新增：hex + 位格 + tip + `?` 参考 |
| `apps/web/src/InfomaskBitStrip.test.ts` | Vitest：hex 约定 + decode set 契约 |
| `apps/web/src/StructureMap.tsx` | 两位字段改接组件；ItemId 不动 |
| `apps/web/src/styles.css` | 位格条 / tip / 参考面板样式 |
| `docs/features/infomask-detail/dev-notes.md` | 本文件 |
| `docs/features/infomask-detail/spec.md` / `plan.md` | 随分支入库（既有 approved；本角色未改合同） |
| `README.md` | N/A（未描述旧 ○/● 清单） |
| `packages/page-core/**` | 无业务变更 |
| `apps/server/**` | 无业务变更 |

## 验证证据

| 命令 / 检查 | 结果 |
|---|---|
| `pnpm test` | Pass（page-core 31 + server 4） |
| `pnpm --filter web test` | Pass（9 tests：hexLayout 6 + InfomaskBitStrip 3） |
| `pnpm -r typecheck` | Pass |
| `pnpm -r build` | Pass |
| `git diff -- packages/page-core apps/server`（业务） | 空 |
| `pnpm test:integration` | 未跑（可选；本项无 API 变更） |

**达到验证层:** L2（`pnpm test` + web test + typecheck/build）。定向浏览器手测见下。

## 未验证项

| 未验证项 | 原因 | 风险 | 恢复条件 | 复测范围 |
|---|---|---|---|---|
| Plan 手测清单 1–8（浏览器：位格条/hover·Tab/`?`/零已置/ItemId/light·dark/垂直高度） | 本会话无自动化浏览器；未对实库 UI 点按 | 中：交互与主题对比依赖 DOM | QA/`dev:server`+`dev:web` 按 Spec GWT 与 Plan 手测清单 | P0-1..P0-8、P1-1、P1-2 |

## 文档影响

- 开发: 本 `dev-notes.md`
- 用户: N/A
- 运维: N/A

## 建议复测（QA）

1. 选中 NORMAL tuple：两位为 hex + 位格条，无默认纵向 ○/● 全列表
2. hex 与 header/`valueText` 一致；置位高亮 = `decode*`
3. hover 与 Tab 聚焦：均见 `name`/`meaning`
4. `?` 打开全量参考（置位可辨）可关；主区仍紧凑
5. `t_infomask==0`：仍 hex+位格、无置位高亮；`t_infomask2` 的 `HEAP_NATTS` 按解码高亮
6. ItemId：仍 ○/● 纵向清单
7. Theme light/dark 可读
8. 默认高度显著短于改版前清单

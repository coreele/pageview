# Dev notes: page-diagram-32b

工作项标识: page-diagram-32b（未拆分）  
源分支: `page-diagram-32b` → 目标 `main`  
日期: 2026-07-26

## 任务完成度

| 任务 | 状态 | 证据 |
|---|---|---|
| T1 分支与基线 | 完成 | 自 `main` 创建并检出 `page-diagram-32b`；`pnpm -r typecheck` / `build` 通过 |
| T2 page-core 派生 | 完成 | `deriveStructureFields` / `resolveFieldAt` / `splitFieldIntoRowSegments`；Vitest 9 例 |
| T3 Hex 32B | 完成 | `HexDump` 使用 `STRUCTURE_BYTES_PER_ROW=32`；偏移 `padStart(4,"0")` |
| T4 结构图 Grid | 完成 | `StructureMap` DOM+CSS Grid；低偏移在上；字段边界/标签 |
| T5 Free 折叠 | 完成 | `freeCollapsed` + `FreeSpaceBand`；折叠为紧凑断裂带，不铺空 32B 行 |
| T6 双向联动 | 完成 | App `selectedId`+`highlight`；`findStructureAt`→`resolveFieldAt`；diff 含字段 id |
| T7 窄标签/跨行 | 完成 | `title`/`fullLabel`；跨行多片段同 `field.id` 选中 |
| T8 P1-3 / 基线 | 完成 | **P1-3 未纳入（N/A，Q4）**；基线详情区 flag/列/HOT/ctid/diff/主题保留 |
| T9 文档 | 完成 | README 更新 32B 说明；本文 |

## 变更路径

- `packages/page-core/src/structure-fields.ts`（新）、`index.ts`、`tests/structure-fields.test.ts`
- `apps/web/src/StructureMap.tsx`、`HexDump.tsx`、`App.tsx`、`diff.ts`、`styles.css`
- `README.md`

未改：`apps/server/**`、`parsePage` 语义、API。

## 验证

| 命令 | 结果 |
|---|---|
| `pnpm --filter page-core test` | Pass（19 tests） |
| `pnpm -r typecheck` | Pass |
| `pnpm -r build` | Pass |
| `pnpm test:integration` | Pass（`L3 smoke OK: public.qa_cross blk 0 length=8192`） |
| UI 手测（结构图↔hex↔折叠） | 见下「缺口」 |

## 偏离与裁决落实

- ItemId：视觉 `off|flag|len` 三分；选中/`ByteRange` 为整 4B slot（Design）。
- P1-3 infomask 图注：**未实现**（默认 N/A）。
- 无后端/API 变更需求。

## 缺口 / 阻塞

| 项 | 原因 | 风险 | 恢复条件 | 复测范围 |
|---|---|---|---|---|
| UI 手测 P0-1..P0-8 | 本会话未在浏览器逐项点选验收 | 交互细节（折叠键盘、跨行高亮观感）待人工确认 | `pnpm dev:server` + `pnpm dev:web`，加载 8KB 页后按 ui-design 清单手测 | P0-1..P0-8、P1-1/P1-2 |

## 建议 Reviewer 关注

- 跨行字段选中与 hex 整段 `highlight` 是否始终同源。
- Free 折叠后邻接 ItemId/tuple 的 hex 区间是否不错位。
- ItemId 视觉三分 vs 4B 选中合同。
- 256×32 hex DOM 性能（已知风险，未做虚拟化）。

## 建议复测范围（QA）

P0-1..P0-9、P1-1、P1-2；P1-3 N/A；基线 flag/列解码/HOT/ctid/Refresh diff/主题/非 8KB 错误。

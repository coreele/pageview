# Dev notes: page-diagram-32b

工作项标识: page-diagram-32b（未拆分）  
源分支: `page-diagram-32b` → 目标 `main`  
日期: 2026-07-26（含增量 T10–T15）

## 任务完成度

| 任务 | 状态 | 证据 |
|---|---|---|
| T1–T9 | 完成 | 见首轮；P1-3 N/A |
| T10 收编未提交视觉改动 | 完成 | 纳入 StructureMap/HexDump/styles/`structure-fields` 标签缩写；冲突项已规整（见下）；commit `888b19b` |
| T11 `valueText` | 完成 | `StructureField.valueText?`；Vitest 锁格式与「无 valueText」集合 |
| T12 格内值模式 | 完成 | `cellCapacityChars`/`chooseCellContent` + 探针/`ResizeObserver`；跨行仅最宽片段渲染值 |
| T13 详情同源 | 完成 | Selection detail 显示同一 `valueText`；web 无第二处主值格式化 |
| T14 hex 定位 + Q7 | 完成 | `computeHexScrollTarget`；`selectByteRange(..., origin)`；`hexLocate.nonce`；折叠先展开再挂载定位；`locateHandledNonceRef` 防手动再展开重滚 |
| T15 验证与文档 | 完成 | 命令结果见下；增量手测见缺口 |

## T10 收编结论

- **来源**：治理流程外视觉优化（Manager 未提交未回退）。
- **纳入**：hex 单元改为 `<button class=hex-cell>` + 32 列网格；结构图图例/分节；`abbreviateLabel`；区域色/栅格 CSS；header 短标签（`lower`/`upper`/`psz/ver` + `fullLabel`）。
- **规整**：Free 断裂带文案恢复 Q5 要求的 `free space` + `[start,end)` + `bytes`；折叠按钮恢复 `Expand/Collapse free space`。
- **偏离**：无合同偏离。标签模式格仍可用 ellipsis；值模式禁止省略主值（T12 CSS）。
- **影响**：不改 32B 映射、`parsePage` 语义、键盘可达。

## P0-10..P0-12 / Q7 落实

| 条款 | 落实 |
|---|---|
| P0-10 | `valueText` + `chooseCellContent`；宽格完整值，不足回退标签；无截断主值 |
| P0-11 | 格与详情同读 `valueText` |
| P0-12 | 非 hex 且区间变化 → `nonce++` → hex `scrollTo`；近顶 1/3；已可见不滚 |
| Q7 | `hexCollapsed` 时同次处理展开；HexDump 挂载后 effect 定位（无 setTimeout 猜时序） |

## 变更路径

- `packages/page-core/src/structure-fields.ts`、`index.ts`、`tests/structure-fields.test.ts`
- `apps/web/src/StructureMap.tsx`、`HexDump.tsx`、`App.tsx`、`styles.css`
- `README.md`；本文
- Feature docs（Planner 增量）：`design.md` / `plan.md` / `spec.md` / `ui-design.md`（语义未由 Developer 改写）

未改：`apps/server/**`、`parsePage`/`decodePageTuples` 语义、manager 状态卡。

## 验证

| 命令 | 结果 |
|---|---|
| `pnpm --filter page-core test` | Pass（29 tests） |
| `pnpm --filter page-core build && pnpm -r typecheck` | Pass（web 依赖 page-core `dist` types） |
| `pnpm -r build` | Pass |
| `pnpm test:integration` | Pass（实库冒烟；见当次运行日志） |
| 增量手测清单 1–7 | **未完成**（见缺口） |

## 缺口 / 阻塞

| 项 | 原因 | 风险 | 恢复条件 | 复测范围 |
|---|---|---|---|---|
| 增量手测 1–7（值模式/详情一致/回退/定位/不抢滚/键盘/主题） | 本会话未在浏览器逐项点选；dev:web 曾无 server | P0-10/P0-12/Q7 布局与滚动仅有纯函数证据 | `pnpm dev:server` + `pnpm dev:web`，加载 8KB 页后按 plan 增量手测清单 | 清单 1–7 + 首轮 P0-1..P0-8 / P1-1/P1-2 |
| 首轮 UI 手测 | 沿用 | 交互观感待人工确认 | 同上 | P0-1..P0-8、P1-1/P1-2 |

## 建议 Reviewer 关注

- web 是否仅从 `valueText` 取主值（无第二格式化点）。
- 值模式是否出现 ellipsis/截断主值；跨行是否只渲染一次值。
- `selectByteRange` origin=`hex` 不 locate；nonce 防重复滚；禁止 `scrollIntoView`。
- Q7：折叠点击页尾字段 → 展开后定位，无 setTimeout 编排。
- Free Q5 文案与键盘；ItemId 三分值 vs 整 4B 选中。

## 建议复测范围（QA）

P0-1..P0-12、P1-1/P1-2、Q7；P1-3 N/A；基线 flag/列/HOT/ctid/Refresh diff/主题/非 8KB。

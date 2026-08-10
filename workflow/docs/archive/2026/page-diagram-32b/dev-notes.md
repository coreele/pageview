# Dev notes: page-diagram-32b

工作项标识: page-diagram-32b（未拆分）  
源分支: `page-diagram-32b` → 目标 `main`  
日期: 2026-07-26（含增量 T10–T15；DEF-001 修复）

## 任务完成度

| 任务 | 状态 | 证据 |
|---|---|---|
| T1–T9 | 完成 | 见首轮；P1-3 N/A |
| T10 收编未提交视觉改动 | 完成 | 纳入 StructureMap/HexDump/styles/`structure-fields` 标签缩写；冲突项已规整（见下）；commit `888b19b` |
| T11 `valueText` | 完成 | `StructureField.valueText?`；Vitest 锁格式与「无 valueText」集合 |
| T12 格内值模式 | 完成 | `cellCapacityChars`/`chooseCellContent` + 探针/`ResizeObserver`；跨行仅最宽片段渲染值 |
| T13 详情同源 | 完成 | Selection detail 显示同一 `valueText`；web 无第二处主值格式化 |
| T14 hex 定位 + Q7 | 完成 | `computeHexScrollTarget`；`selectByteRange(..., origin)`；`hexLocate.nonce`；折叠先展开再挂载定位；`locateHandledNonceRef` 防手动再展开重滚 |
| T15 验证与文档 | 完成 | 命令结果见下；增量手测 4–5 / Q7 已在 DEF-001 修复中补齐 |
| DEF-001 | fixed（待 QA 关闭） | 见「缺陷修复回执」 |

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
| P0-12 | 非 hex 且区间变化 → `nonce++` → hex `scrollTo`；近顶 1/3；已可见不滚；行 Y = `paddingTop + row * (rowHeight + rowGap)` |
| Q7 | `hexCollapsed` 时同次处理展开；HexDump 挂载后 effect 定位（无 setTimeout 猜时序） |

## 缺陷修复回执：DEF-001

| 项 | 内容 |
|---|---|
| ID | DEF-001（High） |
| 合同 | P0-12 / 手测 4；Q7 展开后定位 |
| 根因 | `.hex` 的 CSS `gap`/`padding` 未计入滚动几何；`firstRow * rowHeightPx` 目标偏小，页尾行误差可超过容器高度 |
| 处理结果 | **fixed**（开发者侧）；状态关闭待 QA 回归 |
| 改动 | `computeHexScrollTarget` 增加可选 `rowGapPx`/`paddingTopPx`（默认 0）；`HexDump` 度量首行 inset 与相邻行 gap 后传入；Vitest 两例锁定有 gap 场景 |
| 验证证据 | page-core test Pass（31）；typecheck/build Pass；Playwright reduced-motion：`rowVisible=true`，`scrollTop` 对齐 gap 公式（`deltaExpected=0`，相对 naive `deltaNaive≈109`）；手测 5 同区间/手动/hex origin 不抢滚；Q7 折叠→展开→定位 Pass |
| 建议复测 | P0-12、Q7、手测 4–5（高偏移首字节行入可视区；同区间/hex 不抢滚；折叠自动展开后再定位） |

未改：`scrollIntoView`、setTimeout 猜展开时序、Spec/Plan/Design 合同正文、`workflow/docs/manager/**`。

## 变更路径

- `packages/page-core/src/structure-fields.ts`、`tests/structure-fields.test.ts`
- `apps/web/src/HexDump.tsx`
- 本文；既有增量路径见上轮（StructureMap/App/styles/README 等）

未改：`apps/server/**`、`parsePage`/`decodePageTuples` 语义、manager 状态卡、`review.md`/`qa-report.md`（Manager 关闭窗口）。

## 验证

| 命令 / 手测 | 结果 |
|---|---|
| `pnpm --filter page-core test` | Pass（31；含 DEF-001 回归 2） |
| `pnpm --filter page-core build && pnpm -r typecheck` | Pass |
| `pnpm -r build` | Pass |
| 手测 4 / P0-12（高偏移入可视区） | Pass（Playwright reduced-motion；末行夹取至 `maxScroll`，`fromTopRatio≈0.90` 仍 `rowVisible`） |
| 手测 5（同区间 / 手动滚 / hex origin 不抢滚） | Pass |
| Q7（折叠→自动展开→定位） | Pass（与手测 4 同路径） |

## 缺口 / 阻塞

| 项 | 原因 | 风险 | 恢复条件 | 复测范围 |
|---|---|---|---|---|
| DEF-001 待 QA 正式关闭 | 开发者已修并自测；需 Review 复审 + QA 回归 | 无已知残缺 | Review Approve → QA 回归 P0-12/Q7/手测 4–5 | 见回执 |
| 增量手测 1–3 / 6–7 与首轮全量 UI | 本轮仅补 DEF-001 相关手测 | 低（QA 首轮已 Pass 这些项） | QA 回归时可抽查 | 清单其余项 |

## 建议 Reviewer 关注

- `rowGapPx`/`paddingTopPx` 是否与 `.hex` flex 布局一致；页尾行夹取后仍保证首字节行可见。
- HexDump 仅 `scrollTo` 自身容器；无 `scrollIntoView`；无 setTimeout 猜展开。
- nonce / origin=`hex` 不抢滚合同未回退。
- 回归用例能否在去掉 gap 参数时失败（TDD 有效）。

## 建议复测范围（QA）

优先：P0-12、Q7、手测 4–5。其余合同首轮已 Pass，按需抽查。

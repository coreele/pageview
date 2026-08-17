# Review: pd-flags-tuple-view

> Reviewer 报告。结论：**Approve**（无阻塞项；非阻塞 Comment C1–C3）。日期：2026-08-17。

## 审阅范围

- 实现 diff（源分支 `pd-flags-tuple-view` 相对 `main`，11 文件：page-core 4 + web 6 + README 1）
- `workflow/docs/features/pd-flags-tuple-view/spec.md`、`plan.md`、`dev-notes.md`

## 结论与检查项（quality.md §3）

### 1. 测试有效性 — 通过

| 检查 | 证据 |
|---|---|
| pd_flags 解码（P0-1） | `parse.test.ts`：0x0（全未置、无 UNKNOWN）、0x4（单置位+未置项 false）、0x5（混合置位集合）、0x14（残余位→`PD_FLAGS_UNKNOWN` set）；位序、掩码边界覆盖充分 |
| 列折叠不变量（P0-3/4/5） | `structure-fields.test.ts`：列 `end`=解码值、视觉 `start ≤` 解码 start、所有列区间 ≥ `dataRange.start`、**相邻列两两不重叠**（本修复核心不变量，Review 前由 Developer 补入并验证）、无 `.data` 前缀字段；fixture 含 HOT/redirect/null 列场景 |
| 单 lane（P0-6） | `structureLayout.test.ts`：空输入 `[[]]` 约定、单 tuple 原样、跨 tuple（行尾+行首）与 itemid 混排按 `colStart` 排序 |
| 回归 | header/ItemId/tuple header 精确 byte range 断言未动；`parsePage` 语义不突变测试保留；全仓 82 tests 全绿 |
| 位带组件（P0-2 部分） | `formatInfomaskHex("pd_flags", 0x4)` 有测；渲染接线靠 typecheck + 代码审阅（见 C1） |

### 2. 文档影响 — 通过

与 Plan「文档影响」一致：README Features 行补充 `pd_flags` bit strip（一行，准确）；`dev-notes.md` 已产出（含验证证据、手测缺口记录）；运维文档 N/A 正确。

### 3. 安全影响 — 不触发

纯前端展示 + page-core 纯函数；无新输入面、认证、凭据或依赖变更；`pd_flags` 为 16 位页头值，位运算无溢出/注入面。未触发 security.md 审阅条件。

## 实现质量核查

- `groupSegmentsIntoLanes` 恒单 lane 排序键 `(colStart, colEnd, field.id)` 确定性稳定；`[0]!` 非空断言安全（空输入返回 `[[]]`，`[0]` 为 `[]`）。
- 单行渲染结构性正确：单 lane 数组 + 单一 grid 容器 + `.field-cell { grid-row: 1 }`——原「第二行 data」由多容器纵向堆叠产生，现结构下 CSS grid 不可能产生第二行（P0-7 数学保证）。
- 列视觉区间由 `cursor` 单调推进，跨 tuple 段经 `splitFieldIntoRowSegments` 按行切割，行内区间天然不交叉；与 hex 侧（`splitFieldIntoRowSegments` 同源）高亮一致。
- `FlagBitStripSolo` 复用 `InfomaskBitStrip` 内部组件与既有 light/dark 样式类，无另造位定义表（合同合规）；`aria-live`、`role="region"`、可关闭按钮保留。
- 禁止面核查：`apps/server/**`、`parse.ts`、`decode.ts` 零 diff；`.structure-row-lane*` 无残留引用。
- `package-lock.json`（误生成 npm 空锁）已移除，符合 pnpm 工程。

## 非阻塞 Comment

| ID | 内容 | 建议 |
|---|---|---|
| C1 | `FlagBitStripSolo` 无组件渲染测试（与既有 `InfomaskBitPair` 基线一致） | 后续可引入 web 组件渲染测试时统一补 |
| C2 | P0-2/P0-7/P1-2 的浏览器目视证据缺口已在 dev-notes 按 quality.md §6 记录（CLI 会话无浏览器；风险低、恢复条件明确） | 合入后按 Plan 手测清单 1–5 复核 |
| C3 | free-break 分支渲染路径未改（原多段 map 结构），非本项范围 | N/A |

## 结论

**Approve**。Review 门禁（required）已满足，可进入 QA。

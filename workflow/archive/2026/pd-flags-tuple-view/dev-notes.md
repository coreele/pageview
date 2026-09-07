# Dev Notes: pd-flags-tuple-view

> Developer 记录：实现核对、验证证据、偏离与限制。状态维护见 STATUS / manager 记录。

## 实现概况

本工作项为**补齐型**：实现由用户预先完成于工作区（10 文件），Developer 对照 Spec/Plan 核对并补验证。未重写用户实现；除 README 一行外无新增代码改动。

### 核对结果（T2–T5）

| 任务 | 核对结论 |
|---|---|
| T2 pd_flags 解码 | `flags.ts` 新增 `decodePdFlags` + 4 常量；位序（0x1/0x2/0x4）+ 残余位聚合 `PD_FLAGS_UNKNOWN`（含 hex 文案、`set: true`）符合 Spec P0-1；`index.ts` 导出齐全。单测覆盖 0x0/0x4/0x5/0x14（parse.test.ts 11 用例含新增） |
| T3 位带组件 | `FlagBitStripSolo` 复用 `InfomaskBitStrip` 内部组件（hex/位格/hover/`?`/Close 同一实现，合同与 infomask-detail 一致）；`StructureMap.tsx` 在 `selectedField?.id === "header.pd_flags"` 时渲染；`formatInfomaskHex("pd_flags", 0x4)` 有测试 |
| T4 列折叠 | `structure-fields.ts`：列按 offset 升序；`visualStart = min(col.start, max(prevEnd, dataRange.start))` 前伸吸收 padding；`end` 保持解码值；`data-gap-*` 生成路径整体移除；仅无有效列且 dataRange 非空时保留整体 `data`。tuple header 字段（t_xmin…t_hoff/nullbitmap）未动。断言含 P0-3（无 `.data` 前缀字段）与 end 保持/start ≤ 解码 start |
| T5 单 lane | `groupSegmentsIntoLanes` 恒单 lane，排序键 `(colStart, colEnd, field.id)`，空输入 `[[]]` 约定保留；`StructureMap.tsx` 取 `lanes[0]` 渲染于单一 grid 容器；`.field-cell { grid-row: 1 }` 强制同行；`.structure-row-lanes`/`.structure-row-lane` 删除且无残留引用（grep 核查 NO-RESIDUE）；跨 tuple 段与 itemid 混排排序有单测 |
| T6 禁止面 | `git diff main --stat`：`apps/server/**`、`packages/page-core/src/parse.ts`、`decode.ts` 零 diff；`parsePage`/列解码语义未动 |

### 偏离与说明

- 无实现偏离 Spec。Spec P0-4 中「首列视觉起点 ≥ dataRange.start」由 `Math.max(cursor, t.dataRange.start)` 保证（cursor 初值即 dataRange.start）。
- `package-lock.json`（误生成的空 npm 锁，项目用 pnpm@9）已在登记阶段删除，不入库。
- README Features 第 15 行补 `pd_flags` bit strip 提示（一行，用户文档影响）。

## 验证证据（2026-08-17）

| 命令 | 结果 |
|---|---|
| `pnpm test` | 全绿：page-core 32 / web 20 / server 17 / wal-core 13 = **82 tests passed** |
| 补强测试（Review 前自查） | `decodePdFlags(0x0)` 全未置断言；列视觉区间 ≥ dataRange.start 且相邻两两不重叠断言——page-core 32 用例重跑全绿，typecheck 零错误 |
| `pnpm -r typecheck` | 四包零错误 |
| `pnpm -r build` | 全部成功（web 产物 251 kB js / 27 kB css） |
| 残留引用核查 | `grep structure-row-lane` → 无匹配 |
| 禁止面核查 | server / parse.ts / decode.ts 无 diff |

环境：node v24.19.0（nvm）、pnpm 9.15.0（corepack）。

## 手测缺口（按 quality.md §6 记录）

- **原因**：当前为 CLI 会话，无浏览器/GUI 环境。
- **涉及项**：P0-2（pd_flags 位带视觉）、P0-7（单行渲染无第二行 data）、P1-2（light/dark 可读性）的浏览器目视部分。
- **风险评估**：低。P0-7 的结构性证据充分（单 lane 数组 + 单一 grid 容器 + `grid-row: 1`，CSS grid 内数学上不可能出现第二行；原第二行正是多容器堆叠所致）；P0-2 复用已被 infomask-detail 验证过的同一内部组件，接线条件为单一等值判断且有 typecheck 保障；位带样式类全部复用既有 light/dark 合同。
- **恢复条件**：用户在浏览器中按 Plan 手测清单 1–5 复核（合入后日常使用即覆盖）。

## 建议 QA 复测范围

- 复跑 L2（`pnpm test` / typecheck / build）作为独立证据；
- 代码级核对 P0-2/P0-7 接线与样式（QA 会话同样无浏览器）；
- 回归：infomask 位带、ItemId flags、hex 联动相关既有用例包含于 `pnpm test`。

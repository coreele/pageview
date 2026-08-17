# QA Report: pd-flags-tuple-view

> QA 独立验收报告。依据：`spec.md`（7×P0 + 2×P1）+ `plan.md` 验证计划。结论：**Pass**。

## 第 1 轮（2026-08-17，首次验收）

### 独立复测（QA 会话自行执行，非转述）

| 检查 | 命令 | 结果 |
|---|---|---|
| 全仓单测 | `pnpm test` | **82/82 全绿**（page-core 32、web 20、server 17、wal-core 13） |
| 类型检查 | `pnpm -r typecheck` | 四包零错误 |
| 构建 | `pnpm -r build` | 全部成功（web ✓ built） |
| 禁止面 | `git diff main --stat`（server/parse.ts/decode.ts） | 零 diff |
| 残留样式 | 检索 `structure-row-lane` | 无匹配 |

### Spec 验收逐项核对

| ID | 判定 | 证据 |
|---|---|---|
| P0-1 decodePdFlags 位解码 | **Pass** | `parse.test.ts` 0x0/0x4/0x5/0x14 独立复跑绿；位序/UNKNOWN 聚合与合同一致 |
| P0-2 pd_flags 选中位带 | **Pass**（代码级） | 接线 `selectedField?.id === "header.pd_flags"`（StructureMap.tsx）经代码核对；组件复用已验证的 `InfomaskBitStrip` 内部实现；`formatInfomaskHex("pd_flags",0x4)` 测试绿。浏览器目视未执行（见限制） |
| P0-3 移除重叠 data 字段 | **Pass** | `structure-fields.test.ts` 断言无 `.data` 前缀字段；独立复跑绿 |
| P0-4 padding 折叠进下一列 | **Pass** | 单测断言 end=解码值、start≤解码 start、≥dataRange.start、相邻两两不重叠；独立复跑绿 |
| P0-5 无列 tuple 保留整体 data | **Pass** | 实现分支 `else if (dataRange 非空)` 代码核对 + 既有 data 字段用例 |
| P0-6 单 lane 排序 | **Pass** | `structureLayout.test.ts` 跨 tuple/itemid 混排排序断言绿 |
| P0-7 单行渲染无第二行 data | **Pass**（结构性） | 单 lane + 单一 grid 容器 + `grid-row: 1` + 多 lane 样式删除无残留——CSS grid 结构上不可能产生第二行（原第二行源于多容器堆叠）。浏览器目视未执行（见限制） |
| P1-1 回归不回退 | **Pass** | header/ItemId/tuple header 精确 range 断言、parsePage 不突变、infomask/ItemId 用例全数通过；`pnpm test` 82/82 |
| P1-2 主题可读 | **Pass**（结构性） | 位带复用既有 infomask 样式类（light/dark 合同已验证）；无新增颜色/主题键。目视未执行（见限制） |

### 已记录的验证限制（非缺陷）

- **浏览器目视未执行**：CLI 会话无浏览器。涉及 P0-2/P0-7/P1-2 的目视部分。
- 依据 quality.md §6 已在 `dev-notes.md`（手测缺口节）与 `review.md`（C2）完整记录原因、风险评估（低：结构性/同源组件证据）与恢复条件（用户按 Plan 手测清单 1–5 于浏览器复核）。**非静默跳过**。

### Plan 验证要求核对

- 最低验证层 L2（单测/typecheck/build）：**达成**（QA 独立复跑）。
- 定向浏览器手测：**受环境限制**，已按规范记录（见上）。
- 文档影响：README 已更新（QA 核对 Features 行与新行为一致）；dev-notes 已产出；运维 N/A。

### 回归与抽查

- 回归范围：全仓单测 + header/ItemId/infomask/hex 布局既有用例——通过。
- 非目标抽查：`apps/server`、`parse.ts`、`decode.ts` 无 diff；未改解析语义；无新增依赖。

## 结论

**Pass**。质量门禁（Review Approve + QA Pass）满足；用户已在登记时预先授权合并（条件已满足：Review Approve、QA Pass、无阻塞项）。待 Manager 持久化 `done` 并一次提交后合入 `main`。

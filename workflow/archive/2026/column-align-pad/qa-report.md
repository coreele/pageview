# QA Report: column-align-pad

> QA 独立验收。依据：`spec.md`（7×P0 + 3×P1，确认留空/含列尾/无 pad 图例）+ `plan.md`。结论：**Pass**。

## 轮次

| 轮次 | 日期 | 范围 | 结论 |
|---|---|---|---|
| 1 | 2026-09-01 | 首测 | Pass |

## 第 1 轮（2026-09-01）

实现版本：源分支 `column-align-pad` 工作区（相对 `main` 未 commit）。环境：node v24.19.0、pnpm 9.15.0。

### 独立复测（本会话执行，非转述）

| 检查 | 命令 | 结果 |
|---|---|---|
| 全仓单测 | `pnpm test` | **202 passed**（page-core 58、web 100、server 31、wal-core 13） |
| 类型检查 | `pnpm -r typecheck` | 四包零错误 |
| 构建 | `pnpm -r build` | 成功（web vite built） |
| 禁止面 | `git diff main --` parse.ts/decode.ts/`apps/server` | 空 |
| 残留 | `visualStart` / `data-gap` / `structure-row-lane`（src） | 无匹配 |
| 活库 oracle | `get_raw_page('public.items',0)` → `decodePageTuples` + `deriveStructureFields` | banana/apple/cherry/`''` 的 **price 解码=4B 且结构格=4B**；列间/列尾空洞不命中 `col-*`；无 `pad-*`/`.data*` |

### Spec 验收逐项

| ID | 判定 | 证据 |
|---|---|---|
| P0-1 列 range=解码 | **Pass** | `structure-fields.test.ts` 独立绿；活库每列 drawn range 与 `columns[].range` 全等 |
| P0-2 price 同宽 4B | **Pass** | 活库 apple vs banana（name 5 vs 6 字符）priceDrawn 均为 4B；单测两行 span=4 |
| P0-3 空洞无字段 | **Pass** | 活库扫描列间/列尾空洞；单测无 `pad-*`/`.data*` |
| P0-4 选中列不含空洞 | **Pass**（代码级） | 选中使用字段 `range`（已=解码）；未跑浏览器点选 |
| P0-5 空洞不命中列 | **Pass** | 活库 `resolveFieldAt(空洞)` 不命中该 tuple `col-*`；`diff.test.ts` `findStructureAt` null。Hex 未映射走 `byte-N`（App.tsx 代码核对） |
| P0-6 无重叠 data、单 lane | **Pass** | 有列无 `.data*`；`structureLayout.test.ts` 6 例含于 `pnpm test`；`.field-cell { grid-row: 1 }` 仍在 |
| P0-7 无列整体 data | **Pass** | 单测无 `columns` → 整体 `data` |
| P1-1 NULL 不吞空洞 | **Pass** | 单测；活库 lp[4] name/price NULL，未把空洞并入 id 之外的列格 |
| P1-2 空洞观感 | **Pass**（结构性） | 空洞无字段、非 free 带（free 仍 pd_lower..upper）。浏览器底色目视未做（见限制） |
| P1-3 回归 | **Pass** | 全仓 202 绿；图例无 `pad` chip |

### 已记录的验证限制（非缺陷）

- **浏览器目视未执行**（CLI，无 GUI）：Plan 手测清单 1–6 的观感部分、P0-4 点击、P1-2 底色。
- 原因 / 风险 / 恢复：quality.md §6；风险低于纯单测——活库 oracle 已覆盖 `public.items` blk 0 的 range 合同。恢复：浏览器加载该页按 Plan 清单复核。**非静默跳过**。

### Plan 验证层

- L2 单测/typecheck/build：**达成**（QA 复跑）。
- 定向手测：活库 oracle **达成** range/空洞命中；浏览器观感按上节记录。
- 文档：README 无折叠表述（已核）；`dev-notes.md` 存在；运维 N/A。
- Review **Approve** 已存在。

### 回归与抽查

- 回归：header/ItemId/infomask/btree/hex 既有用例含于 `pnpm test`。
- 抽查：parse/decode/server 无 diff；图例四色无 `pad`；未新增依赖。

### UI/UX

`UI 表面=gui`；无 `ui-design.md`（Design skipped）。

| 检查项 | 结果 | 证据 |
|---|---|---|
| Spec 界面相关验收 | Pass（行为） | P0-1…P0-5、P0-2 活库 |
| `ui.md` 底线 | Pass | 未恢复多 lane/重叠 data |
| `ui-design.md` | N/A | 未要求 |
| 主题/深色 | N/A | Spec 未要求新主题 |

### 安全

不触发 security.md §2。无敏感信息、无新输入面。允许在授权后合并（就安全而言）。

## 缺陷

无。

## 结论

- 总体: **Pass**
- 恢复条件: N/A
- 合并: **待用户授权**（质量门禁已满足：Plan 确认 + Review Approve + QA Pass）。授权后由 Manager 在源分支置 `done` 并与未入库 `review.md`/`qa-report.md` 一次提交，再合入 `main`。实现目前尚未 commit（Review C3）。

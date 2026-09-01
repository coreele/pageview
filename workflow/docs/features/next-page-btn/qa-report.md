# QA Report: next-page-btn

> QA 独立验收。依据：`spec.md`（8×P0 + 4×P1）+ `plan.md`。结论：**Pass**。

## 轮次

| 轮次 | 日期 | 范围 | 结论 |
|---|---|---|---|
| 1 | 2026-09-01 | 首测 | Pass |

## 第 1 轮（2026-09-01）

实现版本：源分支 `next-page-btn` 工作区（相对 `main` 未 commit）。环境：node v24.19.0、pnpm 9.15.0。活库：`public.items` relpages=1；`public.tb_pkey` / `public.test_prune_pkey` 各 2 块（meta+leaf，兄弟均为 P_NONE）。

### 独立复测（本会话执行，非转述）

| 检查 | 命令 / 做法 | 结果 |
|---|---|---|
| 全仓单测 | `pnpm test` | **214 passed**（page-core 58、web 112 含 pageToolbarNav 12、server 31、wal-core 13） |
| 类型检查 | `pnpm -r typecheck` | 四包零错误 |
| 构建 | `pnpm -r build` | 成功（web vite built） |
| 禁止面 | `git diff main --` apps/server、page-core、`blockNav.ts`、`HeapPeekOverlay.tsx` | 空 |
| JSX 顺序 | `App.tsx` 两处 Refresh 后 `PageToolbarNavButtons` | table + index 均有 Prev→Next |
| 非 refresh | `onGo` → `loadBlk(oid, target)` / `loadIndexBlk(oid, target)` **无** `{ refresh: true }` | 仅 Refresh 按钮传 refresh |
| 堆叠 CSS | `.meta-controls-row--stack { flex-direction: column }` 仅 Page 次带 | WAL 行无该 class |
| 活库边界 | `items` relpages=1 → `heapPageNav(0,1)` 双禁；btree meta/leaf `btpo_prev=btpo_next=0` | 与 P0-4/P0-6 一致 |
| 详情兄弟钮 | `StructureMap.tsx` 仍有 `Load blk N →` / `← Load blk` | 未删 |

catalog 中的 browser MCP 本会话 **无可用 tool schema**（`browser_*` 0 匹配），未能 `pnpm dev:web` 点击。按 quality.md §6 记录，不静默跳过。

### Spec 验收逐项

| ID | 判定 | 证据 |
|---|---|---|
| P0-1 两处按钮 | **Pass**（代码级） | table/index 工具栏 Refresh 后均渲染 Prev、Next。未点 GUI |
| P0-2 未加载禁用 | **Pass** | `toolbarNavEnabled` 无页/loading/oid null 为 false；按钮 `disabled={!enabled \|\| target==null}` |
| P0-3 heap ±1 | **Pass** | `heapPageNav(4,10)→{3,5}`；活库无 ≥3 块堆表，中间页点击未做（§6） |
| P0-4 heap 首页/末页 | **Pass** | 单测 0 / last / blocks≤1；活库 `items` 仅 1 块，Next 必禁 |
| P0-5 btree 兄弟 | **Pass** | fixture `btpoNext:9` 非 +1；活库索引叶均为 P_NONE，无非连续兄弟可点（§6） |
| P0-6 无兄弟禁用 | **Pass** | 单测 P_NONE/`null` special；活库 meta+唯一叶 `btpo_*=0` |
| P0-7 非 Refresh | **Pass**（代码级） | Prev/Next 不传 `refresh`；成功 Load 清 `diffIds`。未目视 diff 高亮 |
| P0-8 统计在下 | **Pass**（结构性） | Page 次带 column stack，stats 为 `chrome-controls` 的下一 flex 子项。宽屏目视未做 |
| P1-1 脏输入 | **Pass**（代码级） | 目标用 `loadedBlkno` 非输入 `blkno` |
| P1-2 详情钮 | **Pass** | `btree-nav-btn` 仍在；与 `siblingNav` 同源 |
| P1-3 title | **Pass** | 单测 first/last、leftmost/rightmost、`blk N` |
| P1-4 回归 | **Pass** | 全仓 214 绿；HeapPeek 注释仍无 Load/Refresh；WAL 无 Prev/Next |

### 已记录的验证限制（非缺陷）

- **浏览器点击/宽屏目视未执行**：Plan 手测 1–7、P0-1 观感、P0-7 diff、P0-8 并排、P0-3/P0-5 活库缺多样本。
- 原因：本会话 browser 工具不可调用。风险：布局与真实点击未在 GUI 复现。恢复：`pnpm dev:web` 按 Plan 清单；若需 P0-3/P0-5 活库，用 ≥3 块堆表或有非 P_NONE 兄弟的索引。**非静默跳过**。

### Plan 验证层

- L2 单测/typecheck/build：**达成**（QA 复跑）。
- 定向手测：逻辑+CSS+活库边界 **达成**；GUI 点击按上节。
- 文档：README 中英各有 Prev/Next；`dev-notes.md` 存在；运维 N/A。
- Review **Approve** 已存在。

### 回归与抽查

- 回归：Refresh 仍 `refresh: true`；详情 sibling 仍在；HeapPeek/WAL 无新钮；既有 web/server/page-core 测绿。
- 抽查：无新 HTTP 端点；无 deps diff；`blockNav.siblingNav` 语义未改。

### UI/UX

`UI 表面=gui`；无 `ui-design.md`（Design skipped）。

| 检查项 | 结果 | 证据 |
|---|---|---|
| Spec 界面相关验收 | Pass（行为） | P0-1…P0-8 上表 |
| `ui.md` 底线 | Pass | native `disabled`；非 primary；状态完整（未 Load 禁用） |
| `ui-design.md` | N/A | 未要求 |
| 主题/深色 | N/A | Spec 未要求新主题 |

### 安全

不触发 security.md §2。无新输入面/端点。允许在授权后合并（就安全而言）。

## 缺陷

无。

## 结论

- 总体: **Pass**
- 恢复条件: N/A
- 合并: **待用户授权**（质量门禁已满足：Plan 确认 + Review Approve + QA Pass）。授权后由 Manager 在源分支置 `done` 并与未入库 `review.md`/`qa-report.md` 一次提交，再合入 `main`。实现目前尚未 commit（Review C3）。

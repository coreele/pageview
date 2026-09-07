# Review: next-page-btn

> Reviewer 报告。结论：**Approve**（无阻塞项；非阻塞 C1–C3）。日期：2026-09-01。未提交本报告。

## 审阅范围

- 工作区相对 `main`（源分支 `next-page-btn`；实现尚未 commit；含未跟踪的 `pageToolbarNav.ts` / 测试 / 工作流文档）
- 业务 diff：`apps/web/src/App.tsx`、`styles.css`、`pageToolbarNav.ts`、`pageToolbarNav.test.ts`、`README.md`、`README.zh-CN.md`
- `spec.md`、`plan.md`、`dev-notes.md`
- 独立复跑：`pageToolbarNav.test.ts` 12 Pass；`blockNav.test.ts` 3 Pass
- 禁止面：`apps/server/**`、`packages/page-core/**`、`blockNav.ts`、`HeapPeekOverlay.tsx` 相对 `main` 零 diff

## 结论与检查项（quality.md §3）

### 1. 实现正确性 — 通过

- 两处工具栏 Refresh 后均为 `PageToolbarNavButtons`（Prev → Next）；WAL / HeapPeek 无这两钮。
- Heap 目标来自 `loadedBlkno` + `heapPageNav`，不是输入框 `blkno`（P1-1 接线存在）。
- B-tree 目标 `btreePageNav` → 既有 `siblingNav`；无 special 则两目标 `null`。
- 点击：`loadBlk` / `loadIndexBlk` **不传** `{ refresh: true }`（P0-7）。
- `disabled={!enabled || target == null}` + onClick 再守卫；`toolbarNavEnabled` 与 Refresh 同条件（有页、非 loading-page、oid 非空）。
- 详情区 `btree-nav-btn` 仍在 `StructureMap.tsx`（P1-2）。
- Page 次带 `meta-controls-row--stack`：`flex-direction: column` + `align-items: stretch`；WAL 行无此 class。

### 2. 测试有效性 — 通过

| 检查 | 证据 |
|---|---|
| P0-3/4 | `heapPageNav` 中间 ±1、0 禁用 prev、last 禁用 next、blocks≤1 双禁 |
| P0-5/6 | fixture `btpoNext: 9` 非 +1；P_NONE 与 `null`/`undefined` special 双禁 |
| P0-2 | `toolbarNavEnabled` 无页 / loading / oid null |
| P1-3 | title：`blk N` / first-last / leftmost-rightmost |
| 能因错误失败 | TDD 先因缺模块红；btree 用例会因 ±1 实现失败 |
| `siblingNav` | 既有 3 例仍绿 |

P0-1/7/8 与 P1-1 接线无组件测，见 C1/C2。

### 3. 文档影响 — 通过

与 Plan 一致：`dev-notes.md`（验证数字、§6）；README 中英 Page 节各一句 Prev/Next；运维 N/A。

### 4. 安全影响 — 不触发

无新端点；翻页走既有 pages API。无新认证/文件/依赖/敏感数据。未触发 security.md §2。

### 5. Git 合规

源分支 `next-page-btn`，不在 `main` 上实施。diff 无 `.env`/凭据。尚未 commit（C3），不阻塞 QA 读工作区。

## UI/UX 核对

`UI 表面=gui`；Design skipped，无 `ui-design.md`。

| 检查项 | 结果 | 备注 |
|---|---|---|
| 对照 Spec 界面验收 | 通过（代码/单测） | 顺序、禁用、title、非 refresh。宽屏堆叠见 C2 |
| 对照 `workflow/agents/standards/ui.md` | 通过 | native disabled；非 primary；未新主题 |
| 对照 `ui-design.md` | N/A | Design skipped |
| 主题/深色 | N/A | Spec 未要求新主题 |

## 文档影响核对

| Plan 声明 | 实现是否一致 | 备注 |
|---|---|---|
| 开发文档 | 是 | `dev-notes.md` |
| 用户文档 | 是 | README 中英 |
| 运维文档 | 是 | N/A |

## 安全影响核对

| 检查项 | 结果 | 备注 |
|---|---|---|
| 敏感信息 | 通过 | 无 |
| 认证与授权 | N/A | 未触及 |
| 输入与外部访问 | N/A | 复用既有 Load |
| 依赖变更 | N/A | 无 lock/deps diff |

## 非阻塞 Comment

| ID | 内容 | 建议 |
|---|---|---|
| C1 | 无 App 组件测覆盖「脏输入仍用 loadedBlkno」与「不传 refresh」 | QA 手测 P1-1、P0-7 |
| C2 | 浏览器手测（P0-1/7/8、Plan 清单 1–7）按 §6 记缺口 | QA 用 `pnpm dev:web` 补测 |
| C3 | 功能 diff 尚未 commit | 合入前在源分支提交；不阻塞本轮 QA |

## 必修项

无。

## 结论

**Approve**。Review 门禁已满足，可调度 QA。

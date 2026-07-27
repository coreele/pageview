# Review: hex-collapse

## 审阅范围与依据

| 项 | 内容 |
|---|---|
| 工作项 | `hex-collapse`（未拆分）· `standard` · Review **required** · UI `gui` · Design **skipped**（无 `design.md` / `ui-design.md`） |
| 审阅版本 | 分支 `hex-collapse` HEAD **`2ab3da5`**（`2ab3da59057d523bcf4d9b865b402c6346b025a0`）· 相对 `main` 1 commit：`feat(web): always collapse free space in hex and structure` |
| 工作树 | 未入库：本 `review.md`；Manager 侧 `STATUS.md` / `hex-collapse.md`；`page-core` fixtures CRLF 脏（**不在**实现提交） |
| 依据 | `spec.md`（12×P0 + P1-1，approved）；`plan.md`（T1–T9，approved）；`dev-notes.md`；`README.md`；`docs/standards/{documentation,quality,security,git}.md` |
| 审阅代码 | `apps/web/src/{hexLayout.ts,hexLayout.test.ts,HexDump.tsx,StructureMap.tsx,App.tsx,styles.css}`；`vitest.config.ts`；`package.json` / `pnpm-lock.yaml`；`README.md`；feature 文档 |
| 独立取证 | `pnpm --filter web test` 6 Pass；`pnpm --filter page-core test` 31 Pass；`pnpm -r typecheck` Pass；`main...HEAD` 对 `packages/page-core` / `apps/server` **空 diff**；布局边角 node 抽查（页首/页尾 free、行对齐）cell 字节正确 |

## 结论

**Approve**。无阻塞项。始终折叠、去 Expand/Collapse free、选中高亮断裂带、折叠后滚动几何、`hexCollapsed` 正交、未改 page-core：静态与 L2 满足进 QA。浏览器 GWT 手测按 quality.md §6 记缺口并交 QA，不阻塞 Review→QA。

## 实现正确性

| 合同 | 结果 | 证据 |
|---|---|---|
| P0-1 Hex free→断裂带 | 通过 | `buildHexLayout` 单一 `break`；`HexDump` `hex-free-break` + `free space [start..end) · N bytes` |
| P0-2 结构图恒断裂带 | 通过 | `FreeSpaceBand` 恒 `free-break`；空 free `null`；无展开条 |
| P0-3 两侧一致 | 通过 | 同 `page.freeSpace.range` / 跨度文案；无一侧展开 |
| P0-4 无 Expand/Collapse free | 通过 | 已删 `freeCollapsed` / `onToggleFreeCollapsed` / `.free-toggle`；源码无残留控件文案 |
| P0-5 仅折叠 free | 通过 | 仅 `freeRange`→break；非 free 仍 cells（单测） |
| P0-6 选中高亮、不展开 | 通过 | 结构 `onSelect("free", range)`；hex `onSelectOffset(start)`→`findStructureAt`；`.selected`/`.hl`；无展开入口 |
| P0-7 双向高亮 | 通过（静态） | 非 free 逐字节 `hl`；权威 `ByteRange` 未改；`origin==="hex"` 不 locate |
| P0-8 滚动折叠几何 | 通过（静态） | `presentationRowForOffset` + `computeHexScrollTarget`；nonce 合同保留 |
| P0-9 局部行与偏移 | 通过 | 不对齐 leading/trailing cells（单测）；`labelOffset` pad≥4 |
| P0-10 `hexCollapsed` 正交 | 通过 | 主带 Collapse/Show hex 保留；hex 面板无整栏折叠 |
| P0-11 不改 page-core/API | 通过 | `main...HEAD` 无 core/server；core 测绿 |
| P0-12 空 free | 通过 | `end<=start` 无 break（布局测）；结构 band `null` |
| P1-1 diff 可辨 | 通过（静态） | `freeDiff`→`.hex-free-break.diff`；`.free-band.diff` |

## 测试有效性

| 层 | 结论 |
|---|---|
| Plan L2 | **满足**：web Vitest + page-core/server 回归口径 + typecheck；本会话复跑 Pass |
| 布局单测 | **有效**：空 free、对齐/不对齐、仅 free→break、offset→行、非 free 不折叠；整行删/映射错位可失败 |
| 缺口 | 手测 1–8 未跑；`dev-notes`：原因 / 中风险 / 恢复=QA；符合 quality.md §6 |
| QA 必测 | Spec GWT P0-1..12 + P1-1；重点 P0-8、P0-10、双向高亮（实库或夹具目视） |

## 文档影响核对

| Plan 声明 | 一致？ | 备注 |
|---|---|---|
| 开发 → `dev-notes.md` | 是 | T1–T9、L2、P0-11、手测缺口 |
| 用户 → `README.md` | 是 | 去 foldable/Expand；始终折叠 + 折叠后滚动 |
| 运维 → N/A | 是 | 无部署/监控变更 |
| feature 文档 | 是 | spec/plan/dev-notes 已入库；本报告待 Manager 择机提交 |

## 安全影响核对

| 检查项 | 结果 | 备注 |
|---|---|---|
| 敏感信息 | 通过 | `.env` 未跟踪；提交/文档无凭据 |
| 认证与授权 | 无新增面 | 未改 connect / server |
| 输入与外部访问 | 无新增面 | 纯呈现 |
| 文件操作 | N/A | |
| 依赖变更 | 通过（低风险） | devDependency `vitest` + lockfile；非运行时面 |
| 处置状态 | 允许继续 | **无未解决安全问题** |

## UI/UX 核对

| 检查项 | 结果 | 备注 |
|---|---|---|
| Spec 界面验收 | 通过（静态） | 断裂带文案、无切换控件、选中/diff 类；目视交 QA |
| `docs/standards/ui.md` | N/A | 无 `ui-design.md`；Design skipped |
| `ui-design.md` | N/A | 门禁 skipped |
| 主题/深色 | N/A | Spec 不扩展；沿用既有 Theme |

## Git 合规

| 检查项 | 结果 |
|---|---|
| 分支 | `hex-collapse` → `main`；未在 `main` 实施 |
| 提交 | Conventional Commits；路径与 Plan 一致（web + README + feature docs + vitest） |
| 禁止项 | 无 `.env`/凭据/构建产物 |
| 工作树 | 勿误加 Manager 状态与无关 fixtures CRLF |

## 发现项

### 必修项（阻塞）

无。

### 非阻塞建议

| ID | 位置 | 建议 |
|---|---|---|
| C1 | `hexLayout.test.ts` | 可补页首 free、`freeEnd` 行对齐+leading、1B free；非进 QA 前置 |
| C2 | QA | 必覆盖 P0-8（页尾入视 / 同区间不重复滚 / hex 内不拉滚）与 P0-10（Collapse hex→点字段→Show+定位） |
| C3 | 工作树 | 勿提交无关 fixtures CRLF |

## 后续动作

1. Manager：→ `qa`；**勿**仅为进 QA 提交本 `review.md`（git.md §1.4）。
2. QA：Spec GWT + Plan 手测 → `qa-report.md`。
3. 复审：仅 QA Fail 或合同变更后；本结论无需 Developer 返工。

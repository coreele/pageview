# Dev Notes: hex-collapse

## 实现说明

- 工作项: `hex-collapse`（未拆分）；源分支 `hex-collapse` ← `main`
- 行为: 非空 `page.freeSpace.range` 在结构图与 hex **始终**断裂带；移除 Collapse/Expand free space 与 `freeCollapsed`；选中仅高亮断裂带；自动滚动用折叠后呈现行；保留顶栏 `hexCollapsed`
- TDD: 先写 `hexLayout` Vitest（红：模块缺失）→ `buildHexLayout` / `presentationRowForOffset`（绿）→ 接线 HexDump / StructureMap / App
- **禁止**改 `packages/page-core` 解析/API（本项无 core 业务 diff）
- 未改 Spec / Plan / manager 工作项或 STATUS

## Plan 任务

| 任务 | 状态 |
|---|---|
| T1 分支与基线 | 完成（`hex-collapse`；改前 typecheck/web build 通过） |
| T2 hexLayout + 单测 | 完成（6 tests） |
| T3 HexDump 始终折叠 + 选中断裂带 | 完成 |
| T4 结构图去 toggle | 完成 |
| T5 联动/高亮 | 完成（同 free range / 选中态；diff 两侧 `.diff`） |
| T6 滚动按折叠几何 | 完成（`presentationRowForOffset` + 既有 `computeHexScrollTarget`） |
| T7 `hexCollapsed` 正交 + core 不动 | 完成（无 core 业务 diff；`pnpm test` 绿） |
| T8 P1 diff + README/dev-notes | 完成 |
| T9 验证关门 | 完成（手测见未验证项） |

## 变更路径

| 路径 | 变更 |
|---|---|
| `apps/web/src/hexLayout.ts` | 新增呈现布局 / offset→行 |
| `apps/web/src/hexLayout.test.ts` | Vitest 布局测 |
| `apps/web/vitest.config.ts` / `apps/web/package.json` | web `test` script + vitest |
| `apps/web/src/HexDump.tsx` | 折叠渲染、选中断裂带、滚动几何 |
| `apps/web/src/StructureMap.tsx` | 恒折叠；移除 Expand/Collapse |
| `apps/web/src/App.tsx` | 删 `freeCollapsed`；传 `freeRange` / `freeDiff` |
| `apps/web/src/styles.css` | hex 断裂带；清理 `.free-toggle` |
| `README.md` | free/hex 始终折叠表述 |
| `workflow/docs/features/hex-collapse/dev-notes.md` | 本文件 |
| `pnpm-lock.yaml` | vitest 依赖锁定 |

## 验证证据

| 命令 / 检查 | 结果 |
|---|---|
| `pnpm --filter web test` | Pass（6 tests） |
| `pnpm test` | Pass（page-core 31 + server 4） |
| `pnpm -r typecheck` | Pass |
| `pnpm -r build` | Pass |
| `git diff -- packages/page-core`（业务源码） | 无业务变更（P0-11） |
| 文案检索 Expand/Collapse free / `freeCollapsed` | `apps/web` 源码无残留 |

**达到验证层:** L2（web 布局测 + `pnpm test` + typecheck/build）。定向浏览器手测见下。

## 未验证项

| 未验证项 | 原因 | 风险 | 恢复条件 | 复测范围 |
|---|---|---|---|---|
| Plan 手测清单 1–8（浏览器） | 本会话未做实库 UI 点按 | 中：滚动/高亮/Collapse hex 交叉依赖 DOM | QA 连 `dev:server`+`dev:web` 按 Spec GWT | P0-1..P0-12、P1-1 |

## 文档影响

- 开发: 本 `dev-notes.md`
- 用户: `README.md`（去掉 foldable / Expand 误导）
- 运维: N/A

## 建议复测（QA）

1. 大块非空 free：两侧断裂带；无 Expand/Collapse free
2. 选中 free：仅高亮断裂带，不展开
3. 页尾 tuple：折叠后呈现行入视；同字段不重复滚；hex 内点选不拉滚
4. Collapse hex → 点字段 → Show hex 定位；再显隐后 free 仍断裂带
5. free 不对齐 32B：同行前后单元格
6. tuple 内长 `00`：仍为单元格
7. Refresh → free diff：断裂带可辨
8. 空 free（若有）：无断裂带 UI

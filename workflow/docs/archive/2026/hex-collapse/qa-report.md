# QA Report: hex-collapse

## 轮次

| 轮次 | 日期 | 范围 | 结论 |
|---|---|---|---|
| 1 | 2026-07-27 | 首测：Spec 12×P0 + P1-1；Plan L2 + 浏览器 GWT；`hex-collapse` @ `2ab3da5` | Pass |

## 环境与命令

| 项 | 值 |
|---|---|
| 分支 / 提交 | `hex-collapse` @ `2ab3da59057d523bcf4d9b865b402c6346b025a0` |
| 入口门禁 | Plan approved；Review **Approve**；状态 `qa` |
| 运行时 | API `127.0.0.1:8787`（PG 已连）；Vite `http://localhost:5174`；Playwright Chromium |
| 实库页 | `public.tb` blk0；free `[32..8128)` · 8096 bytes；#tup 2 |

| 命令 | 结果 |
|---|---|
| `pnpm --filter web test` | Pass（6） |
| `pnpm test` | Pass（page-core 31 + server 4） |
| `pnpm -r typecheck` / `pnpm -r build` | Pass |
| `git diff main...HEAD -- packages/page-core apps/server` | 空 |
| 检索 Expand/Collapse free、`freeCollapsed`、`free-toggle` | `apps/web/src`+README 无残留 |

浏览器：Playwright 实库 GWT；短 hex 视口强制溢出验 P0-8。

## 覆盖（对照 plan 最低验证层 + spec 验收）

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| P0-1 | Hex 始终折叠 free | 通过 | 1×`.hex-free-break`=`free space [32..8128) · 8096 bytes`；cells=96；布局测 |
| P0-2 | 结构图始终折叠 | 通过 | `#free-space-band` 同文案；无展开条 |
| P0-3 | 两侧一致 | 通过 | 两侧 label 相同 |
| P0-4 | 无 Expand/Collapse free | 通过 | UI/源码无控件残留 |
| P0-5 | 仅折叠 free | 通过 | 仅 1 break；非 free `00` 仍为单元格 |
| P0-6 | 选中高亮断带、不展开 | 通过 | 两侧 selected/hl；cell 数不变 |
| P0-7 | 双向高亮 | 通过 | tuple→hex `.hl`=4 |
| P0-8 | 自动滚动（折叠几何） | 通过 | 溢出后 header `203→0`、tuple `0→188`；同字段不重复滚；视口内 hex 点选不拉滚；`presentationRowForOffset(8160)=3` |
| P0-9 | 局部行与偏移 | 通过 | `0000/0020/1fc0/1fe0`；布局测不对齐 |
| P0-10 | 顶栏 Collapse hex | 通过 | 仅主带入口；Collapse/Show；折叠态点**另一**字段→展开+定位+free 仍断。同字段再点不展开=`main` 既有 `!rangeChanged`，本项未削弱 |
| P0-11 | 不改 page-core/API | 通过 | 无 core/server diff；`pnpm test`；page=8192 |
| P0-12 | 空 free 无折叠 UI | 通过 | 实库非空 N/A；空 free 布局测 + `FreeSpaceBand` null |
| P1-1 | diff 可辨 | 通过 | `.diff`/`freeDiff` 接线在；Refresh 未变页 markers=0；未目视真实 free-diff 像素 |
| Plan L2 | 上表命令 | 通过 | 全绿 |
| README | 折叠表述 | 通过 | 始终折叠；无 Expand 误导 |

## 回归

双向高亮、折叠后滚动合同、Collapse hex→异字段 Show+定位、32B 偏移、page-core/server 测：均通过（见上）。

## 文档与安全

| 检查 | 结论 |
|---|---|
| README | 通过 |
| 运维 | N/A |
| 安全 | 无新认证/输入/API；无凭据入库；允许合并 |

## UI/UX

> 无 `ui-design.md`（Design skipped）。

| 检查项 | 结果 | 证据 |
|---|---|---|
| Spec 界面相关验收 | 通过 | 浏览器 GWT |
| `workflow/docs/standards/ui.md` | N/A | 无 ui-design |
| `ui-design.md` | N/A | skipped |

## 缺陷

| ID | 严重度 | 摘要 | 状态 |
|---|---|---|---|
| — | — | 无 | — |

## 结论

- 总体: Pass
- 恢复条件: N/A
- 合并: 待用户授权（本报告不单独 commit；不执行合入）

# Plan: export-structure-png

## 元信息

- 依据 Spec: `workflow/workspace/export-structure-png/spec.md`
- 依据 Design: N/A
- 依据 UI: `workflow/workspace/export-structure-png/ui-design.md`
- 路径等级: standard
- Review 门禁: required
- 最低验证层: unit + static
- 验证命令:
  - `pnpm --filter web test`
  - `pnpm --filter web typecheck`
- 预期证据: 退出码 0；新增导出纯函数与 chrome/README 扫描用例通过。

## 目标摘要

Page 模式将当前结构图栅格化为带标题的全高 PNG，写入剪贴板并下载。Heap peek 打开时导浮层堆页。纯前端；库须能处理现有 `color-mix` token。

## 任务拆解

1. **纯函数**（完成条件：caption、filename sanitize、快捷键匹配、主视图 vs 浮层目标 有单测）
2. **栅格化**（完成条件：克隆结构图 + 离屏 caption，撑开 `.structure-flow` overflow，`toBlob` 得 PNG；失败走错误路径）
3. **入口**（完成条件：chrome Export 在 Hex 后；浮层标题栏 Export；Ctrl/Cmd+Shift+C；进行中 Exporting…）
4. **文档**（完成条件：README 双语 Features 一句 Export PNG）
5. **回归**（完成条件：web test + typecheck 绿）

## 依赖与顺序

1 → 2 → 3 → 4 → 5。TDD：先 1 的红测。

库：`modern-screenshot`（web 依赖）。选它而非 `html-to-image`，因本 UI 大量 `color-mix`。禁止出站；只读当前 DOM。不改 server。

## 触碰路径

- `apps/web/package.json`（依赖）
- `apps/web/src/exportStructure.ts`（新：caption / filename / shortcut / target）
- `apps/web/src/exportStructure.test.ts`（新）
- `apps/web/src/exportStructurePng.ts`（新：克隆栅格化 + clipboard/download）
- `apps/web/src/App.tsx`
- `apps/web/src/HeapPeekOverlay.tsx`
- `apps/web/src/styles.css`（离屏 caption / 导出中按钮，必要时）
- `apps/web/src/chromeToggle.test.ts` 或并列扫描测
- `README.md`、`README.zh-CN.md`

不改：page-core、server、diff 算法、32B 布局。

## 验收与验证

| ID | 要求或命令 | 预期证据 | 结果（实施后填） |
|---|---|---|---|
| P0-1 | 有页才有 Export；WAL/无页无按钮 | App 条件渲染 + 源码扫描 | |
| P0-2 | PNG = 标题 + 全高结构图，无 Tree/Hex/Detail | 合成节点选择器单测；真机目视记缺口 | |
| P0-3 | 下载文件名 sanitize | `exportFileName` 单测 | |
| P0-4 | 剪贴板 image/png | 辅助函数在 ClipboardItem 路径被调用（单测 mock） | |
| P0-5 | 剪贴板失败仍下载 | mock write 拒绝后仍调用 download | |
| P0-6 | Ctrl/Cmd+Shift+C | `isExportShortcut` 单测 + App 监听 | |
| P0-7 | 浮层优先 + 浮层按钮 | `exportTargetKind` 单测；overlay JSX 含 Export | |
| P0-8 | 选中/diff 随 DOM | 栅格化源是屏上结构图节点（不重画） | |
| P1-1 | 浮层 loading/error 禁用 | overlay disabled 条件 | |
| P1-2 | 栅格化失败有错误、无下载 | mock toBlob 失败 | |
| V-reg | web test | 退出码 0 | |
| V-static | typecheck | 退出码 0 | |

## 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 真机 PNG 像素 / 剪贴板 | jsdom 无真实栅格化与系统剪贴板 | 色偏、裁切、权限文案 | 加载一页点 Export，粘贴到笔记核对全高与标题 |

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | N/A（无新 API） |
| 用户文档 | `README.md`、`README.zh-CN.md` Page 功能列表 |
| 运维文档 | N/A |

## 交接顺序

1. Developer 实施与自验 →
2. Reviewer（Review 门禁 required）→
3. QA 验收 →
4. 用户授权合并 → Manager 第三阶段文档提交（`done`）→ 合入 → 归档

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-09-08 | 初稿 |

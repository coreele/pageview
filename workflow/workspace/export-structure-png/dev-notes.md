# Dev Notes: export-structure-png

## 实现摘要

Page 模式 chrome **Export**（右上五钮之首：Export → Tree → Detail → Hex → 主题）与 heap peek 标题栏按钮把当前结构图克隆为离屏节点（去掉 Detail / probe，撑开 `.structure-flow`），加上标题后用 `modern-screenshot` 栅格化为 PNG：下载文件，并尝试写入剪贴板。浮层打开时快捷键由浮层处理，避免导底下的索引页。不改 page-core、diff 或 32B 布局。

## 变更路径

- `apps/web/package.json`（`modern-screenshot`；测试 `happy-dom`）
- `pnpm-lock.yaml`
- `apps/web/src/exportStructure.ts`
- `apps/web/src/exportStructure.test.ts`
- `apps/web/src/exportStructurePng.ts`
- `apps/web/src/exportStructurePng.test.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/HeapPeekOverlay.tsx`
- `apps/web/src/StructureMap.tsx`（`data-export-structure`）
- `apps/web/src/styles.css`
- `README.md`、`README.zh-CN.md`

## 测试先行记录（TDD）

| Spec ID / 行为项 | 测试 | 先失败 | 后通过 | 说明 |
|---|---|---|---|---|
| P0-1 | chrome-actions 扫描 Export 在 Tree/Detail/Hex 前 | 是 | 是 | 2026-09-09 改为五钮之首 |
| P0-2 | caption + compose 去 Detail/撑开 overflow | 是 | 是 | compose 需 happy-dom |
| P0-3 | `exportFileName` sanitize | 是 | 是 | 引号变成 `_` 后断言已对齐 Spec |
| P0-4 | mock clipboard write 被调用 | 是 | 是 | |
| P0-5 | clipboard throw 仍 download | 是 | 是 | |
| P0-6 | `isExportShortcut` | 否 | 是 | 纯函数先绿 |
| P0-7 | `exportTargetKind` + overlay JSX | 是 | 是 | 源码扫描 Export / disabled |
| P0-8 | 栅格化源为屏上结构图节点 | 否 | 是 | 克隆 DOM，不重画；像素见缺口 |
| P1-1 | overlay loading/error 禁用 | 是 | 是 | `disabled={state.status !== "open"` |
| P1-2 | rasterize throw 无 download | 是 | 是 | |
| V-reg / V-static | web test + typecheck | — | 是 | 20 files / 287；tsc 0 |

## 验证

| 命令 | 验证层 | 结果摘要 / 证据 |
|---|---|---|
| `pnpm --filter web test` | unit | 20 files / 287 passed |
| `pnpm --filter web typecheck` | static | 退出码 0 |

## 目标分支同步（最终 Review 前）

- 目标分支及提交: `origin/main` `557c125ceb2de352c568c08eeaf085ddd54c6255`
- 同步后源分支 HEAD: `7d6e4043af2a4133a982135450470282ebd0601e`
- 同步方式: N/A（源分支从该基线建出，仍是祖先）
- 冲突及处理: N/A
- 同步后复验: `pnpm --filter web test` 20/287；typecheck 0

## 文档影响

| 类别 | 已更新路径或交接说明 |
|---|---|
| 开发文档 | N/A |
| 用户文档 | `README.md`、`README.zh-CN.md` Page 功能列表 Export PNG |
| 运维文档 | N/A |

## 未解决风险 / 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 真机 PNG 像素 / 系统剪贴板 | 本会话无可用浏览器自动化；jsdom/happy-dom 不跑 `domToBlob` | 色偏、裁切、字体嵌入、权限文案 | 加载一页点 Export，粘贴到笔记核对全高与标题 |

## QA 修复回执

| 缺陷 ID | 处理 | 摘要 | 验证证据 | 建议复测范围 |
|---|---|---|---|---|
| | | | | |

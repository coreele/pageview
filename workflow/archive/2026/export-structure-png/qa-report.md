# QA Report: export-structure-png

> 首测与所有回归写在本文件，按轮次追加；禁止 `qa-report-v2.md`。

## 轮次

| 轮次 | 日期 | 实现版本 | 环境 | 范围 | 结论 |
|---|---|---|---|---|---|
| 1 | 2026-09-08 | `74634ac2680381e1679066cee544fe8b964f4759` | 本地 web vitest + tsc；`origin/main` `557c125` 为祖先 | 首测 | Pass |
| 2 | 2026-09-09 | `7d6e4043af2a4133a982135450470282ebd0601e` | 同轮次 1 | 回归：Export 改到五钮之首 | Pass |

## 执行命令

| 命令 | 输出摘要 / 证据位置 |
|---|---|
| `pnpm --filter web test` | 20 files / 287 passed |
| `pnpm --filter web typecheck` | 退出码 0 |

## 覆盖（对照 Spec 验收与 Plan 验证）

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| P0-1 | 有页才有 Export；为五钮之首 | Pass | chrome-actions 扫描 Export < Tree < Detail < Hex；轮次 2 复测 |
| P0-2 | 标题 + 全高结构、无 Detail | Pass | compose 单测去 wrap / 撑 overflow；像素见缺口 |
| P0-3 | 文件名 sanitize | Pass | `exportFileName` 单测 |
| P0-4 | 剪贴板 image/png | Pass | mock writeClipboard 被调用 |
| P0-5 | 剪贴板失败仍下载 | Pass | throw 后 download 仍调用 |
| P0-6 | Ctrl/Cmd+Shift+C | Pass | `isExportShortcut`；App/overlay 监听 |
| P0-7 | 浮层优先 | Pass | `exportTargetKind`；overlay Export + disabled |
| P0-8 | 选中/diff 随 DOM | Pass | 克隆屏上节点，不重画 |
| P1-1 | 浮层未 ready 不导出 | Pass | overlayPresent 且未 ready → none；按钮 disabled |
| P1-2 | 栅格化失败 | Pass | mock throw → EXPORT_FAILED、无 download |
| V-reg | web test | Pass | 287 passed |
| V-static | typecheck | Pass | 退出码 0 |

## 回归

| 范围 | 结果 | 证据 |
|---|---|---|
| chrome-order 顺序 Tree→Detail→Hex | Pass | 既有 chromeToggle 扫描仍绿 |
| heap peek 关闭/Esc 合同 | Pass | overlay 仍有 Esc 监听；Export 不占用 Escape |
| diff / url / tree 单测 | Pass | 同次 vitest 全绿 |

## 文档与安全验收

| 项 | 结果 | 备注 |
|---|---|---|
| 用户可见文档 | Pass | README 双语 Export PNG |
| 运维可执行文档 | Pass | N/A |
| 安全验证范围 | Pass | 新依赖仅客户端栅格化；下载 blob；无新 API |

## 缺陷

| ID | 严重度 | 摘要 | 状态 | 处理说明 | 验证证据 |
|---|---|---|---|---|---|
| — | | | | | |

## 阻塞（Blocked 时必填）

- 原因:
- 风险:
- 恢复条件:
- 复测范围:

## 验证缺口（不阻塞）

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 真机 PNG / 系统剪贴板 | 本环境无浏览器自动化跑 `domToBlob` | 色偏或裁切 | 加载一页点 Export，粘贴笔记 |

## 结论

- 本轮结论: Pass
- 合并: 已授权（等 Manager 置 `done`）
- 待合入提交: `7d6e4043af2a4133a982135450470282ebd0601e`

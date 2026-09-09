# Review: export-structure-png

## 审阅范围

- 实现版本 / 提交: `7d6e4043af2a4133a982135450470282ebd0601e`（含 `74634ac` 导出实现）
- 依据: `plan.md`；`spec.md`；`ui-design.md`

## 实现正确性

chrome **Export** 仅在 `mode === "page" && pageView` 出现，为 `.chrome-actions` 第一钮：Export → Tree → Detail → Hex，主题钮仍最右。非 `--on` 开关。标题与文件名由纯函数生成；克隆去掉 Detail / probe 并撑开 `.structure-flow`。浮层标题栏有 Export，`status !== "open"` 时禁用；浮层在场时 chrome 按钮禁用且 App 快捷键让路。剪贴板失败仍下载；栅格化失败不下载并走 `EXPORT_FAILED`。未改 page-core、diff、server。

2026-09-09 复审：用户要求 Export 为右上五钮之首。`App.tsx` 已把 Export 挪到 Tree 之前；扫描测已改。WAL 仍无 Export。

## 测试有效性

纯函数与 mock 栅格化覆盖 P0-1..P0-7、P1-1/P1-2。P0-1 现断言 Export 索引小于 Tree/Detail/Hex。P0-8 以克隆屏上 DOM 为证据。web 287 / typecheck 0 @ `7d6e404`。

## 文档影响核对

| Plan 声明 | 实现是否一致 | 备注 |
|---|---|---|
| 开发文档 | 是 | N/A |
| 用户文档 | 是 | README 未写死按钮顺序，无需改 |
| 运维文档 | 是 | N/A |

## 安全影响核对

| 检查项 | 结果 | 处置状态 | 备注 |
|---|---|---|---|
| 敏感信息 | 通过 | 无 | PNG 为当前结构图；无凭据 |
| 认证与授权 | 通过 | 无 | 无新会话 |
| 输入与外部访问 | 通过 | 无 | 无新 server 面；下载为 blob URL |
| 依赖变更 | 通过 | 无 | 本轮无新依赖；既有 `modern-screenshot` / `happy-dom` |

## 必修项

| ID | 位置 | 问题 | 状态 |
|---|---|---|---|
| — | | | |

## 非阻塞建议

- 真机长页 PNG 体积与 `scale: 2` 未设上限。
- 浮层 loading 时也会 `preventDefault` 该快捷键。

## 结论

Approve

## 后续动作与复审范围

进 QA 回归轮次（P0-1 顺序 + 既有导出用例）。已完成轮次 2。

# Plan: chrome-toggles

## 元信息

- 依据 Spec: N/A
- 依据 Design: N/A
- 依据 UI: `workflow/workspace/chrome-toggles/ui-design.md`
- 路径等级: fast
- Review 门禁: skipped（fast：chrome 文案与色态）
- 最低验证层: unit + static
- 验证命令:
  - `pnpm --filter web test`
  - `pnpm --filter web typecheck`
- 预期证据: 上述退出码 0；新增 chrome toggle / 主题图标用例通过。

## 目标摘要

Detail / Hex / Tree 固定文案，开态用按钮颜色；主题按钮改为日月 SVG，去掉 `Theme:`。

## 任务拆解

1. **class helper + 色态 CSS**（完成条件：`chromeToggleClass` 与 `.chrome-toggle--on` 有单测）
2. **接线**（完成条件：App 三开关固定文案 + `aria-pressed`；主题为 SVG；源码无 Show/Collapse / `Theme:`）
3. **README**（完成条件：中英树面板一句不再写 Show/Collapse tree）
4. **回归**（完成条件：web 测试绿）

## 依赖与顺序

1 → 2 → 3 → 4。

## 触碰路径

- `apps/web/src/chromeToggle.ts`（新）、`apps/web/src/chromeToggle.test.ts`（新）
- `apps/web/src/App.tsx`、`apps/web/src/styles.css`
- `README.md`、`README.zh-CN.md`

不改：折叠 state、server、URL。

## 验收与验证

| ID | 要求或命令 | 预期证据 | 结果（实施后填） |
|---|---|---|---|
| V-1 | 开/关 class | on → 含 `--on`；off 不含 | |
| V-2 | 固定文案 | `App.tsx` 无 `Show detail`/`Collapse`/`Theme:` | |
| V-3 | 主题图标 | 主题钮渲染 sun/moon SVG，无 Theme 文本 | |
| V-docs | README 中英 | 树面板一句写 Tree 开关，无 Show/Collapse | |
| V-reg | web 测试 | 退出码 0 | |
| V-static | typecheck | 退出码 0 | |

## 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 真机扫读 | 本会话未必连实例 | 开态对比偏弱 | 本地点三个开关与主题 |

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | N/A |
| 用户文档 | `README.md`、`README.zh-CN.md` 树面板一句 |
| 运维文档 | N/A |

## 交接顺序

1. Developer 实施与自验 →
2. Review skipped →
3. QA 验收 →
4. 用户授权合并 → Manager 第三阶段文档提交（`done`）→ 合入 → 归档

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-09-08 | 初稿 |

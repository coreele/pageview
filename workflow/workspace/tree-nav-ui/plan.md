# Plan: tree-nav-ui

## 元信息

- 依据 Spec: N/A
- 依据 Design: N/A
- 依据 UI: `workflow/workspace/tree-nav-ui/ui-design.md`
- 路径等级: fast
- Review 门禁: skipped（fast：树面板排版与 CSS，对照 ui-design 即可）
- 最低验证层: unit + static
- 验证命令:
  - `pnpm --filter web test`
  - `pnpm --filter web typecheck`
- 预期证据: 上述退出码 0；新增 kind token / CSS 用例通过；既有 btreeTree 用例绿。

## 目标摘要

树导航行铺满高亮、类型拆成 pill、expander 用 CSS 图形；heap 列表不再显示 `…` 类型。不改 Load / 展开 / 列宽上限。

## 任务拆解

1. **kind tokens**（完成条件：`treeKindTokens` 对 meta / leaf+L0+root / heap ready / loading 有单测）
2. **面板排版**（完成条件：`BtreeTreePanel` 渲染拆开的 kind；expander 无 `▾▸•`；CSS 当前行整宽 + 左条 + hover）
3. **expander 贴文案**（完成条件：行 `gap: 0`；expander 槽宽 ≤ 0.9rem）
4. **回归**（完成条件：既有 `btreeTree` / web 测试绿）

## 依赖与顺序

1 → 2 → 3 → 4。

## 触碰路径

- `apps/web/src/btreeTree.ts`
- `apps/web/src/btreeTree.test.ts`
- `apps/web/src/BtreeTreePanel.tsx`
- `apps/web/src/styles.css`

不改：page-core、server、URL、chrome Show tree。

## 验收与验证

| ID | 要求或命令 | 预期证据 | 结果（实施后填） |
|---|---|---|---|
| V-1 | kind 拆成 token | leaf+root → `leaf`,`L0`,`root`；meta → `meta`；heap ready → `[]` | 通过 |
| V-2 | expander 非 Unicode 几何 | `BtreeTreePanel.tsx` 无 `▾▸•`；CSS 含 caret/dot 规则 | 通过 |
| V-3 | 当前行整宽高亮 | CSS `.btree-tree-row` `width: 100%` 且 current 含 inset accent | 通过 |
| V-4 | expander 贴近 blk 文案 | 行 `gap: 0`；`.btree-tree-expander` 槽宽 ≤ 0.9rem | 通过 |
| V-reg | web 测试 | 退出码 0 | 通过 |
| V-static | typecheck | 退出码 0 | 通过 |

## 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 真机扫读 | 本会话未必连上实例 | 窄列换行观感 | 本地 Show tree 对照截图场景 |

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | N/A：无新公开 API |
| 用户文档 | N/A：README 未写树行排版 |
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
| 2026-09-08 | 用户反馈：收紧箭头/圆点与文字间距 |

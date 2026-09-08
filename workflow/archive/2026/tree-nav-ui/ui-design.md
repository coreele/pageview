# UI Design: tree-nav-ui

> 只记录需要决策的界面与交互事项。导航语义（点标签 Load、点箭头展开）沿用 `btree-tree-view`，本项只改树面板扫读。

## 背景与范围

用户对照截图：树列里 `blk N` 与 `leaf L0 root` 挤成一行淡灰字，选中条只包住文字，caret/点很小。优化 `#btree-tree-panel` 行排版与选中态。表模式同一组件，一并受益。不改 chrome「Show tree」、列宽上限、点按行为。

## 非目标

- 加宽树列超过既有 `fit-content(13rem)` / `max-width: 13rem`
- 树节点展示解码键
- 改 expander 与 Load 的双控件分工
- 新皮肤或新主色

## 用户与关键场景

| 角色或场景 | 目标 | 备注 |
|---|---|---|
| 看清当前页 | 当前行整行高亮、blk 号醒目 | 索引叶 / 表块列表相同 |
| 扫类型 | `leaf` / `L0` / `root` 分开，不要连成一句 | 状态芯片（garbage 等）仍在右侧 |
| 展开子页 | 箭头仍只展开 | 图形 caret，不是 Unicode |

## 信息架构与关键界面

N/A：不改变面板在主分栏中的位置与折叠入口。

节点行：

```text
[▸]  blk 0    [meta]
    [•]  blk 1    [leaf] [L0] [root]     ← 当前：整行底 + 左侧强调条
```

## 关键流程

N/A：Load / 展开 / Retry / 空态文案不变。

## 布局与视觉方向

- 构图与层级: 行铺满面板内宽（至少 `min-width: 10.5rem`），选中不再缩成文字胶囊。expander 图形贴近 `blk` 文案：窄槽 + 行 `gap: 0`，不要在三角/圆点右侧再留半个按钮宽。
- 色彩 / 字体 / 氛围: 复用 `--surface` `--border` `--accent` `--text-muted`。当前行 `color-mix(--accent 16%, --surface)` + `inset` 左侧 2px `--accent`。blk 号 `font-variant-numeric: tabular-nums`、略加字重。类型标签小 pill（浅底 + 圆角），不用 `.legend-chip` 色块以免抢结构图图例。
- 明确避开: Unicode `▾▸•`；把 `leaf L0 root` 再拼成单字符串；加宽列。

## 组件与交互约定

| 区域或组件 | 约定 | 复用既有系统？ |
|---|---|---|
| 行 | `.btree-tree-row` 拉满宽度；hover 浅底（非当前） | 是 |
| expander | 可展开：CSS 三角，`aria-expanded` 旋转；叶：小圆点；loading：仍显示 `…` | 是，换图形 |
| 标签 | `.btree-tree-blk` + 多个 `.btree-tree-kind` + 既有 `.btree-tree-chip` | 是 |
| 键盘 | 仍 Tab + Enter；不新增方向键导航 | 是 |

heap 块列表 `pageType=unknown` 且非 loading：**不**显示 `…` 类型。

## 响应式与无障碍

| 项 | 约定 |
|---|---|
| 断点 / 适配 | 沿用既有 `<960` 全宽、`≥960` 窄列 |
| 键盘 / 焦点 | expander / 标签仍是独立 button；焦点环沿用全局 |
| 语义 / 对比度 | `aria-current` / `aria-expanded` / `aria-label` 不变；token 走 light/dark |

## 开放问题

N/A

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| 标签拆开后窄列换行变多 | 行变高 | pill 紧凑、允许 wrap；不加宽列 |
| CSS 三角对比不足 | 看不清展开 | 用 `currentColor` + muted，当前行随文字色 |

## 对 Plan 与 Developer 的要点

### Plan

- 抽出可测的 kind token 列表；CSS 对 caret / 当前行 / 禁止 Unicode expander 做回归
- 既有 `btreeTree` 行为测试必须绿

### Developer

- 不要改 `pendingFetches` / `visibleTree` 结构
- 类型文案只改展示拆分，不改 `pageType` 取值

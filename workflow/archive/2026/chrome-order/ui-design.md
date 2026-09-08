# UI Design: chrome-order

> 只记录需要决策的界面与交互事项。折叠语义、主题切换逻辑不改。

## 背景与范围

右上角开关顺序现为 Detail、Hex、Tree，主题钮在深色下底透明，三开关全开时月亮看起来像没点亮。改为 **Tree、Detail、Hex**，深色月亮钮用与 `.chrome-toggle--on` 相同的 accent 浅底。

## 非目标

- 改折叠默认、可见性（何时出现 Detail/Hex/Tree）
- 浅色太阳钮底色（用户只提深色月亮）
- 把主题钮移进 `.chrome-actions` 或改图标

## 用户与关键场景

| 角色或场景 | 目标 | 备注 |
|---|---|---|
| 深色全开 | 月亮与三开关同属点亮簇 | 底色对齐 `--on` |
| 找 Tree | 最左 | 仍在 Detail/Hex 旁、主题钮左 |

## 信息架构与关键界面

```text
[ Tree ] [ Detail ] [ Hex ]   [☾]
   on       on        on       深色：同样 accent 浅底
```

WAL 仍只有 Detail（无 Tree/Hex 时不空出位）。主题钮仍在 grid `theme` 格，最右。

## 关键流程

N/A：点击仍翻转同一 state。

## 布局与视觉方向

- 构图与层级: `.chrome-actions` 内顺序 Tree → Detail → Hex。
- 色彩: `[data-theme="dark"] .chrome-theme` 使用与 `.chrome-toggle--on` 相同的 `color-mix(in srgb, var(--accent) 18%, var(--surface))`。
- 明确避开: 新主色；浅色太阳强制同底（除非对照后仍空洞，本项不做）。

## 组件与交互约定

| 区域或组件 | 约定 | 复用既有系统？ |
|---|---|---|
| Tree / Detail / Hex | 文案与 `aria-*` 不变 | 是 |
| 主题钮 | 深色补底；`aria-label` 不变 | 是 |

## 响应式与无障碍

| 项 | 约定 |
|---|---|
| 断点 / 适配 | 主带既有换行 |
| 键盘 / 焦点 | 仍是 button |
| 语义 / 对比度 | 月亮底色与开态开关一致，不只靠描边 |

## 开放问题

N/A

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| 深色月亮底与「当前主题」误读成第四个面板开关 | 轻微 | 仍是图标、无 Tree/Detail 文案 |

## 对 Plan 与 Developer 的要点

### Plan

- 扫描 `chrome-actions` 里 Tree 出现在 Detail/Hex 之前；深色 `.chrome-theme` 含 accent mix

### Developer

- 只调换 JSX 顺序，不要改 `showTableTreeToggle` / 折叠条件
- 浅色 `.chrome-theme` 保持现状

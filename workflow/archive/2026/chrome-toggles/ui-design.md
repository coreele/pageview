# UI Design: chrome-toggles

> 只记录需要决策的界面与交互事项。折叠语义沿用既有 `aria-expanded` / 面板卸载，本项只改 chrome 按钮的呈现。

## 背景与范围

主带四个按钮目前用文案切换状态（Show/Collapse、Theme: light/dark）。改为：Detail / Hex / Tree **固定标签 + 颜色表示开闭**；主题按钮 **只显示太阳/月亮**。WAL 仍只有 Detail。不改折叠逻辑、默认值、可见性规则。

## 非目标

- 改默认折叠（tree 仍默认关；detail/hex 仍默认开）
- 把开关移出主带或改成图标-only（Detail/Hex/Tree 仍有文字）
- 新皮肤

## 用户与关键场景

| 角色或场景 | 目标 | 备注 |
|---|---|---|
| 看哪些面板开着 | 开=强调色底，关=普通按钮 | 一眼可辨 |
| 切换主题 | 点日月图标 | light=太阳，dark=月亮 |

## 信息架构与关键界面

```text
[ Detail ] [ Hex ] [ Tree ]   [☀/☾]
   on        on      off        当前主题图标
```

开 = 面板可见（`!collapsed`）。关 = 面板隐藏。

## 关键流程

N/A：点击仍翻转同一 state。

## 布局与视觉方向

- 构图与层级: 三开关共用 `.chrome-toggle`；开态对齐 `.mode-btn.active`（`color-mix(--accent 18%, --surface)` + 字重 600）。关态沿用默认 `button`。
- 主题钮: 方形图标按钮（约与开关同高），内嵌 SVG，无文字。
- 明确避开: Show/Collapse 文案；`Theme:` 前缀；emoji 代替 SVG。

## 组件与交互约定

| 区域或组件 | 约定 | 复用既有系统？ |
|---|---|---|
| Detail / Hex / Tree | 文案固定 `Detail` / `Hex` / `Tree`；`aria-pressed` 与开态一致；保留 `aria-expanded` / `aria-controls` | 是 |
| Theme | `aria-label`：`Switch to dark theme` / `Switch to light theme`（指向将切到的一侧） | 是 |

## 响应式与无障碍

| 项 | 约定 |
|---|---|
| 断点 / 适配 | 主带既有换行 |
| 键盘 / 焦点 | 仍是 button；`:focus-visible` 全局环 |
| 语义 / 对比度 | 开态靠底色+字重，不只靠色相；图标 `aria-hidden` |

## 开放问题

N/A

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| 关态太淡看不出可点 | 找不到 Tree | 关态保持有边框的默认按钮 |

## 对 Plan 与 Developer 的要点

### Plan

- 抽出 `chromeToggleClass`；断言 App 不再含 Show/Collapse / `Theme:`
- README 中英改 Tree 一句

### Developer

- 不要改 `setDetailCollapsed` / hex / tree 的默认与可见条件

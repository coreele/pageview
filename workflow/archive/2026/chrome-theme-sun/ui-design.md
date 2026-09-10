# UI Design: chrome-theme-sun

> 只记录需要决策的界面与交互事项。主题切换逻辑、图标不改。

## 背景与范围

深色月亮已用 `.chrome-toggle--on` 同款 accent 浅底；浅色太阳仍是默认按钮白底描边，和旁边点亮的 Tree/Detail/Hex 不一致。浅色太阳也铺同一底。

## 非目标

- 改图标、aria-label、点击语义
- 把主题钮移进 `.chrome-actions` 或消掉 Hex 与主题钮之间的 grid 空隙
- 关态开关的样式

## 用户与关键场景

| 角色或场景 | 目标 | 备注 |
|---|---|---|
| 浅色、三开关开 | 太阳与开关同属一簇点亮 | 不是白底描边孤岛 |

## 信息架构与关键界面

```text
[ Export ]  [ Tree ] [ Detail ] [ Hex ]   [☀]
  描边         on        on        on      浅色：同样 accent 浅底
```

Export 仍是默认描边按钮。主题钮表示**当前**主题，不是「关」。

## 关键流程

N/A

## 布局与视觉方向

- 色彩: `.chrome-theme` 两主题都用 `color-mix(in srgb, var(--accent) 18%, var(--surface))` + `color: var(--text)`，与 `.chrome-toggle--on` 相同。
- 删除 `[data-theme="dark"] .chrome-theme` 特例。
- 明确避开: 太阳用实心 accent；Export 也上色。

## 组件与交互约定

| 区域或组件 | 约定 | 复用既有系统？ |
|---|---|---|
| `.chrome-theme` | 深浅同一底；尺寸/grid 不变 | 是 |

## 响应式与无障碍

| 项 | 约定 |
|---|---|
| 断点 / 适配 | 不改 |
| 键盘 / 焦点 | 全局 `:focus-visible` |
| 语义 / 对比度 | 底+图标，不只靠色相 |

## 开放问题

N/A

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| 浅色底太淡看不出 | 仍像没开 | 与已验证的 `--on` 同 mix |

## 对 Plan 与 Developer 的要点

### Plan

- 扫描 `.chrome-theme {` 含 accent 18% mix；无 `[data-theme="dark"] .chrome-theme`

### Developer

- 只改 `styles.css` 主题钮底色与对应扫描测

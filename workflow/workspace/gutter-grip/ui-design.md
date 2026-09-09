# UI Design: gutter-grip

> 只记录需要决策的界面与交互事项。拖动调宽逻辑、10px 命中区不改。

## 背景与范围

宽屏栏间 `.split-gutter::after` 几乎通栏，hover/focus 用纯 `--accent`（深色亮青），像一条顶天立地的灯管。改为**居中短柄**，默认淡、悬停略亮但仍短。

## 非目标

- 改 `GUTTER_PX`、拖动算法、localStorage
- 去掉 gutter 或改成边框分割
- 浅色/深色两套不同几何（同一短柄）

## 用户与关键场景

| 角色或场景 | 目标 | 备注 |
|---|---|---|
| 扫结构图 | 视线不被竖条切断 | 默认不要亮青通栏 |
| 拖栏宽 | 仍能抓住 10px 热区 | 短的是视觉条，不是命中区 |

## 信息架构与关键界面

```text
  tree |          structure
       |     ▌     ← 居中短柄（淡）
       |          命中区仍通栏 10px
```

树|结构 与 结构|Hex 共用同一规则。

## 关键流程

N/A：指针拖动与键盘左右箭头不变。

## 布局与视觉方向

- 构图与层级: `::after` 垂直居中，高度约 `2.5rem`；hover/focus 约 `3.5rem`，禁止再 `top/bottom` 拉满。
- 色彩: 默认 `color-mix(in srgb, var(--text-muted) 40%, transparent)`。hover/focus 用 `color-mix(in srgb, var(--accent) 40%, var(--border))`，**禁止**纯 `var(--accent)`。
- 明确避开: 新主色；加光晕 box-shadow。

## 组件与交互约定

| 区域或组件 | 约定 | 复用既有系统？ |
|---|---|---|
| `.split-gutter` 按钮 | 10px、`align-self: stretch` 不变 | 是 |
| `::after` 柄 | 短、圆角胶囊 | 是，只改伪元素 |

## 响应式与无障碍

| 项 | 约定 |
|---|---|
| 断点 / 适配 | 仍仅 ≥960px 显示 gutter |
| 键盘 / 焦点 | focus-visible 与 hover 同视觉，不恢复通栏 |
| 语义 / 对比度 | 默认弱对比；悬停可辨认即可，不必达到正文对比度 |

## 开放问题

N/A

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| 短柄难发现 | 偶发找不到拖手 | hover 略加长加亮；热区仍通栏 |

## 对 Plan 与 Developer 的要点

### Plan

- 扫描 `::after` 有固定 `height` 且非 `top`+`bottom` 拉满；hover 背景为 accent+border mix，不是纯 `--accent`

### Developer

- 只改 `styles.css` 里 `.split-gutter::after` / hover；不要动 `PageSplit.tsx` / `paneSplit.ts`

# UI Design: unify-module-radius-spacing

> 只记录需要决策的界面与交互事项。本项为纯样式整理：统一模块圆角、把偏大的模块间距整体收小约 10–20%。无信息架构、流程、组件交互变更。

## 背景与范围

- 用户诉求：统一各模块圆角与间距，当前间距偏大；截图指向 structure-map 表头 / tree section 顶部一带。
- 现状：`apps/web/src/styles.css`（2504 行）中 `border-radius` 有 `0/1/2/3/4/5/6/8/10/999px/50%` 共 11 种裸值；模块级 `gap/padding/margin` 有 `0.05–2rem` 数十种临时值，缺少词汇表。
- 本项范围：模块级容器（chrome、pane、panel、tree section、structure / hex / detail / WAL 卡片、heap peek、export capture）的圆角与容器间 / 容器内上下左右留白。
- 非目标：颜色、字体、对比度、focus ring、微型元素（chip、bit、图标、cell）内部间距、布局结构与 DOM 行为。

## 非目标

- 不新增 / 删除组件，不调整栅格、断点、滚动容器与交互行为。
- 不改任何 `.tsx`、不改文案、不改主题色 token（`--bg`、`--text` 等）。
- 不追求把所有 `0.05–0.12rem` 的微型间距纳入令牌；微型间距出范围，保留原值或按表保守映射。

## 用户与关键场景

| 角色或场景 | 目标 | 备注 |
|---|---|---|
| 使用 Page / WAL 视图的开发者 | 视觉更紧凑、模块边界更一致 | 间距偏大导致首屏信息密度低 |
| 键盘 / 无障碍用户 | 行为与焦点样式完全不变 | 本项不触碰 focus ring |

## 信息架构与关键界面

- 无变化。首屏仍为 chrome（标题行 + meta 行）→ `.main`（structure / hex 或 tree / WAL）。
- 仅容器内边距与圆角数值变化，信息层级与构图不变。

## 关键流程

| 步骤 | 用户动作 | 系统反馈 | 空态 / 加载 / 错误 |
|---|---|---|---|
| N/A | 无流程变更 | — | — |

## 布局与视觉方向

- 构图与层级：不变。只收小模块留白、收敛圆角档位。
- 色彩 / 字体 / 氛围：不变，继续用既有 `--surface` / `--border` / `--diagram-bg`。
- 明确避开：结构性 0 圆角（`.mode-btn`、`.free-band`、`.hex-cell`、`.wal-record-row`）与 pill / circle 语义必须保留；不得把结构零圆角“统一”成圆角。

### 圆角令牌（`--radius-*`）

主题无关，放在新增的独立 `:root { … }` 块（见下「令牌放置」）。6 档：

| 令牌 | 值 | 语义 / 使用层级 |
|---|---|---|
| `--radius-xs` | `2px` | 微型元素：bit / hex 网格、chip、小按钮、focus 圆角 |
| `--radius-sm` | `4px` | 标准控件与小组件：button、input、`.panel`、`.pane-tree`、`.region`、字段行、tip |
| `--radius-md` | `6px` | 中卡片：`.selection-detail`、`.conn-popover`、`.wal-fpi`、`.wal-detail-pane`、WAL 记录头/尾 |
| `--radius-lg` | `8px` | 大表面与浮层：`.structure-diagram`、`.hex`、`.wal-list-pane`、`.heap-peek-overlay`、内嵌 infomask 块 |
| `--radius-pill` | `999px` | 药丸：badge / chip / legend / 分隔条 |
| `--radius-circle` | `50%` | 圆形：`.flag-mark`、`.spinner` |

裸值处置：

| 旧值 | 去向 | 说明 |
|---|---|---|
| `0` | 保留（结构性） | `.mode-btn`、`.free-band`、`.hex-cell`、`.wal-record-row`；多角 0 形式保留 |
| `1px` | `--radius-xs` | tree table 图标 |
| `2px` | `--radius-xs` | focus 圆角 |
| `3px` | `--radius-xs` | bit / hex 网格、chip、posting-tid |
| `4px` | `--radius-sm` | 不变量，仅令牌化 |
| `5px` | `--radius-sm` | `.structure-row-grid` 略收小 |
| `6px` | `--radius-md` | 不变量，仅令牌化 |
| `8px` | `--radius-lg` | 不变量，仅令牌化 |
| `10px` | `--radius-lg` | 大表面由 10px 收到 8px，统一到一档 |
| `999px` | `--radius-pill` | 全部改为令牌 |
| `50%` | `--radius-circle` | 全部改为令牌 |

### 间距令牌（`--space-*`）

主题无关，与圆角同块。7 档，数值即“收小后”的目标值：

| 令牌 | 值 | 语义 |
|---|---|---|
| `--space-1` | `0.15rem` | 极小留白（原 0.2rem 级） |
| `--space-2` | `0.25rem` | 小留白（原 0.28–0.3rem 级） |
| `--space-3` | `0.35rem` | 中小留白（原 0.4–0.45rem 级） |
| `--space-4` | `0.45rem` | 中留白（原 0.5rem 级） |
| `--space-5` | `0.5rem` | 中偏大（原 0.55–0.6rem 级） |
| `--space-6` | `0.6rem` | 大留白（原 0.7–0.75rem 级） |
| `--space-7` | `0.75rem` | 特大留白（原 0.85–1rem 级） |

映射规则（模块级，整体收小约 10–20%；逐条 selector 的完整 before → after 见下节）：

| 旧值 | 新令牌 | 幅度 |
|---|---|---|
| `1rem` / `0.9rem` / `0.85rem` | `--space-7` (`0.75rem`) | −17%~−25% |
| `0.75rem` / `0.7rem` | `--space-6` (`0.6rem`) | −14%~−20% |
| `0.65rem` / `0.6rem` / `0.55rem` | `--space-5` (`0.5rem`) | −9%~−23% |
| `0.5rem` | `--space-4` (`0.45rem`) | −10% |
| `0.45rem` / `0.4rem` | `--space-3` (`0.35rem`) | −12%~−22% |
| `0.35rem` / `0.3rem` / `0.28rem` / `0.25rem` | `--space-2` (`0.25rem`) | 0%~−29% |
| `0.2rem` / `0.15rem` | `--space-1` (`0.15rem`) | 0%~−25% |
| `≤0.12rem`、`1px`、`2px`、`4px`、`6px` | 保留裸值 | 微型元素，出范围 |

### 令牌放置

- 在 `[data-theme="dark"]` 块（`styles.css` 第 70 行 `}`）之后、全局 `*, *::before, *::after` 之前，新增独立块：

```css
:root {
  --radius-xs: 2px;
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-pill: 999px;
  --radius-circle: 50%;
  --space-1: 0.15rem;
  --space-2: 0.25rem;
  --space-3: 0.35rem;
  --space-4: 0.45rem;
  --space-5: 0.5rem;
  --space-6: 0.6rem;
  --space-7: 0.75rem;
}
```

- 圆角 / 间距不随主题变化，故不进 `:root, [data-theme="light"]`，也不重复进 `[data-theme="dark"]`。

### 完整间距映射表（模块级）

> 未列出的属性保持原值；微型元素（`.field-cell`、`.structure-flow`、`.hex` 的 `1px` gap、`.infomask-bit-strip__bits` 的 `4px`、chip / bit 内边距等）明确出范围。

| 模块 | 选择器 | 属性 | before | after |
|---|---|---|---|---|
| chrome | `.chrome` | column-gap | `0.65rem` | `var(--space-5)` |
| chrome | `.chrome` | padding | `0.3rem 0.75rem 0` | `var(--space-2) var(--space-6) 0` |
| chrome | `.chrome-title` | gap | `0.4rem` | `var(--space-3)` |
| chrome | `.chrome-actions` | gap | `0.4rem` | `var(--space-3)` |
| chrome | `.chrome-theme` | padding | `0.35rem` | `var(--space-2)` |
| chrome | `.chrome-controls` | gap | `0.4rem 0.6rem` | `var(--space-3) var(--space-5)` |
| chrome | `.chrome-meta` | gap | `0.25rem` | `var(--space-2)` |
| chrome | `.chrome-meta` | padding | `0.35rem 0.75rem 0.4rem` | `var(--space-3) var(--space-6) var(--space-3)` |
| chrome | `.meta-row` | gap | `0.35rem 1rem` | `var(--space-3) var(--space-7)` |
| chrome | `.meta-controls-row` | gap | `0.45rem 1.1rem` | `var(--space-3) var(--space-7)` |
| chrome | `.meta-controls-row--stack` | gap | `0.45rem` | `var(--space-3)` |
| chrome | `.meta-stats` | gap | `0.2rem 1.1rem` | `var(--space-1) var(--space-7)` |
| chrome | `.meta-item` | gap | `0.25rem` | `var(--space-2)` |
| chrome | `.conn-popover` | padding | `0.45rem 0.55rem` | `var(--space-3) var(--space-5)` |
| chrome | `.conn-popover-line + .conn-popover-line` | margin-top | `0.25rem` | `var(--space-2)` |
| main | `.main` | padding / gap | `0.75rem` | `var(--space-6)` |
| main | `.main-split` | gap | `0.75rem` | `var(--space-6)` |
| main | `.pane` | gap | `0.5rem` | `var(--space-4)` |
| main | `.form-grid` | gap | `0.5rem` | `var(--space-4)` |
| main | `.panel` | padding | `0.75rem` | `var(--space-6)` |
| main | `.error-panel .next` | margin-top | `0.35rem` | `var(--space-3)` |
| structure | `.structure` | gap | `0.55rem` | `var(--space-5)` |
| structure | `.structure-diagram` | padding | `0.65rem 0.7rem 0.75rem` | `var(--space-5) var(--space-5) var(--space-6)` |
| structure | `.diagram-legend` | gap | `0.4rem 0.55rem` | `var(--space-3) var(--space-5)` |
| structure | `.diagram-legend` | margin-bottom | `0.15rem` | `var(--space-1)` |
| structure | `.structure-row` | gap | `0.45rem` | `var(--space-3)` |
| structure | `.structure-row-offset` | padding-top | `0.28rem` | `var(--space-2)` |
| structure | `.selection-detail-wrap` | margin-top / gap | `0.55rem` / `0.45rem` | `var(--space-5)` / `var(--space-3)` |
| structure | `.selection-detail__title` | padding-top | `0.55rem` | `var(--space-5)` |
| structure | `.selection-detail` | padding | `0.85rem 1rem 1rem` | `var(--space-7) var(--space-7) var(--space-7)` |
| structure | `.selection-detail` | gap | `0.85rem` | `var(--space-7)` |
| structure | `.selection-detail__header` | gap | `0.4rem` | `var(--space-3)` |
| structure | `.selection-detail__field` | gap | `0.35rem` | `var(--space-2)` |
| structure | `.selection-detail__infomask` | padding | `0.75rem 0.85rem` | `var(--space-6) var(--space-7)` |
| structure | `.selection-detail__section` | gap | `0.5rem` | `var(--space-4)` |
| structure | `.selection-detail .selection-meta` | padding-top | `0.75rem` | `var(--space-6)` |
| structure | `.selection-detail__columns strong` | margin-bottom | `0.25rem` | `var(--space-2)` |
| structure | `.selection-detail__columns ul` | gap | `0.4rem` | `var(--space-3)` |
| structure | `.selection-detail__highlight` | padding-top | `0.75rem` | `var(--space-6)` |
| structure | `.flag-list` | gap / margin-top | `0.28rem` / `0.35rem` | `var(--space-2)` / `var(--space-3)` |
| structure | `.flag-list .set, .flag-list .unset` | gap | `0.45rem` | `var(--space-3)` |
| structure | `.region` | padding | `0.4rem 0.5rem` | `var(--space-3) var(--space-4)` |
| hex | `.hex` | padding | `0.45rem 0.55rem` | `var(--space-3) var(--space-5)` |
| hex | `.hex-row` | gap | `0.45rem` | `var(--space-3)` |
| hex | `.hex-free-break` | padding | `0.05rem 0.4rem` | `0.05rem var(--space-3)` |
| hex | `.hex-free-break` | gap | `0.45rem` | `var(--space-3)` |
| infomask | `.infomask-bit-pair` | gap | `0.55rem` | `var(--space-5)` |
| infomask | `.infomask-bit-pair__strips` | gap | `0.35rem 0` | `var(--space-3) 0` |
| infomask | `.infomask-bit-pair__tip` | padding | `0.5rem 0.65rem` | `var(--space-4) var(--space-5)` |
| infomask | `.infomask-bit-pair__tip` | gap | `0.35rem 0.65rem` | `var(--space-3) var(--space-5)` |
| infomask | `.infomask-bit-pair__ref` | padding | `0.45rem 0.55rem` | `var(--space-3) var(--space-5)` |
| infomask | `.infomask-bit-strip` | margin-top | `0.45rem` | `var(--space-3)` |
| infomask | `.infomask-bit-strip__toolbar` | gap | `0.45rem 0.55rem` | `var(--space-3) var(--space-5)` |
| infomask | `.infomask-bit-strip__row` | gap | `0.45rem` | `var(--space-3)` |
| infomask | `.infomask-bit-strip__ref-list li` | gap | `0.4rem` | `var(--space-3)` |
| infomask | `.infomask-bit-strip__ref-close` | margin-top | `0.4rem` | `var(--space-3)` |
| btree | `.btree-field-section` | gap | `0.45rem` | `var(--space-3)` |
| btree | `.btree-field-row` | gap | `0.6rem` | `var(--space-5)` |
| btree | `.index-tuple-detail` | gap | `0.5rem` | `var(--space-4)` |
| btree | `.index-tuple-detail__key-values` | gap / padding | `0.25rem` / `0.45rem 0.6rem` | `var(--space-2)` / `var(--space-3) var(--space-5)` |
| btree | `.index-tuple-detail__key .key-bytes` | gap / padding | `0.25rem` / `0.45rem 0.6rem` | `var(--space-2)` / `var(--space-3) var(--space-5)` |
| btree | `.index-tuple-detail__posting` | gap | `0.3rem` | `var(--space-2)` |
| btree | `.posting-tid-list` | padding | `0.25rem 0.4rem` | `var(--space-2) var(--space-3)` |
| btree | `.posting-tid-list` | gap | `0.1rem 0.6rem` | `0.1rem var(--space-5)` |
| tree | `.pane-tree` | padding | `0.4rem 0.3rem` | `var(--space-3) var(--space-2)` |
| tree | `.tree-section + .tree-section` | padding-top | `0.15rem` | `var(--space-1)` |
| tree | `.tree-section-head` | padding | `0.28rem 0.2rem` | `var(--space-2) var(--space-1)` |
| tree | `.btree-tree-row` | padding-left / padding-right | `0.35rem` | `var(--space-3)` |
| tree | `.btree-tree-label` | gap | `0.28rem` | `var(--space-2)` |
| tree | `.btree-tree-error` | margin-left | `0.35rem` | `var(--space-3)` |
| tree | `.btree-tree-orphan` | margin-top / padding-top | `0.55rem` / `0.45rem` | `var(--space-5)` / `var(--space-3)` |
| wal | `.wal-layout` / `.wal-main` | gap | `0.55rem` | `var(--space-5)` |
| wal | `.wal-list-pane` | padding | `0.45rem 0.5rem 0.55rem` | `var(--space-3) var(--space-4) var(--space-5)` |
| wal | `.wal-list-pane > .panel` | margin | `0.15rem 0` | `var(--space-1) 0` |
| wal | `.wal-record-grid` | gap | `0.3rem 0.32rem` | `var(--space-2) var(--space-2)` |
| wal | `.wal-record-header` | padding | `0.48rem 0.55rem` | `var(--space-4) var(--space-5)` |
| wal | `.wal-record-row` | padding | `0.3rem 0.55rem` | `var(--space-2) var(--space-5)` |
| wal | `.wal-fpi` | gap / padding | `0.2rem` / `0.15rem 0.35rem` | `var(--space-1)` / `var(--space-1) var(--space-3)` |
| wal | `.wal-detail-pane` | padding | `0.85rem 1rem 1rem` | `var(--space-7) var(--space-7) var(--space-7)` |
| wal | `.wal-detail-summary` | gap | `0.4rem` | `var(--space-3)` |
| wal | `.wal-detail-summary .label` | margin-right | `0.35rem` | `var(--space-3)` |
| heap | `.heap-peek-backdrop` | padding | `0.75rem` | `var(--space-6)` |
| heap | `.heap-peek-header` | gap / padding | `0.75rem` / `0.5rem 0.85rem` | `var(--space-6)` / `var(--space-4) var(--space-7)` |
| heap | `.heap-peek-actions` | gap | `0.4rem` | `var(--space-3)` |
| heap | `.heap-peek-body` | padding / gap | `0.75rem` | `var(--space-6)` |
| heap | `.heap-peek-status` | padding | `0.75rem` | `var(--space-6)` |
| export | `.export-structure-capture` | padding / gap | `0.75rem 0.85rem 0.9rem` / `0.55rem` | `var(--space-6) var(--space-7) var(--space-7)` / `var(--space-5)` |

### 完整圆角映射表

| 选择器 | before | after |
|---|---|---|
| `button` | `4px` | `var(--radius-sm)` |
| `input` | `4px` | `var(--radius-sm)` |
| `.chrome-logo` | `0.28rem` | `var(--radius-sm)` |
| `.mode-switch` | `4px` | `var(--radius-sm)` |
| `.mode-btn` | `0` | `0`（结构性，保留） |
| `.table-select` / `.index-select` | `4px` | `var(--radius-sm)` |
| `.page-type-badge` / `.status-chip` / `.badge` | `999px` | `var(--radius-pill)` |
| `.conn-popover` | `6px` | `var(--radius-md)` |
| `*.::-webkit-scrollbar-thumb` | `8px` | `var(--radius-lg)` |
| `.split-gutter::after` | `999px` | `var(--radius-pill)` |
| `.panel` | `4px` | `var(--radius-sm)` |
| `.structure-diagram` | `10px` | `var(--radius-lg)` |
| `.legend-chip` | `999px` | `var(--radius-pill)` |
| `.structure-row-grid` | `5px` | `var(--radius-sm)` |
| `.free-band` | `0` | `0`（结构性，保留） |
| `.selection-detail` | `6px` | `var(--radius-md)` |
| `.selection-detail__infomask` | `8px` | `var(--radius-lg)` |
| `.region` | `4px` | `var(--radius-sm)` |
| `.hex` | `10px` | `var(--radius-lg)` |
| `.hex-row-grid` / `.hex-free-break` | `3px` | `var(--radius-xs)` |
| `.hex-cell` | `0` | `0`（结构性，保留） |
| `.hex-row.locate-flash` | `4px` | `var(--radius-sm)` |
| `.flag-mark` | `50%` | `var(--radius-circle)` |
| `.infomask-bit-pair__tip` / `.infomask-bit-pair__ref` | `6px` | `var(--radius-md)` |
| `.infomask-bit` / `.infomask-bit.is-natts-wide` | `3px` | `var(--radius-xs)` |
| `.infomask-bit-strip__help` | `999px` | `var(--radius-pill)` |
| `.infomask-bit-strip__tip-state` | `4px` | `var(--radius-sm)` |
| `.btree-field-row` | `4px` | `var(--radius-sm)` |
| `.posting-tid` | `3px` | `var(--radius-xs)` |
| `.detail-badge` | `999px` | `var(--radius-pill)` |
| `.index-tuple-detail__key-values` | `4px` | `var(--radius-sm)` |
| `.key-value-row--clickable .key-value-row__button:focus-visible` | `2px` | `var(--radius-xs)` |
| `.posting-tid-list` | `4px` | `var(--radius-sm)` |
| `.spinner` | `50%` | `var(--radius-circle)` |
| `.pane-tree` | `4px` | `var(--radius-sm)` |
| `.btree-tree-row[data-role="table"] .btree-tree-expander::before` | `1px` | `var(--radius-xs)` |
| `.btree-tree-kind` / `.btree-tree-chip` | `3px` | `var(--radius-xs)` |
| `.wal-list-pane` | `10px` | `var(--radius-lg)` |
| `.wal-list-pane > .panel` | `8px` | `var(--radius-lg)` |
| `.wal-record-list` | `0 0 6px 6px` | `0 0 var(--radius-md) var(--radius-md)` |
| `.wal-record-header` | `6px 6px 0 0` | `var(--radius-md) var(--radius-md) 0 0` |
| `.wal-record-row` | `0` | `0`（结构性，保留） |
| `.wal-fpi` / `.wal-detail-pane` | `6px` | `var(--radius-md)` |
| `.heap-peek-overlay` | `8px` | `var(--radius-lg)` |

## 组件与交互约定

| 区域或组件 | 约定 | 复用既有系统？ |
|---|---|---|
| chrome / meta | 仅 padding、gap 数值收小；grid 结构不动 | 是 |
| `.pane-tree` / `.tree-section*` | 顶部与节间留白收小，圆角统一 `--radius-sm` | 是 |
| `.structure-diagram` / `.hex` / `.wal-list-pane` | 大表面圆角 10px → 8px，padding 收小 | 是 |
| `.selection-detail` / WAL 卡片 | 圆角与内边距统一到 `--radius-md` / `--space-*` | 是 |
| badge / chip / pill | 圆角全部走 `--radius-pill`，视觉不变 | 是 |

## 响应式与无障碍

| 项 | 约定 |
|---|---|
| 断点 / 适配 | 无变化；`@media (min-width: 960px)` / `(max-width: 959px)` / `(max-width: 720px)` 规则原样保留 |
| 键盘 / 焦点 | 不变。` :focus-visible` outline 与其 `outline-offset` 不触碰；`border-radius` 变化不影响焦点可见性 |
| 语义 / 对比度 | 不变。不新增 / 修改颜色，不改变任何前景背景对 |

## 开放问题

- 无。若 Reviewer / QA 认为 10px → 8px 的大表面圆角收敛过大，可回退为新增 `--radius-xl: 10px`，属 Plan 内可调整项。

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| 收小间距导致长文本 / 控件拥挤 | 可读性下降 | 幅度限 10–20%；微型元素出范围；截图核对 |
| 裸值遗漏（如多角 `border-radius`） | 未统一 | 自动契约测试扫描全部 `border-radius` 声明 |
| 视觉回归无快照 | 肉眼差异难自动捕获 | 见 Plan「验证缺口」：Playwright + 真 PG 截图或人工核对 |

## 对 Plan 与 Developer 的要点

### Plan

- 引用本文件作为圆角 / 间距的唯一映射依据；令牌块位置、完整映射表以上文为准。
- 增加 CSS 契约测试 `apps/web/src/designTokens.test.ts`（读 `styles.css`）。

### Developer

- 仅改 `apps/web/src/styles.css` 与新增测试；不得改 `.tsx`、主题 token、focus 规则、结构性 0 圆角与 pill / circle。
- 令牌块按「令牌放置」原样插入；替换后 `styles.css` 中不应再出现裸的 `1px/2px/3px/5px/8px/10px/999px/50%` 圆角值。
- 微型元素间距保持原值，不要顺手扩大范围。

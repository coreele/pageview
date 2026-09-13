# UI Design: flat-split-dividers

> 只记录需要决策的界面与交互事项。不适用的节标 `N/A` 并一句说明。

## 背景与范围

- 现状（宽屏 Page 布局，`@media (min-width: 960px)` + `.main.main-paged`）：chrome 下方三栏由 `.main-split` 网格承载，顺序为 `.pane-tree`（Tree 目录）→ `.split-gutter` → `.pane-structure`（内含 `.structure-diagram`）→ `.split-gutter` → `.pane-hex`（内含 `.hex`）。三块各自是带边框 + 圆角 + 背景的卡片：
  - `.pane-tree`（`styles.css:1902`）：`background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: var(--space-3) var(--space-2);`
  - `.structure-diagram`（`styles.css:638`）：`background: var(--diagram-bg); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: inset 0 1px 0 …;`
  - `.hex`（`styles.css:1131`）：`background: var(--diagram-bg); border: 1px solid var(--border); border-radius: var(--radius-lg);`
- 拖动交互已存在且可用：`SplitGutter`（`PageSplit.tsx:13`）是 `<button className="split-gutter">`，10px 命中区，pointer 拖动 + ArrowLeft/Right 16px 步进，拖动时给 `html` 加 `is-split-dragging`；宽度由 `paneSplit.ts`（`GUTTER_PX = 10`、`pageSplitTemplate`、localStorage `pg-page-viewer.split.v2`）管理。
- 本项只改**视觉外观**：宽屏三区去卡片化，仅保留两条可拖动的竖向分割线；窄屏堆叠布局保持现状。

## 非目标

- 不改拖动行为、限位、持久化、键盘步进、无障碍语义（`PageSplit.tsx` / `paneSplit.ts` 逻辑不动）。
- 不改 `GUTTER_PX`（保持 10）与 `pageSplitTemplate` 的列模板。
- 不改窄屏（`< 960px`）堆叠布局与卡片外观。
- 不改 HeapPeek 浮层（`HeapPeekOverlay`）内的 `.main-split`：它在 `.main` 之外、不带 `.main-paged`，天然不受影响，保持卡片。
- 不改结构图 / hex 内部配色与内容。

## 用户与关键场景

| 角色或场景 | 目标 | 备注 |
|---|---|---|
| 宽屏查看 Page 的用户 | 三区更简洁，视觉上不被卡片边框切割，注意力在数据本身 | 主要诉求 |
| 需要调节栏宽的用户 | 拖动两条竖线或键盘方向键调节 Tree/Hex 宽度 | 交互不变，仅把手由药丸改为细线 |
| 窄屏用户 | 维持上下堆叠的卡片可读性 | 明确不动 |

## 信息架构与关键界面

- 首屏构图不变：chrome 下方仍是 Tree 目录 | Structure map | Hex dump 三栏，顺序、列数、可折叠关系均不变。
- 变化仅在视觉层：三块由「三张卡」变为「同一平面上的三块内容」，边界由两条贯穿整栏高度的竖线表达。
- 单一构图：两条竖线是唯一的分隔元素，不再有边框、圆角、投影等第二套边界语言。

## 关键流程

| 步骤 | 用户动作 | 系统反馈 | 空态 / 加载 / 错误 |
|---|---|---|---|
| 悬停分割线 | 指针移到 10px 命中区 | 线由 1px `var(--border)` 变为 2px 强调色混合，光标 `col-resize` | N/A |
| 拖动分割线 | 按住拖动 | `html.is-split-dragging`：线 2px `var(--accent)`，全局 `col-resize` + 禁选 | 已有逻辑，不改 |
| 键盘调节 | 聚焦分割线后按 ←/→ | 线获 `:focus-visible` 高亮（同悬停态），每步 16px | 已有逻辑，不改 |
| 窄屏查看 | 视口 < 960px | 三块恢复上下堆叠卡片外观，分割线隐藏 | 现状 |

## 布局与视觉方向

- 构图与层级：宽屏三区平铺，列模板与 `gap: 0` 均不变；10px 分割线列居中放 1px 竖线，靠线本身与背景缝隙区分三区。
- 卡片化移除（仅宽屏 `.main-paged` 作用域）：对 `.pane-tree`、`.pane-structure > .structure-diagram`、`.pane-hex > .hex` 三者在 `@media (min-width: 960px)` 内统一去掉：
  - `border: 0;`（去掉边框，消除双线来源）
  - `border-radius: 0;`（去掉圆角）
  - `box-shadow: none;`（去掉 `.structure-diagram` 的内阴影顶高光）
- 背景决策：**保留** `--surface` / `--diagram-bg` 区域背景，不改为透明。理由：
  - 树面板的粘性 `.tree-section-head` 背景是 `var(--surface)`、hover 是 `color-mix(border 22%, surface)`；结构图区域色 `--region-*` 也以 `--surface` 为基底。若区域背景改透明（露出 `--bg` 与 body 径向渐变），会出现与内部色块不一致的补丁，且暗色下 `--bg (#0b1218)` 比 `--diagram-bg (#101820)` 更暗，削弱内容层次。
  - 「模块化卡片」的观感来自边框 + 圆角 + 投影，而非背景；保留背景即可保证明暗两套主题下的可读性，同时去掉卡片语言。
- 色彩 / 字体 / 氛围：
  - 分割线默认 `var(--border)`（亮 #c5d0da / 暗 #2a3845），低调。
  - 悬停 / 聚焦 / 拖动用 `color-mix(in srgb, var(--accent) 55%, var(--border))`（拖动态用纯 `var(--accent)`），与既有 accent 语言一致。
  - 不新增设计 token；沿用现有 CSS 变量。
- 明确避开：不要给区域或 gutter 再加 `border`（避免双线）；不要用药丸 / 短条把手；不要改内部区域配色。

### 分隔线视觉规格（精确）

- 命中区：`.split-gutter` 维持 `width: 10px`、`background: transparent`、`cursor: col-resize`、`align-self: stretch`、`position: relative`。**不改** `width` 与 `GUTTER_PX`。
- 线体：`.split-gutter::after`
  - `content: ""; position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; transform: translateX(-50%); background: var(--border);`
  - 即贯穿 gutter 全高的 1px 居中竖线；**移除**旧 `height: 2.5rem` / `top: 50%` / `transform: translate(-50%, -50%)` / `border-radius: var(--radius-pill)` / 旧半透明 muted 背景。
- 悬停 / 聚焦：`.split-gutter:hover::after, .split-gutter:focus-visible::after { width: 2px; background: color-mix(in srgb, var(--accent) 55%, var(--border)); }`；并加 `.split-gutter:focus-visible { outline: none; }`，用线体高亮替代默认矩形 focus ring（与 `.field-cell` / `.free-band` 既有 `outline: none` + `::after` 模式一致）。
- 拖动态：`html.is-split-dragging .split-gutter::after { width: 2px; background: var(--accent); }`。`html.is-split-dragging` 的全局 `col-resize` + `user-select: none` 保持不变。
- 无药丸、无圆角、无短条。

### 宽屏 before / after 示意

```text
Before（三张卡片）
┌───────────┐  ┌──────────────────────────────┐  ┌────────────────────┐
│ Tree      │  │ Structure                    │  │ Hex                │
│ 圆角/边框 │  │ 圆角/边框/内阴影             │  │ 圆角/边框          │
└───────────┘  └──────────────────────────────┘  └────────────────────┘
      药丸把手                 药丸把手

After（平铺三区 + 两条竖线）
 Tree 目录         │  Structure map              │  Hex dump
 （surface 背景）  │  （diagram 背景）           │  （diagram 背景）
                   │                             │
                   │                             │
                可拖动（1px 线，悬停 2px）    可拖动
```

## 组件与交互约定

| 区域或组件 | 约定 | 复用既有系统？ |
|---|---|---|
| `.pane-tree` | 宽屏去掉 border / radius / shadow；保留 `--surface` 背景与现有 padding | 是，仅覆盖外观 |
| `.pane-structure > .structure-diagram` | 宽屏去掉 border / radius / shadow；保留 `--diagram-bg` 与 padding | 是 |
| `.pane-hex > .hex` | 宽屏去掉 border / radius；保留 `--diagram-bg` 与 padding | 是 |
| `.split-gutter` | 命中区 10px 不变；`::after` 改全高 1px 竖线；悬停/聚焦 2px accent 混合；拖动 2px accent | 是 |
| 窄屏三区 | 保持卡片外观（base 规则不动） | 是 |
| HeapPeek 浮层 | 不带 `.main-paged`，保持卡片 | 是 |

### 间距与「无双线」

- 三区各自现有内边距**保持不变**，避免布局抖动：
  - `.pane-tree`：`var(--space-3) var(--space-2)`；
  - `.structure-diagram`：`var(--space-5) var(--space-5) var(--space-6)`；
  - `.hex`：`var(--space-3) var(--space-5)`。
- 宽屏 `.main-paged .main-split` 已 `gap: 0`，10px gutter 是唯一分隔带；线居中，故每块内容边界距线各约 5px，再加各自内边距，无需新增外边距。
- 因宽屏三区 `border` 全部移除，分隔只由 gutter 中 1px 线表达，不存在「区域边框 + 分割线」双线问题。
- 不新增 padding 覆盖；`GUTTER_PX = 10` 与 `pageSplitTemplate` 保持原样。

## 响应式与无障碍

| 项 | 约定 |
|---|---|
| 断点 / 适配 | 平铺与竖线仅在 `@media (min-width: 960px)` 且 `.main-paged` 下生效；`< 960px` 堆叠布局维持卡片，分割线 `display: none` |
| 键盘 / 焦点 | 分割线仍是可聚焦 `<button>`，`aria-label`（`Resize tree pane` / `Resize hex pane`）不变；←/→ 16px 步进不变；`:focus-visible` 线体高亮 2px，`outline: none` |
| 语义 / 对比度 | 线默认 `var(--border)` 在亮/暗背景上均可见；悬停/聚焦/拖动用 accent 混合或纯 accent，对比不低于现状；不引入低对比文本 |

## 开放问题

- 无阻塞性开放问题。背景保留 vs 透明的取舍已在「布局与视觉方向」定案为保留，理由如上。

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| 覆盖规则若未限定 `.main-paged`，窄屏卡片也会被去边框 | 窄屏可读性下降 | 新规则放入 `@media (min-width: 960px)` 且选择器前缀 `.main-paged`；用测试断言 base 规则仍有 border |
| 只写 `border: 0` 而漏 `border-radius: 0` | 背景仍显圆角，卡片感残留 | 三属性一起覆盖；测试断言 `border-radius: 0` |
| 新增 `border-radius` 字面量 | `designTokens.test.ts` V-2 失败 | 使用 `border-radius: 0`（结构零）或 token；`::after` 不再用圆角 |
| 药丸旧断言残留 | `paneSplit.test.ts` 失败 | 改写该 describe 为新线体合同 |
| HeapPeek 浮层被误伤 | 浮层内面板丢卡片 | 作用域限定 `.main-paged`，浮层在 `.main` 外，天然隔离 |

## 对 Plan 与 Developer 的要点

### Plan

- 触碰 `apps/web/src/styles.css` 与 `apps/web/src/paneSplit.test.ts`；`README*.md` 先核查，若无描述则标 `N/A`。
- 最低验证层 `unit + static + build + manual`；把本文件的分隔线精确规格与作用域断言转成 `V-n`。
- 明确不改 `PageSplit.tsx` / `paneSplit.ts` 行为。

### Developer

- 只在 `@media (min-width: 960px)` 内新增/扩展 `.main-paged` 覆盖，保持 base 卡片规则不动。
- 推荐新增独立块（便于测试与阅读）：

```css
/* flat-split-dividers: wide paged panes lose card chrome; narrow keeps it. */
@media (min-width: 960px) {
  .main-paged .pane-tree,
  .main-paged .pane-structure > .structure-diagram,
  .main-paged .pane-hex > .hex {
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }
}
```

- 改写 `.split-gutter::after` 及其 hover/focus 规则为「全高 1px 线 + 悬停/聚焦 2px accent 混合」，补 `:focus-visible { outline: none }` 与 `html.is-split-dragging .split-gutter::after`。
- 同步改写 `paneSplit.test.ts` 中 `"split gutter grip (gutter-grip V-1 / V-2)"` describe：新断言覆盖线体规格、hover 规格、`border-radius` 移除、以及「宽屏去边框、base 保留边框」的作用域断言。
- 不改 `border-radius` token；`border-radius: 0` 为结构零，符合 `designTokens.test.ts`。

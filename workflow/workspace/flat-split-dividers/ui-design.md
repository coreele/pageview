# UI Design: flat-split-dividers

> 只记录需要决策的界面与交互事项。不适用的节标 `N/A` 并一句说明。

## 背景与范围

- 现状（宽屏 Page 布局，`@media (min-width: 960px)` + `.main.main-paged`）：chrome 下方三栏由 `.main-split` 网格承载，顺序为 `.pane-tree`（Tree 目录）→ `.split-gutter` → `.pane-structure`（内含 `.structure-diagram`）→ `.split-gutter` → `.pane-hex`（内含 `.hex`）。三块各自是带边框 + 圆角 + 背景的卡片：
  - `.pane-tree`（`styles.css:1902`）：`background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: var(--space-3) var(--space-2);`
  - `.structure-diagram`（`styles.css:638`）：`background: var(--diagram-bg); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: inset 0 1px 0 …;`
  - `.hex`（`styles.css:1131`）：`background: var(--diagram-bg); border: 1px solid var(--border); border-radius: var(--radius-lg);`
- 拖动交互已存在且可用：`SplitGutter`（`PageSplit.tsx:13`）是 `<button className="split-gutter">`，10px 命中区，pointer 拖动 + ArrowLeft/Right 16px 步进，拖动时给 `html` 加 `is-split-dragging`；宽度由 `paneSplit.ts`（`GUTTER_PX = 10`、`pageSplitTemplate`、localStorage `pg-page-viewer.split.v2`）管理。
- 本项只改**视觉外观**：宽屏三区去卡片化，仅保留两条可拖动的竖向分割线；窄屏堆叠布局保持现状。
- 追加细化（合并前用户反馈，附参考截图）：宽屏三区与两条分割线需**全出血**——参考编辑器式三栏，移除 `.main` 外层留白，背景与分割线贴到视口左/右/下边缘；窄屏保持不变。

## 非目标

- 不改拖动行为、限位、持久化、键盘步进、无障碍语义（`PageSplit.tsx` / `paneSplit.ts` 逻辑不动）。
- 不改 `GUTTER_PX`（保持 10）与 `pageSplitTemplate` 的列模板。
- 不改窄屏（`< 960px`）堆叠布局与卡片外观。
- 不改 HeapPeek 浮层（`HeapPeekOverlay`）内的 `.main-split`：它在 `.main` 之外、不带 `.main-paged`，天然不受影响，保持卡片。
- 不改结构图 / hex 内部配色与内容。
- 不改 detail 区的内容渲染（`renderDetail`）与折叠逻辑，也不改 `#selection-detail-panel` 的 id 与 chrome `Detail` 按钮的 `aria-controls`；只去可见标题与卡片外观。

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
- 背景决策（合并前二次细化）：宽屏下 gutter 与三区统一为不透明 `var(--surface)`，构成单一平面，见下「单一平面背景」；base 的 `--surface` / `--diagram-bg` 卡片背景在窄屏保持不变。
  - 保留不透明背景、不改透明的理由：树面板的粘性 `.tree-section-head` 背景是 `var(--surface)`、hover 是 `color-mix(border 22%, surface)`；结构图区域色 `--region-*` 也以 `--surface` 为基底。若区域背景改透明（露出 `--bg` 与 body 径向渐变），会出现与内部色块不一致的补丁，且暗色下 `--bg (#0b1218)` 比 `--diagram-bg (#101820)` 更暗，削弱内容层次。
  - 「模块化卡片」的观感来自边框 + 圆角 + 投影，而非背景；保留不透明背景即可保证明暗两套主题下的可读性，同时去掉卡片语言。
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

### 全出血（边缘无留白，仅宽屏）

- 目标：参考编辑器式三栏，宽屏下 Tree / Structure / Hex 三区背景与两条分割线**贴到视口边缘**，四周无外层留白；内容仍与边缘/分割线保持内边距。
- 唯一来源是 `.main` 的外边距：base `.main { padding: var(--space-6); … }`（`styles.css:484`）在宽屏 `.main-paged` 下未覆盖，故出现四周留白。做法：
  - 在 `@media (min-width: 960px)` 内新增/扩展 `.main-paged { padding: 0; }`（可追加进既有 `.main-paged` 块 `styles.css:1843`，或放入独立的宽屏覆盖块；二者等价）。
  - base `.main` 的 `padding: var(--space-6)` **保持不变**（窄屏与 HeapPeek 依赖它）。
- `.main` 的 `gap: var(--space-6)` 不产生外缘留白：它只作用于 `.main` 的多个 flex 子项之间（如 error/notice 面板与 `.main-split`）。宽屏正常路径下 `.main-split` 为唯一子项，gap 无效果，**不改** `gap`。若出现 error/notice 面板，面板会随 `padding: 0` 一同贴边，属可接受结果。
- 结果：三区背景与两条竖线左起视口左缘、右抵视口右缘、下抵视口底缘，顶部紧接 chrome 下方；列模板与 `gap: 0` 不变，故三块与两条 10px gutter 无缝平铺。
- 区域**内边距保留**（`.pane-tree` / `.structure-diagram` / `.hex` 的既有 padding 见下节），内容不贴分割线与视口边缘；仅移除 `.main` 外层留白。
- 窄屏（`< 960px`）**不变**：`.main-paged` 不生效，`.main` 仍为 `padding: var(--space-6)`，三区维持卡片外观与堆叠间距。

### 宽屏 before / after 示意

```text
Before（三张卡片）
┌───────────┐  ┌──────────────────────────────┐  ┌────────────────────┐
│ Tree      │  │ Structure                    │  │ Hex                │
│ 圆角/边框 │  │ 圆角/边框/内阴影             │  │ 圆角/边框          │
└───────────┘  └──────────────────────────────┘  └────────────────────┘
      药丸把手                 药丸把手

After（平铺三区 + 两条竖线 + 全出血，边缘无留白）
 Tree 目录         │  Structure map              │  Hex dump
 （surface 背景）  │  （diagram 背景）           │  （diagram 背景）
                   │                             │
                   │                             │
                可拖动（1px 线，悬停 2px）    可拖动
 ↑ 贴视口左缘                                                        贴视口右缘 ↑
 ↓ 三区背景与两条竖线延伸至视口底缘（顶接 chrome）
```

- before/after 间距：改前 `.main` 四周为 `var(--space-6)` 留白，三块不触边；改后宽屏 `.main-paged` 的 `padding: 0` 去掉该留白，三块背景与竖线全出血。窄屏仍保留 `.main` 留白。
- 交互后果：`.main` / 区域内部滚动条现在位于视口最右缘；最右侧分割线与 Tree 左缘的命中区贴边，鼠标在视口边缘即可拖动。

### 单一平面背景（gutter 不透明 + 三区统一 `--surface`）

- 追加细化（合并前用户再次反馈：「竖线也应该保持干净，不要有阴影」）。诊断（用真实 `styles.css` 静态复刻 + Playwright 计算样式核对）：
  - `.split-gutter` 为 `background: transparent`（计算值 `rgba(0, 0, 0, 0)`），10px 命中区透出 `body` 的 `--bg` 及其径向渐变；该底色比三区 `--surface (#f7fafc)` / `--diagram-bg (#f1f5f8)` 更暗且带色，在 1px 线两侧各形成约 5px 的暗色渐变带，观感即「阴影」。
  - 所有相关元素 `box-shadow` 计算值均为 `none`，区域卡片 chrome 已移除；故这是「透明 gutter 透出 body 背景」的纯背景效应，不是投影。
- 决策：宽屏 `@media (min-width: 960px)` 的 `.main-paged` 作用域内，把 gutter 与三区放到**同一平面背景**：
  - `.main-paged .split-gutter { background: var(--surface); }`（不透明，body 渐变不再透出）。
  - 三区统一为 `var(--surface)`：在既有宽屏覆盖块（当前 `border: 0; border-radius: 0; box-shadow: none;`）追加 `background: var(--surface);`，作用于 `.main-paged .pane-tree`、`.main-paged .pane-structure > .structure-diagram`、`.main-paged .pane-hex > .hex`。
  - 结果：整个 paged 区域是一块平坦的 `--surface` 表面，仅由两条 1px `var(--border)` 竖线分隔，与用户参考编辑器布局一致。
- 为何统一三区背景而非只改 gutter：`--diagram-bg` 原本只是结构图 / hex 的画布底色；结构网格单元与 hex 文本自带颜色，改用 `--surface` 不损失对比。若保留 structure / hex 的 `--diagram-bg` 而只把 gutter 设为 `--surface`，gutter 与相邻区域间仍会出现 `--surface` / `--diagram-bg` 的细微色带，等于把「阴影」换成浅色带，故统一。
- 区域**内边距不变**；窄屏（`< 960px`）不变（`.main-paged` 不生效，base `--surface` / `--diagram-bg` 卡片背景与 `.main` 留白保持）。

```text
Before（gutter 透明，透出 body 深色渐变）
  Tree（surface）  ▓▓▓│▓▓▓  Structure（diagram-bg）  ▓▓▓│▓▓▓  Hex（diagram-bg）
                    ↑ 线两侧各约 5px 暗色渐变带，观感为阴影

After（单一 --surface 平面）
  Tree（surface）   │  Structure（surface）   │  Hex（surface）
                    ↑ 仅 1px var(--border) 竖线，两侧同色无带
```

### 结构图底部 detail 平铺（追加细化）

- 追加细化（合并前用户第三次反馈，附结构面板底部截图）：「继续优化底部 detail 区域，去掉 detail 文字，取消圆角矩形，直接嵌入下方，用一条横线做分割」。
- 现状：`.selection-detail-wrap`（`styles.css:1009`）为横向 flex，左侧固定宽 `2.85rem` 的 `.selection-detail__title`（文本 `detail`，`styles.css:1021`），右侧 `.selection-detail`（`styles.css:1035`）同时带 `.panel`（`border` + `--radius-sm` + `--surface` 背景 + `--space-6` padding）与自身 `color-mix` 背景 + `--radius-md` + `--space-7` padding + `max-width: calc(100% - 2.85rem - var(--space-3))`，形成「标签 + 圆角卡片」。
- 目标：detail 作为结构图的下一个子区块，去掉可见标题与卡片语言，仅以一条水平线与上方结构图分隔。
- DOM（`StructureMap.tsx:839-861`）：删除 `.selection-detail__title` 元素；保留 `id="selection-detail-panel"` 与 `className="panel selection-detail"`（chrome 的 `Detail` 按钮 `aria-controls` 与折叠逻辑依赖该 id，见 `App.tsx:1934`）。
- CSS：
  - `.selection-detail-wrap`：由横向 flex 改为单列块；移除 `display: flex; flex-direction: row; align-items: flex-start; gap: var(--space-3);`；保留 `margin-top: var(--space-5)`、`width: auto`、`min-width: 0`；新增 `padding-top: var(--space-4); border-top: 1px solid var(--border);`（横线即唯一分隔）。`max-width` 与水平边距在下方「底部横线全宽」进一步细化为 `max-width: none` + 负水平外边距。
  - `.selection-detail`：覆盖 `.panel` 的卡片外观——`border: 0; border-radius: 0; background: transparent; padding: 0; max-width: 100%;`（`max-width` 不再减去标题列宽）；保留 `flex: 1 1 auto; width: auto; min-width: 0; box-sizing: border-box;` 与内部 `gap: var(--space-7)`（仍分隔 header / body / highlight）。
  - 删除不再使用的 `.selection-detail__title` 规则。
  - 覆盖可行性：`.panel`（`styles.css:619`）与 `.selection-detail` 同为单类选择器（特异度 0,1,0），`.selection-detail` 源码在后，故其声明胜出；无需提高特异度或 `!important`。
  - 作用域决策：**全局生效（宽屏与窄屏一致）**。理由：detail 是结构图（`.structure-diagram`）的子区块，标题移除是全局 DOM 变更；窄屏下结构图仍是外层卡片，其内部 detail 去卡片后以同一条 `border-top` 横线嵌入卡片内，观感一致且更简洁。「窄屏保持卡片」仅指 `.structure-diagram` 外层卡片，与本决策不冲突。
  - 内部子分隔决策：`.selection-detail .selection-meta` 的实线 `border-top`（`styles.css:1094`）与 `.selection-detail__highlight` 的虚线 `border-top`（`styles.css:1120`）**保留**。它们分隔 detail 内部小节（meta / highlight），与 wrap 顶部的横线语义不同；去掉会使内部层级糊成一片。若实施中发现顶部横线与紧邻的首个内部横线读起来重复，可只去掉首个并在 `dev-notes.md` 说明。
- 无障碍：`.selection-detail__title` 为纯装饰文本；`#selection-detail-panel` 是无 `role` / `aria-label` 的 `<div>` 容器，其可访问性由 chrome `Detail` 按钮的 `aria-controls="selection-detail-panel"` 与 `aria-expanded` 承载。删除标题不改变可访问名或语义，无回归。

#### 底部横线全宽（追加细化）

- 追加细化（合并前用户第四次反馈，附截图）：detail 顶部横线两端各有一小段空隙，要求延长到结构面板两端贴边。
- 根因：`.selection-detail-wrap` 是 `.structure-diagram`（`styles.css:646`）的直接 flex 子项，而后者有 `padding: var(--space-5) var(--space-5) var(--space-6)`；`border-top` 只跨内容宽度，故左右各空出 `var(--space-5)`。
- 做法（负外边距抵消容器水平 padding，再用等量内边距把内容放回原位）：
  - `.selection-detail-wrap` 增加 `margin-left: calc(-1 * var(--space-5)); margin-right: calc(-1 * var(--space-5));`——抵消 `.structure-diagram` 的水平 padding，使 `border-top` 抵达其 padding box 两端（即内侧边框内缘）。
  - 增加 `padding-left: var(--space-5); padding-right: var(--space-5);`——保持 detail 内容与上方结构行对齐。
  - 增加 `max-width: none;`——必须显式覆盖原有 `max-width: 100%`，否则会把负边距拉伸后的宽度夹回内容宽度，横线仍留空隙。
  - 保留 `margin-top: var(--space-5)`、`width: auto`、`min-width: 0`、`padding-top: var(--space-4)`、`border-top: 1px solid var(--border)`。
- 对齐与无溢出：`.structure-diagram` 是列向 flex 容器（同时带 `.structure` 的 `display:flex; flex-direction:column`），wrap 默认 `align-self: stretch`，负水平外边距使 wrap 的 border box 扩张到 padding box 宽度；等量 `padding-left/right` 把内容推回原内容框，故内容对齐不变、横线贴两端。wrap 的 margin box 仍落在 `.structure-diagram` 内容框内，`overflow-x: auto` 不产生新的横向滚动（横线不超出 border box）。
- 作用域决策：**全局生效（宽屏与窄屏一致）**，与已全局的 detail 平铺保持一致；无需只限宽屏。窄屏下 `.structure-diagram` 仍是外层卡片，横线延伸至卡片的 padding box 两端（卡片内侧边框内缘），观感为卡片内一条满宽横线，可接受。
- before/after：改前横线左右各短 `var(--space-5)`；改后横线贴结构面板 padding box 两端，detail 文本左缘与结构行左缘仍在同一竖线上。

```text
Before（左侧 detail 标签 + 圆角卡片）
  Structure map
  ┌────────────────────────────────────────────┐
  │  ... rows ...                              │
  └────────────────────────────────────────────┘
   detail  ╭──────────────────────────────────────╮
           │ field label                          │
           │ value / flags / highlight            │
           ╰──────────────────────────────────────╯

After（无标签、无卡片、顶部横线两端贴 padding box）
  Structure map
  ┌────────────────────────────────────────────┐
  │  ... rows ...                              │
  └────────────────────────────────────────────┘
  ───────────────────────────────────────────────   ← 两端贴结构面板内缘，无空隙
  field label
  value / flags / highlight
```

##### 横线接入竖向分割线（追加细化）

- 追加细化（合并前用户第五次反馈，附放大截图）：detail 顶部横线左右两端虽已贴结构面板 padding box，但与两条竖向分割线之间仍各有一段空隙；要求横线与竖线相接、无空隙。
- 根因（用真实 `styles.css` 静态复刻 + Playwright 测量确认）：
  - 竖向分割线居中于 10px 可拖动 gutter（`paneSplit.ts` 的 `GUTTER_PX = 10`；`.split-gutter::after { left: 50%; transform: translateX(-50%); }`），故线实际位于 pane 边缘 ± 5px。
  - `.selection-detail-wrap` 经「底部横线全宽」只延伸到结构面板 padding box 两端（复刻中为 230..750），而竖线在 225 与 755，故左右各剩 5px 空隙。
- 做法（仅宽屏 `@media (min-width: 960px)` 的 `.main-paged` 作用域；复刻实测 wrap 225..755，内容仍与结构行对齐、无阴影带）：
  1. **把平铺背景从 gutter 移到网格容器**：`.main-paged .main-split` 增加 `background: var(--surface);`；同时**移除** `.main-paged .split-gutter` 的 `background: var(--surface)`，恢复其透明。这样 gutter 区域不再透出 body 渐变（无阴影带），同时结构面板的 overflow 可以画到透明 gutter 上。
  2. **让结构面板溢出到 gutter**：`.main-paged .pane-structure` 设 `overflow: visible;`（原 `overflow: hidden`），`.main-paged .pane-structure > .structure-diagram` 也设 `overflow: visible;`（原先继承 base 的 `overflow-x: auto`）。
  3. **把 detail 横线延伸到 gutter 中线**：`.selection-detail-wrap` 的水平负外边距与内边距各再加半个 gutter（`5px`，即 `GUTTER_PX / 2`）：
     - `margin-left: calc(-1 * (var(--space-5) + 5px)); margin-right: calc(-1 * (var(--space-5) + 5px));`
     - `padding-left: calc(var(--space-5) + 5px); padding-right: calc(var(--space-5) + 5px);`
     - 保留 `max-width: none` 与其余声明；加注释说明 `5px` 为 10px gutter 的一半。
- 绘制顺序（paint order）说明：`.pane-structure` 是位于两条 gutter 之间的网格项；gutter 透明、其下是 `.main-split` 的 `--surface`，故横线可穿过 gutter 显示并接到两条竖线（第二条 gutter 的 1px 竖线画在横线穿越点之上，仍相接）。
- `overflow: visible` 的后果：`.structure-flow` 仍是内部滚动容器（宽屏块内 `overflow: auto`），不会新增页面或面板级滚动条；结构面板本身不再裁剪，允许 detail 横线溢出到 gutter。base 的 `overflow-x: auto`（`.structure-diagram`）在宽屏被覆盖为 `visible`，窄屏不变。
- 作用域：**仅宽屏**（`.main-paged` + `@media (min-width: 960px)`）。窄屏布局不变：detail 横线仍内缩于卡片内，不延伸到卡片外。
- before/after：改前横线到结构面板边缘（复刻 230..750），距竖线各 5px；改后横线到 gutter 中线（复刻 225..755），两端与竖线相接，detail 文本左缘仍与结构行左缘对齐（复刻 diff=0）。

```text
Before（横线止于结构面板边缘，距竖线各 5px）
   │ Tree        Structure             Hex │
   │             ┌──────────────┐          │
   │             │  ... rows ...│          │
   │             └──────────────┘          │
   │             ─────────────────  ← 5px →│← 空隙
   │               ↑ 225          230   755│

After（横线穿过 gutter 接到竖线）
   │ Tree        Structure             Hex │
   │             ┌──────────────┐          │
   │             │  ... rows ...│          │
   │             └──────────────┘          │
   │  ───────────┼──────────────────┼──────│   ← 横线 225..755，与两条竖线相接
   │             ↑225             755↑
```

## 组件与交互约定

| 区域或组件 | 约定 | 复用既有系统？ |
|---|---|---|
| `.pane-tree` | 宽屏去掉 border / radius / shadow；背景统一为 `--surface` 与现有 padding | 是，仅覆盖外观 |
| `.pane-structure > .structure-diagram` | 宽屏去掉 border / radius / shadow；背景统一为 `--surface`，padding 不变 | 是 |
| `.pane-hex > .hex` | 宽屏去掉 border / radius；背景统一为 `--surface`，padding 不变 | 是 |
| `.split-gutter` | 命中区 10px 不变；宽屏 `background: transparent`（平铺背景移到 `.main-paged .main-split`）；`::after` 改全高 1px 竖线；悬停/聚焦 2px accent 混合；拖动 2px accent | 是 |
| `.main-paged .main-split` | 宽屏 `background: var(--surface)`（平铺背景的唯一来源，位于透明 gutter 之下） | 是 |
| `.main-paged .pane-structure` / `> .structure-diagram` | 宽屏 `overflow: visible`，允许 detail 横线溢出到 gutter 与竖线相接；`.structure-flow` 仍为内部滚动容器 | 是 |
| 窄屏三区 | 保持卡片外观（base 规则不动） | 是 |
| HeapPeek 浮层 | 不带 `.main-paged`，保持卡片 | 是 |
| `.selection-detail-wrap` | 单列块；`border-top: 1px solid var(--border)` + `padding-top: var(--space-4)` + `margin-top: var(--space-5)`；宽屏 `margin-left/right: calc(-1 * (var(--space-5) + 5px))` + `padding-left/right: calc(var(--space-5) + 5px)` + `max-width: none`（横线延伸至 gutter 中线、与竖线相接；`5px` 为 10px gutter 的一半）；窄屏仍为 `calc(-1 * var(--space-5))` / `var(--space-5)`（横线内缩于卡片内）；无 `gap` / 横向 flex | 是，仅覆盖外观 |
| `.selection-detail` | 覆盖 `.panel`：`border: 0; border-radius: 0; background: transparent; padding: 0; max-width: 100%;`；保留内部 `gap` 与 `flex` 声明 | 是 |

### 间距与「无双线」

- 三区各自现有内边距**保持不变**，避免布局抖动：
  - `.pane-tree`：`var(--space-3) var(--space-2)`；
  - `.structure-diagram`：`var(--space-5) var(--space-5) var(--space-6)`；
  - `.hex`：`var(--space-3) var(--space-5)`。
- 宽屏 `.main-paged .main-split` 已 `gap: 0`，10px gutter 是唯一分隔带；线居中，故每块内容边界距线各约 5px，再加各自内边距，无需新增外边距。
- 因宽屏三区 `border` 全部移除，分隔只由 gutter 中 1px 线表达，不存在「区域边框 + 分割线」双线问题。
- 唯一新增的 padding 覆盖是**移除外层留白**：宽屏 `.main-paged { padding: 0; }`（覆盖 base `.main` 的 `var(--space-6)`）；三区内边距不动。`GUTTER_PX = 10` 与 `pageSplitTemplate` 保持原样。

## 响应式与无障碍

| 项 | 约定 |
|---|---|
| 断点 / 适配 | 平铺、竖线与全出血仅在 `@media (min-width: 960px)` 且 `.main-paged` 下生效；`< 960px` 堆叠布局维持卡片、`.main` 保留 `var(--space-6)` 留白，分割线 `display: none` |
| 键盘 / 焦点 | 分割线仍是可聚焦 `<button>`，`aria-label`（`Resize tree pane` / `Resize hex pane`）不变；←/→ 16px 步进不变；`:focus-visible` 线体高亮 2px，`outline: none` |
| 语义 / 对比度 | 线默认 `var(--border)` 在亮/暗背景上均可见；悬停/聚焦/拖动用 accent 混合或纯 accent，对比不低于现状；不引入低对比文本 |
| detail 可访问性 | 删除可见 `detail` 标题不改变可访问名；`#selection-detail-panel` 的 id 与 chrome `Detail` 按钮 `aria-controls` / `aria-expanded` 保持不变 |

## 开放问题

- 无阻塞性开放问题。背景保留 vs 透明的取舍已在「布局与视觉方向」定案为保留（宽屏统一为不透明 `--surface`），理由如上。

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| 覆盖规则若未限定 `.main-paged`，窄屏卡片也会被去边框 | 窄屏可读性下降 | 新规则放入 `@media (min-width: 960px)` 且选择器前缀 `.main-paged`；用测试断言 base 规则仍有 border |
| 只写 `border: 0` 而漏 `border-radius: 0` | 背景仍显圆角，卡片感残留 | 三属性一起覆盖；测试断言 `border-radius: 0` |
| 新增 `border-radius` 字面量 | `designTokens.test.ts` V-2 失败 | 使用 `border-radius: 0`（结构零）或 token；`::after` 不再用圆角 |
| 药丸旧断言残留 | `paneSplit.test.ts` 失败 | 改写该 describe 为新线体合同 |
| HeapPeek 浮层被误伤 | 浮层内面板丢卡片 | 作用域限定 `.main-paged`，浮层在 `.main` 外，天然隔离 |
| `padding: 0` 若未限定 `.main-paged` / 媒体查询，窄屏与非分栏页会丢留白 | 布局贴边、可读性下降 | 规则写入 `@media (min-width: 960px)` 的 `.main-paged` 块；测试断言宽屏 `.main-paged` 为 `padding: 0` 且 base `.main` 仍为 `padding: var(--space-6)` |
| 只把 gutter 设为 `--surface`、三区仍留 `--diagram-bg` | gutter 与相邻区域间出现浅色带，阴影问题改头换面 | 三区在宽屏覆盖块统一 `background: var(--surface)`；测试断言三者背景均为 `var(--surface)` |
| 宽屏三区背景改为 `--surface` 后，暗色主题对比度变化 | 结构图 / hex 内容层次下降 | `--surface` 亮暗两套 token 均存在且为区域基底；结构网格单元与 hex 文本自带颜色；人工在亮/暗主题下核对内容可读性（V-11） |
| 统一背景后仍有 body 渐变透出（漏设平铺背景） | 「阴影」残留 | 断言 `.main-paged .main-split` 在宽屏块含 `background: var(--surface)`，`.main-paged .split-gutter` 不含背景（或 `transparent`），且 base `.split-gutter` 仍为 `background: transparent`；人工核对线两侧无暗带（V-10 / V-11 / V-21） |
| `overflow: visible` 让结构面板内容溢出或新增滚动条 | 布局溢出 / 双滚动条 | `.structure-flow` 仍是内部滚动容器；宽屏 `overflow: visible` 只解除裁剪，人工核对无新增面板/页面滚动条（V-23）；断言宽屏块含 `overflow: visible`（V-21） |
| 宽屏 `+5px` 负边距使 detail 内容左缘偏移 | 内容与结构行错位 | 等量 `+5px` 内边距抵消；复刻实测 diff=0；人工核对 detail 文本左缘与结构行对齐（V-23） |
| 删除 `.selection-detail__title` 误伤 chrome 折叠 | `Detail` 按钮 `aria-controls` 失配、面板不可折叠 | 只删标题 DOM，保留 `id="selection-detail-panel"` 与 `panel selection-detail` 类；源码扫描断言（V-12） |
| `.selection-detail` 未覆盖 `.panel`（特异度 / 源码顺序） | 圆角卡片残留 | 同特异度且 `.selection-detail` 源码在后；断言 `border:0` / `border-radius:0` / `background:transparent` / `padding:0` / `max-width:100%`（V-13） |
| `designTokens.test.ts` R-2 旧 `gap` 耦合断言残留 | 测试失败 | 改写 R-2 为新平铺合同（V-14） |
| 顶部横线与内部子分隔读起来重复 | 视觉双线 | 保留内部子分隔，必要时只去掉紧邻首个并在 `dev-notes.md` 说明；人工核对（V-18） |
| 窄屏 detail 去卡片后与 `.structure-diagram` 外层卡片冲突 | 窄屏观感异常 | 已决策全局生效：外层卡片 + 内部平铺，横线落在卡片内；窄屏人工核对（V-18） |

## 对 Plan 与 Developer 的要点

### Plan

- 触碰 `apps/web/src/styles.css` 与 `apps/web/src/paneSplit.test.ts`；`README*.md` 先核查，若无描述则标 `N/A`。
- 最低验证层 `unit + static + build + manual`；把本文件的分隔线精确规格、全出血 padding 合同、单一平面背景合同与作用域断言转成 `V-n`（含「宽屏 `.main-paged` 为 `padding: 0` 且 base `.main` 仍为 `var(--space-6)`」的 CSS 合同断言、宽屏 gutter/三区背景合同断言，与一项全出血人工视觉、一项「线旁无阴影带」人工视觉）。
- 明确不改 `PageSplit.tsx` / `paneSplit.ts` 行为。
- detail 平铺：触碰 `apps/web/src/StructureMap.tsx`（删标题 DOM）与 `apps/web/src/designTokens.test.ts`（改写 R-2 + 新增源码扫描 / CSS 合同），把本节转成 `V-12..V-14`；`apps/web/src/exportStructure.test.ts` 仅验证其 fixture 路径仍通过，无需改动。
- 底部横线全宽：仍触碰 `apps/web/src/styles.css`（`.selection-detail-wrap` 加负水平外边距 + 等量水平内边距 + `max-width: none`）与 `apps/web/src/designTokens.test.ts`（新增 V-19 CSS 合同断言），并加一项「横线两端无空隙」人工视觉（V-20）。
- 横线接入竖线（第五次）：仍触碰 `apps/web/src/styles.css`（宽屏 `.main-paged .main-split` 加 `background: var(--surface)`；移除宽屏 `.main-paged .split-gutter` 背景；宽屏 `.pane-structure` 与 `> .structure-diagram` 设 `overflow: visible`；宽屏 `.main-paged .selection-detail-wrap` 的负边距/内边距各加 `5px`）与 `apps/web/src/designTokens.test.ts` / `apps/web/src/paneSplit.test.ts`（新增 V-21 CSS 合同断言），并加一项「横线与两条竖线相接、无空隙」人工视觉（V-23）。

### Developer

- 只在 `@media (min-width: 960px)` 内新增/扩展 `.main-paged` 覆盖，保持 base 卡片规则不动。
- 全出血：`padding: 0;` 可追加进既有 `@media (min-width: 960px)` 的 `.main-paged { overflow: hidden; min-height: 0; }`（`styles.css:1843`）块，也可放入下方新增覆盖块；二者等价，选其一即可。**不改** base `.main` 的 `padding: var(--space-6)`，也不改 `.main` 的 `gap`。
- 单一平面背景（第五次细化后）：把 `background: var(--surface)` 从 `.main-paged .split-gutter` 移到 **`.main-paged .main-split`**，并**移除** `.main-paged .split-gutter` 的背景（恢复透明，或删除该声明）。三区覆盖块保留 `background: var(--surface)`。**不改** base `.split-gutter` 的 `background: transparent` 与 base 三区的 `--surface` / `--diagram-bg`。注意：`.main-paged .main-split` 的宽屏块由 base `.main-split`（`display: grid` 等）承载，只需在其宽屏覆盖块内加 `background: var(--surface)`；若测试用 `wideBlock()` 读取，确认选择器落在宽屏媒体内。
- 推荐新增独立块（便于测试与阅读）：

```css
/* flat-split-dividers: wide paged panes lose card chrome; narrow keeps it. */
@media (min-width: 960px) {
  .main-paged {
    padding: 0; /* full-bleed: drop .main outer whitespace */
  }

  /* fifth refinement: flat surface lives on the grid container, gutter stays transparent */
  .main-paged .main-split {
    background: var(--surface); /* single flat surface: body gradient no longer shows through */
  }

  .main-paged .split-gutter {
    display: block;
    /* background intentionally transparent: surface comes from .main-split */
  }

  /* allow the structure pane's detail rule to paint into the gutter and meet the vertical lines */
  .main-paged .pane-structure,
  .main-paged .pane-structure > .structure-diagram {
    overflow: visible;
  }

  .main-paged .selection-detail-wrap {
    /* +5px = half of the 10px GUTTER_PX: extend the rule to the gutter center */
    margin-left: calc(-1 * (var(--space-5) + 5px));
    margin-right: calc(-1 * (var(--space-5) + 5px));
    padding-left: calc(var(--space-5) + 5px);
    padding-right: calc(var(--space-5) + 5px);
    max-width: none;
  }

  .main-paged .pane-tree,
  .main-paged .pane-structure > .structure-diagram,
  .main-paged .pane-hex > .hex {
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: var(--surface); /* unify panes with the gutter on one flat surface */
  }
}
```

- 改写 `.split-gutter::after` 及其 hover/focus 规则为「全高 1px 线 + 悬停/聚焦 2px accent 混合」，补 `:focus-visible { outline: none }` 与 `html.is-split-dragging .split-gutter::after`。
- 同步改写 `paneSplit.test.ts` 中 `"split gutter grip (gutter-grip V-1 / V-2)"` describe：新断言覆盖线体规格、hover 规格、`border-radius` 移除、「宽屏去边框、base 保留边框」的作用域断言、「宽屏 `.main-paged` 为 `padding: 0`、base `.main` 仍为 `var(--space-6)`」的全出血合同，以及「宽屏 `.main-paged .main-split` 与三区背景均为 `var(--surface)`、宽屏 gutter 不含背景（透明）、base gutter 仍 `transparent`」的单一平面背景合同（第五次细化后平铺背景由 `.main-split` 承载）。
- 不改 `border-radius` token；`border-radius: 0` 为结构零，符合 `designTokens.test.ts`。
- detail 平铺：在 `StructureMap.tsx:841` 删除 `<div className="selection-detail__title">detail</div>`；**保留** `#selection-detail-panel` 的 id 与 `panel selection-detail` 类。
- detail CSS：把 `.selection-detail-wrap` 改为单列块（去 `display:flex` / `flex-direction` / `align-items` / `gap`），加 `padding-top: var(--space-4)` + `border-top: 1px solid var(--border)`；在 `.selection-detail` 加 `border: 0; border-radius: 0; background: transparent; padding: 0; max-width: 100%;`；删除 `.selection-detail__title` 规则。不改 `.selection-detail .selection-meta` / `.selection-detail__highlight` 的内部子分隔，也不改 `renderDetail` / 折叠逻辑。
- detail 全宽横线：base `.selection-detail-wrap` 保留 `margin-left/right: calc(-1 * var(--space-5)); padding-left/right: var(--space-5); max-width: none;`（全局，覆盖原 `max-width: 100%`）；**宽屏** `.main-paged .selection-detail-wrap` 再加 `5px`（`calc(-1 * (var(--space-5) + 5px))` / `calc(var(--space-5) + 5px)`），使横线延伸至 gutter 中线与竖线相接。宽屏 `overflow: visible` 覆盖 `.pane-structure` 与 `> .structure-diagram`；不改 `.structure-diagram` 的 padding，也不改 `.selection-detail` 的内容宽度。
- detail 测试：改写 `designTokens.test.ts` 的 R-2 `it` 为新合同（wrap 顶部横线 + detail 覆盖 `.panel` + `max-width: 100%`，去掉 `gap` 耦合），并新增 `StructureMap.tsx` / `App.tsx` 源码扫描断言（无 `selection-detail__title`、保留 `selection-detail-panel` 与 `panel selection-detail`）；另加 V-19 断言 wrap 的负水平外边距、等量水平内边距与 `max-width: none`。
- 第五次细化测试：在 `designTokens.test.ts` / `paneSplit.test.ts` 加宽屏 CSS 合同断言——`.main-paged .main-split` 含 `background: var(--surface)`；`.main-paged .split-gutter` 不再含 `background`（或为 `transparent`）；`.main-paged .pane-structure` 与 `> .structure-diagram` 含 `overflow: visible`；`.main-paged .selection-detail-wrap` 含 `calc(-1 * (var(--space-5) + 5px))` 与 `calc(var(--space-5) + 5px)`。base `.split-gutter` 仍为 `background: transparent`，base `.selection-detail-wrap` 仍为 `var(--space-5)`。

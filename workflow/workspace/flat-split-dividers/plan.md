# Plan: flat-split-dividers

## 元信息

- 依据 Spec: N/A（Spec 门禁 skipped：纯视觉/布局调整，不新增行为、公开接口、状态转换、错误约定；拖动交互已存在）
- 依据 Design: N/A（Design 门禁 skipped：无模块边界 / 分层 / 技术选型决策）
- 依据 UI: `workflow/workspace/flat-split-dividers/ui-design.md`
- 路径等级: standard
- Review 门禁: required
- 最低验证层: unit + static + build + manual
- 验证命令:
  - `pnpm --filter web test`
  - `pnpm --filter web typecheck`
  - `pnpm build`
  - 人工视觉：`pnpm --filter web dev`，宽屏（≥1280px）与窄屏（<960px）、亮/暗主题，拖动两条竖线；并核对宽屏全出血（三区与竖线贴视口左/右/下缘、顶接 chrome）与竖线两侧无阴影带，detail 顶部横线两端无空隙，以及宽屏下横线与两条竖向分割线相接、无空隙（无新增滚动条）
- 预期证据:
  - `pnpm --filter web test` 全部通过，含改写后的 `paneSplit.test.ts` 新用例名与断言（含全出血 `padding` 合同与单一平面背景合同）与 `designTokens.test.ts` 的 detail 平铺合同
  - `pnpm --filter web typecheck` 零错误输出
  - `pnpm build` 成功日志摘要
  - 宽屏截图中三区无边框/圆角/投影、仅两条全高竖线，背景与竖线同色为 `--surface` 且无暗色渐变带，并贴视口左/右/下缘、顶接 chrome（无外层留白）；窄屏截图仍为卡片且保留 `.main` 留白；拖动前后宽度变化
  - 结构图底部 detail 无可见 `detail` 标签、无圆角卡片，仅由一条 `var(--border)` 横线与结构图分隔，横线两端贴结构面板 padding box 内缘、无空隙；宽/窄屏一致；`#selection-detail-panel` 仍可被 chrome `Detail` 折叠
  - 宽屏下 detail 顶部横线延伸穿过 10px gutter、与两条竖向分割线相接（无空隙）；平铺背景由 `.main-paged .main-split` 提供、gutter 透明无暗带；结构面板 `overflow: visible` 后无新增滚动条；detail 内容左缘仍与结构行对齐；窄屏横线仍内缩于卡片内

## 目标摘要

- 宽屏 Page 布局（`@media (min-width: 960px)` 且 `.main-paged`）下，Tree / Structure / Hex 三区去掉边框、圆角、投影，与 gutter 统一为不透明 `--surface` 背景，由两条可拖动的全高 1px 竖线分隔。
- 追加细化：宽屏 `.main-paged` 全出血，`padding: 0` 去掉 `.main` 外层留白，三区背景与两条竖线贴到视口左/右/下边缘、顶部紧接 chrome；三区内边距不变，窄屏仍保留 `.main` 留白与卡片外观。
- 追加细化（二次）：宽屏 `.main-paged` 下 gutter 区域与三区呈现为同一不透明 `var(--surface)` 平面，消除透出 body 暗色渐变在 1px 线两侧形成的「阴影」带；第五次细化后该平面背景由 `.main-paged .main-split` 承载、gutter 透明；窄屏与 base 背景不变。
- 追加细化（三次）：结构图底部 detail 去掉可见 `detail` 标签与 `.panel` 圆角卡片，改为嵌入结构图下方、以一条 `border-top` 横线分隔；`#selection-detail-panel` id 与折叠语义不变，宽/窄屏一致。
- 追加细化（四次）：detail 顶部横线两端不再留空隙——用 `calc(-1 * var(--space-5))` 负水平外边距抵消 `.structure-diagram` 的水平 padding，并以等量 `padding-left/right` 保持内容与结构行对齐、`max-width: none` 防止被夹回，使横线抵达结构面板 padding box 两端；全局生效。
- 追加细化（五次）：detail 横线与两条竖向分割线之间仍有 5px 空隙——竖线居中于 10px gutter（`GUTTER_PX/2`）。宽屏下把平铺背景从 gutter 移到 `.main-paged .main-split`（gutter 恢复透明、无暗带），`.main-paged .pane-structure` 与 `> .structure-diagram` 设 `overflow: visible`，`.main-paged .selection-detail-wrap` 的水平负边距/内边距各再加 `5px`（`calc(-1 * (var(--space-5) + 5px))` / `calc(var(--space-5) + 5px)`），使横线延伸至 gutter 中线、与竖线相接；内容对齐不变，窄屏不变。
- 分割线命中区保持 10px，`GUTTER_PX` 与 `pageSplitTemplate` 不变，拖动 / 键盘 / 持久化行为不变。
- 窄屏（<960px）堆叠布局与 HeapPeek 浮层保持现有卡片外观。
- 改写 `paneSplit.test.ts` 中旧药丸把手合同为新竖线合同，并加「宽屏去卡片、base 保留卡片」的作用域断言、全出血 `padding` 合同断言与单一平面背景合同断言。

## 任务拆解

1. **CSS：宽屏去卡片化**（完成条件：`@media (min-width: 960px)` 内新增/扩展 `.main-paged .pane-tree`、`.main-paged .pane-structure > .structure-diagram`、`.main-paged .pane-hex > .hex`，统一 `border: 0; border-radius: 0; box-shadow: none;`；base 规则与窄屏外观不变）
2. **CSS：分割线改为细竖线**（完成条件：`.split-gutter::after` 为 `left:50%; top:0; bottom:0; width:1px; transform:translateX(-50%); background: var(--border)`，移除 `2.5rem` 高度 / 药丸圆角 / muted 半透明；`:hover`/`:focus-visible` 为 `width:2px` + `color-mix(in srgb, var(--accent) 55%, var(--border))`；新增 `.split-gutter:focus-visible { outline: none; }` 与 `html.is-split-dragging .split-gutter::after { width:2px; background: var(--accent); }`）
3. **CSS：宽屏全出血**（完成条件：`@media (min-width: 960px)` 的 `.main-paged` 块内追加 `padding: 0;`，覆盖 base `.main` 的 `var(--space-6)`；三区背景与两条竖线贴视口左/右/下边缘；三区内边距与 base `.main` 的 padding、`.main` 的 `gap` 均不变；窄屏 `< 960px` 不受影响）
4. **CSS：宽屏单一平面背景**（完成条件：把不透明 `background: var(--surface)` 放在宽屏 `.main-paged .main-split`（第五次细化后由任务 8 定案，替代早期「并入 `.split-gutter`」方案），宽屏三区覆盖块含 `background: var(--surface)`；base `.split-gutter` 仍 `background: transparent`，base 三区仍为 `--surface` / `--diagram-bg`；1px `var(--border)` 线两侧无 body 渐变暗带）
5. **测试改写**（完成条件：`apps/web/src/paneSplit.test.ts` 的 `"split gutter grip (gutter-grip V-1 / V-2)"` 改为新线体合同，并新增宽屏作用域断言、全出血 padding 合同断言与单一平面背景合同断言；不改 `pageSplitTemplate` / `dragTree` / `dragHex` 等既有逻辑用例）
6. **README 核查**（完成条件：确认 `README.md` / `README.zh-CN.md` 是否描述三区卡片外观或分割线；无则文档影响标 `N/A` 并写明理由，有则同步）
7. **detail 平铺（DOM + CSS）**（完成条件：`StructureMap.tsx:841` 删除 `.selection-detail__title` 元素，保留 `id="selection-detail-panel"` 与 `panel selection-detail` 类；`.selection-detail-wrap` 改为单列块并加 `padding-top: var(--space-4)` + `border-top: 1px solid var(--border)`，去 `gap` / 横向 flex；`.selection-detail` 覆盖 `.panel` 为 `border:0; border-radius:0; background:transparent; padding:0; max-width:100%`；删除 `.selection-detail__title` 规则；不改 `renderDetail` / 折叠逻辑 / 内部子分隔；同步改写 `designTokens.test.ts` 的 R-2 并新增源码扫描与 CSS 合同断言；**底部横线全宽**：`.selection-detail-wrap` 加 `margin-left/right: calc(-1 * var(--space-5))`、`padding-left/right: var(--space-5)`、`max-width: none`（覆盖原 `max-width: 100%`），使 `border-top` 抵达 `.structure-diagram` padding box 两端、无横向溢出、内容对齐不变；同步加 V-19 CSS 合同断言）
8. **CSS：横线接入竖向分割线（宽屏）**（完成条件：宽屏 `@media (min-width: 960px)` 内 `.main-paged .main-split` 含 `background: var(--surface)`，`.main-paged .split-gutter` 不再含背景（或 `transparent`），三区覆盖块仍含 `background: var(--surface)`；`.main-paged .pane-structure` 与 `.main-paged .pane-structure > .structure-diagram` 含 `overflow: visible`；`.main-paged .selection-detail-wrap` 含 `margin-left/right: calc(-1 * (var(--space-5) + 5px))`、`padding-left/right: calc(var(--space-5) + 5px)`、`max-width: none`，并加注释说明 `5px` 为 10px gutter 的一半；base `.split-gutter` 仍 `background: transparent`，base `.selection-detail-wrap` 仍为 `var(--space-5)`，窄屏不变；同步加 V-21 CSS 合同断言）
9. **回归自验**（完成条件：`pnpm --filter web test`、`pnpm --filter web typecheck`、`pnpm build` 全通过；记录到 `dev-notes.md`；人工视觉按 V-7、V-9、V-11、V-18、V-20、V-23 执行）

## 依赖与顺序

1. 任务 1、2、3、4、8 同属 `styles.css` 的宽屏覆盖，可一并完成；任务 5 依赖 1–4、8 的最终选择器与声明字符串。
2. 任务 7 的 DOM 部分（`StructureMap.tsx`）与任务 1–4、8 独立；其 CSS 与测试部分（`styles.css`、`designTokens.test.ts`）依赖 CSS 最终声明字符串，与任务 5 一并收口。
3. 任务 6 独立，可与 1–5、7、8 并行。
4. 任务 9 在 1–8 完成后执行。
5. 依赖 `ui-design.md` 的精确规格（含「全出血」「单一平面背景」「结构图底部 detail 平铺」与「横线接入竖向分割线」节）；不得偏离。

## 触碰路径

- `apps/web/src/styles.css`（改：新增宽屏覆盖块；改 `.split-gutter::after` 及 hover/focus；新增 focus-visible / dragging 规则；在宽屏 `.main-paged` 块追加 `padding: 0`；把平铺 `background: var(--surface)` 放在宽屏 `.main-paged .main-split` 并移除宽屏 `.main-paged .split-gutter` 的背景，三区覆盖块保留 `background: var(--surface)`；宽屏 `.main-paged .pane-structure` 与 `> .structure-diagram` 设 `overflow: visible`；改 `.selection-detail-wrap` 为单列 + 顶部横线并加 base `margin-left/right: calc(-1 * var(--space-5))` + `padding-left/right: var(--space-5)` + `max-width: none`，宽屏再各加 `5px`（`calc(-1 * (var(--space-5) + 5px))` / `calc(var(--space-5) + 5px)`）使横线接入竖线，改 `.selection-detail` 覆盖 `.panel`，删除 `.selection-detail__title` 规则）
- `apps/web/src/StructureMap.tsx`（改：删除 `.selection-detail__title` 元素，保留 `#selection-detail-panel` 与 `panel selection-detail`）
- `apps/web/src/paneSplit.test.ts`（改：改写 gutter describe，新增作用域断言、全出血 padding 合同断言与单一平面背景合同断言；新增 V-21 宽屏 `.main-paged .main-split` 背景 / `.main-paged .split-gutter` 无背景 / `.pane-structure` 与 `> .structure-diagram` `overflow: visible` 合同断言）
- `apps/web/src/designTokens.test.ts`（改：改写 R-2 为 detail 平铺合同，新增 `StructureMap.tsx` / `App.tsx` 源码扫描与 CSS 合同断言，新增 V-19 wrap 负水平外边距 / 等量水平内边距 / `max-width: none` 合同断言，并新增 V-21 宽屏 wrap `calc(-1 * (var(--space-5) + 5px))` / `calc(var(--space-5) + 5px)` 合同断言）
- `README.md`、`README.zh-CN.md`（仅当任务 6 核查发现描述卡片/分割行为时；否则不动）
- 不改：`apps/web/src/PageSplit.tsx`、`apps/web/src/paneSplit.ts`（行为与限位不变）、`apps/web/src/exportStructure.ts`（`composeExportRoot` 仍按类名剥离 `.selection-detail-wrap`，其 `exportStructure.test.ts` fixture 仅验证该路径，预期继续通过、无需改动）、detail 的 `renderDetail` / 折叠逻辑、base `.main` 规则与 `.main` 的 `gap`。

## 验收与验证

> 无 Spec，自编 `V-n`。

| ID | 要求或命令 | 预期证据 | 结果（实施后填） |
|---|---|---|---|
| V-1 | 单测断言 `.split-gutter::after` 为全高 1px 居中竖线：`width: 1px`、`top: 0`、`bottom: 0`、`left: 50%`、`transform: translateX(-50%)`、`background: var(--border)`；且不含 `height: 2.5rem` 与任何 `border-radius` | `pnpm --filter web test` 新用例通过 | |
| V-2 | 单测断言 hover/focus-visible 线体为 `width: 2px` 且 `background: color-mix(in srgb, var(--accent) 55%, var(--border))`，非纯 `var(--accent)`；`.split-gutter:focus-visible` 含 `outline: none` | 新用例通过 | |
| V-3 | 单测作用域断言：宽屏覆盖块（匹配 `.main-paged .pane-tree` … `.main-paged .pane-hex > .hex`）含 `border: 0`、`border-radius: 0`、`box-shadow: none`；同时 base `.pane-tree` / `.structure-diagram` / `.hex` 仍含 `border: 1px solid var(--border)`（窄屏保留卡片） | 新用例通过 | |
| V-4 | `pnpm --filter web test` | 全部用例通过（含既有 `pageSplitTemplate` / `dragTree` / `dragHex` / `designTokens` 用例） | |
| V-5 | `pnpm --filter web typecheck` | 零错误输出 | |
| V-6 | `pnpm build` | 构建成功日志摘要 | |
| V-7 | 人工视觉（manual）：`pnpm --filter web dev`，宽屏 1280px 截图确认三区无边框/圆角/投影、两条全高竖线；窄屏 800px 截图确认仍为卡片；亮/暗主题各一次；拖动两条竖线确认宽度变化与 `col-resize` 光标 | 截图与核对清单结论写入 `dev-notes.md` | |
| V-8 | 单测 CSS 合同断言：`@media (min-width: 960px)` 内 `.main-paged` 块含 `padding: 0`；base `.main` 仍含 `padding: var(--space-6)`（全出血不泄漏到窄屏 / 非分栏页） | `pnpm --filter web test` 新用例通过 | |
| V-9 | 人工视觉（manual，全出血）：`pnpm --filter web dev`，宽屏 1280px 截图确认三区背景与两条竖线贴视口左缘/右缘/底缘、顶接 chrome，无外层留白；三区内容仍与分割线/边缘保持内边距；窄屏 800px 确认 `.main` 留白与卡片外观不变；亮/暗主题各一次 | 截图与核对清单结论写入 `dev-notes.md` | |
| V-10 | 单测 CSS 合同断言（单一平面背景）：`@media (min-width: 960px)` 内 `.main-paged .main-split` 块含 `background: var(--surface)`（第五次细化后由 V-21 定案；早期「并入 `.split-gutter`」方案已作废）；宽屏三区覆盖块（`.main-paged .pane-tree` … `.main-paged .pane-hex > .hex`）含 `background: var(--surface)`；base `.split-gutter` 仍为 `background: transparent`，base `.pane-tree` 仍为 `background: var(--surface)`、base `.structure-diagram` / `.hex` 仍为 `background: var(--diagram-bg)` | `pnpm --filter web test` 新用例通过 | |
| V-11 | 人工视觉（manual，无阴影带）：`pnpm --filter web dev`，宽屏 1280px 放大截图核对两条 1px 竖线两侧背景与三区同色、无暗色渐变带；亮/暗主题各一次；窄屏 800px 确认 gutter 不显示、卡片背景不变 | 截图与核对清单结论写入 `dev-notes.md` | |
| V-12 | 单测源码扫描（detail DOM）：`StructureMap.tsx` 不含 `selection-detail__title`，且含 `id="selection-detail-panel"` 与 `className="panel selection-detail"`；`App.tsx` 仍含指向 `selection-detail-panel` 的 `aria-controls` | `pnpm --filter web test` 新用例通过 | |
| V-13 | 单测 CSS 合同（detail 平铺）：`.selection-detail-wrap` 含 `border-top: 1px solid var(--border)`、`padding-top: var(--space-4)`、`margin-top: var(--space-5)`，且不含 `gap` / `flex-direction: row`；`.selection-detail` 含 `border: 0`、`border-radius: 0`、`background: transparent`、`padding: 0`、`max-width: 100%`；`styles.css` 不再含 `.selection-detail__title` | 新用例通过 | |
| V-14 | `designTokens.test.ts` R-2 改写为新合同（去掉旧 `gap` 耦合，断言 wrap 顶部横线与 `.selection-detail` 覆盖 `.panel`） | `pnpm --filter web test` 通过，含 `exportStructure.test.ts` 既有 fixture 用例 | |
| V-15 | `pnpm --filter web test` | 全部用例通过（含既有 `pageSplitTemplate` / `dragTree` / `dragHex` / `designTokens` / `chromeToggle` 用例） | |
| V-16 | `pnpm --filter web typecheck` | 零错误输出 | |
| V-17 | `pnpm build` | 构建成功日志摘要 | |
| V-18 | 人工视觉（manual，detail 平铺）：`pnpm --filter web dev`，宽屏 1280px 与窄屏 800px 各截图：detail 无 `detail` 标签、无圆角卡片，与结构图之间仅一条 `var(--border)` 横线，内部小节分隔保留；亮/暗主题各一次；点击 chrome `Detail` 确认面板仍可折叠 | 截图与核对清单结论写入 `dev-notes.md` | |
| V-19 | 单测 CSS 合同（detail 横线全宽）：`.selection-detail-wrap` 含 `margin-left: calc(-1 * var(--space-5))`、`margin-right: calc(-1 * var(--space-5))`、`padding-left: var(--space-5)`、`padding-right: var(--space-5)`、`max-width: none`，且仍含 `margin-top: var(--space-5)` / `padding-top: var(--space-4)` / `border-top: 1px solid var(--border)`；`.selection-detail` 内容对齐不受影响（仍含 `max-width: 100%`、`padding: 0`、`background: transparent`） | `pnpm --filter web test` 新用例通过 | |
| V-20 | 人工视觉（manual，横线两端无空隙）：`pnpm --filter web dev`，宽屏 1280px 与窄屏 800px 各截图放大 detail 顶部横线两端，确认横线贴结构面板（窄屏为卡片）padding box 内缘、两端无空隙，detail 文本左缘仍与结构行左缘对齐；确认 `.structure-diagram` 未出现横向滚动条；亮/暗主题各一次 | 截图与核对清单结论写入 `dev-notes.md` | |
| V-21 | 单测 CSS 合同（横线接入竖线，宽屏）：`@media (min-width: 960px)` 内 `.main-paged .main-split` 含 `background: var(--surface)`；`.main-paged .split-gutter` 不含 `background`（或为 `transparent`）；`.main-paged .pane-structure` 与 `.main-paged .pane-structure > .structure-diagram` 含 `overflow: visible`；`.main-paged .selection-detail-wrap` 含 `margin-left: calc(-1 * (var(--space-5) + 5px))`、`margin-right: calc(-1 * (var(--space-5) + 5px))`、`padding-left: calc(var(--space-5) + 5px)`、`padding-right: calc(var(--space-5) + 5px)`、`max-width: none`；同时 base `.split-gutter` 仍为 `background: transparent`，base `.selection-detail-wrap` 仍含 `calc(-1 * var(--space-5))` / `var(--space-5)` | `pnpm --filter web test` 新用例通过 | |
| V-22 | `pnpm --filter web test`、`pnpm --filter web typecheck`、`pnpm build` | 全部用例通过；typecheck 零错误；build 成功日志摘要 | |
| V-23 | 人工视觉（manual，横线与竖线相接）：`pnpm --filter web dev`，宽屏 1280px 放大 detail 顶部横线左右两端，确认横线穿过 10px gutter、与两条竖向分割线相接、无空隙，且 gutter 两侧无暗带；确认结构面板 `overflow: visible` 后无新增横向/页面滚动条，`.structure-flow` 仍可独立滚动；detail 文本左缘仍与结构行左缘对齐；窄屏 800px 确认横线仍内缩于卡片内、不延伸到卡片外；亮/暗主题各一次 | 截图与核对清单结论写入 `dev-notes.md` | |

## 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 真实浏览器拖动 / 实际观感 | 仓库 e2e 需 live PostgreSQL（`playwright.config.ts` 的 `globalSetup` 起服务与种子库），当前环境不保证可用 | 纯 CSS 变更，风险限于视觉与拖动观感；拖动逻辑未改，功能回归风险低 | 有 live PG 时补跑：`pnpm test:e2e`，或按 `ui-design.md` 在宽（1280）与窄（800）视口截图并模拟 pointer 拖动 `Resize tree pane` / `Resize hex pane` 两个 button，比对线体宽度与列宽变化 |
| 拖动中的 `--accent` 活动线色 | 静态单测只能断言声明存在，无法断言运行时视觉 | 低 | 人工拖动时核对（V-7）或 Playwright 拖动中截图 |
| 「线旁无阴影带」的实际观感 | 单测只能断言 `background: var(--surface)` 声明存在，无法断言渲染后无暗带；本项诊断即来自 Playwright 计算样式 + 静态复刻 | 低（诊断已确认根因是透明 gutter 透出 body 渐变） | 人工核对（V-11），或用真实 `styles.css` 静态复刻 + Playwright 读取 gutter 与相邻区域计算 `background-color` 一致 |
| 「横线与竖线相接」的实际渲染 | 单测只能断言 `calc` 声明与 `overflow: visible` 存在，无法断言像素级相接；诊断已用真实 `styles.css` 静态复刻 + Playwright 测量（wrap 225..755，内容 diff=0） | 低（根因与修复均已复刻实测） | 人工放大核对（V-23），或用真实 `styles.css` 静态复刻 + Playwright 测量横线两端与竖线的像素距离 |

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | N/A：无架构 / 接口 / 构建变更；`ui-design.md` 已固化视觉合同 |
| 用户文档 | 任务 6 核查 `README.md` / `README.zh-CN.md`；现有 README 未描述三区卡片外观、分割线行为或 detail 区外观（仅描述 Tree 面板功能与快捷键），预期 `N/A` 并写明理由；若核查发现描述则同步一句 |
| 运维文档 | N/A：无部署 / 配置 / 依赖变更 |

## 交接顺序

1. Developer 实施与自验 →
2. Reviewer（Review 门禁 required）→
3. QA 验收 →
4. 用户授权合并 → Manager 第三阶段文档提交（`done`）→ 合入 → 结束

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-09-13 | 初稿：宽屏三区去卡片化 + 分割线细竖线；改写 gutter 测试合同并加作用域断言 |
| 2026-09-13 | 合并前用户细化（附参考截图）触发 §3.1 状态回退 `merge-approval → planning`：宽屏 `.main-paged` 追加全出血 `padding: 0`，三区背景与两条竖线贴视口边缘，三区内边距与窄屏留白不变；新增任务 3、V-8（`padding` CSS 合同）、V-9（全出血人工视觉） |
| 2026-09-13 | 合并前用户再次追加反馈（「竖线也应该保持干净，不要有阴影」）触发 §3.1 状态回退 `merge-approval → planning`：诊断确认为 `.split-gutter` 透明背景透出 body 暗色径向渐变（非 `box-shadow`）；宽屏 `.main-paged` 下 gutter 与三区统一为不透明 `var(--surface)` 单一平面，只留 1px `var(--border)` 竖线，窄屏与 base 背景不变；新增任务 4、V-10（单一平面背景 CSS 合同）、V-11（线旁无阴影带人工视觉） |
| 2026-09-13 | 合并前用户第三次追加反馈（「继续优化底部 detail 区域，去掉 detail 文字，取消圆角矩形，直接嵌入下方，用一条横线做分割」）触发 §3.1 状态回退 `merge-approval → planning`：`StructureMap.tsx` 删除 `.selection-detail__title`；`.selection-detail-wrap` 改单列块 + `border-top: 1px solid var(--border)` + `padding-top: var(--space-4)`；`.selection-detail` 覆盖 `.panel` 为 `border:0; border-radius:0; background:transparent; padding:0; max-width:100%`；改写 `designTokens.test.ts` R-2 并加源码扫描 / CSS 合同断言；新增任务 7、V-12..V-18，回归任务顺延为 8 |
| 2026-09-13 | 合并前用户第四次追加反馈（detail 顶部横线两端留有空隙，附截图）触发 §3.1 状态回退 `merge-approval → planning`：`.selection-detail-wrap` 位于带水平 padding 的 `.structure-diagram` 内，加 `margin-left/right: calc(-1 * var(--space-5))` 抵消其水平 padding，加等量 `padding-left/right: var(--space-5)` 保持内容对齐，加 `max-width: none` 防止被夹回，使 `border-top` 抵达结构面板 padding box 两端且无横向溢出；全局生效（宽屏与窄屏一致）；扩展任务 7，新增 V-19（横线全宽 CSS 合同）、V-20（横线两端无空隙人工视觉），回归任务 8 纳入 V-20（当时编号；第五次细化后回归任务顺延为 9） |
| 2026-09-13 | 合并前用户第五次追加反馈（横线与竖向分割线间仍有空隙，附放大截图）触发 §3.1 状态回退 `merge-approval → planning`：竖线居中于 10px gutter（`GUTTER_PX/2 = 5px`），detail 横线只到结构面板边缘（距竖线 5px）。宽屏下把平铺背景从 `.main-paged .split-gutter` 移到 `.main-paged .main-split`（gutter 恢复透明、无暗带），`.main-paged .pane-structure` 与 `> .structure-diagram` 设 `overflow: visible`，`.main-paged .selection-detail-wrap` 的负水平边距/内边距各再加 `5px`（`calc(-1 * (var(--space-5) + 5px))` / `calc(var(--space-5) + 5px)`），使横线延伸至 gutter 中线与两条竖线相接；内容对齐不变，窄屏不变；新增任务 8，新增 V-21（横线接入竖线 CSS 合同）、V-22（test/typecheck/build）、V-23（横线与竖线相接人工视觉），回归任务顺延为 9 |

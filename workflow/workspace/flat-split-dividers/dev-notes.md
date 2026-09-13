# Dev Notes: flat-split-dividers

## 实现摘要

- 宽屏 Page 布局（`@media (min-width: 960px)` 且 `.main-paged`）下，Tree / Structure / Hex 三区统一去掉 `border` / `border-radius` / `box-shadow`，保留各自背景与内边距，仅由两条分割线分隔。
- `.split-gutter::after` 由居中药丸把手改为贯穿全高的 1px 居中竖线（`var(--border)`）；悬停 / 聚焦为 2px accent 混合，拖动中为 2px 纯 `var(--accent)`；新增 `.split-gutter:focus-visible { outline: none; }`。
- 未改 `PageSplit.tsx` / `paneSplit.ts`：拖动、限位、键盘步进、持久化行为不变；`GUTTER_PX` 与 `pageSplitTemplate` 不变；窄屏与 HeapPeek 保持卡片外观。
- 改写 `paneSplit.test.ts` 的 `"split gutter grip (gutter-grip V-1 / V-2)"` describe 为新线体合同，并新增宽屏作用域断言。

## 变更路径

- `apps/web/src/styles.css`：改 `.split-gutter::after` 与 `:hover` / `:focus-visible::after`；新增 `:focus-visible { outline: none }`、`html.is-split-dragging .split-gutter::after`；在既有 960px paged 块后新增独立 `@media (min-width: 960px)` 覆盖块（三区去卡片）。
- `apps/web/src/paneSplit.test.ts`：改写 gutter describe，新增 V-1 / V-2 / 拖动 / V-3 作用域断言。
- `README.md` / `README.zh-CN.md`：未改动（见「文档影响」）。

## 测试先行记录（TDD）

> 无 Spec，首列填 Plan 的 `V-n`。

| Spec ID / 行为项 | 测试 | 先失败 | 后通过 | 说明 |
|---|---|---|---|---|
| V-1 全高 1px 竖线 | `split gutter grip … > draws a full-height 1px centered line instead of a pill` | 改写后运行 `pnpm --filter web test`：该用例失败（旧 `::after` 仍含 `height: 2.5rem`、`translate(-50%,-50%)`，无 `top:0`/`bottom:0`） | 实现 CSS 后通过 | 断言 `width:1px`、`top:0`、`bottom:0`、`left:50%`、`translateX(-50%)`、`background:var(--border)`，且 `::after` 无 `height` / `border-radius` |
| V-2 hover/focus 线体 | `… > highlights hover and focus with a 2px accent mix, not solid accent` | 失败：旧规则为 `height:3.5rem` + `40%` 混合，无 `width:2px`，且无 `:focus-visible { outline:none }` | 通过 | 断言 `width:2px` 与 `color-mix(in srgb, var(--accent) 55%, var(--border))`，非纯 accent；focus-visible 含 `outline:none` |
| V-3 宽屏作用域 | `… > strips card chrome only in the wide paged scope` | 失败：覆盖块尚不存在，`wideOverride` 为空 | 通过 | 覆盖块含 `border:0` / `border-radius:0` / `box-shadow:none`；base `.pane-tree` / `.structure-diagram` / `.hex` 仍含 `border: 1px solid var(--border)` |
| 拖动态纯 accent | `… > uses solid accent only while dragging` | 失败：`html.is-split-dragging .split-gutter::after` 尚不存在 | 通过 | 断言拖动规则 `width:2px` + `background:var(--accent)` |

## 验证

| 命令 | 验证层 | 结果摘要 / 证据 |
|---|---|---|
| `pnpm --filter web test` | unit | `Test Files 22 passed (22)`、`Tests 313 passed (313)`（含改写后的 4 个 gutter 用例；`designTokens.test.ts` 通过，`border-radius: 0` 为结构零） |
| `pnpm --filter web typecheck` | static | `tsc -p tsconfig.json --noEmit`，零错误输出 |
| `pnpm build` | build | 全 workspace 构建成功；`apps/web build: ✓ built in 592ms`，产物 `dist/assets/index-DjT807gD.css 43.93 kB`、`index-BkCE9mNG.js 327.68 kB` |
| 人工视觉 V-7 | manual | 未在本会话执行（见「未解决风险 / 验证缺口」） |

## 目标分支同步（最终 Review 前）

- 目标分支及提交: `main` @ `c0a938dfd1b7673579076a2e7c60e56dd7e04dbd`（与 `main.md` 记录的基线一致；`origin/main` @ `ed8437c` 落后本地 `main` 7 个提交）
- 同步后源分支 HEAD: `b1d679f`（`refactor(web): flatten paged panes and use draggable divider lines`）
- 同步方式: N/A（源分支已基于最新目标分支；`git fetch origin` 后 `git merge-base --is-ancestor origin/main main` 成立，`origin/main..main` 领先 7、`main..origin/main` 为 0，无需 rebase）
- 冲突及处理: N/A（未 rebase，无冲突；工作树在同步前已提交干净，未使用 stash/autostash）
- 同步后复验: 未发生 rebase 与内容变化，验证对象仍为 `b1d679f`，上述 unit / static / build 结果有效

## 文档影响

| 类别 | 已更新路径或交接说明 |
|---|---|
| 开发文档 | N/A：无架构 / 接口 / 构建变更；视觉合同已由 `ui-design.md` 固化 |
| 用户文档 | N/A：核查 `README.md` / `README.zh-CN.md`，仅描述 Tree 面板功能与快捷键，未描述三区卡片外观或分割线/把手行为（`grep -n "gutter\|split\|divider\|card\|radius\|border"` 无相关命中），无需同步 |
| 运维文档 | N/A：无部署 / 配置 / 依赖变更 |

## 未解决风险 / 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 人工视觉 V-7（真实浏览器观感 / 拖动） | 本会话为自动化 CLI，未启动 `pnpm --filter web dev` 截图；仓库 e2e 需 live PostgreSQL | 纯 CSS 视觉变更，拖动逻辑未改，功能回归风险低；线体观感需人眼确认 | 有浏览器 / live PG 时：按 `ui-design.md` 在 1280px 与 800px 视口、亮/暗主题各截图一次，并模拟 pointer 拖动 `Resize tree pane` / `Resize hex pane` 核对列宽与线体宽度 |
| 拖动中 `--accent` 活动线色 | 静态单测只能断言声明存在，无法断言运行时视觉 | 低 | 人工拖动时核对，或 Playwright 拖动中截图 |
| 人工视觉 V-18（detail 平铺） | 本会话为自动化 CLI，未启动 `pnpm --filter web dev` 截图 | 纯 CSS / DOM 视觉变更，`renderDetail` 与折叠逻辑未改，功能回归风险低；detail 观感与 chrome `Detail` 折叠需人眼确认 | QA 阶段用 Playwright + live PG：宽 1280 / 窄 800、亮/暗主题各截图，核对无 `detail` 标签、无圆角卡片、仅一条横线分隔，点击 `Detail` 确认面板仍可折叠 |

## QA 修复回执

> QA `Fail` 后按缺陷 ID 追加，不另建文件。

| 缺陷 ID | 处理 | 摘要 | 验证证据 | 建议复测范围 |
|---|---|---|---|---|
| QA-1 | 已修复 | 宽屏作用域断言未校验 `@media (min-width: 960px)` 边界；`inWideMedia()` 仅在宽屏媒体体内匹配，规则逃逸媒体查询会失败 | `paneSplit.test.ts` V-3 新增 `expect(inWideMedia(wideOverride)).toBe(true)`；`pnpm --filter web test` 22 文件 / 314 用例通过 | 作用域断言、窄屏卡片保留 |
| | | | | |

## 合并前细化回执：宽屏全出血（2026-09-13）

> 用户合并前追加反馈（附参考截图）：宽屏三栏边缘不留白。Plan 新增任务 3 + V-8 / V-9，`ui-design.md` 新增「全出血（边缘无留白，仅宽屏）」节。

### 变更

- `apps/web/src/styles.css`：在既有 `@media (min-width: 960px)` 的 `.main-paged` 块（`styles.css:1843`）追加 `padding: 0;`，覆盖 base `.main` 的 `var(--space-6)`。未改 base `.main` 的 `padding`、未改 `.main` 的 `gap`、未改三区内边距；此前的宽屏去卡片与分割线细竖线改动全部保留。
- `apps/web/src/paneSplit.test.ts`：
  - 新增 **V-8** 用例 `drops the .main outer whitespace only in the wide paged scope (V-8)`：宽屏 `.main-paged` 含 `padding: 0`，base `.main` 仍含 `padding: var(--space-6)`。
  - **QA-1 修复**：新增 `wideMediaBodies()` / `inWideMedia()` / `wideBlock()` 辅助，宽屏媒体体按「媒体块闭合 `}` 顶格、内部规则缩进」提取；V-3 增加 `expect(inWideMedia(wideOverride)).toBe(true)`，V-8 用 `wideBlock(".main-paged")` 仅在宽屏媒体体内匹配，故规则若逃逸 `@media (min-width: 960px)` 测试即失败。辅助正则以合成 CSS 验证：媒体体内 `.a` 判为 true、媒体体外 `.b` 判为 false。

### 测试先行记录（TDD）

| Spec ID / 行为项 | 测试 | 先失败 | 后通过 | 说明 |
|---|---|---|---|---|
| V-8 宽屏全出血 `padding` | `… > drops the .main outer whitespace only in the wide paged scope (V-8)` | 先移除 CSS `padding: 0` 运行：1 failed（`expected … to match /padding:\s*0\s*;/`），10 passed | 恢复 `padding: 0` 后通过 | 断言宽屏 `.main-paged` 含 `padding: 0` 且 base `.main` 仍为 `var(--space-6)` |
| QA-1 媒体查询边界 | V-3 内 `inWideMedia(wideOverride)` + V-8 `wideBlock` | 合成 CSS 验证媒体体外规则不被宽屏体包含 | 通过 | 规则逃逸 `@media (min-width: 960px)` 时断言失败 |

### 验证（实施后）

| 命令 | 验证层 | 结果摘要 / 证据 |
|---|---|---|
| `pnpm --filter web test` | unit | `Test Files 22 passed (22)`、`Tests 314 passed (314)`（较 `b1d679f` 的 313 增 V-8 一例；`paneSplit.test.ts` 11 用例全过） |
| `pnpm --filter web typecheck` | static | `tsc -p tsconfig.json --noEmit`，零错误输出 |
| `pnpm build` | build | 全 workspace 成功；`apps/web build: ✓ built in 592ms`，`dist/assets/index-5YrF9eiZ.css 43.94 kB`、`index-S3q1lYdD.js 327.68 kB` |
| 人工视觉 V-9（全出血） | manual | 未在本会话执行（见「未解决风险 / 验证缺口」；QA 阶段补做） |

### 目标分支同步（Review / QA 前，git.md §7.1）

- 目标分支及提交: `main` @ `c0a938dfd1b7673579076a2e7c60e56dd7e04dbd`（与 `main.md` 基线一致）
- `git fetch origin`：无新提交；`origin/main` @ `ed8437c` 落后本地 `main` 7 个提交（`origin/main...main` = `0 7`）
- 源分支 HEAD（提交后）: `782eec29a242499080262f1670f9c7eff1eec317`（`fix(web): make wide paged layout full-bleed`，父 `b1d679f`）
- 同步方式: N/A（`git merge-base --is-ancestor main HEAD` 成立；`main...HEAD` = `0 3`，源分支已基于最新目标，无需 rebase）
- 冲突及处理: N/A（未 rebase，无冲突；未使用 stash / autostash）
- 同步后复验: 未发生 rebase 与内容变化，验证对象为 `782eec2`，上述 unit / static / build 结果有效

## 合并前细化回执：宽屏单一平面背景（2026-09-13）

> 用户合并前再次反馈（「竖线也应该保持干净，不要有阴影」）。诊断：宽屏 `.split-gutter` 为 `background: transparent`，10px 命中区透出 body 的 `--bg` 与其径向渐变（比三区 `--surface` / `--diagram-bg` 更暗），在 1px 线两侧各形成约 5px 暗色渐变带，观感即「阴影」；所有元素 `box-shadow` 计算值均为 `none`，非投影。Plan 新增任务 4 + V-10 / V-11，`ui-design.md` 新增「单一平面背景」节。

### 变更

- `apps/web/src/styles.css`：
  - 把 `background: var(--surface);` **并入既有**宽屏 `.main-paged .split-gutter { display: block; }` 块（`styles.css:1857`），未新增第二个 `.main-paged .split-gutter` 块（`wideBlock()` 只取首个匹配，重复块会使 V-10 误判）。
  - 既有宽屏三区覆盖块（`.main-paged .pane-tree, .main-paged .pane-structure > .structure-diagram, .main-paged .pane-hex > .hex`，`styles.css:1913`）追加 `background: var(--surface);`。
  - **未改** base `.split-gutter`（仍 `transparent`）、base `.pane-tree`（仍 `--surface`）、base `.structure-diagram` / `.hex`（仍 `--diagram-bg`）、窄屏布局，以及此前去卡片 / 细竖线 / 全出血改动。
- `apps/web/src/paneSplit.test.ts`：新增 **V-10** 用例 `puts wide gutters and panes on one flat surface (V-10)`：宽屏首个 `.main-paged .split-gutter` 块含 `background: var(--surface)`；宽屏三区覆盖块含 `background: var(--surface)` 且 `inWideMedia()` 为 true；base `.split-gutter` 仍 `transparent`、base `.pane-tree` 仍 `--surface`、base `.structure-diagram` / `.hex` 仍 `--diagram-bg`。

### 测试先行记录（TDD）

| Spec ID / 行为项 | 测试 | 先失败 | 后通过 | 说明 |
|---|---|---|---|---|
| V-10 宽屏单一平面背景 | `… > puts wide gutters and panes on one flat surface (V-10)` | 先运行 `pnpm --filter web test`：1 failed（`expected '\n    display: block;\n  ' to match /background:\s*var\(--surface\)/`），314 passed | 加 CSS 后通过 | 断言宽屏 gutter 与三区背景均为 `var(--surface)`，base 背景不变；旧状态因 gutter 块无背景而失败 |

### 验证（实施后）

| 命令 | 验证层 | 结果摘要 / 证据 |
|---|---|---|
| `pnpm --filter web test` | unit | `Test Files 22 passed (22)`、`Tests 315 passed (315)`（较 `782eec2` 的 314 增 V-10 一例；`paneSplit.test.ts` 12 用例全过） |
| `pnpm --filter web typecheck` | static | `tsc -p tsconfig.json --noEmit`，零错误输出 |
| `pnpm build` | build | 全 workspace 成功；`apps/web build: ✓ built in 581ms`，`dist/assets/index-G54fghAq.css 43.99 kB`、`index-CVkews5R.js 327.68 kB` |
| 人工视觉 V-11（无阴影带） | manual | 未在本会话执行（见「未解决风险 / 验证缺口」；QA 阶段补做） |

### 目标分支同步（Review / QA 前，git.md §7.1）

- 目标分支及提交: `main` @ `c0a938dfd1b7673579076a2e7c60e56dd7e04dbd`（与 `main.md` 基线一致）
- `git fetch origin`：无新提交；`origin/main` @ `ed8437c` 落后本地 `main` 7 个提交（`origin/main...main` = `0 7`）
- 源分支 HEAD（提交后）: `89aec7c`（`fix(web): put paged panes and gutters on one flat surface`，父 `782eec2`）
- 同步方式: N/A（`git merge-base --is-ancestor main HEAD` 成立；`main...HEAD` = `0 4`，源分支已基于最新目标，无需 rebase）
- 冲突及处理: N/A（未 rebase，无冲突；未使用 stash / autostash）
- 同步后复验: 未发生 rebase 与内容变化，验证对象为 `89aec7c`，上述 unit / static / build 结果有效

## 合并前细化回执：结构图底部 detail 平铺（2026-09-13）

> 用户合并前第三次反馈（「继续优化底部 detail 区域，去掉 detail 文字，取消圆角矩形，直接嵌入下方，用一条横线做分割」）。Plan 新增任务 7 + V-12..V-18，`ui-design.md` 新增「结构图底部 detail 平铺」节。

### 变更

- `apps/web/src/StructureMap.tsx`：删除 `<div className="selection-detail__title">detail</div>` 元素；**保留** `id="selection-detail-panel"` 与 `className="panel selection-detail"`（chrome `Detail` 按钮 `aria-controls` 依赖）；`renderDetail` / 折叠逻辑未改。
- `apps/web/src/styles.css`：
  - `.selection-detail-wrap`：移除 `display: flex` / `flex-direction: row` / `align-items: flex-start` / `gap: var(--space-3)`，改为单列块；保留 `margin-top: var(--space-5)` / `margin-left: 0` / `width: auto` / `max-width: 100%` / `min-width: 0`；新增 `padding-top: var(--space-4)` + `border-top: 1px solid var(--border)`。
  - `.selection-detail`：覆盖 `.panel` 卡片为 `border: 0; border-radius: 0; background: transparent; padding: 0; max-width: 100%;`（替换旧 `max-width: calc(...)`、`border-radius: var(--radius-md)`、`color-mix` 背景、`--space-7` padding）；保留 `flex: 1 1 auto; width: auto; min-width: 0; box-sizing: border-box;` 与内部 `gap: var(--space-7)`。
  - 删除不再使用的 `.selection-detail__title` 规则；`.selection-meta` / `__highlight` 内部子分隔保留；作用域为全局（宽/窄屏一致）。
  - 未改此前去卡片 / 细竖线 / 全出血 / 单一平面背景改动，未改 `PageSplit.tsx` / `paneSplit.ts` / `exportStructure.ts`。
- `apps/web/src/designTokens.test.ts`：
  - 改写 `paired spacing coupling (R-1/R-2)` 中的 `.selection-detail` 用例为新合同 `keeps the flattened selection detail full-width under the diagram`（断言 `max-width: 100%`，去掉旧 `gap` 耦合）；`.chrome-meta` 耦合用例保持不变。
  - 新增 `selection detail flattening (V-12 / V-13)` describe：V-12 源码扫描 `StructureMap.tsx` 不含 `selection-detail__title`、含 `id="selection-detail-panel"` 与 `panel selection-detail`，`App.tsx` 仍含 `"selection-detail-panel"`；V-13 CSS 合同断言 wrap 含 `border-top: 1px solid var(--border)` / `padding-top: var(--space-4)` / `margin-top: var(--space-5)` 且无 `gap` / `flex-direction: row`，`.selection-detail` 含 `border:0` / `border-radius:0` / `background:transparent` / `padding:0` / `max-width:100%`，`styles.css` 不含 `.selection-detail__title`。
  - `exportStructure.test.ts` 未改，fixture 路径（`composeExportRoot` 剥离 `.selection-detail-wrap`）继续通过。

### 测试先行记录（TDD）

| Spec ID / 行为项 | 测试 | 先失败 | 后通过 | 说明 |
|---|---|---|---|---|
| V-12 detail DOM | `selection detail flattening … > drops the detail title but keeps the panel id and classes (V-12)` | 先运行 `pnpm --filter web test -- --run designTokens`：1 failed（`expected '…selection-detail__title…' not to contain 'selection-detail__title'`） | 删 DOM 后通过 | 源码扫描标题移除 + id/类保留 + `App.tsx` `aria-controls` 保留 |
| V-13 detail CSS 合同 | `… > embeds the detail below the diagram behind a single rule (V-13)` | 失败（wrap 块仍含 `display: flex` / `flex-direction: row` / `gap`，无 `border-top`；`.selection-detail` 仍 `calc` max-width + 卡片样式） | 改 CSS 后通过 | 断言 wrap 顶部横线/内边距/无 gap/无横向 flex，detail 覆盖 `.panel`，`styles.css` 无 `__title` 规则 |
| V-14 R-2 改写 | `paired spacing coupling (R-1/R-2) > keeps the flattened selection detail full-width under the diagram` | 失败（旧 `max-width: calc(100% - 2.85rem - var(--space-3))`） | 改 CSS 后通过 | 断言 `max-width: 100%`；`.chrome-meta` 耦合用例保持通过 |

### 验证（实施后）

| 命令 | 验证层 | 结果摘要 / 证据 |
|---|---|---|
| `pnpm --filter web test` | unit | `Test Files 22 passed (22)`、`Tests 317 passed (317)`（较 `89aec7c` 的 315 增 V-12/V-13 两例，改写 R-2 一例；`designTokens.test.ts`、`exportStructure.test.ts` 12 用例均通过） |
| `pnpm --filter web typecheck` | static | `tsc -p tsconfig.json --noEmit`，零错误输出 |
| `pnpm build` | build | 全 workspace 成功；`apps/web build: ✓ built in 603ms`，`dist/assets/index-5CHRYN_w.css 43.61 kB`、`index-DrxeiQoU.js 327.61 kB` |
| 人工视觉 V-18（detail 平铺） | manual | 未在本会话执行（见「未解决风险 / 验证缺口」；QA 阶段补做） |

### 目标分支同步（Review / QA 前，git.md §7.1）

- 目标分支及提交: `main` @ `c0a938dfd1b7673579076a2e7c60e56dd7e04dbd`（与 `main.md` 基线一致）
- 同步方式: 显式 `git stash push -- workflow/` 暂存工作流文档后 `git fetch origin`；`origin/main` @ `ed8437c` 落后本地 `main` 7 个提交（`origin/main...main` = `0 7`），`main` 是 HEAD 的祖先（`main...HEAD` = `0 5`），源分支已基于最新目标，无需 rebase；`git stash pop` 恢复工作流文档，未使用 autostash
- 源分支 HEAD（提交后）: `536a4bbbaab2a8eee990f821cbefaae5b1780566`（`refactor(web): embed selection detail below the structure diagram`，父 `89aec7c`）
- 冲突及处理: N/A（未 rebase，无冲突）
- 同步后复验: 未发生 rebase 与内容变化，验证对象为 `536a4bb`，上述 unit / static / build 结果有效

## 合并前细化回执：底部横线全宽（2026-09-13）

> 用户合并前第四次反馈（附截图）：detail 顶部横线两端各留有一段空隙，要求延长到结构面板两端贴边。Plan 扩展任务 7 + 新增 V-19 / V-20，`ui-design.md` 新增「底部横线全宽（追加细化）」节。

### 变更

- `apps/web/src/styles.css`：`.selection-detail-wrap` 增加 `margin-left: calc(-1 * var(--space-5));`、`margin-right: calc(-1 * var(--space-5));`（抵消 `.structure-diagram` 的水平 `padding: var(--space-5)`，使 `border-top` 抵达其 padding box 两端），增加 `padding-left: var(--space-5);`、`padding-right: var(--space-5);`（内容仍与上方结构行对齐），`max-width: 100%` 改为 `max-width: none`（防止负边距拉伸后被夹回内容宽度）。保留 `margin-top: var(--space-5)` / `width: auto` / `min-width: 0` / `padding-top: var(--space-4)` / `border-top: 1px solid var(--border)`。
- **未改** `.selection-detail`（仍 `max-width: 100%`、`padding: 0`、`background: transparent`）、`.structure-diagram` 的 padding / `overflow-x`，以及此前所有去卡片 / 细竖线 / 全出血 / 单一平面背景 / detail 平铺改动。作用域全局（宽屏与窄屏一致），与 ui-design 一致。
- `apps/web/src/designTokens.test.ts`：新增 **V-19** describe `selection detail full-bleed rule (V-19)`，用例 `stretches the wrap to the structure pane edges without shifting content`：断言 wrap 的 `margin-left/right` 为 `calc(-1 * var(--space-5))`、`padding-left/right` 为 `var(--space-5)`、`max-width` 为 `none`，且仍含 `margin-top` / `padding-top` / `border-top`；断言 `.selection-detail` 仍 `max-width: 100%`（对齐保留）。

### 测试先行记录（TDD）

| Spec ID / 行为项 | 测试 | 先失败 | 后通过 | 说明 |
|---|---|---|---|---|
| V-19 detail 横线全宽 | `selection detail full-bleed rule (V-19) > stretches the wrap to the structure pane edges without shifting content` | 先运行 `pnpm --filter web test -- --run designTokens`：1 failed（`expected '0' to be 'calc(-1 * var(--space-5))'`），317 passed | 改 CSS 后通过 | 断言负水平外边距、等量水平内边距、`max-width: none`，并保留 `border-top` / `padding-top` / `margin-top`；`.selection-detail` 仍 `max-width: 100%`；旧状态因 `margin-left: 0` 而失败 |

### 验证（实施后）

| 命令 | 验证层 | 结果摘要 / 证据 |
|---|---|---|
| `pnpm --filter web test` | unit | `Test Files 22 passed (22)`、`Tests 318 passed (318)`（较 `536a4bb` 的 317 增 V-19 一例） |
| `pnpm --filter web typecheck` | static | `tsc -p tsconfig.json --noEmit`，零错误输出 |
| `pnpm build` | build | 全 workspace 成功；`apps/web build: ✓ built in 608ms`，`dist/assets/index-DVbhzlmn.css 43.73 kB`、`index-C51uc2Dd.js 327.61 kB` |
| 人工视觉 V-20（横线两端无空隙） | manual | 未在本会话执行（见「未解决风险 / 验证缺口」；QA 阶段补做） |

### 目标分支同步（Review / QA 前，git.md §7.1）

- 目标分支及提交: `main` @ `c0a938dfd1b7673579076a2e7c60e56dd7e04dbd`（与 `main.md` 基线一致）
- 同步方式: 显式 `git stash push -- workflow/` 暂存工作流文档（未使用 autostash）后 `git fetch origin`；`origin/main` @ `ed8437c` 落后本地 `main` 7 个提交（`origin/main...main` = `0 7`），`main` 是 HEAD 的祖先（`main...HEAD` = `0 6`），源分支已基于最新目标，无需 rebase；`git stash pop` 恢复工作流文档
- 源分支 HEAD（提交后）: `fcd72ca`（`fix(web): extend the detail divider to the pane edges`，父 `536a4bb`）
- 冲突及处理: N/A（未 rebase，无冲突）
- 同步后复验: 未发生 rebase 与内容变化，恢复工作流文档后重跑 `pnpm --filter web test`：`Test Files 22 passed (22)`、`Tests 318 passed (318)`，验证对象为 `fcd72ca`

### 未解决风险 / 验证缺口（V-20）

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 人工视觉 V-20（横线两端无空隙） | 本会话为自动化 CLI，未启动 `pnpm --filter web dev` 截图 | 纯 CSS 视觉变更，负边距 + 等量内边距为对齐标准做法，无横向溢出（margin box 仍在 `.structure-diagram` 内容框内），功能回归风险低 | QA 阶段用 Playwright + live PG：宽 1280 / 窄 800、亮/暗主题各截图放大横线两端，确认贴 padding box 内缘、无空隙，detail 文本左缘与结构行对齐，且无横向滚动条 |

## 合并前细化回执：横线接入竖向分割线（2026-09-13）

> 用户合并前第五次反馈（附放大截图）：detail 顶部横线左右两端与两条竖向分割线之间仍各留约 5px 空隙。诊断（真实 `styles.css` 静态复刻 + Playwright）：竖线居中于 10px gutter（`GUTTER_PX / 2 = 5px`），横线只到结构面板 padding box 两端（复刻 230..750），竖线在 225/755。Plan 新增任务 8 + V-21 / V-22 / V-23，`ui-design.md` 新增「横线接入竖向分割线（追加细化）」节。

### 变更

- `apps/web/src/styles.css`：
  - `.main-paged .main-split`（`styles.css:1837`，首个 960px 媒体块）新增 `background: var(--surface);`，作为宽屏平铺背景的唯一来源。
  - `.main-paged .split-gutter`（`styles.css:1845`）移除 `background: var(--surface);`，仅保留 `display: block;`（恢复透明，body 渐变不再透出）。
  - `.main-paged .pane-structure`（`styles.css:1859`）`overflow: hidden` → `overflow: visible`；`.main-paged .pane-structure > .structure-diagram`（`styles.css:1863`）新增 `overflow: visible`，允许 detail 横线画入 gutter。
  - 新增宽屏 `.main-paged .selection-detail-wrap` 覆盖块（紧邻既有 `.main-paged .pane-structure .selection-detail-wrap { flex-shrink: 0; }`）：`margin-left/right: calc(-1 * (var(--space-5) + 5px))`、`padding-left/right: calc(var(--space-5) + 5px)`、`max-width: none`，并加注释说明 `+5px` 为 10px `GUTTER_PX` 的一半。
  - **base `.selection-detail-wrap` 未改**（仍 `calc(-1 * var(--space-5))` / `var(--space-5)`），窄屏与 `.selection-detail` 未改；此前所有去卡片 / 细竖线 / 全出血 / 单一平面背景 / detail 平铺改动保留。
- `apps/web/src/designTokens.test.ts`：新增模块级 `wideMediaBodies()` / `wideBlock()` 辅助（与 `paneSplit.test.ts` 同构，按媒体块闭合 `}` 顶格提取 960px 媒体体），新增 **V-21** describe `selection detail divider joins the split lines (V-21)`。
- `apps/web/src/paneSplit.test.ts`：**V-10 用例同步到第五次细化定案**——原断言「宽屏 `.main-paged .split-gutter` 含 `background: var(--surface)`」改为「宽屏 `.main-paged .main-split` 含 `background: var(--surface)`、宽屏 `.main-paged .split-gutter` 不含 `background`」，base 断言不变（plan V-10 已注明早期方案作废、由 V-21 定案）。

### 测试先行记录（TDD）

| Spec ID / 行为项 | 测试 | 先失败 | 后通过 | 说明 |
|---|---|---|---|---|
| V-21 横线接入竖线 | `selection detail divider joins the split lines (V-21) > paints the detail rule into the wide gutter without changing base or narrow` | 加测试后运行 `pnpm --filter web test -- --run designTokens`：1 failed（`expected '\n    grid-template-columns…' to match /background:\s*var\(--surface\)/`，宽屏 `.main-paged .main-split` 尚无背景），318 passed | 改 CSS 后通过 | 断言宽屏 `.main-paged .main-split` 背景、宽屏 `.main-paged .split-gutter` 无 `background`、宽屏 `.pane-structure` 与 `> .structure-diagram` `overflow: visible`、宽屏 wrap 的 `calc(-1 * (var(--space-5) + 5px))` / `calc(var(--space-5) + 5px)` / `max-width: none`，且 base wrap 仍 `calc(-1 * var(--space-5))` / `var(--space-5)`、base `.split-gutter` 仍 `transparent` |
| V-10 单一平面背景（同步） | `paneSplit.test.ts > … > puts wide gutters and panes on one flat surface (V-10)` | 改 CSS 后旧 V-10 失败（`wideGutter` 不再含背景），319 中 1 failed | 同步 V-10 断言后通过 | 平铺背景由 `.main-paged .main-split` 承载；base 三区 / gutter 背景不变 |

### 验证（实施后）

| 命令 | 验证层 | 结果摘要 / 证据 |
|---|---|---|
| `pnpm --filter web test` | unit | `Test Files 22 passed (22)`、`Tests 319 passed (319)`（较 `fcd72ca` 的 318 增 V-21 一例；V-10 同步改写；`designTokens.test.ts` 14 用例、`paneSplit.test.ts` 13 用例全过） |
| `pnpm --filter web typecheck` | static | `tsc -p tsconfig.json --noEmit`，零错误输出 |
| `pnpm build` | build | 全 workspace 成功；`apps/web build: ✓ built in 607ms`，`dist/assets/index-BOaWJuWw.css 43.98 kB`、`index-BHt2NEOv.js 327.61 kB` |
| 人工视觉 V-23（横线与竖线相接） | manual | 未在本会话执行（见「未解决风险 / 验证缺口」；QA 阶段补做） |

### 目标分支同步（Review / QA 前，git.md §7.1）

- 目标分支及提交: `main` @ `c0a938dfd1b7673579076a2e7c60e56dd7e04dbd`（与 `main.md` 基线一致）
- 同步方式: 显式 `git stash push -- workflow/` 暂存工作流文档（未使用 autostash）后 `git fetch origin`；`origin/main` @ `ed8437c` 落后本地 `main` 7 个提交（`origin/main...main` = `0 7`），`main` 是 HEAD 的祖先（`main...HEAD` = `0 7`），源分支已基于最新目标，无需 rebase；`git stash pop` 恢复工作流文档
- 源分支 HEAD（提交后）: `fba35d25dc4bbdfa58f23fcac8a852e1b98ac0cd`（`fix(web): join the detail divider to the split lines`，父 `fcd72ca`）
- 冲突及处理: N/A（未 rebase，无冲突）
- 同步后复验: 未发生 rebase 与内容变化，恢复工作流文档后重跑 `pnpm --filter web test`：`Test Files 22 passed (22)`、`Tests 319 passed (319)`；`pnpm --filter web typecheck` 零错误；`pnpm build` 成功，验证对象为 `fba35d2`

### 未解决风险 / 验证缺口（V-23）

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 人工视觉 V-23（横线与竖线相接） | 本会话为自动化 CLI，未启动 `pnpm --filter web dev` 截图 | 纯 CSS 视觉变更；负边距 + 等量内边距抵消（复刻实测内容 diff=0），`overflow: visible` 仅解除裁剪、`.structure-flow` 仍为内部滚动容器；功能回归风险低 | QA 阶段用 Playwright + live PG：宽 1280 / 窄 800、亮/暗主题各截图放大横线左右两端，确认横线穿过 10px gutter 与两条竖线相接、无空隙，gutter 两侧无暗带，无新增面板/页面滚动条，detail 文本左缘与结构行对齐；窄屏横线仍内缩于卡片内 |

### 实现澄清 / 偏离

- 用户指令第 3 条字面写「change base rule ~line 1009」，但同时要求「Do NOT change narrow/base behavior」，且 plan 任务 8、ui-design「横线接入竖向分割线」与 V-21 均要求 **base `.selection-detail-wrap` 保持 `calc(-1 * var(--space-5))` / `var(--space-5)`、仅宽屏 `.main-paged` 追加 `+5px`**。故实现为宽屏覆盖块，base 不动。无其他偏离。

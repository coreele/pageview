# Review: flat-split-dividers

## 审阅范围

- 实现版本 / 提交: `b1d679f2ca3a14de1328930ef153ff59e62453bb`（`refactor(web): flatten paged panes and use draggable divider lines`），父提交 `3dbd4ce`（预开发文档），基线 `c0a938d`。
- 审阅对象差异: `apps/web/src/styles.css`（+27/−8）、`apps/web/src/paneSplit.test.ts`（+45/−8），仅此两文件。
- 同步核对: `git rev-parse main` = `c0a938dfd1b7673579076a2e7c60e56dd7e04dbd`，与 `main.md` 基线一致；`git merge-base --is-ancestor main flat-split-dividers` 成立，`main...flat-split-dividers` 为 `0 2`，无需 rebase，待审差异即 `b1d679f`。
- 依据: `plan.md`；`ui-design.md`（无 Spec / Design，门禁 skipped）。

## 实现正确性

- **宽屏作用域（专项 1）成立。** 新增覆盖块在 `styles.css:1910-1919`，包在 `@media (min-width: 960px)` 内。选择器 `.main-paged .pane-tree`（0,2,0）、`.main-paged .pane-structure > .structure-diagram`（0,3,0）、`.main-paged .pane-hex > .hex`（0,3,0），均高于随后出现的 base `.pane-tree`（0,1,0，`styles.css:1921`）、`.structure-diagram`（0,1,0，`:646`）、`.hex`（0,1,0，`:1139`）；也高于 `[data-theme="dark"] .structure-diagram`（0,2,0，`:656`，其 `box-shadow` 同样被覆盖）。因此不受源码顺序影响，覆盖稳定生效。
- **窄屏与 HeapPeek 不受影响。** `.split-gutter` 默认 `display: none`，仅 960px 起 `display: block`（`:1856`），窄屏无分割线；覆盖块仅在 ≥960px 生效，base 卡片规则保留。`.main-paged` 在窄屏也存在于 `.main`（`App.tsx:1964` 仅按 `mode === "page" && pageView` 判定，与视口无关），故「窄屏保留卡片」完全依赖该媒体查询，当前实现正确。`HeapPeekOverlay` 渲染为 `<main>` 的兄弟节点（`App.tsx:2236`），不带 `.main-paged`，其 `.main-split` 不匹配覆盖选择器。
- **拖动行为未改。** `PageSplit.tsx` / `paneSplit.ts` 未在提交中改动（`git show b1d679f --numstat` 仅两文件）；`GUTTER_PX = 10`、`pageSplitTemplate`、localStorage、键盘 16px 步进、`is-split-dragging` 均保持。
- **分割线视觉符合 `ui-design.md`。** `::after`（`:574-583`）为 `left:50%; top:0; bottom:0; width:1px; translateX(-50%); var(--border)`，无 `height` / `border-radius`；hover/focus（`:585-589`）为 `width:2px` + `color-mix(in srgb, var(--accent) 55%, var(--border))`；拖动态（`:601-604`）为 `width:2px` + 纯 `var(--accent)`，其特异性 (0,2,2) 高于 hover (0,2,1)，拖动时不会被 hover 覆盖。区域背景与内边距保留，符合「去卡片语言、留背景」的决策。
- **焦点可访问性可接受。** `.split-gutter:focus-visible { outline: none }`（`:591-593`）移除全局 `:focus-visible` 的 2px `var(--focus)` 矩形环，改用 2px accent 混合线体作焦点指示；该模式与既有 `.field-cell`（`:902-917`）、`.free-band`（`:974-988`）一致，线体在透明 gutter 上可见，键盘可达性未降低。

## 测试有效性

- **新合同被真实编码。** `paneSplit.test.ts:92-125` 断言全高 1px 竖线（`width:1px`/`top:0`/`bottom:0`/`left:50%`/`translateX(-50%)`/`var(--border)`）、hover/focus 2px accent 混合且非纯 accent、focus-visible `outline:none`、拖动纯 accent、覆盖块三属性、以及 base 三选择器仍含 `border: 1px solid var(--border)`。断言与 `ui-design.md` 精确规格逐项对应，改错实现会失败。
- **旧药丸合同已完全退役。** 旧断言 `height: 2.5rem` / `translate(-50%,-50%)` 已移除；全仓测试中不再有对旧把手 `height:2.5rem`、药丸 `border-radius` 的引用（`grep` 仅剩与新合同无关的 btree pill 文本与 token 断言）。
- **正则无假阳性。** `block()` / `baseBlock()` 用 `(?:^|\n)` 锚定选择器，`.split-gutter::after` 不会误配 `:hover::after` / `:focus-visible::after`；`baseBlock(".pane-tree")` 不会误配分组规则中的 `.pane-tree,`（后随逗号不匹配 `\s*\{`），命中的是真正的 base 块。
- **不足（非阻塞）**：覆盖块断言未校验其外层 `@media (min-width: 960px)`，仅校验 `.main-paged` 前缀与 base 边框；若日后把该块移出媒体查询，测试仍会通过而窄屏卡片会被误去边框。另 `manual` 层（V-7 真实浏览器宽/窄截图与拖动）在 `dev-notes.md` 记为未执行，当前无自动化覆盖窄屏渲染边界。

## 文档影响核对

| Plan 声明 | 实现是否一致 | 备注 |
|---|---|---|
| 开发文档 | 一致 | `N/A`：无架构 / 接口 / 构建变更，视觉合同由 `ui-design.md` 固化。 |
| 用户文档 | 一致 | `README.md` / `README.zh-CN.md` 未改。以 `grep -niE "gutter\|split\|divider\|card\|radius\|border\|三栏\|三区"` 复查，两文件零命中，确无三区卡片外观或分割线描述，`N/A` 理由成立。 |
| 运维文档 | 一致 | `N/A`：无部署 / 配置 / 依赖变更。 |

## 安全影响核对

| 检查项 | 结果 | 处置状态 | 备注 |
|---|---|---|---|
| 敏感信息 | 不适用 | 无 | 变更仅 CSS 声明与测试断言，无凭据 / 密钥。 |
| 认证与授权 | 不适用 | 无 | 未触及认证、会话、权限模型。 |
| 输入与外部访问 | 不适用 | 无 | 无输入处理、反序列化、出站请求变更。 |
| 依赖变更 | 不适用 | 无 | 无 `package.json` / 锁文件改动。 |

结论：未触发 `security.md` §2 任一安全审阅领域，无需安全整改。

## 必修项

| ID | 位置 | 问题 | 状态 |
|---|---|---|---|
| | | 无 | |

## 非阻塞建议

- `apps/web/src/paneSplit.test.ts:117-125`：可在断言覆盖块内容前，先断言该选择器位于 `@media (min-width: 960px)` 块内（例如提取媒体查询体再匹配，或断言 `@media` 与选择器的相对位置），把「窄屏保留卡片」这一唯一风险点纳入自动化。
- `dev-notes.md:34,56` 记录的 V-7 人工视觉缺口，建议在 QA 阶段按 `ui-design.md` 补做 1280px / 800px、亮/暗主题与拖动核对；这是对窄屏与拖动观感的直接证据。

## 结论

Approve

> 无必修项、无未解决安全问题；上述两项为非阻塞建议，可在 QA 阶段补强。

## 后续动作与复审范围

- 无需退回 Developer；进入 QA。
- QA 重点：宽屏三区无边框/圆角/投影且仅两条全高竖线；窄屏（<960px）仍为卡片；HeapPeek 浮层保持卡片；拖动/键盘/持久化行为不变；补做 V-7 人工视觉证据。
- 若 QA 阶段发生代码或测试改动，须重新 Review。

## 命令与结果

| 命令 | 结果 |
|---|---|
| `pnpm --filter web test` | `Test Files 22 passed (22)`、`Tests 313 passed (313)`；含 `paneSplit.test.ts` 10 用例、`designTokens.test.ts` 10 用例 |
| `pnpm --filter web typecheck` | `tsc -p tsconfig.json --noEmit`，零错误输出 |
| `pnpm build` | 全 workspace 成功；`apps/web build: ✓ built in 625ms`，`dist/assets/index-DjT807gD.css 43.93 kB`、`index-BkCE9mNG.js 327.68 kB` |

Reviewed SHA: `b1d679f2ca3a14de1328930ef153ff59e62453bb`

---

# Review: flat-split-dividers（第 2 轮：宽屏全出血）

## 审阅范围

- 实现版本 / 提交: `782eec29a242499080262f1670f9c7eff1eec317`（`fix(web): make wide paged layout full-bleed`），父提交 `b1d679f`（已 Approve），基线 `c0a938d`。
- 审阅对象差异: `git diff --name-only b1d679f 782eec2` = `apps/web/src/styles.css`、`apps/web/src/paneSplit.test.ts`；`git show 782eec2 --stat` = CSS `+1`、测试 `+34`。CSS 侧唯一改动为 `styles.css:1846` 的 `padding: 0;`（位于第一个 `@media (min-width: 960px)` 的 `.main-paged` 块内）。
- 同步核对: `git rev-parse main` = `c0a938d`，与 `main.md` 基线一致；`git merge-base --is-ancestor main HEAD` 成立；`HEAD` = `782eec2`，无需 rebase，待审差异即 `782eec2`。
- 依据: `plan.md`（任务 3、V-8、V-9）；`ui-design.md`（「全出血（边缘无留白，仅宽屏）」节）；`dev-notes.md`「合并前细化回执」；`qa-report.md`（QA-1）。

## 实现正确性

- **全出血作用域正确（专项 1）。** `padding: 0` 追加于既有 `@media (min-width: 960px)` 的 `.main-paged` 块（`styles.css:1843-1847`，新增行 `:1846`），与 `ui-design.md:76-77` 及 Plan 任务 3 一致。全仓仅三处 `@media (min-width: 960px)`（`:1842`、`:1912`、`:2514`），base `.main` 无宽屏外的 `.main-paged` padding 覆盖；`rg '^\.main-paged'` 仅命中 `:1843` 一处块级规则，故覆盖点唯一、无冲突。
- **窄屏不受影响。** base `.main { padding: var(--space-6); }`（`styles.css:487`）未改。`.main-paged` 在窄屏也存在（`App.tsx:1964` 按 `(mode === "page" && pageView) || tableSplitOpen` 判定，与视口无关），但 `padding: 0` 仅在媒体查询内生效，故 `< 960px` 仍保留 `var(--space-6)` 留白。`@media (max-width: 959px)` 的 `.main-paged .pane-tree { max-width: none }`（`:2171-2175`）亦未受影响。
- **前一轮改动完整保留。** `git diff b1d679f 782eec2 -- apps/web/src/styles.css` 仅输出 `+    padding: 0;` 一行；去卡片覆盖块仍在 `styles.css:1911-1920`，分割线规则仍在 `:574-593`（全高 1px 线）、`:601-604`（拖动 2px 纯 accent）；`PageSplit.tsx` / `paneSplit.ts` 未在提交中改动。
- **三区背景 + 两竖线到边成立。** `.main` 为 `display:flex; flex-direction:column; gap:var(--space-6)`，宽屏 paged 下唯一子项 `.main-split` 为 `flex: 1 1 auto`、`gap: 0`、`align-items: stretch`（`:1849-1855`），`.split-gutter` 为 `align-self: stretch` 且宽屏 `display:block`（`:1857-1859`）；padding 归零后 `.main-split` 铺满 `.main`，三区背景与两条 gutter 竖线左/右/下贴边、顶接 chrome。区域背景（`.pane-tree` 的 `--surface`、`.structure-diagram` / `.hex` 的 `--diagram-bg`）与内边距保留，内容不贴边，符合 `ui-design.md:79-80`。
- **补充观察（非阻塞）。** `.main-paged` 亦覆盖 `tableSplitOpen` 的宽屏三栏（`App.tsx:1964`、`:2073-2104`），故该视图在宽屏同样变为全出血。二者共用同一 `.main-split` 三栏外壳，行为一致，符合 `ui-design.md:7` 的「宽屏 Page 布局」范围；已列入 QA 核对。

## 测试有效性

- **QA-1 已实质关闭。** 新增 `wideMediaBodies()` / `inWideMedia()` / `wideBlock()`（`paneSplit.test.ts:84-108`）按「媒体块闭合 `}` 顶格、内部规则缩进」以惰性 `\n\}` 提取每个 `@media (min-width: 960px)` 体；V-3 增 `expect(inWideMedia(wideOverride)).toBe(true)`（`:145`），V-8 用 `wideBlock(".main-paged")` 仅在宽屏体内取 `.main-paged` 块（`:155-157`）。若覆盖块逃逸媒体查询，`wideOverride` 不再属于任何媒体体、`wideBlock` 也取不到带 `padding:0` 的宽屏块，两断言分别失败。
- **独立反证（不改仓库，临时脚本对真实 CSS 做变异）。** 复制辅助逻辑对 `styles.css` 实测：真实 CSS `wide bodies captured = 3`、V-8 `padding:0` = true；删除宽屏 `.main-paged` 的 `padding: 0` 后 `wideBlock(".main-paged")` 返回 `overflow/min-height` 而**不含** `padding:0` → V-8 `toMatch` 失败；把 `padding:0` 移到媒体查询外的 base `.main-paged` 后 `wideBlock` 同样不含 `padding:0` → V-8 失败（且 `mainPaged` 仍非空，验证的是内容而非仅非空）；将去卡片规则移到媒体查询外后 `inWideMedia(wideOverride)` = false → V-3 失败。结论：V-3 / V-8 对「逃逸媒体查询」与「删除 `padding:0`」两种错误实现均会真实失败。
- **辅助正则稳健性。** 三个宽屏体均被正确捕获，第三个（`:2514`，`.heap-peek-body .main-split`）不含 `.main-paged {`，对 `wideBlock` 无干扰；`wideBlock` 的 `[^}]*` 对 `.main-paged` 块（无嵌套花括号）安全；`inWideMedia` 以 `body.includes(snippet)` 判定，snippet 取自同一 CSS 文本，精确匹配。
- **覆盖边界。** V-8 仅断言 CSS 合同（宽屏 `.main-paged` 有 `padding:0`、base `.main` 仍有 `var(--space-6)`），不覆盖真实渲染的边缘贴合；该视觉由 V-9 人工验证承担，`dev-notes.md:93` 记为未执行，属已知 manual 缺口（非阻塞）。

## 文档影响核对

| Plan 声明 | 实现是否一致 | 备注 |
|---|---|---|
| 开发文档 | 一致 | `N/A`：无架构 / 接口 / 构建变更；视觉合同由 `ui-design.md`「全出血」节固化。 |
| 用户文档 | 一致 | `README.md` / `README.zh-CN.md` 未改；本轮仅新增一条 padding 覆盖，不引入需同步的用户可见行为描述，前轮 `N/A` 理由继续成立。 |
| 运维文档 | 一致 | `N/A`：无部署 / 配置 / 依赖变更。 |

## 安全影响核对

| 检查项 | 结果 | 处置状态 | 备注 |
|---|---|---|---|
| 敏感信息 | 不适用 | 无 | 变更仅 CSS 声明与测试断言，无凭据 / 密钥。 |
| 认证与授权 | 不适用 | 无 | 未触及认证、会话、权限模型。 |
| 输入与外部访问 | 不适用 | 无 | 无输入处理、反序列化、出站请求变更。 |
| 依赖变更 | 不适用 | 无 | 无 `package.json` / 锁文件改动。 |

结论：未触发 `security.md` §2 任一领域，无需安全整改。

## 必修项

| ID | 位置 | 问题 | 状态 |
|---|---|---|---|
| | | 无 | |

## 非阻塞建议

- `paneSplit.test.ts:84-85` 注释称惰性匹配「yields exactly one `@media (min-width: 960px)` block」，实际 `wideMediaBodies()` 会返回全部 3 个宽屏体（含 `:2514` 的 heap-peek 块）。当前断言因 `wideBlock` 选择器与 `inWideMedia` 子串判定而不受影响；如需更严，可让 helper 返回匹配体数组并断言「目标块恰在含 `.main-paged` 的体内」，纯可读性/精度增强，非必须。
- `App.tsx:1964` 的 `tableSplitOpen` 分支使宽屏 table-split 视图同样全出血。请 QA 在 V-9 中一并核对 table-split 宽屏观感是否符合预期（与 paged 三栏一致），避免被误判为回归。
- `ui-design.md:78,104` 已明确：error/notice 面板在宽屏 paged 下随 `padding: 0` 贴边、滚动条移至视口最右缘、最右 gutter 命中区贴边。均为可接受结果，建议 QA 在 V-9 顺带确认面板贴边与边缘拖动可用。
- `dev-notes.md:93` 的 V-9（全出血人工视觉）在本会话仍未执行；建议 QA 阶段补做 1280px / 800px、亮/暗主题截图，作为边缘贴合的运行时证据。

## 结论

Approve

> 无必修项、无未解决安全问题；QA-1 已由 `inWideMedia` / `wideBlock` 实质关闭并经独立变异反证。上述四项为非阻塞建议，留待 QA 阶段补强。

## 后续动作与复审范围

- 无需退回 Developer；进入 QA（第二轮，针对 `782eec2`）。
- QA 重点：宽屏（≥960px）三区背景与两条竖线贴视口左/右/下缘、顶接 chrome 且无外层留白；三区内容仍保留内边距；窄屏（<960px）`.main` 留白与卡片不变；table-split 宽屏一致性；error/notice 贴边与最右缘滚动条/拖动；亮/暗主题；拖动/键盘/持久化行为不变。
- 若 QA 阶段发生代码或测试改动，须重新 Review。

## 命令与结果（第 2 轮）

| 命令 | 结果 |
|---|---|
| `pnpm --filter web test` | `Test Files 22 passed (22)`、`Tests 314 passed (314)`；`paneSplit.test.ts` 11 用例、`designTokens.test.ts` 10 用例通过 |
| `pnpm --filter web typecheck` | `tsc -p tsconfig.json --noEmit`，退出码 0，零错误输出 |
| `pnpm build` | 全 workspace 成功；`apps/web build: ✓ built in 592ms`，`dist/assets/index-5YrF9eiZ.css 43.94 kB`、`index-S3q1lYdD.js 327.68 kB` |
| 独立正则变异脚本（临时目录，不改仓库） | 真实 CSS 捕获 3 个宽屏体；删 `padding:0`、移出媒体查询均使 V-8 失败；去卡片规则移出媒体查询使 V-3 失败 |

Reviewed SHA: `782eec29a242499080262f1670f9c7eff1eec317`

---

# Review: flat-split-dividers（第 3 轮：单一平面背景）

## 审阅范围

- 实现版本 / 提交: `89aec7c4bc8f6f01e7a9ba314f9204bf49534113`（`fix(web): put paged panes and gutters on one flat surface`），父提交 `782eec2`（第 2 轮已 Approve），基线 `c0a938d`。
- 审阅对象差异: `git show 89aec7c --numstat` = `apps/web/src/paneSplit.test.ts` +15、`apps/web/src/styles.css` +2，仅此两文件；`git diff 782eec2 89aec7c -- apps/web/src/styles.css` 仅两行 `+ background: var(--surface);`。无越界变更。
- 同步核对: `git rev-parse HEAD` = `89aec7c`；`git rev-parse main` = `c0a938d`，与 `main.md` 基线一致；`git merge-base --is-ancestor main HEAD` 成立，`git rev-list --left-right --count main...HEAD` = `0 4`，无需 rebase，待审差异即 `89aec7c`。
- 依据: `plan.md`（任务 4、V-10、V-11）；`ui-design.md`「单一平面背景（gutter 不透明 + 三区统一 `--surface`）」节；`dev-notes.md`「合并前细化回执：宽屏单一平面背景」；`main.md` 进度笔记末条。

## 实现正确性

- **改动落点正确（专项 1）。** 第 1 处 `background: var(--surface);` 追加于既有宽屏 `.main-paged .split-gutter { display: block; }` 块内（`styles.css:1857-1860`），全仓 `grep -c '\.main-paged \.split-gutter'` = 1，无重复块，符合 Plan 任务 4 与 `ui-design.md:112`。第 2 处追加于既有宽屏三区覆盖块（`styles.css:1913-1922`，选择器 `.main-paged .pane-tree, .main-paged .pane-structure > .structure-diagram, .main-paged .pane-hex > .hex`），符合 `ui-design.md:113`。
- **base / 窄屏未变（专项 1）。** base `.split-gutter` 仍 `background: transparent`（`styles.css:569`）；base `.pane-tree` 仍 `--surface`（`:1929`）；base `.structure-diagram` / `.hex` 仍 `--diagram-bg`（`:649`、`:1144`）。两处新增均在 `@media (min-width: 960px)`（`:1842-1910`、`:1913-1922`）内，窄屏 `<960px` 与 HeapPeek（不带 `.main-paged`）不受影响。
- **前两轮改动完整保留。** 除两行新增外，`styles.css` 与 `782eec2` 逐字节一致：全出血 `padding: 0`（`:1846`）、去卡片 `border/radius/shadow`（`:1917-1919`）、全高 1px 竖线与 hover/focus/拖动规则（`:574-604`）均在；`PageSplit.tsx` / `paneSplit.ts` 未在提交中改动。
- **阴影带消除成立（专项 2）。** 宽屏 paged 正常路径的网格项 `.pane-tree`（自身背景）、`.split-gutter`（本轮设 `--surface`）、`.pane-structure`（唯一子项 `.structure-diagram` 以 `flex:1 1 auto` 填满，背景 `--surface`）、`.pane-hex`（唯一子项 `.hex` 填满，背景 `--surface`）现全部为不透明 `--surface`，10px 命中区不再透出 `body` 的 `--bg` + 径向渐变（`styles.css:106-109`），故 1px `var(--border)` 线两侧无暗色带。`--bg`（亮 `#e8eef2` / 暗 `#0b1218`）与 `--surface`（亮 `#f7fafc` / 暗 `#141c24`）的差值正是原暗带来源，本轮统一后消失。
- **暗色主题统一背景无对比度问题（专项 2）。** 结构 / hex 由 `--diagram-bg`（亮 `#f1f5f8` / 暗 `#101820`）改为 `--surface`（亮 `#f7fafc` / 暗 `#141c24`），两 token 在同一主题内本就接近，均作为区域基底：hex 文本 `color: var(--text)`（暗 `#e8eef4`）对 `#141c24` 仍为高对比；结构网格线为独立 token `--diagram-grid-line`（`color-mix(#64748b 40%, transparent)`，`:64`）叠于父底色，父色明度变化对线体有效色差仅约 2-3/255，可见性不变；`--region-*` 色块与 `--cell-ink` 均未改。符合 `ui-design.md:115,172` 的判定，观感由 V-11 人工承担。

## 测试有效性

- **V-10 对旧状态真实失败（专项 3）。** 用临时脚本（`/var/folders/.../opencode/review-v10-check.mjs`，不改仓库）对 `git show 782eec2:apps/web/src/styles.css` 复现测试辅助逻辑：旧状态 `wideGutterHasSurface=false`、`wideOverrideHasSurface=false`，V-10 两处 `toMatch` 均失败；当前 `89aec7c` 全部为 true。证实断言由错误实现驱动，非恒真。
- **`wideBlock(".main-paged .split-gutter")` 取块正确（专项 3）。** 提取体为 `"\n    display: block;\n    background: var(--surface);\n  "`，即 `:1857` 的 `display:block` 块（唯一匹配，`wideMediaBodies()` 捕获 3 个宽屏体，首个含该选择器）；`not.toBe("")` 同时把该块锁定在宽屏媒体体内。
- **base 断言正确（专项 3）。** `baseBlock(".split-gutter")` 命中列 0 的 base 块（`:562`，`transparent`）；`.pane-tree` 命中 `:1924`（`--surface`，分组选择器 `.pane-tree,`（`:496`）因后随逗号不匹配 `\s*\{` 而被排除）；`.structure-diagram` / `.hex` 分别命中 `:646` / `:1139`（均 `--diagram-bg`，`.hex-row` 等后缀不误配）。脚本实测五项 base 断言全部为 true。
- **覆盖边界（非阻塞）。** V-10 为 CSS 合同断言，不断言渲染后无暗带；该观感由 V-11 人工承担（`dev-notes.md` 记为未执行）。另 `.pane-structure` 在异常路径（index 视图含 `.panel.parse-warnings`，`App.tsx:2188-2193`）存在 `.pane` 的 `gap: var(--space-4)` 透明间隙透出 body 背景——该间隙非本轮 gutter 暗带，且改动前后一致（`.pane-structure` 始终无背景），属既有边角，不构成回归。

## 文档影响核对

| Plan 声明 | 实现是否一致 | 备注 |
|---|---|---|
| 开发文档 | 一致 | `N/A`：无架构 / 接口 / 构建变更；视觉合同由 `ui-design.md`「单一平面背景」节固化。 |
| 用户文档 | 一致 | `README.md` / `README.zh-CN.md` 未改；本轮仅新增两行 CSS 背景声明，不引入需同步的用户可见行为描述，前轮 `N/A` 理由继续成立。 |
| 运维文档 | 一致 | `N/A`：无部署 / 配置 / 依赖变更。 |

## 安全影响核对

| 检查项 | 结果 | 处置状态 | 备注 |
|---|---|---|---|
| 敏感信息 | 不适用 | 无 | 变更仅 CSS 声明与测试断言，无凭据 / 密钥。 |
| 认证与授权 | 不适用 | 无 | 未触及认证、会话、权限模型。 |
| 输入与外部访问 | 不适用 | 无 | 无输入处理、反序列化、出站请求变更。 |
| 依赖变更 | 不适用 | 无 | 无 `package.json` / 锁文件改动。 |

结论：未触发 `security.md` §2 任一领域，无需安全整改。

## 必修项

| ID | 位置 | 问题 | 状态 |
|---|---|---|---|
| | | 无 | |

## 非阻塞建议

- V-10 已覆盖宽屏 gutter / 三区背景合同，但未断言「暗色主题下 `--diagram-grid-line` 与 hex 文本对比度」。该对比度为本轮统一背景的唯一观感风险点，建议 QA 在 V-11 亮/暗主题截图中明确核对结构网格线与 hex 文本可读性（`ui-design.md:172` 已列为缓解项）。
- `App.tsx:2188-2193` 的 index 异常路径会在 `.pane-structure` 内保留 `.panel.parse-warnings` 与 `.structure-diagram` 之间的 `var(--space-4)` 透明间隙（透出 body 背景）。此为既有行为、非本轮 gutter 暗带，但观感上与「单一平面」目标不一致；建议 QA 在 V-11 顺带核对异常页是否有可见接缝，作为后续可选改进（非必须）。
- `dev-notes.md:129` 的 V-11（线旁无暗带人工视觉）在本会话仍未执行；建议 QA 阶段补做 1280px / 800px、亮/暗主题截图，作为暗带消除的运行时证据。

## 结论

Approve

> 无必修项、无未解决安全问题；V-10 已由独立脚本反证对旧状态真实失败，改动落点、base/窄屏隔离与前两轮改动保留均核对通过。上述三项为非阻塞建议，留待 QA 阶段补强。

## 后续动作与复审范围

- 无需退回 Developer；进入 QA（第三轮，针对 `89aec7c`）。
- QA 重点：宽屏（≥960px）两条 1px 竖线两侧与三区同色、无暗色渐变带（亮/暗主题）；宽屏三区背景均为 `--surface` 且 gutter 命中区不透明；窄屏（<960px）gutter 隐藏、卡片与 `.main` 留白不变；HeapPeek 浮层卡片不变；table-split 宽屏一致性；拖动/键盘/持久化行为不变；异常页（parse-warnings）间隙观感。
- 若 QA 阶段发生代码或测试改动，须重新 Review。

## 命令与结果（第 3 轮）

| 命令 | 结果 |
|---|---|
| `pnpm --filter web test` | `Test Files 22 passed (22)`、`Tests 315 passed (315)`；`paneSplit.test.ts` 12 用例（含 V-10）、`designTokens.test.ts` 10 用例通过 |
| `pnpm --filter web typecheck` | `tsc -p tsconfig.json --noEmit`，退出码 0，零错误输出 |
| `pnpm build` | 全 workspace 成功；`apps/web build: ✓ built in 636ms`，`dist/assets/index-G54fghAq.css 43.99 kB`、`index-CVkews5R.js 327.68 kB`、`index-CRSLwXaL.js 25.46 kB` |
| 独立正则变异脚本（临时目录，不改仓库） | 当前 CSS：V-10 五项断言全 true，`wideBlock` 取到 `display:block` + `background:var(--surface)` 块；旧 `782eec2`：`wideGutterHasSurface` / `wideOverrideHasSurface` 均 false → V-10 失败 |

Reviewed SHA: `89aec7c4bc8f6f01e7a9ba314f9204bf49534113`

---

# Review: flat-split-dividers（第 4 轮：结构图底部 detail 平铺）

## 审阅范围

- 实现版本 / 提交: `536a4bbbaab2a8eee990f821cbefaae5b1780566`（`refactor(web): embed selection detail below the structure diagram`），父提交 `89aec7c`（第 3 轮已 Approve），基线 `c0a938d`。
- 审阅对象差异: `git diff --name-only 89aec7c 536a4bb` = `apps/web/src/StructureMap.tsx`、`apps/web/src/designTokens.test.ts`、`apps/web/src/styles.css`，仅此三文件（`+39/−29`）；`StructureMap.tsx` 仅删 1 行（`.selection-detail__title`），`styles.css` 仅一段 hunk（detail 相关），`designTokens.test.ts` 改写 R-2 并新增 V-12/V-13。无越界变更。
- 同步核对: `git rev-parse main` = `c0a938dfd1b7673579076a2e7c60e56dd7e04dbd`，与 `main.md` 基线一致；`git merge-base --is-ancestor main HEAD` 成立，`git rev-list --left-right --count main...HEAD` = `0 5`，无需 rebase，待审差异即 `536a4bb`；`dev-notes.md:175-181` 记录的同步结论与本核对一致。
- 依据: `plan.md`（任务 7、V-12..V-18）；`ui-design.md`「结构图底部 detail 平铺」节；`dev-notes.md`「合并前细化回执：结构图底部 detail 平铺」；`main.md` 进度笔记末条。

## 实现正确性

- **DOM 变更最小且正确（专项 1）。** `git show 536a4bb -- apps/web/src/StructureMap.tsx` 仅删 `<div className="selection-detail__title">detail</div>` 一行；`StructureMap.tsx:841` 仍为 `<div id="selection-detail-panel" className="panel selection-detail">`，`#selection-detail-panel` id 与 `panel selection-detail` 类完整保留。`renderDetail(selectedField)`（`:851`）、`highlight` 分支（`:853-857`）、`detailOpen && selectedField` 条件（`:839`）与 `detailOpen` prop 均未改；`App.tsx` 未在提交中改动，`App.tsx:1934` 的 `aria-controls="selection-detail-panel"` 与 `:1932-1933` 的 `aria-pressed` / `aria-expanded` 原样。全仓 `apps/web/src` 内 `selection-detail__title` 仅剩 `designTokens.test.ts` 的断言引用，无残留实现。
- **覆盖确实生效（专项 1）。** `.panel`（`styles.css:619`）与 `.selection-detail`（`:1019`）同为单类选择器（特异度 0,1,0），`.selection-detail` 源码在后（脚本实测 `panelIdx` 13690 < `selIdx` 22105），故 `border:0` / `border-radius:0` / `background:transparent` / `padding:0` 稳定胜出，无需 `!important`，与 `ui-design.md:139` 判定一致。
- **wrap 改为单列块正确（专项 1、专项 3）。** `.selection-detail-wrap`（`:1009-1017`）移除 `display:flex` / `flex-direction:row` / `align-items:flex-start` / `gap`，保留 `margin-top: var(--space-5)` / `margin-left: 0` / `width:auto` / `max-width:100%` / `min-width:0`，新增 `padding-top: var(--space-4)` + `border-top: 1px solid var(--border)`。其父 `.structure-diagram`（`:646-654`）是块级容器（非 flex），故 wrap 作为块级子元素自然占满内容宽度，顶部横线贯穿结构图内容区（受 `.structure-diagram` 的 `var(--space-5)` 左右 padding 约束，属「结构面板内」的合理全宽），与 `ui-design.md:136` 一致。
- **内部子分隔保留。** `.selection-detail .selection-meta`（`:1076-1080`）实线与 `.selection-detail__highlight`（`:1103-1108`）虚线未改，与 `ui-design.md:141` 的「保留内部子分隔」决策一致。
- **前三轮改动完整保留。** `git diff 89aec7c 536a4bb -- apps/web/src/styles.css` 仅输出 detail 段一段 hunk；去卡片覆盖块（`:1900-1922`）、全出血 `padding: 0`、gutter `background: var(--surface)`（`:1842-1845`）、全高 1px 竖线与 hover/focus/拖动规则（`:574-604`）均在；`PageSplit.tsx` / `paneSplit.ts` / `exportStructure.ts` 未改。`exportStructure.ts:67` 仍按 `.selection-detail-wrap` 类名剥离，导出路径不受影响。

## 测试有效性

- **V-12 对旧状态真实失败（专项 4）。** 独立脚本（`/var/folders/.../opencode/review4/check.mjs`，不改仓库）对 `git show 89aec7c:apps/web/src/StructureMap.tsx` 复现：旧文件含 `selection-detail__title` → `not.toContain` 失败；当前 `536a4bb` 通过。断言由错误实现驱动，非恒真。
- **V-13 对旧状态真实失败（专项 4）。** 同一脚本对旧 `styles.css` 复现 V-13 的 11 项子断言：仅 `margin-top`（旧 wrap 已保留）为 true，其余 10 项（wrap 无 `border-top`/`padding-top`、含 `gap`/`flex-direction:row`；detail 仍 `calc` max-width、`--radius-md`、`color-mix` 背景、`--space-7` padding；css 仍含 `.selection-detail__title`）均 false → 旧状态整体失败；当前全部 true。
- **R-2 改写有意义（专项 4）。** 旧断言 `max-width = calc(100% - 2.85rem - var(--space-3))` 与 wrap 的 `gap` 耦合；脚本实测旧 CSS `max-width` = `calc(...)`、新 CSS = `100%`。新断言 `keeps the flattened selection detail full-width under the diagram` 去掉了已消失的 gap 耦合，且旧值无法通过，属真实合同而非同义改写。
- **`exportStructure.test.ts` 继续通过。** 该文件 12 用例全过（fixture 用 `.selection-detail-wrap` 验证 `composeExportRoot` 剥离路径，wrap 类名未改）。`designTokens.test.ts` 12 用例全过（含改写 R-2 与新增 V-12/V-13）；`chromeToggle.test.ts` 仍能经 `App.tsx` 命中 `selection-detail-panel`。
- **覆盖边界（非阻塞）。** V-12 的 `App.tsx` 断言是纯子串扫描，若 `aria-controls` 被移出 chrome-actions 仍会通过；但 `exportStructure.test.ts:107-128` 与 `chromeToggle.test.ts:52` 已对该 id 在 chrome-actions 中的相对位置另行断言，组合覆盖足够。V-13 仅断言 CSS 合同，真实观感（顶部横线是否与首个内部横线读起来重复、窄屏卡片内观感）由 V-18 人工承担，`dev-notes.md:173` 记为未执行。

## 文档影响核对

| Plan 声明 | 实现是否一致 | 备注 |
|---|---|---|
| 开发文档 | 一致 | `N/A`：无架构 / 接口 / 构建变更；视觉合同由 `ui-design.md`「结构图底部 detail 平铺」节固化。 |
| 用户文档 | 一致 | `README.md` / `README.zh-CN.md` 未改；本轮为 detail 区去标签 / 去卡片，不引入需同步的用户可见行为描述，前轮 `N/A` 理由继续成立。 |
| 运维文档 | 一致 | `N/A`：无部署 / 配置 / 依赖变更。 |

## 安全影响核对

| 检查项 | 结果 | 处置状态 | 备注 |
|---|---|---|---|
| 敏感信息 | 不适用 | 无 | 变更仅 DOM 删行、CSS 声明与测试断言，无凭据 / 密钥。 |
| 认证与授权 | 不适用 | 无 | 未触及认证、会话、权限模型。 |
| 输入与外部访问 | 不适用 | 无 | 无输入处理、反序列化、出站请求变更。 |
| 依赖变更 | 不适用 | 无 | 无 `package.json` / 锁文件改动。 |

结论：未触发 `security.md` §2 任一领域，无需安全整改。

## 必修项

| ID | 位置 | 问题 | 状态 |
|---|---|---|---|
| | | 无 | |

## 非阻塞建议

- `apps/web/src/styles.css:1020`：`.selection-detail` 的 `flex: 1 1 auto;` 在父级 `.selection-detail-wrap` 改为块级后已成为惰性声明（block 父容器不解析 flex 子项）；同理 `:1871-1873` 的 `.main-paged .pane-structure .selection-detail-wrap { flex-shrink: 0; }` 也早已惰性。均为无害遗留，可后续清理，非本轮引入。
- `apps/web/src/designTokens.test.ts:137`：V-12 的 `app.toContain('"selection-detail-panel"')` 为子串扫描，未绑定到 `aria-controls` 属性；建议（可选）改为正则断言 `aria-controls=...selection-detail-panel`，精度更高，非必须。
- `apps/web/src/styles.css:1016` 的顶部横线与紧邻的首个内部 `.selection-meta` 实线可能读起来重复。`ui-design.md:141` 已允许「若发现重复可只去掉紧邻首个并在 `dev-notes.md` 说明」；建议 QA 在 V-18 中重点核对，若有双线观感则回 Developer 决定是否移除首个内部线。
- `dev-notes.md:173` 的 V-18（detail 平铺人工视觉）在本会话仍未执行；建议 QA 阶段用 Playwright + live PG 补做宽 1280 / 窄 800、亮/暗主题截图，并点击 chrome `Detail` 确认面板仍可折叠、`#selection-detail-panel` 仍被正确关联。

## 结论

Approve

> 无必修项、无未解决安全问题；V-12/V-13 经独立脚本反证对旧状态真实失败，R-2 改写去除了已消失的 gap 耦合且旧值不可通过；覆盖、前三轮改动保留与导出 / 折叠路径均核对通过。上述四项为非阻塞建议，留待 QA 阶段补强。

## 后续动作与复审范围

- 无需退回 Developer；进入 QA（第四轮，针对 `536a4bb`）。
- QA 重点：结构图底部 detail 无可见 `detail` 标签、无圆角 / 边框 / 卡片背景，与结构图之间仅一条 `var(--border)` 横线；宽/窄屏一致；内部 `.selection-meta` / `__highlight` 子分隔保留且顶部横线无重复观感；chrome `Detail` 折叠仍可用；宽屏三区平铺 / 全出血 / 单一平面背景 / 两条竖线无阴影带等前三轮结论不回归；HeapPeek 浮层与 table-split 视图不变。
- 若 QA 阶段发生代码或测试改动，须重新 Review。

## 命令与结果（第 4 轮）

| 命令 | 结果 |
|---|---|
| `pnpm --filter web test` | `Test Files 22 passed (22)`、`Tests 317 passed (317)`；`designTokens.test.ts` 12 用例（含改写 R-2 与 V-12/V-13）、`exportStructure.test.ts` 12 用例、`chromeToggle.test.ts` 11 用例全过 |
| `pnpm --filter web typecheck` | `tsc -p tsconfig.json --noEmit`，退出码 0，零错误输出 |
| `pnpm build` | 全 workspace 成功；`apps/web build: ✓ built in 631ms`，`dist/assets/index-5CHRYN_w.css 43.61 kB`、`index-DrxeiQoU.js 327.61 kB`、`index-CRSLwXaL.js 25.46 kB` |
| 独立脚本反证（临时目录，不改仓库） | 旧 `89aec7c`：V-12 false、V-13 false（11 项子断言仅 margin-top true）、R-2 `max-width` = `calc(100% - 2.85rem - var(--space-3))`；当前 `536a4bb`：V-12 true、V-13 全 true、R-2 = `100%`；源码顺序 `.panel` < `.selection-detail` 成立 |

Reviewed SHA: `536a4bbbaab2a8eee990f821cbefaae5b1780566`

---

# Review: flat-split-dividers（第 5 轮：detail 底部横线全宽）

## 审阅范围

- 实现版本 / 提交: `fcd72ca2c495b520941aa97d4495f075c41941ee`（`fix(web): extend the detail divider to the pane edges`），父提交 `536a4bb`（第 4 轮已 Approve），基线 `c0a938d`。
- 审阅对象差异: `git show fcd72ca --numstat` = `apps/web/src/styles.css` +5/−2、`apps/web/src/designTokens.test.ts` +16，仅此两文件；`git diff 536a4bb fcd72ca -- apps/web/src/styles.css` 仅 `.selection-detail-wrap` 一段 hunk。无越界变更。
- 同步核对: `git rev-parse HEAD` = `fcd72ca`；`git rev-parse main` = `c0a938dfd1b7673579076a2e7c60e56dd7e04dbd`，与 `main.md` 基线一致；`git merge-base --is-ancestor main HEAD` 成立，`git rev-list --left-right --count main...HEAD` = `0 6`，无需 rebase，待审差异即 `fcd72ca`；`dev-notes.md:208-214` 记录的同步结论与本核对一致。
- 依据: `plan.md`（任务 7 扩展、V-19、V-20）；`ui-design.md`「底部横线全宽（追加细化）」节；`dev-notes.md`「合并前细化回执：底部横线全宽」；`main.md` 进度笔记末条。

## 实现正确性

- **负边距精确抵消容器水平 padding（专项 1）。** `.structure-diagram` 的 `padding: var(--space-5) var(--space-5) var(--space-6)`（`styles.css:652`）水平分量即 `var(--space-5)`；wrap 新增 `margin-left/right: calc(-1 * var(--space-5))`（`:1011-1012`）与之逐字相等，故 wrap 的 border box 扩张到 `.structure-diagram` 的 padding box 两端，`border-top`（`:1019`）贴内缘无空隙。
- **`max-width: none` 确为必需（专项 1）。** `.structure-diagram` 同时带 `.structure` 的 `display:flex; flex-direction:column`（`:640-644`），wrap 为列向 flex 项、默认 `align-self: stretch`；负水平外边距使 stretch 后的 border box 为内容框 + 2×`--space-5`。若保留原 `max-width: 100%`（按包含块内容框解析），会将其夹回内容宽度、横线仍留空隙，故 `:1014` 的 `max-width: none` 是正确且必要的覆盖（`ui-design.md:151` 同判）。
- **内容对齐保留（专项 2）。** wrap 新增 `padding-left/right: var(--space-5)`（`:1017-1018`）与负边距等量，内容框左右边界回到原内容框，故 detail 内容仍与结构行对齐；`.selection-detail` 仍 `max-width: 100%`（`:1025`）、`padding: 0`、`background: transparent`，未被本轮改动。独立浏览器复刻（下方「命令与结果」）实测 `detail.left == .structure-flow.left`（偏差 0），宽屏下 wrap 左/右距 `.pane-structure` 均为 0。
- **无横向溢出（专项 3）。** wrap 的 margin box 落在 `.structure-diagram` 内容框内，border box 恰为 padding box 宽度，未超出 border box；独立浏览器复刻实测 `.structure-diagram` `scrollWidth == clientWidth`（窄屏 518/518、宽屏均无横滚），未引入横向滚动条。
- **窄屏可接受（专项 4）。** 窄屏 `.structure-diagram` 保留 `border: 1px solid var(--border)` 与 `--radius-lg`；wrap 横线抵达 padding box 内缘（距外边框 1px，实测 `wrapLeftFromSdBorder=1`、`wrapRightFromSdBorder=1`），即卡片内侧边框内缘满宽横线，与 `ui-design.md:154` 的判定一致，且横线位于卡片中下部、不与圆角相交。
- **前四轮改动完整保留。** `git diff 536a4bb fcd72ca -- apps/web/src/styles.css` 仅 wrap 一段；去卡片覆盖块、全出血 `padding: 0`、gutter `background: var(--surface)`、全高 1px 竖线与 hover/focus/拖动规则、detail 平铺（`.selection-detail` 覆盖 `.panel`、删除 `.selection-detail__title`）均在；`StructureMap.tsx` / `PageSplit.tsx` / `paneSplit.ts` / `exportStructure.ts` 未在提交中改动。

## 测试有效性

- **V-19 对旧状态真实失败（专项 5）。** 独立脚本（`/var/folders/.../opencode/review5/check.mjs`，不改仓库）对 `git show 536a4bb:apps/web/src/styles.css` 复现测试辅助逻辑（`blockFor` / `declValue`）：旧状态 7 项子断言中 `margin-left` / `margin-right` / `padding-left` / `padding-right` / `max-width` 五项均 false（旧值为 `0` / `0` / 空 / 空 / `100%`）→ V-19 整体失败；当前 `fcd72ca` 七项全 true。断言由错误实现驱动，非恒真。
- **取块正确。** `blockFor(".selection-detail-wrap")` 命中列 0 的 base 块（`:1009`），未误配 `:1874` 的 `.main-paged .pane-structure .selection-detail-wrap`（该选择器不以行首 `.selection-detail-wrap` 开头）；`declValue` 逐项取到新增声明。
- **覆盖边界（非阻塞）。** V-19 为 CSS 声明合同，硬编码 `var(--space-5)`，未与 `.structure-diagram` 的水平 padding 建立耦合；若日后调整该 padding，V-19 仍绿而横线会重新出现空隙。真实观感（横线两端无空隙、无横滚）由 V-20 人工承担，`dev-notes.md:220` 记为未执行。
- **回归无破坏。** `designTokens.test.ts` 13 用例全过（含 V-19 与既有 V-12/V-13、R-2）；`exportStructure.test.ts`（`.selection-detail-wrap` 类名未改）、`chromeToggle.test.ts` 等全过。

## 文档影响核对

| Plan 声明 | 实现是否一致 | 备注 |
|---|---|---|
| 开发文档 | 一致 | `N/A`：无架构 / 接口 / 构建变更；视觉合同由 `ui-design.md`「底部横线全宽」节固化。 |
| 用户文档 | 一致 | `README.md` / `README.zh-CN.md` 未改；本轮仅负边距 + 等量内边距的 CSS 细化，不引入需同步的用户可见行为描述，前轮 `N/A` 理由继续成立。 |
| 运维文档 | 一致 | `N/A`：无部署 / 配置 / 依赖变更。 |

## 安全影响核对

| 检查项 | 结果 | 处置状态 | 备注 |
|---|---|---|---|
| 敏感信息 | 不适用 | 无 | 变更仅 CSS 声明与测试断言，无凭据 / 密钥。 |
| 认证与授权 | 不适用 | 无 | 未触及认证、会话、权限模型。 |
| 输入与外部访问 | 不适用 | 无 | 无输入处理、反序列化、出站请求变更。 |
| 依赖变更 | 不适用 | 无 | 无 `package.json` / 锁文件改动。 |

结论：未触发 `security.md` §2 任一领域，无需安全整改。

## 必修项

| ID | 位置 | 问题 | 状态 |
|---|---|---|---|
| | | 无 | |

## 非阻塞建议

- `apps/web/src/designTokens.test.ts:162-165`：V-19 硬编码 `var(--space-5)`，未像 R-1 那样从 `.structure-diagram` 的水平 `padding` 推导；建议改为读取 `.structure-diagram` 的 `padding` 水平分量并断言负边距为其逆、内边距与其相等，以捕捉容器 padding 变更导致的「横线又留空隙」漂移。非必须。
- `apps/web/src/designTokens.test.ts:161-172`：V-19 未断言 `width: auto` / `min-width: 0` 仍保留（负边距拉伸依赖 stretch，若日后误改 `width` 可能破坏扩张），可选补充。
- `dev-notes.md:220` 的 V-20（横线两端无空隙人工视觉）在本会话仍未执行；建议 QA 用 Playwright + live PG 补做宽 1280 / 窄 800、亮/暗主题，放大横线两端确认贴结构面板内缘、detail 文本左缘与结构行对齐、无横向滚动条。
- 宽屏下横线现抵达结构面板两端，会与相邻竖向 gutter 线相接；此为「贴边」诉求的预期结果（`ui-design.md:149`），提示 QA 在 V-20 顺带确认接点观感，避免误判为缺陷。

## 结论

Approve

> 无必修项、无未解决安全问题；负边距精确抵消 `.structure-diagram` 水平 padding，`max-width: none` 为扩张所必需，内容对齐与无横向溢出均经独立浏览器复刻证实，V-19 经独立脚本反证对旧状态真实失败。上述四项为非阻塞建议，留待 QA 阶段补强。

## 后续动作与复审范围

- 无需退回 Developer；进入 QA（第五轮，针对 `fcd72ca`）。
- QA 重点：宽/窄屏 detail 顶部横线两端无空隙、贴结构面板 padding box 内缘；detail 文本左缘与结构行左缘对齐；`.structure-diagram` 无横向滚动条；亮/暗主题；窄屏卡片圆角与横线关系；宽屏横线-竖线接点观感；前四轮结论（去卡片 / 全出血 / 单一平面背景 / detail 平铺）不回归；HeapPeek 浮层与 table-split 视图不变；拖动/键盘/持久化行为不变。
- 若 QA 阶段发生代码或测试改动，须重新 Review。

## 命令与结果（第 5 轮）

| 命令 | 结果 |
|---|---|
| `pnpm --filter web test` | `Test Files 22 passed (22)`、`Tests 318 passed (318)`；`designTokens.test.ts` 13 用例（含新增 V-19）、`paneSplit.test.ts` 12 用例、`exportStructure.test.ts` 12 用例全过 |
| `pnpm --filter web typecheck` | `tsc -p tsconfig.json --noEmit`，退出码 0，零错误输出 |
| `pnpm build` | 全 workspace 成功；`apps/web build: ✓ built in 629ms`，`dist/assets/index-DVbhzlmn.css 43.73 kB`、`index-C51uc2Dd.js 327.61 kB`、`index-CRSLwXaL.js 25.46 kB` |
| 独立脚本反证（临时目录，不改仓库） | 旧 `536a4bb`：V-19 七项子断言中五项 false（`margin-left`=`0`、`margin-right`=`0`、`padding-left/right`=空、`max-width`=`100%`）→ V-19 失败；当前 `fcd72ca` 全 true |
| 独立浏览器复刻（Playwright + 构建产物 CSS，临时目录，不改仓库） | 窄屏（`.pane-structure` 520px、含 1px 边框）：`scrollWidth==clientWidth==518` 无横滚；wrap 左右距 `.structure-diagram` 边框各 1px（=边框宽，即贴 padding box 内缘）；`detail.left==structure-flow.left` 对齐。宽屏（`.main-paged`、1280px、`.structure-diagram` border 0）：wrap 左右距 `.pane-structure` 均为 0（贴面板两端），无横滚 |

Reviewed SHA: `fcd72ca2c495b520941aa97d4495f075c41941ee`

---

# Review: flat-split-dividers（第 6 轮：detail 横线接入竖向分割线）

## 审阅范围

- 实现版本 / 提交: `fba35d25dc4bbdfa58f23fcac8a852e1b98ac0cd`（`fix(web): join the detail divider to the split lines`），父提交 `fcd72ca`（第 5 轮已 Approve），基线 `c0a938d`。
- 审阅对象差异: `git show fba35d2 --numstat` = `apps/web/src/styles.css` +13/−2、`apps/web/src/designTokens.test.ts` +46、`apps/web/src/paneSplit.test.ts` +5/−1，仅此三文件；`git diff fcd72ca fba35d2 -- apps/web/src/styles.css` 仅宽屏媒体块内四段 hunk。无越界变更，工作树对 `apps/`、`packages/` 干净。
- 同步核对: `git rev-parse HEAD` = `fba35d2`；`git rev-parse main` = `c0a938dfd1b7673579076a2e7c60e56dd7e04dbd`，与 `main.md` 基线一致；`git merge-base --is-ancestor main HEAD` 成立，`git rev-list --left-right --count main...HEAD` = `0 7`，无需 rebase，待审差异即 `fba35d2`；`dev-notes.md` 末段「目标分支同步」记录的结论与本核对一致。
- 依据: `plan.md`（任务 8、V-21/V-22/V-23）；`ui-design.md`「横线接入竖向分割线（追加细化）」节；`dev-notes.md`「合并前细化回执：横线接入竖向分割线」；`main.md` 进度笔记末条。

## 实现正确性

- **5px 延伸精确抵达 gutter 中线（专项 1）。** `GUTTER_PX = 10`（`paneSplit.ts:3`），竖线居中于 10px gutter（`styles.css:577-581`），故线位于 pane 边缘外 5px。base `.selection-detail-wrap` 的 `margin-left/right: calc(-1 * var(--space-5))`（`:1011-1012`）把 wrap 的 border box 拉到 `.structure-diagram` padding box 两端；宽屏下 `.main-paged .pane-structure > .structure-diagram` border 为 0（`:1914-1920`）且 pane 无 padding，故该端即 pane 边缘。宽屏覆盖块再各加 `5px`（`:1882-1885`，`= GUTTER_PX / 2`），横线两端恰落在 gutter 中线。独立浏览器复刻（真实 `styles.css` + 构建产物，临时目录）实测：`wrapLeft == gutter1Center`（`274.59 == 274.59`，gap 0）、`wrapRight == gutter2Center`（`945.41 == 945.41`，gap 0）。
- **平铺背景移到 `.main-paged .main-split` + gutter 透明，消除 body 渐变暗带（专项 2）。** `styles.css:1843` 为 `.main-paged .main-split` 设 `background: var(--surface)`；`:1846-1848` 的宽屏 `.main-paged .split-gutter` 仅保留 `display: block`（不再有背景，base `:569` 仍 `transparent`）。gutter 是网格项、位于 `.main-split` 之上，其透明区域透出的是不透明 `--surface` 而非 body 渐变。复刻计算样式实测：`main-split` 背景 `rgb(247,250,252)`（不透明 `--surface`）、gutter `rgba(0,0,0,0)`、两条 `::after` 均为 `rgb(197,208,218)`（`--border`），线两侧同色、无暗带。
- **`overflow: visible` 不引入滚动条、布局不破（专项 3）。** 宽屏 `.pane-structure`（`:1859-1861`）与 `> .structure-diagram`（`:1863-1867`）改 `overflow: visible`，但 `.main-paged .pane-structure .structure-flow` 仍 `overflow: auto`（`:1869-1873`）承担内部滚动。负边距不改变 wrap 的 margin box（border box +2×(space5+5)，padding +2×(space5+5)，margin box 仍等于原内容宽），故不产生布局溢出；仅 border/paint 外扩 5px 至 gutter，仍落在 `.main-split` 宽度内，`.main-paged` 的 `overflow: hidden`（`:1832`）兜底。复刻实测：`documentElement` / `body` / `.main-split` / `.main-paged` 的 `scrollWidth == clientWidth`（1280），`.structure-flow` `scrollWidth == clientWidth`（645），无横向滚动条。
- **绘制顺序正确、两线相接（专项 4）。** `.split-gutter` 为 `position: relative`（`:571`），其 `::after` 为 `position: absolute`（`:574-583`），按 CSS 绘制顺序位于「定位后代替层」，高于 `.pane-structure` 内联流内的 `border-top`；无论 gutter 在 DOM 中位于 pane 之前还是之后，竖线均画在横线之上。两者同为 `var(--border)` 且几何重合（wrap 边缘 = 线中心），接点连续。第一条（tree|structure）gutter 虽在 DOM 中先于 pane，定位 `::after` 仍覆盖横线端点，故无空隙。
- **窄屏与 base 不变（专项 5）。** base `.selection-detail-wrap` 仍为 `calc(-1 * var(--space-5))` / `var(--space-5)`（`:1011-1018`），新增覆盖仅存在于 `@media (min-width: 960px)` 的 `.main-paged` 作用域。独立窄屏（800px）复刻实测：gutter `display: none`、`.structure-diagram` `overflow-x: auto`、`border-left: 1px`、wrap 距边框 1px（贴 padding box 内缘）、无横向滚动。
- **内容对齐保留（专项 6）。** 宽屏覆盖的内边距 `calc(var(--space-5) + 5px)`（`:1884-1885`）与负边距等量，内容框回到原位。复刻实测宽屏 `detail.left == structure-flow.left`（`287.59 == 287.59`，偏差 0）。
- **前五轮改动完整保留。** `git diff fcd72ca fba35d2 -- apps/web/src/styles.css` 仅宽屏块内 `.main-split` 背景、`.split-gutter` 背景移除、`pane-structure`/`structure-diagram` overflow、wrap 覆盖四段；去卡片覆盖块、全出血 `padding: 0`、全高 1px 竖线 / hover / focus / 拖动、detail 平铺均未动；`StructureMap.tsx` / `PageSplit.tsx` / `paneSplit.ts` / `exportStructure.ts` 未在提交中改动。`.selection-detail-wrap` 确为 `.structure-diagram` 直接子节点（`StructureMap.tsx:840`），负边距基准正确。

## 测试有效性

- **V-21 对旧状态真实失败（专项 4）。** 独立脚本（`/var/folders/.../opencode/review6/check.mjs`，不改仓库）对 `git show fcd72ca:apps/web/src/styles.css` 复现 `blockFor` / `declValue` / `wideBlock` 逻辑：旧状态 15 项子断言中 9 项 false（`splitHasSurface`、`gutterNoBackground`、`paneOverflowVisible`、`diagramOverflowVisible`、`wrapMarginLeft/Right`、`wrapPadLeft/Right`、`wrapMaxWidth`）→ V-21 失败；当前 `fba35d2` 全 true。
- **改写后的 V-10 同样对旧状态真实失败（专项 4）。** 同脚本对旧状态：`wideSplitSurface` 与 `wideGutterNoBackground` 两项 false → V-10 失败；当前 `fba35d2` 全 true。旧 V-10 断言「宽屏 gutter 含 `--surface` 背景」已退役，改为「背景由 `.main-split` 承载、gutter 无背景」，与新合同一致，非缩减断言（断言项由 5 增至 6）。
- **取块与媒体边界正确。** `designTokens.test.ts:33-49` 新增的 `wideMediaBodies()` / `wideBlock()` 与 `paneSplit.test.ts` 同构，按顶格 `\n}` 切分媒体体；全 CSS 有 3 个 `@media (min-width: 960px)` 块（`:1830` / `:1912` / `:2515`），待断言选择器仅出现在首块，`wideBlock` 按序命中首块，`.heap-peek-body .main-split` 不误配（选择器要求 `.main-paged` 前缀）。
- **V-10 与 V-21 无冲突。** 两者分别在 `paneSplit.test.ts:161-178` 与 `designTokens.test.ts:193-219` 重复断言「宽屏 `.main-split` 含背景」「宽屏 gutter 无背景」，属冗余而非矛盾；两份辅助函数独立、结果一致。TDD 记录（`dev-notes.md`）与本次独立反证一致。
- **回归无破坏。** `designTokens.test.ts` 14 用例（较 `fcd72ca` 增 V-21）、`paneSplit.test.ts` 12 用例全过；`exportStructure.test.ts`（类名未改）、`chromeToggle.test.ts` 等 22 文件 319 用例全过。

## 文档影响核对

| Plan 声明 | 实现是否一致 | 备注 |
|---|---|---|
| 开发文档 | 一致 | `N/A`：无架构 / 接口 / 构建变更；视觉合同由 `ui-design.md`「横线接入竖向分割线」节固化。 |
| 用户文档 | 一致 | `README.md` / `README.zh-CN.md` 未改；本轮仅宽屏覆盖 CSS 与合同断言，不引入需同步的用户可见行为描述，前轮 `N/A` 理由继续成立。 |
| 运维文档 | 一致 | `N/A`：无部署 / 配置 / 依赖变更。 |

## 安全影响核对

| 检查项 | 结果 | 处置状态 | 备注 |
|---|---|---|---|
| 敏感信息 | 不适用 | 无 | 变更仅 CSS 声明与测试断言，无凭据 / 密钥。 |
| 认证与授权 | 不适用 | 无 | 未触及认证、会话、权限模型。 |
| 输入与外部访问 | 不适用 | 无 | 无输入处理、反序列化、出站请求变更。 |
| 依赖变更 | 不适用 | 无 | 无 `package.json` / 锁文件改动。 |

结论：未触发 `security.md` §2 任一领域，无需安全整改。

## 必修项

| ID | 位置 | 问题 | 状态 |
|---|---|---|---|
| | | 无 | |

## 非阻塞建议

- `apps/web/src/designTokens.test.ts:198-200`：V-21 对宽屏 gutter 只接受「不含 `background`」，而 plan V-21 合同允许「不含或显式 `transparent`」；若日后把透明写成显式 `background: transparent`，断言会误报。建议改为「不含非透明背景」或允许 `transparent`。
- `apps/web/src/designTokens.test.ts:214-216`：base wrap 仅断言 `margin-left` / `padding-left`，未覆盖 `margin-right` / `padding-right`（宽屏覆盖块四项齐全，base 侧存在不对称）。建议补齐右侧两项。
- `apps/web/src/styles.css:1882-1885` 与 `apps/web/src/designTokens.test.ts:208-211`：`5px` 为硬编码，未与 `GUTTER_PX` 建立耦合（延续第 5 轮 OBS-3）。若 `GUTTER_PX` 变更，测试与实现会同时漂移；可考虑从 `paneSplit.ts` 导入常量或注释互链。
- `workflow/workspace/flat-split-dividers/dev-notes.md`（验证表）：记 `paneSplit.test.ts` 为 13 用例，实际为 12（vitest 输出 `src/paneSplit.test.ts (12 tests)`）；仅文档计数偏差，不影响结论。
- 折叠态（tree 或 hex 收起）时只渲染一条 gutter，wrap 未接线的另一端会外扩 5px 至视口边缘并被 `.main-paged` 的 `overflow: hidden` 裁剪；此为全出血布局的预期结果，非缺陷，建议 QA 在 V-23 顺带确认观感。
- `dev-notes.md` 的 V-23（横线与竖线相接人工视觉）在本会话仍未执行；建议 QA 用 Playwright + live PG 补做宽 1280 / 窄 800、亮/暗主题，放大横线两端确认与竖线相接、无空隙、gutter 两侧无暗带、无新增滚动条、detail 文本左缘与结构行对齐。

## 结论

Approve

> 无必修项、无未解决安全问题；5px 延伸经独立浏览器复刻证实精确抵达两条 gutter 中线（gap 0），平铺背景移到 `.main-split` 后 gutter 透明且无 body 渐变暗带，`overflow: visible` 未引入横向滚动、`.structure-flow` 仍为内部滚动容器，内容对齐与窄屏不变均经复刻实测；V-21 与改写后的 V-10 经独立脚本反证对旧状态 `fcd72ca` 真实失败。上述六项为非阻塞建议，留待 QA 阶段补强。

## 后续动作与复审范围

- 无需退回 Developer；进入 QA（第六轮，针对 `fba35d2`）。
- QA 重点：宽屏 1280 放大 detail 顶部横线两端，确认穿过 10px gutter 与两条竖线相接、无空隙，gutter 两侧无暗带；结构面板 `overflow: visible` 后无新增面板 / 页面滚动条，`.structure-flow` 仍可独立滚动；detail 文本左缘与结构行左缘对齐；窄屏 800 横线仍内缩于卡片内、不延伸到卡片外；亮/暗主题；折叠态（tree / hex 收起）单线观感；前五轮结论（去卡片 / 全出血 / 单一平面背景 / detail 平铺 / 横线全宽）不回归；HeapPeek 浮层与 table-split 视图不变；拖动 / 键盘 / 持久化行为不变。
- 若 QA 阶段发生代码或测试改动，须重新 Review。

## 命令与结果（第 6 轮）

| 命令 | 结果 |
|---|---|
| `pnpm --filter web test` | `Test Files 22 passed (22)`、`Tests 319 passed (319)`；`designTokens.test.ts` 14 用例（含新增 V-21）、`paneSplit.test.ts` 12 用例（V-10 改写）、`exportStructure.test.ts` 12 用例全过 |
| `pnpm --filter web typecheck` | `tsc -p tsconfig.json --noEmit`，退出码 0，零错误输出 |
| `pnpm build` | 全 workspace 成功；`apps/web build: ✓ built in 602ms`，`dist/assets/index-BOaWJuWw.css 43.98 kB`、`index-BHt2NEOv.js 327.61 kB`、`index-CRSLwXaL.js 25.46 kB` |
| 独立脚本反证（临时目录，不改仓库） | 旧 `fcd72ca`：V-21 15 项子断言中 9 项 false、V-10 两项 false → 两用例均失败；当前 `fba35d2` 全 true |
| 独立浏览器复刻（Playwright + 构建产物 CSS，临时目录，不改仓库） | 宽屏 1280：`wrapLeft == gutter1Center`（274.59）、`wrapRight == gutter2Center`（945.41），gap 均 0；`detail.left == flow.left`（287.59）；`documentElement` / `.main-split` / `.main-paged` `scrollWidth == clientWidth`（1280）、`.structure-flow` 645/645，无横滚；`main-split` 背景 `rgb(247,250,252)` 不透明、gutter `rgba(0,0,0,0)`、两条线 `rgb(197,208,218)`。窄屏 800：gutter `display:none`、diagram `overflow-x:auto`、border 1px、wrap 距边框 1px、无横滚 |

Reviewed SHA: `fba35d25dc4bbdfa58f23fcac8a852e1b98ac0cd`

# QA Report: flat-split-dividers

> 首测与所有回归写在本文件，按轮次追加；禁止 `qa-report-v2.md`。

## 轮次

| 轮次 | 日期 | 实现版本 | 环境 | 范围 | 结论 |
|---|---|---|---|---|---|
| 1 | 2026-09-13 | `b1d679f2ca3a14de1328930ef153ff59e62453bb`（父 `3dbd4ce`，基线 `main` @ `c0a938d`） | macOS / Node ≥20 / pnpm 12.3.4；live PostgreSQL（`localhost:5432`） | 首测：V-1..V-7 全量 + 回归 + 文档/安全 | Pass |
| 2 | 2026-09-13 | `782eec29a242499080262f1670f9c7eff1eec317`（父 `b1d679f`，基线 `main` @ `c0a938d`） | macOS / Node v26.5.0 / pnpm 12.3.4；live PostgreSQL（`localhost:5432`） | 回归：全出血细化，V-1..V-9 复验 + 拖动 + 非阻塞项 | Pass |
| 3 | 2026-09-13 | `89aec7c4bc8f6f01e7a9ba314f9204bf49534113`（父 `782eec2`，基线 `main` @ `c0a938d`） | macOS / Node v26.5.0 / pnpm 12.3.4；live PostgreSQL（`localhost:5432`） | 回归：单一平面背景细化，V-1..V-11 复验 + 像素级无阴影带 + 拖动 + 异常页间隙核对 | Pass |
| 4 | 2026-09-13 | `536a4bbbaab2a8eee990f821cbefaae5b1780566`（父 `89aec7c`，基线 `main` @ `c0a938d`） | macOS / Node v26.5.0 / pnpm 12.3.4；live PostgreSQL（`localhost:5432`） | 回归：detail 平铺细化，V-1..V-18 复验 + V-18 live 宽/窄亮/暗 + 折叠 + 拖动 | Pass |

## 执行命令

| 命令 | 输出摘要 / 证据位置 |
|---|---|
| `pnpm --filter web test` | `Test Files 22 passed (22)`、`Tests 313 passed (313)`；含 `paneSplit.test.ts` 10 用例、`designTokens.test.ts` 10 用例，全部通过 |
| `pnpm --filter web typecheck` | `tsc -p tsconfig.json --noEmit`，退出码 0，零错误输出 |
| `pnpm build` | 全 workspace 成功；`apps/web build: ✓ built in 676ms`，`dist/assets/index-DjT807gD.css 43.93 kB`、`index-BkCE9mNG.js 327.68 kB` |
| `git diff --stat main...HEAD` | 实现提交 `b1d679f` 仅 `apps/web/src/styles.css`(+27/−8)、`apps/web/src/paneSplit.test.ts`(+45/−8)；`main...HEAD` 另含 `workflow/` 文档（`3dbd4ce`）与 `STATUS.md`，符合「仅改 CSS + 测试」的范围 |
| `pnpm exec playwright test e2e/qa-flat-split.spec.ts`（QA 临时 live 视觉 harness，用后即删） | `1 passed`；截图见 `/var/folders/yh/gm9s7yzj35l9q90yrd80fy5m0000gn/T/opencode/qa-flat-split/`：`wide-light.png`、`wide-dark.png`、`wide-light-hover.png`、`wide-light-dragging.png`、`narrow-light.png`、`narrow-dark.png` |

> 视觉 harness 说明：QA 自行编写一次性 Playwright 规格（复用仓库 `playwright.config.ts` + `e2e/helpers`，`globalSetup` 起 live PG 种子库），执行后已删除该规格与 `test-results`，工作树未留 QA 文件；未改动任何代码/测试。

## 覆盖（对照 Spec 验收与 Plan 验证）

> 无 Spec，沿用 Plan 的 `V-n`。

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| V-1 | `.split-gutter::after` 为全高 1px 居中竖线，且无 `height` / `border-radius` | Pass | `paneSplit.test.ts:92-101` 通过；live 计算样式：两条 gutter 的 `::after` `width=1px`、`top=0`、`bottom=0`、`left=5px`(50%)、`transform=translateX(-0.5px)`、`height=679.812px` 等于 gutter 高度（全高）、`background=rgb(197,208,218)`（亮 `--border`）/`rgb(42,56,69)`（暗 `--border`） |
| V-2 | hover/focus-visible 为 2px accent 混合，非纯 accent；`:focus-visible` 含 `outline:none` | Pass | `paneSplit.test.ts:103-110` 通过；live hover：`::after width=2px`、`background=color(srgb 0.38 0.621569 0.621961)`（55% accent 混合，非纯 `var(--accent)`）；focus-visible 由单测断言 + 代码审读（`styles.css:585-593`）覆盖，未单独截取焦点态 |
| V-3 | 宽屏 `.main-paged` 覆盖块三属性 `border:0` / `border-radius:0` / `box-shadow:none`；base 三选择器仍含 `border: 1px solid var(--border)` | Pass | `paneSplit.test.ts:117-125` 通过；live 宽屏三区计算样式均 `border*Width=0px`、`border-radius=0px`、`box-shadow=none`；窄屏三区仍 `border=1px solid`、`radius=4/8px`、structure 保留 inset 高光 |
| V-4 | `pnpm --filter web test` 全绿（含既有 `pageSplitTemplate` / `dragTree` / `dragHex` / `designTokens`） | Pass | 22 文件 / 313 用例全部通过（见「执行命令」） |
| V-5 | `pnpm --filter web typecheck` 零错误 | Pass | 退出码 0，无输出 |
| V-6 | `pnpm build` 成功 | Pass | 全 workspace 成功，`apps/web ✓ built in 676ms` |
| V-7 | 人工视觉：宽屏 1280×800 / 窄屏 800×800、亮/暗主题截图；拖动两条竖线确认宽度变化 | Pass | live Playwright harness（见证据路径）。宽屏：三区无边框/圆角/投影、背景保留、两条全高竖线可见、整体平铺；窄屏：三区恢复卡片外观、gutter `display:none`；拖动：tree 220→300px(+80)，hex 470→530px(+60，向左拖放大 hex)，拖动中 `html.is-split-dragging=true` 且线体 `2px` 纯 accent `rgb(15,118,110)`。亮/暗主题各一次均成立 |

## 回归

| 范围 | 结果 | 证据 |
|---|---|---|
| 拖动 / 键盘 / 持久化逻辑（`PageSplit.tsx`、`paneSplit.ts`） | Pass | `git show b1d679f --numstat` 仅两文件；`PageSplit.tsx`、`paneSplit.ts` 未改；`GUTTER_PX=10`、`pageSplitTemplate`、`dragTree`/`dragHex` 单测全通过 |
| 窄屏堆叠卡片与 HeapPeek 浮层 | Pass | 窄屏 live 三区 `border=1px solid` + `radius=4/8px` + structure inset 阴影；覆盖块限定 `.main-paged` 且在 `@media (min-width:960px)` 内，HeapPeek 在 `.main` 之外不带 `.main-paged`（`App.tsx:2236`），不受影响 |
| 既有全量单测 | Pass | 313/313 通过，无新增失败 |
| 设计 token 约束 | Pass | `designTokens.test.ts` 10 用例通过；新增 `border-radius: 0` 为结构零，未新增圆角字面量 |

## 文档与安全验收

| 项 | 结果 | 备注 |
|---|---|---|
| 用户可见文档 | Pass（N/A 成立） | `grep -niE "gutter\|split\|divider\|card\|radius\|border\|三栏\|三区" README.md README.zh-CN.md` 零命中，README 未描述三区卡片外观或分割线，`N/A` 理由成立；实现未改 README |
| 运维可执行文档 | Pass（N/A 成立） | 无部署 / 配置 / 依赖变更，`git diff` 无 `package.json` / 锁文件改动 |
| 安全验证范围 | Pass | 变更仅 CSS 声明与测试断言；无凭据/密钥、无认证授权、无输入/出站请求、无依赖变更，未触发 `security.md` §2 任一领域 |

## 缺陷

| ID | 严重度 | 摘要 | 状态 | 处理说明 | 验证证据 |
|---|---|---|---|---|---|
| QA-1 | Low（非阻塞） | `paneSplit.test.ts:88-90,117-125` 的 V-3 作用域断言只匹配覆盖块选择器文本，**未校验该块位于 `@media (min-width: 960px)` 内**；因 `.main-paged` 在窄屏也存在（`App.tsx:1964` 只按 `mode==="page" && pageView` 判定，与视口无关），若日后把覆盖块移出媒体查询，测试仍会通过而窄屏卡片会被误去边框 | 记录（不阻塞验收） | 经 QA 判定：当前实现把覆盖块正确置于 `@media (min-width:960px)`（`styles.css:1910-1919`），live 窄屏截图确认卡片保留，无实际功能缺陷；该测试缺口属未来回归风险，Reviewer 已列为非阻塞建议，不要求本轮修复。建议后续把「媒体查询包裹」纳入自动化断言 | 宽/窄屏 live 计算样式；`styles.css:1910-1919` |

> 除 QA-1 外无其他缺陷；QA-1 为已知的非阻塞测试覆盖缺口，不构成未解决功能缺陷，故不改变本轮 `Pass`。

## 阻塞（Blocked 时必填）

- 不适用（本轮无阻塞）。

## 结论

- 本轮结论: Pass
- 合并: 待用户授权

## 备注

- 已独立复核 Reviewer 非阻塞项：V-3 测试确实不会捕获覆盖块逃逸媒体查询（见 QA-1），但实现与运行时行为正确，接受为验收通过。
- 已确认 `PageSplit.tsx` / `paneSplit.ts` 未被触碰；`designTokens.test.ts` 与 `paneSplit.test.ts` 全部通过。
- 验收对象 SHA：`b1d679f2ca3a14de1328930ef153ff59e62453bb`。

---

# 第 2 轮（回归）：宽屏全出血 `782eec2`

## 范围与实现版本

- 实现版本 / 提交: `782eec29a242499080262f1670f9c7eff1eec317`（`fix(web): make wide paged layout full-bleed`），父提交 `b1d679f`（第 1 轮已 Pass），基线 `main` @ `c0a938dfd1b7673579076a2e7c60e56dd7e04dbd`。
- 同步核对: `git rev-parse main` = `c0a938d`，与 `main.md` 基线一致；`git merge-base --is-ancestor main HEAD` 成立；待验对象即 `782eec2`，无需 rebase。
- 范围: Plan `V-1..V-9` 全量复验（重点 V-8 全出血 CSS 合同、V-9 全出血人工视觉），前轮 `QA-1` 关闭复核，Reviewer 非阻塞项核对（table-split 全出血、error/notice 贴边、最右缘滚动条），拖动行为回归，文档与安全。

## 执行命令（第 2 轮）

| 命令 | 输出摘要 / 证据位置 |
|---|---|
| `pnpm --filter web test` | `Test Files 22 passed (22)`、`Tests 314 passed (314)`；`paneSplit.test.ts` 11 用例（含新增 V-8）、`designTokens.test.ts` 10 用例全通过 |
| `pnpm --filter web typecheck` | `tsc -p tsconfig.json --noEmit`，退出码 0，零错误输出 |
| `pnpm build` | 全 workspace 成功；`apps/web build: ✓ built in 611ms`，`dist/assets/index-5YrF9eiZ.css 43.94 kB`、`index-S3q1lYdD.js 327.68 kB` |
| `git diff --stat main...HEAD` | 实现差异 `apps/web/src/styles.css`(+28/−8) 与 `apps/web/src/paneSplit.test.ts`(+79/−8)；其余为 `workflow/` 文档与 `STATUS.md`；无越界文件 |
| `git show 782eec2 --numstat` | 仅 `apps/web/src/paneSplit.test.ts` +34、`apps/web/src/styles.css` +1（`padding: 0;`），无其他路径 |
| `pnpm exec playwright test e2e/qa-flat-split2.spec.ts`（QA 临时 live 视觉 harness，用后即删） | `2 passed`；截图见 `/var/folders/yh/gm9s7yzj35l9q90yrd80fy5m0000gn/T/opencode/qa-flat-split2/`：`wide-light.png`、`wide-dark.png`、`narrow-light.png`、`narrow-dark.png`、`wide-light-dragged.png` |

> 视觉 harness 说明：QA 自行编写一次性 Playwright 规格（复用仓库 `playwright.config.ts` + `e2e/helpers`，`globalSetup` 起 live PG 种子库，`webServer` 起 server + `vite preview` 使用本轮 `pnpm build` 产物），执行后已删除该规格与 `test-results`，工作树未留 QA 文件；未改动任何代码/测试。

## 覆盖（对照 Plan 的 `V-n`）

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| V-1 | `.split-gutter::after` 为全高 1px 居中竖线，且无 `height` / `border-radius` | Pass | `paneSplit.test.ts` 通过；live 计算样式：两条 gutter `::after` `width=1px`、`top=0`、`bottom=0`、`left` 解析为 `50%`/`5px`（10px gutter 居中）、`transform=translateX(-0.5px)`，背景 `var(--border)` |
| V-2 | hover/focus-visible 为 2px accent 混合，非纯 accent；`:focus-visible` 含 `outline:none` | Pass | 单测断言通过；live：hover 后 `::after width=2px`；聚焦 `.split-gutter` 后 `outline-style=none`（线体高亮替代焦点环） |
| V-3 | 宽屏覆盖块三属性 `border:0` / `border-radius:0` / `box-shadow:none`；base 三选择器仍含 `border: 1px solid var(--border)` | Pass | 单测通过；live 宽屏三区计算样式 `border-top-width=0px`、`border-radius=0px`、structure `box-shadow=none`；窄屏三区 `border=1px`、`radius≠0` |
| V-4 | `pnpm --filter web test` 全绿（含既有 `pageSplitTemplate` / `dragTree` / `dragHex` / `designTokens`） | Pass | 22 文件 / 314 用例全部通过 |
| V-5 | `pnpm --filter web typecheck` 零错误 | Pass | 退出码 0，无输出 |
| V-6 | `pnpm build` 成功 | Pass | 全 workspace 成功，`apps/web ✓ built in 611ms` |
| V-7 | 人工视觉：宽 1280×800 / 窄 800×800、亮/暗；拖动两条竖线确认宽度变化与 `col-resize` | Pass | live harness：拖动 tree gutter 后 `.pane-tree` 宽度增大、拖动 hex gutter 后 `.pane-hex > .hex` 宽度增大；拖动中 `html.is-split-dragging=true` 且 `::after width=2px`；宽/窄、亮/暗各截图 |
| V-8 | 单测 CSS 合同：宽屏 `@media (min-width:960px)` 内 `.main-paged` 含 `padding:0`；base `.main` 仍含 `padding: var(--space-6)` | Pass | `paneSplit.test.ts` 新用例 `drops the .main outer whitespace only in the wide paged scope (V-8)` 通过（`wideBlock(".main-paged")` 仅在宽屏媒体体内匹配）；live 宽屏 `.main` 计算 `padding=0px`，窄屏 `padding=9.6px`（`var(--space-6)`） |
| V-9 | 人工视觉（全出血）：宽屏三区背景与两竖线贴视口左/右/底缘、顶接 chrome，无外层留白；三区内边距保留；窄屏 `.main` 留白与卡片不变；亮/暗各一次 | Pass | live harness 断言：宽屏 `.pane-tree` 左缘 x≈0、`.hex` 右缘 x+width≈1280、`.main` 顶 y == `.chrome` 底、`.hex` 底 y+height≈800；三区 padding 均 >0；截图 `wide-light.png` / `wide-dark.png` 目视确认三区背景与两条竖线全出血、顶接 chrome、无外层留白；`narrow-light.png` / `narrow-dark.png` 确认窄屏 `.main` 留白 + 堆叠卡片 |

## 回归

| 范围 | 结果 | 证据 |
|---|---|---|
| 前轮 V-1..V-7 | Pass | 见上表；实现 `782eec2` 仅比 `b1d679f` 多 1 行 CSS + 34 行测试，前轮行为未回退 |
| 拖动 / 键盘 / 持久化逻辑（`PageSplit.tsx`、`paneSplit.ts`） | Pass | `git show 782eec2 --numstat` 未含 `PageSplit.tsx` / `paneSplit.ts`；live 拖动两条 gutter 列宽变化正确；`GUTTER_PX=10`、`pageSplitTemplate` 单测通过 |
| 窄屏堆叠卡片与 HeapPeek 浮层 | Pass | 窄屏 live 三区 `border=1px`、`radius≠0`；`.main` 保留 `var(--space-6)`；覆盖规则限定 `.main-paged` 且在 `@media (min-width:960px)` 内，HeapPeek 在 `.main` 之外（`App.tsx:2236`）不受影响 |
| `QA-1`（前轮 Low，非阻塞） | Pass（已关闭） | `782eec2` 新增 `wideMediaBodies()` / `inWideMedia()` / `wideBlock()`，V-3 增 `expect(inWideMedia(wideOverride)).toBe(true)`，V-8 用 `wideBlock(".main-paged")` 仅匹配宽屏媒体体；规则若逃逸 `@media` 两断言均失败。单测 314 全过，Reviewer 独立变异反证一致 |
| 既有全量单测 | Pass | 314/314 通过，无新增失败 |
| 设计 token 约束 | Pass | `designTokens.test.ts` 10 用例通过；`border-radius: 0` 为结构零，未新增圆角字面量 |

## 文档与安全验收（第 2 轮）

| 项 | 结果 | 备注 |
|---|---|---|
| 用户可见文档 | Pass（N/A 成立） | 本轮仅新增 1 行 `padding: 0` 覆盖；`README.md` / `README.zh-CN.md` 未改，无三区卡片/分割线描述需同步 |
| 运维可执行文档 | Pass（N/A 成立） | 无部署 / 配置 / 依赖变更，无 `package.json` / 锁文件改动 |
| 安全验证范围 | Pass | 变更仅 CSS 声明与测试断言；无凭据/密钥、无认证授权、无输入/出站请求、无依赖变更，未触发 `security.md` §2 任一领域 |

## Reviewer 非阻塞项核对

| 项 | 结果 | 证据 |
|---|---|---|
| `App.tsx:1964` 的 `tableSplitOpen` 宽屏三栏同样全出血 | 符合预期 | `tableSplitOpen` 与 `pageView` 共用同一 `.main-paged` + `.main-split` 外壳（`App.tsx:1964,2073-2146`），本轮 live 验证的正是 table-split Page 视图，其全出血即该分支行为；与 `ui-design.md:7` 的宽屏 Page 范围一致，非回归 |
| error/notice 面板贴边 | 结构确认（未现场触发） | 面板为 `.main` 的 flex 子项（`App.tsx:1965-1985`），`padding:0` 后随 `.main` 贴左/右缘；本轮无错误条件，未单独截图，属轻微证据缺口，非阻塞（`ui-design.md:78` 已声明可接受） |
| 滚动条位于视口最右缘 | Pass | `.main` 宽屏 `padding=0` 且右缘 == 视口右缘（`.hex` 右缘 == 1280），`.main` 为 `overflow:auto` 滚动容器，其滚动条贴视口最右缘；最右 gutter 命中区随之贴边 |

## 缺陷（第 2 轮）

| ID | 严重度 | 摘要 | 状态 | 处理说明 | 验证证据 |
|---|---|---|---|---|---|
| — | — | 本轮无新增缺陷 | — | — | — |
| QA-1 | Low（非阻塞，前轮） | V-3 作用域断言未校验 `@media` 边界 | 已关闭 | `782eec2` 以 `inWideMedia` / `wideBlock` 实质修复，规则逃逸媒体查询时断言失败 | `paneSplit.test.ts` V-3/V-8 断言；314 用例通过；Reviewer 变异反证 |

## 阻塞（第 2 轮）

- 不适用（本轮无阻塞）。

## 结论（第 2 轮）

- 本轮结论: Pass
- 合并: 待用户授权

## 备注（第 2 轮）

- 前轮 `QA-1`（Low，非阻塞）已随 `782eec2` 的媒体查询边界断言关闭。
- 唯一轻微证据缺口：error/notice 面板贴边未现场触发截图，仅有结构与 CSS 合同确认；不构成关键证据缺失，不影响 `Pass`。
- 验收对象 SHA：`782eec29a242499080262f1670f9c7eff1eec317`。

---

# 第 3 轮（回归）：宽屏单一平面背景 `89aec7c`

## 范围与实现版本

- 实现版本 / 提交: `89aec7c4bc8f6f01e7a9ba314f9204bf49534113`（`fix(web): put paged panes and gutters on one flat surface`），父提交 `782eec2`（第 2 轮已 Pass），基线 `main` @ `c0a938dfd1b7673579076a2e7c60e56dd7e04dbd`。
- 同步核对: `git rev-parse main` = `c0a938d`，与 `main.md` 基线一致；`git merge-base --is-ancestor main HEAD` 成立，`main...HEAD` = `0 4`；待验对象即 `89aec7c`，无需 rebase。
- 范围: Plan `V-1..V-11` 全量复验（重点 V-10 单一平面背景 CSS 合同、V-11 线旁无阴影带人工视觉），前轮 `QA-1` 关闭复核，Reviewer 非阻塞项（index 异常路径间隙）核对，拖动回归，文档与安全。

## 执行命令（第 3 轮）

| 命令 | 输出摘要 / 证据位置 |
|---|---|
| `pnpm --filter web test` | `Test Files 22 passed (22)`、`Tests 315 passed (315)`；`paneSplit.test.ts` 12 用例（含 V-10）、`designTokens.test.ts` 10 用例全通过 |
| `pnpm --filter web typecheck` | `tsc -p tsconfig.json --noEmit`，退出码 0，零错误输出 |
| `pnpm build` | 全 workspace 成功；`apps/web build: ✓ built in 708ms`，`dist/assets/index-G54fghAq.css 43.99 kB`、`index-CVkews5R.js 327.68 kB`、`index-CRSLwXaL.js 25.46 kB` |
| `git show 89aec7c --numstat` | 仅 `apps/web/src/paneSplit.test.ts` +15、`apps/web/src/styles.css` +2；无越界文件 |
| `git diff --name-only main...HEAD -- apps packages` | 仅 `apps/web/src/paneSplit.test.ts`、`apps/web/src/styles.css`；`App.tsx` 等组件逻辑未改 |
| `pnpm exec playwright test e2e/qa-flat-split3.spec.ts`（QA 临时 live 视觉 harness，用后即删） | `5 passed`；截图见 `/var/folders/yh/gm9s7yzj35l9q90yrd80fy5m0000gn/T/opencode/qa-flat-split3/`：`wide-light.png`、`wide-dark.png`、`wide-light-hover.png`、`wide-light-dragging.png`、`narrow-light.png`、`narrow-dark.png` |

> 视觉 harness 说明：QA 自行编写一次性 Playwright 规格（复用仓库 `playwright.config.ts` + `e2e/helpers`，`globalSetup` 起 live PG 种子库，`webServer` 起 server + `vite preview` 使用本轮 `pnpm build` 产物），执行后已删除该规格、`test-results` 与 `playwright-report`，工作树未留 QA 文件；未改动任何代码/测试。像素采样方法：`page.screenshot()` 后回灌页面 `canvas.getImageData`，沿第一条 gutter 中线水平采样 x∈[gutter.x−8, gutter.x+width+8]。

## 覆盖（对照 Plan 的 `V-n`）

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| V-1 | `.split-gutter::after` 为全高 1px 居中竖线，且无 `height` / `border-radius` | Pass | `paneSplit.test.ts` 通过；live 计算样式 `::after` `width=1px`、`top=0`、`bottom=0`、`left=50%`、`transform=translateX(-50%)`；线色亮 `rgb(197,208,218)`（`--border`）/ 暗 `rgb(42,56,69)`；gutter 高 699px 全高 |
| V-2 | hover/focus-visible 为 2px accent 混合，非纯 accent；`:focus-visible` 含 `outline:none` | Pass | 单测通过；live hover：`::after width=2px`、`background=color(srgb 0.38 0.621569 0.621961)`（55% accent 混合，≠ 纯 accent `rgb(15,118,110)`）；拖动中 `width=2px`、`background=rgb(15,118,110)` 纯 accent；focus-visible `outline:none` 由单测断言覆盖 |
| V-3 | 宽屏覆盖块三属性 `border:0` / `border-radius:0` / `box-shadow:none`；base 三选择器仍含 `border: 1px solid var(--border)` | Pass | 单测通过；live 宽屏三区 `border*Width=0px`、`border-radius=0px`、`box-shadow=none`；窄屏 `.pane-tree` `border=1px`、`radius=4px`，structure `radius=8px` |
| V-4 | `pnpm --filter web test` 全绿（含既有 `pageSplitTemplate` / `dragTree` / `dragHex` / `designTokens`） | Pass | 22 文件 / 315 用例全部通过 |
| V-5 | `pnpm --filter web typecheck` 零错误 | Pass | 退出码 0，无输出 |
| V-6 | `pnpm build` 成功 | Pass | 全 workspace 成功，`apps/web ✓ built in 708ms` |
| V-7 | 人工视觉：宽 1280×800 / 窄 800×800、亮/暗；拖动两条竖线确认宽度变化与 `col-resize` | Pass | live harness：拖动第一条 gutter +80px，`.pane-tree` 220→300px（`1fr` 的 structure/hex 各让 40：hex 520→480），拖动中 `html.is-split-dragging=true`、`::after width=2px` 纯 accent；宽/窄、亮/暗各截图；见 `wide-light-dragging.png` |
| V-8 | 单测 CSS 合同：宽屏 `@media (min-width:960px)` 内 `.main-paged` 含 `padding:0`；base `.main` 仍含 `padding: var(--space-6)` | Pass | `paneSplit.test.ts` V-8 通过；live 宽屏 `.main` 计算 `padding=0px`，窄屏 `padding=9.6px`（`var(--space-6)`） |
| V-9 | 人工视觉（全出血）：宽屏三区背景与两竖线贴视口左/右/底缘、顶接 chrome，无外层留白；三区内边距保留；窄屏留白与卡片不变；亮/暗各一次 | Pass | live 断言：`.pane-tree` 左缘 x=0、`.hex` 右缘 x+width=1280（=视口宽）、`.main` 顶 y=101 == `.chrome` 底 101、`.main` 底 800（=视口高）、`.main` padding=0；三区 padding 均 >0（tree `5.6px 4px`、structure `8px 8px 9.6px`、hex `5.6px 8px`）；截图 `wide-light.png` / `wide-dark.png` 目视确认；`narrow-*.png` 确认窄屏留白 + 卡片 |
| V-10 | 单测 CSS 合同（单一平面背景）：宽屏首个 `.main-paged .split-gutter` 块含 `background: var(--surface)`；宽屏三区覆盖块含 `background: var(--surface)`；base `.split-gutter` 仍 `transparent`，base `.pane-tree` 仍 `--surface`、base `.structure-diagram` / `.hex` 仍 `--diagram-bg` | Pass | `paneSplit.test.ts` V-10 通过；live 宽屏 `gutterBg == treeBg == structureBg == hexBg == surface`：亮 `rgb(247,250,252)`、暗 `rgb(20,28,36)`；base 合同由单测锁定 |
| V-11 | 人工视觉（无阴影带）：宽屏 1280px 核对两条 1px 竖线两侧背景与三区同色、无暗色渐变带；亮/暗各一次；窄屏确认 gutter 不显示、卡片背景不变 | Pass | 像素级采样（见下「V-11 像素证据」）：亮/暗两条 gutter 中线两侧除线体自身（含 1px 抗锯齿）外全部等于 `--surface`，无任何暗色带；暗色结构网格线与 hex 文本对 `--surface` 对比度达标；窄屏 gutter `display:none`、tree/structure 背景 `rgb(247,250,252)` / `rgb(241,245,248)` 保持卡片 |

### V-11 像素证据（关键项）

- 采样行 y=451（第一条 gutter 垂直中部），x=212..238：
  - 亮色：除 x=224,225 = `rgb(222,229,235)`（1px `--border` 线的抗锯齿像素，两侧过渡）外，其余全部 `rgb(247,250,252)` == `--surface`。
  - 暗色：除 x=224,225 = `rgb(31,42,52)`（`--border` 线）外，其余全部 `rgb(20,28,36)` == `--surface`。
  - 即：线两侧不存在比 `--surface` 更暗的渐变带；旧缺陷的 `--bg`（亮 #e8eef2 / 暗 #0b1218）径向渐变已不可见。
- 暗色主题可读性（统一到 `--surface` 后）：
  - hex 文本 `color=rgb(232,238,244)`（`--text`）对 `--surface rgb(20,28,36)`，分量差合计 > 120，高对比。
  - 结构网格线 `--diagram-grid-line` = `color(srgb 0.392157 0.454902 0.545098 / 0.4)` 叠于 `--surface`，与基底差异 > 10，网格仍可见；`--region-*` 色块与 `--cell-ink` 未改。
  - 目视 `wide-dark.png`：结构单元格、网格线与 hex 文本清晰可读。

## 回归（第 3 轮）

| 范围 | 结果 | 证据 |
|---|---|---|
| 前轮 V-1..V-9 | Pass | 见上表；`89aec7c` 仅比 `782eec2` 多 2 行 CSS + 15 行测试，前两轮行为未回退 |
| 拖动 / 键盘 / 持久化逻辑（`PageSplit.tsx`、`paneSplit.ts`） | Pass | `git show 89aec7c --numstat` 未含 `PageSplit.tsx` / `paneSplit.ts`；live 拖动列宽变化正确、拖动态线体 2px 纯 accent；`GUTTER_PX=10`、`pageSplitTemplate` 单测通过 |
| 窄屏堆叠卡片与 HeapPeek 浮层 | Pass | 窄屏 live gutter `display:none`、三区 `border=1px` / `radius≠0`、`.main` padding 9.6px；两处新增背景均在 `@media (min-width:960px)` 且 `.main-paged` 前缀内，HeapPeek 不带 `.main-paged` 不受影响 |
| 前轮 `QA-1`（Low，非阻塞） | Pass（保持关闭） | `inWideMedia` / `wideBlock` 断言仍通过；315 用例全绿 |
| 既有全量单测 | Pass | 315/315 通过，无新增失败 |
| 设计 token 约束 | Pass | `designTokens.test.ts` 10 用例通过；未新增 `border-radius` 字面量 |

## 文档与安全验收（第 3 轮）

| 项 | 结果 | 备注 |
|---|---|---|
| 用户可见文档 | Pass（N/A 成立） | 本轮仅新增两行 CSS `background` 覆盖；`README.md` / `README.zh-CN.md` 未改，前轮 `N/A` 理由继续成立 |
| 运维可执行文档 | Pass（N/A 成立） | 无部署 / 配置 / 依赖变更，无 `package.json` / 锁文件改动 |
| 安全验证范围 | Pass | 变更仅 CSS 声明与测试断言；无凭据/密钥、无认证授权、无输入/出站请求、无依赖变更，未触发 `security.md` §2 任一领域 |

## Reviewer 非阻塞项核对（第 3 轮）

| 项 | 结果 | 证据 |
|---|---|---|
| `App.tsx:2180-2193` index 异常路径：`.pane-structure` 内 `.panel.parse-warnings` 与 `.structure-diagram` 间 `var(--space-4)` 透明间隙透出 body 背景 | 确认存在，**属既有行为、非本轮回归** | `git diff --name-only main...HEAD -- apps/web/src/App.tsx` 为空（本分支未改 `App.tsx`）；base `main` 的 `.pane { gap: var(--space-4); }`（`styles.css:598-603`）与 `.pane-structure` 无背景在 `main` 已如此。间隙透出的是 body `--bg`，与「单一平面」目标不一致，但仅在 index 视图含 parse-warnings 的异常路径出现，且改动前后一致。列为可选改进，非阻塞、不改变本轮 `Pass` |
| 暗色主题 `--diagram-grid-line` / hex 文本对比度 | Pass | 见 V-11 证据，量化对比度达标 |
| table-split 宽屏一致性 | 符合预期 | `tableSplitOpen` 与 `pageView` 共用 `.main-paged` + `.main-split` 外壳；本轮 live 验证的即 table-split Page 视图，其全出血与单一平面行为即该分支行为 |

## 缺陷（第 3 轮）

| ID | 严重度 | 摘要 | 状态 | 处理说明 | 验证证据 |
|---|---|---|---|---|---|
| — | — | 本轮无新增缺陷 | — | — | — |
| QA-1 | Low（非阻塞，第 1 轮） | V-3 作用域断言未校验 `@media` 边界 | 已关闭（第 2 轮） | `782eec2` 以 `inWideMedia` / `wideBlock` 实质修复 | 315 用例通过 |
| OBS-1 | Info（非阻塞） | index 异常路径 `.pane-structure` 内 `var(--space-4)` 间隙透出 body 背景 | 记录（不阻塞） | 既有行为，本分支未触碰；与「单一平面」目标观感不一致，建议后续可选改进（如给 `.pane-structure` 补 `--surface` 背景或改 `gap`），非本轮范围 | `git diff main...HEAD -- apps/web/src/App.tsx` 为空；`styles.css:598-603` |

## 阻塞（第 3 轮）

- 不适用（本轮无阻塞）。

## 结论（第 3 轮）

- 本轮结论: Pass
- 合并: 待用户授权

## 备注（第 3 轮）

- 关键项 V-11 取得像素级直接证据：宽屏亮/暗两条 1px 竖线两侧除线体自身抗锯齿外均与 `--surface` 完全一致，无阴影/暗色带；旧透明 gutter 透出 body 渐变的根因已消除。
- `OBS-1` 为既有异常路径观感项，非本轮回归、非阻塞；已如实记录。
- 验收对象 SHA：`89aec7c4bc8f6f01e7a9ba314f9204bf49534113`。

---

# 第 4 轮（回归）：结构图底部 detail 平铺 `536a4bb`

## 范围与实现版本

- 实现版本 / 提交: `536a4bbbaab2a8eee990f821cbefaae5b1780566`（`refactor(web): embed selection detail below the structure diagram`），父提交 `89aec7c`（第 3 轮已 Pass），基线 `main` @ `c0a938dfd1b7673579076a2e7c60e56dd7e04dbd`。
- 同步核对: `git rev-parse HEAD` = `536a4bb`；`git rev-parse main` = `c0a938d`，与 `main.md` 基线一致；`git merge-base --is-ancestor main HEAD` 成立，`git rev-list --left-right --count main...HEAD` = `0 5`；待验对象即 `536a4bb`，无需 rebase。
- 范围: Plan `V-1..V-18` 全量复验；重点 V-12/V-13/V-14（detail DOM / CSS 合同 / R-2 改写）与 V-18（detail 平铺人工视觉，宽 1280 / 窄 800、亮/暗、`Detail` 折叠）；复验 V-1..V-11 不回归；Reviewer 非阻塞项（顶部横线是否与首个内部 `.selection-meta` 线重复）核对；文档与安全。

## 执行命令（第 4 轮）

| 命令 | 输出摘要 / 证据位置 |
|---|---|
| `pnpm --filter web test` | `Test Files 22 passed (22)`、`Tests 317 passed (317)`；`designTokens.test.ts` 12 用例（含改写 R-2 与新增 V-12/V-13）、`paneSplit.test.ts` 12 用例、`exportStructure.test.ts` 12 用例、`chromeToggle.test.ts` 11 用例全通过 |
| `pnpm --filter web typecheck` | `tsc -p tsconfig.json --noEmit`，退出码 0，零错误输出 |
| `pnpm build` | 全 workspace 成功；`apps/web build: ✓ built in 603ms`，`dist/assets/index-5CHRYN_w.css 43.61 kB`、`index-DrxeiQoU.js 327.61 kB`、`index-CRSLwXaL.js 25.46 kB` |
| `git show 536a4bb --numstat` | `StructureMap.tsx` +0/−1、`designTokens.test.ts` +32/−6、`styles.css` +7/−22；仅此三文件，无越界 |
| `git diff --name-only main...HEAD -- apps packages` | `apps/web/src/StructureMap.tsx`、`designTokens.test.ts`、`paneSplit.test.ts`、`styles.css`；`App.tsx` / `PageSplit.tsx` / `paneSplit.ts` / `exportStructure.ts` 未改 |
| `git diff 89aec7c 536a4bb -- apps/web/src/styles.css` | 仅 detail 段一段 hunk；gutter 线体、hover/focus/拖动、全出血 `padding:0`、宽屏三区去卡片与 `--surface` 背景均逐字节未变 |
| `pnpm exec playwright test e2e/qa-flat-split4.spec.ts`（QA 临时 live 视觉 harness，用后即删） | `1 passed`；截图见 `/var/folders/yh/gm9s7yzj35l9q90yrd80fy5m0000gn/T/opencode/qa-flat-split4/`：`wide-light.png`、`wide-dark.png`、`narrow-light.png`、`narrow-dark.png`、`wide-light-dragging.png`、各配置 `*-detail-zoom.png`；结构化计算样式证据 `evidence.json` |

> 视觉 harness 说明：QA 自行编写一次性 Playwright 规格（复用仓库 `playwright.config.ts` + `e2e/helpers`，`globalSetup` 起 live PG 种子库，`webServer` 起 server + `vite preview` 使用本轮 `pnpm build` 产物），选中 heap 页 `blkno=0` 的一个 tuple 字段（`title = "tuple lp[119].t_xmin = 12995"`）使 HeapDetail 渲染 `.selection-meta`，执行后已删除该规格、`test-results` 与 `playwright-report`，工作树未留 QA 文件；未改动任何代码/测试。

## 覆盖（对照 Plan 的 `V-n`）

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| V-1 | `.split-gutter::after` 为全高 1px 居中竖线，且无 `height` / `border-radius` | Pass | 本轮提交未触碰该规则（`git diff 89aec7c 536a4bb -- styles.css` 仅 detail 段）；`paneSplit.test.ts` 通过；live 宽屏 `::after` `width=1px`、`top=0`、`bottom=0`、`left=5px`（10px gutter 居中）、`transform=matrix(1,0,0,1,-0.5,0)`、`background=rgb(197,208,218)`（亮 `--border`）/`rgb(42,56,69)`（暗 `--border`）、gutter 高 699px 全高 |
| V-2 | hover/focus-visible 为 2px accent 混合，非纯 accent；`:focus-visible` 含 `outline:none` | Pass | 规则未改（`styles.css:585-593`）；单测断言通过。本轮未单独截取 hover，前轮 live hover 证据仍有效 |
| V-3 | 宽屏覆盖块三属性 `border:0` / `border-radius:0` / `box-shadow:none`；base 三选择器仍含 `border: 1px solid var(--border)` | Pass | 单测通过；live 宽屏 `.pane-tree` `borderTopWidth=0px`、`borderRadius=0px`、`boxShadow=none`；窄屏 `.pane-tree` `borderTopWidth=1px`、`borderRadius=4px`（卡片保留） |
| V-4 | `pnpm --filter web test` 全绿 | Pass | 22 文件 / 317 用例全部通过 |
| V-5 | `pnpm --filter web typecheck` 零错误 | Pass | 退出码 0，无输出 |
| V-6 | `pnpm build` 成功 | Pass | 全 workspace 成功，`apps/web ✓ built in 603ms` |
| V-7 | 人工视觉：宽 1280×800 / 窄 800×800、亮/暗；拖动两条竖线确认宽度变化 | Pass | live harness：宽屏拖动第一条 gutter +80px，`.pane-tree` 220→300px（`delta=80`），拖动中 `html.is-split-dragging=true`，见 `wide-light-dragging.png`；宽/窄、亮/暗各截图 |
| V-8 | 宽屏 `@media (min-width:960px)` 内 `.main-paged` 含 `padding:0`；base `.main` 仍含 `padding: var(--space-6)` | Pass | 单测通过；live 宽屏 `.pane-tree` 左缘 x=0（padding 0），窄屏 `.pane-tree` x=9.59px（`var(--space-6)=9.6px`） |
| V-9 | 人工视觉（全出血）：宽屏三区与两竖线贴视口左/右/底缘、顶接 chrome；窄屏留白与卡片不变；亮/暗各一次 | Pass | live 宽屏：`.pane-tree` x=0、`.hex` `right=1280`（=视口宽）、`.pane-tree` `bottom=800`（=视口高）、`y=101`（=chrome 底）；窄屏 `.pane-tree` x=9.59 且三区卡片；截图 `wide-*.png` / `narrow-*.png` |
| V-10 | 宽屏首个 `.main-paged .split-gutter` 含 `background: var(--surface)`；宽屏三区覆盖块含 `background: var(--surface)`；base gutter `transparent`，base 三区背景不变 | Pass | 单测通过；live 宽屏 gutter 背景 = `.pane-tree` 背景：亮 `rgb(247,250,252)`、暗 `rgb(20,28,36)`，均 `--surface`；窄屏 gutter `display:none`、背景 `rgba(0,0,0,0)` |
| V-11 | 人工视觉（无阴影带）：宽屏两条 1px 竖线两侧与三区同色、无暗色带；亮/暗各一次；窄屏 gutter 不显示、卡片背景不变 | Pass | 本轮提交未改 gutter / 三区背景（diff 仅 detail 段），第 3 轮像素级证据（除线体抗锯齿外整行 `--surface`）继续适用；live 计算样式确认 gutter 与三区背景逐主题一致、无第二背景层；`wide-*.png` / `narrow-*.png` 目视无线旁暗带 |
| V-12 | 源码扫描（detail DOM）：`StructureMap.tsx` 不含 `selection-detail__title`，含 `id="selection-detail-panel"` 与 `className="panel selection-detail"`；`App.tsx` 仍含 `aria-controls` | Pass | `designTokens.test.ts` V-12 通过；`grep` 确认 `StructureMap.tsx:841` 保留 id/类，全仓仅测试断言引用 `selection-detail__title`；`App.tsx:1934` `aria-controls="selection-detail-panel"` 原样 |
| V-13 | `.selection-detail-wrap` 含 `border-top: 1px solid var(--border)` / `padding-top: var(--space-4)` / `margin-top: var(--space-5)`，不含 `gap` / `flex-direction: row`；`.selection-detail` 含 `border:0` / `border-radius:0` / `background:transparent` / `padding:0` / `max-width:100%`；`styles.css` 不含 `.selection-detail__title` | Pass | `designTokens.test.ts` V-13 通过；live 计算样式：wrap `display:block`、`gap:normal`、`borderTop=1px solid`、`paddingTop=7.2px`、`marginTop=8px`；detail `borderTopWidth=0`、`borderRadius=0`、`backgroundColor=rgba(0,0,0,0)`、`padding=0`、`maxWidth=100%`（宽/窄、亮/暗四组一致） |
| V-14 | `designTokens.test.ts` R-2 改写为新合同（去旧 `gap` 耦合，断言 wrap 顶部横线与 `.selection-detail` 覆盖 `.panel`） | Pass | `designTokens.test.ts` 12 用例通过；`exportStructure.test.ts` 12 用例通过（fixture 路径 `.selection-detail-wrap` 未变） |
| V-15 | `pnpm --filter web test` 全部通过 | Pass | 317/317 |
| V-16 | `pnpm --filter web typecheck` 零错误 | Pass | 退出码 0 |
| V-17 | `pnpm build` 成功 | Pass | 全 workspace 成功 |
| V-18 | 人工视觉（detail 平铺）：宽 1280 / 窄 800、亮/暗各截图；无 `detail` 标签、无圆角卡片、与结构图间仅一条 `var(--border)` 横线、内部子分隔保留；`Detail` 可折叠 | Pass | live harness（四组配置）：`titleCount=0`（无标签）；detail 无边框/圆角/背景/内边距（见 V-13）；wrap 顶部横线 `1px solid var(--border)`（亮 `rgb(197,208,218)` / 暗 `rgb(42,56,69)`）位于结构图滚动区下方；`Detail` 按钮 `aria-controls=selection-detail-panel`、`aria-expanded=true`，点击后 `#selection-detail-panel` count=0、再点 count=1；截图 `wide-*.png`、`narrow-*.png`、`*-detail-zoom.png` 目视确认 |

### V-18 细节证据（关键项）

- **无标签 / 无卡片**：四组配置 `document.querySelectorAll(".selection-detail__title").length` 均为 0；`#selection-detail-panel` 计算样式 `borderTopWidth=0px`、`borderRadius=0px`、`backgroundColor=rgba(0,0,0,0)`、`padding=0px`、`maxWidth=100%`。
- **单一横线**：`.selection-detail-wrap` 顶部 `border-top: 1px solid var(--border)`，`padding-top: var(--space-4)=7.2px`、`margin-top: var(--space-5)=8px`；宽屏宽 504px / 窄屏 762.8px，横线贯穿结构面板内容区（受 `.structure-diagram` 内边距约束）。
- **位置**：`.structure-flow` 为结构图滚动区，`.selection-detail-wrap` 为其兄弟且 `flex-shrink:0`（`styles.css:1871-1873`），故 detail 固定在结构面板底部、结构图行之下，正是「直接嵌入结构图下方」。
- **折叠仍受控**：`Detail` 按钮 `aria-controls="selection-detail-panel"`；点击折叠后 `#selection-detail-panel` 从 DOM 移除（count 0），再次点击恢复（count 1）；`aria-expanded` 随之切换。
- **内部子分隔保留**：`.selection-meta`（`border-top: 1px solid`，70% border）与 `.selection-detail__highlight`（虚线）仍在；截图可见 `ctid` 上方与 `highlight bytes` 上方的分隔。

### Reviewer 非阻塞项核对：顶部横线与首个内部 `.selection-meta` 线是否重复

- 结论：**不重复（非问题）**。选中 tuple 时 HeapDetail 渲染顺序为 `infomask 卡片 → .selection-meta → Columns → .selection-detail__highlight`，`.selection-meta` 之前始终有 infomask 内容块，且 `.selection-meta` 仅在 tuple 选择时出现（itemid / header 选择不渲染）。
- 量化：wrap 顶横线 y=420.0，首个内部 `.selection-meta` 线 y=626.0，间距 **206px**（窄屏 153.1px），两者之间有 infomask 与字段值内容，无相邻双线观感。
- 目视：`wide-light.png` / `narrow-light-detail-zoom.png` 确认结构图与 detail 之间一条横线、detail 内部各小节分隔正常，无重复线。

## 回归（第 4 轮）

| 范围 | 结果 | 证据 |
|---|---|---|
| 前轮 V-1..V-11 | Pass | 见上表；`git diff 89aec7c 536a4bb -- apps/web/src/styles.css` 仅 detail 段一段 hunk，gutter / 全出血 / 单一平面背景规则逐字节未变，前轮结论不回归 |
| 拖动 / 键盘 / 持久化逻辑（`PageSplit.tsx`、`paneSplit.ts`） | Pass | `git show 536a4bb --numstat` 未含两文件；live 拖动 tree gutter +80px 列宽正确、拖动中 `is-split-dragging=true`；`paneSplit.test.ts` 12 用例通过 |
| 窄屏堆叠卡片与 HeapPeek 浮层 | Pass | 窄屏 live `.pane-tree` `border=1px` / `radius=4px`、`.main` padding 9.6px、gutter `display:none`；detail 变更全局生效但仅去 wrapper 卡片，`.structure-diagram` 外层卡片保留；HeapPeek 不带 `.main-paged` 不受影响 |
| 导出路径（`exportStructure`） | Pass | `exportStructure.ts` 未改，仍按 `.selection-detail-wrap` 类名剥离；`exportStructure.test.ts` 12 用例通过 |
| 前轮 `QA-1`（Low，非阻塞） | Pass（保持关闭） | `inWideMedia` / `wideBlock` 断言仍通过；317 用例全绿 |
| 既有全量单测 | Pass | 317/317 通过，无新增失败 |
| 设计 token 约束 | Pass | `designTokens.test.ts` 12 用例通过；未新增圆角字面量（`border-radius: 0` 为结构零） |

## 文档与安全验收（第 4 轮）

| 项 | 结果 | 备注 |
|---|---|---|
| 用户可见文档 | Pass（N/A 成立） | 本轮删 detail 标签、去卡片，`README.md` / `README.zh-CN.md` 未改，无 detail 外观描述需同步 |
| 运维可执行文档 | Pass（N/A 成立） | 无部署 / 配置 / 依赖变更，无 `package.json` / 锁文件改动 |
| 安全验证范围 | Pass | 变更仅 DOM 删 1 行、CSS 声明与测试断言；无凭据/密钥、无认证授权、无输入/出站请求、无依赖变更，未触发 `security.md` §2 任一领域 |

## 缺陷（第 4 轮）

| ID | 严重度 | 摘要 | 状态 | 处理说明 | 验证证据 |
|---|---|---|---|---|---|
| — | — | 本轮无新增缺陷 | — | — | — |
| QA-1 | Low（非阻塞，第 1 轮） | V-3 作用域断言未校验 `@media` 边界 | 已关闭（第 2 轮） | `782eec2` 以 `inWideMedia` / `wideBlock` 实质修复 | 317 用例通过 |
| OBS-1 | Info（非阻塞，第 3 轮） | index 异常路径 `.pane-structure` 内 `var(--space-4)` 间隙透出 body 背景 | 记录（不阻塞） | 既有行为、本分支未触碰 `App.tsx`；范围外 | `git diff main...HEAD -- apps/web/src/App.tsx` 为空 |
| OBS-2 | Info（非阻塞） | detail 内部 `renderDetail` 渲染的 `.selection-detail__infomask`（bit-strip）仍为带边框 + `--radius-lg` 的圆角框 | 记录（不阻塞） | 属 detail **内容**而非 detail wrapper 卡片；`ui-design.md` 非目标明确「不改 `renderDetail` 内容渲染」，用户诉求的「圆角矩形卡片」指 detail 外层，已去除。若用户后续希望连内容块一并去卡片，另开细化 | 截图 `*-detail-zoom.png`；`styles.css:1062-1068` |

> 除 OBS-2 外无其他缺陷；OBS-2 为范围外信息项，不构成未解决功能缺陷，不改变本轮 `Pass`。

## 阻塞（第 4 轮）

- 不适用（本轮无阻塞）。

## 结论（第 4 轮）

- 本轮结论: Pass
- 合并: 待用户授权

## 备注（第 4 轮）

- 关键项 V-18 取得宽/窄 × 亮/暗四组 live 直接证据：无 `detail` 标签、detail 无边框/圆角/背景、仅一条 `var(--border)` 横线分隔、`Detail` 折叠往返正常、`#selection-detail-panel` 仍受控。
- Reviewer 关于顶部横线是否与首个内部 `.selection-meta` 线重复的疑问已量化排除（间距 206px / 153px，中间有 infomask 内容）。
- 前轮 `OBS-1` 保持记录；新增 `OBS-2`（内部 infomask 圆角框，范围外信息项）。
- 验收对象 SHA：`536a4bbbaab2a8eee990f821cbefaae5b1780566`。

---

# 第 5 轮（回归）：detail 底部横线全宽 `fcd72ca`

## 范围与实现版本

- 实现版本 / 提交: `fcd72ca2c495b520941aa97d4495f075c41941ee`（`fix(web): extend the detail divider to the pane edges`），父提交 `536a4bb`（第 4 轮已 Pass），基线 `main` @ `c0a938dfd1b7673579076a2e7c60e56dd7e04dbd`。
- 同步核对: `git rev-parse HEAD` = `fcd72ca`；`git rev-parse main` = `c0a938d`，与 `main.md` 基线一致；`git merge-base --is-ancestor main HEAD` 成立，`main...HEAD` 领先 6 个提交；待验对象即 `fcd72ca`，无需 rebase。入口门禁：Review required 且已有 Reviewer 第 5 轮 `Approve`（`review.md:379-401`），审阅版本与待验 HEAD 一致。
- 范围: Plan `V-1..V-20` 全量复验；重点 V-19（wrap 负水平外边距 / 等量水平内边距 / `max-width: none` CSS 合同）与 V-20（横线两端无空隙人工视觉，宽 1280 / 窄 800、亮/暗）；复验 V-1..V-18 不回归；文档与安全。

## 执行命令（第 5 轮）

| 命令 | 输出摘要 / 证据位置 |
|---|---|
| `pnpm --filter web test` | `Test Files 22 passed (22)`、`Tests 318 passed (318)`；`designTokens.test.ts` 13 用例（含新增 V-19）、`paneSplit.test.ts` 12 用例、`exportStructure.test.ts` 12 用例全通过 |
| `pnpm --filter web typecheck` | `tsc -p tsconfig.json --noEmit`，退出码 0，零错误输出 |
| `pnpm build` | 全 workspace 成功；`apps/web build: ✓ built in 605ms`，`dist/assets/index-DVbhzlmn.css 43.73 kB`、`index-C51uc2Dd.js 327.61 kB`、`index-CRSLwXaL.js 25.46 kB` |
| `git show fcd72ca --numstat` | 仅 `apps/web/src/styles.css` +5/−2、`apps/web/src/designTokens.test.ts` +16；无越界文件 |
| `git diff --name-only main...HEAD -- apps packages` | `apps/web/src/StructureMap.tsx`、`designTokens.test.ts`、`paneSplit.test.ts`、`styles.css`；`App.tsx` / `PageSplit.tsx` / `paneSplit.ts` / `exportStructure.ts` 未改 |
| `git diff 536a4bb fcd72ca -- apps/web/src/styles.css` | 仅 `.selection-detail-wrap` 一段 hunk（`margin-left/right` 由 `0` 改 `calc(-1 * var(--space-5))`、`max-width` 由 `100%` 改 `none`、新增 `padding-left/right: var(--space-5)`）；gutter / 全出血 / 单一平面背景 / detail 平铺规则逐字节未变 |
| `pnpm exec playwright test e2e/qa-flat-split5.spec.ts`（QA 临时 live 视觉 harness，用后即删） | `1 passed`；截图见 `/var/folders/yh/gm9s7yzj35l9q90yrd80fy5m0000gn/T/opencode/qa-flat-split5/`：`1280x800-light.png`、`1280x800-dark.png`、`800x800-light.png`、`800x800-dark.png`、各配置 `*-divider.png`；结构化几何证据 `evidence.json` |

> 视觉 harness 说明：QA 自行编写一次性 Playwright 规格（复用仓库 `playwright.config.ts` + `e2e/helpers`，`globalSetup` 起 live PG 种子库，`webServer` 起 server + `vite preview` 使用本轮 `pnpm build` 产物），选中 heap 页 `blkno=0` 的一个结构字段（首个 `.field-cell`，即 `pd_lsn.xlogid`）使 detail 渲染，执行后已删除该规格、`test-results` 与 `playwright-report`，工作树未留 QA 文件；未改动任何代码/测试。

## 覆盖（对照 Plan 的 `V-n`）

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| V-1 | `.split-gutter::after` 全高 1px 居中竖线 | Pass | 本轮提交未触碰该规则（`git diff 536a4bb fcd72ca -- styles.css` 仅 wrap 段）；`paneSplit.test.ts` 通过 |
| V-2 | hover/focus 2px accent 混合，非纯 accent；`:focus-visible` `outline:none` | Pass | 规则未改（`styles.css:585-593`）；单测断言通过 |
| V-3 | 宽屏去卡片三属性；base 三选择器仍含 `border: 1px solid` | Pass | 单测通过；覆盖块（`styles.css:1900-1910`）未改；live 宽屏 `.structure-diagram` `borderLeft/Right=0`、窄屏 `borderLeft/Right=1`（见 V-20 几何） |
| V-4 | `pnpm --filter web test` 全绿 | Pass | 22 文件 / 318 用例全部通过 |
| V-5 | `pnpm --filter web typecheck` 零错误 | Pass | 退出码 0，无输出 |
| V-6 | `pnpm build` 成功 | Pass | 全 workspace 成功，`apps/web ✓ built in 605ms` |
| V-7 | 人工视觉：宽/窄、亮/暗；拖动两条竖线 | Pass | 本轮未改 gutter 与拖动逻辑（diff 未含 `PageSplit.tsx` / `paneSplit.ts`）；第 4 轮 live 拖动 +80px 证据继续适用；本轮宽/窄、亮/暗四组 live 截图 |
| V-8 | 宽屏 `.main-paged` `padding:0`；base `.main` `var(--space-6)` | Pass | 单测通过；宽屏 live `.structure-diagram` 左缘 x=230（`.pane-tree` 220 + gutter 10），窄屏 x=9.59（=`var(--space-6)` 留白） |
| V-9 | 全出血：宽屏三区/竖线贴视口左/右/底缘、顶接 chrome；窄屏留白与卡片不变 | Pass | 单测通过；宽屏 live `.structure-diagram` `top=101`（=chrome 底）、`bottom=800`（=视口高）；窄屏 `.structure-diagram` 有 1px 边框、`.main` 留白 9.59px |
| V-10 | 宽屏 gutter 与三区背景均为 `var(--surface)`；base 背景不变 | Pass | 规则未改；单测通过；live 宽屏 gutter / 三区背景一致 |
| V-11 | 人工视觉（无阴影带）：宽屏两竖线两侧与三区同色；窄屏 gutter 隐藏 | Pass | 本轮提交未改 gutter / 三区背景；第 3 轮像素级证据继续适用；`1280x800-*.png` 目视无线旁暗带 |
| V-12 | 源码扫描：`StructureMap.tsx` 无 `selection-detail__title`、保留 id/类；`App.tsx` 含 `aria-controls` | Pass | `designTokens.test.ts` V-12 通过；`fcd72ca` 未改 `StructureMap.tsx` |
| V-13 | `.selection-detail-wrap` 顶部横线 + 内边距，无 `gap` / 横向 flex；`.selection-detail` 覆盖 `.panel` | Pass | `designTokens.test.ts` V-13 通过；`fcd72ca` 未改 `.selection-detail` |
| V-14 | R-2 改写为新合同；`exportStructure.test.ts` fixture 继续通过 | Pass | `designTokens.test.ts` 13 用例、`exportStructure.test.ts` 12 用例通过 |
| V-15 | `pnpm --filter web test` | Pass | 318/318 |
| V-16 | `pnpm --filter web typecheck` | Pass | 退出码 0 |
| V-17 | `pnpm build` | Pass | 全 workspace 成功 |
| V-18 | 人工视觉（detail 平铺）：无 `detail` 标签、无圆角卡片、单条 `var(--border)` 横线、`Detail` 可折叠 | Pass | `fcd72ca` 仅改 wrap 的 `margin/padding/max-width`，未改 detail 平铺（无标签 / 无卡片 / 单横线 / 折叠）；本轮 live 确认 `.selection-detail-wrap` 存在、顶部 `border-top=1px`、无标签；第 4 轮四组 live 折叠证据继续适用 |
| V-19 | CSS 合同：wrap `margin-left/right: calc(-1 * var(--space-5))`、`padding-left/right: var(--space-5)`、`max-width: none`，且保留 `border-top` / `padding-top` / `margin-top`；`.selection-detail` 仍 `max-width: 100%` | Pass | `designTokens.test.ts` 新增 V-19 用例通过；`styles.css:1009-1020` 逐条核对：`margin-left/right: calc(-1 * var(--space-5))`、`max-width: none`、`padding-left/right: var(--space-5)`、`margin-top: var(--space-5)`、`padding-top: var(--space-4)`、`border-top: 1px solid var(--border)`；`styles.css:1025` `.selection-detail` `max-width: 100%` |
| V-20 | 人工视觉（横线两端无空隙）：宽/窄、亮/暗，横线贴结构面板 padding box 内缘，detail 文本左缘与结构行左缘对齐，无横向滚动条 | Pass | 四组 live 几何证据（见下「V-20 几何证据」）：横线左/右距 padding box 内缘偏差均为 0；detail 文本左缘与 `.structure-flow` 左缘偏差均为 0；`.structure-diagram` `scrollWidth == clientWidth`（宽 520/520、窄 779/779）、`overflow-x: auto`；截图 `*-divider.png` 目视横线贯穿两端 |

### V-20 几何证据（关键项）

> 单位 px；`lineTouchesLeft/Right` = wrap border box 与 `.structure-diagram` padding box 内缘的水平偏差；`contentAligned` = wrap 内容框左缘与 `.structure-flow` 左缘偏差。

| 配置 | `.structure-diagram` | border | padding | wrap 左/右 | flow 左 | detail 标签左 | lineTouches L/R | contentAligned | hscroll |
|---|---|---|---|---|---|---|---|---|---|
| 1280×800 light | 230..750 | 0/0 | 8/8 | 230 / 750 | 238 | 238 | 0 / 0 | 0 | false |
| 1280×800 dark | 230..750 | 0/0 | 8/8 | 230 / 750 | 238 | 238 | 0 / 0 | 0 | false |
| 800×800 light | 9.59..790.41 | 1/1 | 8/8 | 10.59 / 789.41 | 18.59 | 18.59 | 0 / 0 | 0 | false |
| 800×800 dark | 9.59..790.41 | 1/1 | 8/8 | 10.59 / 789.41 | 18.59 | 18.59 | 0 / 0 | 0 | false |

- 宽屏：`.structure-diagram` 无边框，wrap border box 左/右缘与结构面板完全重合（`230..750`），横线贯穿整个结构面板宽度，两端无空隙；右端在 x=750 与右侧竖线 gutter（750..760）相接、左端在 x=230 与左侧 gutter（220..230）相接——即任务注明的「宽屏横线与竖向 gutter 线相接」，属预期，不记为缺陷。
- 窄屏：`.structure-diagram` 保留 1px 边框，wrap 左右缘距外边框各 1px（=`border` 宽），即横线抵达卡片内侧边框内缘、无空隙；圆角位于卡片中上部，横线位于下部，不相交。
- 对齐：四组配置 wrap 内容框左缘 == `.structure-flow` 左缘（偏差 0），detail 文本（`.selection-detail__label`）左缘与之相同，负外边距 + 等量内边距未造成内容位移。
- 无横向溢出：`.structure-diagram` 的 `scrollWidth` 恒等于 `clientWidth`，`overflow-x: auto` 下未出现横向滚动条。
- 目视：`1280x800-light-divider.png` / `800x800-light-divider.png` 显示顶部 1px 横线从左到右贯穿；`1280x800-dark-divider.png` 暗色下横线可见且贯穿。

## 回归（第 5 轮）

| 范围 | 结果 | 证据 |
|---|---|---|
| 前轮 V-1..V-18 | Pass | 见上表；`git diff 536a4bb fcd72ca -- apps/web/src/styles.css` 仅 wrap 一段 hunk，前四轮规则逐字节未变 |
| 拖动 / 键盘 / 持久化逻辑（`PageSplit.tsx`、`paneSplit.ts`） | Pass | `git show fcd72ca --numstat` 未含两文件；`paneSplit.test.ts` 12 用例通过 |
| 窄屏堆叠卡片与 HeapPeek 浮层 | Pass | 窄屏 live `.structure-diagram` `border=1px`、`.main` 留白 9.59px；`fcd72ca` 改动在全局 wrap 上，HeapPeek 不带 `.main-paged`、其 detail 不受影响 |
| 导出路径（`exportStructure`） | Pass | `exportStructure.ts` 未改，仍按 `.selection-detail-wrap` 类名剥离；`exportStructure.test.ts` 12 用例通过 |
| 前轮 `QA-1`（Low，非阻塞） | Pass（保持关闭） | `inWideMedia` / `wideBlock` 断言仍通过；318 用例全绿 |
| 既有全量单测 | Pass | 318/318 通过，无新增失败 |
| 设计 token 约束 | Pass | `designTokens.test.ts` 13 用例通过；未新增圆角字面量 |

## 文档与安全验收（第 5 轮）

| 项 | 结果 | 备注 |
|---|---|---|
| 用户可见文档 | Pass（N/A 成立） | 本轮仅 `.selection-detail-wrap` 的 margin/padding/max-width CSS 细化；`README.md` / `README.zh-CN.md` 未改，前轮 `N/A` 理由继续成立 |
| 运维可执行文档 | Pass（N/A 成立） | 无部署 / 配置 / 依赖变更，无 `package.json` / 锁文件改动 |
| 安全验证范围 | Pass | 变更仅 CSS 声明与测试断言；无凭据/密钥、无认证授权、无输入/出站请求、无依赖变更，未触发 `security.md` §2 任一领域 |

## 缺陷（第 5 轮）

| ID | 严重度 | 摘要 | 状态 | 处理说明 | 验证证据 |
|---|---|---|---|---|---|
| — | — | 本轮无新增缺陷 | — | — | — |
| QA-1 | Low（非阻塞，第 1 轮） | V-3 作用域断言未校验 `@media` 边界 | 已关闭（第 2 轮） | `782eec2` 以 `inWideMedia` / `wideBlock` 实质修复 | 318 用例通过 |
| OBS-1 | Info（非阻塞，第 3 轮） | index 异常路径 `.pane-structure` 内 `var(--space-4)` 间隙透出 body 背景 | 记录（不阻塞） | 既有行为、本分支未触碰 `App.tsx`；范围外 | `git diff main...HEAD -- apps/web/src/App.tsx` 为空 |
| OBS-2 | Info（非阻塞，第 4 轮） | `renderDetail` 渲染的 `.selection-detail__infomask`（bit-strip）仍为圆角框 | 记录（不阻塞） | 属 detail 内容而非 wrapper 卡片；按设计不改 `renderDetail` | 第 4 轮 `*-detail-zoom.png` |
| OBS-3 | Info（非阻塞） | V-19 硬编码 `var(--space-5)`，未与 `.structure-diagram` 的水平 `padding` 建立耦合；若日后调整容器 padding，测试仍绿而横线会重现空隙 | 记录（不阻塞） | Reviewer 第 5 轮非阻塞建议（`review.md:374`）；当前容器 padding 与负边距逐字相等，运行时无缺陷；属未来回归风险 | `designTokens.test.ts:162-165`；`styles.css:652,1011-1012` |

> 除 OBS-3（范围外测试精度项）外无其他缺陷；OBS-3 不构成未解决功能缺陷，不改变本轮 `Pass`。

## 阻塞（第 5 轮）

- 不适用（本轮无阻塞）。

## 结论（第 5 轮）

- 本轮结论: Pass
- 合并: 待用户授权

## 备注（第 5 轮）

- 关键项 V-20 取得宽/窄 × 亮/暗四组 live 直接证据：横线两端距结构面板 padding box 内缘偏差均为 0，detail 文本左缘与结构行左缘偏差为 0，`.structure-diagram` 无横向滚动条；宽屏横线与两侧竖向 gutter 线相接属任务注明的预期行为。
- `fcd72ca` 的 CSS 改动严格限于 `.selection-detail-wrap`，前四轮去卡片 / 全出血 / 单一平面背景 / detail 平铺规则逐字节未变，回归无破坏。
- 新增 `OBS-3`（V-19 测试精度项，非阻塞）；前轮 `OBS-1` / `OBS-2` 保持记录。
- 验收对象 SHA：`fcd72ca2c495b520941aa97d4495f075c41941ee`。

---

# 第 6 轮（回归）：detail 横线接入竖向分割线 `fba35d2`

## 范围与实现版本

- 实现版本 / 提交: `fba35d25dc4bbdfa58f23fcac8a852e1b98ac0cd`（`fix(web): join the detail divider to the split lines`），父提交 `fcd72ca`（第 5 轮已 Pass），基线 `main` @ `c0a938dfd1b7673579076a2e7c60e56dd7e04dbd`。
- 同步核对: `git rev-parse HEAD` = `fba35d2`；`git rev-parse main` = `c0a938d`，与 `main.md` 基线一致；`git merge-base --is-ancestor main HEAD` 成立，`git rev-list --left-right --count main...HEAD` = `0 7`；待验对象即 `fba35d2`，无需 rebase。入口门禁：Review required 且已有 Reviewer 第 6 轮 `Approve`（`review.md:405-488`），审阅版本与待验 HEAD 一致；工作树对 `apps/`、`packages/`、`e2e/` 干净。
- 范围: Plan `V-1..V-23` 全量复验；重点 V-21（宽屏平铺背景 / gutter 透明 / `overflow: visible` / wrap `+5px` CSS 合同）与 V-23（横线与两条竖线相接人工视觉，宽 1280 / 窄 800、亮/暗）；复验 V-1..V-20 不回归；文档与安全。

## 执行命令（第 6 轮）

| 命令 | 输出摘要 / 证据位置 |
|---|---|
| `pnpm --filter web test` | `Test Files 22 passed (22)`、`Tests 319 passed (319)`；`designTokens.test.ts` 14 用例（含 V-21）、`paneSplit.test.ts` 12 用例（V-10 改写）、`exportStructure.test.ts` 12 用例、`chromeToggle.test.ts` 11 用例全通过 |
| `pnpm --filter web typecheck` | `tsc -p tsconfig.json --noEmit`，退出码 0，零错误输出 |
| `pnpm build` | 全 workspace 成功；`apps/web build: ✓ built in 621ms`，`dist/assets/index-BOaWJuWw.css 43.98 kB`、`index-BHt2NEOv.js 327.61 kB`、`index-CRSLwXaL.js 25.46 kB` |
| `git show fba35d2 --numstat` | `designTokens.test.ts` +46、`paneSplit.test.ts` +5/−1、`styles.css` +13/−2；仅此三文件，无越界 |
| `git diff --name-only main...HEAD -- apps packages` | `apps/web/src/StructureMap.tsx`、`designTokens.test.ts`、`paneSplit.test.ts`、`styles.css`；`App.tsx` / `PageSplit.tsx` / `paneSplit.ts` / `exportStructure.ts` 未改 |
| `git diff fcd72ca fba35d2 -- apps/web/src/styles.css` | 仅宽屏媒体块内四段 hunk：`.main-paged .main-split` 加 `background: var(--surface)`；`.main-paged .split-gutter` 移除背景；`.pane-structure` 与 `> .structure-diagram` 改 `overflow: visible`；新增宽屏 `.selection-detail-wrap` `+5px` 覆盖块。去卡片 / 全出血 `padding:0` / 全高 1px 竖线 / hover / focus / 拖动 / detail 平铺 / base wrap 均逐字节未变 |
| `pnpm exec playwright test qa-flat-split6.spec.ts`（QA 临时 live 视觉 harness，用后即删） | `4 passed`；截图见 `/var/folders/yh/gm9s7yzj35l9q90yrd80fy5m0000gn/T/opencode/qa-flat-split6/`：`1280x800-light.png`、`1280x800-dark.png`、`800x800-light.png`、`800x800-dark.png`、各配置 `*-structure.png` / `*-divider.png`；结构化几何与像素证据 `*.json` |

> 视觉 harness 说明：QA 自行编写一次性 Playwright 规格（复用仓库 `playwright.config.ts` + `e2e/helpers`，`globalSetup` 起 live PG 种子库，`webServer` 起 server + `vite preview` 使用本轮 `pnpm build` 产物），选中 heap 页 `blkno=0` 的首个 `.field-cell`（`pd_lsn.xlogid`）使 detail 渲染，执行后已删除该规格、`test-results` 与 `playwright-report`，工作树未留 QA 文件；未改动任何代码/测试。

## 覆盖（对照 Plan 的 `V-n`）

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| V-1 | `.split-gutter::after` 全高 1px 居中竖线，无 `height` / `border-radius` | Pass | 本轮提交未触碰该规则（diff 仅宽屏块四段）；`paneSplit.test.ts` 通过；live 宽屏 `::after` `width=1px`、`afterLeft=5px`（10px gutter 居中）、`transform=matrix(1,0,0,1,-0.5,0)`、`afterBg` 亮 `rgb(197,208,218)` / 暗 `rgb(42,56,69)`（`--border`），gutter 高 699px 全高 |
| V-2 | hover/focus 2px accent 混合，非纯 accent；`:focus-visible` `outline:none` | Pass | 规则未改（`styles.css:585-593`）；单测断言通过。本轮未单独截取 hover，第 1/3 轮 live hover 证据继续适用 |
| V-3 | 宽屏去卡片三属性；base 三选择器仍含 `border: 1px solid` | Pass | 单测通过；去卡片覆盖块（`styles.css:1911-1921`）未改；live 宽屏 `.structure-diagram` `borderLeft/Right=0`、窄屏 `borderLeft/Right=1px`（见 V-23 几何） |
| V-4 | `pnpm --filter web test` 全绿 | Pass | 22 文件 / 319 用例全部通过 |
| V-5 | `pnpm --filter web typecheck` 零错误 | Pass | 退出码 0，无输出 |
| V-6 | `pnpm build` 成功 | Pass | 全 workspace 成功，`apps/web ✓ built in 621ms` |
| V-7 | 人工视觉：宽/窄、亮/暗；拖动两条竖线 | Pass | 本轮未改 gutter / 拖动逻辑（diff 未含 `PageSplit.tsx` / `paneSplit.ts`）；第 4 轮 live 拖动 +80px 证据继续适用；本轮宽/窄、亮/暗四组 live 截图 |
| V-8 | 宽屏 `.main-paged` `padding:0`；base `.main` `var(--space-6)` | Pass | 单测通过；live 宽屏 `.structure-diagram` 左缘 x=230（`.pane-tree` 220 + gutter 10）、`.main` padding 0；窄屏 `.structure-diagram` x=9.59（=`var(--space-6)` 留白） |
| V-9 | 全出血：宽屏三区/竖线贴视口左/右/底缘、顶接 chrome；窄屏留白与卡片不变 | Pass | live 宽屏 `.main-split` x=0..1280、`y=101`（=chrome 底）、`bottom=800`（=视口高）；窄屏 `.structure-diagram` x=9.59、有 1px 边框 |
| V-10 | 宽屏 gutter 与三区背景均为 `var(--surface)`（第五次细化后由 `.main-split` 承载、gutter 透明）；base 背景不变 | Pass | 改写后的 V-10 单测通过；live 宽屏 `mainSplitBg` 亮 `rgb(247,250,252)` / 暗 `rgb(20,28,36)`（=`--surface`），gutter `rgba(0,0,0,0)`；窄屏 `mainSplitBg` 透明、gutter `display:none` |
| V-11 | 人工视觉（无阴影带）：宽屏两竖线两侧与三区同色；窄屏 gutter 隐藏 | Pass | 见下「V-23 像素证据」：宽屏亮/暗除 1px 线体（含抗锯齿）外整行 `--surface`，无暗带；窄屏 gutter `display:none` |
| V-12 | 源码扫描：`StructureMap.tsx` 无 `selection-detail__title`、保留 id/类；`App.tsx` 含 `aria-controls` | Pass | `designTokens.test.ts` V-12 通过；`fba35d2` 未改 `StructureMap.tsx`；live 四组 `titleCount=0` |
| V-13 | `.selection-detail-wrap` 顶部横线 + 内边距，无 `gap` / 横向 flex；`.selection-detail` 覆盖 `.panel` | Pass | `designTokens.test.ts` V-13 通过；`fba35d2` 未改 `.selection-detail` |
| V-14 | R-2 改写为新合同；`exportStructure.test.ts` fixture 继续通过 | Pass | `designTokens.test.ts` 14 用例、`exportStructure.test.ts` 12 用例通过 |
| V-15 | `pnpm --filter web test` | Pass | 319/319 |
| V-16 | `pnpm --filter web typecheck` | Pass | 退出码 0 |
| V-17 | `pnpm build` | Pass | 全 workspace 成功 |
| V-18 | 人工视觉（detail 平铺）：无 `detail` 标签、无圆角卡片、单条 `var(--border)` 横线、`Detail` 可折叠 | Pass | live 四组 `titleCount=0`、`.selection-detail` 无边框/圆角/背景（V-13 合同）；`.selection-detail-wrap` 顶部横线存在；`fba35d2` 未改平铺 / 折叠；第 4 轮四组 live 折叠证据继续适用 |
| V-19 | CSS 合同：base wrap `margin-left/right: calc(-1 * var(--space-5))`、`padding-left/right: var(--space-5)`、`max-width: none` | Pass | `styles.css:1009-1019` 逐条核对未变；`designTokens.test.ts` V-19 用例通过 |
| V-20 | 人工视觉（横线两端无空隙）：横线贴结构面板 padding box 内缘，内容对齐，无横滚 | Pass | 第 5 轮结论在宽屏被 V-21 覆盖延伸至 gutter 中线；窄屏四组 live 几何：wrap 左/右距 `.structure-diagram` 边框各 1px（贴 padding box 内缘）、detail 左缘与 `.structure-flow` 左缘偏差 0、`structureDiagram.scrollWidth==clientWidth`（779/779）、无横滚（见 V-23 几何） |
| V-21 | CSS 合同（横线接入竖线，宽屏）：`.main-paged .main-split` 含 `background: var(--surface)`；`.main-paged .split-gutter` 不含背景；`.main-paged .pane-structure` 与 `> .structure-diagram` 含 `overflow: visible`；`.main-paged .selection-detail-wrap` 含 `calc(-1 * (var(--space-5) + 5px))` / `calc(var(--space-5) + 5px)` / `max-width: none`；base 不变 | Pass | `designTokens.test.ts:193-219` V-21 用例通过；`styles.css` 逐条核对：`:1837-1844` `.main-split` `background: var(--surface)`、`:1846-1848` `.split-gutter` 仅 `display:block`（无背景）、`:1859-1867` 两 `overflow: visible`、`:1881-1887` wrap `calc(-1 * (var(--space-5) + 5px))` / `calc(var(--space-5) + 5px)` / `max-width:none`；base wrap（`:1009-1019`）仍 `var(--space-5)`；live 计算样式一致（见 V-23） |
| V-22 | `pnpm --filter web test`、typecheck、`pnpm build` | Pass | 319/319；typecheck 退出码 0；build 成功 |
| V-23 | 人工视觉（横线与竖线相接）：宽屏横线穿过 10px gutter、与两条竖线相接无空隙、gutter 两侧无暗带、无新增滚动条、内容对齐；窄屏横线内缩于卡片内；亮/暗 | Pass | 四组 live 几何 + 像素证据（见下「V-23 几何证据」「V-23 像素证据」）；截图 `1280x800-light.png` / `1280x800-dark.png` / `800x800-light.png` / `800x800-dark.png` 及 `*-structure.png` 目视确认 |

### V-23 几何证据（关键项）

> 单位 px。`gap L/R` = `.selection-detail-wrap` border box 左/右缘与第一条/第二条 gutter 中线（`gutter.x + width/2`）的偏差。宽屏 gutter 中线即竖线中心。

| 配置 | gutter0 中线 | gutter1 中线 | wrap left | wrap right | gap L | gap R | flow.left | label.left | contentAligned | 页面横滚 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1280×800 light | 225 | 755 | 225 | 755 | 0 | 0 | 238 | 238 | 0 | 无 |
| 1280×800 dark | 225 | 755 | 225 | 755 | 0 | 0 | 238 | 238 | 0 | 无 |
| 800×800 light | gutter `display:none` | — | 10.59 | 789.41 | — | — | 18.59 | 18.59 | 0 | 无 |
| 800×800 dark | gutter `display:none` | — | 10.59 | 789.41 | — | — | 18.59 | 18.59 | 0 | 无 |

- **宽屏（1280）**：两条 gutter 为 `220..230` / `750..760`，中线 `225` / `755`；wrap border box `225..755`，与两线中心**逐像素重合，gap 均为 0**，即横线两端精确抵达两条竖向分割线、无空隙。wrap 宽 530 = 5（伸入左 gutter）+ 520（结构面板）+ 5（伸入右 gutter），与 `+5px = GUTTER_PX/2` 设计一致。`.pane-structure` 与 `.structure-diagram` `overflow=visible`，`.main-split` 背景为不透明 `--surface`，gutter 背景 `rgba(0,0,0,0)`。
- **内容对齐**：wrap 内容框（`padding-left = var(--space-5)+5px`）把 detail 推回原位，`detailLabel.left == structureFlow.left`（238==238，偏差 0），负边距 + 等量内边距未造成内容位移。
- **无新增滚动条**：宽屏 `documentElement` / `body` / `.main-split` 均 `scrollWidth==clientWidth==1280`；`.structure-diagram` `overflow: visible`（无滚动条，`scrollWidth 525` 的 5px 溢出为绘制到 gutter、被 `.main-paged overflow:hidden` 兜底，非滚动）；`.structure-flow` 仍 `overflow:auto`（720/504），内部独立滚动保留。
- **窄屏（800）**：gutter `display:none`；`.structure-diagram` `overflow-x: auto`、`border 1px`；wrap border box `10.59..789.41`，即 `.structure-diagram` padding box 内缘（距外边框各 1px），横线**内缩于卡片内、不延伸到卡片外**，与 base 行为一致；`scrollWidth==clientWidth`（779/779）无横滚。

### V-23 像素证据（关键项）

> 沿第一条 gutter 垂直中部（y=451）水平采样 x∈[212,238]（gutter 为 220..230，线中心 225）。

| 主题 | 线体像素（x=224,225） | 其余像素 | 结论 |
|---|---|---|---|
| light | `rgb(222,229,235)`（1px `--border` 抗锯齿） | 全部 `rgb(247,250,252)` = `--surface` | 线两侧无暗色渐变带 |
| dark | `rgb(31,42,52)`（1px `--border`） | 全部 `rgb(20,28,36)` = `--surface` | 线两侧无暗色渐变带 |

- 平铺背景由 `.main-paged .main-split`（不透明 `--surface`）承载、gutter 透明，透出的是 `--surface` 而非 body `--bg` + 径向渐变；旧「阴影」带不再出现。
- 目视 `1280x800-light.png` / `1280x800-dark.png`：detail 顶部 1px 横线贯穿结构面板并延伸入两侧 gutter、与两条竖线相接；`*-structure.png` 显示横线在结构面板两端无空隙；`800x800-*-divider.png` 显示窄屏横线在卡片内满宽。

## 回归（第 6 轮）

| 范围 | 结果 | 证据 |
|---|---|---|
| 前轮 V-1..V-20 | Pass | 见上表；`git diff fcd72ca fba35d2 -- apps/web/src/styles.css` 仅宽屏块四段 hunk，前五轮规则（去卡片 / 全出血 / 单一平面 / detail 平铺 / 横线全宽）逐字节未变 |
| 拖动 / 键盘 / 持久化逻辑（`PageSplit.tsx`、`paneSplit.ts`） | Pass | `git show fba35d2 --numstat` 未含两文件；`paneSplit.test.ts` 12 用例通过；`GUTTER_PX=10`、`pageSplitTemplate` 未改 |
| 窄屏堆叠卡片与 HeapPeek 浮层 | Pass | 窄屏 live gutter `display:none`、`.structure-diagram` `border=1px` / `overflow-x:auto`、`.main` 留白 9.59px；本轮改动均在 `@media (min-width:960px)` 的 `.main-paged` 内，HeapPeek 不带 `.main-paged` 不受影响 |
| 导出路径（`exportStructure`） | Pass | `exportStructure.ts` 未改，仍按 `.selection-detail-wrap` 类名剥离；`exportStructure.test.ts` 12 用例通过 |
| 前轮 `QA-1`（Low，非阻塞） | Pass（保持关闭） | `inWideMedia` / `wideBlock` 断言仍通过；319 用例全绿 |
| 既有全量单测 | Pass | 319/319 通过，无新增失败 |
| 设计 token 约束 | Pass | `designTokens.test.ts` 14 用例通过；未新增圆角字面量（`border-radius: 0` 为结构零） |

## 文档与安全验收（第 6 轮）

| 项 | 结果 | 备注 |
|---|---|---|
| 用户可见文档 | Pass（N/A 成立） | 本轮仅宽屏 CSS 覆盖与合同断言；`README.md` / `README.zh-CN.md` 未改，前轮 `N/A` 理由继续成立 |
| 运维可执行文档 | Pass（N/A 成立） | 无部署 / 配置 / 依赖变更，无 `package.json` / 锁文件改动 |
| 安全验证范围 | Pass | 变更仅 CSS 声明与测试断言；无凭据/密钥、无认证授权、无输入/出站请求、无依赖变更，未触发 `security.md` §2 任一领域 |

## 缺陷（第 6 轮）

| ID | 严重度 | 摘要 | 状态 | 处理说明 | 验证证据 |
|---|---|---|---|---|---|
| — | — | 本轮无新增缺陷 | — | — | — |
| QA-1 | Low（非阻塞，第 1 轮） | V-3 作用域断言未校验 `@media` 边界 | 已关闭（第 2 轮） | `782eec2` 以 `inWideMedia` / `wideBlock` 实质修复 | 319 用例通过 |
| OBS-1 | Info（非阻塞，第 3 轮） | index 异常路径 `.pane-structure` 内 `var(--space-4)` 间隙透出 body 背景 | 记录（不阻塞） | 既有行为、本分支未触碰 `App.tsx`；范围外 | `git diff main...HEAD -- apps/web/src/App.tsx` 为空 |
| OBS-2 | Info（非阻塞，第 4 轮） | `renderDetail` 渲染的 `.selection-detail__infomask` 仍为圆角框 | 记录（不阻塞） | 属 detail 内容而非 wrapper 卡片；按设计不改 | 第 4 轮 `*-detail-zoom.png` |
| OBS-3 | Info（非阻塞，第 5 轮） | V-19 硬编码 `var(--space-5)`，未与容器 padding 耦合 | 记录（不阻塞） | 当前逐字相等，运行时无缺陷；属未来回归风险 | `designTokens.test.ts:177-191` |
| OBS-4 | Info（非阻塞） | V-21 的 `5px` 亦为硬编码，未与 `GUTTER_PX` 建立耦合；Reviewer 第 6 轮非阻塞建议（`review.md:461`）。若 `GUTTER_PX` 变更，实现与测试会同时漂移 | 记录（不阻塞） | 当前 `GUTTER_PX=10`、`5px` 正确，运行时 gap=0；属未来回归风险，非本轮缺陷 | `styles.css:1882-1885`；`designTokens.test.ts:208-211` |
| OBS-5 | Info（非阻塞） | 本轮未现场验证折叠态（tree / hex 收起）时单条 gutter 下 wrap 未接线一端的观感（Reviewer 第 6 轮非阻塞建议，`review.md:463`） | 记录（不阻塞） | 该端外扩 5px 至视口边缘并被 `.main-paged overflow:hidden` 裁剪，属全出血预期；非 V-23 验收项，未构成关键证据缺口 | 结构分析（`styles.css:1831-1832`、`:1881-1887`） |

> 除上述非阻塞项外无缺陷；OBS-4 / OBS-5 为测试精度与折叠态观感的补充项，不改变本轮 `Pass`。

## 阻塞（第 6 轮）

- 不适用（本轮无阻塞）。

## 结论（第 6 轮）

- 本轮结论: Pass
- 合并: 待用户授权

## 备注（第 6 轮）

- 关键项 V-23 取得宽/窄 × 亮/暗四组 live 直接证据：宽屏 wrap border box `225..755` 与两条 gutter 中线（225/755）**gap 均为 0**，横线精确接入两条竖向分割线；detail 左缘与结构行左缘偏差 0；页面/`.main-split`/`.structure-diagram` 无新增横向滚动条，`.structure-flow` 内部滚动保留；像素采样确认线两侧除 1px 线体外均为 `--surface`、无 body 渐变暗带；窄屏横线仍内缩于卡片内（距外边框 1px）。
- `fba35d2` 的 CSS 改动严格限于宽屏媒体块四段，前五轮去卡片 / 全出血 / 单一平面背景 / detail 平铺 / 横线全宽规则逐字节未变，回归无破坏。
- 新增 `OBS-4`（V-21 `5px` 硬编码，非阻塞）与 `OBS-5`（折叠态观感未现场验证，非阻塞）；前轮 `OBS-1` / `OBS-2` / `OBS-3` 保持记录。
- 验收对象 SHA：`fba35d25dc4bbdfa58f23fcac8a852e1b98ac0cd`。

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
  - 人工视觉：`pnpm --filter web dev`，宽屏（≥1280px）与窄屏（<960px）、亮/暗主题，拖动两条竖线
- 预期证据:
  - `pnpm --filter web test` 全部通过，含改写后的 `paneSplit.test.ts` 新用例名与断言
  - `pnpm --filter web typecheck` 零错误输出
  - `pnpm build` 成功日志摘要
  - 宽屏截图中三区无边框/圆角/投影、仅两条全高竖线；窄屏截图仍为卡片；拖动前后宽度变化

## 目标摘要

- 宽屏 Page 布局（`@media (min-width: 960px)` 且 `.main-paged`）下，Tree / Structure / Hex 三区去掉边框、圆角、投影，仅保留各自背景，由两条可拖动的全高 1px 竖线分隔。
- 分割线命中区保持 10px，`GUTTER_PX` 与 `pageSplitTemplate` 不变，拖动 / 键盘 / 持久化行为不变。
- 窄屏（<960px）堆叠布局与 HeapPeek 浮层保持现有卡片外观。
- 改写 `paneSplit.test.ts` 中旧药丸把手合同为新竖线合同，并加「宽屏去卡片、base 保留卡片」的作用域断言。

## 任务拆解

1. **CSS：宽屏去卡片化**（完成条件：`@media (min-width: 960px)` 内新增/扩展 `.main-paged .pane-tree`、`.main-paged .pane-structure > .structure-diagram`、`.main-paged .pane-hex > .hex`，统一 `border: 0; border-radius: 0; box-shadow: none;`；base 规则与窄屏外观不变）
2. **CSS：分割线改为细竖线**（完成条件：`.split-gutter::after` 为 `left:50%; top:0; bottom:0; width:1px; transform:translateX(-50%); background: var(--border)`，移除 `2.5rem` 高度 / 药丸圆角 / muted 半透明；`:hover`/`:focus-visible` 为 `width:2px` + `color-mix(in srgb, var(--accent) 55%, var(--border))`；新增 `.split-gutter:focus-visible { outline: none; }` 与 `html.is-split-dragging .split-gutter::after { width:2px; background: var(--accent); }`）
3. **测试改写**（完成条件：`apps/web/src/paneSplit.test.ts` 的 `"split gutter grip (gutter-grip V-1 / V-2)"` 改为新线体合同，并新增宽屏作用域断言；不改 `pageSplitTemplate` / `dragTree` / `dragHex` 等既有逻辑用例）
4. **README 核查**（完成条件：确认 `README.md` / `README.zh-CN.md` 是否描述三区卡片外观或分割线；无则文档影响标 `N/A` 并写明理由，有则同步）
5. **回归自验**（完成条件：`pnpm --filter web test`、`pnpm --filter web typecheck`、`pnpm build` 全通过；记录到 `dev-notes.md`；人工视觉按 V-7 执行）

## 依赖与顺序

1. 任务 1 与 2 同属 `styles.css`，可一并完成；任务 3 依赖 1、2 的最终选择器与声明字符串。
2. 任务 4 独立，可与 1–3 并行。
3. 任务 5 在 1–4 完成后执行。
4. 依赖 `ui-design.md` 的精确规格；不得偏离。

## 触碰路径

- `apps/web/src/styles.css`（改：新增宽屏覆盖块；改 `.split-gutter::after` 及 hover/focus；新增 focus-visible / dragging 规则）
- `apps/web/src/paneSplit.test.ts`（改：改写 gutter describe，新增作用域断言）
- `README.md`、`README.zh-CN.md`（仅当任务 4 核查发现描述卡片/分割行为时；否则不动）
- 不改：`apps/web/src/PageSplit.tsx`、`apps/web/src/paneSplit.ts`（行为与限位不变）、`apps/web/src/designTokens.test.ts`、任何 `.tsx` 组件逻辑。

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

## 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 真实浏览器拖动 / 实际观感 | 仓库 e2e 需 live PostgreSQL（`playwright.config.ts` 的 `globalSetup` 起服务与种子库），当前环境不保证可用 | 纯 CSS 变更，风险限于视觉与拖动观感；拖动逻辑未改，功能回归风险低 | 有 live PG 时补跑：`pnpm test:e2e`，或按 `ui-design.md` 在宽（1280）与窄（800）视口截图并模拟 pointer 拖动 `Resize tree pane` / `Resize hex pane` 两个 button，比对线体宽度与列宽变化 |
| 拖动中的 `--accent` 活动线色 | 静态单测只能断言声明存在，无法断言运行时视觉 | 低 | 人工拖动时核对（V-7）或 Playwright 拖动中截图 |

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | N/A：无架构 / 接口 / 构建变更；`ui-design.md` 已固化视觉合同 |
| 用户文档 | 任务 4 核查 `README.md` / `README.zh-CN.md`；现有 README 未描述三区卡片外观或分割线行为（仅描述 Tree 面板功能与快捷键），预期 `N/A` 并写明理由；若核查发现描述则同步一句 |
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

# 工作项: flat-split-dividers

描述: Page 宽屏三栏（Tree | Structure | Hex）去掉圆角矩形卡片外观，改为平铺三区、以两条可拖动的竖向分割线分隔，整体更简洁。
目标分支: main
源分支: flat-split-dividers
基线提交: c0a938dfd1b7673579076a2e7c60e56dd7e04dbd
文档影响: README.md、README.zh-CN.md（若描述 Tree 面板/分割行为则同步；否则 N/A）

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| standard | skipped | not-required | skipped | required |

> Spec 门禁 skipped：纯视觉/布局调整，不新增行为、公开接口、状态转换、错误约定；拖动分隔线的交互已存在（`PageSplit` + `paneSplit.ts`），本项只改外观。Design 门禁 skipped：无模块边界 / 分层 / 技术选型决策。另出 ui-design.md 固化三区平铺与分割线视觉。

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| done | 已合入，结束 | | | |

## 进度笔记

- 2026-09-13 登记。用户诉求：下方三个区域去掉圆角矩形模块化，用两条可拖动竖线分割，更简洁。现状：宽屏 `.main-paged` 下 Tree（`.pane-tree`）、Structure（`.structure-diagram`）、Hex（`.hex`）各自为带边框+圆角+背景的卡片；两条 `.split-gutter`（10px 命中区）已可拖动，但视觉是居中的短药丸把手（`::after`）。范围：宽屏三栏平铺 + 分割线改细竖线；`paneSplit.test.ts` 的 gutter-grip 断言需按新合同改写。Spec/Design 门禁 skipped。
- 2026-09-13 Planner 完成 `ui-design.md` 与 `plan.md`：宽屏 `.main-paged` 作用域下三区去 `border`/`border-radius`/`box-shadow`，保留区域背景；`.split-gutter::after` 改全高 1px 竖线（`var(--border)`），hover/focus 2px accent 混合，拖动 2px 纯 accent；`GUTTER_PX`/拖动/键盘/持久化不变；窄屏与 HeapPeek 保持卡片。改写 `paneSplit.test.ts` 并加宽屏作用域断言。第一阶段文档提交后进入 developing。
- 2026-09-13 Developer 完成实现并提交 `b1d679f`，313 passed、typecheck、build 全绿；同步 no-op。
- 2026-09-13 Reviewer 结论 `Approve`（无非阻塞以外的阻塞项；非阻塞：作用域断言未校验 `@media` 边界、V-7 视觉待 QA）。
- 2026-09-13 QA 结论 `Pass`，V-1..V-7 全过；V-7 为 Playwright + 真 PG 直接证据（宽 1280 / 窄 800，亮/暗，拖动 tree +80px、hex +60px，拖动中线体 2px 纯 accent）。QA-1（Low，非阻塞）：作用域断言未锁定 `@media` 包裹，当前实现正确、无功能缺陷，仅记为未来回归风险。进入 merge-approval，等待用户授权。
- 2026-09-13 用户合并前追加反馈（附参考截图）：三栏应参考该布局**边缘不留白**，即宽屏下三区全出血、贴到视口边缘。范围细化（§3.1 回退到 planning）：宽屏 `.main-paged` 去掉 `.main` 的外边距（`padding: var(--space-6)` → `0`），三区背景与分割线延伸至边缘；窄屏保持现状。ui-design / plan 需补该条并加验证项，随后重走 Developer → Review → QA。
- 2026-09-13 Planner 补「全出血」节与任务 3、V-8/V-9。
- 2026-09-13 Developer 提交 `782eec2`：宽屏 `.main-paged` 加 `padding: 0`，并补 V-8 契约 + 媒体查询边界断言（关闭 QA-1）。314 passed、typecheck、build 全绿。
- 2026-09-13 Reviewer 复评 `Approve`（QA-1 关闭，无非阻塞项）。
- 2026-09-13 QA 复验 `Pass`，V-1..V-9 全过；V-9 为 Playwright + 真 PG 直接证据（宽 1280 / 窄 800，亮/暗）：宽屏三区左缘≈0、右缘≈1280、底缘≈800、顶接 chrome，区域 padding >0；窄屏保留留白与卡片。进入 merge-approval，等待用户授权。
- 2026-09-13 用户再次追加反馈（合并前）：分割竖线旁仍有「阴影」。诊断（用真实 `styles.css` 静态复刻 + Playwright 计算样式）：`.split-gutter` 背景透明（`rgba(0,0,0,0)`），10px 命中区透出 body 的 `--bg` + 径向渐变（比三区 `--surface`/`--diagram-bg` 更暗且带色），在 1px 线两侧形成暗色渐变带，观感即阴影；各元素 `box-shadow` 均为 `none`，非投影。细化（§3.1 回退 `merge-approval → planning`）：宽屏下把 gutter 与三区统一到同一平面背景 `var(--surface)`（gutter 设不透明背景，三区背景统一），只留 1px 竖线；窄屏不变。重走 Developer → Review → QA。
- 2026-09-13 Planner 补「单一平面背景」节与任务 4、V-10/V-11。
- 2026-09-13 Developer 提交 `89aec7c`：宽屏 `.main-paged .split-gutter` 与三区背景统一为 `var(--surface)`，补 V-10 契约断言。315 passed、typecheck、build 全绿。
- 2026-09-13 Reviewer 复评 `Approve`（V-10 在旧状态可复现失败）。
- 2026-09-13 QA 复验 `Pass`，V-1..V-11 全过；V-11 像素采样：宽屏亮/暗除 1px 线（含抗锯齿）外整行同色，无暗色带；暗色下 hex 文本/网格线对比正常。OBS-1（Info，非阻塞）：index 异常路径 `.pane-structure` 内 `var(--space-4)` 间隙透出 body 背景，属既有、范围外。进入 merge-approval，等待用户授权。
- 2026-09-13 用户第三次追加反馈（合并前）：继续优化底部 detail 区——去掉「detail」文字标签、取消圆角矩形卡片、直接嵌入结构图下方、用一条横线分割。细化（§3.1 回退 `merge-approval → planning`，并入本工作项，因依赖未合入的平铺布局）：`StructureMap.tsx` 删除 `.selection-detail__title`；`.selection-detail-wrap` 改为单列 + `border-top` 横线 + `padding-top`；`.selection-detail` 覆盖 `.panel` 的 border/radius/background/padding/max-width 使其平铺；同步更新 `designTokens.test.ts` 的 R-2 耦合断言。重走 Developer → Review → QA。
- 2026-09-13 Planner 补「结构图底部 detail 平铺」节与任务 7、V-12..V-18。
- 2026-09-13 Developer 提交 `536a4bb`：删标题、平铺 detail、加顶部横线，补 V-12/V-13/V-14。317 passed、typecheck、build 全绿。
- 2026-09-13 Reviewer 复评 `Approve`（V-12/V-13 旧状态可复现失败）。
- 2026-09-13 QA 复验 `Pass`，V-1..V-18 全过；V-18 为 Playwright + 真 PG 直接证据（宽/窄、亮/暗）：无「detail」标签、无卡片、单条 1px 横线分割、Detail 开关正常折叠、`#selection-detail-panel` 受控保留。OBS-2（Info，非阻塞）：`renderDetail` 内部 infomask 仍为带框块，属 detail 内容、按设计不改。进入 merge-approval，等待用户授权。
- 2026-09-13 用户第四次追加反馈（合并前，附截图）：detail 最上方的分割线两端留有空隙，要求延长到两端贴边。细化（§3.1 回退 `merge-approval → planning`）：`.selection-detail-wrap` 位于带水平 padding 的 `.structure-diagram` 内，横线只跨内容宽度；用等量负水平外边距抵消 `.structure-diagram` 的水平 padding，并加回等量水平内边距保持内容对齐，使 `border-top` 延伸至结构面板两端。重走 Developer → Review → QA。
- 2026-09-13 Planner 补「底部横线全宽」小节与 V-19/V-20。
- 2026-09-13 Developer 提交 `fcd72ca`：`.selection-detail-wrap` 加负水平外边距 + 等量内边距 + `max-width: none`，补 V-19。318 passed、typecheck、build 全绿。
- 2026-09-13 Reviewer 复评 `Approve`（V-19 旧状态可复现失败）。
- 2026-09-13 QA 复验 `Pass`，V-1..V-20 全过；V-20 为 Playwright + 真 PG 直接证据（宽/窄、亮/暗）：横线两端贴 padding box 内缘（lineTouches 0/0）、detail 文本左缘与结构行对齐（偏差 0）、无横向滚动。OBS-3（Info，非阻塞）：V-19 硬编码 `var(--space-5)` 未与 `.structure-diagram` padding 耦合。进入 merge-approval，等待用户授权。
- 2026-09-13 用户第五次追加反馈（合并前，附放大截图）：横线左端与竖向分割线之间仍有空隙。诊断：竖向线在 10px gutter 中居中（`GUTTER_PX/2 = 5px`），横线只到结构面板边缘（230），距竖线（225）5px。静态复刻验证可行方案：把平铺背景移到 `.main-paged .main-split`（gutter 恢复透明、不再有暗带），宽屏 `.main-paged .pane-structure` 与其 `> .structure-diagram` 设 `overflow: visible`，`.selection-detail-wrap` 的水平负边距/内边距各再加 `5px`（`calc(-1*(var(--space-5) + 5px))` / `calc(var(--space-5) + 5px)`），使横线延伸到 gutter 中线（225..755）与两条竖线相接，内容仍与结构行对齐（复刻实测 diff=0）。细化（§3.1 回退 `merge-approval → planning`）。重走 Developer → Review → QA。
- 2026-09-13 Planner 补「横线接入竖向分割线」小节与任务 8、V-21/V-22/V-23，并改写 V-10 以反映平面背景移到 `.main-split`。
- 2026-09-13 Developer 提交 `fba35d2`：宽屏 `.main-paged .main-split` 承载 `--surface`、gutter 恢复透明，`.pane-structure` 与 `> .structure-diagram` `overflow: visible`，新增宽屏 `.selection-detail-wrap` 覆盖（+5px 接入竖线）。319 passed、typecheck、build 全绿。
- 2026-09-13 Reviewer 复评 `Approve`（V-21/V-10 旧状态可复现失败；复刻实测 wrap 边界 == 两条竖线中线，gap 0）。
- 2026-09-13 QA 复验 `Pass`，V-1..V-23 全过；V-23 为 Playwright + 真 PG 直接证据（宽/窄、亮/暗）：宽屏 wrap 边界 225..755 == 竖线中线，gap L/R = 0；像素带仅竖线处有色、其余同 `--surface`，无阴影带；detail 文本左缘与结构行对齐（238==238）；无横向滚动；窄屏保持卡片内缩。OBS-4/5（Info，非阻塞）。进入 merge-approval，等待用户授权。
- 2026-09-13 用户授权合并。置 `done`，第三阶段文档提交后 rebase + fast-forward 合入 `main`，清理源分支。结束（不归档）。

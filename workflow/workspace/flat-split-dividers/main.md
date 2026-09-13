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
| developing | Developer 实施与自验 | | | |

## 进度笔记

- 2026-09-13 登记。用户诉求：下方三个区域去掉圆角矩形模块化，用两条可拖动竖线分割，更简洁。现状：宽屏 `.main-paged` 下 Tree（`.pane-tree`）、Structure（`.structure-diagram`）、Hex（`.hex`）各自为带边框+圆角+背景的卡片；两条 `.split-gutter`（10px 命中区）已可拖动，但视觉是居中的短药丸把手（`::after`）。范围：宽屏三栏平铺 + 分割线改细竖线；`paneSplit.test.ts` 的 gutter-grip 断言需按新合同改写。Spec/Design 门禁 skipped。
- 2026-09-13 Planner 完成 `ui-design.md` 与 `plan.md`：宽屏 `.main-paged` 作用域下三区去 `border`/`border-radius`/`box-shadow`，保留区域背景；`.split-gutter::after` 改全高 1px 竖线（`var(--border)`），hover/focus 2px accent 混合，拖动 2px 纯 accent；`GUTTER_PX`/拖动/键盘/持久化不变；窄屏与 HeapPeek 保持卡片。改写 `paneSplit.test.ts` 并加宽屏作用域断言。第一阶段文档提交后进入 developing。

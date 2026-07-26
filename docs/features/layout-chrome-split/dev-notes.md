# Developer Notes: layout-chrome-split

## 结论

- 工作分支：`layout-chrome-split`（基于 `main` `6bed602`）。
- **T1–T8**、**T9–T14**、**T15–T16**（第四轮）均已完成。
- 最低验证层 L2 通过；第四轮定向手测（Chrome headless + 实库）通过。
- Review 门禁 `required`；本记录不是 QA 结论。

## 完成度与变更

### 首轮 T1–T8 / 第三轮 T9–T14（既有）

见历史提交与下文「第三轮验证摘要」。壳层主带/次带、Collapse 唯一入口、连接徽标 hover、960 分栏已落地。

### 第四轮 T15–T16

| 任务 | 结果 | 变更或证据 |
|---|---|---|
| T15 去 Hex 标签 + 折叠 pane 退出 | 完成 | 展开无 `.pane-head`/`HEX`；`hexCollapsed` 时不渲染 `.pane-hex`；Grid 单栏结构图占满；主带 Collapse/Show 唯一入口 |
| T16 回归验证与交接 | 完成 | L2 + 手测三态证据；page-core/server 零 diff |

变更路径（本轮）：

- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `docs/features/layout-chrome-split/{design,ui-design,plan,dev-notes}.md`（Planner 第四轮修订随分支入库）

未改 `packages/page-core/**`、`apps/server/**`、API；未新增依赖；未提交 `.env` / `docs/manager/**`。

## TDD / 替代验证

仓库无 web DOM 自动化测试依赖，壳层条件渲染无法仓内单测先行。风险：布局回归依赖手测。本轮替代：Chrome headless（puppeteer-core @ `/tmp`，未改仓库依赖）对 Vite + PostgreSQL 16 跑第四轮清单 → 最小实现 → L2。

自动化恢复条件：引入 Vitest + DOM/浏览器驱动后，固化「展开无 Hex 标签 / 折叠无 pane / Show hex 恢复分栏」。

## 验证证据

### L1 定向手测（第四轮清单）

Chrome headless @ `localhost:5173`，实库 `public.qa_cross` blk 0；截图 `/tmp/layout-t15-evidence/{01-expanded,02-collapsed,03-restored,04-narrow-restored}.png`。

| # | 检查 | 结果 |
|---|---|---|
| 1 | 展开无 `HEX`/`Hex` 标签；≥960 左右分栏 | Pass（无 `.pane-head`；列 `772px 632px`） |
| 2 | 折叠无 `Hex collapsed`、无 hex pane/右列；结构图占满 | Pass（无 `.pane-hex`；单列 `1416px`；ratio≈0.98） |
| 3 | Show hex 恢复；≥960 左右；&lt;960 上下；主带唯一入口 | Pass（仅 `.chrome-collapse`） |
| 4 | 结构→hex 高亮/locate；Theme 可切换 | Pass（hl=4、locate-flash；Theme dark↔light） |

汇总：**23/23** 主清单断言 + 高亮抽检 Pass。

### L2

| 命令 | 结果 |
|---|---|
| `pnpm test` | Pass：page-core 31/31，server 4/4 |
| `pnpm typecheck` | Pass：page-core、server、web |
| `pnpm --filter web build` | Pass：Vite 40 modules |

### L3

| 验证 | 结果 |
|---|---|
| 本轮 `test:integration` | 未重跑（第四轮仅 UI 条件渲染；实库手测已覆盖 Load） |
| 实库浏览器手测 | 见上表 |

### 第三轮验证摘要（未回归重跑全量）

此前 T9–T14：L1 24/24、L2 Pass、`pnpm test:integration` Pass。本轮抽检主带 Collapse/Theme、分栏与联动未回退。

## 文档与安全

- 用户文档 N/A（仅去装饰标签/折叠占位；主带操作流程不变）。
- 运维文档 N/A。
- 安全：无新依赖；密码仍不进 chrome/浮层/文档/提交。

## 已知缺口与建议复测

- 0-block / disconnected 路径未本轮重测。风险：低。恢复：准备对应表/断连后复测。
- P1-1 拖拽分隔 N/A。
- Reviewer 重点：展开无 Hex 标签；折叠 DOM 无 `.pane-hex` 且宽屏单栏全宽；Show hex 恢复 55/45；主带唯一切换入口。

# Developer Notes: layout-chrome-split

## 结论

- 工作分支：`layout-chrome-split`（基于 `main` `6bed602`）。
- **T1–T8**（首轮）与 **T9–T14**（第三轮增量）均已完成。
- 最低验证层 L2 通过；定向手测（Chrome headless + 实库）通过；L3 集成冒烟通过。
- Review 门禁 `required`；本记录不是 QA 结论。

## 完成度与变更

### 首轮 T1–T8（既有）

| 任务 | 结果 |
|---|---|
| T1–T8 | 完成：侧栏移除、顶栏主控初版、次带元信息、960 分栏、联动/键盘、README |

### 第三轮 T9–T14

| 任务 | 结果 | 变更或证据 |
|---|---|---|
| T9 主带顺序 + Collapse 迁入 | 完成 | 主带 DOM/视觉：标题 → connected → Collapse hex（仅 `page_loaded`）→ Theme；表控不在主带 |
| T10 hex 面板去 Collapse | 完成 | `.pane-hex .pane-head` 仅保留 `Hex` 标签；折叠/展开仅主带 |
| T11 次带表控 + 统计空态 | 完成 | 次带：select / blkno / Load / Refresh；统计仅 `page_loaded` 渲染；禁 —/N/A 占位 |
| T12 连接详情进徽标 | 完成 | 次带无常驻连接串/PG；徽标 hover + `:focus-visible` 浮层 + `title`；无密码 |
| T13 分栏/联动不回退 | 完成 | ≥960 左右 55/45；&lt;960 上下；双向高亮 + locate 仍可用 |
| T14 验证与文档 | 完成 | L2 + 手测写入本文件；README 对齐第三轮 IA；page-core/server 零 diff |

变更路径（本轮）：

- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `README.md`
- `docs/features/layout-chrome-split/{spec,design,ui-design,plan,dev-notes}.md`（Planner/Analyst 修订可随分支入库）

未改 `packages/page-core/**`、`apps/server/**`、API；未新增依赖；未提交 `.env` / `docs/manager/**`。

## TDD / 替代验证

仓库仍无 web DOM 自动化测试依赖，壳层 IA 无法仓内单测先行。风险：布局回归依赖手测。本轮替代：Chrome headless（puppeteer-core @ `/tmp`，未改仓库依赖）对 Vite + PostgreSQL 16 跑定向清单 → 最小实现 → L2。

自动化恢复条件：引入 Vitest + DOM/浏览器驱动后，固化主带顺序、Collapse 唯一、统计空态、徽标浮层、960 断点。

## 验证证据

### L1 定向手测（第三轮清单）

Chrome headless @ `localhost:5173`，实库已连接 `pageviewer`：

| # | 检查 | 结果 |
|---|---|---|
| 1 | 主带顺序 标题→connected→Collapse→Theme | Pass（加载后 x：12 / 135 / 1219 / 1329） |
| 2 | Collapse 唯一；Hex 标签保留；主带可折叠/展开 | Pass（hex `.pane-head` 无 Collapse/Show；`data-hex` 切换） |
| 3 | 次带主控；主带无表控 | Pass（`.chrome-meta .chrome-controls`） |
| 4 | 未选表/未加载统计空白；加载后齐全 | Pass（加载前无 `.meta-stats`；后含 oid/#blocks/lower/ItemId/#tup） |
| 5 | 次带无长连接串；hover/focus 浮层 + title；无密码 | Pass |
| 6 | ≥960 左右；&lt;960 上下 | Pass（1440：`772px 632px`；900：上下堆叠） |
| 7 | 结构→hex 高亮 + locate；Theme 可切换 | Pass（hl=4、locate-flash；Theme light↔dark） |

汇总：**24/24** 脚本断言通过。

### L2

| 命令 | 结果 |
|---|---|
| `pnpm test` | Pass：page-core 31/31，server 4/4 |
| `pnpm typecheck` | Pass：page-core、server、web |
| `pnpm --filter web build` | Pass：Vite 40 modules |

### L3

| 验证 | 结果 |
|---|---|
| `pnpm test:integration` | Pass：`public.qa_cross` blk 0 length=8192；PG 16.0；dropped-column placeholders OK |
| 实库浏览器手测 | 见上表 24/24 |

## 文档与安全

- `README.md`：主带/次带 IA、徽标连接详情、Collapse 位置已改写。
- 运维文档 N/A。
- 安全：无新依赖；密码仍不进 chrome/浮层/文档/提交；浮层 `aria-hidden` + `title` 可达全文。

## 已知缺口与建议复测

- 0-block 用户表路径未本轮重测（实库无该表）；统计空态与 Load disabled 代码仍在。风险：低。恢复：准备 0-block 表后复测。
- 自动连接环境下未重测 disconnected/连接错误面板。风险：低。
- P1-1 拖拽分隔 N/A；P1-3 原生 select。
- Reviewer 重点：主带 DOM/Grid 顺序与 Tab（徽标→次带主控→Collapse→Theme）、hex 无折叠按钮、统计空态、徽标浮层、960 分栏未回退。

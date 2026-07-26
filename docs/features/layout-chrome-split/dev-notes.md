# Developer Notes: layout-chrome-split

## 结论

- 工作分支：`layout-chrome-split`，基于 `main` `6bed602`。
- T1–T8 已实施；最低验证层 L2 通过，L3 集成冒烟和实库浏览器手测通过。
- Review 门禁为 `required`；本记录不是 QA 结论。

## 完成度与变更

| 任务 | 结果 | 变更或证据 |
|---|---|---|
| T1 分支与基线 | 完成 | 自 `main` 创建源分支；基线 `pnpm test` 通过（31 core + 4 server） |
| T2 移除左侧栏 | 完成 | `App.tsx` 删除 `.nav` / Tables 长列表 DOM；`styles.css` 删除 `.nav`、`.body` 双列和 `--nav-w` |
| T3 顶栏主带 | 完成 | 顶栏提供连接徽标、表 select、`blkno`、Load、Refresh、Theme；`blkno` 支持 Enter 加载 |
| T4 顶栏次带 | 完成 | 显示连接、PG 版本、表/OID/#blocks、blkno、页大小、lower/upper/free、ItemId U/N/R/D、#tup；长连接/版本/表名有 `title`；无密码 |
| T5 响应式主区 | 完成 | `@media (min-width: 960px)` 使用 55%/45% Grid（结构左、hex 右）；959px 及以下单列上下 |
| T6 联动与定位 | 完成 | 保留双向高亮；hex 使用自身滚动容器；修复跨页加载后首次定位 nonce 重置问题 |
| T7 可达性与状态 | 完成 | 主控 Tab 顺序、全局 `:focus-visible`、两主题、刷新壳层稳定、窄屏主控折行均实测 |
| T8 验证与文档 | 完成 | 更新 `README.md` 布局说明；本文件记录验证与缺口 |

变更路径：

- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `README.md`
- `docs/features/layout-chrome-split/dev-notes.md`

未改动 `packages/page-core/**`、`apps/server/**` 或 API 合同；未新增依赖。

## TDD / 缺陷修复记录

仓库没有 web DOM 自动化测试脚本或浏览器测试依赖，无法将本次布局行为写成仓内自动化测试。风险：布局/DOM 回归目前依赖手测，CI 不会主动发现。本次替代验证采用“浏览器可复现检查先行 → 最小实现 → 实库回归”：

1. 变更前确认 DOM 存在 `.nav`，主区为侧栏双列，结构图与 hex 上下排列。
2. 实施后用 Chrome DevTools Protocol 驱动本地 Vite + PostgreSQL 16 实页，检查 DOM、计算样式、几何位置、滚动位置、键盘焦点与主题。
3. 手测发现跨页加载会将 `hexLocate.nonce` 重置为 1，而已处理 ref 仍为 1，导致第二页首次结构选择不自动滚动。修复前复现：第二、第三块 `hexScrollTop=0`、首个高亮行不可见；改为会话内单调递增 nonce 后，块 0/1/2 均滚至 `hexScrollTop=4295`，首个高亮行可见。

自动化恢复条件：仓库引入 web 测试环境（例如 Vitest + DOM/浏览器驱动）后，将顶栏控件、960px 断点和跨页 nonce 场景固化为回归测试。

## 验证证据

### L1 定向检查

- IDE lints：`App.tsx`、`styles.css` 无诊断。
- `git diff --check`：通过。
- Chrome 实测（Vite + 本地 PostgreSQL 16）：
  - 无 `.nav` / `.table-list` / `.body` 节点；`main` 从视口左缘开始。
  - 顶栏可选 `public.qa_hot (4 blk)`，Load/Refresh 可用；Enter 将 blkno 加载到 3。
  - 次带显示全部必显项且正文不含 password。
  - 1440×900：Grid 列为 `772.188px 631.812px`，比例 0.55，结构左、hex 右、两 pane 同屏。
  - 959px：上下；960px：左右；900px：上下且无水平页面滚动；430px：主控可用、PG 长版本截断。
  - 结构→hex：完整区间高亮并滚至可视区；同字段复点滚动位置不变；hex→结构：结构字段高亮，hex 滚动位置不变。
  - 多块连续加载后首次结构选择均可自动定位；结构 pane `scrollTop` 保持不变。
  - Refresh 前后 chrome 与 split 几何值不变；hex 折叠后 `Show hex` 仍可见。
  - Theme light/dark 均渲染可读；Tab 顺序为 table → blkno → Load → Refresh → Theme。

### L2

| 命令 | 结果 |
|---|---|
| `pnpm test` | 通过：page-core 31/31，server 4/4 |
| `pnpm typecheck` | 通过：page-core、server、web |
| `pnpm --filter web build` | 通过：Vite 40 modules，产物成功 |

### L3

| 验证 | 结果 |
|---|---|
| `pnpm test:integration` | 首次在沙箱内因 `tsx` IPC `EPERM` 阻塞；按恢复条件在沙箱外重跑通过 |
| 集成证据 | `public.qa_cross` blk 0 长度 8192；PostgreSQL 16.0；schema dropped-column placeholders 通过 |
| 实库浏览器手测 | 通过上述顶栏、布局、联动、定位、刷新、主题与键盘检查 |

## 文档与安全影响

- `README.md` 已改为顶栏主控、≥960px 左右和窄屏上下布局。
- 运维文档 N/A：部署、环境变量和 API 语义未改。
- 安全影响低：无新依赖、认证/授权、文件或外部访问改动；密码仍只在连接表单中输入，未进入 chrome、文档或提交。

## 已知缺口与建议复测

- 当前实库没有 0-block 用户表，未重新实测空关系面板；代码路径未改。风险：低。恢复条件：准备 0-block heap 表；复测空表提示和 Load disabled。
- 本轮实库会话自动连接，未重新手测 disconnected/连接错误面板；相关表单与错误渲染未改。风险：低。恢复条件：启动时移除连接配置或提供错误连接；复测连接中、失败和重试。
- P1-1 可拖拽分隔未实现，按 Plan 为 N/A；P1-3 使用原生 select 滚动，不另加过滤。
- Reviewer 应重点复核 `App.tsx` 顶栏状态接线、`styles.css` 960px 边界，以及跨页单调递增 locate nonce。

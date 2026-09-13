# QA Report: single-relation-select

> 首测与所有回归写在本文件，按轮次追加；禁止 `qa-report-v2.md`。

## 轮次

| 轮次 | 日期 | 实现版本 | 环境 | 范围 | 结论 |
|---|---|---|---|---|---|
| 1 | 2026-09-13 | `e4186cd2ecbb4e47b55942043ae70ae653882fc9`（基线 `main` @ `ed8437c`） | 分支 `single-relation-select`；macOS arm64；Node ≥20；PG 16.11 @ localhost:5432；web preview 127.0.0.1:4173 + server 127.0.0.1:8787；Chromium headless shell（临时 QA harness，未入仓） | 首测：Spec P0-1..P0-13 + P1，含独立 live-PG/浏览器验收 | Pass |

> 验收对象 HEAD 与 Reviewer 审阅版本、`dev-notes.md` 记录的同步后 HEAD 完全一致（`e4186cd`）；工作树仅有 `main.md` 修改与 `dev-notes.md`、`review.md` 未跟踪，未混入实现改动。

## 执行命令

| 命令 | 输出摘要 / 证据位置 |
|---|---|
| `pnpm --filter web test` | EXIT=0；21 files / 301 tests passed（含 `relationSelect.test.ts` 6 项、`treeNavUi.test.ts` 15 项） |
| `pnpm --filter web typecheck` | EXIT=0；`tsc -p tsconfig.json --noEmit` 零错误 |
| `pnpm build` | EXIT=0；page-core / wal-core / server 构建成功，web vite 70 modules，dist 产物生成 |
| `pnpm test`（全仓回归，可选） | EXIT=0；server 8 files / 86 tests + web 21 files / 301 tests 全通过 |
| `pnpm typecheck`（全仓回归，可选） | EXIT=0；4 个 workspace 全部零错误 |
| 独立 live 验收（Playwright，临时配置，指向已构建 web preview + 活 PG） | 4 tests passed（16.2s）。用例：`P0-1/2/3/8/10/11`、`P0-4/5/6/7`、`P0-13`、`P0-9`。脚本位于 `/var/folders/.../opencode/qa-srs/live.spec.ts`，**未修改仓库代码/测试** |

> 说明：本轮超出 Plan 声明的 `unit + static + build`，额外用活 PG + 真实 Chromium 对 Plan「验证缺口」中的真机自动加载、结构图/统计、URL 实时写入、深链回放做了**直接**验证；临时 spec 与 config 均在仓库外，仅创建/追加本报告，未触碰业务代码与测试。

## 覆盖（对照 Spec 验收与 Plan 验证）

> 证据类型标注：**直接**=本轮真实浏览器 + 活 PG 执行；**间接（静态）**=仅源码扫描 / 纯函数单测，未真实渲染执行。

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| P0-1 | single、kind=table 时次带出现表下拉并列出 `tables` | Pass（直接） | live：默认 Tree 模式两下拉 `toHaveCount(0)`，切 single 后 `select.table-select` 可见，option 命中 seed 表；`App.tsx:1569` 门控、`1602-1635` 下拉 |
| P0-2 | 选 `blocks>0` 表 → 选中、blkno 0、自动 `loadBlk(oid,0)`、URL `kind=table&table=<oid>&blkno=0` | Pass（直接） | live：`selectOption(heapOid)` → `waitPageBlk(0)`、blkno 输入为 `"0"`、URL 精确等于 `searchFor({mode:page,kind:table,table:oid,blkno:0})`、请求含 `/api/tables/<oid>/pages/0`；`App.tsx:665-672`、`1334-1345`、`187-204` |
| P0-3 | 已加载 blk 0 后输入另一 blkno 点 Load 正常加载 | Pass（直接） | live：blkno 填 `5` → Load → `waitPageBlk(5)`；复用现 `triggerLoad`/`canLoad`（`App.tsx:1052-1060`） |
| P0-4 | kind=index 下拉列出全部用户索引、带 am/块数、非 B-tree 标 `✕` | Pass（直接） | live：`index-select` 同时命中 seed B-tree 与 hash 索引；恰好 1 个 option 以 `✕ ` 开头；无 `select.table-filter`；列表来自完整 `indexes.map`（`App.tsx:1721`），`formatIndexOption`（`indexView.ts:49-54`），无 `filterIndexesByTable` |
| P0-5 | 选 B-tree 且 `blocks>0` 索引 → 选中、blkno 0、自动加载 metapage blk 0、结构图出现 | Pass（直接） | live：`selectOption(btreeOid)` → `waitIndexBlk(0)`、`Index page statistics` 可见、blkno 输入 `"0"`、请求含 `/api/indexes/<oid>/pages/0`；`App.tsx:674-680` |
| P0-6 | 选非 B-tree 索引 → 选中、不发请求、Load 禁用、显示非 B-tree 提示 | Pass（直接） | live：选 hash 索引后 `.index-hint-inline` 可见、Load `disabled`，等待 700ms 无 `/api/indexes/<hash>/pages/` 请求；`canLoadIndex`（`indexView.ts:23-25`）、`App.tsx:1063-1068` |
| P0-7 | 已加载索引页后输入另一 blkno 点 Load 正常加载 | Pass（直接） | live：B-tree metapage 后 blkno 填 `1` → Load → `waitIndexBlk(1)`；复用现 `triggerLoadIndex`/`canLoadIndexBlk`（`App.tsx:1063-1074`） |
| P0-8 | single 已加载某页后 Refresh / Prev / Next 与现合同一致 | Pass（直接） | live：Refresh 后仍 blk 5；Next → `waitPageBlk(6)`；Prev → `waitPageBlk(5)`；按钮与 `heapToolbarNav`/`loadBlk` 未改（`App.tsx:1662-1679`），`blockNav`/`pageToolbarNav` 单测全绿 |
| P0-9 | 下拉选表/索引并 Load 成功后重载同一 URL 恢复关系与 blkno | Pass（直接） | live：以 `?mode=page&kind=table&table=<oid>&blkno=5` 与 `?mode=page&kind=index&table=<oid>&index=<btreeOid>&blkno=0` 重新 `goto`，分别 `waitPageBlk(5)` / `waitIndexBlk(0)` 成功；复用现 restore（`urlState.ts:224-244`），`urlState.test.ts` 62 项回归通过 |
| P0-10 | 下拉选中后点 Tree 开关回 Tree，目录展开到该关系且选中可见 | Pass（直接） | live：下拉选表后点 Tree 开关，`#btree-tree-panel [data-row="table:<oid>"][data-current="true"]` 可见；依赖 `onSelectTable` 内 `ensureTableExpanded`（`App.tsx:639`）/ `onSelectIndex` 内 `ensureIndexExpanded`（`App.tsx:657`） |
| P0-11 | Tree 开启时不渲染表/索引下拉 | Pass（直接） | live：默认 Tree 模式 `select.table-select` 与 `select.index-select` 均 `toHaveCount(0)`；两下拉唯一出现在 `{browseMode === "single" && (` 内（`App.tsx:1569/1605/1697`），全文无第二处 className |
| P0-12 | 无表禁用+空态；索引未到/为空显示加载态 / `No user indexes (system schemas excluded)` | Pass（间接（静态）） | 源码：`Loading tables…`/`No tables`/`select a table…`（`App.tsx:1618-1626`）、`Loading indexes…`/`No user indexes (system schemas excluded)`/`select an index…`（`App.tsx:1712-1719`）、禁用含 `!tablesFetched`/`loading-tables`/`loading-indexes`/`loading-page`/空列表（`App.tsx:1610-1615/1704-1709`）；`treeNavUi.test.ts:100-109` 扫描。**限制**：活库非空，未构造「无表/无索引」库，空态与加载态文案的渲染未在真实浏览器触发 |
| P0-13 | 选 `blocks===0` 表 / B-tree 索引 → 选中、blkno 0、不发请求、显示空提示 | Pass（表=直接；索引=间接（静态）） | live（表）：选 seed `emptyOid` → blkno 输入 `"0"`、`Page statistics` 计数 0、等待 700ms 无 `/api/tables/<empty>/pages/` 请求。索引侧 seed 无 0 块 B-tree，未真机触发：由 `shouldAutoLoadRelation(0)=false`（`relationSelect.test.ts:57-59`）+ 自动加载受门禁（`App.tsx:679`）+ 源码扫描（`treeNavUi.test.ts:111-117`）覆盖 |

**P0 小结**：13/13 通过；其中 11 条为真实浏览器 + 活 PG 直接验证，P0-12 与 P0-13（索引半）为间接（静态）证据并已注明限制，不构成关键证据缺口（对应行为已有单测 + 活库直接覆盖的相邻分支）。

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| P1-1 | 切换 Table\|Index 后下拉反映当前 kind 的选择 | Pass（间接（静态）） | `onSwitchRelationKind` 未改（`App.tsx:959+`），下拉 `value` 绑定 `selectedOid`/`selectedIndexOid`（`App.tsx:1606-1608/1698-1702`）；live 仅验证切到 index 后 index 下拉可用 |
| P1-2 | Tree / 深链带入的选择在 single 下拉正确回显 | Pass（间接（静态）） | 受控 `value` 命中列表取值、否则 `""` 占位（`App.tsx:1606-1608/1698-1702`）；深链恢复已 live 验证（P0-9），single 下回显未单独真机触发 |
| P1-3 | `loading-page` 期间下拉禁用 | Pass（间接（静态）） | `disabled` 含 `loadState === "loading-page"`（`App.tsx:1613/1707`）+ 处理器入口 `if (loadState === "loading-page") return`（`App.tsx:666/675`） |
| P1-4 | 长 `qualifiedName` 截断、`title` 保留全名 | Pass（间接（静态）） | `formatTableOption` 长名单测（`relationSelect.test.ts:35-44`）；`title={selectedTable?.qualifiedName}` / `title={t.qualifiedName}` / `indexOptionTitle`（`App.tsx:1609/1628/1703/1722`）；截断为原生 `<select>` 行为 |
| P1-5 | README 中英同步更新 | Pass（直接） | `git show e4186cd -- README.md README.zh-CN.md`：两处「Tree 暗」描述均改为「从工具栏选表/索引并自动加载 blk 0」，中英语义一致，无「不加回下拉」残留 |

## 回归

| 范围 | 结果 | 证据 |
|---|---|---|
| web 单元/源码扫描全量 | Pass | `pnpm --filter web test` EXIT=0，21 files / 301 tests |
| 全仓测试 | Pass | `pnpm test` EXIT=0，server 86 + web 301 |
| 类型检查 | Pass | `pnpm --filter web typecheck` 与 `pnpm typecheck` 均 EXIT=0 |
| 构建 | Pass | `pnpm build` EXIT=0，page-core/wal-core/server/web 全成功 |
| Refresh / Prev / Next（single） | Pass | live：Refresh 保持 blk5、Next→6、Prev→5；现按钮与 handler 未改 |
| 深链 URL 状态 | Pass | live：table blk5 与 index blk0 深链重载均恢复；`urlState.test.ts` 62 项通过 |
| Tree 模式无下拉 | Pass | live：默认 Tree 模式两下拉 count=0；既有 `page browse mode`/`tree nav` 用例通过 |
| 未越界改动 | Pass | `git show --stat e4186cd` 仅 `App.tsx`、`relationSelect.ts(+test)`、`treeNavUi.test.ts`、两个 README；未触碰 `indexView.ts`/`urlState.ts`/`blockNav.ts`/`pageBrowse.ts`/server/样式 |

## 文档与安全验收

| 项 | 结果 | 备注 |
|---|---|---|
| 用户可见文档 | Pass | `README.md`/`README.zh-CN.md` 中英同步更新，描述与实现一致 |
| 运维可执行文档 | N/A | 无部署 / 配置 / 运维变更，`plan.md`「文档影响」理由成立 |
| 安全验证范围 | Pass | 无新增端点 / 依赖 / 凭据；复用现有 `tables`/`indexes` 与 page GET；下拉值经 `Number()` + `find` 校验，未命中即返回（`App.tsx:665-680`）。未触发 `security.md` 强制审阅条件，无未解决安全问题 |

## 缺陷

| ID | 严重度 | 摘要 | 状态 | 处理说明 | 验证证据 |
|---|---|---|---|---|---|
| — | — | 无 | — | — | — |

### Reviewer 非阻塞项裁定

| 项 | 裁定 | 理由 |
|---|---|---|
| `App.tsx:1689-1694` `indexHint` 渲染在 index `<select>` 之前，与 `ui-design.md:38-39` 的「下拉之后」措辞不符 | **Cosmetic（非合同）**，不阻塞验收 | Spec §3 只要求「行内 `indexHint` 保留」，未规定相对位置；Spec 为权威验收依据，UI 稿不扩大合同。功能无影响（提示 `flex: 1 1 100%` 独占行），仅视觉顺序与设计稿措辞略有出入。建议后续增强时整理 |
| `treeNavUi.test.ts:113-114` 的 `loadBlk(oid, 0)`/`loadIndexBlk(oid, 0)` 正则同时命中既有 `activateTable`/`activateIndex`，断言不专属新处理器 | **Cosmetic（测试强度）**，不阻塞 | 该弱断言不构成错误；本轮已用真实浏览器直接验证自动加载路径（P0-2/P0-5/P0-7），合同实际由 live 用例承担 |
| `treeNavUi.test.ts:90-98` 门控扫描无法识别「门控闭合后另加下拉」 | **Cosmetic（扫描固有限制）**，不阻塞 | 本轮 live 已验证 Tree 模式无下拉（P0-11）；当前实现无此问题 |
| `App.tsx:414-428` `indexesFetched` 失败时停留在 `Loading indexes…` | **既有行为，非本项引入**，不阻塞 | 超出本项范围，未新增回归 |

## 阻塞（Blocked 时必填）

- 原因: N/A（本轮无阻塞）
- 风险: N/A
- 恢复条件: N/A
- 复测范围: N/A

## 结论

- 本轮结论: **Pass**
- 已验证提交 SHA: `e4186cd2ecbb4e47b55942043ae70ae653882fc9`
- 合并: 待用户授权（质量条件已满足；等 Manager 在授权后置 `done` 并执行关闭提交/合入）

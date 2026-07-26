# QA Report: layout-chrome-split

## 轮次

| 轮次 | 日期 | 实现版本 | 范围 | 结论 |
|---|---|---|---|---|
| 1 | 2026-07-26 | `layout-chrome-split` @ `5b2756a6b56540eed50b577a3b30a538a354e174` | Spec P0-1..15（第三/四轮）；Plan L2 + 第四轮手测；L3；文档/安全/UI | **Pass** |

---

## 轮次 1 — Pass

### 环境与入口

| 项 | 内容 |
|---|---|
| 分支 | `layout-chrome-split` → `main`；HEAD `5b2756a`；领先 10 commits |
| 工作树 | 实现以 commits 为准；未入库：`review.md`（Approve）、本报告、`docs/manager/**`、`.tmp-uicheck/` |
| 运行时 | macOS；API `127.0.0.1:8787`（connected）；web `localhost:5173`；PG `pageviewer` / `public.qa_cross` blk 0 |
| 入口 | Plan 确认（预授权）持久化；Reviewer **Approve** @ `5b2756a`；路径 `full`；状态 `qa` — **满足** |
| 手测 | Chrome headless + puppeteer-core（`/tmp/qa-layout-chrome`，未改仓依赖）；证据 `/tmp/qa-layout-chrome/evidence/{01-expanded,02-collapsed,03-restored,04-narrow}.png` |

### 命令

| 命令 | 结果 |
|---|---|
| `pnpm test` | Pass：page-core 31；server 4 |
| `pnpm typecheck` | Pass |
| `pnpm --filter web build` | Pass：Vite 40 modules |
| `pnpm test:integration` | Pass：`L3 smoke OK: public.qa_cross blk 0 length=8192` |
| `git diff main...HEAD -- packages/page-core apps/server` | 空 |
| commits 含 `.env`/密钥 | 无 |

### Spec P0（要求 → 证据 → 结果）

| ID | 要求 | 证据 | 结果 |
|---|---|---|---|
| P0-1 | 表/blkno/Load 在次带 | `.chrome-meta .chrome-controls`；无侧栏 | Pass |
| P0-2 | Refresh 在次带 | meta 内 Refresh；`page_loaded` 可点 | Pass |
| P0-3 | 左侧栏完全移除 | 无 `.nav`/空壳 | Pass |
| P0-4 | 主带 标题→connected→Collapse→Theme；次带控+统计；无常驻连接串 | areas `"title badge spacer collapse theme"`；统计含 oid/#blocks/page/lower/upper/free/ItemId/#tup | Pass |
| P0-5 | 连库可区分；Theme 可切 | badge `connected`；Theme dark→light | Pass |
| P0-6 | ≥960 结构左 ‖ hex 右 | cols `772px 632px`；`01-expanded.png` | Pass |
| P0-7 | <960 上下堆叠；主控仍可用 | 800px 上/下；Collapse/Theme/控仍在；`04-narrow.png` | Pass |
| P0-8 | 双向高亮 | 结构→hex hl；hex→结构 selected | Pass |
| P0-9 | 自动滚；同区间不强制再滚；hex 不抢滚 | reduced-motion：首点 `scrollTop=1031`；同 cell/手动 −120 后稳定；hex δ=0 | Pass |
| P0-10 | 不改 page-core/API | scoped diff 空；L2/L3 Pass | Pass |
| P0-11 | 键盘；连接全文可达 | badge `tabIndex=0` + title（host/port/db/user + PG 版本，无密码） | Pass |
| P0-12 | 刷新不卸 chrome | Refresh 中 `.chrome`+`.main-split` 持续 | Pass |
| P0-13 | Collapse 唯一入口在 Theme 左 | 仅 `.chrome-collapse`；hex 面板无折叠钮 | Pass |
| P0-14 | 连接经徽标 hover/聚焦 | meta 无常驻连接串；popover+title 全文；无 password | Pass |
| P0-15 | 未 loaded 统计空白 | Load 前无 `.meta-stats`；后齐全 | Pass |

### Plan 第四轮手测

| # | 要求 | 证据 | 结果 |
|---|---|---|---|
| 1 | 展开无 HEX 标签；宽屏左右 | 无 `.pane-head`；≈55/45 | Pass |
| 2 | 折叠卸载 pane、无占位右列 | 无 `.pane-hex`/`Hex collapsed`；单列 `1416px` ratio≈0.98；`02-collapsed.png` | Pass |
| 3 | Show hex 恢复分栏；主带唯一入口 | `03-restored.png`；宽左右 / 窄上下 | Pass |
| 4 | 联动 + Theme | 见 P0-5/8/9 | Pass |

### P1

| ID | 结果 |
|---|---|
| P1-1 | N/A（未实现） |
| P1-2 | 未专项极窄压测；800px 主控可达；非 P0 阻塞 |
| P1-3 | 原生 select 可定位 `qa_cross` |

### 回归 / 文档 / 安全 / UI

| 项 | 结果 |
|---|---|
| 回归 | page-core 31 + server 4 + L3 + 联动/主题 Pass |
| 文档 | Plan 影响一致；README 主/次带/徽标/Collapse/960 正确；feature 文档齐 |
| 安全 | 壳层 UI；无新认证/出站/依赖；无密码泄漏/`.env` 入库；**允许**授权后合并 |
| UI/UX | Spec P0 + `ui.md` + `ui-design` 第四轮（无 Hex 标签、折叠卸载、主带顺序）Pass |

### 非阻塞观察

| ID | 严重度 | 说明 | 状态 |
|---|---|---|---|
| OBS-1 | 低 | 折叠时 `aria-controls="hex-panel"` 指向已卸载节点（Reviewer C1） | open（可选） |
| OBS-2 | 低 | 0-block / disconnected 未本轮专项手测；风险低 | open（可选） |
| OBS-3 | 低 | 无 web DOM 自动化锁三态（Reviewer C3） | open（测试债） |

### 缺陷

无。

### 本轮结论

**Pass**。无未解决缺陷或关键证据缺口。

质量条件已满足请求合并授权前提；**本报告不提交**（`git.md` §1.4）。用户授权后由 Manager 置 `done` 并与 `review.md`/本报告一次提交，再合入 `main`/push。本轮不 merge、不 push、不改 `docs/manager/**`。

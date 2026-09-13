# QA Report: unify-module-radius-spacing

> 首测与所有回归写在本文件，按轮次追加；禁止 `qa-report-v2.md`。

## 轮次

| 轮次 | 日期 | 实现版本 | 环境 | 范围 | 结论 |
|---|---|---|---|---|---|
| 1 | 2026-09-13 | `1aa7a27a82aa29f9f4f9dffefd3754b8a74a084d`（fix，父 `7ee081d`；文档 `9448806`；基线 `main` @ `6033697`） | macOS darwin / Node 26.5.0 / pnpm 12.3.4 / PostgreSQL 16.11（`localhost:5432`）/ Playwright 1.63（chromium 1243） | 首测：V-1…V-8 + 独立视觉核对 | **Pass** |

## 执行命令

| 命令 | 输出摘要 / 证据位置 |
|---|---|
| `git rev-parse HEAD` | `1aa7a27a82aa29f9f4f9dffefd3754b8a74a084d`；分支 `unify-module-radius-spacing` |
| `git diff --stat main...HEAD` | 代码：`apps/web/src/styles.css`(314 行变更) + 新增 `apps/web/src/designTokens.test.ts`(131 行)，合计 296 insertions / 149 deletions；另 Manager 文档 `STATUS.md`、`main.md`、`plan.md`、`ui-design.md`。无 `.tsx`、无主题 token |
| `git diff --name-only main...HEAD` | 仅上述 6 个文件；`git merge-base --is-ancestor main HEAD` 为真（已基于最新 main） |
| `pnpm --filter web test` | `Test Files 22 passed (22)`，`Tests 311 passed (311)`；`designTokens.test.ts` 10 passed |
| `pnpm --filter web typecheck` | `tsc -p tsconfig.json --noEmit`，退出码 0，零输出 |
| `pnpm build` | `pnpm -r build` 全包成功；`apps/web build: ✓ built in 605ms`，产物 `dist/assets/index-pzoo8ShN.css 43.73 kB` |
| 独立 CSS 契约扫描（`grep`/`awk`） | 51 条 `border-radius` 全为 token / 结构性 `0` / 两处多角 token；`focus-visible` 12 处、`@media` 6 处，与 `main` 计数一致，diff 内零改动 |
| Playwright + 真 PG 视觉核对（自建 harness，脚本 `/tmp/opencode/qa-visual/visual-check.mjs`） | Page / Index(Tree) / WAL 视图截图与溢出度量，见「视觉验收」 |
| Playwright CSS A/B（`/tmp/opencode/qa-visual/compare.mjs`） | 用 `git show main:…/styles.css` 经路由拦截替换，对比新旧计算值 |

## 覆盖（对照 Spec 验收与 Plan 验证）

> 无 Spec，沿用 Plan 的 `V-n`。

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| V-1 | `designTokens.test.ts` 令牌定义用例通过 | Pass | `design tokens (V-1)` 2 用例绿；独立核对 `styles.css:72-86` 的 6 个 `--radius-*`、7 个 `--space-*` 与 `ui-design.md` 逐字一致（`--radius-xs 2px`…`--radius-circle 50%`；`--space-1 0.15rem`…`--space-7 0.75rem`） |
| V-2 | 圆角契约用例通过 | Pass | `border-radius contract (V-2)` 3 用例绿；独立 `grep` 51 条声明全部满足 token / `0` / `0 0 var(--radius-md) var(--radius-md)` / `var(--radius-md) var(--radius-md) 0 0`，无 `999px`、`50%`、裸 px/rem |
| V-3 | 间距契约用例通过 | Pass | `module spacing contract (V-3)` 3 用例绿；抽样 `.pane-tree`、`.tree-section-head`、`.chrome-meta`、`.main`、`.panel`、`.structure-diagram`、`.wal-list-pane`、`.heap-peek-backdrop` 命中新 token，旧值不存在 |
| V-4 | `pnpm --filter web test` 无回归 | Pass | 22 文件 311 用例全绿（较上轮 309 增 2 条耦合用例） |
| V-5 | `pnpm --filter web typecheck` | Pass | 退出码 0，零错误 |
| V-6 | `pnpm build` | Pass | 全包成功，web 605ms，CSS 43.73 kB |
| V-7 | `git diff --stat` / `git status --short` 范围 | Pass | 代码仅 `styles.css` + 新增 `designTokens.test.ts`；无 `.tsx`、无 `theme.ts`、无主题 token、无产品文档；其余为 Manager 的 `workflow/` 文档 |
| V-8 | `@media`、`:focus-visible`、结构性 0、pill/circle 未变 | Pass | `focus-visible` 12 处 / `@media` 6 处与 `main` 相同且 diff 零改动；结构性 `0` 保留于 `.mode-btn`(214)、`.free-band`(953)、`.hex-cell`(1183)、`.wal-record-row`(2263)；`--radius-pill`/`--radius-circle` 语义保留 |

### 独立 CSS 契约复核细节

- 令牌块位于 `styles.css:72-86`，在 `[data-theme="dark"]`（结束于 70 行）之后、全局 `*, *::before, *::after`（88 行）之前，符合 `ui-design.md`。
- `git diff --unified=0` 的新增/删除行中，除 `:root {`/`}` 与圆角/间距声明外无其他属性；`focus`/`outline`/`@media`/`--bg`/`--text`/`--surface`/`--border`/`--diagram` 均无增删。
- 微型元素未改：`.field-cell` padding `0.28rem 0.12rem`、`.structure-flow` gap `0.22rem`、`.infomask-bit-strip__bits` gap `4px`、`.hex` 的 `1px` gap 在 diff 中零改动。

## 视觉验收（Plan 声明的主要风险，已用真环境补齐）

**方法：** 复用仓库既有 Playwright + 真 PostgreSQL harness 形态，自建脚本（不改仓库代码/测试）：用 `pg` 播种 `pageview_e2e`，对当前 `pnpm build` 产物 `vite preview`（已确认线上 CSS 为本次构建 `index-pzoo8ShN.css`，含 `--radius-lg: 8px`），用 chromium 打开 Page（table）、Index（tree）、WAL 三种视图并度量、截图。

| 检查 | 结果 | 证据 |
|---|---|---|
| (a) 负边距导致的横向溢出 / 滚动条 | Pass | 1440×900 与 700×800 下 Page / Index / WAL 均 `docScrollWidth == docClientWidth == 视口宽`、`hasHScroll=false`；`.chrome-meta` 的 `metaScrollWidth == metaClientWidth`（无内部横向滚动），其 rect `x=0`、`width=视口宽`，未越出 `.chrome` |
| (b) tree section 顶部 / structure 表头更紧但不拥挤 | Pass | A/B：`.structure-diagram` padding 旧 `10.4/11.2/12px` → 新 `8/8/9.6px`，圆角 `10px` → `8px`；`.tree-section-head` padding `4.48/3.2px` → `4/2.4px`；`.pane-tree` `6.4/4.8px` → `5.6/4px`。截图显示元信息行仍单行排布、结构图行高清晰、无拥挤/截断 |
| (c) 模块圆角一致 | Pass | `.structure-diagram`/`.hex`/`.wal-list-pane` 统一 `8px`；`.panel`/`.pane-tree`/`.region` 统一 `4px`；badge/pill 保持药丸形；结构性直角（`.hex-cell` 等）保留 |

**截图证据（工作树外，临时目录）：**
- `/tmp/opencode/qa-visual/page-view.png`、`index-view.png`、`wal-view.png`、`wal-narrow.png`（本次实现）
- `/tmp/opencode/qa-visual/compare-new.png`、`compare-old.png`（HEAD vs `main` CSS 的 A/B）
- 复现脚本：`/tmp/opencode/qa-visual/visual-check.mjs`、`compare.mjs`

> 说明：截图位于临时目录、非仓库产物，随环境清理可能消失；命令与脚本已记录，可重跑。

## 回归

| 范围 | 结果 | 证据 |
|---|---|---|
| web 单元测试 | Pass | 22 文件 311 用例全绿，含既有 21 文件无回归 |
| 类型检查 / 构建 | Pass | typecheck 零错误；`pnpm -r build` 成功 |
| 真实浏览器三视图渲染 | Pass | 见「视觉验收」，无溢出、无控制台错误 |
| Playwright e2e（`pnpm test:e2e`，Plan 未要求，额外执行） | 环境性失败（非本变更） | 8 passed / 3 failed：`smoke`（`#btree-tree-panel .btree-tree-blk` 以 `hasText: 'heap_multi'` 同时命中表 `heap_multi` 与索引 `heap_multi_id_idx`，二者均为该 class，`BtreeTreePanel.tsx:62`）；`M9`（观察到对遗留索引 `95403/95410` 的意外 page 请求）；`M6`（等待 `Refresh` 按钮超时）。失败均为目录数据 / 功能用例问题，CSS 圆角间距变更不改变 DOM 数量、history 与 URL 守卫逻辑，判定与本变更无关 |

## 文档与安全验收

| 项 | 结果 | 备注 |
|---|---|---|
| 用户可见文档 | N/A | Plan 声明纯视觉、无功能/操作变化，一致 |
| 运维可执行文档 | N/A | 无部署/监控/排障影响，一致 |
| 开发文档 | N/A | 令牌以 CSS 自定义属性自解释，无 API/配置契约变化，一致 |
| 安全验证范围 | 通过 | 仅改 `styles.css` 与新增测试；无密钥/凭据、无认证授权/输入/外部访问路径改动、无依赖与 lockfile 变更 |

## 非阻塞观察

| ID | 观察 | 结论 |
|---|---|---|
| O-1 | Reviewer 指出 `.meta-controls-row` / `.meta-stats` 列间距 `1.1rem → 0.75rem`（−31.8%）、`.structure-diagram` 中列 `0.7rem → 0.5rem`（−28.6%），超出「约 10–20%」名义区间 | **可接受，非缺陷**。三处均逐条列入 `ui-design.md` 权威完整映射表（137、139、150 行），且验收目标明确以 `ui-design.md` 为权威映射；A/B 截图显示 meta 行仍单行、结构图不拥挤，观感良好 |
| O-2 | `pnpm test:e2e` 的 3 个失败（见回归表） | 环境性，与本变更无关。恢复条件：使用干净 catalog / 独立数据库运行 e2e，或修正 smoke 选择器（区分表与索引）后重跑；Plan 未要求 e2e，故不阻塞本次验收 |
| O-3 | 视觉无自动快照，本次以人工 + 脚本度量补齐 | Plan 的 `manual` 验证缺口已由 QA 真环境核对关闭 |

## 缺陷

| ID | 严重度 | 摘要 | 状态 | 处理说明 | 验证证据 |
|---|---|---|---|---|---|
| （无） | | | | | |

## 阻塞（Blocked 时必填）

- 原因: 无
- 风险: 无
- 恢复条件: 无
- 复测范围: 无

## 结论

- 本轮结论: **Pass**
- 合并: 待用户授权
- 已核验实现提交: `1aa7a27a82aa29f9f4f9dffefd3754b8a74a084d`（源分支 `unify-module-radius-spacing`，目标 `main` @ `6033697`，文档 `9448806`，实现 `7ee081d`）
- 工作树状态: 仅 `main.md` 修改、`dev-notes.md` / `review.md` / `qa-report.md` 未跟踪；实现代码与已核验提交一致

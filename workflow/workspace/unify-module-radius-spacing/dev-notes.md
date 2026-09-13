# Dev Notes: unify-module-radius-spacing

## 实现摘要

- 在 `apps/web/src/styles.css` 的 `[data-theme="dark"]` 块之后、全局 `*, *::before, *::after` 之前，新增主题无关的独立 `:root` 令牌块：6 个 `--radius-*` 与 7 个 `--space-*`，值与 `ui-design.md` 完全一致；未改动既有 `:root, [data-theme="light"]` 与 `[data-theme="dark"]`。
- 将全部 49 条 `border-radius` 裸值声明替换为 `--radius-*` 令牌；保留 4 处结构性 `0`（`.mode-btn`、`.free-band`、`.hex-cell`、`.wal-record-row`）与两处多角形式（`.wal-record-list` `0 0 var(--radius-md) var(--radius-md)`、`.wal-record-header` `var(--radius-md) var(--radius-md) 0 0`）。大表面 `10px` 收敛到 `--radius-lg`（8px）。
- 按 `ui-design.md`「完整间距映射表」逐行收小模块级 `padding/gap/margin`（约 −10%~−25%），使用 `--space-*`；微型元素、chip/bit/cell 内边距、控件内边距与未列出的变体覆盖保持原值。
- 新增 `apps/web/src/designTokens.test.ts`：以 `node:fs` 读取 `styles.css`，锁定令牌定义、`border-radius` 契约与关键间距声明，并断言代表性旧值已不存在。
- 不改任何 `.tsx`、主题 token、`:focus-visible`、`@media`、颜色与布局结构。

## 变更路径

- `apps/web/src/styles.css`（修改）
- `apps/web/src/designTokens.test.ts`（新增）

## 测试先行记录（TDD）

| Spec ID / 行为项 | 测试 | 先失败 | 后通过 | 说明 |
|---|---|---|---|---|
| V-1 令牌定义 | `designTokens.test.ts` › design tokens | `pnpm --filter web test designTokens` → 7 failed \| 1 passed（`:root` 块缺失，令牌断言全挂） | 8 passed | 无 Spec，用 Plan V-n |
| V-2 圆角契约 | `designTokens.test.ts` › border-radius contract | 同上（声明仍为裸值，tokenize 断言失败） | 8 passed | 含 `radiusDecls.length > 40` 防提取失效 |
| V-3 间距契约 | `designTokens.test.ts` › module spacing contract | 同上（旧值仍在，新 `var(--space-*)` 不存在） | 8 passed | 同时断言旧值 `not.toMatch` |
| V-4 回归 | 既有 22 个测试文件 | N/A（新增测试，不改既有行为） | 309 passed | 全量 `pnpm --filter web test` |

## 验证

| 命令 | 验证层 | 结果摘要 / 证据 |
|---|---|---|
| `pnpm --filter web test designTokens`（实现前） | unit（红） | `Test Files 1 failed (1)`，`Tests 7 failed \| 1 passed (8)` |
| `pnpm --filter web test designTokens`（实现后） | unit | `Test Files 1 passed (1)`，`Tests 8 passed (8)`；用例名含令牌定义、圆角契约、间距契约 |
| `pnpm --filter web test` | unit | `Test Files 22 passed (22)`，`Tests 309 passed (309)`，无回归 |
| `pnpm --filter web typecheck` | static | `tsc -p tsconfig.json --noEmit` 零错误（无输出） |
| `pnpm build` | build | `pnpm -r build` 全部成功；`apps/web build: ✓ built in 622ms`，产物 `dist/assets/index-BxML3uAM.css 43.71 kB` |
| `git diff --stat` | static | 仅 `apps/web/src/styles.css`（163 insertions, 147 deletions）+ 新增 `designTokens.test.ts`（105 行） |
| `git status --short` | static | `M apps/web/src/styles.css`、`?? apps/web/src/designTokens.test.ts`；无 `.tsx`、无主题 token、无 `workflow/` |
| 人工核对 diff | manual | `:root` 令牌块位于 `[data-theme="dark"]` 之后；`@media` / `:focus-visible` / 主题 token 零改动；4 处结构性 0 圆角保留 |

## 目标分支同步（最终 Review 前）

- 目标分支及提交: main @ `6033697a152f2f5a1f5c2ce9a9fbc188e3b9921c`（本地 main，未移动；`origin/main` @ `ed8437c` 为其祖先，落后于本地）
- 同步后源分支 HEAD: `7ee081d4b51af435b7ece4199ad086552651634a`
- 同步方式: N/A（no-op；`git merge-base --is-ancestor main HEAD` → true，源分支已基于最新 main，无需 rebase）
- 冲突及处理: N/A
- 同步后复验: `pnpm --filter web test` → `Tests 309 passed (309)`；`pnpm --filter web typecheck` → 零错误（无输出）
- 暂存说明: 代码已提交，工作树仅剩未跟踪的 `workflow/workspace/unify-module-radius-spacing/dev-notes.md`；因无需 rebase，未执行 stash

## 文档影响

| 类别 | 已更新路径或交接说明 |
|---|---|
| 开发文档 | N/A（Plan 已声明：令牌以 CSS 自定义属性自解释，无 API/配置契约变化） |
| 用户文档 | N/A（纯视觉，无功能或操作变化） |
| 运维文档 | N/A（无部署/监控/排障影响） |

## 未解决风险 / 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 真实视觉外观（间距/圆角肉眼效果、拥挤度） | 无视觉快照 harness，`pnpm --filter web test` 为 happy-dom 单测，不渲染布局 | 契约测试只证明“值被替换”，不证明观感 | 按 Plan 验证缺口：QA 用 Playwright + 真 PG 或人工浏览器核对 tree section 顶部、structure 表头、selection-detail、WAL 卡片；必要时回退 `--radius-xl: 10px` |

## 映射偏差记录（ui-design 表与真实 CSS 的差异）

| 行 / 选择器 | 差异 | 处置 |
|---|---|---|
| 「裸值处置」多角 `0` 形式 | `styles.css` 中不存在任何多角 `0` 圆角（仅有 `.wal-record-list` `0 0 6px 6px`、`.wal-record-header` `6px 6px 0 0` 两处非零多角） | 两处非零多角按完整圆角表改为 `0 0 var(--radius-md) var(--radius-md)` / `var(--radius-md) var(--radius-md) 0 0`；无多角零可保留 |
| `.selection-detail .flag-list` gap `0.28rem` | 映射表只列 `.flag-list`（已改 `var(--space-2)`），未列该更具体覆盖 | 按「未列出的属性保持原值」保留 `0.28rem` |
| `.infomask-bit-pair .infomask-bit-strip__row` gap `0.45rem` | 映射表列基础 `.infomask-bit-strip__row`（已改），未列 `.infomask-bit-pair` 覆盖 | 保留原值 |
| `.infomask-bit-pair .infomask-bit-strip__toolbar` gap `0.4rem` | 同上，映射表只列基础 `.infomask-bit-strip__toolbar`（已改 `var(--space-3) var(--space-5)`） | 保留原值 |
| `.btree-tree-row` padding-left `calc(0.35rem + …)` 与 `::before left` `calc(0.35rem + …)` | 映射表只写 padding-left/right `0.35rem`；padding-left 实为 calc，`::before left` 未列出 | 为保持导轨与缩进一致，将 calc 内 `0.35rem` 一并换为 `var(--space-3)`（值等价，无视觉变化） |
| `.chrome-logo` radius `0.28rem` | 「裸值处置」表未列 `0.28rem`，但「完整圆角映射表」明确 `.chrome-logo 0.28rem → var(--radius-sm)` | 按完整圆角表处理 |

> 除上述外，完整间距/圆角映射表的每个 selector 均在 `styles.css` 中逐字存在并已落地。

## QA 修复回执

> QA `Fail` 后按缺陷 ID 追加，不另建文件。

| 缺陷 ID | 处理 | 摘要 | 验证证据 | 建议复测范围 |
|---|---|---|---|---|
| | | | | |

## Review 修复回执（`7ee081d` → `1aa7a27`）

Reviewer `Request changes`（`review.md`）修复记录。本轮只改 `apps/web/src/styles.css` 与 `apps/web/src/designTokens.test.ts`，未触碰其他代码。

| 发现 ID | 处理 | 修复 | 验证证据 |
|---|---|---|---|
| R-1（阻塞） | 已修复 | `styles.css:425` `.chrome-meta` 由 `margin: 0 -0.75rem` 改为 `margin: 0 calc(-1 * var(--space-6));`，与 `.chrome`（`styles.css:180`）水平 padding `var(--space-6)` 精确反向 | 新增 `designTokens.test.ts` › paired spacing coupling › 「keeps .chrome-meta negative margin the inverse of .chrome horizontal padding」；修复前该用例红（Received `0 -0.75rem`），修复后绿 |
| R-2（非阻塞） | 已修复 | `styles.css:1030` `.selection-detail` `max-width` 由 `calc(100% - 2.85rem - 0.45rem)` 改为 `calc(100% - 2.85rem - var(--space-3))`，与 `.selection-detail-wrap` gap `var(--space-3)`（`styles.css:1010`）一致 | 新增 `designTokens.test.ts` › paired spacing coupling › 「keeps .selection-detail max-width in step with the wrap gap token」；修复前该用例红（Received `calc(100% - 2.85rem - 0.45rem)`），修复后绿 |
| 测试建议（耦合回归） | 已落实 | 新增 `declValue()` 辅助函数与 `paired spacing coupling (R-1/R-2)` describe，直接由 `.chrome` padding 第二值推导 `.chrome-meta` 负边距、由 `.selection-detail-wrap` gap 推导 `.selection-detail` max-width，旧值会真实失败 | 修复前 `Tests 2 failed \| 8 passed (10)`；修复后 `Tests 10 passed (10)` |

### 本轮验证（提交 `1aa7a27`）

| 命令 | 结果摘要 |
|---|---|
| `pnpm --filter web test designTokens`（修复前 / 红） | `Test Files 1 failed (1)`，`Tests 2 failed \| 8 passed (10)`（R-1/R-2 两条新用例失败，旧值仍在） |
| `pnpm --filter web test`（修复后） | `Test Files 22 passed (22)`，`Tests 311 passed (311)`（较上轮 309 增 2 条耦合用例，无回归） |
| `pnpm --filter web typecheck` | `tsc -p tsconfig.json --noEmit` 零错误（无输出） |
| `pnpm build` | `pnpm -r build` 全部成功；`apps/web build: ✓ built in 587ms`，产物 `dist/assets/index-pzoo8ShN.css 43.73 kB` |

### 目标分支同步（Review 修复后，git.md §7.1）

- 目标分支及提交: main @ `6033697a152f2f5a1f5c2ce9a9fbc188e3b9921c`（本地 main，未移动；`origin/main` @ `ed8437c` 仍为其祖先）
- 同步后源分支 HEAD: `1aa7a27a82aa29f9f4f9dffefd3754b8a74a084d`
- 同步方式: no-op（`git merge-base --is-ancestor main HEAD` → true，无需 rebase）
- 冲突及处理: N/A
- 暂存说明: `git stash push -- workflow/` 后 `git stash pop`，工作流文档恢复无冲突；未使用 autostash
- 同步后复验: `pnpm --filter web test` → `Tests 311 passed (311)`；`pnpm --filter web typecheck` → 零错误
- 提交: `1aa7a27 fix(web): sync chrome-meta negative margin with reduced chrome padding`（仅 `styles.css` + `designTokens.test.ts`；未 amend `7ee081d`）

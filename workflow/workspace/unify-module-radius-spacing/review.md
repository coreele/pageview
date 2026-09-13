# Review: unify-module-radius-spacing

## 审阅范围

- 实现版本 / 提交: `7ee081d4b51af435b7ece4199ad086552651634a`（源分支 `unify-module-radius-spacing`，目标 `main` @ `6033697`，文档提交 `9448806`）
- 依据: `plan.md`；`ui-design.md`
- 同步状态: `git merge-base --is-ancestor main HEAD` 为真，实现基于最新 `main`；工作树代码与 `7ee081d` 一致（仅 `main.md` 修改、`dev-notes.md` 未跟踪）
- 审阅差异: `git show 7ee081d`（`apps/web/src/styles.css` + `apps/web/src/designTokens.test.ts`）

## 实现正确性

- 令牌块位置与值正确：`styles.css:72` 新增主题无关 `:root`，6 个 `--radius-*` 与 7 个 `--space-*` 与 `ui-design.md` 逐字一致；既有 `:root, [data-theme="light"]` 与 `[data-theme="dark"]` 未改。
- 圆角替换完整：51 条 `border-radius` 声明全部为 `var(--radius-*)` / 结构性 `0` / 两处多角 token；无裸 `px`/`rem`、无 `999px`、无 `50%`（独立 grep 复核）。4 处结构性 0 保留（`.mode-btn`、`.free-band`、`.hex-cell`、`.wal-record-row`）。
- 间距映射基本落地：抽样核对 `.chrome`、`.main`、`.panel`、`.structure-diagram`、`.selection-detail`、`.wal-*`、`.heap-peek-*`、`.export-structure-capture` 与逐条映射表一致。
- `@media` / `:focus-visible` / 主题 token 零改动；`.heap-peek-backdrop` 位于 `@media` 之外，其 padding 改动不属断点内规则。
- **发现 1 个阻塞回归（R-1，见「必修项」）**：`.chrome-meta` 负边距与 `.chrome` 水平 padding 的配对失配。

## 测试有效性

- `designTokens.test.ts` 能因错误实现而失败：令牌断言为精确值；圆角契约遍历全部 `border-radius` 并拒绝裸字面量；间距契约对 `.pane-tree` / `.tree-section-head` / `.chrome-meta` / `.main` / `.panel` / `.structure-diagram` / `.wal-list-pane` / `.heap-peek-backdrop` 正向断言新 token，并对代表性旧值 `not.toMatch`。非恒真。
- `rootTokens()` 用 `/:root\s*\{/` 取首个 `:root` 块：文件首个 `:root,` 因逗号不匹配，正确落到 `styles.css:72` 令牌块；不会误取主题块。
- `blockFor()` 取选择器**首次**出现：对当前被测选择器安全——`\.chrome\s*\{` 不会误配 `.chrome-meta`/`.chrome-title`，`.panel`/`.main` 等亦无更早的同前缀独立规则；但该匹配不锚定边界且不处理重复声明，属脆弱设计，非当前缺陷。
- 覆盖局限：间距契约仅抽样关键声明，未覆盖完整映射表；**未覆盖 `margin`/`padding` 配对耦合**，因此未能捕获 R-1。
- 既有 22 个测试文件 309 用例全绿，无回归。

## 文档影响核对

| Plan 声明 | 实现是否一致 | 备注 |
|---|---|---|
| 开发文档 N/A | 一致 | 无 API / 配置契约变化，令牌以 CSS 自定义属性自解释 |
| 用户文档 N/A | 一致 | 纯视觉，无功能 / 操作变化 |
| 运维文档 N/A | 一致 | 无部署 / 监控 / 排障影响 |

## 安全影响核对

| 检查项 | 结果 | 处置状态 | 备注 |
|---|---|---|---|
| 敏感信息 | 无 | N/A | 仅 CSS 与测试，无密钥 / 凭据 |
| 认证与授权 | 无变更 | N/A | 无逻辑 / 接口改动 |
| 输入与外部访问 | 无变更 | N/A | 无请求 / 解析路径改动 |
| 依赖变更 | 无 | N/A | 未改 `package.json` / lockfile |

## 必修项

| ID | 位置 | 问题 | 状态 |
|---|---|---|---|
| R-1 | `apps/web/src/styles.css:425`（对照 `apps/web/src/styles.css:180`） | `.chrome-meta` 仍为 `margin: 0 -0.75rem`，而 `.chrome` 水平 padding 已由 `0.75rem` 收为 `var(--space-6)`（0.6rem）。负边距原本是 chrome 水平 padding 的精确反向，使 meta 条在 border 内侧贴边；现失配，meta 条每侧外溢约 0.15rem（相对 chrome 边框约 1.4px），破坏贴边并在无 `overflow-x` 裁剪的 body 上造成水平溢出 / 可横向滚动。该 margin 未出现在 `ui-design.md` 映射表，属遗漏的耦合值。 | 待修 |

**R-1 所需修复：** 令 `.chrome-meta` 的负边距与 `.chrome` 水平 padding 保持精确反向，例如
`.chrome-meta { margin: 0 calc(-1 * var(--space-6)); }`（或 `margin: 0 -0.6rem;`）。

## 非阻塞建议

- R-2（陈旧耦合）：`apps/web/src/styles.css:1030` `.selection-detail` 的 `max-width: calc(100% - 2.85rem - 0.45rem)` 仍按旧 gap 计算，而 `.selection-detail-wrap` gap（`styles.css:1010`）已改为 `var(--space-3)`（0.35rem），使 detail 比可用宽度窄 0.1rem。建议改为 `calc(100% - 2.85rem - var(--space-3))`。无溢出风险，故非阻塞。
- 测试未锁定成对值（负 margin ↔ padding、max-width calc ↔ gap），故 R-1 逃逸。建议在 `designTokens.test.ts` 增加耦合断言（至少覆盖 `.chrome-meta` margin 与 `.chrome` padding）。
- 缩减幅度复核：`.meta-controls-row` / `.meta-stats` 的 `1.1rem → 0.75rem`（−32%）、`.structure-diagram` 中列 `0.7rem → 0.5rem`（−29%）超出「约 10–20%」名义区间，但均在 `ui-design.md` 逐条映射表内，属已授权映射。请 QA 视觉复核 meta 行 / 表头是否过挤。
- `.btree-tree-row` 的 `padding-left` 与 `::before left` 的 calc 内 `0.35rem` 已同步换为 `var(--space-3)`（值等价），无陈旧耦合；`top: calc(100% + 0.35rem)`（`styles.css:389`）、`margin: -1px`（`styles.css:810`）、hex cell 的 `31px`（`styles.css:1176`）均与被改间距无关，无需处理。

## 结论

Request changes

> 含必修项 R-1，按 `Request changes` 退回 Developer；修复后复审。

## 后续动作与复审范围

- Developer 修复 R-1（建议连同 R-2），更新 `dev-notes.md` 回执，重新执行 `pnpm --filter web test`、`pnpm --filter web typecheck`、`pnpm build` 并提交。
- 复审范围：仅需确认 `apps/web/src/styles.css` 中 `.chrome-meta` 负边距与 `.chrome` 水平 padding 精确反向、meta 条不再外溢（`scrollWidth === clientWidth`），以及 `.selection-detail` 宽度 calc 与 gap 一致；其余已在本次通过的项可不再全量复核。
- 本报告不提交，留工作树由 Manager 处理。

---

# Review（复审轮次 2）: unify-module-radius-spacing

## 审阅范围

- 实现版本 / 提交: `1aa7a27a82aa29f9f4f9dffefd3754b8a74a084d`（父 `7ee081d`；源分支 `unify-module-radius-spacing`，目标 `main` @ `6033697`）
- 依据: `plan.md`；`ui-design.md`；上一轮 `review.md`（`7ee081d`，`Request changes`）；`dev-notes.md` §「Review 修复回执」
- 同步状态: `git merge-base --is-ancestor main HEAD` 为真；工作树代码与 `1aa7a27` 一致（仅 `main.md` 修改、`dev-notes.md` 与 `review.md` 未跟踪）
- 审阅差异: `git show 1aa7a27`（`apps/web/src/styles.css` + `apps/web/src/designTokens.test.ts`）

## 复审项结论

| ID | 上一轮问题 | 本轮核实 | 状态 |
|---|---|---|---|
| R-1 | `.chrome-meta` 负边距与 `.chrome` 水平 padding 失配 | `styles.css:180` `.chrome` padding 水平值 `var(--space-6)`；`styles.css:425` `.chrome-meta` 已为 `margin: 0 calc(-1 * var(--space-6))`，精确反向，无外溢 | 已关闭 |
| R-2 | `.selection-detail` max-width calc 用旧 gap | `styles.css:1030` 已为 `calc(100% - 2.85rem - var(--space-3))`，与 `styles.css:1010` wrap gap `var(--space-3)` 一致 | 已关闭 |

## 测试有效性（新增耦合用例）

- 耦合用例真实可失败（非恒真）：独立复算 `declValue`/`blockFor` 逻辑，当前 `.chrome` 水平 padding = `var(--space-6)`、`.chrome-meta` margin = `0 calc(-1 * var(--space-6))`、`.selection-detail-wrap` gap = `var(--space-3)`、`.selection-detail` max-width = `calc(100% - 2.85rem - var(--space-3))`，两条耦合断言均成立。将 margin 还原为 `0 -0.75rem` 时耦合断言判否；将 `.chrome` 水平 padding 改为 `var(--space-5)` 时 `toBe("var(--space-6)")` 判否——即改任一侧都会红，Developer 的「红前绿后」自述与逻辑一致。
- `declValue()` 健全：`(?:^|;)\s*property\s*:` 以冒号紧邻限定属性名，`margin` 不会误配 `margin-top`/`margin-bottom`；对单值与多值声明均返回完整值，配合 `trim()` 可用于精确字符串比较。当前被测选择器无 `!important`、无重复声明，安全。
- `blockFor()` 首匹配：独立确认 `styles.css` 中 `.chrome`（`167`）与 `.selection-detail`（`1027`）各仅一条独立规则，`.chrome-meta` / `.selection-detail__title` / `.selection-detail-wrap` 不满足 `\s*\{` 边界，不会误配。`blockFor` 不锚定边界的既有脆弱性仍在，属非阻塞。
- 回归：`designTokens.test.ts` 10 passed；全量 22 文件 311 passed（上轮 309 + 2），无回归。

## 陈旧耦合值再扫描

- 全文 `calc(` 共 7 处：`styles.css:389` `top: calc(100% + 0.35rem)`（popover 与 badge 偏移，无对应被改间距）、`425`（已修复）、`1030`（已修复）、`1176/1177` `(100% - 31px)/32`（hex 固定列几何）、`1991/1999` tree 导轨（`var(--space-3)` 已同步，`0.42rem` 为轨道偏移）——均与被改间距无关，无需处理。
- 全文负 margin 仅 `styles.css:425`（已修复）与 `styles.css:810` `margin: -1px`（1px 边框叠合，与被改间距无关）。无新增或遗漏的成对值。

## 文档影响核对

| Plan 声明 | 实现是否一致 | 备注 |
|---|---|---|
| 开发文档 N/A | 一致 | 本轮仅改 CSS 与测试 |
| 用户文档 N/A | 一致 | 纯视觉 |
| 运维文档 N/A | 一致 | 无部署 / 监控影响 |

## 安全影响核对

| 检查项 | 结果 | 处置状态 | 备注 |
|---|---|---|---|
| 敏感信息 | 无 | N/A | 仅 CSS 与测试 |
| 认证与授权 | 无变更 | N/A | 无逻辑改动 |
| 输入与外部访问 | 无变更 | N/A | 无请求 / 解析改动 |
| 依赖变更 | 无 | N/A | 未改 `package.json` / lockfile |

## 验证命令与结果（`1aa7a27`）

| 命令 | 结果 |
|---|---|
| `pnpm --filter web test` | `Test Files 22 passed (22)`，`Tests 311 passed (311)` |
| `pnpm --filter web typecheck` | `tsc -p tsconfig.json --noEmit` 零错误（退出码 0） |
| `pnpm build` | `pnpm -r build` 全部成功；`apps/web build: ✓ built in 1.08s`，`dist/assets/index-pzoo8ShN.css 43.73 kB` |

## 必修项

| ID | 位置 | 问题 | 状态 |
|---|---|---|---|
| （无） | | | |

## 非阻塞建议

- `blockFor()` 取选择器首次出现且不锚定边界、不处理重复声明，未来若出现同名/同前缀重复规则可能误判；建议后续收紧（如锚定选择器整行），本轮无阻塞。
- 耦合测试目前只锁定 `.chrome-meta` 与 `.selection-detail` 两对；如后续新增类似成对值（负 margin ↔ padding、calc ↔ gap），可按同一 `declValue` 模式扩展。

## 结论

Approve

> R-1 / R-2 均已关闭，无必修项与未解决安全问题，满足进 QA 条件。

## 后续动作与复审范围

- 交 QA：按 `dev-notes.md`「未解决风险 / 验证缺口」用 Playwright + 真 PG 或人工浏览器核对 meta 条无横向溢出（`scrollWidth === clientWidth`）、selection-detail 宽度与 gap、tree section / structure 表头 / WAL 卡片观感。
- 本报告不提交，留工作树由 Manager 处理。

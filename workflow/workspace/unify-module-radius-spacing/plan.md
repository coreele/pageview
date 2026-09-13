# Plan: unify-module-radius-spacing

## 元信息

- 依据 Spec: N/A（Spec 门禁 skipped：纯视觉样式整理，无新增行为、公开接口、状态转换、错误约定或跨模块合同）
- 依据 Design: N/A（Design 门禁 skipped：无模块边界 / 分层 / 技术选型决策，改动集中在 `apps/web/src/styles.css`）
- 依据 UI: `workflow/workspace/unify-module-radius-spacing/ui-design.md`
- 路径等级: standard
- Review 门禁: required
- 最低验证层: `unit` + `static` + `build`（视觉外观为 `manual`，作为验证缺口单列）
- 验证命令:
  - `pnpm --filter web test`
  - `pnpm --filter web typecheck`
  - `pnpm build`
- 预期证据:
  - `designTokens.test.ts` 全部通过，用例名含令牌定义、圆角契约、间距契约
  - web 包既有测试全绿（无回归）
  - `tsc --noEmit` 零错误
  - monorepo `pnpm -r build` 成功日志摘要

## 目标摘要

- 在 `styles.css` 新增主题无关的 `:root` 令牌块：`--radius-xs/sm/md/lg/pill/circle` 与 `--space-1..7`。
- 将全部模块级 `border-radius` 裸值替换为 `--radius-*`，保留结构性 0 与 pill / circle 语义；大表面 10px 收敛到 8px。
- 按 `ui-design.md` 完整映射表把模块级 `padding/gap/margin` 整体收小约 10–20%；微型元素出范围。
- 新增 `apps/web/src/designTokens.test.ts`，以 CSS 契约测试锁定令牌与替换结果，防止裸值回流。
- 不改 DOM、不改 `.tsx`、不改主题 token、不改 focus ring。

## 任务拆解

1. **新增令牌块**（完成条件：`styles.css` 在 `[data-theme="dark"]` 块之后、`*, *::before, *::after` 之前出现独立 `:root { … }`，含 6 个 `--radius-*` 与 7 个 `--space-*`，值与 `ui-design.md` 完全一致；未改动 `:root, [data-theme="light"]` 与 `[data-theme="dark"]`）
2. **替换模块级圆角**（完成条件：`ui-design.md`「完整圆角映射表」每一行落地；`.mode-btn`、`.free-band`、`.hex-cell`、`.wal-record-row` 仍为 `0`；`.wal-record-list` / `.wal-record-header` 多角形式改为 token + 0；`border-radius` 声明中不再出现裸 `1px/2px/3px/5px/8px/10px/999px/50%`）
3. **应用间距映射（收小）**（完成条件：`ui-design.md`「完整间距映射表」每一行落地；微型元素（`.field-cell`、`.structure-flow`、`.hex` 的 `1px` gap、`.infomask-bit-strip__bits` 的 `4px`、chip / bit 内边距等）保持原值；`@media` 规则原样）
4. **新增 CSS 契约测试** `apps/web/src/designTokens.test.ts`（完成条件：读取 `styles.css` 并通过下列断言，全部用例可因错误实现而失败）
   - **令牌存在**：`--radius-xs=2px`、`--radius-sm=4px`、`--radius-md=6px`、`--radius-lg=8px`、`--radius-pill=999px`、`--radius-circle=50%`；`--space-1=0.15rem`…`--space-7=0.75rem` 均以 `--name: value;` 形式定义。
   - **圆角契约**：提取所有 `border-radius: <value>;` 声明（排除 `:root` 令牌定义），每个值必须满足：单 token `var(--radius-*)`，或多角 token 组合，或落在结构性零允许表 `/^(0|0\s+0|0\s+0\s+0\s+0)$/`，或两种多角零形式 `/^0\s+0\s+var\(--radius-\w+\)\s+var\(--radius-\w+\)$/`、`/^var\(--radius-\w+\)\s+var\(--radius-\w+\)\s+0\s+0$/`；不得出现 `999px`、`50%` 与任何裸 px/rem 圆角字面量（`999px`/`50%` 已被 token 取代，比允许表更严格）。
   - **间距契约**：断言收小后的关键声明存在，例如 `.pane-tree { padding: var(--space-3) var(--space-2)`、`.tree-section-head { padding: var(--space-2) var(--space-1)`、`.chrome-meta { padding: var(--space-3) var(--space-6) var(--space-3)`、`.main { padding: var(--space-6)`、`.panel { padding: var(--space-6)`；并断言对应旧值（如 `.pane-tree` 的 `0.4rem 0.3rem`）已不存在。
   - 测试用 `node:fs` 读取 `styles.css`，模式与既有 `FlagMark.test.ts` 的 CSS 契约测试一致。
5. **回归与自验**（完成条件：`pnpm --filter web test`、`pnpm --filter web typecheck`、`pnpm build` 均通过；`git diff --stat` 仅含 `apps/web/src/styles.css` 与新增 `apps/web/src/designTokens.test.ts`，无 `.tsx` / 主题 token 变更）

### 完整 selector → 值映射

以 `ui-design.md`「完整间距映射表」与「完整圆角映射表」为准，Developer 逐行替换；映射规则：

| 旧圆角 | 新令牌 | 旧间距 | 新令牌 |
|---|---|---|---|
| `1px` / `2px` / `3px` | `--radius-xs` (2px) | `1rem` / `0.9rem` / `0.85rem` | `--space-7` (0.75rem) |
| `4px` / `5px` | `--radius-sm` (4px) | `0.75rem` / `0.7rem` | `--space-6` (0.6rem) |
| `6px` | `--radius-md` (6px) | `0.65rem` / `0.6rem` / `0.55rem` | `--space-5` (0.5rem) |
| `8px` / `10px` | `--radius-lg` (8px) | `0.5rem` | `--space-4` (0.45rem) |
| `999px` | `--radius-pill` | `0.45rem` / `0.4rem` | `--space-3` (0.35rem) |
| `50%` | `--radius-circle` | `0.35rem` / `0.3rem` / `0.28rem` / `0.25rem` | `--space-2` (0.25rem) |
| `0`（含多角 0） | 保留 `0` | `0.2rem` / `0.15rem` | `--space-1` (0.15rem) |
| | | `≤0.12rem` / `1px` / `2px` / `4px` / `6px` | 保留裸值（微型，出范围） |

## 依赖与顺序

1. 任务 1 先行（令牌未定义时后续替换不可编译/不可测）。
2. 任务 2、3 可并行（同文件不同声明，需避免编辑冲突，建议串行）。
3. 任务 4 在 1–3 完成后新增（断言依赖最终 CSS 文本）。
4. 任务 5 最后执行。

## 触碰路径

- `apps/web/src/styles.css`（修改）
- `apps/web/src/designTokens.test.ts`（新增）

**不触碰**：

- 任何 `.tsx`（无 DOM、行为、props、可访问性属性变更）
- `apps/web/src/theme.ts`、主题 token（`--bg` / `--text` / `--surface` 等）
- `:focus-visible` 及其 `outline` / `outline-offset`
- `README` 及任何用户 / 运维文档
- 其余工作区包（`packages/*`、`apps/server`）

## 验收与验证

> 无 Spec，自编 `V-n`。

| ID | 要求或命令 | 预期证据 | 结果（实施后填） |
|---|---|---|---|
| V-1 | `pnpm --filter web test` 中 `designTokens.test.ts` 的「令牌定义」用例通过 | 6 个 `--radius-*` 与 7 个 `--space-*` 值精确匹配，用例名与通过数 | |
| V-2 | `pnpm --filter web test` 中「圆角契约」用例通过 | 全部 `border-radius` 为 token / 结构性 0 / 多角零形式；无 `999px`、`50%`、裸 px/rem | |
| V-3 | `pnpm --filter web test` 中「间距契约」用例通过 | 关键模块声明命中 `var(--space-*)`，对应旧值不存在 | |
| V-4 | `pnpm --filter web test` | web 包全部既有测试 + 新测试全绿，无回归 | |
| V-5 | `pnpm --filter web typecheck` | `tsc -p tsconfig.json --noEmit` 零错误 | |
| V-6 | `pnpm build` | `pnpm -r build` 全部包构建成功，日志摘要 | |
| V-7 | `git diff --stat` 与 `git status --short` | 仅 `apps/web/src/styles.css` 修改、`apps/web/src/designTokens.test.ts` 新增；无 `.tsx`、无主题 token、无文档 | |
| V-8 | 人工核对 `styles.css` 中 `@media`、`:focus-visible`、结构性 0 圆角、pill / circle 未变 | `git diff` 中这些片段零改动 | |

## 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 真实视觉外观（间距 / 圆角肉眼效果、拥挤度） | 无视觉快照 harness；`pnpm --filter web test` 为 happy-dom 单测，不渲染布局 | 契约测试只能证明“值被替换”，不能证明“观感更好 / 未拥挤” | 用 QA 既有 Playwright + 真 PG harness（`pnpm test:e2e`）或人工浏览器打开 Page / WAL 视图，对照 `ui-design.md` 的 before/after 草图核对：tree section 顶部、structure 表头、selection-detail、WAL 卡片。若发现拥挤或大表面圆角过小，回退对应 token 值（大表面可恢复 `--radius-xl: 10px`） |

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | N/A（无 API / 配置 / 注释性契约变化；令牌以 CSS 自定义属性自解释） |
| 用户文档 | N/A（纯视觉，无功能或操作变化） |
| 运维文档 | N/A（无部署 / 监控 / 排障影响） |

## 交接顺序

1. Developer 实施与自验（任务 1–5，命令与结果记入 `dev-notes.md`）→
2. Reviewer（Review 门禁 required）审阅测试有效性、文档影响、安全影响 →
3. QA 独立验收（核对 V-1…V-8，含 Playwright / 人工视觉核对）→
4. 用户授权合并 → Manager 置 `done` 并第三阶段提交 → 合入 → 结束

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-09-13 | 初稿：确定 `--radius-*` / `--space-*` 令牌、完整映射表与 CSS 契约测试方案 |

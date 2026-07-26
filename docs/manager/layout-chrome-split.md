# 工作项记录: layout-chrome-split

工作项标识: layout-chrome-split
描述: 在已合入 main 的页查看器之上做 UI 布局优化增量（非从零建应用）：(1) 将 table 选择与 blkno（及关联主控）从左侧边栏上移至顶部连接/页状态区并统一美化；(2) 将 page 结构图与 hex 从上下改为桌面宽屏左右布局，并约定窄屏行为。保留连库状态、主题切换、元信息必显字段及结构图↔hex 双向高亮/自动滚动等既有合同；禁止改动 page-core 解析语义。
路径等级: full
源分支: layout-chrome-split
目标分支: main
文档影响: 将新建 `docs/features/layout-chrome-split/`（spec.md、design.md、ui-design.md、plan.md，及后续 dev-notes/review/qa-report）；可能修订 README 中壳层/布局说明。前序合同见归档 `docs/archive/2026/pg-page-viewer/` 与 `docs/archive/2026/page-diagram-32b/`。

> 权威工作流、门禁与状态说明见 manager 规范。
> 活跃状态见 [STATUS.md](STATUS.md)。
>
> 文档路径：未拆分 Spec 为 `docs/features/layout-chrome-split/spec.md`。

## 参考资产（供 Analyst / Planner）

- 当前 UI 截图（红框=左侧控制栏；箭头=顶部状态区）: `/Users/zhougangjie/.cursor/projects/Users-zhougangjie-Space-pageview/assets/image-80725bc1-83bf-440a-864c-46b20b0f6e64.png`
- 图示要点（登记引用，非最终像素稿）:
  - 红框指向左侧 table / blkno / Load 等控制栏，拟上移
  - 箭头指向顶部 Context / status strip（连接与页状态），拟作为选择控件与状态元信息的统一呈现区

- 参考截图（增量微调现状，非像素稿）: `/Users/zhougangjie/.cursor/projects/Users-zhougangjie-Space-pageview/assets/image-c5e665be-017d-48d3-bb22-732489cd89b3.png`

## 用户明确需求要点（须写入 Spec 合同）

### 需求 1：选择控件上移 + 顶栏美化

1. 将 **table 选择** 与 **blkno** 输入（及关联的 Load/Refresh 等主控，若仍需要）从左侧边栏移到 **上方显示连接/页状态的位置**（当前 Context / status strip 一带）。
2. 对该顶部区域做 **统一美化与调整**：选择控件与状态元信息同区协调呈现，不要简陋堆砌。
3. 左侧专用控制栏可随之收窄/移除（若选择与 blkno 已全部上移）。
4. **保留既有能力**：连库状态、主题切换、元信息可见性合同（前序 Spec 中的必显字段）不得无故砍掉；布局可重组。

### 需求 2：Page 与 Hex 左右布局

5. 当前 **page 结构图** 与 **hex 二进制视图** 是 **上下** 呈现；改为 **左右** 呈现（结构图一侧、hex 一侧；**桌面宽屏主路径**）。
6. **窄屏/小视口**行为须在 Spec / ui-design 中写清（可允许回退为上下或可滚动，但须有合同）。
7. 既有结构图↔hex **双向高亮**、点击后 hex **自动滚动定位**等联动能力须保留（见归档 `page-diagram-32b`）。

### 范围边界（登记约束）

- 本项是前端布局/壳层增量；**不得**改业务解析逻辑（`page-core`）。
- 不得无故回退归档 Spec 中的必显元信息、主题切换、连接状态等合同。

### 增量需求（2026-07-26 第三轮，reviewing 中回退 Spec）

参考截图: `/Users/zhougangjie/.cursor/projects/Users-zhougangjie-Space-pageview/assets/image-c5e665be-017d-48d3-bb22-732489cd89b3.png`

8. **Collapse Hex → 主带 Theme 旁**：将 hex 面板顶栏的 `Collapse hex` 折叠控件移到顶栏**主带**，置于 `Theme: dark/light` 旁边。
9. **连接详情收入 connected 徽标，悬浮显示**：次带中长连接串（host/port/database/user、PG 版本串等）**不要常驻占行**；收入 `connected` 徽标，默认隐藏，**hover 显示**（tooltip / popover 均可）。须写清键盘可达性：至少 `title` 或可聚焦触发以看到全文。
10. **table / blkno 下移到次带（原连接信息行）**：表选择与 `blkno`（及 Load/Refresh）从主带下移到**当前连接信息所在行/次带**；表/页元信息（oid、#blocks、page、lower/upper/free、ItemId、#tup 等必显项）**跟随其后**同一区域。主带保留：标题、connected 徽标、主题、以及新移入的 Collapse hex。
11. **左右分栏不回退**：结构图左 / hex 右（宽屏）用户确认正确，禁止回退为上下作为宽屏唯一布局。

### 增量需求（2026-07-26 第四轮，reviewing 中 ui-design 细化）

用户原话：「HEX 就不需要了，另外折叠后 Hex Callapsed 也不需要」（Collapsed）。

参考截图:
- 展开态 HEX 标签: `/Users/zhougangjie/.cursor/projects/Users-zhougangjie-Space-pageview/assets/image-d0c1c42c-a117-4209-9e35-68f9019ade5c.png`
- 折叠态残留栏: `/Users/zhougangjie/.cursor/projects/Users-zhougangjie-Space-pageview/assets/image-e7433182-4d00-4b23-80a7-451ebd602796.png`

12. **移除 hex 面板内「HEX」/「Hex」标签**（展开时也不要）。
13. **折叠后**：不要「Hex collapsed」占位文案，也不要保留空的右侧窄列；hex 面板从布局**完全退出**，结构图占满主内容区。主带 Collapse/Show hex 仍为唯一切换入口。
14. 折叠/展开能力本身保留；展开时宽屏左右分栏不回退。

## 切片（未拆分，sub-feature-id = feature-id）

| sub-feature-id | Spec | Spec 门禁 | Spec 用户确认 | Design 门禁 | UI 表面 | Review 门禁 | 状态 | 后续步骤 |
|---|---|---|---|---|---|---|---|---|
| layout-chrome-split | [spec.md](../features/layout-chrome-split/spec.md) | required | approved | required | gui | Approve @ 5b2756a | done | 关闭提交后合入 main → push → 归档 |

阻塞原因: none
恢复条件: N/A
恢复后的目标状态: N/A

## 门禁判定理由

- 路径等级 `full`：主壳层信息架构重组（顶栏 chrome + 主内容区左右分栏）属产品表面重大布局变更；窄屏策略与顶栏组成存在待确认合同；虽为增量而非从零建应用，合同风险与确认需求对齐 `full`。
- Spec 门禁 `required` 且 Spec 用户确认 `required`：`full` 强制；须显式引用前序归档 Spec 中不得回退的合同，并写清本项布局增量与窄屏行为。
- Design 门禁 `required`：壳层组成与主内容区分栏属前端 UI 架构决策；且 `UI 表面=gui`，Planner 在 Plan 前须调用 `design-ui` 产出 `ui-design.md`（窄屏断点与顶栏编排落在此）。技术上预期仍为纯前端、不改 page-core；若发现需改 API，须先回 Spec。
- UI 表面 `gui`：面向最终用户的图形界面。主题/深色是否变更由 Spec 决定；默认保留既有 light/dark 合同，不因本项默认新增主题范围。
- Review 门禁 `required`：`full` 强制。
- 未拆分：两项布局需求同属一次壳层改造，范围可控。

## 进度笔记

- 2026-07-26: `/manager` 登记工作项 `layout-chrome-split`。活跃 STATUS 此前为空；前序已归档 `pg-page-viewer`、`page-diagram-32b`。路径 `full`，门禁判定完成；源分支 `layout-chrome-split` → 目标 `main`（调度 Developer 前再核验）。状态 `backlog` → `speccing`。单步模式：调度 Analyst 编写 Spec；Analyst 完成后停住等待用户确认 Spec，不连续调度 Planner/Developer。禁止擅自 commit/merge/push；禁止改 page-core；禁止提交 `.env`。
- 2026-07-26: Analyst（[analyst](51d4d70f-125f-4dbd-aee5-43013302cbf2)）完成 `docs/features/layout-chrome-split/spec.md`。含前序不得回退引用、布局增量 P0-1..P0-12、开放问题 Q1–Q6（均待确认，含推荐默认）。状态 `speccing` → `awaiting-spec-approval`。单步模式：不调度 Planner；等待当前用户会话确认 Spec 全文与 Q1–Q6。
- 2026-07-26: **Spec 用户确认 + 连续推进授权**（当前用户会话原话：「全部 ok，planner 可以跳过审核，完成后直接开发设计」）。解读与核验：
  1. Spec 全文批准；Q1–Q6 **全部采纳 Analyst 推荐默认**（960px / 上下堆叠 / 图左 hex 右 / 主带+次带 / combobox / 完全移除左侧栏）。状态 `awaiting-spec-approval` → `speccing`；先调度 Analyst 将裁决写回 `spec.md` 并关闭开放问题，收口后 `Spec 用户确认` → `approved`。
  2. **Plan 确认门禁预授权**：Planner 完成 `design.md`、`ui-design.md`、`plan.md` 后，**无需**再等用户确认 Plan，可直接 `planned` → `developing` 并调度 Developer。本条预授权登记备审计；来源为上述用户原话。
  3. 本轮**不再单步停顿**：允许连续 Analyst（Spec 收口）→ Planner → Developer。
  4. **硬约束仍生效**：Review 门禁 `required` 不豁免；Developer 完成后**不得**自动调度 Reviewer/QA/merge；禁止 merge/push；禁止提交 `.env`；禁止改 `page-core`/后端 API；前序归档合同不得削弱。分支：源 `layout-chrome-split` → 目标 `main`。
- 2026-07-26: Analyst（[analyst](36158064-7bff-417a-a2cc-d91c3ee993d8)）完成 Spec 收口：Q1–Q6 写入正文并关闭；确认门禁已确认/approved。`Spec 用户确认` → `approved`。状态 `speccing` → `designing`。连续模式：立即调度 Planner（design.md + ui-design.md + plan.md）。
- 2026-07-26: Planner（[planner](227a3692-ae79-4eac-9171-9f3969f3500c)）完成 `design.md`（157）、`ui-design.md`（165）、`plan.md`（177）。关键决策：主带+次带顶栏；CSS Grid `.main-split` @960px；删侧栏；仅改 `apps/web`；任务 T1–T8。按 **Plan 确认预授权**，跳过 `awaiting-plan-approval`：状态 `designing` → `planning`（短暂）→ `planned` → `developing`。分支核验：当前在 `main` @ `6bed602`；源分支 `layout-chrome-split` 尚不存在，由 Developer 自 `main` 创建并检出后实施。立即调度 Developer。连续模式：Developer 完成后返回，**不**自动调度 Reviewer/QA。
- 2026-07-26: Developer（[developer](083a1c4d-54b3-4907-be91-745bb8c69e82)）完成实施。Manager 独立核验：当前分支 `layout-chrome-split`，HEAD `5e04433`，领先 `main` 4 个 Conventional Commits（`180ac9d` docs 定义 chrome/split、`e3d6f7e` feat(web) 主控上移+分栏、`cf71ac3` docs 验证记录、`5e04433` docs scoped diff 说明）；`packages/page-core/**` 与 `apps/server/**` 相对 `main` **零 diff**（P0-10 满足）；feature 文档（spec/design/ui-design/plan/dev-notes）已随源分支入库；manager 文件（STATUS 修改 + 工作项记录 untracked）保持未提交。T1–T8 全部完成；验证：L1（lint + 浏览器实库手测：宽窄布局/主题/键盘/双向高亮/跨块自动滚/刷新稳定）、L2（`pnpm test` 31 core + 4 server、typecheck、web build 通过）、L3（`pnpm test:integration` 实库通过）。已知缺口：0-block 空关系路径未手测（实库无该表）；disconnected/连接错误态在自动连接环境未重新手测；P1 拖拽分隔按 Plan N/A。状态 `developing` → `reviewing`。**硬约束**：Review 门禁 required 未豁免——**不**自动调度 Reviewer，等待用户授权；禁止 merge/push；`.env` 未提交。
- 2026-07-26: **增量 UI 微调回退 Spec（reviewing → speccing）**。用户截图 + 三点布局调整触及已批准合同：
  - **判定**：路径 `full`；变更改写已裁决 **Q4 主带/次带编排**，并将连接详情从「次带常驻必显 / 无需深挖可见」改为「connected 徽标 hover 可达」——属 Spec 可见性与 IA 合同变更，**不可**仅靠 ui-design 静默实施。`Spec 用户确认` `approved` → `required`；状态 `reviewing` → `speccing`。
  - **不变**：左右分栏（图左 hex 右）、960px 断点、窄屏上下、page-core/API 禁改、Review required。
  - **Plan 预授权续用**：本轮 Spec 用户确认后，Planner 修订 ui-design/plan（及必要 design 增量）完成后，仍可跳过 Plan 确认直接 Developer（来源：此前「planner 可以跳过审核，完成后直接开发」精神；本条在增量轮次进度笔记重申）。
  - **本步**：调度 Analyst 修订 `spec.md`（增量条款 + 修订 P0-1/P0-4/Q4 等受影响验收；不得削弱左右分栏与前序归档必显字段的可达性语义——连接详情改为 hover 可达须显式合同化）。Analyst 完成后 → `awaiting-spec-approval`，**停住**等用户确认；不连续 Planner/Developer。
- 2026-07-26: Analyst（[analyst](698bd27b-f895-47ec-9b4f-c6727901bbcf)）完成第三轮增量 Spec 修订：主带=标题+connected+Theme+Collapse hex；次带=表控+页统计常驻；连接详情+PG 版本→徽标 hover/聚焦；新增 P0-13/P0-14；修订 P0-1/2/4/6/7/11；Q4 标为待确认（原编排被取代）。状态 `speccing` → `awaiting-spec-approval`。单步停顿：不调度 Planner/Developer。
- 2026-07-26: **第三轮 Spec 用户确认 + 微调裁决**（用户原话：「主带：标题 + connected + Collapse hex + Theme」「hex 在 theme 前面」「表页统计中如还没选择表和 blkno，就空白即可」「当前 hex 左上角的 collapse 可以不要列」「ok」）。状态 `awaiting-spec-approval` → `speccing`。裁决：
  1. 主带顺序固定：标题 → connected → **Collapse hex** → **Theme**（Collapse 在 Theme 左侧）。
  2. hex 面板内 Collapse 控件**移除**；主带为唯一入口；修订 P0-13 措辞。
  3. 未选表/未加载页：次带表页统计区**空白**（不堆砌 —/N/A）；必显限定在对应状态（如 page_loaded）。
  4. 其余第三轮条款照准（连接 hover、次带主控、左右分栏不回退）。
  - Plan 预授权续用；连续 Analyst → Planner → Developer；Developer 后回 reviewing，等用户授权 Reviewer；禁止 merge/push/.env；仅 apps/web。
- 2026-07-26: Analyst（[analyst](78792f6c-3321-4cab-87b5-5a0a219d02d3)）完成 Spec 微调收口：主带顺序 Collapse→Theme；P0-13 唯一入口；P0-15 空态空白；Q4 关闭。`Spec 用户确认` → `approved`。状态 `speccing` → `designing`。连续调度 Planner。
- 2026-07-26: Planner（[planner](1679facd-e0fc-49d2-8af4-c06144e2141b)）完成第三轮增量 design/ui-design/plan：主带顺序锁定；hex 保留标签删 Collapse；统计仅 page_loaded；连接徽标浮层；任务 **T9–T14**。按 Plan 预授权：`designing` → `planned` → `developing`。立即调度 Developer。Developer 完成后回 reviewing，**不**自动 Reviewer。
- 2026-07-26: Developer（[developer](fbf6c393-43c8-4dc5-b1ee-6479f2b53963)）完成 T9–T14。Manager 核验：分支 `layout-chrome-split`，HEAD `d3a9086`，领先 `main` 7 commits（本轮新增 `319d949` docs 锁定第三轮合同、`8bf09cc` feat(web) chrome 重排、`d3a9086` docs 验证）；`page-core`/`server` 相对 main 零 diff。实现抽查：主带 Collapse→Theme；hex pane 仅 Hex 标签无 Collapse；connected 徽标含 conn-popover + title；统计仅 `page` 时渲染。验证：L1 手测 24/24、L2 test/typecheck/web build Pass、L3 integration Pass。缺口：0-block / disconnected 未本轮重测；P1 拖拽 N/A。状态 `developing` → `reviewing`。**不**自动调度 Reviewer；禁止 merge/push；manager 文件与 `.env` 未提交。
- 2026-07-26: **第四轮增量（去 HEX 标签 + 折叠无占位栏）**。用户原话见上。**判定**：Spec 已写明「HEX 标签等非折叠装饰由 ui-design 定」；「Hex collapsed」占位仅在 ui-design/plan，非 Spec P0 硬合同。不改变必显元信息、连接 hover、主带顺序、展开时左右分栏语义 → **不回退 Spec 确认门禁**；跳过 Analyst。状态 `reviewing` → `designing`。Plan 预授权续用。连续：Planner 修订 ui-design/plan（及必要 design）→ Developer；完成后回 reviewing 等 Reviewer 授权。
- 2026-07-26: Planner（[planner](38d4f138-20f7-40c8-a600-306397c6ed2f)）完成第四轮 ui-design/design/plan：展开无 Hex 标签；折叠时 hex pane 完全退出、结构图全宽；任务 **T15–T16**。Plan 预授权：`designing` → `planned` → `developing`。立即调度 Developer。
- 2026-07-26: Developer（[developer](ab3d4dae-8996-42a4-9aee-0d15d0e64e85)）完成 T15–T16。Manager 核验：HEAD `5b2756a`，领先 main 10 commits（本轮 `dc5b455`/`caee028`/`5b2756a`）；hex pane 条件渲染 `{!hexCollapsed && …}`，无「Hex collapsed」/pane-title；page-core/server 零 diff。验证：L2 Pass；手测 23/23；L3 本轮未重跑。状态 `developing` → `reviewing`。**不**自动 Reviewer；禁止 merge/push。
- 2026-07-26: **用户授权 Reviewer + 条件预授权 QA/合并/push**（原话：「ok, 没有问题直接提交，合并，push」）。解读：① 立即调度 Reviewer；② 仅当 Approve → 调度 QA；③ 仅当 QA Pass → 关闭提交 + 合入 main + push origin + 归档。Request changes / QA 非 Pass 则停。Review 门禁不跳过。状态保持 `reviewing`，调度 Reviewer。
- 2026-07-26: Reviewer（[reviewer](b734a3e8-7715-49ca-94f0-4e133cdb2810)）结论 **Approve** @ `5b2756a`；阻塞项 none；报告 `review.md` 未提交。Review 门禁 required **已满足**。状态 `reviewing` → `qa`。按条件预授权立即调度 QA。
- 2026-07-26: QA（[qa](5d15fe0f-65f8-48e8-950d-77443fd83ddb)）结论 **Pass** @ `5b2756a`。L2/L3/手测 P0-1..15 与第四轮三态通过；缺陷 none；`qa-report.md` 未提交。按用户条件预授权（「ok, 没有问题直接提交，合并，push」）：状态 `qa` → `done`。门禁核验：Plan 已确认；Review Approve；QA Pass；分支已记录；合并+push 已授权。关闭窗口一次提交 STATUS/工作项/`review.md`/`qa-report.md`（禁 `.env`/`.tmp-uicheck`），再调度 QA 兼任 Merge Executor 合入 `main` 并 push。

## 合并授权（2026-07-26）

结论: **授权** 源 `layout-chrome-split` → 目标 `main`，并授权合入后 **push** 至 origin（用户原话：「ok, 没有问题直接提交，合并，push」）。条件：Review Approve + QA Pass 均已满足。

## Spec 用户确认（2026-07-26，第三轮增量 + 微调）

结论: 批准第三轮增量 Spec，并采纳下列微调（用户「ok」）。`Spec 用户确认` 经 Analyst 写回正文后 → `approved`。

| 项 | 决议 |
|---|---|
| 主带顺序 | 标题 → connected 徽标 → Collapse hex → Theme（Collapse 在 Theme 前） |
| Collapse 入口 | 仅主带；hex 面板内不再提供 Collapse 控件 |
| 表页统计空态 | 未选表 / 未加载页时统计区空白即可；必显仅在对应状态（如 page_loaded） |
| 其余 | 连接详情 hover/聚焦、次带表控+Load/Refresh、宽屏图左 hex 右不回退 — 照第三轮批准 |

## Spec 用户确认（2026-07-26）

结论: 批准 Spec 全文；开放问题 Q1–Q6 全部采纳 Analyst 推荐默认并已由 Analyst 写回正文。

| ID | 决议 |
|---|---|
| Q1 | 宽屏断点 960px |
| Q2 | 窄屏回退：上下堆叠（结构图上、hex 下，各自可滚） |
| Q3 | 宽屏：结构图左、hex 右 |
| Q4 | 顶栏主带（连接状态 + 表选择 + blkno + Load/Refresh + 主题）/ 次带（连接详情 + 页统计必显）；禁密码；长文本可截断但须 tooltip 达全文 |
| Q5 | 表选择：顶栏 combobox/select |
| Q6 | 左侧栏完全移除 |

## Plan 用户确认（2026-07-26，第三轮增量，预授权生效）

结论: **批准增量 Plan**（预授权续用）。Plan：`docs/features/layout-chrome-split/plan.md`（T9–T14）。状态经 `planned` 立即进入 `developing`。

## Plan 确认预授权（2026-07-26）

结论: **预授权跳过 Plan 确认门禁**。来源用户原话：「全部 ok，planner 可以跳过审核，完成后直接开发设计」。Planner 产出后 Manager 可将状态置为 `planned` 并立即调度 Developer，无需再等用户确认 Plan。Review / QA / 合并授权**不**在此预授权范围内。

## Plan 用户确认（2026-07-26，预授权生效）

结论: **批准 Plan**（预授权）。Plan 路径：`docs/features/layout-chrome-split/plan.md`（T1–T8，依据 design.md / ui-design.md）。状态经 `planned` 立即进入 `developing`。

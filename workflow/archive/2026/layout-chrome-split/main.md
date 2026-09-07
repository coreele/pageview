# 工作项: layout-chrome-split

描述: 在已合入 main 的页查看器之上做 UI 布局优化增量（非从零建应用）：(1) 将 table 选择与 blkno（及关联主控）从左侧边栏上移至顶部连接/页状态区并统一美化；(2) 将 page 结构图与 hex 从上下改为桌面宽屏左右布局，并约定窄屏行为。保留连库状态、主题切换、元信息必显字段及结构图↔hex 双向高亮/自动滚动等既有合同；禁止改动 page-core 解析语义。
目标分支: main
源分支: layout-chrome-split
基线提交: 97b4f0570c3e41821976ff211ce2feb47570323b
文档影响: 已归档至 `workflow/archive/2026/layout-chrome-split/`（原 `workflow/archive/2026/layout-chrome-split/`：spec.md、design.md、ui-design.md、plan.md、dev-notes.md、review.md、qa-report.md）；可能已修订 README 中壳层/布局说明。前序合同见归档 `workflow/archive/2026/pg-page-viewer/` 与 `workflow/archive/2026/page-diagram-32b/`。

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/archive/2026/layout-chrome-split/`。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| full | required | approved | required | required |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| archived |  |  |  |  |

## 进度笔记

- 2026-09-07 工作流迁移：机制改为 `workflow/WORKFLOW.md` + `workflow/agents/`；本记录由 `manager.md` 转为 `main.md`，产物平铺到 `workflow/archive/2026/layout-chrome-split/`。旧状态机名称（awaiting-*-approval 等）按新枚举对齐。
- 历史字段 UI 表面: gui（新模板已取消该列）。

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

## 合并授权（2026-07-26）

结论: **授权** 源 `layout-chrome-split` → 目标 `main`，并授权合入后 **push** 至 origin（用户原话：「ok, 没有问题直接提交，合并，push」）。条件：Review Approve + QA Pass 均已满足。
- 2026-07-26: Merge Executor（qa `1f917b94-0be1-4211-9a5a-c198c8255df0`）本地 **fast-forward** 合入成功：`main` = `layout-chrome-split` = `7e99933`；**push 失败**（仓库无配置任何 remote / origin）。未提交 `.env`。父项归档：`workflow/archive/2026/layout-chrome-split/` → `workflow/archive/2026/layout-chrome-split/`；STATUS 活跃列表清空并记入归档区。

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

结论: **批准增量 Plan**（预授权续用）。Plan：`workflow/archive/2026/layout-chrome-split/plan.md`（T9–T14）。状态经 `planned` 立即进入 `developing`。

## Plan 确认预授权（2026-07-26）

结论: **预授权跳过 Plan 确认门禁**。来源用户原话：「全部 ok，planner 可以跳过审核，完成后直接开发设计」。Planner 产出后 Manager 可将状态置为 `planned` 并立即调度 Developer，无需再等用户确认 Plan。Review / QA / 合并授权**不**在此预授权范围内。

## Plan 用户确认（2026-07-26，预授权生效）

结论: **批准 Plan**（预授权）。Plan 路径：`workflow/archive/2026/layout-chrome-split/plan.md`（T1–T8，依据 design.md / ui-design.md）。状态经 `planned` 立即进入 `developing`。

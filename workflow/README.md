# Agent 工作流与文档索引

本文档是工作流、角色、门禁、状态和文档结构的唯一权威说明。`workflow/docs/manager/STATUS.md`、工作项记录、模板和角色指令仅保存执行所需信息，不得另行定义或复制完整流程。

路径占位符统一使用小写短横线格式的 `<feature-id>`。调度主键为 `(feature-id, sub-feature-id)`：未拆分时二者相同，产物直接落在 `workflow/docs/features/<feature-id>/`（无需子目录）；已拆分为多个子工作项时，根目录仅保留总览 `spec.md`，每个子工作项使用独立子目录 `workflow/docs/features/<feature-id>/<feature-id>-<sub-feature-id>/`，其内使用标准文件名（`spec.md`、`design.md`、`plan.md` 等）。禁止另建平级 feature 目录；禁止使用扁平的 `docs/plans/`、`docs/qa/` 或 `docs/prd/` 作为新产出根目录。

## 权威工作流

```text
Manager 登记工作项并判定路径与门禁
→ [Spec 门禁=required] Analyst 编写 Spec
→ [Spec 需要确认] 当前用户会话取得用户确认
→ [Design 门禁=required] Planner 编写 Design
→ Planner 编写 Plan
→ 当前用户会话取得 Plan 确认
→ Developer 实施并完成开发者验证
→ Reviewer 审阅
→ [Review 门禁=required] 取得 Approve 后进入 QA
→ QA 验收
  ├─ Fail：Developer 修复 → [Reviewer 复审] → QA 复测
  ├─ Blocked：记录原因和恢复条件并停止
  └─ Pass：当前用户会话取得合并授权 → Manager 将状态置为 done，并将未入库的 `review.md` / `qa-report.md` 与 STATUS **一次提交**（源分支）
→ 合入目标分支（本地 Merge Executor 或 GitHub PR 均可；不再为状态单独提交）
→ [全部切片 done 且用户要求关闭父项时] Manager 归档
```

**`done` 的含义：** 切片工作流已关闭——质量门禁已过，且用户已授权合入（或非 Git 下已授权完成）。**不表示**变更已出现在目标分支 tip。是否已合入以 git / PR 为准。

**Review / QA 报告提交时机（Git）：** QA `Pass` 后等待人工合并授权期间，**禁止**单独提交 `review.md` 与 `qa-report.md`（文件写在工作区即可，供父会话审阅）。用户授权后，Manager 在源分支**一次提交**中纳入：状态置 `done` 的 STATUS/工作项记录、以及尚未入库的 `review.md` 与 `qa-report.md`。合入后不得再为 STATUS 或报告单独提交。`Fail` / `Blocked` / Reviewer `Request changes` 退回修复时，可将报告与状态变更一并提交，以便修复链路有持久证据（见 [`workflow/docs/standards/git.md`](docs/standards/git.md)）。

用户确认门禁不得自动越过：

1. `full` 路径的 Spec 必须确认；
2. `standard` 路径中存在业务歧义的 Spec 必须确认；
3. 所有路径的 Plan 必须确认；
4. 所有路径的合并必须获得明确授权（授权后即可标 `done`，不必等合入完成）。

非 Git 工作区跳过提交与合并操作，但不得跳过适用的 Spec、Design、Plan、Review、QA 和归档门禁。
## 角色与职责

| 角色 | 职责 | 主要产物 | 不负责 |
|---|---|---|---|
| Manager | 登记工作项、判定门禁、调度角色、维护状态、关闭和归档 | `workflow/docs/manager/STATUS.md`、工作项记录 | Spec、Design、Plan、代码、测试报告、合并 |
| Analyst | 分析需求、定义行为合同和验收条件、编写 Spec | `spec.md` | 技术拆分、实现、状态维护 |
| Planner | 按需完成技术设计，编写实施与验证计划 | `design.md`、`plan.md` | 需求决策、实现、状态维护 |
| Developer | 依据已确认的 Plan 执行 TDD、实现、开发者验证和缺陷修复 | 代码、`dev-notes.md` | Spec、Plan、状态维护、合并 |
| Reviewer | 审阅实现、测试、文档和安全影响 | `review.md` | 实现、QA、状态维护、合并 |
| QA | 依据 Spec 和 Plan 执行独立验收与回归测试 | `qa-report.md` | 业务实现、状态维护 |
| Merge Executor | 在 QA Pass 且用户明确授权后执行合并 | 合并结果 | 质量验收、代码所有权、状态维护 |
| DevOps | 按需维护本地脚本及部署排障文档 | 脚本、`workflow/docs/deploy/` | CI/CD、Spec、Plan、状态维护、合并 |

默认由 QA 兼任受控 Merge Executor，但不因此承担代码所有权。仓库已有 Code Owner、Release Manager、受保护分支或其他合并规则时，以仓库规则指定的执行者为准。

仅 Manager 可以修改 `workflow/docs/manager/STATUS.md` 和工作项记录。其他角色只报告阶段结果，由 Manager 在调度后续角色前持久化状态。

## 路径等级

`fast`、`standard` 和 `full` 是本工作流的风险等级，不是行业标准术语。

| 等级 | 适用范围 | Spec | 用户确认 | Review |
|---|---|---|---|---|
| `fast` | 范围明确的单点修复 | 默认跳过 | Plan、合并 | 可在工作项记录中明确跳过 |
| `standard` | 常规功能、重构或接口变更 | 存在合同风险时必须 | Plan、合并；Spec 存在业务歧义时确认 | 必须 |
| `full` | 新能力、跨模块变更或范围未明确 | 必须 | Spec、Plan、合并 | 必须 |

Manager 登记工作项时必须记录路径等级，并分别判定 Spec、Design 和 Review 门禁。

## 门禁

### Spec 门禁

- `full` 必须编写 Spec；
- `standard` 在新增行为、公开接口、状态转换、错误约定或跨模块合同存在时必须编写 Spec；
- `fast` 默认跳过 Spec；
- Spec 必须由 Analyst 编写；
- `full` 的 Spec 必须由用户确认；
- `standard` 仅在工作项记录标注存在业务歧义时要求用户确认。

### Design 门禁

- 仅在模块边界、分层或技术选型需要决策时设为 `required`；
- API 形状、数据约束、错误约定和行为验收属于 Spec，不属于 Design；
- Design 必须由 Planner 在 Plan 之前编写；
- Design 门禁为 `required` 时，`design.md` 存在后才可进入 Plan 阶段。

### Plan 门禁

- Spec 门禁为 `required` 时，`spec.md` 必须存在；
- Plan 必须包含任务拆分、依赖、涉及路径、验证命令、最低验证层、Review 门禁和文档影响；
- 每个 Plan 均须用户确认；
- 仅在确认结果已持久化后，状态可以进入 `planned`。

### Review 门禁

- 实现完成后可直接调度 Reviewer；
- Review 门禁是进入 QA 的前置条件，不是调用 Reviewer 的前置条件；
- `standard` 和 `full` 进入 QA 前必须取得 `Approve`；
- `fast` 仅在工作项记录将 Review 门禁明确设为 `skipped` 时允许直接进入 QA；
- `Request changes` 必须返回 Developer 修复并重新审阅；
- `Comment` 不得包含阻塞项，否则必须使用 `Request changes`。

### QA 门禁

- QA 必须逐项核对 Spec 验收条件（如有）和 Plan 验证要求；
- 首次验收和回归测试必须按轮次追加到同一 `qa-report.md`；
- QA 结论仅允许 `Pass`、`Fail` 或 `Blocked`；
- `Fail` 必须登记缺陷，`Blocked` 必须登记原因和恢复条件；
- 未取得 `Pass` 时不得请求合并授权。

### Merge 门禁

- QA 报告必须为 `Pass`；
- 当前用户会话必须取得明确合并授权；
- Git 工作区必须记录源分支和目标分支，并满足 [`workflow/docs/standards/git.md`](docs/standards/git.md)；
- **实现必须发生在独立工作分支上**；禁止在 `main`/`master`/`release/*` 上直接实施后合并；
- 用户授权后，Manager 在**源分支**将状态置为 `done`，并与未入库的 `review.md` / `qa-report.md` **一次提交**（随功能一并合入）；**禁止**在待合并授权期间单独提交上述报告；**禁止**为「合入后再改 STATUS」再开目标分支提交；
- 合入可由受权 Merge Executor 本地执行，或由用户在 GitHub 上合并 PR；合入本身不再触发 STATUS 变更；
- 合入失败时进入 `blocked`（可从 `done` 转入），记录原因与恢复条件；不得归档父项。

## 状态机与回退

完整状态集：

```text
backlog
→ speccing
→ awaiting-spec-approval
→ designing
→ planning
→ awaiting-plan-approval
→ planned
→ developing
→ reviewing
→ qa
→ done
```

旁支状态：`blocked`、`cancelled`。历史状态名 `awaiting-merge` 已废弃；勿再写入新记录。

**`done`：** 工作流关闭（QA Pass + 合并/完成授权已持久化）。是否已在目标分支以 git/PR 判定，不以 STATUS 为准。

状态转换规则：

- 跳过 Spec：`backlog → designing | planning`；
- Spec 无需用户确认：`speccing → designing | planning`；
- Spec 需要用户确认：`speccing → awaiting-spec-approval`；
- 用户确认 Spec：`awaiting-spec-approval → designing | planning`；
- 跳过 Design：`backlog | speccing | awaiting-spec-approval → planning`；
- Plan 编写完成：`planning → awaiting-plan-approval`；
- Plan 确认并持久化：`awaiting-plan-approval → planned`；
- `fast` 且 Review 门禁为 `skipped`：`developing → qa`；
- QA `Pass` 后请求合并授权（此时不提交 `review.md` / `qa-report.md`）；用户授权并持久化后：`qa → done`（在源分支**一次提交**更新 STATUS/工作项并纳入未入库的报告）；
- 合入失败：`done → blocked`（或保持 `done` 并记阻塞笔记，由 Manager 择一写清）；
- 任一活动状态可进入 `blocked`，恢复后进入工作项记录指定的目标状态；
- 用户取消工作项时进入 `cancelled`。

QA 失败必须形成闭环：

```text
QA Fail
→ Manager: qa → developing
→ Developer 修复并更新 dev-notes.md
→ [Review 门禁=required] Reviewer 复审并取得 Approve
→ Manager: reviewing 或 developing → qa
→ QA 在 qa-report.md 追加回归轮次
→ Pass | Fail | Blocked
```

每个缺陷必须记录唯一标识、严重程度、状态、处理说明和验证证据。Developer 必须给出建议复测范围；`standard` 和 `full` 的修复必须重新取得 Reviewer `Approve`；QA 必须复测失败项和受影响的回归范围。循环持续至 `Pass`、`Blocked` 或用户取消。

## 独立上下文与用户汇报

Manager、Analyst、Planner、Developer、Reviewer、QA 和 DevOps 在独立上下文中运行。角色之间仅通过以下持久化介质交接：

- 工作区变更；
- Git 提交或 Pull Request（仓库可用时）；
- `workflow/docs/features/<feature-id>/` 中的文档；
- 工作项记录和 `workflow/docs/manager/STATUS.md`。

当前用户会话是唯一用户交互入口。Manager 必须从持久化文档恢复输入和状态，不得依赖其他角色的会话记忆，不得直接向用户请求确认，也不得越过用户确认门禁。

默认采用单步编排：Manager 完成一个编排步骤后返回。用户明确授权完整流程时，Manager 可以连续调度，直到步骤完成、进入 `blocked` 或到达用户确认门禁。

Manager 必须使用以下返回格式：

```text
工作项: <feature-id>
当前状态: <state>
本次操作: <action>
产出文件: <paths>
门禁结果: pass | blocked | awaiting-user
待用户确认: none | spec | plan | merge | question
阻塞信息: none | cause + recovery condition
后续步骤: <role/action>
```

当前用户会话只向用户汇报可验证的操作、文件、状态、门禁、阻塞信息和待确认事项。

## 文档结构

```text
workflow/
  README.md
  agents/             # 角色定义
  skills/             # 技能定义
  docs/
    standards/        # documentation | git | quality | security | ui
    manager/
      STATUS.md
      <feature-id>.md   # 仅活跃工作项
    features/<feature-id>/
      spec.md         # 未拆分：完整 Spec；已拆分：仅总览索引
      …               # 未拆分时 design / ui-design / plan / … 也在根目录
      <feature-id>-<sub-feature-id>/   # 已拆分：每切片一目录，标准文件名
    _templates/       # 含 ui-design.md 等
    archive/YYYY/<feature-id>/
      manager.md      # 原 manager/<feature-id>.md
      …               # 原 features/<feature-id>/ 内容（若有）
```

Manager 登记工作项时创建 `workflow/docs/features/<feature-id>/`。其他角色不得创建使用不同标识的工作项目录。

### feature-id 与 sub-feature-id

- **feature-id**：工作项目录与归档单位，对应 `workflow/docs/features/<feature-id>/` 与 `workflow/docs/manager/<feature-id>.md`。
- **sub-feature-id**：可调度切片。不需要拆分时与 `feature-id` 相同，产物直接写在 `workflow/docs/features/<feature-id>/`（`spec.md` 等），**不**再建子目录。
- 需要拆分时：根目录仅保留总览 `spec.md`（此时总览行的 `sub-feature-id` 可与 `feature-id` 相同）；每个子工作项一个目录 `workflow/docs/features/<feature-id>/<feature-id>-<sub-feature-id>/`，目录内使用标准文件名（`spec.md`、`design.md`、`plan.md` 等），STATUS 为同一 `feature-id` 下的多行。
- `workflow/docs/manager/STATUS.md` 活跃表必须包含 `feature-id` 与 `sub-feature-id` 列。同一 `feature-id` 的后续行可省略重复的 `feature-id`；「目录」列在已拆分时应指向各子目录（不可省略为继承总览根目录）。空 `feature-id` 表示继承上一非空值。换 feature 时必须再写一次 `feature-id`。

### 工程规范索引

工程规范采用 Docs as Code，与相关代码同仓库、同分支、同审阅并同步演进。所有工作项必须遵循以下规范：

| 规范 | 文档 | 适用内容 |
|---|---|---|
| 文档工程 | [`workflow/docs/standards/documentation.md`](docs/standards/documentation.md) | 文档分类、主责、质量、审阅和生命周期 |
| Git 协作 | [`workflow/docs/standards/git.md`](docs/standards/git.md) | 分支、提交、Pull Request、合并和回滚 |
| 质量与验证 | [`workflow/docs/standards/quality.md`](docs/standards/quality.md) | 开发者验证、测试层级、静态检查和完成定义 |
| 安全 | [`workflow/docs/standards/security.md`](docs/standards/security.md) | 敏感信息、依赖、认证授权和安全审阅触发条件 |

每个 Plan 必须说明开发文档、用户文档和运维文档的影响及更新路径；不适用时必须标记 `N/A` 并说明理由。测试或检查无法执行时，必须记录原因、风险和恢复条件。

## 工作项记录

`workflow/docs/manager/<feature-id>.md` 至少包含：

```text
工作项标识:
描述:
路径等级: fast | standard | full
源分支:
目标分支:
文档影响:
```

未拆分时，同一文件还须包含该 `(feature-id, sub-feature-id)` 的门禁与状态字段（`sub-feature-id` 等于 `feature-id`）：

```text
sub-feature-id: <与 feature-id 相同>
Spec 门禁: required | skipped（理由）
Spec 用户确认: required | not-required | approved | rejected
Design 门禁: required | skipped（理由）
Review 门禁: required | skipped（理由；仅 fast）
状态:
后续步骤:
阻塞原因:
恢复条件:
恢复后的目标状态:
```

已拆分为多个 sub-feature 时，上述门禁与状态按切片维护（表格或分节均可），并与 `STATUS.md` 各行对齐。

## 关闭与归档

切片级关闭：QA `Pass` 且用户明确授权合并（或非 Git 下授权完成）后，Manager 在源分支将状态置为 `done`，并与未入库的 `review.md` / `qa-report.md` **一次提交**。此后允许合入；**合入完成后不再改 STATUS 或补交报告**。

Manager 仅在以下情况归档**整个**工作项（移动 `workflow/docs/features/<feature-id>/`）：

1. 各适用切片均为 `done`，且用户明确要求关闭/归档父项（建议同时核验目标分支已包含各切片实现）；
2. 用户明确取消并将状态更新为 `cancelled`。

归档步骤：

1. 从 `workflow/docs/manager/STATUS.md` 的活跃列表移除工作项；
2. 将 `workflow/docs/features/<feature-id>/` 移动到 `workflow/docs/archive/YYYY/<feature-id>/`；
3. 在 STATUS 的归档区域记录工作项标识、最终状态和目录链接；
4. 仓库可用时提交归档变更（可在目标分支或专门 chore 分支；与功能合入解耦）。

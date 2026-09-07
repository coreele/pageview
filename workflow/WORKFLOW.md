# WORKFLOW — Agent 工作流权威定义

本文件是流程、状态、角色与门禁的**唯一权威**。其他文件只写各自的执行细则，不复制流程；冲突以本文件为准。

## 1. 目录约定

[agents/](agents/) 是工作流机制，几乎不变，只有用户改；其余是工作产出，随工作项增长。

```text
workflow/
  WORKFLOW.md            本文件，流程权威
  STATUS.md              看板
  agents/                机制
    agents/              角色定义
    skills/              技能定义
    standards/           工程规范
    templates/           文档模板
    tools/wf-check.py    一致性校验
  workspace/<id>/        活跃工作项
  archive/<年>/<id>/     已归档工作项
  audit/                 代码审计报告与登记册（流程外）
  ops/                   运维与排障文档（流程外）
```

| 产出路径 | 谁可写 |
|---|---|
| [STATUS.md](STATUS.md)、[archive/](archive/) | Manager |
| `workflow/workspace/<id>/` | 见 §4 角色表 |
| [audit/](audit/) | `code-audit` |
| [ops/](ops/) | DevOps |

用词约定：本文档用「工作树」指 Git 中未提交的本地改动，与目录 `workflow/workspace/` 无关，二者不要混。

**工作项标识 `<id>`**：小写短横线，全局唯一。它同时是调度主键、目录名和建议分支名。每个工作项独立登记、独立走完整流程；不设父项 / 子项，也不用总览项索引其他工作项。范围过大时登记为多个独立 `<id>`，彼此无隶属关系。

**一个工作项 = 一个目录**：

```text
workflow/workspace/<id>/
  main.md        工作项记录（Manager 维护）
  spec.md        Spec 门禁 required 时
  design.md      Design 门禁 required 时
  ui-design.md   按需
  plan.md        必需
  dev-notes.md   必需
  review.md      Review 门禁 required 时
  qa-report.md   必需
```

产物平铺在该目录：禁止子目录，禁止版本后缀（`plan-v2.md`），禁止另建平级目录。归档就是把整个目录移到 `workflow/archive/<年>/<id>/`。

### 路径写法

按引用位置选形式。两种形式 `wf-check` 都会校验，链接腐烂与路径失效都能被抓到。

| 引用位置 | 形式 | 示例 |
|---|---|---|
| 本文件、STATUS.md → 机制文件 | 链接，文本与目标同为相对路径 | `[agents/standards/git.md](agents/standards/git.md)` |
| 机制文件互引 | 链接，文本用文件名 | `[quality.md](../standards/quality.md)` |
| 含 `<id>` 的工作项产物路径 | 反引号写相对仓库根的路径 | `` `workflow/workspace/<id>/plan.md` `` |
| 模板内指向机制文件 | 反引号写相对仓库根的路径 | `` `workflow/agents/standards/quality.md` `` |

后两类不用链接是有原因的：`<id>` 是待替换的占位符，做成链接必然指向不存在的文件；模板会被复制进工作项、之后随归档再移一层，相对深度前后变两次，而写相对仓库根的路径与文件自身位置无关，归档后依然正确。

## 2. 主流程

```text
Manager 分配 id → [Git] 从目标基线创建并检出源分支
  → 登记工作项 → 判定路径等级与门禁
  → [Spec required]   Analyst   → spec.md → [需确认] 用户确认
  → [Design required] Planner   → design.md
  → [UI 按需]         Planner   → ui-design.md
  →                   Planner   → plan.md
  → Manager 第一阶段提交（预开发文档，仅一次）
  →                   Developer → 实施 + 自验 + 同步目标分支 + 代码提交（可多次）+ dev-notes.md
  →                   Reviewer  → review.md
  →                   QA        → qa-report.md
  → 用户授权合并 → Manager 置 done 并第三阶段提交 → 合入 → Manager 归档
```

QA `Fail` 闭环：Developer 修复并在同一 `dev-notes.md` 追加回执 → Review 门禁为 `required` 时须重新 `Approve` → QA 在同一 `qa-report.md` 追加回归轮次。循环至 `Pass`、`Blocked` 或用户取消。

## 3. 状态机

| 状态 | 含义 | 出口 |
|---|---|---|
| `backlog` | 已登记，未开始 | → `speccing` \| `designing` \| `planning` |
| `speccing` | Analyst 编写 Spec | → `spec-approval`（需确认）\| `designing` \| `planning` |
| `spec-approval` | **等用户确认 Spec** | 通过 → `designing` \| `planning`；驳回 → `speccing` |
| `designing` | Planner 编写 Design | → `planning` |
| `planning` | Planner 编写 Plan | → `developing` |
| `developing` | Developer 实施与自验 | → `reviewing`；Review=`skipped` 时 → `qa` |
| `reviewing` | Reviewer 审阅 | `Approve` → `qa`；`Request changes` → `developing` |
| `qa` | QA 验收 | `Pass` → `merge-approval`；`Fail` → `developing`；`Blocked` → `blocked` |
| `merge-approval` | **等用户授权合并** | 授权 → `done`；暂缓 → 保持；用户取消 → `cancelled` |
| `done` | 已授权关闭，待合入或已合入 | 合入确认 → `archived`；合入失败 → `blocked` |
| `archived` | 已归档，终态 | — |
| `blocked` | 阻塞，须记录原因与恢复条件 | → 记录中「恢复后目标」 |
| `cancelled` | 用户取消，终态（仍须归档记录） | → `archived` |

两个状态名以 `-approval` 结尾，含义固定为「流程停住，等用户回话」，看板据此单列一栏。

`Comment` 结论若含阻塞项，按 `Request changes` 处理。

### 3.1 回退

上游产物不足时不得硬撑，由 Manager 执行回退并在 `main.md` 进度笔记记录触发原因：

| 触发 | 转换 |
|---|---|
| 实施中发现 Plan 需重写或范围须扩大 | `developing → planning` |
| 发现 Spec 合同缺失或歧义 | `designing` \| `planning` \| `developing` → `speccing` |
| 结构选型被推翻 | `planning` \| `developing` → `designing` |
| QA 后必须 rebase，仅 ancestry / SHA 变化且文件树不变 | `merge-approval` \| `done` → `qa`（补验证并让 QA 记录新 SHA） |
| QA 后必须 rebase，发生冲突或文件树变化 | `merge-approval` \| `done` → `developing`（重新自验、Review、QA 与合并授权） |
| 任意活动态遇外部阻塞 | → `blocked` |

`blocked` 只用于外部原因（环境、权限、依赖、基础设施）；上游产物不足属于回退，不是阻塞。

### 3.2 门禁重判

Manager 可在任意活动态调整路径等级与 Spec / Design / Review 门禁，须在进度笔记记录日期、原值、新值与理由。其他角色一律不得重判，只能停止并报告。

## 4. 角色

| 角色 | 产物 | 可写 | 明确不做 |
|---|---|---|---|
| Manager | `main.md`、`STATUS.md` | 记录与看板 | 写 Spec/Design/Plan/代码/报告；执行合并 |
| Analyst | `spec.md` | 需求与行为合同 | 技术拆分、实现、状态 |
| Planner | `design.md`、`ui-design.md`、`plan.md` | 技术设计与计划 | 需求决策、实现、状态 |
| Developer | 代码、`dev-notes.md` | 实现与自验 | Spec/Plan、状态、验收结论 |
| Reviewer | `review.md` | 审阅结论 | 改代码、QA 结论、状态 |
| QA | `qa-report.md` | 验收结论 | 改代码、状态；默认兼任受控 Merge Executor |
| DevOps | [ops/](ops/) 下脚本与运维文档 | 按需支持 | 流程内任何门禁与状态 |

- **只有 Manager** 写 `STATUS.md` 与 `main.md`；其他角色报告结果，由 Manager 持久化。
- **只有 Developer** 提交代码；**工作流文档由 Manager 按 §6 三阶段提交**，状态先写入工作树。
- 产出角色在独立上下文运行，仅通过工作树文件、Git 与 `workflow/workspace/<id>/` 交接，完成即返回，不得在子会话内阻塞等用户回话。
- DevOps 不在状态机内：按需调度，不改变工作项状态，不作验收结论。

### 4.1 看板作用域与并行

`STATUS.md` 是**当前 Git 分支 / 工作树的看板视图**，不是跨分支的全局数据库。一个 Git 工作树同一时间只推进一个工作项；并行工作项必须使用独立 `git worktree`，每个 worktree 检出各自源分支并维护自己的 STATUS 视图。跨分支全局汇总应交给 Issue / PR 系统，不在本地 Markdown 看板中伪装实现。

## 5. 路径等级与门禁

路径等级按工作项判定并写入 `main.md`。

| 等级 | 适用 | Spec | Design | Review |
|---|---|---|---|---|
| `fast` | 范围明确的单点修改 | 默认 `skipped` | 默认 `skipped` | 可 `skipped` |
| `standard` | 常规功能、重构、接口变更 | 有合同风险时 `required` | 有结构决策时 `required` | `required` |
| `full` | 新能力、跨模块、范围未明 | `required` | 通常 `required` | `required` |

**无条件必需，任何等级都不得跳过：** `plan.md`、`dev-notes.md`、`qa-report.md`。

| 门禁 | 规则 |
|---|---|
| Spec | `full` 必须；`standard` 在涉及新增行为、公开接口、状态转换、错误约定或跨模块合同时必须。仅 Analyst 编写。 |
| Design | 仅当模块边界、分层或技术选型需要决策时 `required`；`required` 时须先有 `design.md` 再进 Plan。API 形状、数据约束、错误约定属 Spec，不属 Design。 |
| UI Design | 非门禁。范围含用户可见界面且存在信息架构、布局或交互决策时产出；跳过时 Plan 元信息「依据 UI」标 `N/A`。 |
| Plan | Spec 为 `required` 时须先有 `spec.md`。必含内容见 [agents/templates/plan.md](agents/templates/plan.md)，缺项 Developer 不得开工。 |
| Review | 实现完成即可调度 Reviewer；Review 门禁是**进入 QA** 的前置条件，不是调用 Reviewer 的前置条件。`standard`/`full` 进 QA 前须 `Approve`；`fast` 仅当记录标 `skipped` 时可直进 QA。 |
| QA | 逐项核对 Spec 验收与 Plan 验证；结论仅 `Pass`/`Fail`/`Blocked`；多轮追加到同一 `qa-report.md`。非 `Pass` 不得请求合并授权。 |
| Merge | 见 §6。 |

## 6. Git

细则见 [agents/standards/git.md](agents/standards/git.md)，要点：

1. **先分支、后产出**：Manager 分配 `<id>` 并确定目标分支后，须在创建 `main.md`、更新 STATUS 或调度任何产出角色**之前**，从明确的目标基线创建并检出独立源分支；记录目标分支、源分支与基线提交 SHA。禁止把工作项产物暂存在目标分支工作树，等 Developer 再建分支。
2. **创建责任**：Manager 创建并检出源分支；Developer 只验证当前分支与记录一致，不得临时另建或改选基线。源分支名默认即 `<id>`，每个工作项独占一个分支。
3. **提交责任**：Developer 提交代码与测试（及 Plan「文档影响」中的产品文档）；`workflow/` 下产物一律由 Manager 提交。产出角色把文件留在工作树并报告即可。
4. **提交时机**：源分支上标准只有三次窗口——预开发文档一次、代码若干次、关闭文档一次。禁止每次状态推进都提交。细则见 [git.md](agents/standards/git.md) §3。
5. **验收前同步**：Developer 完成实现后、进入最终 Review / QA 前，须把源分支同步到最新目标分支并重新自验；Reviewer 与 QA 必须记录同步后的提交。
6. **验收后目标移动**：QA Pass 后若目标分支移动但源分支仍可直接 fast-forward，则直接合入；若必须 rebase，即使文件树不变也须补验证并让 QA 记录新 SHA。发生冲突或文件树变化时回到 `developing`，重新 Review、QA 与合并授权。禁止合入 QA 未记录的提交。
7. **合入**：默认 rebase + fast-forward，禁止 merge commit（除非用户明确授权）。
8. 非 Git 仓库跳过分支、提交与合并，其余门禁一律不跳过。

**合并门禁**须同时满足：QA 最新结论为 `Pass`；用户已明确授权；`main.md` 已记录目标分支、源分支与基线提交；实现位于该源分支；QA 报告记录的提交与待合入提交一致；工作项已为 `done`。合入本身不改状态。

## 7. 需要用户的两处

| 事项 | 何时 | 状态 |
|---|---|---|
| Spec 确认 | `full`；或 `standard` 且存在业务歧义 | `spec-approval` |
| 合并授权 | 所有路径 | `merge-approval` |

除此之外，Design、Plan、实施、Review、QA 阶段一律连续推进，不停下来问用户。

Manager 不直接与用户对话：把待确认事项写进返回结构的「待用户确认」字段，由当前用户会话去问；用户答复后再调度 Manager 持久化。非门禁的澄清（命名、取舍）走同一通道，标为 `question`，不改变状态。

## 8. 关闭与归档

**`done`** = QA `Pass` + 用户已授权合并（或非 Git 下授权完成）。表示流程关闭，**不表示**已在目标分支上；合入以 Git 为准。

**`archived`** = `done` 且已确认合入（非 Git 下为授权完成），或用户取消为 `cancelled`。归档不需要用户再次批准——合并授权已包含关闭意图。无法确认合入时保持 `done` 停在看板「待归档」栏。

归档步骤：

1. 把 `workflow/workspace/<id>/` 整个目录移到 `workflow/archive/<年>/<id>/`；
2. 在 `main.md` 状态表写 `archived`；
3. 在 `STATUS.md` 中把该项从活跃泳道移到归档索引；
4. 提交归档变更。

完成后 `workflow/workspace/<id>/` 不得残留。

## 9. Manager 返回格式

```text
工作项: <id>
当前状态: <state>
本次操作: <action>
产出文件: <paths | none>
门禁结果: pass | blocked | awaiting-user
待用户确认: none | spec | merge | question
阻塞信息: none | <原因 + 恢复条件>
后续步骤: <role/action>
```

只报告可由文件、Git 结果或验证证据支持的事实。

## 10. 规范与工具索引

| 用途 | 文件 |
|---|---|
| 分支、提交、合并、回滚 | [agents/standards/git.md](agents/standards/git.md) |
| 验证层级与完成定义 | [agents/standards/quality.md](agents/standards/quality.md) |
| 敏感信息、依赖、安全审阅触发 | [agents/standards/security.md](agents/standards/security.md) |
| 文档分类主责与产物整理 | [agents/standards/documentation.md](agents/standards/documentation.md) |
| 代码审计条款（流程外） | [agents/standards/code-audit.md](agents/standards/code-audit.md) |
| 一致性校验 | `python3 workflow/agents/tools/wf-check.py` |

`code-audit` 在本工作流之外，不进状态机，产物写入 [audit/](audit/)。

关闭工作项前和两阶段文档提交前应运行 `wf-check`，它校验目录结构、状态枚举、必需产物、分支约束、路径引用与看板一致性。

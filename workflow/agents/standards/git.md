# Git 规范

仅在仓库是 Git 仓库时生效。非 Git 仓库跳过分支、提交与合并，其余门禁一律不跳过。

流程门禁以 [WORKFLOW.md](../../WORKFLOW.md) 为准，本文件只补 Git 机制。

## 1. 工作分支

**任何工作项文件产生之前必须已有独立源分支。** 禁止先在目标分支创建记录、Spec、Plan 或实现，再等 Developer 建分支。

1. Manager 在内存中分配 `<id>`，确定**目标分支**（默认 `main`）与**源分支**；源分支名默认即 `<id>`，必要时可为 `<id>-<简短描述>`。
2. 创建前确认：目标分支存在；源分支名未被其他工作项占用；工作树没有无关修改；远程目标需要更新时已 fetch。
3. Manager 从明确的目标分支提交创建并检出源分支，记录该提交为**基线提交**。不得用含未提交修改的 `git switch -c` 把其他工作带进新分支；无法获得干净工作树时停止，或使用独立 `git worktree`。
4. 分支就绪后，Manager 才创建 `workspace/<id>/main.md`、更新 STATUS 并调度 Analyst / Planner。登记与后续预开发文档先留在工作树，不单独提交。
5. Developer 不创建或改选源分支；开工前只验证当前分支、目标分支、源分支与基线记录一致，不满足就停止并报告 Manager。
6. 每个工作项独占一个源分支。一个 Git worktree 同时只推进一个工作项；并行工作使用不同 worktree。

## 2. 提交责任

| 内容 | 谁提交 |
|---|---|
| 实现代码与测试 | Developer |
| `main.md`、`STATUS.md`、`spec.md`、`design.md`、`ui-design.md`、`plan.md`、`dev-notes.md`、`review.md`、`qa-report.md` | **Manager** |
| 审计报告与登记册 | 执行 `code-audit` 的会话 |

产出角色一律把文档留在**当前源分支的工作树**并报告，不执行 `git add` / `commit` / `push`。Manager 只在 §3 规定的窗口提交；提交前确认当前分支与 `main.md` 一致，且该提交不含代码或无关修改。

状态推进写入工作树即可，**不等于** git 提交。

## 3. 提交时机（三阶段）

标准路径在源分支上只有两类提交：Manager 的**两次**工作流文档提交，加上 Developer 的**若干**代码提交。禁止按状态机每走一步就提一次文档。

| 阶段 | 何时 | 谁 | 提交什么 |
|---|---|---|---|
| **一、预开发文档** | Plan 齐备、即将调度 Developer（状态进入 `developing`） | Manager | **一次**：`main.md`、STATUS、已产出的 `spec.md` / `design.md` / `ui-design.md` / `plan.md` |
| **二、实现** | 实施与修复期间 | Developer | **可多次**：代码、测试，以及 Plan「文档影响」中的开发/用户/运维文档。不含 `workflow/` 下工作流产物 |
| **三、关闭文档** | QA `Pass` 且用户已授权合并（置 `done`） | Manager | **一次**：`done` 状态、STATUS、`dev-notes.md`、`review.md`（若有）、`qa-report.md`，以及仍留在工作树的其他工作流文档 |

第一阶段之前：登记、Spec 确认、Design、Plan 全部在工作树推进，不提交。

第二、三阶段之间：Review、QA、`Fail` / `Request changes` 回环、目标分支同步证据，一律追加到工作树中的同一批文件，不另开文档提交。

合入后的归档（把目录移到 `archive/`、更新 STATUS）在目标分支上另作一次治理提交，不算源分支上的第四次琐碎提交。

**允许额外文档提交的例外（仍须整批、说得清，禁止拆成状态日记）：**

- 必须离开本工作树或把未提交工作流文档交给另一个 worktree；
- 用户取消：一次提交 `cancelled` 及相关记录后归档；
- 第一阶段文档已入库后发生回退且改动必须让 Developer 看到已入库版本——优先把改动留到第三阶段；只有无法等到关闭时才允许再提一次预开发文档。

禁止：登记单独提交；Spec / Design / Plan 各提一次；每次状态变更提交；`review.md` 与 `qa-report.md` 在授权前单独提交；为 `dev-notes.md` 或同步证据单独提交。

## 4. 提交信息

```text
<type>(<scope>): <subject>

<body>
```

- **type**（必须，小写）：`feat` `fix` `docs` `refactor` `test` `chore` `perf` `build` `ci`。
- **scope**（可选，小写）：受影响模块名，取自本仓库实际模块划分；工作流与流程文档统一用 `workflow`，审计用 `audit`。
- **subject**（必须）：祈使语气、小写开头、无句号、≤72 字符，说清改了什么，不写 `update code` 这类空话。
- **body**（可选）：解释**为什么**（动机、根因、取舍），不复述 diff。

工作流文档提交只用两次固定句式，不写中间态：

- 第一阶段：`docs(workflow): <id> ready for developing`
- 第三阶段：`docs(workflow): <id> -> done (qa pass, merge authorized)`
- 取消：`docs(workflow): <id> -> cancelled`
- 归档：`docs(workflow): <id> -> archived`

代码提交按变更本身选 type/scope，不要用 `docs(workflow)` 记录实现。

**禁止**：提交信息含凭据或可还原密钥；`WIP` / `misc` / `fix bug` 类无信息 subject；一个提交混入多个无关 type 或 scope；用一连串 `docs(workflow): <id> -> <state>` 当流水账。

## 5. 代码与文档分提

代码与工作流文档**分提交、不混装**。Developer 的提交只含实现、测试、紧耦合资源，以及 Plan「文档影响」里的产品文档；`workflow/` 下产物只出现在 Manager 的第一、第三阶段（或 §3 例外）。不要为了「先代码后文档」在第二阶段再插一次 `dev-notes` 提交。

## 6. 禁止入库

密钥、令牌、证书私钥；真实连接字符串；`.env` 及同类本地环境配置（用 `.env.example` 模板）；构建产物；IDE 临时文件与个人配置（须在 `.gitignore` 排除）。

## 7. 同步、验收与合入

禁止向 `main`、`master`、`release/*` force push，禁止在其上直接实施。

### 7.1 最终验收前同步

Developer 完成实现后、进入最终 Review 前：

1. Developer 先把待入库的代码与测试提交完毕并报告“待同步”。`dev-notes.md` 与其他工作流文档留在工作树，Manager **不**为此提交；
2. rebase 需要干净工作树时，**显式**暂存工作流路径（如 `git stash push -- workflow/`），禁止 autostash，禁止把代码与文档塞进同一个 stash；
3. fetch（如有）并把源分支 rebase 到最新目标分支；
4. 发生冲突时按文件所有权处理：Developer 只解决代码、测试及紧耦合资源；`main.md`、STATUS 与其他工作流文档由 Manager 解决。任一方无法确认语义时停止并交用户决策，不得用 `ours` / `theirs` 整体覆盖；
5. 恢复暂存的工作流文档，重新执行 Plan 要求的验证，在 `dev-notes.md` 追加目标分支提交、同步后源分支 HEAD、冲突处理与验证证据；
6. 同步证据仍留在工作树，由 Manager 把状态推进到 `reviewing`，文档等到第三阶段再提交。

Reviewer 与 QA 必须以同步后的提交为对象，并分别在报告中记录完整或足以唯一识别的提交 SHA。

### 7.2 QA 后目标分支移动

- QA Pass 后目标分支虽有新提交，但待合入源分支仍可直接 fast-forward：无需改写源分支，可直接合入。
- 若必须再次 rebase，且旧 QA 提交与新 HEAD 的文件树完全一致（仅 ancestry / SHA 变化）：重新运行最低必要验证，QA 在报告追加同步轮次并记录新 HEAD 后，才可请求合入。
- 若 rebase 发生冲突、改变提交内容或文件树：状态回到 `developing`，重新自验、Review、QA 与合并授权。禁止把未验收版本直接合入。

### 7.3 合入策略

默认保持线性历史：源分支已基于最新目标且验证通过后，fast-forward 合入；禁止 merge commit（除非用户明确授权保留）。

源分支若已包含其他已合入分支的提交，只 rebase 尚未在目标上的独有提交（如 `git rebase --onto <目标> <公共祖先> <源分支>`），避免重复提交。

出现以下情形停止合并并交回 Manager 与用户决策：无法 fast-forward 且 rebase 不可行或未获授权改写历史；冲突无法在不破坏工作项范围下安全解决；分支保护规则冲突；用户要求保留 merge commit。

源分支已推送或已被他人使用时，rebase 会改写共享历史：须先取得仓库政策或用户授权，更新远程只能使用 `--force-with-lease`；禁止普通 `--force`，永远禁止强推目标分支。

## 8. 合入后清理

确认目标分支已含实现后删除源分支（本地 `git branch -d <源分支>`；远程分支存在时再 `git push origin --delete <源分支>`）。归档工作项前应完成清理，避免已合入分支长期堆积。

归档发生在目标分支已含实现之后，属于治理文档变更：仓库允许时可提交到目标分支；目标分支受保护时使用独立 docs 分支 / PR。

## 9. 回滚

已共享的历史用新的 revert 提交或 revert PR 回滚，保留完整记录。禁止用破坏性 `reset` + force push 回滚已推送或已被他人基于其工作的提交。本地未推送的提交可用 `reset`。

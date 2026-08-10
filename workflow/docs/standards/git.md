# Git 协作规范

## 目的与适用范围

本规范规定分支、提交、Pull Request、合并和回滚要求。

**主责角色：** Manager（工作项与分支策略）、Developer（创建工作分支、提交与 Pull Request）、Merge Executor（受权合并）。

**生效条件：** 本规范仅在工作区是 Git 仓库时生效。非 Git 工作区须跳过提交与合并操作，但不跳过 Spec、Plan、Review、QA 和归档门禁。

## 1. 工作分支

### 1.1 必须新建分支

**实现（Developer 开始写代码/测试）之前，必须先有独立工作分支。** 禁止在 `main`、`master` 或 `release/*` 上直接实施功能或缺陷修复。

流程：

1. Manager 在调度 Developer 前，于工作项记录填写 **目标分支**（默认 `main`）与 **源分支**（拟创建的工作分支名）；
2. Developer 自目标分支创建并检出源分支；若源分支已存在则检出并确认基于正确目标；
3. 全部实现、修复、相关文档与**工作流关闭后的 STATUS/`done` 更新**均发生在该源分支上；
4. QA `Pass` 且用户明确授权后，Manager 在源分支将状态置为 `done`，并将尚未入库的 `review.md` / `qa-report.md` 与 STATUS/工作项记录**一次提交**；随后由 Merge Executor 或 GitHub PR 将源分支合入目标分支。合入后不得再为 STATUS 或报告单独提交。

已拆分为 `(feature-id, sub-feature-id)` 时：每个进入实施的切片使用**独立**工作分支，不得多个切片共用同一功能分支，也不得与其他工作项共用。

### 1.2 命名

分支名称须包含工作项标识；有切片时须包含 `sub-feature-id`：

```text
<feature-id>
<feature-id>-<简短描述>
<feature-id>-<sub-feature-id>
<feature-id>-<sub-feature-id>-<简短描述>
```

示例：`ggtest-core-parser`、`ggtest-core-normalize`。

### 1.3 职责划分

| 角色 | 职责 |
|---|---|
| Manager | 登记时或调度 Developer 前声明目标分支与源分支名；用户授权合并后在**源分支**将状态置 `done`，并与未入库的 `review.md` / `qa-report.md` **一次提交** |
| Developer | 创建/检出工作分支后方可实施；禁止在受保护分支上直接提交实现 |
| Merge Executor | 仅在授权且 STATUS 已为 `done` 后合并源分支 → 目标分支（或用户经 GitHub 合并）；不负责改 STATUS |
| Reviewer / QA | 将 `review.md` / `qa-report.md` 写入切片目录；**不负责**对这些报告做 Git 提交（交由 Manager 按时机提交） |

### 1.4 Review / QA 报告的提交时机

| 时机 | 是否提交 `review.md` / `qa-report.md` |
|---|---|
| Reviewer 写出结论、进入 `qa` 等待验收 | **否**（工作区保留即可；Manager 可将 STATUS 推进到 `qa`，但不得把报告一并提交仅为「进 QA」） |
| QA `Pass`、等待人工合并授权 | **否**（父会话审阅工作区报告；禁止为「QA 结束」单独提交报告） |
| 用户授权合并 / 关闭 | **是**：与 STATUS/`done`、工作项记录**一次提交** |
| QA `Fail` / `Blocked`，或 Reviewer `Request changes`（退回修复） | **可以**与状态回退一并提交，使修复链路有持久证据 |

禁止在「QA Pass 待人工审核」窗口内单独提交报告后又为 `done` 再开第二次纯文档提交。

## 2. 提交规范

提交须保持原子性：每次提交对应单一逻辑变更，便于审阅与回滚。授权关闭时「STATUS/`done` + 未入库 review/qa 报告」视为同一逻辑关闭变更，允许同一次提交。

提交信息须遵循仓库既有规范；无既有规范时采用 [Conventional Commits](https://www.conventionalcommits.org/)：

```text
<type>(<scope>): <subject>

<body>
```

常见 `type`：`feat`、`fix`、`docs`、`refactor`、`test`、`chore`。

## 3. 禁止提交的内容

禁止将以下内容纳入版本控制或提交记录：

- 密钥、令牌、证书私钥；
- 真实连接字符串（含生产或预发凭据）；
- `.env` 及同类本地环境配置文件（须使用 `.env.example` 等模板）；
- 构建产物（`dist/`、`build/`、`target/` 等，除非仓库明确要求纳入）；
- 本地 IDE 临时文件与个人配置（须在 `.gitignore` 中排除）。

## 4. 合并前置条件

执行合并前须同时满足：

| 条件 | 说明 |
|---|---|
| Plan 确认 | 用户已确认对应 Plan |
| 适用的 Review | Review 门禁为 `required` 时须取得 Approve |
| QA Pass | QA 验收结论为 Pass |
| 分支确认 | 源分支与目标分支已明确并在工作项记录中声明；实现位于源分支而非目标受保护分支 |
| 用户明确授权 | 当前用户会话已授权合并；Manager 已在源分支将状态置为 `done`（含未入库的 `review.md` / `qa-report.md` 一次提交） |

任一条件未满足时，Merge Executor 不得执行合并。

## 5. 受保护分支

禁止向受保护分支（如 `main`、`master`、`release/*`）执行 force push。

禁止在受保护分支上直接实施功能或缺陷修复；实现必须经工作分支合并进入。

## 6. 无法 fast-forward 或合并策略不明确

出现以下情形时，须停止合并操作并返回 Manager 与用户决策：

- 无法 fast-forward 且仓库未规定允许的合并策略（merge commit、rebase、squash 等）；
- 存在未解决的合并冲突且无法在不破坏 Plan 范围的前提下安全解决；
- 目标分支保护规则与当前合并请求冲突。

不得自行假设合并策略或强制推进。

## 7. 回滚

回滚已共享历史时，优先使用新的 revert 提交或 revert Pull Request，保留完整历史记录。

禁止以破坏性 `reset`（如 `git reset --hard` 后 force push）替代已推送至远程或已被他人基于其工作的提交的回滚。

本地未推送的提交可按仓库规范使用 `reset`；一旦历史已共享，须使用 revert。

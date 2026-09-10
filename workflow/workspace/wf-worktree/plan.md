# Plan: wf-worktree

## 元信息

- 依据 Spec: N/A
- 依据 Design: N/A
- 依据 UI: N/A
- 路径等级: fast
- Review 门禁: skipped（fast：流程机制条文，无产品行为）
- 最低验证层: manual
- 验证命令:
  - 通读 pageview 与 ggnote 的 `WORKFLOW.md` §4.1 / §6 / §8、`git.md` §1 / §8、`manager.md`、`qa.md`
  - `grep -n '\.worktree' workflow/WORKFLOW.md workflow/agents/standards/git.md .gitignore`
  - 对照两仓库对应机制文件，worktree 约定一致
- 预期证据: 附加 worktree 路径为 `<仓库根>/.worktree/<id>`；合入后拆除仅限附加树且有脏/占用门闩；`.gitignore` 含 `.worktree/`；ggnote 通用工作流与 pageview 同文。

## 目标摘要

Agent 并行开项时把附加 Git worktree 建在仓库根 `.worktree/<id>`（目录不存在则创建），合入并归档后拆除该附加树再删源分支。禁止默默放到仓库旁的兄弟目录。主工作树始终是仓库根。同一套约定写入 ggnote 通用工作流。

## 任务拆解

1. **T1** `git.md`：§1 写附加 worktree 路径、创建命令、gitignore、旧 Git 失败则停止不回退兄弟目录；§8 写拆除顺序与门闩（脏树 / 活进程禁止 `--force`；永不拆主树）。完成条件：创建与清理可按条文执行。
2. **T2** `WORKFLOW.md` §4.1 / §6 / §8 各补一句指向 `git.md`，不复制细则。完成条件：权威文件点到路径与拆除，细则仍只在 git.md。
3. **T3** `manager.md` 准备分支、`qa.md` 合并执行：附加树路径与合入后拆除。完成条件：角色文件不漏步骤。
4. **T4** pageview `.gitignore` 增加 `.worktree/`。
5. **T5** 将 T1–T3 的同等修改同步到 `/home/jason/space/ggnote/workflow` 对应文件，并在 ggnote `.gitignore` 增加 `.worktree/`。完成条件：两边 worktree 约定一致。

## 依赖与顺序

T1 → T2 → T3 → T4 → T5

## 触碰路径

- pageview：`workflow/WORKFLOW.md`、`workflow/agents/standards/git.md`、`workflow/agents/agents/manager.md`、`workflow/agents/agents/qa.md`、`.gitignore`
- ggnote：同上相对路径（独立仓库）
- 禁触：应用代码、已归档工作项、ggnote 未跟踪的 `Software/faiss/`

## 验收与验证

| ID | 要求或命令 | 预期证据 | 结果（实施后填） |
|---|---|---|---|
| V-1 | `git.md` 规定附加树 `.worktree/<id>` 与创建命令 | 条文含路径与 `git worktree add` | |
| V-2 | `git.md` §8 拆除附加树 + 门闩 + 先拆树再删分支 | 禁止 `--force`、不拆主树 | |
| V-3 | `WORKFLOW.md` 不复制细则、指向 git.md | §4.1 / §6 / §8 有指针 | |
| V-4 | pageview `.gitignore` 含 `.worktree/` | 文件中有该行 | |
| V-5 | ggnote 对应机制文件与 gitignore 同约定 | 对照 grep / diff 要点一致 | |

## 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 旧 Git 嵌套 worktree | 本机 2.53 已允许；规范只要求失败即停 | 更老 Git 无法开附加树 | 升级 Git 或用户另批 fallback |

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | N/A——流程机制在 `workflow/`；`.gitignore` 为仓库卫生 |
| 用户文档 | N/A——无产品功能变更 |
| 运维文档 | N/A——不改 `workflow/ops/` |

## 交接顺序

1. Developer 实施与自验 →
2. Reviewer（本项 skipped）→
3. QA 验收 →
4. 用户授权合并 → Manager 第三阶段文档提交（`done`）→ 合入 → 归档

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-09-10 | 初稿 |

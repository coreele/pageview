# Dev Notes: wf-worktree

## 实现摘要

附加 Git worktree 固定为仓库根 `.worktree/<id>`，合入（或取消）后拆除该附加树再删源分支。脏树或活进程禁止 `--force` / `rm -rf`，永不拆主树。pageview 与 ggnote 的 `WORKFLOW.md`、`git.md`、`manager.md`、`qa.md` 已对齐；两边 `.gitignore` 均忽略 `.worktree/`。

## 变更路径

- pageview：`workflow/WORKFLOW.md`、`workflow/agents/standards/git.md`、`workflow/agents/agents/manager.md`、`workflow/agents/agents/qa.md`、`.gitignore`
- ggnote：同上相对路径，另 `.gitignore`

## 测试先行记录（TDD）

| Spec ID / 行为项 | 测试 | 先失败 | 后通过 | 说明 |
|---|---|---|---|---|
| V-1–V-5 规范条文 | 通读 + grep `.worktree` + 两仓库 `diff` | N/A | 是 | 无运行时代码可单测；对照条文即验收 |

## 验证

| 命令 | 验证层 | 结果摘要 / 证据 |
|---|---|---|
| `diff` 四份机制文件 pageview vs ggnote | manual | WORKFLOW.md / git.md / manager.md / qa.md 均 identical |
| `grep '\.worktree'` | manual | 两仓库 WORKFLOW §4.1/§6、git.md §1.1/§8、gitignore 均命中 |
| `git.md` §8 门闩 | manual | 禁止 `--force`、`rm -rf`、拆除主树；先拆附加树再删分支 |

## 目标分支同步（最终 Review 前）

- 目标分支及提交: `main` / `origin/main` `359280956ed634e303aa1dfc0efacfdad5cbeb8e`
- 同步后源分支 HEAD: `3cb3d03bbb8c518312bfbf80f030cabd5d5d9d83`
- 同步方式: rebase（已与目标一致，无新提交）
- 冲突及处理: N/A
- 同步后复验: 四份机制文件与 ggnote `diff` 仍 identical；gitignore 含 `.worktree/`

## 文档影响

| 类别 | 已更新路径或交接说明 |
|---|---|
| 开发文档 | N/A |
| 用户文档 | N/A |
| 运维文档 | N/A |

## 未解决风险 / 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 旧 Git 嵌套 worktree | 规范要求失败即停 | 更老 Git 无法开附加树 | 升级 Git 或用户另批 fallback |

## QA 修复回执

| 缺陷 ID | 处理 | 摘要 | 验证证据 | 建议复测范围 |
|---|---|---|---|---|
| | | | | |

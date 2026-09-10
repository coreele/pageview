# QA Report: wf-worktree

> 首测与所有回归写在本文件，按轮次追加；禁止 `qa-report-v2.md`。

## 轮次

| 轮次 | 日期 | 实现版本 | 环境 | 范围 | 结论 |
|---|---|---|---|---|---|
| 1 | 2026-09-10 | `3cb3d03bbb8c518312bfbf80f030cabd5d5d9d83` | 对照 pageview 源分支与 ggnote `wf-worktree` `640c19c` | 首测：Plan V-1–V-5 | Pass |

## 执行命令

| 命令 | 输出摘要 / 证据位置 |
|---|---|
| `git rev-parse HEAD`（pageview） | `3cb3d03bbb8c518312bfbf80f030cabd5d5d9d83` |
| `diff` WORKFLOW.md / git.md / manager.md / qa.md 对 ggnote | 无差异（identical） |
| `grep '\.worktree'` pageview | WORKFLOW §4.1/§6；git.md §1.1 创建命令与 §8 拆除；`.gitignore` L36 |
| `grep '\.worktree'` ggnote | 同上相对路径；`.gitignore` L115 |
| 通读 git.md §8 | 脏树/活进程停止；禁止 `--force` 与 `rm -rf`；不拆主树；先拆附加树再删分支；`cancelled` 同样拆除 |

## 覆盖（对照 Spec 验收与 Plan 验证）

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| V-1 | `git.md` 附加树路径与 `git worktree add` | 通过 | §1.1 命令 `git worktree add -b <源分支> .worktree/<id> <基线提交>` |
| V-2 | §8 拆除门闩与顺序 | 通过 | 禁止 `--force`/`rm -rf`/拆主树；步骤 1 附加树 → 2 源分支 → 3 归档 |
| V-3 | WORKFLOW.md 指向 git.md | 通过 | §4.1、§6.2、§6.7、§8 归档步骤前序均指向 git.md |
| V-4 | pageview `.gitignore` | 通过 | `.worktree/` |
| V-5 | ggnote 同约定 | 通过 | 四文件 identical；ggnote `.gitignore` 含 `.worktree/` |

## 回归

| 范围 | 结果 | 证据 |
|---|---|---|
| 工作流其余门禁未改语义 | 通过 | 只增 worktree 路径与清理；状态机/三阶段提交未动 |
| `python3 workflow/agents/tools/wf-check.py` | 通过 | 提交前已通过；关闭前再跑 |

## 文档与安全验收

| 项 | 结果 | 备注 |
|---|---|---|
| 用户可见文档 | 通过 | 无产品 README 变更 |
| 运维可执行文档 | N/A | 不改 `workflow/ops/` |
| 安全验证范围 | 通过 | 禁止 `rm -rf` / `--force` 拆树；无凭据 |

## 缺陷

| ID | 严重度 | 摘要 | 状态 | 处理说明 | 验证证据 |
|---|---|---|---|---|---|
| | | | | | |

## 阻塞（Blocked 时必填）

- 原因:
- 风险:
- 恢复条件:
- 复测范围:

## 结论

- 本轮结论: Pass
- 合并: 待用户授权

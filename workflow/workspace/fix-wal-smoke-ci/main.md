# 工作项: fix-wal-smoke-ci

描述: GitHub Actions `pnpm test:wal` 在 `recent-window` 上失败：冒烟把 `endLsn` 与先前 `/api/wal/current-lsn` 做成字符串全等，而 `recent-window` 在请求时重新读 tip。CI 上两次调用之间 WAL 前进（日志：`0/2206C50` vs `0/2206CC8`），契约误杀。改为「`endLsn` ≥ 已观测 tip」并抽出可单测的契约函数。
目标分支: main
源分支: fix-wal-smoke-ci
基线提交: d94ef94ae67b7b2f9f377f87ac59bc0178f6415d
文档影响: N/A（测试契约；用户/运维文档不涉及 Fill 语义变更）

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/workspace/fix-wal-smoke-ci/`，无子目录、无版本后缀。
> 表内只填枚举、短标签或路径；理由与长说明写进「进度笔记」。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| fast | skipped | not-required | skipped | skipped |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| developing | Developer 实施 | | | |

## 进度笔记

- 2026-09-09 Manager 登记。路径 `fast`：CI 单点冒烟契约误杀，症状与验收明确。Spec skipped：产品 Fill 语义不变（`endLsn` 仍为请求时 tip）。Design skipped：无模块边界或选型。Review skipped：fast，以单测复现竞态 + 冒烟契约修正验收。用户贴出 Actions 日志即启动。
- 2026-09-09 Planner 完成 `plan.md`。进入 `developing`。第一阶段文档提交后调度 Developer。

# 工作项: ci-drop-e2e

描述: GitHub Actions `e2e` job 仍失败。按用户要求从 CI 移除该 job。本地 `pnpm test:e2e` 与 Playwright 套件保留。
目标分支: main
源分支: ci-drop-e2e
基线提交: d6528566752140e2d327385c8293bf82cdca1aeb
文档影响: README.md / README.zh-CN.md Development 节 CI 由三 job 改为两 job。

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/workspace/ci-drop-e2e/`。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| fast | skipped | not-required | skipped | skipped |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| done | 待 FF 合入 main | | | |

## 进度笔记

- 2026-09-07 Manager 登记。用户：「依然失败，CI取消 e2e」。路径 `fast`：删除 CI job，范围明确。Spec/Design skipped。Review skipped：YAML 与 README 对照即可。Plan 齐备后进入 `developing`。
- 2026-09-07 Developer：删除 ci.yml `e2e` job；README 改为两 job。提交 `6e30d03`。Review skipped → QA Pass。进入 `merge-approval`。
- 2026-09-07 用户授权合并（「ok」）。状态 `done`。第三阶段提交纳入 `dev-notes.md` / `qa-report.md`。

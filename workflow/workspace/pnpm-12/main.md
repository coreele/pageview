# 工作项: pnpm-12

描述: 将仓库锁定的 pnpm 从 9.15.0 升到 12.3.4，并同步 CI 与 README 的版本下限。
目标分支: main
源分支: pnpm-12
基线提交: 8033de99b6e672effb8734d9d122c24335f72a1f
文档影响: `README.md`、`README.zh-CN.md`

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/workspace/pnpm-12/`，无子目录、无版本后缀。
> 表内只填枚举、短标签或路径；理由与长说明写进「进度笔记」（见 `workflow/agents/standards/documentation.md` §B）。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| fast | skipped | not-required | skipped | skipped |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| developing | Developer 实施 | | | |

## 进度笔记

- 2026-09-10 Manager 登记。当前 `chrome-theme-sun` 工作树在 merge-approval，本项用独立 worktree `/home/jason/space/pageview-pnpm-12`。用户在仓库内 `pnpm --version` 仍为 9.15.0（根 `packageManager` 锁定），要求更新版本。路径 `fast`：对齐 `package.json`、CI `pnpm/action-setup`、双语 README 下限到 12.3.4。Spec/Design skipped：无产品行为合同、无选型。Review skipped：fast，对照钉死版本与安装/类型检查/测试/构建。
- 2026-09-10 Planner：`plan.md`。进入 `developing`。第一阶段文档提交。

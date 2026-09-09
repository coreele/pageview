# 工作项: pageview-wordmark

描述: chrome 左上字标改为 PAGEVIEW，旁侧加现有 favicon 作 logo；标签页标题与 README 一级标题同步。不改仓库名、localStorage 键、schema。
目标分支: main
源分支: pageview-wordmark
基线提交: 0c9aada6dfaa136178c48b831ada133eb41622d8
文档影响: README.md / README.zh-CN.md 一级标题改为 PAGEVIEW

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/workspace/pageview-wordmark/`，无子目录、无版本后缀。
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

- 2026-09-09 Manager 登记。用户确认字标 `PAGEVIEW`（全大写）+ 现有 favicon 作 chrome logo；范围锁定为 chrome h1、`<title>`、README 中英 H1。路径 `fast`：品牌字标替换，无新状态机/API。Spec/Design/Review skipped。用户已拍板名字，Spec 确认 not-required。
- 2026-09-09 Planner：`ui-design.md`、`plan.md`。进入 `developing`。第一阶段文档提交。

# PG Page Viewer 工作流

本项目的工作流定义在 [workflow/WORKFLOW.md](workflow/WORKFLOW.md)。按其中的状态机、门禁与角色执行。

用户确认只有两处：**Spec**（门禁要求时）与**合并授权**。Plan、实施、Review、QA 连续推进，不要每步请示、也不要在这些阶段停下来等用户。

开始任务前阅读 `workflow/STATUS.md` 与当前工作项 `workflow/workspace/<id>/main.md`。关闭工作项前和两阶段文档提交前运行：

```text
python3 workflow/agents/tools/wf-check.py
```

# PG Page Viewer 工作流

本项目的工作流定义在 [workflow/WORKFLOW.md](workflow/WORKFLOW.md)。按其中的状态机、门禁与角色执行。

常规路径用户确认只有两处：**Spec**（门禁要求时）与**合并授权**。用户取消后追加一处：是否回滚删除内容与分支。Plan、实施、Review、QA 连续推进，不要每步请示、也不要在这些阶段停下来等用户。合入后即结束，不要归档、不要提议归档；需要时由用户点名 `archive` skill。

开始任务前阅读 `workflow/STATUS.md` 与当前工作项 `workflow/workspace/<id>/main.md`。

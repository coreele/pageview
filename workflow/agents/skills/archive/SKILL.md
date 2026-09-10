---
name: archive
description: 把 workspace 中状态为 done 的工作项移入 archive/ 并更新 STATUS。仅在用户明确要求归档、archive 或清理已关闭工作项时使用。禁止在合入或置 done 时自动执行。
---

# archive — 手动归档

主流程外，仅执行 `done → archived`。

## 前提

- 用户已明确要求归档；未指定 `<id>` 时处理全部 `done` 项。
- Git 仓库中，目标分支必须已包含待归档项的实现；非 Git 仓库以合并授权完成为准。
- 其他状态一律不处理。

## 步骤

在目标分支上做（受保护则独立 docs 分支 / PR）：

1. 读各 `workflow/workspace/<id>/main.md` 状态表，筛出 `done`。
2. 对每个目标：把目录移到 `workflow/archive/<年>/<id>/`，状态改为 `archived`。
3. 更新 [STATUS.md](../../../STATUS.md)：这些项从「已关闭」移到归档索引；概览只改数量，不写名单。
4. 一次提交：`docs(workflow): archive N done items`

不改业务代码，不执行合并。

## 交接

报告归档的 `<id>`、提交 SHA；若用户只点了子集，列出仍留在 workspace 的 `done`。

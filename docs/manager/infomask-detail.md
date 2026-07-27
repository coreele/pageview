# 工作项记录: infomask-detail

工作项标识: infomask-detail
描述: 优化 `pg-page-viewer` 左侧 Selection detail 中 `t_infomask` / `t_infomask2` 的呈现：紧凑位格条 + tip/`?`；含合入前 UI 微调（InfomaskBitPair、NATTS 单格、疏朗布局、`decodeInfomask2` set: natts>0）。
路径等级: standard
源分支: infomask-detail
目标分支: main
文档影响: 已归档至 `docs/archive/2026/infomask-detail/`（原 `docs/features/infomask-detail/`：spec、plan、dev-notes、review、qa-report）；无独立 Design / ui-design。

> 权威工作流、门禁与状态说明见 [docs/README.md](../README.md)。
> 活跃状态见 [STATUS.md](STATUS.md)。
>
> 文档路径（已归档）：`docs/archive/2026/infomask-detail/`。

## 与其他工作项关系

- 前序 UI 合同参考归档：`docs/archive/2026/pg-page-viewer/`、`page-diagram-32b`、`layout-chrome-split`、`hex-collapse`。

## 产品澄清 / Spec / Plan / 合并授权

均已于 2026-07-27 用户「ok」确认（详见进度笔记与归档 Spec/Plan）。

## 切片（未拆分，sub-feature-id = feature-id）

| sub-feature-id | Spec | Spec 门禁 | Spec 用户确认 | Design 门禁 | UI 表面 | Review 门禁 | 状态 | 后续步骤 |
|---|---|---|---|---|---|---|---|---|
| infomask-detail | [spec.md](../archive/2026/infomask-detail/spec.md) | required | approved（2026-07-27「ok」） | skipped | gui | Approve @ 8117685 | done | 已合入 main（FF `6caa2e5`）并归档；push 待补 |

阻塞原因: none（push 失败不影响本地 done/归档；见进度笔记）
恢复条件: N/A（工作流已关闭；push 恢复条件：网络可达后 `git push origin main`）
恢复后的目标状态: N/A

## 进度笔记

- 2026-07-27：登记 → 澄清 → Spec/Plan 批准 → Develop `8117685` → Review Approve → QA Pass。
- 2026-07-27：用户确认 UI 微调并「ok」授权合并。状态 `qa` → `done`。关闭提交：`ae17838`（UI 微调）、`6caa2e5`（STATUS/工作项/review/qa）。排除 `.tmp-qa-*` 与 fixture CRLF。
- 2026-07-27：Merge Executor FF 合入 `main`（`6caa2e5`）。`git push origin main` 失败：`Failed to connect to github.com port 443`；本地 `main` ahead origin。Manager 归档至 `docs/archive/2026/infomask-detail/`。

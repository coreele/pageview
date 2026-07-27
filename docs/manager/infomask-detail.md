# 工作项记录: infomask-detail

工作项标识: infomask-detail
描述: 优化 `pg-page-viewer` 左侧 Selection detail 中 `t_infomask` / `t_infomask2` 的呈现：由完整纵向 flag 清单改为紧凑位格条（高亮=置位）+ tip/`?` 全量参考；合入前含用户满意的 UI 微调（InfomaskBitPair、NATTS 单格、疏朗布局等）。
路径等级: standard
源分支: infomask-detail
目标分支: main
文档影响: `docs/features/infomask-detail/`（spec、plan、dev-notes、review、qa-report）；无独立 Design / ui-design。合入后归档至 `docs/archive/2026/infomask-detail/`。

> 权威工作流、门禁与状态说明见 [docs/README.md](../README.md)。
> 活跃状态见 [STATUS.md](STATUS.md)。
>
> 文档路径：未拆分时 Spec 为 `docs/features/infomask-detail/spec.md`（无子目录）。

## 与其他工作项关系

- 前序 UI 合同参考归档：`docs/archive/2026/pg-page-viewer/`、`page-diagram-32b`、`layout-chrome-split`、`hex-collapse`。
- 本项实现须在源分支 `infomask-detail` 上进行（自当前 `main` 检出）；**禁止**在 `main` 直接实施。

## 参考资产

- 当前 UI 截图（2026-07-27）：`C:\Users\admin\.cursor\projects\d-AStudy-Space-pageview/assets/c__Users_admin_AppData_Roaming_Cursor_User_workspaceStorage_82874710c750b3b98380c20e0e5f9b3d_images_image-c77bd076-50a7-4d59-80c9-2d3ef3c2ce62.png`

## 产品澄清（已确认，2026-07-27）

用户已确认，以下为**已定范围**：

1. **呈现**：位格条（高亮=置位）+ tip/`?` 全量参考；简约、美观、现代。
2. **范围**：`t_infomask` 与 `t_infomask2` 统一策略。
3. **hex / 文案**：保留可读 hex；含义以 tip/`?` 承载。
4. **零已置**：仍示位格条 + hex。

## Spec 用户确认（approved，2026-07-27）

用户答复「ok」= **批准** Spec 全文。

## Plan 用户确认（approved，2026-07-27）

用户答复「ok」= **批准** Plan 全文，按 T1–T6 实施。分支：源 **`infomask-detail`** → 目标 **`main`**。

## 合并授权（approved，2026-07-27）

用户答复「ok」= **授权**将源分支 **`infomask-detail`** 合入目标分支 **`main`**（含合入前 UI 微调：Selection detail 疏朗布局、InfomaskBitPair、`t_infomask2` 在前、HEAP_NATTS 稍长单格、`decodeInfomask2` 的 `set: natts > 0` 等）。**禁止**纳入 `.tmp-qa-*` 与无关 fixture CRLF 噪声。

## 切片（未拆分，sub-feature-id = feature-id）

| sub-feature-id | Spec | Spec 门禁 | Spec 用户确认 | Design 门禁 | UI 表面 | Review 门禁 | 状态 | 后续步骤 |
|---|---|---|---|---|---|---|---|---|
| infomask-detail | [spec.md](../features/infomask-detail/spec.md) | required | approved（2026-07-27「ok」） | skipped | gui | Approve @ 8117685 | done | 源分支关闭提交后合入 main 并归档 |

阻塞原因: none
恢复条件: N/A
恢复后的目标状态: N/A

## 门禁判定理由

- 路径等级 `standard`；Spec/Review required；Design skipped；UI `gui`。
- Spec/Plan/合并用户确认均为 approved（2026-07-27「ok」）。
- 源分支 / 目标分支：`infomask-detail` → `main`。

## 进度笔记

- 2026-07-27：登记 → 产品澄清 → Spec → Plan → Develop（`8117685`）→ Review Approve → QA Pass。
- 2026-07-27：用户确认 UI 微调满意并「ok」授权合并。状态 `qa` → `done`。关闭提交纳入 STATUS/工作项/`review.md`/`qa-report.md` + UI 微调（web + `flags.ts` NATTS set）；排除 `.tmp-qa-*` 与 fixture CRLF。调度 Merge Executor 合入 `main`；合入后归档。

# 工作项记录: detail-panel-polish

工作项标识: detail-panel-polish
描述: Selection detail 面板 UI 打磨（fast）：加宽面板；「detail」作外侧 section label；疏开面板内布局间距。同会话另含结构图 free-space 对齐等 UI 改动，已纳入本轮收口提交范围。
路径等级: fast
源分支: detail-panel-polish（收口时自 `main` 检出；实现阶段曾在 `main` 上直接改，用户曾授权）
目标分支: main
文档影响: 无 Spec/Design/Plan 文档（用户要求勿开大范围新功能文档）；本记录 + STATUS 仅作治理；已归档至 `workflow/docs/archive/2026/detail-panel-polish/`。

> 权威工作流、门禁与状态说明见 [workflow/README.md](../../README.md)。
> 活跃状态见 [STATUS.md](STATUS.md)。
>
> 文档路径：`workflow/docs/archive/2026/detail-panel-polish/`。

## 产品澄清 / Plan 确认 / 合并授权

- 2026-07-27：用户 `/manager` 给出明确验收标准并授权「fast/small polish 推进并直接改代码」；本消息即 Plan 范围与确认，不另写 `plan.md`。
- 2026-07-27（续作）：用户对照截图补充验收标准并再次授权 fast polish；Scope 追加写入下方「续作 Plan」，视为 Plan 确认延续。
- 2026-07-27（收口）：用户目视验收通过；明确授权 **commit + merge + push**。QA 结论按用户验收记为 Pass（fast，无独立 `qa-report.md`）。状态 `qa` → `done`。

### Plan 范围（已确认 · 初轮）

1. `.selection-detail`：去掉偏窄的 `fit-content` / `min(34rem, …)` 约束，改为接近结构行可用宽度（`width: auto` / `max-width: 100%` 减左侧 offset，或等价放宽）。
2. 标题文案 `"Selection detail"` → `"detail"`，左上角紧凑标题，勿占一整行很大空间。
3. 保留 `margin-left: calc(2.85rem + 0.45rem)` 左对齐；折叠按钮留在顶栏，不改回面板内。
4. 不动 free-space / hex / 行高逻辑（初轮 Plan；收口时用户另授权同会话 free-space 对齐改动一并提交）。
5. 无需 commit / PR，除非用户另行要求。

### 续作 Plan 范围（已确认 · 2026-07-27）

1. **`detail` 放到外面**：将 `selection-detail__title` 移出 `.panel.selection-detail` 边框容器；外侧左上角 section label（框内不再有标题）。建议结构：
   ```
   <div class="selection-detail-wrap">
     <div class="selection-detail__title">detail</div>
     <div id="selection-detail-panel" class="panel selection-detail">...</div>
   </div>
   ```
2. wrap 沿用左对齐 `margin-left: calc(2.85rem + 0.45rem)`；内层 panel 全宽于 wrap。
3. **疏开拥挤**：增大 `.selection-detail` padding、各 section gap、title→panel 间距；略调 `selection-value` / label / columns 字号与 line-height；infomask 区块上下留白。保持简约现代、非卡片堆叠；与现有 dark theme token 一致；避免过大空白。
4. 只动 `apps/web/src/StructureMap.tsx` + `apps/web/src/styles.css`（必要时）。
5. **禁止**改动 free-space / hex / 行高 / 顶栏 Collapse detail 行为（续作实现约束；收口提交另含同会话 `App.tsx` free-space 对齐，已获用户授权）。
6. 不要 commit / PR（已由收口授权覆盖）。

## 切片（未拆分，sub-feature-id = feature-id）

| sub-feature-id | Spec | Spec 门禁 | Spec 用户确认 | Design 门禁 | UI 表面 | Review 门禁 | 状态 | 后续步骤 |
|---|---|---|---|---|---|---|---|---|
| detail-panel-polish | N/A | skipped（fast/small polish，范围已由用户消息钉死） | not-required | skipped（无模块边界/选型决策） | gui | skipped（fast polish；用户要求直接改代码） | done | 已合入 `main`（FF `62792c7`）并归档 |

阻塞原因: none
恢复条件: N/A
恢复后的目标状态: N/A

## 进度笔记

- 2026-07-27：Manager 登记；路径 `fast`；Spec/Design/Review 跳过；Plan 以用户验收标准视为已确认 → `planned`；调度 Developer。
- 2026-07-27（续作）：用户截图反馈纳入 Plan；状态 `planned` → `developing`；调度 Developer 实现外侧 label + 疏开布局。
- 2026-07-27（续作实现完毕）：Developer 完成；typecheck 通过；未触及禁止项；Review skipped → 状态 `qa`；待用户目视验收。
  - 结构：`selection-detail-wrap` + 外侧 `selection-detail__title`
  - CSS：padding / gap / 字号疏开；offset 落在 wrap
  - 文件：`apps/web/src/StructureMap.tsx`、`apps/web/src/styles.css`、`workflow/docs/features/detail-panel-polish/dev-notes.md`
- 2026-07-27（收口）：用户目视验收通过并授权 commit/merge/push。Manager 记 QA Pass（用户验收）；状态 `qa` → `done`。无 `review.md` / `qa-report.md`（Review/正式 QA 报告均 skipped）。
- 2026-07-27（合入/归档）：`detail-panel-polish` 分支提交 `62792c7` FF 合入 `main`；`workflow/docs/features/detail-panel-polish/` → `workflow/docs/archive/2026/detail-panel-polish/`；首次直连 push 失败后，经代理 `127.0.0.1:7890` push 成功（`origin/main` → `dd2fba5`）。

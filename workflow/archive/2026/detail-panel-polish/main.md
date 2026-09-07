# 工作项: detail-panel-polish

描述: Selection detail 面板 UI 打磨（fast）：加宽面板；「detail」作外侧 section label；疏开面板内布局间距。同会话另含结构图 free-space 对齐等 UI 改动，已纳入本轮收口提交范围。
目标分支: main
源分支: detail-panel-polish
基线提交: 97b4f0570c3e41821976ff211ce2feb47570323b
文档影响: 无 Spec/Design/Plan 文档（用户要求勿开大范围新功能文档）；本记录 + STATUS 仅作治理；已归档至 `workflow/archive/2026/detail-panel-polish/`。

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/archive/2026/detail-panel-polish/`。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| fast | skipped | not-required | skipped | skipped |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| archived |  |  |  |  |

## 进度笔记

- 2026-09-07 工作流迁移：机制改为 `workflow/WORKFLOW.md` + `workflow/agents/`；本记录由 `manager.md` 转为 `main.md`，产物平铺到 `workflow/archive/2026/detail-panel-polish/`。旧状态机名称（awaiting-*-approval 等）按新枚举对齐。
- 历史字段 UI 表面: gui（新模板已取消该列）。

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

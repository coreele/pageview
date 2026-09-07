# 工作项记录: e2e-playwright

工作项标识: e2e-playwright
描述: 引入 Playwright 无头浏览器 E2E 能力：测试基建（playwright 配置、web/服务器编排、PG 种子与清理、CI 接线）+ 首个 E2E 套件将 url-deeplink 手测清单 M1–M10 自动化；解阻 url-deeplink 的 QA 轮次 2（其恢复条件 B 路径，用户已授权）；为后续工作项的浏览器级验收建立可复用资产。
路径等级: standard（常规工具链/测试基建，无产品行为变更）
源分支: e2e-playwright（自 url-deeplink tip 创建；用户 2026-09-07 Plan 确认）
目标分支: main
文档影响: README 双语 Development 节（E2E 命令与前置）；细节由 Plan 落实。

> 权威工作流、门禁与状态说明见 [workflow/README.md](../../README.md)。
> 活跃状态见 [STATUS.md](STATUS.md)。

## 切片（未拆分时仅一行，sub-feature-id = feature-id）

| sub-feature-id | Spec | Spec 门禁 | Spec 用户确认 | Design 门禁 | UI 表面 | Review 门禁 | 状态 | 后续步骤 |
|---|---|---|---|---|---|---|---|---|
| e2e-playwright | [spec.md](../features/e2e-playwright/spec.md) | skipped（纯测试基础设施：无产品行为/公开接口/错误合同变更；验收以 Plan 可测条目定义） | not-required | required（已满足：design.md 已产出） | none（不触碰产品 UI） | required | developing | Developer 实施 T1–T7 |

阻塞原因: none
恢复条件: none
恢复后的目标状态: N/A

## 进度笔记

- 2026-09-04 Manager 登记。背景：url-deeplink QA 轮次 1 Blocked（M1–M10 需真实浏览器，Plan 禁止 L2 替代）；用户裁决恢复路径 B——先建 Playwright 无头能力，E2E 自动化 M1–M10 后回补 QA 轮次 2。前置事实：环境无 chromium/jsdom；CI 现有 unit+integration 两 job（postgres:16 超级用户）；本地 PG16.11 socket /tmp:5432（pg_ctl -D ~/pgdata 启动）。约束提醒：E2E 段必须解决 M3（临时移除 .env 的连接面板流）与 PG 依赖的稳定性（种子幂等/自清理，沿 integration-smoke 先例）。
- 2026-09-07 Planner 已产出 `design.md` + `plan.md`。用户要求继续 url-deeplink；实现与 QA 轮次 2 仍被路径 B 挡住。Manager 将本项从 backlog/planning 对齐为 `awaiting-plan-approval`（产物已齐）。待确认：Plan 正文 + 源分支基线（记录现写自 main 创建；Plan 建议自 `url-deeplink` tip，否则 M1–M10 必红）。
- 2026-09-07 用户确认 Plan（确认后紧接调度 Developer）+ 源分支自 `url-deeplink` tip 创建。状态 `awaiting-plan-approval` → `planned` → `developing`。

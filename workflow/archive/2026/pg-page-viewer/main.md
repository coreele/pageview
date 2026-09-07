# 工作项: pg-page-viewer

描述: PostgreSQL heap 表页内部结构可视化网页应用。连接真实 PG，经 pageinspect `get_raw_page()` 实时浏览；本地工具部署模型；含 infomask 逐位解读、tuple 列值解码、HOT 链/ctid 追踪、DML 前后刷新对比、hex dump 联动视图。第一版仅 heap 表页。
目标分支: main
源分支: pg-page-viewer
基线提交: 97b4f0570c3e41821976ff211ce2feb47570323b
文档影响: 已归档至 `workflow/archive/2026/pg-page-viewer/`（原 `workflow/archive/2026/pg-page-viewer/`：spec.md、design.md、ui-design.md、plan.md、dev-notes.md、review.md、qa-report.md）；项目 README 与部署/使用说明随实现产出

> 流程定义见 `workflow/WORKFLOW.md`；看板见 `workflow/STATUS.md`。
> 本工作项的全部产物平铺在 `workflow/archive/2026/pg-page-viewer/`。

## 门禁

| 路径等级 | Spec | Spec 用户确认 | Design | Review |
|---|---|---|---|---|
| full | required | approved | required | required |

## 状态

| 状态 | 下一步 | 阻塞原因 | 恢复条件 | 恢复后目标 |
|---|---|---|---|---|
| archived |  |  |  |  |

## 进度笔记

- 2026-09-07 工作流迁移：机制改为 `workflow/WORKFLOW.md` + `workflow/agents/`；本记录由 `manager.md` 转为 `main.md`，产物平铺到 `workflow/archive/2026/pg-page-viewer/`。旧状态机名称（awaiting-*-approval 等）按新枚举对齐。
- 历史字段 UI 表面: gui（新模板已取消该列）。

## Spec 用户确认（2026-07-26）

结论: 批准 Spec（采纳下列裁决与范围补充后）。

开放问题裁决:
1. PG 主版本: 以 PostgreSQL 16.11 为文档声明与测试夹具基准（可写「以 16.11 验证；兼容同主版本系列」）。
2. 连接入口: 支持环境变量（UI 必填路径保留；env 可选，明确为「支持 env」）。
3. pageinspect 缺失: 仅提示用户自行安装/启用；禁止应用代执行 `CREATE EXTENSION`。
4. 跨页 HOT/ctid: 默认仅标注跨块；允许用户点击后再加载目标页（标注 + 点击加载）。行为合同须写清；优先级合理判定（建议可交互加载为 P0 或明确 P1）。
5. 系统表: 仅用户表（不列 `pg_catalog` 等）。

范围补充（必须写入 Spec，不可仅笔记）:
- 空洞压缩（free space visual compression）: 真实页 8KB；当 tuple 少、物理占用小时，结构图中大片 free space 不得按真实比例占满视口。须对空洞/大片空白做可视化压缩（或等价布局策略），在仍能表达 `pd_lower`/`pd_upper` 与增长方向的前提下，优先保证 header、ItemId、tuple 与交互可读性。至少一条 Given-When-Then 验收。

> 注（2026-07-26 回退）：上述批准仅覆盖当时范围（P0-1..P0-12、P1-1..P1-3）。因新增 UI/UX 需求，`Spec 用户确认` 已重置为 `required`；既有条目语义不得删改，增量条款须重新确认。

## Spec 用户确认（2026-07-26，增量 UI/UX）

结论: 批准增量 Spec（外观与主题、基础元信息、UI/UX 质量范围与合同；验收 P0-13..P0-20、P1-4）。既有 P0-1..P0-12 / P1-1..P1-3 语义保留。Analyst 已将裁决写入 `spec.md` 并关闭开放问题；`Spec 用户确认` → `approved`。

开放问题裁决（全部采纳 Analyst 建议）:
1. 默认主题: 跟随系统 `prefers-color-scheme`；无法读取时默认 light。不改为固定 light/dark。
2. 主题跨会话记忆: 第一版不强制，保持 P1-4；不升为 P0。
3. tuple 计数定义: 等于 NORMAL ItemId 对应的 HeapTuple 条数。
4. PG 版本展示粒度: 展示服务端报告的完整版本串。
5. 元信息必显清单: 全部采纳 Analyst 推荐必显表（连接 host/port/database/user 不含密码、完整 PG 版本串、表限定名+OID、blkno、总块数、页大小、`pd_lower`/`pd_upper`/free space 字节、ItemId 总数与各 LP 状态计数、tuple 计数按第 3 条定义）。无降级、无增补。

## Plan 用户确认（2026-07-26）

结论: 批准 Plan（`workflow/archive/2026/pg-page-viewer/plan.md`，含 T1–T11、依据 ui-design、验收映射含 P0-13..P0-20）。状态 `awaiting-plan-approval` → `planned`。

# 工作项记录: index-viewer

工作项标识: index-viewer
描述: 在现有 Page（heap）/ WAL 可视化基础上，新增索引（index）页面可视化：识别索引对象、获取索引页 raw page、解析 B-tree 页面结构（metapage / internal / leaf、ItemId、index tuple、高键等）并在 web UI 展示。范围（仅 B-tree 还是含 hash/gist 等）由 Spec 阶段明确。
路径等级: full（新能力，跨 packages / server / web 多模块；范围未完全明确）
源分支: index-viewer（实施时自 main 创建）
目标分支: main
文档影响: 预计需更新 README / README.zh-CN（新 index 模式功能与前置条件）；可能新增索引解析相关开发文档。细节由 Plan 阶段落实。

> 权威工作流、门禁与状态说明见 [workflow/README.md](../../README.md)。
> 活跃状态见 [STATUS.md](STATUS.md)。
>
> 文档路径：未拆分时 Spec 为 `workflow/docs/features/index-viewer/spec.md`（无子目录）；已拆分时根目录仅总览 Spec，各切片为 `workflow/docs/features/index-viewer/index-viewer-<sub>/spec.md`。

## 切片（未拆分时仅一行，sub-feature-id = feature-id）

| sub-feature-id | Spec | Spec 门禁 | Spec 用户确认 | Design 门禁 | UI 表面 | Review 门禁 | 状态 | 后续步骤 |
|---|---|---|---|---|---|---|---|---|
| index-viewer | [spec.md](../features/index-viewer/spec.md) | required | approved | required（已满足：design.md + ui-design.md 已产出） | gui | required | planned | Developer 实施 T1–T10（源分支 index-viewer） |

阻塞原因: none
恢复条件: none
恢复后的目标状态: N/A

## 进度笔记

- 2026-08-12 登记工作项。现状：heap Page 模式与 WAL 模式已上线（wal-viewer 已归档）；`pd-flags-tuple-view` 已 done（实现 a90bfc6 已在 main）；`deleted-tuple-color` 处于 blocked（用户暂停，不影响本项）。工作区干净，基于 main。
- 2026-08-28 用户明确范围：① 仅支持 B-tree（hash/gist/spgist/brin/gin 为非目标）；② 不新增独立模式，在 Page 模式内识别——输入侧支持选「表或索引」，加载索引页时自动切换为索引页解析与展示；③ UI/UX 为本项重点（Design 阶段需产出 ui-design.md）。状态 backlog → speccing，调度 Analyst。
- 2026-08-28 Analyst 完成 spec.md 初稿（含 refine-docs 自检）：12 条 P0 / 5 条 P1，新增 `GET /api/indexes` 与 `GET /api/indexes/:oid/pages/:blkno` 合同，非 B-tree 双层拦截，oracle 为 bt_metap/bt_page_items。状态 speccing → awaiting-spec-approval，待用户确认 Spec 及裁决 5 个开放问题（列表组织、heap TID 跳转、键值解码立项、无效索引呈现、PG 版本下限）。
- 2026-08-28 用户确认 Spec 通过，5 个开放问题按建议裁决：① 全局平铺；② P1-3 heap TID 跳转纳入；③ 键值解码另立项；④ 无效索引列出并标记；⑤ btm_version 3/4 均支持。裁决已持久化到 spec.md。状态 awaiting-spec-approval → designing，调度 Planner（design.md + ui-design.md + plan.md，完成后停在 awaiting-plan-approval）。
- 2026-08-28 Planner 完成 design.md（方案 A：扩展 page-core，不新建 index-core；server 沿 tables 路由先例；web pageView 判别联合 + StructureMap 泛化；布局常量以实捕 fixture×pageinspect oracle 固化）、ui-design.md（[表|索引] 分段控件 + 全局平铺索引下拉 + 六态 + 17 项验收映射）、plan.md（T1–T10 TDD，最低验证层 L3，源分支 index-viewer）。Manager 核验三份文档一致性通过。状态 designing → awaiting-plan-approval，待用户确认 Plan。
- 2026-08-28 用户确认 Plan 通过（“ok”）。状态 awaiting-plan-approval → planned，调度 Developer 实施T1–T10。

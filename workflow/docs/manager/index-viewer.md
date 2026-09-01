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
| index-viewer | [spec.md](../features/index-viewer/spec.md) | required | approved | required（已满足：design.md + ui-design.md 已产出） | gui | required | done | 已授权合并；QA 轮次 7 Pass + 复审 Approve |

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
- 2026-08-28 Developer T1–T4 完成（1699937/5b71d55/5b8d089；T2 实捕四场景 oracle，常量 4 处偏差 D1–D4 以 oracle 为准冻结）；T5–T8 完成（0cbf811/8cd6a64/64da04b/00be322/f0ad576/36ee54d）；首次 T9–T10 会话中断未出提交，续做完成（2b35e8e/9dab98a）。Manager 独立核验：170 tests 全绿、typecheck/build 零错、pnpm test:integration 退出 0（B-tree oracle 段+hash 守卫+heap 不回退）、README 双语同步。遗留：手测 10 项待浏览器补证、v3 metapage 仅 synthetic、无效索引验证简化为 valid 字段契约（已记 dev-notes）。用户指示：无需 push origin；QA Pass 后等合并授权。状态 planned → developing → reviewing，调度 Reviewer。
- 2026-08-28 Reviewer 独立审阅（1699937..9dab98a）：亲自复跑 L2/L3 全绿；P0-1..12 逐项核对全过；diff parity 独立复验 0 不匹配；D1–D4 三方一致；SQL 只读参数化。发现 4 项（Low×2：非数字 oid 报 BAD_LSN 既有先例、cycleid 无 oracle；Info×2）。结论 **Approve**，无阻塞。review.md 留工作区未提交（按 git.md §1.4 待合并授权时随 done 一次提交）。状态 reviewing → qa，调度 QA。
- 2026-08-31 QA 轮次 1 **Fail**：L2/L3 全绿、实库 API/oracle 取证；P0-9 未过（DEF-1 Medium：真实 PG16 metapage pd_lower=72，[24..72) BTMetaPageData 被泛型读为 12 伪 ItemId，hex 反选永不命中 btm_*，并破坏 P0-4 空态语义与 ui-design 合同；synthetic 测试盲区）；DEF-2 Low（非数字 oid→BAD_LSN，与既有 tables 同型，建议后续小项）。状态 qa → developing，调度 Developer 修复 DEF-1、处置 DEF-2。修复后 Reviewer 复审 → QA 轮次 2。
- 2026-08-31 Developer 修复提交 c30bf92（parseBtreePage 分类前置、meta 页 0 ItemId；buildBtreePage pd_lower 对齐真实 v4=72；实捕回归 4 例先红后绿；174 tests 全绿、integration 退出 0）；DEF-2 记录不修复理由（违反 spec 非目标，建议独立小项）。状态 developing → reviewing，调度 Reviewer 复审。
- 2026-08-31 Reviewer 复审 c30bf92：活库探针+实捕 fixture 双路复证 ItemId=0/反向选中命中 oracle；pd_lower 变更判定为「使 synthetic 更严」非规避；测试纯新增无弱化；DEF-2 处置成立。复审结论 **Approve**。状态 reviewing → qa，调度 QA 轮次 2（DEF-1 复测 + P0-4/P0-9 回归 + 手测补证）。
- 2026-08-31 QA 轮次 2 **Pass**：活库探针+实捕 fixture 43/43 断言复证 DEF-1 Closed；L2 174 全绿、L3 退出 0；P0 12 项数据/逻辑层全过，P1 5 项部分核验，纯视觉项维持「未核验-无浏览器」（合并后或浏览器可用时按清单补测）。review.md/qa-report.md 留工作区未提交，等待用户合并授权。后续小项待登记：非数字 oid 守卫（DEF-2/F1）。
- 2026-08-31 **用户需求变更（合并授权前）**：UI 可见文案一律英文（按钮、flag 说明、hint、空态、警告、title 等；含 main 既有一处「未连接」）。已持久化至 spec.md 修订记录与 ui-design.md 修订节（英文文案表）。状态 qa → developing，调度 Developer 实施文案英文化；随后 Reviewer 复审 → QA 轮次 3 → 重新请示合并授权。
- 2026-08-31 Developer 变更提交 296dc44（8 文件，ui-design 英文文案表逐条采用；apps/web/src CJK 残留 0；174 全绿、integration 退出 0）。状态 developing → reviewing，调度 Reviewer 复审（范围：文案变更）。
- 2026-08-31 Reviewer 复审轮次 2（296dc44）：30 处替换 29 处与文案表逐字一致，1 处表外直译 `leaf: heap TID`（F5-Info，已补录文案表）；全仓 CJK 0 命中；纯字符串替换无逻辑/测试弱化。结论 **Approve**。状态 reviewing → qa，调度 QA 轮次 3。
- 2026-08-31 QA 轮次 3 **Fail**：DEF-3（Low）StructureMap.tsx:696 metapage hint 全角括号残留（296dc44 漏改）。Developer 修复 6bf5191（单行；全仓全角扫描 0）；Reviewer 复审轮次 3 **Approve**（F6-Info 文案表补录已由 Manager 完成）。状态 qa → developing → reviewing → qa，调度 QA 轮次 4。
- 2026-08-31 QA 轮次 4 **Pass**（前一次轮次 4 会话连接中断未落盘，已重跑）：DEF-3 Closed（字节实证半角括号，全仓全角/CJK 扫描 0 命中）；174 全绿、typecheck/build 零错、integration 退出 0；DEF-1 Closed 维持、DEF-2 后续小项已登记。分支 tip 6bf5191。等待用户合并授权（授权后：置 done + review.md/qa-report.md 一次提交 → FF 合入 main；按用户指示不 push）。
- 2026-08-31 **用户需求变更 2（合并授权前）**：Index 模式选择交互重构——table 下拉后新增 index 下拉；选中 table 时 index 仅列该表索引；未选 table 时列全部；简化选项内「→所属表」后缀（Manager 决策：未选 table 浏览全部时保留后缀以保持可辨识，选中 table 过滤后去除；已向用户显著标注可改）。Table 模式交互不变。实现为纯 client 过滤（/api/indexes 已返回 tableOid）。状态 qa → developing。
- 2026-08-31 Developer 变更 2 提交 f8e650b（App/indexView/测试 +11 用例；185 全绿、typecheck/build 零错、integration 退出 0、CJK/全角 0）。状态 developing → reviewing，调度 Reviewer 复审。
- 2026-08-31 Reviewer 复审轮次 4 **Approve**（五条规则全落实；Table 模式 diff hunk 级零触碰；断言纯新增；F7-Info）。QA 轮次 5 **Pass**：五条规则活库+代码级全过（20 断言）；P0-1 双态口径与 pg_class 一致；185 全绿、integration 退出 0；DEF-1/2/3 维持。DEF-4（Low，Manager 补录 F7 表与实现 title 字面不一致）已由 Manager 澄清修正（ui-design F7 表定稿与 indexView.ts 逐字一致），非代码缺陷。分支 tip f8e650b。**等待用户合并授权**（授权后：置 done + review.md/qa-report.md 一次提交 → FF 合入 main；按用户指示不 push）。
- 2026-08-31 **用户需求变更 3（合并授权前，细化变更 2）**：①去掉「All tables」默认项，table 过滤器默认为空（空=全部索引）；②全量浏览也去除「→所属表」后缀（选项文本与 title 均无归属，归属仅由过滤器表达）；③Index 模式 table 列表仅列出拥有索引的表（含仅非 B-tree 索引的表，client 从 indexes 派生）。Table 模式不变。状态 qa → developing。
- 2026-08-31 Developer 变更 3 提交 66c595f（空默认过滤器+仅含有索引表+归属全部去除；191 全绿、integration 退出 0、CJK/全角 0）；Reviewer 复审轮次 5 **Approve**（五条规则全落实、无死代码残留、Table 零触碰、断言+6 净增）。状态 developing → reviewing → qa，调度 QA 轮次 6。
- 2026-08-31 QA 轮次 6 **Pass**：活库探针 95/95 断言（过滤器仅含有索引表、空默认全量、双态无归属、防御路径）；P0-1 再修订口径与 pg_class 一致（系统 schema 0 泄漏）；191 全绿/integration 退出 0；无新增缺陷，DEF-1/3 Closed 维持、DEF-2 后续小项、DEF-4 随附页 3 闭环。分支 tip 66c595f。**等待用户合并授权**（授权后：置 done + review.md/qa-report.md 一次提交 → FF 合入 main；按用户指示不 push）。
- 2026-08-31 **用户需求变更 4（合并授权前，方案 B 裁决）**：P1-3 就地跳转改为**页内只读浮层**（近全屏、✕/Esc/遮罩关闭、三联区复用、主视图零影响、移除 TABLE_NOT_LISTED 守卫、浮层内无二级跳转）。已持久化 spec 修订记录 4 与 ui-design 附页 4。状态 qa → developing，调度 Developer。
- 2026-08-31 Developer 变更 4 提交 2463576（HeapPeekOverlay 新组件+纯状态切片+主视图零影响+TABLE_NOT_LISTED 移除；197 全绿、integration 退出 0、CJK/全角 0）；Reviewer 复审轮次 6 **Approve**（七点合同+四规则逐条落实；R6-1 非阻塞：无 focus trap，留后续）。状态 developing → reviewing → qa，调度 QA 轮次 7。
- 2026-08-31 QA 轮次 7 **Pass**：活库探针 27/27 断言（浮层合同全过、迟到响应不复活、错误三段式、只读性、零残留）；197 全绿/integration 退出 0；无新增缺陷；R6-1 登记 DEF-5（Info，后续增强）。分支 tip 2463576。**等待用户合并授权**（授权后：置 done + review.md/qa-report.md 一次提交 → FF 合入 main；按用户指示不 push）。
- 2026-08-31 **用户授权合并**。Manager 将状态置 done，并与未入库的 review.md/qa-report.md、spec/ui-design CR 修订、STATUS 一次提交于源分支；随后 FF 合入 main（不 push）。工作流关闭。遗留登记：浏览器手测清单（合并后补测）、DEF-2（oid-numeric-guard 已登记 backlog）、DEF-5（focus trap 增强）、v3 metapage synthetic 缺口。

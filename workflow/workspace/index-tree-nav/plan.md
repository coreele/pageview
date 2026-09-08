# Plan: index-tree-nav

## 元信息

- 依据 Spec: `workflow/workspace/index-tree-nav/spec.md`
- 依据 Design: N/A
- 依据 UI: `workflow/workspace/index-tree-nav/ui-design.md`
- 路径等级: standard
- Review 门禁: required
- 最低验证层: unit + static
- 验证命令:
  - `pnpm --filter web test`
  - `pnpm --filter web typecheck`
- 预期证据: 退出码 0；P0 对应单测通过；既有 btreeTree / urlState / indexView 绿。

## 目标摘要

Page 导航为 table / index 两段目录（可折叠、段内限高）；Index 选索引走树；去掉次带两个下拉；连库后 Tree 在两种 kind 都默认开。

## 任务拆解

1. **catalog 纯函数**（完成条件：`treeChromeVisible` 对 index 无页为 true；`visibleIndexCatalog` 按传入列表生成索引节点，展开 btree 后挂 `visibleTree` 子行；空列表 hint；`indexNameClickCollapses`；段折叠 getter/toggle；`pendingFetches` 在 index 段折叠时不拉页）
2. **面板与 App 接线**（完成条件：两段 UI；Index 无 `table-select` / `index-select`；点 B-tree 索引 `loadIndexBlk(oid, 0)`；连库后拉 indexes；table/index 无页也可挂树；切 kind 不 reset 整棵树）
3. **README + e2e helpers**（完成条件：中英写明两段目录与 Index 用树选索引；helpers 可点索引节点）
4. **回归**（完成条件：web 测试与 typecheck 绿）

## 依赖与顺序

1 → 2 → 3 → 4。

## 触碰路径

- `apps/web/src/btreeTree.ts`、`apps/web/src/btreeTree.test.ts`
- `apps/web/src/BtreeTreePanel.tsx`、`apps/web/src/App.tsx`、`apps/web/src/styles.css`
- `apps/web/src/treeNavUi.test.ts`（段标题 / 无 Unicode）
- `README.md`、`README.zh-CN.md`
- `e2e/helpers/app.ts`

不改：server、URL 参数名、`HEAP_BLOCK_LIST_CAP`、WAL。

## 验收与验证

| ID | 要求或命令 | 预期证据 | 结果（实施后填） |
|---|---|---|---|
| P0-1 | Table 无页也见两段 | `treeChromeVisible` table 仍 true；面板有 `data-section` | |
| P0-2 | index 段不按表过滤 | App 把完整 `indexes` 交给 catalog；选表不清空其他表的索引 | |
| P0-3 | Index 无两个下拉 | `App.tsx` 无 `index-select` / Index 侧 `table-select` | |
| P0-4 | 点 B-tree 索引 Load blk 0 | App 点 `role=index` 且 btree 走 `loadIndexBlk(oid, 0)` | |
| P0-5 | 非 B-tree 不请求 | catalog 节点不可展开；激活不调用 loadIndexBlk | |
| P0-6 | 段标题完全折叠 | toggle 后该段 body 不渲染行；另一段不变 | |
| P0-7 | Index 无页有 Tree | `treeChromeVisible({ kind: index, pageKind: undefined })` true | |
| P0-8 | 深链展开索引 | restore 后 `ensureIndexExpanded` + 段展开 | |
| P1 | 段 overflow、再点收起、选表仍列全部、ellipsis | CSS max-height 50%；`indexNameClickCollapses` | |
| V-docs | README | 中英不再写 Index 默认关树 / 下拉选索引 | |
| V-reg | web test | 退出码 0 | |
| V-static | typecheck | 退出码 0 | |

## 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 真机扫读 | 本会话未必开 UI | 两段高度 / 折叠观感 | 本地 Connect 后点表与索引 |
| e2e | CI 已去掉 Playwright | helpers 需跟进选索引 | 有人跑 e2e 时用新 helper |

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | N/A |
| 用户文档 | `README.md`、`README.zh-CN.md` |
| 运维文档 | N/A |

## 交接顺序

1. Developer 实施与自验 →
2. Reviewer Approve →
3. QA 验收 →
4. 用户授权合并 → Manager 第三阶段文档提交（`done`）→ 合入 → 归档

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-09-08 | 初稿 |

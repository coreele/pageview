# Plan: table-tree-nav

## 元信息

- 依据 Spec: `workflow/workspace/table-tree-nav/spec.md`
- 依据 Design: N/A
- 依据 UI: `workflow/workspace/table-tree-nav/ui-design.md`
- 路径等级: standard
- Review 门禁: required
- 最低验证层: unit + static
- 验证命令:
  - `pnpm --filter web test`
  - `pnpm --filter web typecheck`
- 预期证据: 退出码 0；P0 对应单测通过；既有 btreeTree / urlState 绿。

## 目标摘要

Table 模式导航为表→块，去掉表下拉；连库后 Tree 默认开。Index 模式不变。

## 任务拆解

1. **catalog 纯函数**（完成条件：`visibleTableCatalog` / 新 `treeChromeVisible` 覆盖 P0-1 列表、空表、展开块窗口；`treeKindTokens` 表节点为 `N blk`）
2. **面板与 App 接线**（完成条件：Table 无 `select.table-select`；点表 Load blk 0；无页也可挂树；Index 下拉与 B-tree 树仍在）
3. **README**（完成条件：中英写明 Table 用导航选表）
4. **回归**（完成条件：web 测试绿）

## 依赖与顺序

1 → 2 → 3 → 4。

## 触碰路径

- `apps/web/src/btreeTree.ts`、`apps/web/src/btreeTree.test.ts`
- `apps/web/src/BtreeTreePanel.tsx`、`apps/web/src/App.tsx`、`apps/web/src/styles.css`
- `README.md`、`README.zh-CN.md`

不改：server、URL 参数名、Index 下拉、`HEAP_BLOCK_LIST_CAP`。

## 验收与验证

| ID | 要求或命令 | 预期证据 | 结果（实施后填） |
|---|---|---|---|
| P0-1 | 未 Load 也列出 tables | `visibleTableCatalog` 行含表节点；chrome 可见性 table+无 page → true | Pass |
| P0-2 | Table 无表下拉 | `App.tsx` Table 分支无 `className="table-select"`；Index 分支仍有 | Pass |
| P0-3 | 点表 Load blk 0 | App 点 `role=table` 且 blocks>0 走 `loadBlk(oid, 0)` | Pass |
| P0-4 | 0 blk 不请求 | catalog 无子块；激活空表不调用 loadBlk | Pass |
| P0-5 | 点 blk Load；expander 不 Load | 现 heap 路径保留；expander 只改 expanded 集 | Pass |
| P0-6 | Index 无页无 Tree | `treeChromeVisible({ kind: index, pageKind: undefined })` false | Pass |
| P0-7 | 深链展开该表 | 选中 oid 出现在 expanded / catalog 子块 | Pass |
| P1 | 长名 ellipsis + title | CSS ellipsis；表行 title=qualifiedName | Pass |
| V-docs | README | 中英不再写「下拉选表」为 Table 入口 | Pass |
| V-reg | web test | 退出码 0 | Pass（238） |
| V-static | typecheck | 退出码 0 | Pass |

## 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 真机扫读 | 本会话未必连库 | 无页 split / 截断观感 | 本地 Connect 后点表 |
| e2e | CI 已去掉 Playwright | 辅助函数仍指向 `select.table-select` | 有人跑 e2e 时改 helpers |

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

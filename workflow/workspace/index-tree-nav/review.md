# Review: index-tree-nav

## 审阅范围

- 实现版本 / 提交: `d0577594ff1b2b7cef5a03bb5bbd956e3b8f1b49`
- 依据: `plan.md`；`spec.md` / `ui-design.md`
- 同步: `origin/main` `1d20b6e` 已是祖先；源分支 HEAD 与 `dev-notes.md` 记录一致

## 实现正确性

与已确认 Spec 对齐：Page + 已连接时 chrome Tree 对 table/index 都不依赖已 Load 页，默认开。`BtreeTreePanel` 固定渲染 `table` / `index` 两段；段标题 `aria-expanded`，折叠后不渲染 body；展开 `max-height: 50%`。`visibleIndexCatalog` 使用 App 传入的 `filterIndexesByTable` 结果。点 B-tree 索引 `activateIndex` → `loadIndexBlk(oid, 0)`；hash 不可展开且不 Load。`onSelectIndex` / chrome 切 kind 不再 `resetBtreeTree()`。Index 次带无 `table-select` / `index-select`。深链 restore 对 index 再 `setTreeCollapsed(false)` + `ensureTableExpanded` + `ensureIndexExpanded`。未改 server、URL 参数、`HEAP_BLOCK_LIST_CAP`、WAL。

## 测试有效性

`btreeTree.test.ts` 覆盖 P0-2/P0-4/P0-5/P0-6/P0-7（过滤列表、btree 子树 depth、hash 无子行、段折叠、index 无页 chrome）。P0-3 由 `treeNavUi.test.ts` 扫 `App.tsx`。P0-1/P0-8 与点名 Load 接线靠代码审 + 既有 `loadIndexBlk` / restore。错误实现（index 无页仍隐藏 Tree、hash 下挂 page 行、下拉残留）会被现有单测抓住。web 259 回归绿。真机与 e2e 见 Plan 缺口，不挡 Approve。

## 文档影响核对

| Plan 声明 | 实现是否一致 | 备注 |
|---|---|---|
| 开发文档 | 是 | N/A |
| 用户文档 | 是 | README 中英：两段目录、Index 用树选索引 |
| 运维文档 | 是 | N/A |

## 安全影响核对

| 检查项 | 结果 | 处置状态 | 备注 |
|---|---|---|---|
| 敏感信息 | 通过 | — | 无新密钥或连接串 |
| 认证与授权 | 通过 | — | 仍走既有已连接 + pageinspect |
| 输入与外部访问 | 通过 | — | 点索引/页仍经既有 `loadIndexBlk` / `fetchIndexPage`；连库后多一次 `/api/indexes` |
| 依赖变更 | 通过 | — | 无新依赖 |

## 必修项

| ID | 位置 | 问题 | 状态 |
|---|---|---|---|
| — | | | |

## 非阻塞建议

- `tableSelect` e2e helper 仍指向已删除的 `select.table-select`；CI 不跑 Playwright，未挡。
- 两段各 50% 在只有一侧有内容时会留空，符合 max-height 合同。

## 结论

Approve

> `Comment` 不得含任何必修项或未解决安全问题；否则必须改为 `Request changes`。

## 后续动作与复审范围

进 QA。复审仅在 QA Fail 回环时针对缺陷文件。

## 复审（目录文案 `8a78057`）

用户反馈 schema 与块数挤、两段分区不够明显。目录行改为关系名（`title` 仍为 `qualifiedName`）；表/B-tree 行去掉 `N blk`；段标题改为大写加粗 **TABLE** / **INDEX**，段间顶部分隔。合同仍是两段可折叠目录。web 259。安全无新面。结论仍 **Approve**。实现版本 `8a780579b3d296995fa145e657a4dd1e9e836d6b`。

## 复审（去掉 btree pill `161dde9`）

用户反馈索引名旁的 `btree` 标记与上方元信息重复。B-tree 目录行不再带 kind pill；hash 等非 B-tree 与 `invalid` 仍标出。页节点 meta/leaf/L0 不变。web 259。结论仍 **Approve**。实现版本 `161dde9575c5d393c5743d38fac38bb8bbc92383`。

## 复审（页节点只留 meta `HEAD`）

用户反馈 leaf / L0 / root 与结构图重复。`treeKindTokens` 页行只保留 `meta`；deleted/garbage 等 flag chip 仍在。web 259。结论仍 **Approve**。实现版本 `4d129b26b0650f6187606e5650ef5cae187a62e5`。

## 复审（层级 icon `8f16e2b`）

用户反馈三角形叠太多。段标题仍用三角折叠；表行格子图标、索引行书签图标、块行页图标。点击图标仍只展开。web 259。结论仍 **Approve**。实现版本 `8f16e2b05b2ace55996848bf6844dfa577c3da8d`。

## 复审（index/block 图标 `ca4f5ee`）

用户反馈块图标难看，且索引图标与块糊成同一种瘦长方框。索引改为钥匙 mask，块改为带折角与横线的页；表行仍是格子。轮廓不同。web 259。结论仍 **Approve**。实现版本 `ca4f5eeeb90c53cacf5f5c2a4b975c09ef430dbf`。

## 复审（取消表/索引过滤 `b933a8c`）

用户修订 Spec：index 段始终列出全部用户索引。App 不再 `filterIndexesByTable`；切 kind / 选表不清空其他表的索引；深链 `table=` 与 `index=` 独立，列表里的 B-tree 即使所属表不一致也 Load。README 中英同步。web 260。结论仍 **Approve**。实现版本 `b933a8cd02d07b9b58c3b04598e4b34a3bddf8b3`。


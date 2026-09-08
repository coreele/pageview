# UI Design: index-tree-nav

> 依据 Spec `workflow/workspace/index-tree-nav/spec.md`。WAL 布局不改。

## 背景与范围

左侧导航从「Table 目录 / Index 才出 B-tree」改成同一列里的两段目录：`table` 与 `index`。Index 选索引不再走次带下拉。

## 非目标

与 Spec 相同：不搜索框、不把段折叠写入 URL、不解析非 B-tree 页。

## 用户与关键场景

| 角色或场景 | 目标 | 备注 |
|---|---|---|
| 连库后选表 | table 段点表进 blk 0 | 与 table-tree-nav 相同；index 段仍列全部 |
| 同一列选索引 | index 段列出全部用户索引；点 B-tree 进 metapage | 不必先选表；自动切到 Index kind |
| 看 B-tree | 展开索引节点 | 子树仍是现有拓扑 |
| 列表太长 | 段内滚动或整段收起 | 每段 max-height 50% |
| 关掉树 | chrome Tree 再打开 | 仍是两段目录 |

## 信息架构与关键界面

Page 模式、已连接：

```text
┌ chrome: Table|Index · blkno Load …     [Detail][Hex][Tree] ☀ ┐
├ 次带无 table/index 下拉                                         ┤
├ TABLE            │ 未选：提示用 Tree 选表或索引                  │
│  items           │ 已 Load 堆页：结构图 + hex                    │
│    blk 0         │ 已 Load 索引页：B-tree 结构图 + hex           │
├ INDEX            │                                              │
│  tb_pkey         │                                              │
│    blk 0 meta    │                                              │
└──────────────────┴──────────────────────────────────────────────┘
```

未 Load 且 Tree 关：无左列，主区「Open Tree to pick a table or index」。

## 关键流程

| 步骤 | 用户动作 | 系统反馈 | 空态 / 加载 / 错误 |
|---|---|---|---|
| 1 | Connect | Tree 开，两段都展开；拉 tables 与 indexes | 无表 / 无索引：段内 hint |
| 2 | 点表名 | Table kind、选中、Load 堆 blk 0；index 段仍列全部 | 0 blk：空表提示 |
| 3 | 点 B-tree 索引名 | Index kind、选中、Load blk 0 | 非 B-tree：提示、不请求 |
| 4 | 点段标题 | 该段内容全部隐藏 | 允许两段同时折叠 |
| 5 | 点索引箭头 | 只展开 B-tree 子树 | 未 Load 时 pendingFetches 拉 meta |
| 6 | chrome 切 Table/Index | 清当前页，目录保留 | 不下拉 |

## 布局与视觉方向

- 复用 `.pane-tree` / `.btree-tree-row`。新增 `.tree-section`：标题行 + 可滚内容；展开时 `max-height: 50%`（相对树面板），折叠时只留标题。
- 段标题 **TABLE** / **INDEX**：大写加粗、字距拉开，形如独立分区头；两段之间有顶部分隔。caret 用现有 expander 的 CSS 三角，不用 Unicode。表行格子、索引行钥匙、块行折角页，三者轮廓不同，不再叠三角形。
- 目录行只显示关系名（不含 schema）；全名放 `title`。表行与 B-tree 索引行无 kind pill；非 B-tree 用 access method。选中仍是文字 accent。
- 宽屏三栏拖动与 hex 等分规则不变。
- 明确避开：新主色；把索引下拉加回次带。

## 组件与交互约定

| 区域或组件 | 约定 | 复用既有系统？ |
|---|---|---|
| chrome Tree | Page+已连接即出现，table 与 index 都默认开 | 是 |
| 段 | `data-section="table"\|"index"` | 新，包在 `BtreeTreePanel` |
| 表节点 | 现 `role=table` | 是 |
| 索引节点 | 现 `role=index`；仅 btree 可展开 | `visibleIndexCatalog` |
| B-tree 页 | 现 `role=page`，depth ≥ 1 | `visibleTree` + depth 偏移 |
| aria | 面板 `aria-label="Catalog"`；段标题 `aria-expanded` | 部分新 |

## 响应式与无障碍

| 项 | 约定 |
|---|---|
| 断点 | 沿用 `<960` 树上、图下 |
| 键盘 | 段标题 / expander / 标签都是 button |
| 截断 | 可见文字可截，全名在 title |

## 开放问题

N/A

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| 表+索引都很多 | 两段抢高度 | 各 50% 封顶 + 可整段折叠 |
| 切 kind 清空树 | 目录被折上 | 切 kind / 选索引不清 `collapsed` 与段折叠 |

## 对 Plan 与 Developer 的要点

### Plan

- `visibleIndexCatalog` + `treeChromeVisible` index 无页为 true
- 段折叠纯函数单测
- App：去掉 Index 两个 `<select>`；连库后拉 indexes；一种 PageSplit 挂两段

### Developer

- 点索引 Load 把 oid 传进 `loadIndexBlk`，不要等 `selectedIndexOid` setState
- `onSelectIndex` / 切 kind **不要** `resetBtreeTree()`（会把目录折上）
- 非 B-tree 与 0-block B-tree 不发 page 请求

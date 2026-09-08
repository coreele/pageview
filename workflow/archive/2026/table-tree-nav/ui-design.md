# UI Design: table-tree-nav

> 依据 Spec `workflow/archive/2026/table-tree-nav/spec.md`。Index / WAL 布局不改。

## 背景与范围

Table 模式选表从次带下拉改到左侧导航：表节点下挂块列表。尚未 Load 时也要能看到并使用该列。

## 非目标

与 Spec 相同：不改 Index 树、不搜索框、不加宽列上限。

## 用户与关键场景

| 角色或场景 | 目标 | 备注 |
|---|---|---|
| 连库后选表 | 打开即见表列表，点表进 blk 0 | Tree 默认开 |
| 换块 | 展开的表下点 blk | expander 不 Load |
| 关掉树 | chrome Tree 再打开 | 仍是目录树 |
| Index | 与现在一样 | 有页才出 Tree |

## 信息架构与关键界面

Table 模式、已连接：

```text
┌ chrome: Table|Index · blkno Load …     [Detail][Hex][Tree] ☀ ┐
├ 次带无 table 下拉                                                ┤
├ [ 表名  N blk ] │ 未选：提示用 Tree 选表                         │
│   blk 0         │ 已 Load：结构图 + hex（Hex 开时）              │
│   blk 1         │                                                │
└─────────────────┴────────────────────────────────────────────────┘
```

未 Load 且 Tree 关：无左列，主区一句「Open Tree to pick a table」。

## 关键流程

| 步骤 | 用户动作 | 系统反馈 | 空态 / 加载 / 错误 |
|---|---|---|---|
| 1 | Connect，kind=table | Tree 开，列出 tables | 无表：`no user heap tables` |
| 2 | 点表名 | 选中、展开、Load blk 0；已展开再点则收起 | 0 blk：空表提示，不请求 |
| 3 | 点箭头 | 只展开/收起块 | 大表窗口提示沿用 |
| 4 | 点 blk | Load 该块 | 已是当前块则跳过 |
| 5 | 切 Index | 树关、恢复下拉 | 有索引页后再出 B-tree 树 |

## 布局与视觉方向

- 复用 `.pane-tree` / `.btree-tree-row`。选中表与当前块用文字 accent，不行底、无左边条，避免父子被色块拆开。行 `min-height: 1.4rem`、无垂直 margin。
- 子行 `--tree-indent: 1.25rem` + 竖向引导线，表名 `.btree-tree-blk` ellipsis + `title` 全名。块数用 `.btree-tree-kind` pill（`N blk`）。
- 无页时 `main-split` 仍挂树列 + 右侧 `pane-structure` 放提示（无 StructureMap / hex）。
- 宽屏三栏（树 / 结构图 / hex）之间有可拖动分隔条；hex 默认与结构图等分剩余宽度，上限 1600px。宽度记在 localStorage（无凭据）。
- 明确避开：新主色；把表名再塞回次带。

## 组件与交互约定

| 区域或组件 | 约定 | 复用既有系统？ |
|---|---|---|
| chrome Tree | Table+已连接即出现，不依赖 pageView；Detail/Hex 仍要有页 | 是 |
| 表节点 | `role=table`；expander 当 `blocks>0` | `BtreeTreePanel` |
| 块节点 | 现有 `role=page`，depth 1 | `visibleHeapBlockList` |
| aria | 目录树 `aria-label="Tables"` | 是 |

## 响应式与无障碍

| 项 | 约定 |
|---|---|
| 断点 | 沿用 `<960` 树上、图下 |
| 键盘 | expander / 标签仍是 button |
| 截断 | 可见文字可截，全名在 title |

## 开放问题

N/A

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| 表很多时树很长 | 难找 | v1 不搜索；面板可滚 |
| resetTree 把树折上 | 点表后导航消失 | 选表不清 collapsed |

## 对 Plan 与 Developer 的要点

### Plan

- `visibleTableCatalog` 单测覆盖 P0 列表/展开/空表
- `treeChromeVisible` 改为 kind+page 感知
- App：拆 chrome Tree 可见性；无页时也能挂 `main-split`

### Developer

- 点表 Load 把 oid 传进 `loadBlk`，不要等 `selectedOid` setState
- Index 的 `select.table-select` 过滤器保留
- 不要改 HEAP_BLOCK_LIST_CAP

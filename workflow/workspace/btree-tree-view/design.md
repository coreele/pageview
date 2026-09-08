# Design: btree-tree-view

> 只记录需要决策的结构事项。行为合同属 `spec.md`，界面属 `ui-design.md`，任务拆解属 `plan.md`。

## 背景与约束

在 Page 模式 B-tree 页与 heap 表页上增加可折叠导航面板。约束来自已确认 Spec：

- 复用既有 `GET /api/indexes/:oid/pages/:blkno`；不强制新端点
- 页类型 / downlink 只来自 raw bytes 解析（与 `index-viewer` 一致）
- 按需取页；打开树不得预取全部叶
- 为展开而取的祖先页不得替换主区当前页
- 不把折叠态写入 URL
- web `App.tsx` 已很大；树状态不应再把取页缓存逻辑内联进 Load 主路径

现有分层：`page-core` 解析单页；`apps/server` 透传 raw page；`apps/web` 持有单一 `pageView` 驱动三联区。

## 方案对比与决策

### 1. 取页路径：复用 raw page vs 新聚合端点

| 方案 | 概要 | 优点 | 缺点 | 比较依据 |
|---|---|---|---|---|
| A | 客户端按需 `fetchIndexPage` + `parseBtreePage`，内存缓存 | 无新 API；与「字节是真相」一致；hex 当前页仍是同一解析器 | 路径上的每一层一次 HTTP；深树多几次往返 | Spec 允许不新增端点；高度通常 2–4 |
| B | server `bt_page_stats` / 批量 blk 聚合 | 少往返 | 第二条数据路径；与 index-viewer「server 不预解析」冲突；hex 仍要 raw 页 | Spec 非必须新端点 |
| C | 打开树时 server 走完整棵 | UI 简单 | 违反 P0-5 | 直接排除 |

**决策：A。** 打开树 = meta + root + 沿当前页路径的 internal；展开节点 = 只取该页。

### 2. 下行指针提取：page-core vs 仅 web

| 方案 | 概要 | 优点 | 缺点 |
|---|---|---|---|
| A | `page-core` 导出纯函数：从 `ParsedBtreePage` 得 child blk 列表、节点摘要、在已缓存页上求根到目标的路径 | 无 React、可单测、与 hikey 规则单一来源 | page-core 多一个小模块 |
| B | 全写在 web | page-core 零增 | hikey/meta/root 规则易与解析层漂移 |

**决策：A。** 新文件 `packages/page-core/src/btree-tree.ts`（不改 `parseBtreePage`）。web 只做缓存、展开集、fetch 调度与面板。

### 3. 树缓存 vs 主区 `pageView`

| 方案 | 概要 | 优点 | 缺点 |
|---|---|---|---|
| A | 独立 `Map<blkno, CachedNode>`；主区仍只有当前页。当前页变化时写入/覆盖对应缓存条目 | 展开祖先不 `loadIndexBlk`；主区 Load 失败不拆树 | 同一页可能双份解析结果，短暂不一致 |
| B | 把 `pageView` 改成多页 store | 单一数据源 | 大改 App 状态机，超出范围 |

**决策：A。** 当前页成功 Load 后把该 `ParsedBtreePage` 写入树缓存。展开 fetch **禁止**走 `loadIndexBlk`。

### 4. 路径查找（P0-4）

无 parent 指针。在已缓存页上：

1. 取 meta（blk 0）；优先 `btm_root`，仅当目标不在 root 子树而出现在 fastroot 子树时改走 fastroot（Spec 裁决 4）。
2. 若目标等于该 spine 上某页的 **直接** downlink，路径即确定（高度 2 时只多取 root）。
3. 目标不是直接孩子：不在打开时 BFS 全部 internal（扇出可达上百）。只把已缓存的 internal 往下探；找不到则当前页以 **孤立节点** 展示（P1-2），不假装挂在 root 下。
4. 用户之后展开分支若发现目标，再把它从孤立区收回路径高亮。

集成种子 `uq_k_idx` 为 root internal + 叶，走步骤 2 即可验 P0-4。

## 模块边界与分层

```text
page-core/src/btree-tree.ts     # 纯函数：downlinks / 节点摘要 / pathFromCache
page-core/tests/btree-tree.test.ts
apps/web/src/btreeTree.ts       # 缓存类型、expand/collapse、哪些 blk 该 fetch
apps/web/src/btreeTree.test.ts
apps/web/src/BtreeTreePanel.tsx # 展示：树列表、高亮、展开、失败重试
apps/web/src/App.tsx            # chrome 开关、pane 挂载、fetch 调度、换关系 reset
```

依赖方向：`BtreeTreePanel` → `btreeTree` 类型 → `page-core` 纯函数。**禁止** panel import `App`。**禁止** server / wal-core 改动。

`btreeDownlinks(page)`：

- meta：`btm_root`；若 `btm_fastroot !== btm_root` 再追加 fastroot（去重，root 在前）
- internal：非 hikey 的 LP_NORMAL tuple 的 `t_tid.blockNumber`（顺序保留）
- leaf / 不可解析：`[]`

节点摘要：`pageType`、`btpo_level`（meta 为 null）、`flags` 四芯片、`isRoot`。

web 缓存条目：`{ status: loading | ready | error, page?, error?, children?: number[] }`。`ready` 时 `children = btreeDownlinks(page)`。未取到的子节点只有 blkno，类型未知，可展开（展开即 fetch）。叶在 fetch 后不可再展。

## 表模式列表（2026-09-08 更正）

heap 没有拓扑。面板数据来自已加载表的 `blocks`，不请求 `/api/indexes`、不写树缓存。

`visibleHeapBlockList(blockCount, currentBlkno)`：`blocks ≤ 2000` 列出全部；更大则窗口对准当前 blk（约 2000 行）并带范围提示。点击走 `loadBlk`，`relationKind` 保持 table。

索引模式仍用按 oid 分片的树缓存与 `visibleTree(state, oid, currentBlkno)`（页拓扑，无索引名根节点）。

## 影响面

- `App.tsx` chrome-actions 增加按钮；heap 与 btree 的 `main-split` 均可挂左/上 pane
- 换表 / 换索引 / 换 kind / 切 WAL 必须清树状态
- README 说明：索引=树，表=块列表
- 不改 URL schema、不改 server 路由

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| 高度 ≥ 3 打开时找不到祖先 | P0-4 在深树上弱化为 P1-2 孤立节点 | Plan 以高度 2 种子验 P0-4；深树不阻塞 |
| 树 fetch 与主区 Load 并发 | 当前页被展开请求抢写 | 展开只用 `fetchIndexPage`，不调用 `loadIndexBlk` |
| 三栏挤布局 | 结构图过窄 | UI：树列 max-width；折叠卸载 |
| 扇出上百 | 卡顿 | 子列表滚动；不虚拟列表也可先做（Spec 允许滚动） |

## 对 Plan 与 Developer 的要点

### Plan

- 先 page-core 纯函数 + 测试，再 web 缓存/路径测试，再面板与 App 接线
- P0-5 用 mock `fetchIndexPage` 计数，不要依赖「打开即拉全库」
- 无新 server 任务

### Developer

- 不要改 `parseBtreePage` / heap / WAL
- 树 fetch 失败不要 `setPageView(null)`
- 换索引必须丢掉 cache，避免串页
- 按钮在 `pageView.kind === "btree" | "heap"` 时渲染；表模式禁止列索引或切 kind

# Spec: btree-tree-view

> 需求与行为合同，先于 Plan 完成。任务拆解见同目录 `plan.md`。
>
> **feature-id**：`btree-tree-view`（未拆分）
>
> **确认记录**：路径 `full`；Spec 用户确认 **approved**（2026-09-07）。用户裁决：树视图做成与 **Collapse detail / Collapse hex** 同类的开关面板，不替换主区三联区。**2026-09-08** 用户扩大范围：同一开关同步到 table 模式。同日更正：table 没有树，面板是堆块号**列表**（不是该表索引森林）。
>
> **Design 门禁**：`required`。树模型如何从 raw page 组装、是否新增只读聚合端点、虚拟列表，由 `design.md` 决定。本文件对解析层归属保持中立。
>
> **适用对象 / 前置条件**：Planner 与 QA；已连接 PostgreSQL、已启用 `pageinspect`、存在用户 B-tree 索引。对照 oracle：`bt_metap` / `bt_page_items`。

## 背景与目标

现状：Page 模式可浏览 B-tree 索引页。导航是页内指针（`btpo_prev` / `btpo_next`、downlink、root/fastroot）。一次只看见当前 8KB 页。

用户要求：增加树结构，作为**可选面板**。2026-09-07 确认交互形态：**与 detail / hex 一样用开关**，而不是互斥切走三联区。

目标：

1. 已加载 B-tree 索引页后，chrome 出现 **Show tree / Collapse tree**，默认折叠；展开后主区多一块树面板，结构图 / hex / 详情仍在。
2. 树按拓扑展示可达页，高亮当前 blkno；展开节点列出子页（按需取页，禁止全叶预取）。
3. 激活节点即加载该 blkno 为当前页（三联区跟着更新）；面板保持打开。索引模式加载同索引页；表模式加载同表堆页。WAL / 既有块导航不回退。

## 非目标

- 新增与 Page / WAL 并列的第三 chrome 模式
- 用树**替换**结构图 / hex / 详情（禁止互斥 `structure | tree` 主区切换）
- 默认展开树（必须与 hex/detail 一样有开关，但默认折叠，以免改变现有扫读布局）
- 树开关状态写入 URL（与 hex/detail 折叠同属瞬态，见 `url-deeplink` 非目标）
- 打开树时一次性拉取该索引全部叶页或全部块
- 按键查找 / 树节点上展示解码键值
- 非 B-tree AM 的页拓扑；在 heap 上画 B-tree；从表导航切到 index kind
- 表模式下列出该表索引或跳进索引页
- 修改 `/api/tables/*`、heap `parsePage`；非 8KB 页；WAL 变更；写入类操作

## 范围与可见行为

### 在范围

1. **开关（对齐 hex / detail）**
   - 顶栏仍只有 **Page | WAL**。树不是新 mode。
   - 已成功加载一篇 **B-tree 索引页或 heap 表页**时，chrome-actions 出现树开关，文案与现有开关同形：展开态 **Collapse tree**，折叠态 **Show tree**；`aria-expanded` / `aria-controls` 指向树面板。
   - 默认**折叠**：不渲染面板、不占列（与 hex 折叠卸载 pane 相同）。
   - 展开：在主分栏中挂载面板；结构图与（未折叠的）hex / detail **继续显示**。
   - 再点折叠：卸载面板；不丢关系选择、当前 blkno、已加载页、hex/detail 折叠态。
   - 开关本身不 Load 当前页。WAL、未加载页：不出现该按钮。
   - **表模式（2026-09-08 更正）**：面板是当前表的**扁平块号列表**（`blk 0` … `blk blocks-1`），不是 B-tree，也不列出该表索引。点一行 Load 该堆页，保持 table kind。块数过大时只渲染当前块附近窗口，并提示范围。

2. **索引树里有什么**
   - **meta 节点**：blk 0，标 `meta`；子节点为 `btm_root`，若 `btm_fastroot` 不同则两者都列出。
   - **数据页节点**：经 downlink 可达的页。节点至少：blkno、`internal` / `leaf`（root 另标）、`btpo_level`。
   - **当前页**高亮。首次展开树时，从 meta/root 到当前页的路径自动展开（路径规则见已裁决 4）。
   - 同一父页子节点顺序 = 该页 downlink 顺序，不按 blkno 数值排序。
   - 状态芯片（有则显示，次要字重）：`deleted`、`half-dead`、`garbage`、`incomplete-split`。
   - 不在 root 子树中的 blk 默认不进树；若当前加载的就是该块，以孤立节点 + 警告展示。

3. **展开与加载**
   - 首次打开树：允许为 meta、root、以及到当前页的路径取页；**禁止**为画完整树预取全部叶页或全部块。
   - 折叠的节点不显示子页；展开某 internal 后才取**该页**以列出子 blk。
   - 子列表不得静默截断；很多子页时滚动即可，计数可感知。
   - 叶节点不再展出索引子页（heap TID 仍走既有 peek）。
   - 仅为展开而取的页进入树缓存，**不得**因此把主区当前页换成被展开的祖先页。

4. **在面板中导航**
   - **索引**：激活某 meta/数据页节点：将该 blkno Load 为当前索引页（已是当前页则不重复请求）。三联区更新。面板保持展开。
   - **表**：激活某块号：将该 blkno Load 为当前堆页。不改 `relationKind`，不切索引。
   - Load 失败：当前页与高亮保持失败前；既有错误面板；其余节点仍可操作。
   - 次带 Load / 块导航成功后，高亮跟随当前 blkno；可见则滚入可视。
   - 换**表**、换索引、表 ↔ 索引切换、改索引侧表过滤器、切 WAL：清除展开态与树缓存（表列表与索引树内容不同）。

5. **明确保留**
   - 结构图 / hex / 详情 / 块导航 / heap peek / Refresh diff
   - 索引发现与非 B-tree 拦截
   - heap 与 WAL；错误形状；light/dark；URL 深链既有参数（不新增 `view`）

## 合同

### API / 接口

| 项 | 合同 |
|---|---|
| 既有页端点 | `GET /api/indexes`、`GET /api/indexes/:oid/pages/:blkno` 不变。树每一页仍经该端点或 Design 批准的只读等价物取得。 |
| 新端点 | 非必须。若有聚合接口：只读、`pageinspect`、错误形状 `{code,message,nextStep}`；不得破坏按需展开合同。 |
| URL | **不**增加 `view` 或树折叠参数。未知参数仍忽略。 |

### 数据 / 状态

| 概念 | 合同 |
|---|---|
| 折叠态 | 与 hex/detail 同类的布尔：`treeCollapsed`，默认 `true`。不是 chrome `mode`。 |
| 当前页 | 选中索引 + 已加载 blkno；树高亮与三联区共用。 |
| 树节点 | `{ blkno, kind: meta \| internal \| leaf, level, flags 芯片, childrenBlk[] 仅当该页已取到并解析 }`。子 blk 来自该页解析，不猜测。 |
| 展开态 / 缓存 | 会话内存；换关系即丢。不写 localStorage，不写 URL。 |
| 元信息来源 | 类型、level、flags、子指针来自已取回页的解析（或与 `bt_page_items` 一致的只读 oracle）。禁止未展开就整树预解析。 |

### 错误与约束

| 约束 | 合同 |
|---|---|
| 展开失败 | 该节点失败 + 可重试；其他分支保持。复用既有页加载错误码。 |
| 解析部分失败 | 可解析部分仍展示，异常警告，不得崩溃。 |
| 无按钮 | 未加载 heap 页且未加载 B-tree 页时不出现 Show tree。WAL 永不出现。 |
| 禁止 | 为渲染树而写入 SQL（`CREATE EXTENSION` 自动安装除外）；全量叶预取；静默丢子节点。 |

## 验收

### P0

- **P0-1 默认三联区、树折叠**  
  Given 已加载 B-tree 索引页且用户未点树开关，  
  When 查看主区与 chrome，  
  Then 结构图 / hex / 详情行为与本项之前一致；树面板未挂载；按钮为 **Show tree**。

- **P0-2 开关展开/折叠**  
  Given 已加载 B-tree 索引页，  
  When 点 Show tree 再点 Collapse tree，  
  Then 先出现树面板且三联区仍在，再卸载树面板；索引、blkno、已加载页不变。

- **P0-3 WAL 无按钮**  
  Given 当前为 WAL，  
  When 查看 chrome-actions，  
  Then 无 Show tree / Collapse tree。

- **P0-4 路径自动展开且高亮当前页**  
  Given 已加载非 meta 的 B-tree 页，  
  When 展开树且到当前页的祖先均可达，  
  Then 从 meta/root 到该 blkno 的路径展开，该节点高亮。

- **P0-5 按需展开，禁止全叶预取**  
  Given 高度 ≥ 2、叶页数明显大于路径长度的索引，  
  When 打开树且用户未展开其他分支，  
  Then 未对路径与 root/meta 以外的全部叶页发起请求；展开某一 internal 后才请求该页。

- **P0-6 激活节点加载当前页，树保持打开**  
  Given 树已展开且可见某尚未作为当前页的子节点，  
  When 用户激活该节点且加载成功，  
  Then 当前 blkno 变为该页，三联区与元信息条更新，树仍展开且高亮跟随。

- **P0-7 换表 / WAL 退出树**  
  Given 树已展开，  
  When 用户改选另一张表或切到 WAL，  
  Then 树展开态与缓存清除。

- **P0-9 表模式块列表**  
  Given 已加载 heap 页，该表 `blocks = N`（N 在软上限内），  
  When 点 Show tree，  
  Then 面板列出 `blk 0` … `blk N-1`（扁平，无 expander），当前 blkno 高亮；不出现索引名。

- **P0-10 表列表加载堆页**  
  Given 表模式列表已展开且可见另一块号，  
  When 用户激活该行且加载成功，  
  Then 仍为 table kind，当前页为该堆 blk，面板仍打开且高亮跟随。

- **P0-8 既有路径不回退**  
  Given 表页与索引三联区既有操作（选表加载、块导航、非 B-tree 拦截、hex/detail 开关），  
  When 本项完成后执行，  
  Then 行为与本项之前一致。

### P1

- **P1-1 节点状态芯片**：deleted / half-dead / garbage / incomplete-split 在对应页节点上可见。
- **P1-2 孤立当前页**：当前 blkno 不在 root 子树中时，孤立节点 + 警告，不画到 root 下。
- **P1-3 展开失败可重试**：失败只影响该节点，错误形状与既有页加载一致。

## 开放问题

无。已裁决（2026-09-07）：

1. **URL**：不编码树开关（与 hex/detail 折叠一致）。
2. **激活节点**：不关树；三联区就地更新。
3. **控件**：chrome **Show tree / Collapse tree**，与 detail/hex 同类，不是 `Structure \| Tree` 分段。
4. **root vs fastroot**：自动展开优先 `btm_root`；当前页只在 fastroot 子树时改走 fastroot；meta 上两者都可激活。

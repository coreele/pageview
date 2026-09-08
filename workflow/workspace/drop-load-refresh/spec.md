# Spec: drop-load-refresh

> 需求与行为合同，先于 Plan 完成。任务拆分见同目录 `plan.md`。
>
> **feature-id**：`drop-load-refresh`
>
> **确认记录**：路径 `standard`；Spec 用户确认 **approved**（2026-09-08「ok」）。Tree / Single 互斥；Tree 精简次带、点 blk 加载/再点 Refresh；Single 保持现次带、不加下拉、不自动开树。

## 背景与目标

表/索引已从左侧树选择。Page 次带仍是「下拉时代」的全套按钮，与树重复；大表/大索引若靠树列出所有 blk，导航会膨胀。用户要把右上角 **Tree** 做成明确的两种模式。

目标：

1. **Tree 模式**：左侧目录浏览（现 TABLE / INDEX 树）。点 blk 加载；再点当前 blk 即 Refresh。次带去掉与树重复的控件。
2. **Single 模式**（关掉 Tree）：无左侧目录。用当前次带形状按 blkno 单点查找当前已选关系的某一页。给大表/大索引一条不靠树展开所有块的路径。
3. Single **不**把表/索引下拉加回来，也**不会**为了选表而打开或切到 Tree。左列在 Single 下始终没有。

## 非目标

- 把表/索引 `<select>` 加回 Single 次带
- 改 WAL 次带 Load / recent 20
- 改结构图 / 详情区「Load blk N」等跳页按钮
- 改 HeapPeek 浮层
- 改 Refresh 的 diff 算法、错误码、失败时是否清页
- 新 URL 参数（Tree/Single 不进 URL）
- 改 `loadBlk` / `loadIndexBlk` 的 API 形状
- 点**表名 / 索引名**当 Refresh（再点表名仍是收起）
- 改变 Tree 里表/索引段的折叠与 max-height 合同

## 范围与可见行为

### 1. 右上角 Tree / Single

Page 模式、已连接：右上角现 **Tree** 单按钮改为与 Page|WAL 同类的两组：**Tree** | **Single**（仍在 Detail / Hex 旁，不进 WAL）。

| 模式 | 开关 | 左列 | 用途 |
|---|---|---|---|
| Tree | Tree 亮 | TABLE / INDEX 目录 | 按关系/块浏览 |
| Single | Single 亮 | 无目录 | 对**当前选中**表或索引按 blkno 查一页 |

- 两组互斥；不能同时亮。
- 连库后、Page 默认 **Tree**（与现在默认开树一致）。
- 不写入 URL / localStorage。F5 后回到默认 Tree；深链 Load 不强制改模式（实现保持默认 Tree 即可，与现 restore 开树一致）。
- WAL：无此开关。
- Detail / Hex 独立，不随 Tree/Single 改变。

### 2. Tree 模式次带

精简：不显示 Table|Index、blkno、Load、Refresh、Prev、Next。

已 Load 时 **页统计条**（table/index、#blocks、blkno、page…）仍在。Index 非 B-tree 行内提示仍可出现在主区，不靠次带按钮。

选 kind：点树里的表或索引（现合同）。chrome 不再用 Table|Index 切换。

### 3. Single 模式次带

保持**现在**的形状：

`Table | Index` · `blkno` · `Load` · `Refresh` · `Prev` · `Next`

语义与现在相同（含 blkno Enter = Load、Refresh 的 diff、Prev/Next 规则、切 Table/Index 清当前页）。无左侧树。

未选表/索引：Load / Refresh / Prev / Next 按现在未选时禁用。主区用现有「未选表 / 未选索引」类提示。**不**自动切到 Tree，**不**出现「请先开 Tree」这类文案。

若会话里已经有选中的表或索引（刚才在 Tree 点过，或 URL 带了 table/index）：切到 Single 后 oid 仍在，改 blkno 即可 Load。

### 4. Tree 里点 blk（仅 Tree 模式）

只对 **page 行**：

| 当前状态 | 点该 blk 行名字 | 请求 |
|---|---|---|
| 尚未显示该关系的该块，或显示的是别的块 | Load | 无 `refresh` |
| 已成功显示同一关系、同一 blk | Refresh | `{ refresh: true }` |
| `loading-page` | 忽略 | 不发第二发 |

点 expander 只展开/收起。点表名/索引名仍是 index-tree-nav（选中并 Load blk 0，或再点收起），**不是** Refresh。

### 5. Refresh 语义

与现 Refresh 按钮一致：成功则 diff；失败保留当前页；同一 blk 且 URL 已有该 `blkno` 时不新增 history。刷新目标是当前显示块（树点的行，或 Single 里 Refresh 按钮用的显示块，不用未提交的 blkno 脏值——Single 的 Refresh 按钮合同与现在相同，即现实现若用输入框值则不在本项改）。

### 6. 大表 / 大索引

Single 的存在就是为了不靠树列出全部块。本项**不**改 `HEAP_BLOCK_LIST_CAP` 或 B-tree 按需展开；不要求 Single 去拉整棵树。

### 7. 文案

Tree 模式主区不再写「press Load」。未选关系：点目录里的表或索引。Single 且未选关系：不提 Tree。

## 合同

### API / 接口

N/A。

### 数据 / 状态

- Tree/Single 对应现 `btreeTree.collapsed`（false=Tree，true=Single），或等价布尔；不进 URL。
- `selectedOid` / `selectedIndexOid` / `loadedBlkno` 在两种模式之间保留，除非用户切 Table|Index（仅 Single 次带有该开关）走现清页逻辑。
- `loadBlk(..., { refresh: true })` 保留，Tree 点当前 blk 与 Single 的 Refresh 按钮都走它。

### 错误与约束

- 不引入新错误码。
- 非 B-tree：Tree 点索引名仍不发 page 请求；Single 下 Load 仍禁用。
- 越界 blkno：仅 Single 的 Load/Enter，现错误码。

## 验收

### P0

- **P0-1** Given Page 已连接，When 看右上角，Then 有互斥的 **Tree** 与 **Single**；默认 Tree 亮、左列目录在、次带无 Table/Index/blkno/Load/Refresh/Prev/Next。
- **P0-2** Given Tree 模式，When 点 **Single**，Then 左列消失；次带为 Table|Index、blkno、Load、Refresh、Prev、Next。
- **P0-3** Given Tree 已显示 heap blk 0，When 再点树里同一 `blk 0` 名字，Then Refresh（非空操作）。
- **P0-4** Given Tree 已显示 heap blk 0，When 点另一 blk，Then 普通 Load 该块。
- **P0-5** Given Tree 已显示某 B-tree 页，When 再点同一页行，Then `loadIndexBlk(..., { refresh: true })`。
- **P0-6** Given Tree 选中一张表并已 Load，When 切到 Single 并 Load 另一合法 blkno，Then 成功且无目录。
- **P0-7** Given WAL，When 看 chrome，Then 无 Tree/Single 开关；WAL Load 仍在。

### P1

- 点 page expander 不刷新；再点表名仍收起。
- 同一 blk Refresh 不新增 history。
- Single 未选关系时不能 Load；主区不提示去开 Tree。
- README 中英写明 Tree 浏览 vs Single 按 blkno 查找。

## 开放问题

N/A（下列默认已写入范围；若驳回请改对应条）：

- 右上角改为 **Tree | Single** 两组，不再是单独的 Tree 开关。
- Tree 次带去掉 Table/Index、blkno、Load、Refresh、Prev/Next；Single 次带保持现状。
- Single 不加回表/索引下拉，也切不过去 Tree。
- Tree/Single 不进 URL；连库默认 Tree。

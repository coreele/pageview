# Spec: export-structure-png

> 需求与行为合同，先于 Plan 完成。任务拆分见同目录 `plan.md`。

## 背景与目标

把当前 Page 结构图导出为 PNG，嵌入笔记（Obsidian / Typora 等）。系统截图会裁掉内部滚动、并带上 Tree 与 chrome。

成功标准：已加载的 heap 或 B-tree 页，一次操作得到**结构图全高** PNG（free space 仍按界面折叠），图顶有关系名与块号，同时进入剪贴板并下载文件。主题跟随当前 light/dark。

用户已确认 v1 提案（会话「可以」）。

## 非目标

- Hex dump、Tree 目录、连接栏、WAL 列表或 WAL 详情
- 结构图旁的 Selection detail 面板
- SVG / PDF / Markdown 包 / 图床 / 服务端出图
- 强制浅色导出（用户要浅色图时先切主题）
- 只截当前视口
- 改解析、diff 语义、页布局或 32B 合同
- 应用内执行 DML

## 范围与可见行为

### 入口

- Page 模式且**已加载** heap 或 B-tree 页时：chrome `.chrome-actions` 出现 **Export**（Tree / Detail / Hex 之后、主题钮之前）。不是开关，无 `--on` 态。
- WAL 模式、未连接、已连接但尚无页：不出现 Export。
- 快捷键：有可导出页时，`Ctrl+Shift+C`（macOS `Meta+Shift+C`）等同点击 Export。输入框内仍生效（笔记快捷键优先于输入）。`preventDefault`，避免浏览器「复制」。
- Heap peek 浮层打开且其中堆页已加载：chrome 被遮罩，浮层标题栏在 Close 左侧提供同一 **Export**。快捷键与按钮都导出**浮层**结构图，不导底下的索引页。

### 导出内容

PNG 包含且仅包含：

1. 一行标题：`{qualifiedName}  ·  {heap|index}  ·  blk {n}`（index 不要求再写 leaf/meta；heap peek 用浮层关系名与其 blkno，kind 为 `heap`）。
2. 图例 + 32B 结构行（与当前 `.structure-flow` 一致，含选中高亮与 Refresh diff 着色）。
3. 全高：展开内部滚动，不是视口裁切；free space 折叠带宽与屏上一致。

禁止打进 PNG：Tree、Hex、chrome、Detail 面板、滚动条、浮层遮罩与 Close。

### 输出动作

一次成功导出必须：

- 尝试把 PNG 写入系统剪贴板（`image/png`）；
- 下载文件，默认名 `{sanitized}_{heap|index}_blk{n}.png`。`sanitized` 由 qualifiedName 得到：非 `[A-Za-z0-9._-]` 的字符改为 `_`，连续 `_` 合并，去首尾 `_`，空则用 `page`。

剪贴板被拒（权限 / 非安全上下文）时：**仍须下载**，并给出可读说明（非崩溃）。栅格化失败：不下载、不静默；页面展示错误（可用既有 `error-panel` 形态），Export 恢复可点。

导出进行中按钮禁用，文案 **Exporting…**。

### 主题

栅格化使用当前 `data-theme`。不另做「导出用浅色」开关。

## 合同

### API / 接口

N/A。纯前端；不新增 server 路由。

### 数据 / 状态

- 不把 PNG 或页字节写入 URL / localStorage。
- 不新增持久 state；进行中仅为瞬时 UI。
- 导出不改变选中、diff、折叠、浮层开关。

### 错误与约束

- 无页 / WAL：无 Export，快捷键忽略。
- 浮层 loading 或 error：Export 禁用（含快捷键忽略）。
- 剪贴板失败 ≠ 整次失败（下载成功即主路径成功）。
- 栅格化抛错或空 blob：失败，见上。

## 验收

### P0

- **P0-1** Given Page 模式已加载 heap 或 index 页，When 用户看 chrome，Then 可见 Export；WAL 或无页时不可见。
- **P0-2** Given 已加载页，When 点击 Export 且栅格化成功，Then 得到一张 PNG：含标题行（关系名、heap|index、blkno）与全高结构图（含图例与折叠 free），不含 Tree / Hex / Detail / chrome。
- **P0-3** Given 同 P0-2，When 导出成功，Then 触发文件下载，文件名符合 `{sanitized}_{heap|index}_blk{n}.png`。
- **P0-4** Given 同 P0-2 且剪贴板 API 可用，When 导出成功，Then 剪贴板含 `image/png`。
- **P0-5** Given 剪贴板写入被拒，When 栅格化成功，Then 仍下载 PNG，并显示剪贴板失败说明。
- **P0-6** Given 已加载页，When 按 Ctrl/Cmd+Shift+C，Then 与点击 Export 同一套成功/失败行为。
- **P0-7** Given heap peek 浮层已打开且堆页 loaded，When Export 或快捷键，Then PNG 是浮层那张堆页（标题用浮层表名与 blk），不是底下索引页；浮层标题栏有 Export。
- **P0-8** Given 当前有选中或 diff 着色，When 导出，Then PNG 中对应格子着色与屏上一致（不发明新语义）。

### P1

- **P1-1** Given 浮层 loading 或 error，When 看 Export / 按快捷键，Then 按钮禁用且不导出。
- **P1-2** Given 栅格化失败，When 用户已点 Export，Then 无下载、有错误展示、按钮恢复可点。

## 开放问题

N/A（v1 已由用户确认）。

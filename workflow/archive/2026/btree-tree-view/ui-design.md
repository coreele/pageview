# UI Design: btree-tree-view

> 只记录需要决策的界面与交互事项。依据 Spec `workflow/archive/2026/btree-tree-view/spec.md`、Design `design.md`。主题：沿用 light/dark，不新增皮肤。

## 背景与范围

在已加载 B-tree 索引页**或 heap 表页**时，chrome 增加与 **Collapse detail / Collapse hex** 同类的 **Show tree / Collapse tree**。展开后主分栏多一块导航面板；结构图与 hex 仍在。索引模式为 B-tree 拓扑；表模式为堆块号扁平列表。WAL 无此按钮。

## 非目标

- `Structure | Tree` 分段或替换三联区
- 树面板内再放一套 Collapse 按钮（入口只在 chrome，对齐 hex）
- 树节点上展示解码键
- 改主带控件顺序中 Theme 的位置（仍最右）

## 用户与关键场景

| 角色或场景 | 目标 | 备注 |
|---|---|---|
| 扫读当前页 | 默认不看到树 | 与现在一致 |
| 看清自己在哪一层 | 打开树，当前 blk 高亮 | 路径自动展开 |
| 跳到子页/root | 点节点，三联区换成该页 | 树保持开 |
| 关掉树 | Collapse tree | 面板卸载，不占列 |
| 看表页块列表 | 打开面板，点另一 blk | 扁平，无 expander |
| WAL | 无树按钮 | P0-3 |

## 信息架构与关键界面

```text
┌─ 主带 ─────────────────────────────────────────────────────────┐
│ 标题 · 徽标 · [Show detail] [Show hex] [Show tree?] · Theme     │
│                         tree 在 btree 或 heap page_loaded 时出现 │
├─ 次带 ─────────────────────────────────────────────────────────┤
│ 表|索引 · 选择 · blkno · Load · Refresh · 页统计（不变）         │
├─ Main ─────────────────────────────────────────────────────────┤
│ 树折叠:     [ Structure+detail ] ‖ [ Hex ]     （现状）          │
│ 树展开:     [ Tree ] ‖ [ Structure+detail ] ‖ [ Hex ]           │
│ hex 折叠时不渲染 hex 列；树折叠时不渲染树列、无占位               │
└────────────────────────────────────────────────────────────────┘
```

chrome-actions 从左到右：**detail → hex → tree（若有）**。Theme 仍在 `chrome-theme` 格，不进 actions。

树面板无标题大字「TREE」；直接是可滚动树（对齐 hex 面板无 HEX 标签）。

## 关键流程

| 步骤 | 用户动作 | 系统反馈 | 空态 / 加载 / 错误 |
|---|---|---|---|
| 1 | Load 某 B-tree 页 | 出现 **Show tree**；树未挂载 | 按钮不抢焦点 |
| 2 | 点 Show tree | 挂载树；取 meta/root/路径；文案变 Collapse tree | 面板内 spinner；路径节点可先出现 |
| 3 | 展开未取过的 internal | 该节点 loading，然后列出子 blk | 失败：节点旁原因 + Retry |
| 4 | 激活节点 | 主区 Load 该 blk；高亮移动 | 失败走既有 error-panel；树不关 |
| 5 | Collapse tree | 卸载面板 | 缓存可留到换关系再清 |
| 6 | 切表 / 换索引 / WAL | 按钮消失，状态清空 | — |

## 布局与视觉方向

- 构图与层级: 树是导航列，结构图仍是主扫读面。宽屏（≥960）树列 **`fit-content(13rem)`**（约 168–208px），不随视口 `fr` 膨胀；内容更短时随行宽收缩。
- 色彩: 复用 `--surface` `--border` `--accent` `--text-muted`。当前节点 `color-mix(--accent 18%, --surface)` 背景（可对齐 `.chrome-badge` 选中浓度）。类型芯片用现有 `.legend-chip` / meta-item 字号。
- 明确避开: 新主色；树里再画 32B 图；折叠后残留「Tree collapsed」占位列；宽屏树列使用 `0.28fr` / `22rem`（2026-09-07 用户反馈过宽，已废止）。

节点行：

```text
[▸] blk 3  internal L1  root
    [▸] blk 12  leaf L0          ← 当前页：强调背景
    [ ] blk 18  leaf L0
```

`▸`/`▾` 仅当节点可能有子（meta、未取尽的 internal、已取且 children 非空）。叶无 expander。

孤立当前页：树根下一条警告 + 单独节点，不连到 meta。

## 组件与交互约定

| 区域或组件 | 约定 | 复用既有系统？ |
|---|---|---|
| chrome 按钮 | `type="button"`；折叠 **Show tree** / 展开 **Collapse tree**；`aria-expanded`；`aria-controls="btree-tree-panel"` | 是，抄 detail/hex |
| 树面板 | `section#btree-tree-panel.pane.pane-tree`；折叠时不渲染 | 是，对齐 `.pane-hex` |
| 节点 | 一行 button 或可激活行；双动作：expander 与「设为当前页」分开，避免点展开误 Load。点标签 = Load；点箭头 = 仅展开 | 新组件 `BtreeTreePanel` |
| 键盘 | 按钮可 Tab；树内箭头上下移动高亮、Enter Load、Left/Right 折叠展开（能做则做；最低：Tab+Enter 可达 Load 与 Retry） | 对齐现有按钮焦点环 |
| 滚动 | 子页多时面板 `overflow: auto`；打开时把当前节点 `scrollIntoView` | 否，CSS 即可 |

## 响应式与无障碍

| 项 | 约定 |
|---|---|
| 断点 / 适配 | `<960`：树在结构图**之上**全宽；hex 仍在下（既有单列）。`≥960`：树列、结构列、hex 列从左到右 |
| 键盘 / 焦点 | 开关在 chrome tab 序中位于 hex 之后；折叠卸载后面板不可聚焦 |
| 语义 / 对比度 | 索引树 `aria-label="B-tree pages"`；表列表 `aria-label="Heap blocks"`；当前节点 `aria-current="true"`；light/dark 均用 token，不写死灰字 |

## 开放问题

N/A（Spec 已裁决开关形态与默认折叠）。

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| 三列过窄 | 结构图难扫 | 树列固定 `fit-content(13rem)`，不抢 fr；用户可 Collapse hex 或 tree |
| expander 与 Load 抢点击 | 误加载 | 箭头与标签分控件 |

## 对 Plan 与 Developer 的要点

### Plan

- 含 chrome 按钮可见性测试与 `data-tree` 布局类
- 手测点：宽屏三列、窄屏上树下图、折叠卸载无占位

### Developer

- heap 的 `main-split` 同样可有 `data-tree`，内容是块列表
- 不要在树 pane 内再放 Collapse tree
- 文案英文，与 Show hex / Collapse detail 一致

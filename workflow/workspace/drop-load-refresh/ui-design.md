# UI Design: drop-load-refresh

> 依据 Spec `workflow/workspace/drop-load-refresh/spec.md`。WAL 布局不改。

## 背景与范围

右上角 Tree 从「面板开关」改成 **Tree | Single** 两种 Page 浏览模式；次带随模式换一套控件。

## 非目标

与 Spec 相同。不新主色、不加回下拉。

## 用户与关键场景

| 角色或场景 | 目标 | 备注 |
|---|---|---|
| 连库浏览 | 默认 Tree，点目录 | 次带无 Load 排 |
| 再点当前块 | Refresh、看 diff | 不空操作 |
| 大表跳块 | 切 Single，键入 blkno Load | 左列消失 |
| WAL | 无 Tree/Single | 现 LSN 次带 |

## 信息架构与关键界面

```text
┌ Page|WAL · connected     [Detail][Hex] [Tree|Single] ☀ ┐
├ Tree：无 Table/Index/blkno/Load/Refresh/Prev/Next        ┤
│  仅页统计（已 Load）                                      │
├ Single：Table|Index · blkno · Load · Refresh · Prev/Next ┤
├ 左列仅 Tree 有 TABLE/INDEX 目录                          │
└ 主区结构图 / hex / 详情                                   ┘
```

## 关键流程

| 步骤 | 用户动作 | 系统反馈 | 空态 / 加载 / 错误 |
|---|---|---|---|
| 1 | Connect | Tree 亮，目录在 | 未选：点目录；不提请开 Tree |
| 2 | 点 blk / 再点当前 blk | Load / Refresh | loading 忽略再点 |
| 3 | 点 Single | 左列关，次带全套 | 已选关系则 blkno 可 Load |
| 4 | 点 Tree | 目录回来，次带精简 | 选中保留 |

## 布局与视觉方向

- Tree|Single 复用 `.mode-switch` / `.mode-btn`（同 Page|WAL），放在 Detail/Hex 旁。
- Tree 次带不渲染 `.chrome-controls` 里的选择与按钮；统计条仍用 `.meta-stats`。
- 避开：新主色；Single 自动切 Tree。

## 组件与交互约定

| 区域或组件 | 约定 | 复用既有系统？ |
|---|---|---|
| 浏览模式 | `aria-label="Page browse mode"`；Tree `aria-pressed` = 目录开 | 新组，状态仍 `collapsed` |
| Single 次带 | 现控件与处理函数 | 是 |
| 树 blk 行 | 当前页再点 `refresh: true` | 改 `onTreeActivate` |

## 响应式与无障碍

| 项 | 约定 |
|---|---|
| 断点 | 沿用 `<960` 树上图下 |
| 键盘 | Tree/Single 都是 button |
| 语义 | 两组 `role="group"`；树面板 `aria-controls` 仍指向 `#btree-tree-panel` |

## 开放问题

N/A

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| e2e 默认无 Load 按钮 | 深链/历史用例红 | helpers 先切 Single |

## 对 Plan 与 Developer 的要点

### Plan

- `pageRowClickAction` 单测；chrome 源码扫描 Tree/Single 与 Tree 下次带按钮缺席

### Developer

- `collapsed===true` 即 Single，不要新 URL 位
- 空态文案禁止「Open Tree / 请先开 Tree」

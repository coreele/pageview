# UI Design: export-structure-png

> 只记录需要决策的界面与交互事项。解析、32B 布局、diff 着色不改。

## 背景与范围

在既有 chrome 与 heap peek 标题栏加入 **Export** 动作，把结构图栅格化为带标题的 PNG。导出物是离屏合成，不在主视图常驻标题条。

## 非目标

- 新图标体系、把 Export 做成与 Tree 一样的 `--on` 开关
- 导出预览模态、进度条百分比
- 改 chrome grid 分区（仍用 `.chrome-actions`）

## 用户与关键场景

| 角色或场景 | 目标 | 备注 |
|---|---|---|
| 写笔记 | 粘贴或插入 PNG | 剪贴板优先，下载兜底 |
| 深色主题 | 图与当前主题一致 | 要浅色则先切太阳 |
| 索引 leaf 看堆页 | 导出浮层堆页 | chrome 被遮，浮层标题栏要有按钮 |

## 信息架构与关键界面

```text
chrome-actions:  [ Export ] [ Tree ] [ Detail ] [ Hex ]    [theme]
heap-peek-header:  {title}                    [ Export ] [ ✕ Close ]
```

WAL / 无页：Export 槽不占位。

离屏合成（不插入主布局）：

```text
┌─────────────────────────────────────┐
│ public.items  ·  heap  ·  blk 0     │  caption
│ header | ItemId | free | tuple  …   │  legend
│ 0000  [pd_lsn][…]                   │  full structure-flow
│ …                                   │
└─────────────────────────────────────┘
```

## 关键流程

| 步骤 | 用户动作 | 系统反馈 | 空态 / 加载 / 错误 |
|---|---|---|---|
| 导出 | 点 Export 或 Ctrl/Cmd+Shift+C | 按钮 **Exporting…** 禁用 | 成功：下载；剪贴板失败另附说明 |
| 浮层 | 点浮层 Export | 同上，目标为浮层结构图 | loading/error：按钮 disabled |
| 失败 | 栅格化抛错 | 错误面板，按钮恢复 Export | 无文件 |

## 布局与视觉方向

- 构图与层级: Export 是动作按钮，视觉对齐普通 `button`（与 Refresh 同类），不要 `chrome-toggle--on`。放在 chrome-actions **最左**（Tree 之前），主题钮仍最右。
- 色彩 / 字体 / 氛围: 标题用 `--text` / `--text-muted`、`--surface` 底；字号略大于格内 label，等宽关系名可选。合成画布背景 `--diagram-bg`，避免透明棋盘。
- 明确避开: 新主色；把月亮/太阳换成导出图标。

## 组件与交互约定

| 区域或组件 | 约定 | 复用既有系统？ |
|---|---|---|
| chrome Export | `type="button"`，`aria-label="Export structure diagram as PNG"` | 是，普通 button |
| 浮层 Export | 同文案；不关浮层 | 是 |
| 错误 | 既有 `.error-panel` / `.next` | 是 |
| 合成 caption | 仅离屏节点，导出后丢弃 | 新，一次性 DOM |

## 响应式与无障碍

| 项 | 约定 |
|---|---|
| 断点 / 适配 | chrome 既有换行；Export 随 `.chrome-actions` |
| 键盘 / 焦点 | 按钮可 Tab；快捷键全局（有页时）；不抢 Escape（浮层 Esc 仍关闭） |
| 语义 / 对比度 | 标题与结构图用当前主题 token，对比度不低于屏上图例 |

## 开放问题

N/A

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| 长页 PNG 很大 | 笔记插入慢 | 折叠 free 已限制高度；失败时给错误 |
| 栅格化库对 color-mix 失真 | 区域色不对 | 选型须支持现有 CSS（Plan） |
| 快捷键与浏览器冲突 | 无图 | preventDefault；仅有页时绑定 |

## 对 Plan 与 Developer 的要点

### Plan

- 扫描 App chrome-actions：Export 在 Tree / Detail / Hex 之前
- 纯函数测标题、文件名、快捷键判定、导出目标（主视图 vs 浮层）

### Developer

- 不要把 caption 永久画进 `.structure-flow`
- 克隆后把 `.structure-flow` 的 overflow 撑开再栅格化
- 浮层优先：open+loaded 时不要导底下的 index 结构图

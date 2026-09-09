# UI Design: chrome-content-gap

> 只记录需要决策的界面与交互事项。栏宽、gutter、字标不改。

## 背景与范围

Tree 打开、只显示一行 page/index 统计时，元信息条与三栏顶之间有一条显眼的深色空带。两处叠起来：`.chrome-meta` 的 `min-height: 50px`（内容垂直居中，上下留白）+ `.main` 的 `padding: 0.75rem`（露出 `--bg`）。收紧这两处，让面板贴上统计条。

## 非目标

- 改 chrome 主带高度、字标、按钮
- 改三栏内部 padding、structure legend
- 窄屏 structure/hex 之间的 `main-split` gap
- 连接表单布局

## 用户与关键场景

| 角色或场景 | 目标 | 备注 |
|---|---|---|
| 屏幕录像 | 统计条下面立刻是树/结构图/hex | 不要一条「走廊」 |

## 信息架构与关键界面

```text
[ PAGEVIEW | Page WAL | connected | … ]
[ index … blkno … ItemId … ]     ← 统计条贴内容
[ tree | structure | hex ]       ← 顶距一小撮，不要 0.75rem 深色带
```

Tree 关闭时次带仍可出现 blkno 控件行；高度随内容，不再用 50px 地板。

## 关键流程

N/A

## 布局与视觉方向

- `.chrome-meta`：去掉 `--chrome-meta-h` / `min-height`；竖直 padding 约 `0.18–0.2rem`。高度随一行统计或控件行。
- `.main`：顶 padding 约 `0.2rem`，左右/底约 `0.4rem`（窗边还留一点气，但顶不要大空带）。`gap` 可略收到 `0.4rem`（error banner 与面板）。
- 明确避开: padding 归零导致面板贴齐窗口；改 pane 内部 padding 冒充收缝。

## 组件与交互约定

| 区域或组件 | 约定 | 复用既有系统？ |
|---|---|---|
| `.chrome-meta` | 无固定 min-height | 是 |
| `.main` | 不对称 padding（顶小于左右底） | 是 |

## 响应式与无障碍

| 项 | 约定 |
|---|---|
| 断点 / 适配 | 宽窄同一套 padding；WAL 同样收顶距 |
| 键盘 / 焦点 | 不改 |
| 语义 / 对比度 | 不改 |

## 开放问题

N/A

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| WAL 控件行显得挤 | 输入框贴边 | 去掉的是地板高度，padding 仍在；控件行按内容长高 |

## 对 Plan 与 Developer 的要点

### Plan

- 扫描：`:root` 无 `--chrome-meta-h`；`.chrome-meta` 无 `min-height`；`.main` 顶 padding 为 `0.2rem` 且不再四边 `0.75rem`

### Developer

- 只改 `styles.css` token 与上述两块；不要动 App 结构

# UI Design: flag-mark-size

> 只记录需要决策的界面与交互事项。依据用户反馈：详情 flag 清单点亮圆点过小。无独立 Spec / Design。主题：沿用 light/dark，不新增皮肤。

## 背景与范围

Selection detail 里三类 ○/● 清单共用字体圆点，点亮态（实心 ●）在常见字号下约 4–5px，难辨。本项只改这类**清单圆点**，不改 infomask / `pd_flags` / `btpo_flags` 位格条方块。

出现位置：

- ItemId `lp_flags`（`.flag-list`）
- index tuple `t_info`（同一 `.flag-list`）
- 位带 `?` 全量参考列表（`.infomask-bit-strip__ref-mark`）

## 非目标

- 改位置含义、解码顺序、置位判定
- 改位格条尺寸或颜色
- 新增主题 token、第三种标记形状

## 用户与关键场景

| 角色或场景 | 目标 | 备注 |
|---|---|---|
| 扫读置位 | 一眼看到哪一行是 lit | 实心圆须明显大于现状 ● |
| 对照未置位 | 空心环仍在，但弱于 lit | 勿做成第二个实心点 |
| 暗色主题 | 同样可辨 | 用 `--text` / `--text-muted` |

## 信息架构与关键界面

构图不变：一行一标记 + 名称 — 含义。只换标记绘制方式。

```text
[●] size — IndexTupleSize = 16 B …
[○] INDEX_VAR_MASK — …
```

标记改为固定尺寸 CSS 圆，不再用 Unicode ●/○（字号随字体漂移）。

## 关键流程

N/A（无新交互；Tab 仍落在整行）。

## 布局与视觉方向

- 构图与层级: 标记与首行文字垂直居中；清单 gap 可略增以免圆点挤在一起。
- 色彩: 置位 `background: var(--text)`；未置位 `border` + 透明底，`color-mix` 不新增变量。
- 尺寸: 直径 **0.62rem**（约 10px @ 16px 根字号），显著大于现状字形点。
- 明确避开: 用 accent 色当「点亮」（会像可点击控件）；改成方块或对勾。

## 组件与交互约定

| 区域或组件 | 约定 | 复用既有系统？ |
|---|---|---|
| `FlagMark` | `span.flag-mark` + `--set` / `--unset`；`aria-hidden` | 新小组件，三处共用 |
| `.flag-list` 行 | flex，标记在左 | 是 |
| 位带参考行 | 同一 `FlagMark` 替换 `__ref-mark` 内 ●/○ | 是 |

## 响应式与无障碍

| 项 | 约定 |
|---|---|
| 断点 / 适配 | 直径用 rem，随根字号缩放 |
| 键盘 / 焦点 | 仍在整行 `tabIndex={0}`；标记不可单独聚焦 |
| 语义 / 对比度 | 置位信息仍靠行 class `set`/`unset` 与字重；标记只是视觉 |

## 开放问题

N/A。

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| 圆点过大挤行高 | 清单变疏 | 0.62rem；行用 flex 对齐 |
| 漏改一处 Unicode | 观感不统一 | 三处都走 `FlagMark`；源码不再出现 ●/○ |

## 对 Plan 与 Developer 的要点

### Plan

- 验收：三处清单无 Unicode 圆点；置位/未置位 class 可区分
- 手测 light/dark 各看一眼 ItemId 与 t_info

### Developer

- 不要改 `.infomask-bit` 方块
- 不要把标记做成 button

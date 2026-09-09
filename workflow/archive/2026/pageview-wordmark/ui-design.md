# UI Design: pageview-wordmark

> 只记录需要决策的界面与交互事项。连接、模式切换、面板开关不改。

## 背景与范围

chrome 左上 `pg-page-viewer` 对录像过长。改为 **favicon 小图 + 全大写字标 PAGEVIEW**。标签页标题与 README 一级标题跟字标一致。

## 非目标

- 新绘 logo / 吉祥物
- 改 GitHub 仓库名、包名、远程
- 改 `localStorage` 键（`pg-page-viewer.theme`、`pg-page-viewer.split.v2`）
- 改测试 schema / fixture 名
- 改 chrome 栅格（title | mode | badge | …）或字标以外的顶栏控件

## 用户与关键场景

| 角色或场景 | 目标 | 备注 |
|---|---|---|
| 屏幕录像 | 顶栏短字标进画面 | 全大写 PAGEVIEW |
| 扫顶栏 | 图标说明「这是页结构工具」 | 复用 favicon 的页头/ItemId/tuple/special 缩略 |

## 信息架构与关键界面

```text
[■] PAGEVIEW    [ Page | WAL ]    connected    …    Export Tree Detail Hex  ☾
 ↑ logo          ↑ 字标（h1）
```

logo 在字标左侧，同属一个 `h1.chrome-title`。

## 关键流程

N/A：无新交互。logo 不可点。

## 布局与视觉方向

- 构图: `h1` 保持 `inline-flex` 垂直居中；logo 与字标间距约 `0.4rem`。
- logo: `apps/web/public/favicon.svg`，约 `1.25rem` 方，圆角贴近 favicon 的 `rx`；`flex-shrink: 0`。
- 字标: 文案精确 `PAGEVIEW`；字重 ≥ 现 chrome title；全大写可略增 `letter-spacing`（正值，不再用现有 `-0.02em` 压紧）。
- 明确避开: 另做深浅两套 logo；把字标做成 CSS `::before` 伪内容；给 h1 加链接。

## 组件与交互约定

| 区域或组件 | 约定 | 复用既有系统？ |
|---|---|---|
| chrome `h1.chrome-title` | 内含 `<img class="chrome-logo">` + 文本 `PAGEVIEW` | 是 |
| logo `<img>` | `alt=""` 且 `aria-hidden`，装饰性；`src="/favicon.svg"` | 是，public favicon |
| `<title>` | `PAGEVIEW` | 是，`index.html` |
| README H1 | `# PAGEVIEW`（中英） | 是 |

## 响应式与无障碍

| 项 | 约定 |
|---|---|
| 断点 / 适配 | 字标不换行；窄屏仍在 title 栅格格 |
| 键盘 / 焦点 | 无新控件 |
| 语义 / 对比度 | 可访问名是 `PAGEVIEW`（装饰图不进名字）；字标用 `--text`，对比度跟现标题 |

## 开放问题

N/A

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| 字标+logo 仍挤 mode 开关 | 顶栏折行 | logo 1.25rem、字标短；不加大字号 |

## 对 Plan 与 Developer 的要点

### Plan

- 源码扫描：`App.tsx` 的 h1 含 `PAGEVIEW` 与 `/favicon.svg`，不含 `pg-page-viewer` 字面
- `index.html` `<title>PAGEVIEW</title>`
- README 中英第一行 `# PAGEVIEW`
- e2e heading 断言改为 `PAGEVIEW`

### Developer

- 不要改 theme/split 的 `STORAGE_KEY`
- 不要改 `favicon.svg` 画法（只引用）

# UI Design: pg-page-viewer

> **UI 表面**：gui  
> 依据 Spec：`workflow/docs/features/pg-page-viewer/spec.md` · 依据 Design：`design.md` · 依据标准：`workflow/docs/standards/ui.md`  
> 主题：light / dark（Spec 要求）

## 目标与任务

- **主目标**：在真实 heap 页上完成「看懂一页」——结构图为主，辅以 flag、列值、HOT/ctid、刷新对比、hex 联动。
- **关键任务（优先级）**：连接 → 选表+blkno 加载 → 结构浏览与五项交互 → 扫读元信息（不抢主视图）→ 主题切换仍可读。
- **信息优先级**：结构图 > 选中详情/hex > 元信息摘要 > 连接表单（已连接后降级）。

## 信息架构与元信息

### 分区（桌面默认）

```text
┌─ App chrome ─────────────────────────────────────────────┐
│ 品牌/标题 · 连接状态徽标 · [主题切换]                    │
├─ Context strip（元信息区，常驻但矮）─────────────────────┤
│ 连接：host:port / db / user · PG version（可截断+title） │
│ 表：schema.relname (oid) · blkno · #blocks               │
│ 页：8192 · lower/upper/free · ItemId N (U/N/R/D) · #tup │
├─ Navigator ────────┬─ Main（主视图）─────────────────────┤
│ 表列表              │ 结构图（header→ItemId→free→tuples） │
│ blkno + Load/Refresh│ 选中详情（flag/列值/链）            │
│                     ├─ Hex dump（可折叠高度）─────────────┤
└─────────────────────┴────────────────────────────────────┘
```

- **主内容**：右侧结构图占最大面积；元信息为独立 Context strip；**禁止**大卡片墙或遮罩盖住结构图（P0-16）。
- **窄屏（&lt;960px）**：Navigator 改顶栏抽屉/下拉；strip 可两行滚动；结构图仍优先。
- **未连接**：主区居中窄栏连接表单；strip 显示「未连接」；主题切换仍可用。

### 必显字段 × 可见时机

| 字段 | 时机 | UI 落点 |
|---|---|---|
| host、port、database、user（无密码） | `connected`+ | strip 连接行；长值截断 + `title` 全文 |
| PG 完整版本串 | `connected`+ | strip 连接行次要字重；可截断 + `title` |
| schema.relname、OID | 已选表 / `page_loaded` | strip 表行；未选表占位「未选表」 |
| blkno、关系总块数 | 已选表 / `page_loaded` | strip 表行；blkno 与 Navigator 同步 |
| 页大小、`pd_lower`/`pd_upper`、free 字节 | `page_loaded` | strip 页行；与结构图同源 |
| ItemId 总数；UNUSED/NORMAL/REDIRECT/DEAD 计数 | `page_loaded` | strip 页行缩写 `U/N/R/D`；`title` 全称 |
| tuple 计数（= NORMAL→HeapTuple） | `page_loaded` | strip 页行 |

数据源见 Design §9；**禁止**展示密码。

## 流程

1. 启动 → 默认主题（系统偏好）→ 探测会话（env 已连则 `connected`，否则表单）。
2. 连接 → 加载中 → 成功：strip 填连接+版本并拉表；失败：原因+下一步。
3. 选表 → strip 更新表/OID/块数；块数 0：空态，提示无块。
4. blkno + Load → 主视图局部加载 → 成功：结构图+hex+页元信息；失败：主视图错误面板。
5. 交互：选中 ↔ hex；flag 聚焦解读；跨块 ctid 点击/Enter 加载目标页。
6. Refresh → 同页重拉 + diff 高亮；壳层稳定。
7. 主题切换 → 全表面 token 即时换肤。

## 状态

| 状态 | 呈现 | 用户可执行动作 |
|---|---|---|
| 初始 `disconnected` | 连接表单；strip「未连接」 | 填表连接；主题切换 |
| 加载（连接） | 表单 disabled + spinner；壳层保留 | 等待；可主题切换 |
| 加载（拉表/页/刷新） | Navigator 或主视图局部指示；chrome+strip 保留 | 等待；刷新中禁用重复 Refresh |
| 空（无用户表） | 列表区空说明 + 下一步 | 重连；主题切换 |
| 空（块数 0 / 无 NORMAL） | 结构图可用；说明无块/无元组 | 改表；主题切换 |
| 成功 `connected` | strip 连接+版本；表列表 | 选表 |
| 成功 `page_loaded` | 结构图+hex+页元信息 | 五项交互；Refresh；主题 |
| 成功 `diff_active` | 变更高亮；未变不整页闪变 | 再刷新 |
| 错误（连接/`pageinspect`/越界/权限/非 8KB） | 原因 + ≥1 可执行下一步；禁止仅裸码/堆栈 | 修正后重试 |
| 部分失败（未知类型/TOAST） | 该列 hex 或 TOASTed；整页仍成功 | 继续浏览 |

## 表面专属设计

### gui

#### 布局与层级

- 已连接首屏：结构图为视觉锚点；chrome ~40–48px；strip ~56–72px（两～三行）；Navigator ~240–280px。
- 元信息不用多枚大卡片/重阴影；strip 用分隔线 + 字重。
- 结构图内：header / ItemId / free（压缩断裂标记 + 真实字节跨度）/ tuples 保序；增长方向箭头常驻。

#### 密度与响应式

- 正文字号约 13–14px；hex/偏移等宽；行高偏紧；8px 网格。
- strip「标签: 值」inline；次要标签降对比，值保持可读。
- ≥1280px：结构图与 hex 上下分栏（hex 默认约 30% 高，可折叠）。
- 加载/刷新禁止整页卸 chrome（P0-20）。

#### 焦点与键盘（P0-18）

| 步 | 控件 | 键位 |
|---|---|---|
| 连接 | 表单字段 → Connect | Tab；Enter 提交 |
| 选表 | 表列表 | Tab 入列表；↑↓；Enter |
| blkno | 数字输入 | Tab；Enter → Load |
| 加载 | Load | Enter/Space |
| 主题 | 切换按钮 | Tab；Enter/Space |

- `:focus-visible` 高对比轮廓（两主题可见）；禁止无替代的 `outline: none`。
- Flag/infomask：hover 与键盘聚焦等价（P0-3）。
- 跨块 ctid：可聚焦；Enter 加载（P0-6）。

#### 视觉语义

- Token（两主题各一套）：`--bg`、`--surface`、`--text`、`--text-muted`、`--border`、`--accent`、`--danger`、`--focus`；结构：`--region-header` / `itemid` / `free` / `tuple`、`--hex-hl`、`--diff`。
- 正文与关键控件在 light/dark 均须可读（P0-13）；语义色不单独承担正文对比。
- UI 无衬线；hex/偏移/版本串等宽。

#### 主题策略（P0-13/14，P1-4）

| 项 | 决策 |
|---|---|
| 模式 | `light` \| `dark` |
| 默认 | `prefers-color-scheme: dark` → dark，否则 light；不可读 → light |
| 切换 | chrome 内单一 toggle（可访问名）；之后会话内保持手动选择 |
| 作用域 | `document.documentElement` 的 `data-theme`/class；结构图/hex/strip/表单/错误均用 CSS 变量 |
| 跨会话 | P1-4 可选：`localStorage['pg-page-viewer.theme']`；禁止存密码；未实现则刷新回系统默认 |

### cli

N/A（`UI 表面=gui`）

## 与 Spec 验收映射

| Spec 验收 ID | 本设计落点 |
|---|---|
| P0-1 | 主视图结构图四区 + 实库 raw |
| P0-2 | 连接错误含 pageinspect 指引；不进浏览主视图 |
| P0-3 | 详情区 flag：hover/聚焦逐位 |
| P0-4 | 选中 tuple 列值面板 |
| P0-5/P0-6 | 链/REDIRECT；跨块可聚焦，点击/Enter 加载 |
| P0-7 | Refresh + `--diff` |
| P0-8 | 结构图 ↔ hex `--hex-hl` |
| P0-9 | 主视图错误；不渲染结构图 |
| P0-10 | 密码不入 storage；strip 无密码 |
| P0-11 | free 压缩 + 跨度标注 |
| P0-12 | 启动已连可跳过表单主路径 |
| P0-13 | 主题 toggle + 全表面 token |
| P0-14 | 默认系统偏好 / fallback light |
| P0-15 | Context strip 必显表 |
| P0-16 | strip 矮分区 vs 结构图面积优势 |
| P0-17 | 状态表各行可区分 |
| P0-18 | 键盘路径表 |
| P0-19 | 错误 = 原因 + 下一步 |
| P0-20 | 局部加载；壳层稳定 |
| P1-1 | 空表/空页文案 |
| P1-2 | 越界错误面板 |
| P1-3 | dropped 列占位 |
| P1-4 | 可选 localStorage 主题键 |

## 对 Plan / Developer 的要点

- 顺序：壳层+token/主题 → 连接/导航 → strip 绑定 → 结构图/hex → 交互精修。
- 元信息数字只绑 Design §9 来源；验证覆盖 P0-13..P0-20；QA 手测焦点/键盘；light 与 dark 各至少一张主视图截图证据。
- 遵守 `workflow/docs/standards/ui.md`；不以「现代/高级」空词替代分区与状态。

## 开放阻塞

none

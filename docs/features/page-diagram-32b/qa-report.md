# QA Report: page-diagram-32b

## 轮次

| 轮次 | 日期 | 范围 | 结论 |
|---|---|---|---|
| 1 | 2026-07-26 | 首测：P0-1..P0-12、P1-1/P1-2、Q7、增量手测 1–7、L2/L3、基线、文档/安全 | Fail |
| 2 | 2026-07-26 | 回归：DEF-001（P0-12/手测4）、Q7、手测5；抽查 P0-4/5/7/8/10/11；L2/L3 | Pass |

---

## 轮次 1（首测）— Fail

### 环境与命令

- 版本：源分支 `page-diagram-32b` HEAD `7baece2e77b484981d4eaa93d67753d536836062`（领先 `main` 9 commits）。工作树无未提交源码；未入库文档：`review.md`、`dev-notes.md`（改）、`docs/manager/**`。验收以 commits 为准。
- 环境：macOS；PG `pageviewer`（connected）；server `127.0.0.1:8787`；web `localhost:5173`（`::1`）。手测：Playwright Chromium + 实页 `public.tb` / `qa_hot` / `qa_cross`。
- 入口：Plan（含 T10–T15）已确认；Review Approve；路径 full。满足 QA 入口。
- 临时证据（未入库）：`/tmp/tmp-qa-evidence/`（截图 01–04、`results.json`）。

| 命令 | 结果 |
|---|---|
| `pnpm --filter page-core test` | Pass（29） |
| `pnpm -r typecheck` | Pass |
| `pnpm -r build` | Pass |
| `pnpm test:integration` | Pass（`L3 smoke OK: public.qa_cross blk 0 length=8192`） |

### 覆盖（对照 plan 最低验证层 + spec 验收）

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| P0-1 | 结构图 32B；顺序 header→ItemId→free→tuple；Q1 低偏移在上 | Pass | sections=`PAGEHEADER / ITEMID` / `FREE SPACE` / `HEAPTUPLE`；`01-loaded.png` |
| P0-2 | 字段边界与标签 | Pass | cells=31；ItemId/xmin 可辨 |
| P0-3 | 点击高亮 | Pass | `.field-cell.selected`≥1 |
| P0-4 | 结构图→hex 整段高亮 | Pass | `.hex-cell.hl`=4（`t_xmin`） |
| P0-5 | hex→结构图 | Pass | hex 点选后 selected+hl |
| P0-6 / Q6 | hex 32B/行；偏移≥4 位；256 行 | Pass | 256 行 × 32 格；`0000`/`0020` |
| P0-7 / Q5 | free 折叠 + 文案/键盘 | Pass | `aria-expanded` true→false；`free space`；Enter |
| P0-8 | 折叠后映射不错位 | Pass | 折叠后 ItemId hl@24、xmin hl@8128 |
| P0-9 | 非像素复刻不阻塞 | Pass | 不以未像素复刻判失败 |
| P0-10 / 手测1 | 宽格完整主值 | Pass | `t_xmin` 格内 `5489`；无省略截断 |
| P0-11 / 手测2 | 详情同源 | Pass | 格内与 `.selection-value` 均为 `5489` |
| P0-12 / 手测4 | hex 自动定位（高偏移首字节行入可视区） | Fail | DEF-001：`fromTopRatio≈1.31`，行未入可视区 |
| Q7 | 折叠时自动展开再定位 | 部分 | 展开 Pass；定位随 P0-12 Fail |
| P1-1 | 窄字段全文可达 | Pass | `title`/`aria-label` 含全名 |
| P1-2 | 跨行/整字段同步 | Pass | 片段或 hex 中点选后整段 hl 一致 |
| P1-3 | infomask 图注 | N/A | Q4 未纳入 |
| 手测3 | 变窄回退/不截断主值 | Pass | viewport 480：主值无 ellipsis；边界未合并 |
| 手测5 | 不抢滚；hex 点选不滚 | Pass | reduced-motion 复测：同区间/手动滚/hex origin 均不强制滚（首轮 smooth 假失败已排除） |
| 手测6 | 键盘 Enter 定位且焦点保留 | Pass | focus 仍在字段格；hex 展开且 hl≥1 |
| 手测7 | light/dark 可读可区分 | Pass | theme 切换；`--field-selected`≠`--hex-hl` |
| L2 | test / typecheck / build | Pass | 见命令表 |
| L3 | integration | Pass | 见命令表 |
| 基线 | flag/列/ctid、Refresh、strip | Pass | infomask 逐位；`qa_hot` ctid `(0,16)`；Refresh 保留结构图；strip 有页元信息 |
| 基线 | 非 8KB 不渲染结构图 | 降级 | 实 UI 本轮无非 8KB 夹具；`parsePage` 错误路径有既有单测。风险低；本轮已因 P0 Fail |

### UI/UX

| 检查项 | 结果 | 证据 |
|---|---|---|
| Spec 界面相关验收 | Fail（P0-12） | 其余结构图/联动/值模式/折叠 Pass |
| `docs/standards/ui.md` 底线 | Pass | 焦点/键盘、错误面板、状态反馈可用 |
| `ui-design.md` 状态与流程 | 部分 | FreeSpaceBand、值/标签、token 符合；「首字节行入可视区」未达成（DEF-001） |

### 文档与安全

| 检查项 | 结果 | 备注 |
|---|---|---|
| README / Spec / Plan 一致性 | Pass | README 含 32B 结构图、格内值、hex 自动滚动 |
| `.env` / 凭据入库 | Pass | `main..HEAD` 无 `.env`/凭据；`.env` 仅本地 |
| 安全面增量 | 无 | 未改 server/认证/出站；因功能 Fail 不请求合并 |

### 缺陷（轮次 1 状态）

| ID | 严重度 | 摘要 | 状态 |
|---|---|---|---|
| DEF-001 | High | P0-12：高偏移字段 hex 自动滚动后，高亮首字节行未进入可视区。根因：`.hex` CSS `gap: 1px`（及 padding）使真实行 Y ≠ `firstRow * rowHeightPx`，目标偏小；页尾行误差超过容器高度。 | open（本轮） |

#### DEF-001（轮次 1 详情）

- 复现：8KB 页 → Collapse hex → 点击高偏移 tuple 字段（如 `t_xmin` @ ≈8160）→ hex 展开并 `scrollTo`。
- 期望：高亮首字节行进入 hex 可视区（宜近顶约 1/3）。
- 实际：`locateFlash` 触发；`scrollTop` 与无 gap 公式一致（例 actual=4656≈expectedApprox）；`getBoundingClientRect` 显示行仍在视口下（`fromTopRatio≈1.31`）。低偏移（如 `pd_lower`）定位 Pass。
- 证据：Playwright reduced-motion 复测；`styles.css` `.hex { gap: 1px }`；`HexDump.tsx` 以 `firstRow * rowHeightPx` 调用 `computeHexScrollTarget`。
- 修复范围：滚动几何计入 gap/padding（度量真实行 offset 或修正公式）；单测/手测覆盖页尾行；修复后 Review 再 Approve，QA 回归 P0-12/Q7/手测 4–5。

### 结论（轮次 1）

- 总体: Fail
- 恢复条件: N/A
- 合并: 不合并（未解决 High：DEF-001）
- 手测缺口: 已补齐（首轮 + 增量 1–7）；手测 4 / P0-12 失败
- 下一步: 退回 developing → 修 DEF-001 → Review Approve → QA 回归轮次

---

## 轮次 2（回归）— Pass

### 环境与入口

- 版本：源分支 `page-diagram-32b` HEAD `9d828e79f50c6698a059fd6aca5697612757dbca`（领先 `main` 10 commits）。工作树无未提交源码；未入库：`qa-report.md`、`review.md`、`docs/manager/**`。验收以 commits 为准。
- 环境：macOS；PG `pageviewer`；server `127.0.0.1:8787`；web `localhost:5173`。手测：Playwright Chromium + reduced-motion + `public.tb`。
- 入口：Plan（含增量）已确认；Review 复审 Approve @ `9d828e7`；Manager 授权回归。
- 临时证据：`/tmp/tmp-qa-regression/`（`r2-hex-locate.png`、`results.json`）。

### 命令（L2 / L3）

| 命令 | 结果 |
|---|---|
| `pnpm --filter page-core test` | Pass（31） |
| `pnpm -r typecheck` | Pass |
| `pnpm -r build` | Pass |
| `pnpm test:integration` | Pass（`L3 smoke OK: public.qa_cross blk 0 length=8192`） |

### 回归覆盖

| ID | 要求 | 结果 | 证据 |
|---|---|---|---|
| P0-12 / 手测4 | 高偏移定位；页尾夹取后首字节行入可视区 | Pass | `rowVisible=true`；`fromTopRatio≈0.90`（`maxScroll=4765`）；`deltaExpected=0`；`deltaNaive≈109`；`locateFlash`；hl@8160–8163 |
| Q7 | 折叠时选中变化 → 展开后再定位 | Pass | 先选 `pd_lower` 再 Collapse hex，点 `t_xmin`：`wasHidden=true` → 展开且 `rowVisible` |
| 手测4 展开路径 | hex 已展开时高偏移定位 | Pass | 滚至顶后点 `t_xmax`：`scrollTop=4765`、`rowVisible`、`deltaExpected=0` |
| 手测5 | 同区间 / 手动滚 / `origin=hex` 不抢滚 | Pass | `4765→4765`；手动 −120 稳定；hex 点选 `scrollTop=0` |
| 抽查 P0-4 | 结构图→hex 整段高亮 | Pass | `t_xmin` hl=4 |
| 抽查 P0-5 | hex→结构图 | Pass | selected≥1 且 hl≥1 |
| 抽查 P0-7 | free 折叠 | Pass | `aria-expanded` true→false |
| 抽查 P0-8 | 折叠后映射不错位 | Pass | 低偏移 hl@12–13；xmin hl@8160–8163 |
| 抽查 P0-10/11 | 格内与详情同源 | Pass | 均为 `5489` |
| L2 / L3 | Plan 验证命令 | Pass | 见命令表 |
| 新缺陷 | — | 无 | 未开 DEF-002+ |

### UI/UX / 文档 / 安全

| 检查项 | 结果 | 证据 |
|---|---|---|
| Spec P0-12 / Q7 / 手测 4–5；`ui-design.md` 页尾夹取 | Pass | 见回归表；夹取下 `fromTopRatio≈0.90` 仍可见 |
| `dev-notes` / Review 复审 | Pass | DEF-001 回执存在；Approve @ `9d828e7` |
| 安全面增量 | 无新增 | 仅滚动几何；commits 无 `.env`/凭据 |

### 缺陷

| ID | 严重度 | 摘要 | 状态 |
|---|---|---|---|
| DEF-001 | High | P0-12 高偏移 hex 定位未计入 gap/padding | closed |

关闭依据：`9d828e7`；`rowVisible` + gap-aware `deltaExpected=0`；页尾夹取、Q7、手测5 通过；无新缺陷。

### 结论（轮次 2）

- 总体: Pass
- 恢复条件: N/A
- 合并: 质量条件已满足；不自行合并。待用户明确合并授权后，由 Manager 置 `done` 并与未入库报告一次提交，再合入 `main`。
- 下一步: 请求合并授权（源 `page-diagram-32b` → 目标 `main`）

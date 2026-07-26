# Review: page-diagram-32b

## 审阅范围与依据

| 项 | 内容 |
|---|---|
| 工作项 | `page-diagram-32b`（未拆分）· 路径 `full` · Review 门禁 `required` |
| 轮次 | **复审**（相对首轮 Approve @ `7baece2`；增量 `9d828e7`） |
| 审阅版本 | 源分支 `page-diagram-32b` HEAD `9d828e79f50c6698a059fd6aca5697612757dbca`（领先 `main` 10 commits） |
| 工作树 | 未入库：`review.md`、`qa-report.md`、`docs/manager/**`；**无未提交源码**；实现以 commits 为准 |
| 依据 | `spec.md` P0-12/Q7；`qa-report.md` DEF-001；`dev-notes.md` 修复回执；首轮审阅；`design.md`/`plan.md` T14；`docs/standards/{quality,security,ui,git,documentation}.md` |
| 审阅代码 | `packages/page-core/src/structure-fields.ts` + `tests/structure-fields.test.ts`；`apps/web/src/HexDump.tsx`（对照 `App.tsx` origin/nonce、`styles.css` `.hex`） |
| 独立取证 | `pnpm --filter page-core test` → Pass（31） |

## 结论

**Approve**。DEF-001 开发者侧修复成立；无阻塞项；可调度 QA 回归以正式关闭缺陷。

## 复审：DEF-001

| 核验点 | 结果 | 证据 |
|---|---|---|
| `computeHexScrollTarget` 计入 `rowGapPx`/`paddingTopPx` | 通过 | `stride = rowHeight + max(0,gap)`；`rangeTop/Bottom` 含 `inset`；默认 `0` 兼容旧调用；既有六例仍 Pass |
| HexDump 度量并传入；与 `.hex` CSS 一致 | 通过 | 首行 inset（`scrollTop`/`clientTop`）+ 相邻行 gap（fallback `rowGap`/`gap`）；`.hex` = flex column + `gap: 1px` + `padding: 0.45rem …` |
| 仅容器 `scrollTo`；无 `scrollIntoView`；无 setTimeout 猜展开 | 通过 | `el.scrollTo`；实现无 `scrollIntoView`；`setTimeout` 仅清 `locate-flash`；Q7 仍 `setHexCollapsed(false)` + 挂载后 nonce effect |
| `origin==="hex"` / 同区间不抢滚（nonce）未回退 | 通过 | `selectByteRange`：hex / `!rangeChanged` early-return；effect 仅依赖 `locate?.nonce`；`locateHandledNonceRef` 跨卸载 |
| 页尾夹取后首字节行仍可见 | 通过 | 夹取至 `maxScroll` 后 gap-aware 行带仍在视口内（「宜近顶 1/3」允许夹取）；Vitest + 开发者手测 `rowVisible`/`fromTopRatio≈0.90` |
| TDD 回归有效 | 通过 | 有 gap 时目标 > naive；可见性对 gap-aware 带敏感（无 gap 参数会误判已可见） |

**实现正确性（增量）**：根因与修复对齐；未见回归或越界（未改 Spec/Plan/Design 正文、server、`parsePage`）。

**测试有效性（增量）**：L2 锁 DEF-001；独立复跑 31 Pass。浏览器 P0-12/Q7/手测 4–5 以开发者 Playwright 为旁证，正式关闭待 QA 回归。

**文档影响**：`dev-notes.md` 含 DEF-001 回执与验证；运维 N/A。

**安全影响**：增量无新触发域（认证/授权/输入/文件/网络/依赖/敏感数据均未新增；commits 无 `.env`/凭据）。无增量安全影响。

**UI/UX**：有 `ui-design.md`。定位仍近顶 1/3 + 容器夹取；token/焦点未改。主题/深色沿用既有（Spec 未要求变更）。

**Git**：分支名合规；`9d828e7` 仅约定路径；无禁止提交项。

## 首轮摘要（`7baece2`）

首轮 **Approve**：P0-1..P0-12、Q7、T1–T15 静态通过；非阻塞 C1–C4。QA 首轮 Fail 仅 **DEF-001**（其余手测/L2/L3 Pass）。本复审不重开已 Pass 条款。

## 发现项

复审无新发现。首轮 C1–C4 仍为非阻塞建议，不要求本轮修复。

## 后续动作与复审范围

- Manager 可调度 **QA 回归**（优先 P0-12、Q7、手测 4–5；其余按需抽查）。
- DEF-001 正式关闭仅由 QA 判定；本报告不代替 QA Pass/Fail。
- 若回归再 Fail 或另开缺陷，复审范围限定新缺陷 diff。

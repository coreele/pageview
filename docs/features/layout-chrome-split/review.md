# Review: layout-chrome-split

## 审阅范围与依据

| 项 | 内容 |
|---|---|
| 工作项 | `layout-chrome-split`（未拆分）· 路径 `full` · Review 门禁 **required** · UI 表面 `gui` |
| 审阅版本 | 源分支 `layout-chrome-split` HEAD **`5b2756a6b56540eed50b577a3b30a538a354e174`**；领先 `main` 10 commits |
| 实现提交 | `180ac9d` docs → `e3d6f7e` feat 壳层分栏 → `8bf09cc` feat 第三轮 chrome → `caee028` feat 第四轮去 Hex 标签/折叠卸载 → 配套 docs |
| 工作树 | 未入库：本 `review.md`、`docs/manager/**`、`.tmp-uicheck/`；实现以分支 commits 为准（`apps/web` + feature 文档已入库） |
| 依据 | `spec.md`（P0-1..15，Q1–Q6 关闭）；`design.md`；`ui-design.md`；`plan.md`（T1–T16）；`dev-notes.md`；`README.md`；`docs/standards/{documentation,quality,security,git,ui}.md` |
| 审阅代码 | `apps/web/src/App.tsx`、`styles.css`；`StructureMap`/`HexDump`/`api.ts` 相对 `main` **零 diff** |
| 独立取证 | `pnpm test` → page-core 31 + server 4 Pass；`pnpm typecheck` Pass；`pnpm --filter web build` Pass；`page-core`/`server` diff **空**；源码静态合同 19/19 Pass |

## 结论

**Approve**。无阻塞项。Spec 第三/四轮与 Plan T1–T16 满足；测试/文档达进入 QA 条件；安全与 Git 合规。可调度 QA。

## 实现正确性

| 合同重点 | 结果 | 证据 |
|---|---|---|
| 主带：标题 → connected → Collapse hex → Theme | 通过 | CSS `"title badge spacer collapse theme"`；Collapse 在 Theme 左；`page` 后 `.chrome-collapse` |
| 次带：表/blkno/Load/Refresh + `page_loaded` 统计；空态空白 | 通过 | 控件在 `.chrome-meta`；`{page && selectedTable && (` 渲染 `.meta-stats`；无 `—`/`N/A` 堆砌 |
| 连接详情：徽标 hover/focus；无密码 | 通过 | `.badge-conn` + `.conn-popover` + `title`；`connSummary` 仅 host/port/db/user；`PublicSession` 无 password |
| Collapse 唯一入口；展开无 HEX 标签；折叠卸载 pane、结构图全宽；展开恢复分栏 | 通过 | 仅主带；无 `.pane-head`/`Hex`/`Hex collapsed`；`{!hexCollapsed && pane-hex}`；`[data-hex=collapsed]` 单列 `1fr`；≥960 展开 `0.55fr ‖ 0.45fr` |
| 双向高亮 / hex 自动滚 / 主题 | 通过 | `origin==="hex"` 不 locate；结构选中可展开+locate；Theme 主带右；滚容器 `.pane-hex .hex` |
| P0-10 page-core·server 零语义改动 | 通过 | 相对 `main` 零 diff；独立 L2 Pass |
| 左侧栏移除；960；窄屏上下 | 通过 | 无 `.nav`；`min-width: 960px` 左右；默认单列堆叠 |

未改 API、未增依赖、未恢复侧栏或宽屏上下唯一布局。缺口（非阻塞）：0-block/disconnected 未本轮重测；第四轮未重跑 L3（见 C2）。

## 测试有效性

| 层 | 结论 |
|---|---|
| Plan 最低验证 | **满足**：L2 + T15–T16 定向手测（三态 + 联动/主题） |
| 独立复跑 L2 | **Pass**（本会话） |
| 壳层自动化 | 无 web DOM 单测；Plan 以手测替代。错误布局可由手测/静态 DOM 证伪；page-core 由 31 例锁定 |
| L3 | 第四轮未重跑；第三轮 Pass + 本轮实库手测覆盖 Load；建议 QA 可选冒烟 |

实现合同经源码/CSS/独立 L2 交叉核对，非仅开发者自述。

## 文档影响核对

| Plan 声明 | 一致？ | 备注 |
|---|---|---|
| 开发文档 → `dev-notes.md` | 是 | T15–T16、L2、手测 23/23、scoped diff、缺口/恢复条件齐全 |
| 用户文档 N/A | 是 | 第四轮仅去标签/折叠占位；README 主/次带与徽标说明仍正确 |
| 运维文档 N/A | 是 | 未改部署/API/env |
| feature 文档 | 是 | spec/design/ui-design/plan 入库且与实现一致 |

验证命令可复现：`pnpm test`、`typecheck`、`--filter web build`。

## 安全影响核对

| 检查项 | 结果 | 备注 |
|---|---|---|
| 敏感信息 | 通过 | `.env` 未入库；浮层/title 无密码；提交后清 `form.password` |
| 认证与授权 | 无新增面 | 沿用 connect；未改 server |
| 输入与外部访问 | 无新增面 | 无新出站 |
| 文件操作 | N/A | |
| 依赖变更 | 无 | 无新依赖 / lockfile 未因本项变更 |
| 处置状态 | 允许继续 | **无未解决安全问题** |

## UI/UX 核对

| 检查项 | 结果 | 备注 |
|---|---|---|
| Spec 界面验收 P0-1..15 | 通过 | 见实现正确性表 |
| `docs/standards/ui.md` | 通过 | 主内容优先；徽标可聚焦+title；局部加载指示；light/dark 保留 |
| `ui-design.md` | 通过 | 主带顺序；次带条件统计；无 Hex 标签；折叠不渲染 pane；55/45 @960 |
| 主题/深色 | 通过 | Spec 要求保留；主带 Theme；未新造主题 |

## Git 合规

| 检查项 | 结果 |
|---|---|
| 分支 | `layout-chrome-split` → `main` |
| 提交内容 | Conventional Commits；仅 `apps/web` + feature docs + README |
| 禁止项 | 无 `.env`/密钥/构建产物；manager / `.tmp-uicheck` 未进 commits |

本报告 **不提交**（`git.md` §1.4）。

## 发现项

无阻塞项。

| ID | 严重度 | 位置 | 问题 | 状态 |
|---|---|---|---|---|
| C1 | 低 | `App.tsx` Collapse | 折叠时 `aria-controls="hex-panel"` 指向已卸载节点；可省略或保留可引用节点 | open（可选） |
| C2 | 低 | 验证 | 第四轮未重跑 `test:integration`；0-block/disconnected 未本轮手测 | open（建议 QA 抽查） |
| C3 | 低 | 测试债 | 无 web DOM 自动化锁折叠三态 | open（Plan 已记；不阻塞） |

## 后续动作与复审范围

1. Manager：门禁满足 → 调度 **QA**（Spec P0-1..15 + Plan 第四轮手测清单）。
2. QA 重点：主带顺序；徽标连接全文无密码；Collapse 三态；双向高亮/自动滚；主题；空态统计空白。
3. 本报告不代替 QA Pass/Fail；合并/push 按用户授权与 STATUS。
4. QA Fail 或新缺陷：复审限定缺陷 diff + 受影响回归；C1–C3 不强制回退 Developer。

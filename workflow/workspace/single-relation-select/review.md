# Review: single-relation-select

## 审阅范围

- 实现版本 / 提交: `e4186cd2ecbb4e47b55942043ae70ae653882fc9`（代码 + 测试 + README），基于文档提交 `00fc72f`，基线 `main` @ `ed8437c78c39d8d526989fc387551dfeffda6c4c`。
- 依据: `plan.md`；`spec.md`、`ui-design.md`。
- 同步核对: `git fetch --all` 后 `origin/main` 与本地 `main` 均为 `ed8437c`；`git merge-base --is-ancestor origin/main HEAD` 退出 0；`origin/main..HEAD` 仅 `00fc72f`、`e4186cd`。工作树仅含工作流文档（`main.md` 修改、`dev-notes.md` 未跟踪）。待审差异与 `dev-notes.md` 记录一致。
- 验证实跑（2026-09-13）:
  - `pnpm --filter web test` → EXIT 0，21 files / 301 tests passed（含 `relationSelect.test.ts` 6 项、`treeNavUi.test.ts` 15 项）。
  - `pnpm --filter web typecheck` → EXIT 0，零类型错误。
  - `pnpm build` → EXIT 0，page-core / wal-core / server / web（vite 70 modules）全部成功。

## 实现正确性

- 门控：两个下拉均位于 `{browseMode === "single" && (` 内（`App.tsx:1569`；table `1602-1635`、index `1694-1729`），Tree 模式不渲染；`browseMode` 由 `pageBrowseMode(btreeTree.collapsed)` 派生，未被本项改动。满足 P0-1 / P0-11。
- Table 侧：option 文案 `formatTableOption` = `` `${qualifiedName} (oid ${oid} · ${blocks} blk)` ``，与 Spec §2 一致；`value` 仅在 `selectedOid` 命中 `tables` 时取值，否则 `""` 占位；`disabled` 含 `!tablesFetched / loading-tables / loading-page / 空列表`，占位文案 `Loading tables…` / `No tables` / `select a table…`。满足 P0-1 / P0-12 / P1。
- Index 侧：列表为完整 `indexes`，option 复用 `formatIndexOption`（`✕ ` 前缀、` · invalid` 后缀）、`title` 复用 `indexOptionTitle`；未调用 `filterIndexesByTable` / `tableFilterOptions` / `tablesWithIndexes`（`treeNavUi.test.ts:124` 仍守卫）。满足 P0-4。
- 选择语义：`pickTableFromSelect`（`App.tsx:665-672`）先 `setBlkno(0)`，再 `onSelectTable(oid)`，仅在 `shouldAutoLoadRelation(t.blocks)` 时 `loadBlk(oid, 0)`；`pickIndexFromSelect`（`674-680`）走 `onSelectIndex`（内部 `resetPageView` + `setBlkno(0)` + `ensureIndexExpanded`），仅在 `canLoadIndex(idx) && shouldAutoLoadRelation(idx.blocks)` 时 `loadIndexBlk(oid, 0)`。0 块 / 非 B-tree 不发请求，保留现空态 / `indexHint`。满足 P0-2 / P0-5 / P0-6 / P0-13。
- 无「再点已选即收起」逻辑：新处理器直接调 `onSelectTable` / `onSelectIndex`，未复用 `activateTable` / `activateIndex` 的 collapse 分支。满足 §4。
- 无 stale/async 风险：`loadBlk` / `loadIndexBlk` 均以显式 `(oid, 0)` 入参，不读 `blkno` state；`onSelectTable` 体为同步（无 await），`void` 调用不会与随后的 `loadBlk` 竞态。两入口均先判 `loadState === "loading-page"` 直接返回，且下拉在该状态 `disabled`，避免重复请求。
- 与 connect 时「强制开 Tree」effect（`App.tsx:1012-1016`，deps `[connected, mode]`）及深链 restore effect（`1213-1323`，仅 `pendingRestore != null` 时运行）无冲突：选择不改变 `connected`/`mode`，也不设置 `pendingRestore`，不会把 Tree 重新打开。
- 未改 URL 参数名与语义、`loadBlk` / `loadIndexBlk` / `onSelectTable` / `onSelectIndex` / `onSwitchRelationKind` 合同、错误码与失败清页；未新增 state；未新增 server 端点。满足非目标与 §5。
- 无越界变更：提交仅含 `App.tsx`、`relationSelect.ts`、两个测试、两个 README，未触碰 `indexView.ts` / `urlState.ts` / `blockNav.ts` / `pageBrowse.ts` / 样式 / e2e。

## 测试有效性

- `relationSelect.test.ts`（6 项）覆盖 `formatTableOption` 正常 / 长名 / 0 块，`shouldAutoLoadRelation(>0)=true`、`=0 false`，以及 `canLoadIndex && shouldAutoLoadRelation` 的 B-tree / 非 B-tree / 0 块组合，均可因错误实现而失败。
- `treeNavUi.test.ts` 旧 `"does not keep table or index dropdowns in App"`（断言不含两个 className）已删除并改写为「仅 single 门控内出现」；旧「无下拉」合同已完全退役，README 中英同步去除该描述。`index-tree-nav catalog (P0-2)` 的 `not.toMatch(/filterIndexesByTable/)` 保持通过。满足 Spec「测试合同」。
- 新增源码扫描断言覆盖占位文案、`loading-page` 禁用、`shouldAutoLoadRelation` / `canLoadIndex` 自动加载门禁，方向正确。
- 测试环境限制（无 React DOM）已在 `plan.md`「验证缺口」与 `dev-notes.md` 记录原因 / 风险 / 恢复条件，未静默跳过。

## 文档影响核对

| Plan 声明 | 实现是否一致 | 备注 |
|---|---|---|
| 开发文档 | 一致 | N/A 理由成立：`relationSelect.ts` 为内部纯函数，无新 API / 模块契约 |
| 用户文档 | 一致 | `README.md:24,29,77` 与 `README.zh-CN.md:24,29,76` 均已改为「Tree 暗时可从工具栏选表 / 索引并自动加载 blk 0」，中英语义同步；命令示例 `pnpm dev:web` 等未受影响 |
| 运维文档 | 一致 | N/A 理由成立：无部署 / 配置变更 |

## 安全影响核对

| 检查项 | 结果 | 处置状态 | 备注 |
|---|---|---|---|
| 敏感信息 | 无 | 不适用 | 未新增凭据 / 连接串 / 令牌 |
| 认证与授权 | 无变更 | 不适用 | 未触碰登录、会话、权限 |
| 输入与外部访问 | 无新增面 | 不适用 | 复用现有 `tables` / `indexes` 与 page GET；下拉值经 `Number()` 并 `find` 校验，未命中即返回 |
| 依赖变更 | 无 | 不适用 | 无依赖新增 / 升级 |

未触发 `security.md` §2 的强制安全审阅条件；无未解决安全问题。

## 必修项

| ID | 位置 | 问题 | 状态 |
|---|---|---|---|
| — | — | 无 | — |

## 非阻塞建议

- `App.tsx:1689-1694`：`indexHint` 渲染在 index `<select>` 之前，而 `ui-design.md:38-39` 约定关系下拉「紧跟 kind 开关之后」、提示位于「下拉之后、blkno 之前或其后」。非 B-tree 选中时提示以 `flex: 1 1 100%` 占行，会把下拉与 kind 开关隔开。功能无影响，建议后续把提示移到下拉（或 blkno）之后以贴合设计。
- `treeNavUi.test.ts:113-114`：`/loadBlk\(oid, 0\)/` 与 `/loadIndexBlk\(oid, 0\)/` 同时命中既有 `activateTable`（`App.tsx:790`）/ `activateIndex`（`App.tsx:810`），故这两条不专属于新选择处理器；合同实际由唯一的 `shouldAutoLoadRelation(...)` 断言承担。可收紧为截取 `pickTableFromSelect` / `pickIndexFromSelect` 函数体再断言。
- `treeNavUi.test.ts:90-98`：门控断言只校验两个 className 出现在首个 `browseMode === "single" && (` 之后，无法识别「门控闭合之后另加下拉」的情形。属源码扫描固有限制，当前实现无此问题。
- `App.tsx:414-428`：`indexesFetched` 仅在成功时置真，索引列表请求失败时下拉停留在 `Loading indexes…` 且禁用；此为既有行为，本项未引入。

## 结论

Approve

> `Comment` 不得含任何必修项或未解决安全问题；否则必须改为 `Request changes`。

## 后续动作与复审范围

- 无必修项，Review 门禁满足，可进入 QA（`pnpm --filter web test` / `typecheck` / `build` 已实跑通过）。
- QA 须以 `e4186cd` 为对象；`plan.md`「验证缺口」中的真机自动加载、结构图渲染、深链回放、窄宽换行仍待活 PG + 浏览器人工核对。
- 非阻塞建议如需采纳，属后续增强，不阻塞本轮 QA 与合并。

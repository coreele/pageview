# Dev Notes: index-tree-nav

## 实现摘要

Page 导航改为 table / index 两段目录。`visibleIndexCatalog` 列出全部用户索引，展开的 B-tree 在节点下挂 `visibleTree`（depth+1）。段标题可完全折叠，展开内容 `max-height: 50%`。Index 次带去掉两个 `<select>`；点 B-tree 索引 `loadIndexBlk(oid, 0)`；连库后即拉 `/api/indexes`。切 kind / 选索引不再 `resetBtreeTree()`。选表不过滤 index 段。

## 变更路径

- `apps/web/src/btreeTree.ts`、`apps/web/src/btreeTree.test.ts`
- `apps/web/src/BtreeTreePanel.tsx`、`apps/web/src/App.tsx`、`apps/web/src/styles.css`
- `apps/web/src/treeNavUi.test.ts`
- `README.md`、`README.zh-CN.md`
- `e2e/helpers/app.ts`（`selectIndexOid`）

## 测试先行记录（TDD）

| Spec ID / 行为项 | 测试 | 先失败 | 后通过 | 说明 |
|---|---|---|---|---|
| P0-1 | `treeChromeVisible` table 无页 true；面板 `data-section` | 否 | 是 | chrome 可见性沿用；两段在 `BtreeTreePanel` |
| P0-2 | App 把完整 `indexes` 交给 catalog；无 `filterIndexesByTable` | 是 | 是 | 选表不收缩 index 段 |
| P0-3 | `App.tsx` 无 `index-select` / `table-select` | 是 | 是 | `treeNavUi.test.ts` 扫源码 |
| P0-4 | catalog 展开 btree 子页；App `loadIndexBlk(oid, 0)` | 是 | 是 | 子树单测；Load 接线代码审 |
| P0-5 | hash 节点不可展开、无 page 子行 | 是 | 是 | |
| P0-6 | `toggleIndexSectionCollapsed` 不影响 table 段；折叠后 `pendingFetches=[]` | 是 | 是 | 面板折叠时不渲染 body |
| P0-7 | `treeChromeVisible({ index, undefined })` true | 是 | 是 | 改写原 P0-6 反例 |
| P0-8 | restore 分支 `ensureIndexExpanded` + 段默认展开 | 否 | 是 | 代码审 `App.tsx` restore |
| P1 | CSS `max-height: 50%`；`indexNameClickCollapses`；关系名无 schema | 是 | 是 | `8a78057` 去掉 schema/`N blk`，段标题 TABLE/INDEX |
| V-docs | README 中英 | 否 | 是 | |
| V-reg / V-static | web test + typecheck | — | 是 | 17 files / 259；tsc 0 |

## 验证

| 命令 | 验证层 | 结果摘要 / 证据 |
|---|---|---|
| `pnpm --filter web test` | unit | 17 files / 260 passed |
| `pnpm --filter web typecheck` | static | 退出码 0 |

## 目标分支同步（最终 Review 前）

- 目标分支及提交: `origin/main` `1d20b6e8066dc21bcda630061e12ec4b67c295ae`
- 同步后源分支 HEAD: `b933a8cd02d07b9b58c3b04598e4b34a3bddf8b3`
- 同步方式: rebase（已是 `origin/main` 后代，无新提交）
- 冲突及处理: N/A
- 同步后复验: `pnpm --filter web test` 17/259；`pnpm --filter web typecheck` 退出码 0

## 文档影响

| 类别 | 已更新路径或交接说明 |
|---|---|
| 开发文档 | N/A |
| 用户文档 | `README.md`、`README.zh-CN.md` |
| 运维文档 | N/A |

## 未解决风险 / 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 真机扫读 | 本会话未开浏览器走连库点击 | 两段高度 / 折叠手感 | Connect 后点表与索引 |
| e2e | CI 不跑 Playwright | 选索引 helper 未实跑 | 本地 `pnpm test:e2e` |

## QA 修复回执

| 缺陷 ID | 处理 | 摘要 | 验证证据 | 建议复测范围 |
|---|---|---|---|---|
| | | | | |

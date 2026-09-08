# QA Report: index-tree-nav

> 首测与所有回归写在本文件，按轮次追加；禁止 `qa-report-v2.md`。

## 轮次

| 轮次 | 日期 | 实现版本 | 环境 | 范围 | 结论 |
|---|---|---|---|---|---|
| 1 | 2026-09-08 | `d0577594ff1b2b7cef5a03bb5bbd956e3b8f1b49` | 本地 web vitest + tsc；`origin/main` `1d20b6e` 为祖先 | 首测 | Pass |
| 2 | 2026-09-08 | `8a780579b3d296995fa145e657a4dd1e9e836d6b` | 同上 | 目录文案与段标题 | Pass |
| 3 | 2026-09-08 | `161dde9575c5d393c5743d38fac38bb8bbc92383` | 同上 | 去掉索引 btree pill | Pass |
| 4 | 2026-09-08 | `4d129b26b0650f6187606e5650ef5cae187a62e5` | 同上 | 页节点只留 meta | Pass |
| 5 | 2026-09-08 | `8f16e2b05b2ace55996848bf6844dfa577c3da8d` | 同上 | 表/索引/块改 icon | Pass |
| 6 | 2026-09-08 | `ca4f5eeeb90c53cacf5f5c2a4b975c09ef430dbf` | 同上 | 索引钥匙 / 块折角页 | Pass |
| 7 | 2026-09-08 | `b933a8cd02d07b9b58c3b04598e4b34a3bddf8b3` | 同上 | 索引不按表过滤 | Pass |

## 执行命令

| 命令 | 输出摘要 / 证据位置 |
|---|---|
| `pnpm --filter web test` | 17 files / 260 passed |
| `pnpm --filter web typecheck` | 退出码 0 |

## 覆盖（对照 Spec 验收与 Plan 验证）

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| P0-1 | Table 无页也见两段 | Pass | `treeChromeVisible` table 无页 true；`BtreeTreePanel` 两个 `data-section` |
| P0-2 | index 段不按表过滤 | Pass | App 把完整 `indexes` 交给 catalog；无 `filterIndexesByTable` |
| P0-3 | Index 无两个下拉 | Pass | `App.tsx` 无 `index-select` / `table-select`（`treeNavUi` 扫源） |
| P0-4 | 点 B-tree 索引 Load blk 0 | Pass | catalog 展开挂 btree 子页；`activateIndex` 调 `loadIndexBlk(oid, 0)` |
| P0-5 | 非 B-tree 不请求 | Pass | hash `expandable=false`、无 page 子行；`canLoadIndex` 守门 |
| P0-6 | 段标题完全折叠 | Pass | `toggleIndexSectionCollapsed` 不影响 table；折叠后 `pendingFetches=[]`；body 不渲染 |
| P0-7 | Index 无页有 Tree | Pass | `treeChromeVisible({ relationKind: "index", pageKind: undefined })` true |
| P0-8 | 深链展开索引 | Pass | restore：`setTreeCollapsed(false)` + `ensureIndexExpanded` |
| P1 | 段 overflow / 再点收起 / 选表仍列全部 / ellipsis | Pass | CSS `max-height: 50%`；`indexNameClickCollapses`；选表后 catalog 仍是完整 `indexes` |
| V-docs | README | Pass | 中英不再写 Index 默认关树 / 下拉选索引 |
| V-reg | web test | Pass | 260 passed |
| V-static | typecheck | Pass | 退出码 0 |

## 回归

| 范围 | 结果 | 证据 |
|---|---|---|
| 既有 btree 树 / heap catalog / urlState / indexView | Pass | 同次 vitest 全绿 |
| 轮次 2 目录文案 | Pass | 关系名无 schema；表行无 `N blk`；段标题 TABLE/INDEX 大写 |
| 轮次 3 btree pill | Pass | B-tree 索引名无 `btree` 标记；hash/`invalid` 仍在；页节点 kind 保留 |
| 轮次 4 页节点 token | Pass | 只留 `meta`；leaf / L0 / root 已去掉 |
| 轮次 5 层级 icon | Pass | 三角只留段标题；表/索引/块为 CSS 图标 |
| 轮次 6 索引/块轮廓 | Pass | 索引为钥匙；块为折角页；两者 SVG 不同 |
| 轮次 7 取消按表过滤 | Pass | 选 `items` 后 `tb_pkey` 仍在；restore 不再按 table 丢 index |

## 文档与安全验收

| 项 | 结果 | 备注 |
|---|---|---|
| 用户可见文档 | Pass | README 中英树面板与选索引入口 |
| 运维可执行文档 | Pass | N/A（Plan） |
| 安全验证范围 | Pass | 无新密钥；请求仍走既有 indexes/page API |

## 缺陷

| ID | 严重度 | 摘要 | 状态 | 处理说明 | 验证证据 |
|---|---|---|---|---|---|
| — | | | | | |

## 阻塞（Blocked 时必填）

- 原因:
- 风险:
- 恢复条件:
- 复测范围:

## 结论

- 本轮结论: Pass
- 合并: 已授权
- 待合入提交: `b933a8cd02d07b9b58c3b04598e4b34a3bddf8b3`

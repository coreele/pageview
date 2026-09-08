# Review: btree-tree-view

## 审阅范围

- 实现版本 / 提交: `fe9d523bf85cc1b36b0bddf37a8b78eeb8c51a54`
- 依据: `plan.md`；`spec.md` / `design.md` / `ui-design.md`

## 实现正确性

与已确认 Spec 对齐：chrome **Show tree / Collapse tree**，默认折叠，折叠卸载 `#btree-tree-panel`；heap `main-split` 无 `data-tree`；展开取页用 `fetchIndexPage` 而非 `loadIndexBlk`；点节点才改当前页（同 blk 跳过）；`resetPageView` 与进 WAL 清树。`btreeDownlinks` 排除 hikey；`pathFromCache` 优先 root spine。未改 server、URL schema、`parseBtreePage`。

## 测试有效性

page-core 12 + web 12 条覆盖 P0-1–P0-7 与 P1-1–P1-3；P0-5 用 pending 集合而非恒真断言，错误实现（打开即列入全部叶）会失败。既有 web 210 / page-core 170 回归绿。P0-8 由 heap 分支未改 + 回归覆盖。P0-5 真库往返见 Plan 缺口，不挡 Approve。

## 文档影响核对

| Plan 声明 | 实现是否一致 | 备注 |
|---|---|---|
| 开发文档 | 是 | N/A |
| 用户文档 | 是 | README.md / README.zh-CN.md 索引节 |
| 运维文档 | 是 | N/A |

## 安全影响核对

| 检查项 | 结果 | 处置状态 | 备注 |
|---|---|---|---|
| 敏感信息 | 通过 | — | 无新密钥或连接串 |
| 认证与授权 | 通过 | — | 仍走既有已连接 + pageinspect 页端点 |
| 输入与外部访问 | 通过 | — | blkno 经既有 `fetchIndexPage` 守卫 |
| 依赖变更 | 通过 | — | 无新依赖 |

## 必修项

| ID | 位置 | 问题 | 状态 |
|---|---|---|---|
| — | | | |

## 非阻塞建议

- 树面板内方向键未做（Plan 已记缺口）；Tab+Enter 可达。
- `styles.css` 宽屏与通用 `.pane-tree` 有少量重复规则，可日后合并。

## 结论

Approve

> `Comment` 不得含任何必修项或未解决安全问题；否则必须改为 `Request changes`。

## 后续动作与复审范围

进 QA。复审仅在 QA Fail 回环时针对缺陷文件。

## 复审（布局回修 `36b5ff3`）

用户反馈树列过宽。CSS 改为 `fit-content(13rem)`，废止 `0.28fr` / `22rem`。仅 `styles.css`。行为合同不变。安全无新增面。结论仍 **Approve**。实现版本改为 `36b5ff315e25695dd8fc3cd1400bc9930cbce2a5`。

## 复审（表模式 `3dae723`）

范围扩大已写入 Spec P0-9/P0-10。缓存按 oid 分片，避免多索引 blk 0 冲突；表页挂同一 pane；激活走既有 `fetchIndexPage`。安全无新面。web 215 含 5 条森林用例。结论 **Approve**。实现版本 `3dae723b3e71af1ac5b28b17891fd7dbf84b9cd4`。

## 复审（表模式改为块列表 `d086861`）

用户更正：table 导航是扁平块列表，不是索引森林。`3dae723` 的森林合同作废。

实现：`visibleHeapBlockList` 由 `selectedTable.blocks` 生成；`onTreeActivate` heap 走 `loadBlk`、不改 kind；索引仍 `visibleTree(state, oid, blkno)`。换表/换索引/换 kind/WAL 清树。README 已改。无新依赖、无新端点、无 URL 参数。

测试：森林 5 条换成列表/窗口用例；既有路径/按需取页仍在。page-core 170 / web 215 绿。

结论 **Approve**。实现版本 `d086861fb038ca79e3a69380dcc3a76057b8483e`。

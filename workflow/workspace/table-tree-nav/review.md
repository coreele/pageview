# Review: table-tree-nav

## 审阅范围

- 实现版本 / 提交: `bf7c85490a318ce76676f4d167ffd141e1ef0da5`
- 依据: `plan.md`；`spec.md` / `ui-design.md`

## 实现正确性

与已确认 Spec 对齐：Table + 已连接时 chrome Tree 不依赖 `pageView`，默认开；导航为 `visibleTableCatalog`（表节点 + 展开后的堆块窗口）。点表名 `activateTable` → `loadBlk(oid, 0)`，0 块表不请求；expander 只 `toggleTableExpanded`。Table 次带无 `table-select`；Index 表过滤器 + 索引下拉 + `visibleTree` 仍在。深链 restore 对 table 再 `setTreeCollapsed(false)` + `ensureTableExpanded`。未改 server、URL 参数、`HEAP_BLOCK_LIST_CAP`、WAL。

## 测试有效性

`btreeTree.test.ts` 覆盖 P0-1/P0-4/P0-6/P0-7 的纯函数合同（chrome 可见性、空表无子节点、大表窗口、选中展开）。P0-2/P0-3/P0-5 的 App 接线靠代码审 + 既有 `loadBlk` 路径，无挂载测；错误实现（Index 仍无页就出 Tree、0 块表仍出现 page 行）会被现有单测抓住。web 238 回归绿。真机与 e2e 见 Plan 缺口，不挡 Approve。

## 文档影响核对

| Plan 声明 | 实现是否一致 | 备注 |
|---|---|---|
| 开发文档 | 是 | N/A |
| 用户文档 | 是 | README 中英：Table 用 Tree 选表 |
| 运维文档 | 是 | N/A |

## 安全影响核对

| 检查项 | 结果 | 处置状态 | 备注 |
|---|---|---|---|
| 敏感信息 | 通过 | — | 无新密钥或连接串 |
| 认证与授权 | 通过 | — | 仍走既有已连接 + pageinspect |
| 输入与外部访问 | 通过 | — | 点表/块仍经既有 `loadBlk` / `fetchPage` |
| 依赖变更 | 通过 | — | 无新依赖 |

## 必修项

| ID | 位置 | 问题 | 状态 |
|---|---|---|---|
| — | | | |

## 非阻塞建议

- App 里「默认开树」与「选中即展开」是两个 `useEffect`，与 restore 的 `setBtreeTree` 叠在一起；功能正确，日后可收成一个 `applyTableTreeDefaults`。
- e2e helpers 已改点树节点，但 CI 不跑 Playwright。

## 结论

Approve

> `Comment` 不得含任何必修项或未解决安全问题；否则必须改为 `Request changes`。

## 后续动作与复审范围

进 QA。复审仅在 QA Fail 回环时针对缺陷文件。

## 复审（层级显示 `f00465c`）

用户合入前反馈导航层级偏平。父子不再共用 inset accent：表/索引选中淡底，当前 page 才有左边条；子行加深缩进并加引导线。合同未改。web 241（含 treeNavUi 7）。安全无新面。结论仍 **Approve**。实现版本 `f00465c651b16729ef0c43345487998192007ce8`。

## 复审（文字高亮 `7fcae3c`）

用户反馈色块使表与 blk 间隔显得过大。去掉行底与 inset 条，选中改为 `.btree-tree-blk` accent 色；行距收为 `margin: 0` / `min-height: 1.4rem`。缩进与引导线保留。合同未改。web 241。安全无新面。结论仍 **Approve**。实现版本 `7fcae3c19c15c3dae64e4c65109986676abf9ac2`。

## 复审（点表名收起 `7a0897a`）

用户要求已展开的当前表再点表名即收起。`tableNameClickCollapses` + `activateTable` 早退，不 Load、不取消选中。收起后再点只展开。合同写入 Spec 点击与 P1。web 242。安全无新面。结论仍 **Approve**。实现版本 `7a0897a1f6e32688132b75b0f2290c988cba5925`。

## 复审（三栏拖动 `9dac4e3`）

用户反馈树与结构图贴死、要能拉宽。`PageSplit` 在宽屏插入 10px gutter，拖动改 `--page-split-cols`；结构图保底 280px。宽度进 localStorage，无凭据。web 246。安全：仅布局数字。结论仍 **Approve**。实现版本 `9dac4e3373ecb62c128dfa2c6a3d02ffa9a3acc6`。

## 复审（hex 等宽 `a323460`）

用户反馈 hex 右侧被裁、默认应与结构图等宽。`hexPx: null` → 两栏 `1fr`；上限 1600；pane 内滚动。storage `split.v2` 丢掉旧 360px。web 248。结论仍 **Approve**。实现版本 `a323460e87daf2e87a6e1ebbc242531ea0bfbe08`。

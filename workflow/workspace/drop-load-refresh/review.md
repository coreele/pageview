# Review: drop-load-refresh

## 审阅范围

- 实现版本 / 提交: `fa596be3c2468bd1e2122d07b7c3c1f9536653fa`
- 依据: `plan.md`；`spec.md` / `ui-design.md`（含 2026-09-08 修订：chrome 只保留 Tree 开关）
- 同步: `origin/main` `5482949620a8b27520151991939d1245c7ff5829` 已是祖先；源分支 HEAD 与 `dev-notes.md` 记录一致

## 实现正确性

与修订后 Spec 对齐。`pageBrowseMode(collapsed)`：false=Tree 亮，true=暗（沟通名 Single）。右上角仍是 `chromeToggleClass` 的 **Tree** 按钮，无 Single 字样、无 Tree|Single 分组。WAL 无此按钮。Tree 亮不渲染 `.chrome-controls`；已 Load 时 `.meta-stats` 仍在。Tree 暗保留原次带。切 Table/Index 不再强制开树。连库后 `useEffect([connected, mode])` 默认开树。`onTreeActivate` 对 page 行走 `pageRowClickAction`：loading 忽略，当前显示块 `refresh: true`，否则 Load；表/索引名仍走 `activateTable` / `activateIndex`。空态无「Open Tree」。未改 server、URL 参数、WAL Load / recent 20、`HEAP_BLOCK_LIST_CAP`。

## 测试有效性

`pageBrowse.test.ts` 覆盖 mode 映射、ignore/load/refresh、heap/btree 当前页。`treeNavUi.test.ts` 扫 Tree chrome-toggle、暗时才包 chrome-controls、无 `>Single<`、树行 refresh 调用、WAL 切片含 Load 且无 Tree。`chromeToggle.test.ts` README 禁止 `Tree | Single`。错误实现（同 blk 空操作、Tree 亮仍出 Load、chrome 出现 Single）会被这些测试抓住。web 269 + typecheck 绿。真机与 e2e 见 Plan 缺口，不挡 Approve。

## 文档影响核对

| Plan 声明 | 实现是否一致 | 备注 |
|---|---|---|
| 开发文档 | 是 | N/A |
| 用户文档 | 是 | README 中英：Tree 亮=目录、暗=blkno 查找；无 Single 界面名 |
| 运维文档 | 是 | N/A |

## 安全影响核对

| 检查项 | 结果 | 处置状态 | 备注 |
|---|---|---|---|
| 敏感信息 | 通过 | — | 无新密钥或连接串 |
| 认证与授权 | 通过 | — | 仍走既有已连接会话 |
| 输入与外部访问 | 通过 | — | 刷新仍走既有 `loadBlk` / `loadIndexBlk`；无新端点 |
| 依赖变更 | 通过 | — | 无新依赖 |

## 必修项

| ID | 位置 | 问题 | 状态 |
|---|---|---|---|
| — | | | |

## 非阻塞建议

- 从 WAL 回到 Page 时 `useEffect` 会把已关掉的 Tree 再点亮。符合「Page 默认 Tree 亮」，但会话内暗态不跨 WAL 保留。
- e2e `selectPageBrowseMode(..., "single")` 仍是 helper 参数名，对应关掉 Tree。

## 结论

Approve

> `Comment` 不得含任何必修项或未解决安全问题；否则必须改为 `Request changes`。

## 后续动作与复审范围

进 QA。复审仅在 QA Fail 回环时针对缺陷文件。

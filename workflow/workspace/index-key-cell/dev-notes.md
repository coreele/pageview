# Dev Notes: index-key-cell

## 实现摘要

结构图 index tuple 的 `key` 格原先没有 `valueText`。无列元数据时写入紧凑 hex；列元数据就绪后把 `tuple-N.key` 标为 `visualOnly`，并换成 `tuple-N.col-attnum` 格，标签为列名、值为解码结果（int4 → `"10"`），范围撑满 key 区以便格内容纳具体值。过长截断到 14 字符。详情「Key bytes」仍选中隐藏的 `.key` 格。

## 变更路径

- `packages/page-core/src/btree-structure.ts`、`packages/page-core/src/index.ts`、`packages/page-core/tests/btree.test.ts`
- `apps/web/src/App.tsx`、`apps/web/src/StructureMap.tsx`

## 测试先行记录（TDD）

| Spec ID / 行为项 | 测试 | 先失败 | 后通过 | 说明 |
|---|---|---|---|---|
| V-1 | `tuple-0.key` hex valueText 非空且 ≤14 | 是（新断言） | 是 | 无元数据占位 |
| V-2 | `applyIndexKeyCellValues` → `tuple-0.col-1` `"10"` | 是（`visualOnly` 未定义） | 是 | 用户要具体值后改为按列替换 |
| V-3 | `clipKeyCellText` / 多列 join 带 … | 是 | 是 | |
| V-reg | 既有 page-core / web | N/A | 是 | 174 / 218 |

## 验证

| 命令 | 验证层 | 结果摘要 / 证据 |
|---|---|---|
| `pnpm --filter page-core test` | unit | 6 files / 174 passed（btree.test 22） |
| `pnpm --filter web test` | unit | 14 files / 218 passed |
| `pnpm --filter page-core typecheck` | static | 退出码 0 |
| `pnpm --filter web typecheck` | static | 退出码 0 |

## 目标分支同步（最终 Review 前）

- 目标分支及提交: `origin/main` `381c63c3f6a9ed5921f3ee64ff02b63252f194f5`
- 同步后源分支 HEAD: `32d47725ca55171ed94e3b99e3027defbd24afbc`
- 同步方式: N/A（基于登记基线，main 未移动）
- 冲突及处理: N/A
- 同步后复验: 上表四条命令退出码 0

## 文档影响

| 类别 | 已更新路径或交接说明 |
|---|---|
| 开发文档 | N/A |
| 用户文档 | N/A |
| 运维文档 | N/A |

## 未解决风险 / 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 真机扫读 | 无已连接会话 | 极窄格容量 0 仍只显示标签 | 本地 Load 叶页看列格是否为解码值 |

## QA 修复回执

| 缺陷 ID | 处理 | 摘要 | 验证证据 | 建议复测范围 |
|---|---|---|---|---|
| | | | | |

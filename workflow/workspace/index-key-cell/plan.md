# Plan: index-key-cell

## 元信息

- 依据 Spec: N/A
- 依据 Design: N/A
- 依据 UI: N/A（结构图格形态不变，只补 `valueText`）
- 路径等级: fast
- Review 门禁: skipped（fast：补结构图已有 key 格的值）
- 最低验证层: unit + static
- 验证命令:
  - `pnpm --filter page-core test`
  - `pnpm --filter web test`
  - `pnpm --filter page-core typecheck`
  - `pnpm --filter web typecheck`
- 预期证据: 上述退出码 0；新增 key 格 valueText 用例通过。

## 目标摘要

索引结构图在列元数据可用时按列显示**解码后的具体值**（与 heap 列格相同）；元数据未到时 key 格仍用紧凑 hex 占位。过长截断带省略号。

## 任务拆解

1. **page-core**（完成条件：无元数据时 key 格 hex；有元数据时替换为 `tuple-N.col-attnum` 解码格）
2. **web 接线**（完成条件：`App` 在列元数据就绪后调用 `applyIndexKeyCellValues`）
3. **回归**（完成条件：既有 btree-structure / decode / web 测试绿）

## 依赖与顺序

1 → 2 → 3。

## 触碰路径

- `packages/page-core/src/btree-structure.ts`
- `packages/page-core/src/index.ts`
- `packages/page-core/tests/btree.test.ts`
- `apps/web/src/App.tsx`

不改：server、URL、位格条、详情面板键值区。

## 验收与验证

| ID | 要求或命令 | 预期证据 | 结果（实施后填） |
|---|---|---|---|
| V-1 | key 格有 hex valueText | `tuple-0.key` 非空且为 hex 预览 | 通过 |
| V-2 | 有列元数据时显示解码值 | 替换为 `tuple-0.col-1`，valueText 为十进制 `"10"` | 通过 |
| V-3 | 过长截断仍有值 | 长 hex/文本带 … 且长度 ≤ 14 | 通过 |
| V-reg | page-core + web 测试 | 退出码 0 | 通过 |
| V-static | typecheck | 退出码 0 | 通过 |

## 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 真机扫读 | 无已连接会话 | 宽格仍显空（容量 0） | 本地 Load 叶页看 key 格 |

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | N/A：无新公开 API 文档 |
| 用户文档 | N/A：README 未写 key 格 |
| 运维文档 | N/A |

## 交接顺序

1. Developer 实施与自验 →
2. Review skipped →
3. QA 验收 →
4. 用户授权合并 → Manager 第三阶段文档提交（`done`）→ 合入 → 归档

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-09-08 | 初稿 |
| 2026-09-08 | 用户要具体值：有元数据时按列解码，不把 hex 当主展示 |

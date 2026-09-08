# Dev Notes: flag-mark-size

## 实现摘要

详情 flag 清单的 Unicode ●/○ 换成共用 CSS 圆点 `FlagMark`（直径 0.62rem）。ItemId、`t_info`、位带 `?` 参考列表三处一致。位格条方块未改。

## 变更路径

- `apps/web/src/FlagMark.tsx`、`apps/web/src/FlagMark.test.ts`
- `apps/web/src/StructureMap.tsx`、`apps/web/src/IndexTupleDetail.tsx`、`apps/web/src/InfomaskBitStrip.tsx`
- `apps/web/src/styles.css`

## 测试先行记录（TDD）

| Spec ID / 行为项 | 测试 | 先失败 | 后通过 | 说明 |
|---|---|---|---|---|
| V-1 | `flagMarkClass` set/unset；CSS 直径 0.62rem | 是（新文件） | 是 | |
| V-2 | 三处源码无 ●/○ 且含 `FlagMark` | 是 | 是 | |
| V-3 | 既有 web 回归 | N/A | 是 | 218 passed |

## 验证

| 命令 | 验证层 | 结果摘要 / 证据 |
|---|---|---|
| `pnpm --filter web test` | unit | 14 files / 218 tests passed，含 FlagMark 3 |
| `pnpm --filter web typecheck` | static | 退出码 0 |

## 目标分支同步（最终 Review 前）

- 目标分支及提交: `origin/main` `7a3339e2c5691acaa531c6139810c717290d540a`
- 同步后源分支 HEAD: `d3cdfd76686298a1fe4064cc28f6948d5fb522f1`
- 同步方式: N/A（基于登记基线，main 未移动）
- 冲突及处理: N/A
- 同步后复验: web test + typecheck 退出码 0

## 文档影响

| 类别 | 已更新路径或交接说明 |
|---|---|
| 开发文档 | N/A |
| 用户文档 | N/A |
| 运维文档 | N/A |

## 未解决风险 / 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| 真机扫读 | 无已连接会话 | 暗色对比 | 本地 light/dark 看 ItemId 与 t_info |

## QA 修复回执

| 缺陷 ID | 处理 | 摘要 | 验证证据 | 建议复测范围 |
|---|---|---|---|---|
| | | | | |

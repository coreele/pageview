# QA Report: infomask-detail

## 轮次

| 轮次 | 日期 | 范围 | 结论 |
|---|---|---|---|
| 1 | 2026-07-27 | 首测：Spec P0×8 + P1×2；Plan 手测 1–8；Reviewer C2；回归；L2 复跑 | **Pass** |

## 环境与命令

| 项 | 值 |
|---|---|
| 实现版本 | `infomask-detail` @ **`8117685`** |
| 环境 | Windows；API `127.0.0.1:8787`（PG `pageview` / `public.tb`）；Vite `http://localhost:5175` |
| L2 | `pnpm test`（page-core 31 + server 4）；`pnpm --filter web test`（9）；`pnpm -r typecheck`；`pnpm -r build` — 全 Pass |
| 手测 | Playwright Chromium：`public.tb` blk0；P0-6 零已置另用 Vitest SSR `InfomaskBitStrip(value=0)`（临时用例已删） |
| 范围核对 | `main...8117685` 无 `page-core`/`server` diff；ItemId 未改版；无新主题键；README N/A |

## 覆盖（对照 plan 最低验证层 + spec 验收）

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| P0-1 | 位格条替换默认清单 | Pass | 两位 `.infomask-bit-strip`、20 格；默认无 `__ref`、无 infomask `.flag-list` |
| P0-2 | 保留可读 hex | Pass | `t_infomask=0x800`、`t_infomask2=0x2`（= `parsePage`） |
| P0-3 | hover/聚焦说明 | Pass | hover 与 `focus()` tip 同为 `HEAP_HASNULL — Has null bitmap` UNSET；set/unset 可分 |
| P0-4 | `?` 全量参考 | Pass | 开：16 项=格数且条仍在；Close 后 `__ref`=0 |
| P0-5 | 双字段统一策略 | Pass | 两 strip + 各自 `?` |
| P0-6 | 零已置仍可扫读 | Pass | SSR `value=0`：hex `0x0`、仅 `HEAP_NATTS` set；实库 NATTS「attributes: 2 (set)」+ 位格在 |
| P0-7 | 解码语义不回退 | Pass | UI set=`HEAP_XMAX_INVALID` / `HEAP_NATTS` = `decode*`；core 测绿；无 core diff |
| P0-8 | 详情与联动回归 | Pass | 主值、ctid、Columns；`.hex-cell.hl`=4；ItemId ○/●×4 |
| P1-1 | 主题可读 | Pass | light↔dark；两主题 set/unset 背景可辨 |
| P1-2 | 垂直空间改善 | Pass | 默认 strip ≈21.6px ≪ 估旧清单 16×18=288px |
| Plan L2 | test/typecheck/build | Pass | 见上 |
| C2 | Tab≡hover、`?`、零已置+NATTS、ItemId、Theme、高度 | Pass | P0-3/4/6/8、P1-1/2 |
| 手测 1–8 | Plan 清单 | Pass | 映射上表；无缺口 |
| 回归 | 主值 / 结构图↔hex / Columns / ctid / ItemId | Pass | 见 P0-8 |

## UI/UX

| 检查项 | 结果 | 证据 |
|---|---|---|
| Spec 界面相关验收 | Pass | P0-1..P0-6、P0-8、P1 手测 |
| `docs/standards/ui.md` 底线 | Pass | 格可聚焦+可见 tip；`?` 为 button；`:focus-visible`；token 沿用 |
| `ui-design.md` | N/A | Design skipped |

## 文档与安全

| 检查 | 结果 | 备注 |
|---|---|---|
| 开发文档 | Pass | `dev-notes` 手测缺口本轮补齐 |
| 用户 / 运维 | N/A | Plan 声明 |
| 安全 | 允许合并 | 无凭据泄露；无新认证/输入/依赖面；**无未解决安全问题** |

## 缺陷

| ID | 严重度 | 摘要 | 状态 |
|---|---|---|---|
| — | — | 无 | — |

## 结论

- 总体: **Pass**
- 恢复条件: N/A
- 合并: **待用户授权**（`infomask-detail` → `main`；本报告不单独提交；不改 STATUS；不合并）

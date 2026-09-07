# Dev Notes: column-align-pad

> Developer 记录：实现核对、验证证据、偏离与限制。状态维护见 STATUS / manager 记录。

## 实现概况

按 Plan T1–T6。TDD：先加 `structure-fields.test.ts` 列 range 全等 / 空洞无字段用例（相对折叠实现 3 红），再去掉 `visualStart` 前伸。

| 任务 | 结论 |
|---|---|
| T1 | 源分支 `column-align-pad` 自 `main` 检出 |
| T2 | 单测覆盖 P0-1/2/3/5/7、P1-1；先红后绿 |
| T3 | `deriveStructureFields` 列 range = 解码 range；不生成 `pad-*` / `data-gap-*` |
| T4 | `diff.test.ts`：空洞 `findStructureAt`/`resolveFieldAt` 为 `null`；未改 `StructureMap`/`styles.css`/`diff.ts` |
| T5 | README / README.zh-CN 无「列 padding 折叠」表述 → 已核无需改；图例无 `pad` chip |
| T6 | 见下方验证 |

## 偏离

无。未改 `parse.ts` / `decode.ts` / `apps/server`。

## 验证证据（2026-09-01）

| 命令 | 结果 |
|---|---|
| `pnpm --filter page-core test` | 58 passed |
| `pnpm --filter web test` | 100 passed（含空洞 `findStructureAt`） |
| `pnpm test` | page-core 58 + wal-core 13 + web 100 + server 31 = **202 passed** |
| `pnpm -r typecheck` | 四包零错误 |
| `pnpm -r build` | 成功（web `dist` js 284 kB / css 33 kB） |
| 禁止面 | `git diff main`：`parse.ts` / `decode.ts` / `apps/server` 无改 |

环境：node v24.19.0、pnpm 9.15.0。

## 手测缺口（quality.md §6）

- **原因**：CLI 会话，无浏览器。
- **涉及**：P0-2/P0-4 目视 `items` 列宽、P1-2 空洞底色、手测清单 1–6。
- **风险**：中。单测已锁 range 与空洞命中；第二行 data 风险低（未恢复 `data-gap` / 多 lane）。
- **恢复**：浏览器加载 `public.items` blk 0，按 Plan 手测清单复核。

## 建议 QA 复测

- 复跑 L2；手测 `public.items` 页 0 的 `price` 同宽、点空洞 hex 不选中列。
- 回归：infomask/pd_flags 位带、无 schema 页 `data`、单 lane。

# Plan: pnpm-12

## 元信息

- 依据 Spec: N/A
- 依据 Design: N/A
- 依据 UI: N/A
- 路径等级: fast
- Review 门禁: skipped（fast：工具链钉死版本，无产品行为合同）
- 最低验证层: static + unit + build
- 验证命令:
  - `pnpm --version`（须为 12.3.4）
  - `pnpm install --frozen-lockfile`（若 lockfile 因 pnpm 12 需要更新：先无 `--frozen-lockfile` 安装并提交 lockfile，再以 frozen 复验）
  - `pnpm -r typecheck`
  - `pnpm test`
  - `pnpm -r build`
- 预期证据: 仓库内 pnpm 为 12.3.4；frozen install 成功；typecheck 0 错误；测试通过；各包 build 成功。CI 两处 `pnpm/action-setup` 的 `version` 与根 `packageManager` 同为 12.3.4。

## 目标摘要

仓库内 `pnpm --version` 与 CI 使用 12.3.4，不再被 `packageManager` 钉在 9.15.0。README 下限改为 pnpm 12+。不改应用代码。

## 任务拆解

1. **T1** 根 `package.json` 的 `packageManager` 改为 `pnpm@12.3.4`。完成条件：在仓库根执行 `pnpm --version` 输出 `12.3.4`。
2. **T2** `.github/workflows/ci.yml` 两处 `pnpm/action-setup@v4` 的 `version` 改为 `12.3.4`。完成条件：与 `packageManager` 对齐。
3. **T3** `README.md` / `README.zh-CN.md` 环境要求 `pnpm 9+` 改为 `pnpm 12+`。完成条件：中英一致。
4. **T4** 用 12.3.4 安装依赖；lockfile 若因版本升级而必须改动则纳入提交。完成条件：`pnpm install --frozen-lockfile` 成功。
5. **T5** 跑 typecheck、unit test、build。完成条件：全部通过。

## 依赖与顺序

T1 → T2 → T3 → T4 → T5

## 触碰路径

- 修改：`package.json`、`.github/workflows/ci.yml`、`README.md`、`README.zh-CN.md`；必要时 `pnpm-lock.yaml`
- 禁触：应用源码、测试用例、其它工作流产物

## 验收与验证

| ID | 要求或命令 | 预期证据 | 结果（实施后填） |
|---|---|---|---|
| V-1 | 仓库根 `pnpm --version` | `12.3.4` | |
| V-2 | `package.json` `packageManager` 与 CI 两处 `version` | 均为 `12.3.4` / `pnpm@12.3.4` | |
| V-3 | 双语 README 要求 | `pnpm 12+` / `pnpm 12+` | |
| V-4 | `pnpm install --frozen-lockfile` | 退出码 0 | |
| V-5 | `pnpm -r typecheck` | 0 错误 | |
| V-6 | `pnpm test` | 全部通过 | |
| V-7 | `pnpm -r build` | 各包成功 | |

## 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| N/A | | | |

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | `README.md`、`README.zh-CN.md` 环境要求 |
| 用户文档 | N/A——无产品功能变更 |
| 运维文档 | N/A——CI 版本钉在 `.github/workflows/ci.yml`，不改 `workflow/ops/` |

## 交接顺序

1. Developer 实施与自验 →
2. Reviewer（本项 skipped）→
3. QA 验收 →
4. 用户授权合并 → Manager 第三阶段文档提交（`done`）→ 合入 → 归档

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-09-10 | 初稿 |

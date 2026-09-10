# Dev Notes: pnpm-12

## 实现摘要

把仓库钉死的 pnpm 从 9.15.0 升到 12.3.4：根 `packageManager`、CI `pnpm/action-setup` 两处、双语 README 下限。pnpm 12 默认 `strictDepBuilds`，未批准的依赖构建脚本会让 install 失败；在 `pnpm-workspace.yaml` 批准 `esbuild`。lockfile 增加 pnpm 12 的 `packageManagerDependencies` 文档块，`frozen-lockfile` 仍通过。

## 变更路径

- `package.json` — `packageManager`: `pnpm@12.3.4`
- `.github/workflows/ci.yml` — 两处 `version: 12.3.4`
- `README.md` / `README.zh-CN.md` — `pnpm 12+`
- `pnpm-workspace.yaml` — `allowBuilds.esbuild: true`
- `pnpm-lock.yaml` — pnpm 12 写入 `packageManagerDependencies`

## 测试先行记录（TDD）

| Spec ID / 行为项 | 测试 | 先失败 | 后通过 | 说明 |
|---|---|---|---|---|
| V-1 仓库内 pnpm 版本 | `pnpm --version` | N/A | 12.3.4 | 无应用行为可单测；改 `packageManager` 前同命令为 9.15.0 |
| V-4 frozen install | `pnpm install --frozen-lockfile` | 是：未批 esbuild 时 `ERR_PNPM_IGNORED_BUILDS` | 退出码 0 | 替代验证即 Plan 的 install/typecheck/test/build；风险：漏批其它需构建的依赖会在 CI 再爆。恢复：按错误包名补 `allowBuilds` |

## 验证

| 命令 | 验证层 | 结果摘要 / 证据 |
|---|---|---|
| `pnpm --version` | static | `12.3.4` |
| `pnpm install --frozen-lockfile` | build | 退出码 0；esbuild 0.25.12 / 0.28.1 postinstall Done |
| `pnpm -r typecheck` | static | page-core / wal-core / server / web 均 Done，0 错误 |
| `pnpm test` | unit | page-core 174、wal-core 13、server 86、web 293 全部通过 |
| `pnpm -r build` | build | tsc Done；web vite build 69 modules，`built in 1.08s` |

## 目标分支同步（最终 Review 前）

- 目标分支及提交: `main` @ `8033de99b6e672effb8734d9d122c24335f72a1f`
- 同步后源分支 HEAD: `8480ca43f86a6ef8b5779182a3c24ed3943dc205`
- 同步方式: rebase（`git fetch origin main` 后已与目标一致，无新提交）
- 冲突及处理: N/A
- 同步后复验: `pnpm --version` 12.3.4；`install --frozen-lockfile` 0；typecheck 0 错误；test 174+13+86+293 通过；build vite 69 modules / 1.07s

## 文档影响

| 类别 | 已更新路径或交接说明 |
|---|---|
| 开发文档 | `README.md`、`README.zh-CN.md` 环境要求改为 pnpm 12+ |
| 用户文档 | N/A |
| 运维文档 | N/A；CI 钉在 `.github/workflows/ci.yml` |

## 未解决风险 / 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| N/A | | | |

## QA 修复回执

| 缺陷 ID | 处理 | 摘要 | 验证证据 | 建议复测范围 |
|---|---|---|---|---|
| | | | | |

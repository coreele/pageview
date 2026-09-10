# QA Report: pnpm-12

> 首测与所有回归写在本文件，按轮次追加；禁止 `qa-report-v2.md`。

## 轮次

| 轮次 | 日期 | 实现版本 | 环境 | 范围 | 结论 |
|---|---|---|---|---|---|
| 1 | 2026-09-10 | `8480ca43f86a6ef8b5779182a3c24ed3943dc205` | Node v20.20.2（nvm）、pnpm 12.3.4（`$PNPM_HOME/bin`）；worktree `/home/jason/space/pageview-pnpm-12` | 首测：Plan V-1–V-7 + 钉死文件对照 + 回归 unit/typecheck/build | Pass |
| 2 | 2026-09-10 | `6080b1881ea11e91cb2107b023ef3bf2f373537d` | 同上；rebase 到含 chrome-theme-sun 的 `main` `dded4ef` | 同步轮次：仅 ancestry 变化，复跑 V-1/V-4–V-7 | Pass |

## 执行命令

### 轮次 1

| 命令 | 输出摘要 / 证据位置 |
|---|---|
| `git rev-parse HEAD` | `8480ca43f86a6ef8b5779182a3c24ed3943dc205` |
| `pnpm --version` | `12.3.4` |
| `pnpm install --frozen-lockfile` | 退出码 0；Lockfile is up to date |
| `pnpm -r typecheck` | page-core / wal-core / server / web 均 Done |
| `pnpm test` | page-core 174、wal-core 13、server 86、web 293 全部通过 |
| `pnpm -r build` | tsc Done；web vite 69 modules，`built in 1.07s` |

### 轮次 2

| 命令 | 输出摘要 / 证据位置 |
|---|---|
| `git diff 8480ca4 6080b18 -- package.json pnpm-lock.yaml pnpm-workspace.yaml README.md README.zh-CN.md .github/workflows/ci.yml` | 空（实现文件树不变） |
| `git rev-parse HEAD` | `6080b1881ea11e91cb2107b023ef3bf2f373537d` |
| `pnpm --version` | `12.3.4` |
| `pnpm install --frozen-lockfile` | 退出码 0 |
| `pnpm -r typecheck` | 四包 Done |
| `pnpm test` | 566 passed（174+13+86+293） |
| `pnpm -r build` | web vite 69 modules，`built in 1.16s` |

## 覆盖（对照 Spec 验收与 Plan 验证）

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| V-1 | 仓库根 `pnpm --version` 为 12.3.4 | 通过 | 命令输出 `12.3.4` |
| V-2 | `packageManager` 与 CI 两处 version | 通过 | `package.json` `pnpm@12.3.4`；`ci.yml` L17 与 L53 均为 `12.3.4` |
| V-3 | 双语 README `pnpm 12+` | 通过 | `README.md` L48；`README.zh-CN.md` L47 |
| V-4 | `pnpm install --frozen-lockfile` | 通过 | 退出码 0 |
| V-5 | `pnpm -r typecheck` | 通过 | 四包 Done，0 错误 |
| V-6 | `pnpm test` | 通过 | 566 tests passed（174+13+86+293） |
| V-7 | `pnpm -r build` | 通过 | 各包成功；web dist 产出 |

## 回归

| 范围 | 结果 | 证据 |
|---|---|---|
| 既有 unit（page-core / wal-core / server / web） | 通过 | 与 V-6 同一次 `pnpm test` |
| typecheck + production build | 通过 | 与 V-5 / V-7 同一次命令 |
| `allowBuilds.esbuild: true` 后 install 不再 `ERR_PNPM_IGNORED_BUILDS` | 通过 | frozen install 成功 |

## 文档与安全验收

| 项 | 结果 | 备注 |
|---|---|---|
| 用户可见文档 | 通过 | 无产品功能变更；开发 README 环境要求已改为 pnpm 12+ |
| 运维可执行文档 | N/A | 不改 `workflow/ops/`；CI 钉在 `.github/workflows/ci.yml` |
| 安全验证范围 | 通过 | 工具链升级；`allowBuilds` 仅批准 `esbuild`（构建所需 postinstall），未开 `dangerouslyAllowAllBuilds`；无凭据写入 |

## 缺陷

| ID | 严重度 | 摘要 | 状态 | 处理说明 | 验证证据 |
|---|---|---|---|---|---|
| | | | | | |

## 阻塞（Blocked 时必填）

- 原因:
- 风险:
- 恢复条件:
- 复测范围:

## 结论

- 本轮结论: Pass
- 合并: 已授权（等 Manager 置 `done`）

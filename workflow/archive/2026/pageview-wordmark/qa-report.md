# QA Report: pageview-wordmark

> 首测与所有回归写在本文件，按轮次追加；禁止 `qa-report-v2.md`。

## 轮次

| 轮次 | 日期 | 实现版本 | 环境 | 范围 | 结论 |
|---|---|---|---|---|---|
| 1 | 2026-09-09 | `da2b02f63c33921834ab73699f8af46bd60fc34e` | 本地 web vitest + tsc；本地 `main` `0c9aada` 为祖先 | 首测 | Pass |

## 执行命令

| 命令 | 输出摘要 / 证据位置 |
|---|---|
| `pnpm --filter web test` | 20 files / 293 passed |
| `pnpm --filter web typecheck` | 退出码 0 |

## 覆盖（对照 Spec 验收与 Plan 验证）

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| V-1 | chrome 字标 PAGEVIEW + logo | Pass | h1 含 `PAGEVIEW`、`/favicon.svg`、`alt=""`、`aria-hidden`；`App.tsx` 无 `pg-page-viewer` |
| V-2 | 标签页标题 | Pass | `apps/web/index.html` `<title>PAGEVIEW</title>` |
| V-3 | README H1 | Pass | 中英均以 `# PAGEVIEW\n` 开头 |
| V-4 | e2e heading | Pass | smoke 与 m2-m4-m5 源码断言 `PAGEVIEW`（未实跑 Playwright） |
| V-reg | web test | Pass | 293 passed |
| V-static | typecheck | Pass | 退出码 0 |

## 回归

| 范围 | 结果 | 证据 |
|---|---|---|
| chrome 开关 / 顺序 / 主题钮 | Pass | `chromeToggle.test.ts` 既有用例仍绿 |
| theme / split localStorage 键 | Pass | `theme.ts` / `paneSplit.ts` 仍为 `pg-page-viewer.*` |
| export / tree / gutter 单测 | Pass | 同次 vitest 全绿 |

## 文档与安全验收

| 项 | 结果 | 备注 |
|---|---|---|
| 用户可见文档 | Pass | README 中英 H1 已改；正文仍写 PostgreSQL / pageinspect |
| 运维可执行文档 | Pass | N/A |
| 安全验证范围 | Pass | 无新请求面；logo 为静态 public SVG |

## 缺陷

| ID | 严重度 | 摘要 | 状态 | 处理说明 | 验证证据 |
|---|---|---|---|---|---|
| — | | | | | |

## 阻塞（Blocked 时必填）

- 原因:
- 风险:
- 恢复条件:
- 复测范围:

## 验证缺口（不阻塞）

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| Playwright 实跑 | 本项最低层为单位扫描 | 浏览器 a11y 名与扫描不一致 | `pnpm test:e2e` 冒烟 |
| 真机顶栏对照 | 无浏览器自动化 | 间距或字距观感 | 深色开一页看左上 |

## 结论

- 本轮结论: Pass
- 合并: 已授权（等 Manager 置 `done`）
- 待合入提交: `da2b02f63c33921834ab73699f8af46bd60fc34e`

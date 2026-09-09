# Dev Notes: pageview-wordmark

## 实现摘要

chrome `h1` 改为装饰性 favicon（`/favicon.svg`，`alt=""` / `aria-hidden`）+ 字标 `PAGEVIEW`。`.chrome-title` 加 `gap`、正字距、`nowrap`。`<title>` 与 README 中英 H1 同步。e2e heading 断言改为 `PAGEVIEW`。`theme` / `split` 的 `STORAGE_KEY` 未改。

## 变更路径

- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/chromeToggle.test.ts`
- `apps/web/index.html`
- `README.md`、`README.zh-CN.md`
- `e2e/smoke.spec.ts`、`e2e/m2-m4-m5.spec.ts`

## 测试先行记录（TDD）

| Spec ID / 行为项 | 测试 | 先失败 | 后通过 | 说明 |
|---|---|---|---|---|
| V-1 | chromeToggle 扫描 h1 含 PAGEVIEW + favicon | 否 | 是 | 与实现同批 |
| V-2 | index.html `<title>PAGEVIEW</title>` | 否 | 是 | 同批 |
| V-3 | README 中英 H1 | 否 | 是 | 同批 |
| V-4 | e2e heading 源码断言 | 否 | 是 | 未实跑 Playwright |
| V-reg / V-static | web test + typecheck | — | 是 | 20 files / 293；tsc 0 |

## 验证

| 命令 | 验证层 | 结果摘要 / 证据 |
|---|---|---|
| `pnpm --filter web test` | unit | 20 files / 293 passed |
| `pnpm --filter web typecheck` | static | 退出码 0 |

## 目标分支同步（最终 Review 前）

- 目标分支及提交: 本地 `main` `0c9aada6dfaa136178c48b831ada133eb41622d8`（`origin/main` 仍为 `d94ef94`，含未推送的 `fix-wal-smoke-ci`）
- 同步后源分支 HEAD: `da2b02f63c33921834ab73699f8af46bd60fc34e`
- 同步方式: N/A（源分支自该 main 创建）
- 冲突及处理: N/A
- 同步后复验: `pnpm --filter web test` 20/293；typecheck 0

## 文档影响

| 类别 | 已更新路径或交接说明 |
|---|---|
| 开发文档 | N/A |
| 用户文档 | `README.md`、`README.zh-CN.md` H1 |
| 运维文档 | N/A |

## 未解决风险 / 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| Playwright 实跑 | 最低层为单位扫描 | e2e 双栈未在本机跑 | `pnpm test:e2e` 冒烟 |
| 真机顶栏对照 | 本会话无浏览器工具 | logo 间距观感 | 深色开一页看左上 |

## QA 修复回执

| 缺陷 ID | 处理 | 摘要 | 验证证据 | 建议复测范围 |
|---|---|---|---|---|
| | | | | |

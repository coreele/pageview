# Plan: pageview-wordmark

## 元信息

- 依据 Spec: N/A
- 依据 Design: N/A
- 依据 UI: `workflow/archive/2026/pageview-wordmark/ui-design.md`
- 路径等级: fast
- Review 门禁: skipped（fast：chrome 字标 + 引用现有 favicon）
- 最低验证层: unit + static
- 验证命令:
  - `pnpm --filter web test`
  - `pnpm --filter web typecheck`
- 预期证据: 退出码 0；字标/title/README/e2e 扫描用例通过。

## 目标摘要

chrome 左上改为 favicon logo + 字标 `PAGEVIEW`；文档标题与 README 一级标题同步。存储键与仓库名不动。

## 任务拆解

1. **chrome 字标**（完成条件：`h1.chrome-title` 含装饰 logo 与文本 `PAGEVIEW`，源码无 chrome 用的 `pg-page-viewer`）
2. **标题与文档**（完成条件：`index.html` title 与 README 中英 H1 均为 `PAGEVIEW`）
3. **e2e 断言**（完成条件：heading 名改为 `PAGEVIEW`）
4. **回归**（完成条件：web test + typecheck 绿）

## 依赖与顺序

1 与 2、3 同批 → 4。

## 触碰路径

- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/chromeToggle.test.ts`（或并列字标扫描测）
- `apps/web/index.html`
- `README.md`、`README.zh-CN.md`
- `e2e/smoke.spec.ts`、`e2e/m2-m4-m5.spec.ts`

不改：`theme.ts` / `paneSplit.ts` 的 `STORAGE_KEY`、`favicon.svg` 图形、server、仓库远程。

## 验收与验证

| ID | 要求或命令 | 预期证据 | 结果（实施后填） |
|---|---|---|---|
| V-1 | chrome 字标 PAGEVIEW + logo | App.tsx `h1.chrome-title` 含 `PAGEVIEW` 与 `/favicon.svg`；无 `pg-page-viewer` | Pass |
| V-2 | 标签页标题 | `index.html` `<title>PAGEVIEW</title>` | Pass |
| V-3 | README H1 | 中英第一行 `# PAGEVIEW` | Pass |
| V-4 | e2e heading | smoke 与 m2-m4-m5 断言 `PAGEVIEW` | Pass |
| V-reg | web test | 退出码 0 | Pass |
| V-static | typecheck | 退出码 0 | Pass |

## 验证缺口

| 项 | 原因 | 风险 | 恢复条件 |
|---|---|---|---|
| Playwright 实跑 | 本项最低层为单位扫描；e2e 需双栈 | 断言已改但未在浏览器点过 | 有环境时 `pnpm test:e2e` 冒烟 |
| 真机顶栏对照 | 本会话未必开浏览器 | logo 与字标间距观感 | 深色开一页看左上 |

## 文档影响

| 类别 | 更新路径或 N/A 理由 |
|---|---|
| 开发文档 | N/A |
| 用户文档 | `README.md`、`README.zh-CN.md` 一级标题 |
| 运维文档 | N/A |

## 交接顺序

1. Developer 实施与自验 →
2. Review skipped →
3. QA 验收 →
4. 用户授权合并 → Manager 第三阶段文档提交（`done`）→ 合入 → 归档

## 修订记录

| 日期 | 摘要 |
|---|---|
| 2026-09-09 | 初稿 |

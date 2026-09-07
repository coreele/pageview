# Review: e2e-playwright

## 审阅范围

- 分支 `e2e-playwright`（自 `url-deeplink` tip `d452978`）。提交 `6dd36e0`、`33dc7d5`。版本 `33dc7d5`。
- 变更：Playwright 基建与 M1–M10、`vite.config.ts` preview 代理、`ci.yml` e2e job、README 双语、`App.tsx` 两行 `preserveRawUrlRef` 守卫（Plan 禁触例外）。
- 依据：工作项记录（Spec skipped）、design.md、plan.md（T1–T7，L4+L2/L3）、url-deeplink ui-design.md 冻结文案与 M1–M10、standards documentation/quality/security/git。
- Reviewer 独立验证：2026-09-07。

## 结论

**Approve**

无阻塞项。T1–T7 与 M1–M10 可测合同满足；测试能因契约破坏变红；文档与 Plan 一致；安全无未决问题；Git 合规。CI Actions 实跑按 Plan 缺口表不构成本 Review 阻塞，QA Pass / 合并前须 push 后补认。

## 必修项

无。

> `Comment` 不得包含阻塞项；阻塞问题须使用 `Request changes`。

## 独立验证（Reviewer 亲跑，非复述 Developer）

| 命令 | 结果 |
|---|---|
| `pnpm --filter server exec tsc --noEmit -p ../../tsconfig.e2e.json` | 退出 0 |
| `pnpm exec playwright test` | **11 passed**（48.8s） |
| 读码 | `e2e/helpers/url.ts` `buildUrlState` 与 `urlState.ts` 逐行同构；M4 四条 message 与 ui-design 冻结表逐字一致 |
| Git | 源分支名匹配；Conventional Commits；无 `.env`/凭据入库；gitignore 含 `playwright-report/`、`test-results/`、`e2e/.seed.json` |

## 实现正确性

| 要求 | 证据 | 结果 |
|---|---|---|
| T1 基建 | `@playwright/test@1.63.0`；双 webServer；种子 `pageview_e2e`（≥8 页、loud fail）；`PAGEVIEW_API_TARGET` + `preview.proxy`；冒烟 title/connected/种子表 | 通过 |
| T2 M1+M7 | 独立文件；精确 search；Load push / 失败不写 / goBack；裸 URL +「Select a heap table to begin.」 | 通过 |
| T3 M2+M4+M5 | 直开+reload；WAL 输入保持种子 LSN；`role=alert` 冻结三段式；`NOT_HEAP_TABLE`/`NOT_INDEX`/`BLKNO_OUT_OF_RANGE` | 通过 |
| T4 M6+M8+M9 | 5→7 历史链 + Refresh 无空跳；LSN `%2F` 与 `/`；归一/单 LSN/块 0/守卫零 `/pages/` 请求 | 通过 |
| T5 M10+M3 | 双 tab 独立 blkno；空串凭据栈 → Connect → 自动加载块 5 | 通过 |
| T6 CI | 第三 job 对齐 integration；cache 含 lockfile；失败 artifact | 通过（YAML；Actions 见 F4） |
| T7 文档 | README 双语命令与三 job；dev-notes 故意破坏红→绿 | 通过 |
| App.tsx 例外 | `preserveRawUrlRef.current` 时不清 `BAD_URL_PARAM`；否则已连接形态 M4 恒红（P0-8） | 通过 |

## 测试有效性

| 要求 | 证据 | 结果 |
|---|---|---|
| 失败可检 | 期望 URL 来自独立 helper、应用来自 `urlState.ts`，漂移则 `expectSearch` 红；M4 锚定冻结原文；M9 计数 `/pages/`；M1 用 `goBack` 判 replace/push | 通过 |
| 非恒真 | 上列断言绑定 DOM/地址栏/网络，不是空 `toBeTruthy()` | 通过 |

未覆盖（非阻塞）：M4 缺冻结表 `kind` 非法行；M1 未单测模式/种类切换 replace（M2/M9 有相关路径）。

## UI/UX 核对

| 检查项 | 结果 | 备注 |
|---|---|---|
| 对照 Spec 界面验收 | N/A | 本项 UI 表面 none；无本项 Spec |
| 对照 `workflow/docs/standards/ui.md` | N/A | 不改产品 UI |
| 对照 `ui-design.md` | N/A（本项无） | 套件对照 url-deeplink ui-design，见测试有效性 |
| 主题/深色（仅 Spec 要求时） | N/A | 未要求 |

## 文档影响核对

| Plan 声明 | 实现是否一致 | 备注 |
|---|---|---|
| 开发文档 | 一致 | README 双语 Development：`playwright install chromium`、`pnpm test:e2e`、CI 三 job；dev-notes 证据与 App.tsx 例外 |
| 用户文档 | N/A | README 功能节未改 |
| 运维文档 | N/A | CI 即 `ci.yml`；README 已述 |

## 安全影响核对

| 检查项 | 结果 | 备注 |
|---|---|---|
| 敏感信息 | 通过 | 无硬编码真实凭据；M3 运行时读 env；`.seed.json` gitignore。CI `postgres:postgres` 同 integration job |
| 认证与授权 | N/A | 无认证模型变更 |
| 输入与外部访问 | 通过 | 种子标识符为字面量；oid 经 `regclass`。清除 `HTTP_PROXY` 仅限 Playwright 进程 |
| 依赖变更 | 通过 | 仅 `@playwright/test@1.63.0` |
| 结论 | 无未解决安全问题，允许进入 QA | 范围：凭据、种子、CI env、gitignore |

## 发现项

| ID | 严重度 | 位置 | 问题 | 状态 |
|---|---|---|---|---|
| F1 | Info | apps/web/src/App.tsx:323,375 | Plan 禁触 `apps/web/src/**`。两行是 P0-8 修复，M4 可检，dev-notes 已声明。合入顺序仍 url-deeplink 先于本分支 | 非阻塞 |
| F2 | Info | e2e/m2-m4-m5.spec.ts M4 | 未覆盖冻结表 `kind` 非法行 | 非阻塞 |
| F3 | Info | e2e/helpers/db.ts | 从 `dist/session.js` 取凭据，依赖先 build。`pnpm test:e2e` 已含 build | 非阻塞 |
| F4 | Info | ci.yml e2e job | Actions 实跑未做（Plan 缺口表已列） | 转入 QA 前/合并前补认 |

## 后续动作与复审范围

1. Manager 调度 QA：复跑 `pnpm test:e2e` 与 L2/L3 回归，抽查断言与 README；写 `qa-report.md`。url-deeplink QA 轮次 2 复用本套件作 M1–M10 证据。
2. F1–F3 无需修复即可进 QA。F4 在分支 push 后由 QA 记 Actions。
3. QA Fail 退回时，复审限于缺陷相关测试/基建。

# Review: infomask-detail

## 审阅范围与依据

| 项 | 内容 |
|---|---|
| 工作项 | `infomask-detail`（未拆分）· `standard` · Review **required** · UI `gui` · Design **skipped**（无 `design.md` / `ui-design.md`） |
| 审阅版本 | 分支 `infomask-detail` HEAD **`8117685`**（`81176854062ab7ecdc12ece7bde1dff29d3961df`）· 相对 `main` 1 commit：`feat(web): compact infomask bit strip in selection detail` |
| 工作树 | 未入库：本 `review.md`；Manager 侧 `STATUS.md` / `infomask-detail.md`（**不在**实现提交） |
| 依据 | `spec.md`（8×P0 + 2×P1，approved）；`plan.md`（T1–T6，approved）；`dev-notes.md`；`docs/standards/{documentation,quality,security,git,ui}.md` |
| 审阅代码 | `apps/web/src/{InfomaskBitStrip.tsx,InfomaskBitStrip.test.ts,StructureMap.tsx,styles.css}`；feature 文档 |
| 独立取证 | `pnpm --filter web test -- InfomaskBitStrip` 3 Pass；`pnpm --filter page-core test` 31 Pass；`main...HEAD` 对 `packages/page-core` / `apps/server` **空 diff**；StructureMap 仅两位字段改接组件，ItemId `.flag-list` 保留 |

## 结论

**Approve**。无阻塞项。hex + 位格条 + hover/聚焦 tip + `?` 全量参考；双字段统一；未改 page-core/server；ItemId 未改版：静态与 L2 满足进 QA。浏览器 GWT 手测按 quality.md §6 记缺口并交 QA，不阻塞 Review→QA。

## 实现正确性

| 合同 | 结果 | 证据 |
|---|---|---|
| P0-1 位格条替换默认清单 | 通过（静态） | `StructureMap` 两位改 `InfomaskBitStrip`；默认无 ○/● 全量列表；参考仅在 `?` 打开态 |
| P0-2 可读 hex | 通过 | `formatInfomaskHex` → `label=0x` + `toString(16)`；与改版前约定一致；单测锁 0x800/0x2/0x0 |
| P0-3 hover/聚焦说明 | 通过（静态） | 格 `tabIndex={0}`；可见 `__tip` 含 `name`/`meaning`/set 态；非仅 `title` |
| P0-4 `?` 全量参考 | 通过（静态） | `button` + `aria-expanded`；`__ref` 含全部位 ○/●+名称+含义；可关；打开不删位格条 |
| P0-5 双字段统一 | 通过 | 两位同一组件/模式；仅 `bits` 来源不同 |
| P0-6 零已置 | 通过（静态+单测） | 组件恒渲染 hex+格；`decodeInfomask2(0)` 单测：`HEAP_NATTS` `set`、其余 unset |
| P0-7 解码不回退 | 通过 | UI 消费传入 `FlagBit[]`；无前端位定义表；`main...HEAD` 无 page-core diff；core 测绿 |
| P0-8 详情与联动回归 | 通过（静态） | ItemId 仍 `decodeItemIdFlags` + `.flag-list`；HOT/主值接线未改 |
| P1-1 主题可读 | 通过（静态） | 样式用 `--accent`/`--border`/`--text-muted`/`--surface`；未增主题键 |
| P1-2 垂直空间 | 通过（静态） | 紧凑格条 + tip/`?` 按需；默认高度预期显著短于原纵向清单 |

范围确认：无 `packages/page-core/**` / `apps/server/**` 业务变更；ItemId flags 未改版。浏览器目视（含 P0-8/P1）见测试缺口 → QA。

## 测试有效性

| 层 | 结论 |
|---|---|
| Plan L2 | **满足**：web Vitest + page-core 回归 + typecheck/build（dev-notes）；本会话复跑 InfomaskBitStrip 3 + page-core 31 Pass |
| 单测有效性 | **部分有效**：hex 约定与 `decode*` set/`HEAP_NATTS` 可因错误实现失败；order 断言与自身同源，偏弱 |
| 缺口 | 无组件渲染/交互测；手测 1–8 未跑；`dev-notes`：原因 / 中风险 / 恢复=QA；符合 quality.md §6 |
| QA 必测 | Spec GWT P0-1..P0-8 + P1-1/P1-2；重点 hover·Tab、`?` 开关、零已置、ItemId 清单、Theme、高度对比 |

## 文档影响核对

| Plan 声明 | 一致？ | 备注 |
|---|---|---|
| 开发 → `dev-notes.md` | 是 | T1–T6、L2、page-core 空 diff、手测缺口 §6 |
| 用户 → README N/A | 是 | README 未描述旧 ○/●；未改 |
| 运维 → N/A | 是 | 无部署/监控变更 |
| feature 文档 | 是 | spec/plan/dev-notes 已入库；本报告待 Manager 择机提交 |

## 安全影响核对

| 检查项 | 结果 | 备注 |
|---|---|---|
| 敏感信息 | 通过 | 提交/文档无凭据；`.env` 未跟踪 |
| 认证与授权 | 无新增面 | 未改 connect / server |
| 输入与外部访问 | 无新增面 | 纯 Selection detail 呈现既有解码结果 |
| 文件操作 | N/A | |
| 依赖变更 | N/A | 实现提交无依赖变更 |
| 处置状态 | 允许继续 | **无未解决安全问题** |

## UI/UX 核对

| 检查项 | 结果 | 备注 |
|---|---|---|
| Spec 界面验收 | 通过（静态） | hex+位格+tip+`?`；默认无纵向全列表；键盘聚焦与 `?` 按钮 |
| `docs/standards/ui.md` | 通过（底线抽样） | 无 `ui-design.md`（Design skipped）；`:focus-visible`；`?` 可键盘激活 |
| `ui-design.md` | N/A | Design 门禁 skipped |
| 主题/深色 | 通过（静态） | Spec P1-1：token 沿用既有 light/dark；对比手测 → QA |

## Git 合规

| 检查项 | 结果 |
|---|---|
| 分支 | `infomask-detail` → `main`；未在 `main` 实施 |
| 提交 | Conventional Commits；路径与 Plan 一致（web + feature docs） |
| 禁止项 | 无 `.env`/凭据/构建产物；无 page-core/server 业务文件 |
| 工作树 | 勿误加 Manager `STATUS.md` / `infomask-detail.md` 于实现提交 |

## 发现项

### 必修项（阻塞）

无。

### 非阻塞建议

| ID | 位置 | 建议 |
|---|---|---|
| C1 | `InfomaskBitStrip.test.ts` | order 测与 `decodeInfomask(0x800)` 同源，可改为固定期望名序列或组件渲染断言；非进 QA 前置 |
| C2 | QA | 必覆盖 P0-3（Tab≡hover tip）、P0-4（`?` 可关且主区仍紧凑）、P0-6（`t_infomask==0` + NATTS）、P0-8 ItemId、P1-1/P1-2 |
| C3 | a11y（可选） | 每位格 `tabIndex={0}` Tab 停顿较多；若后续优化可考虑 roving tabindex；不违反当前 Spec |

## 后续动作

1. Manager：→ `qa`；**勿**仅为进 QA 提交本 `review.md`（git.md §1.4）。
2. QA：Spec GWT + Plan 手测清单 → `qa-report.md`。
3. 复审：仅 QA Fail 或合同变更后；本结论无需 Developer 返工。

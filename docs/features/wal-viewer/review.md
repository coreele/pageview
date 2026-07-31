# Review: wal-viewer

## 复审 · UI 打磨（合并前）

| 项 | 内容 |
|---|---|
| 工作项 | `wal-viewer`（未拆分）· 路径 `full` · Review 门禁 `required` · UI 表面 `gui` |
| 轮次 | **增量复审 · UI 打磨**（相对 Approve @ `5690895` / QA Pass 轮次 4） |
| 审阅版本 | 源分支 `wal-viewer` @ `696a8d4dbde3f2f292af80377213f3f924378e1f` |
| 实现 | `696a8d4` — `feat(web): polish WAL viewer chrome and record list` |
| 对照 | `5690895..696a8d4`：`App.tsx`、`WalView.tsx`、`styles.css`、`dev-notes.md` |
| 依据 | Spec（P1-2、列表列、FPI/hex）；`ui-design.md`；用户目视「同意继续」（**非**合并授权） |
| 独立核验 | 静态 diff + 源码；未跑浏览器；无 server/`api.ts`/wal-core 变更 |

### 结论

**Approve** — 无阻塞项；进 WAL 预填不自动 Load；列布局无 prev / xid 第二列未回退；无安全问题。可进 QA 轮次 5。

### 必修项

无。

### 实现正确性

| 核验点 | 结果 | 证据 |
|---|---|---|
| 进 WAL 预填 ~20，**不**自动 Load（P1-2） | 通过 | `useEffect([connected,mode])` 只写 start/end，无 `fetchWalRecords` |
| `recent 20` 填窗+Load | 通过 | `onWalRecent20`；用户目视已确认 |
| 手动 Load 独立；Enter→Load | 通过 | `onWalLoad` |
| 失败不写假窗口 | 通过 | recent-window 失败不写 start/end |
| 无 prev；xid 第二列 | 通过 | 行序 start→xid→…；`prevLsn` 仅详情 |
| end LSN 可辨识 | 通过（弱） | 行 `title` + 详情；见 C6 |
| 换批清选中；Collapse detail | 通过 | `records` 变清选中；`detailOpen` |
| Load diff / `#new` | 通过 | 相对上一批 `startLsn`；首轮不高亮 |
| FPI 不撑爆；Hex 不伪造 | 通过 | 仅 `fpiLength`；无伪造 dump（C8/C9） |

### 测试有效性

| 层 | 结果 | 备注 |
|---|---|---|
| L2 | 旁证 | Developer：web typecheck；web 20 / server 17 passed；无新 WAL 组件单测 |
| 静态 UI | 通过 | 可因预填误 Load、prev 泄漏、xid 错位失败 |
| 浏览器 | 未做 | 交 QA 轮次 5 |

本轮未复跑测试；以 diff 与 Developer 证据为准。

### 文档影响

| 项 | 一致 | 备注 |
|---|---|---|
| `dev-notes.md` | 是 | 打磨行为、验证、QA 复测建议 |
| `spec.md` / `ui-design.md` | 未改 | 与 `recent 20`/表头有文案漂移（C6–C8） |
| README | 未改 | 无新运维依赖 |

### 安全影响（增量）

范围：web 控件上移与样式；无认证/授权/SQL/文件/出站/依赖变更；无敏感信息入提交。**无发现项；允许进入 QA。**

### UI/UX

核心列与进 WAL 不盲拉满足 Spec/`ui-design`。主题沿用既有 token + `--wal-new*`。视觉用户已目视确认；交互回归交 QA。

### Git 合规

源 `wal-viewer` @ `696a8d4`；无禁止提交项。本报告不 commit（`git.md` §1.4）。**通过。**

### 发现项

无阻塞项。

| 级别 | ID | 位置 | 说明 |
|---|---|---|---|
| Low | C6 | `WalView` LSN 列 | 无行内 `→ end`（仅 `title`+详情）。Spec「可辨识」成立；弱于 ui-design「旁注」/轮次 4 可见 start→end |
| Low | C7 | `recent 20` | 填+Load；Fill-only=进 WAL 预填。与 Spec「Fill 不自动 Load」文案不同形，P1-2 进模不盲拉仍成立 |
| Low | C8 | 详情 | 撤 hex 占位；未伪造。ui-design「固定 hex 槽」漂移 |
| Low | C9 | 列表 FPI | 无折叠芯片；`len_fpi` 显长度，禁 8KB 满足 |
| Low | C10 | 表头 `aria-hidden` | 列名对 AT 不可见 |
| Low | C5 | 历史 | 列布局 commit 混 STATUS（旁注） |

既有 Low（C1/C3/C4 等）仍非阻塞。

### 后续动作与复审范围

1. Manager → **QA 轮次 5**：UI（表头/圆角/选中/diff/`#new`/Collapse）+ P1-2（进 WAL 不 Load；手动 Load≈20；`recent 20` 填+Load≈20）+ 列（无 prev、xid 第二、end 可查）+ DEF-1/2 抽查。
2. 勿单独 commit 本报告。
3. Fail 则复审限定新缺陷 diff + 受影响回归。

---

## 先前轮次摘要

| 版本 | 结论 | 要点 |
|---|---|---|
| `47a15df` | Approve | T1–T6 |
| `4188823` | Approve | DEF-1/DEF-2；QA Pass |
| `6ac260b` | Approve | P1-2；QA 轮次 3 Pass |
| `5690895` | Approve | 列布局；QA 轮次 4 Pass |
| `696a8d4` | **Approve**（本轮） | UI 打磨；交 QA 轮次 5 |

不重开已关闭 DEF；P1-2：进 WAL 预填不 Load；`recent 20`=填+Load 快捷。

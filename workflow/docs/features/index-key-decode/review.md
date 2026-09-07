# Review: index-key-decode

## 审阅范围

- 工作项：`index-key-decode`（未拆分，standard 路径，Review 门禁 required）。
- 实现版本：分支 `index-key-decode`，自 `main` a66e2db 分出，10 提交（5af344b → e80590d，Conventional Commits）。
- 变更面：page-core `btree-decode.ts` 新模块 + `fixture-builder.ts` 扩展 + 15 个实捕 `idx-*` fixture；server columns 端点 + L3 冒烟段；web 元数据状态 + 键值区渲染；README 双语；dev-notes。
- 依据：`spec.md`（合同权威）、`design.md`（**含 Manager 修订记录：6 处步进规则以 dev-notes 规则冻结表为准，未以 §3 原文判定**）、`ui-design.md`、`plan.md`、`dev-notes.md`、standards/{documentation,quality,security,git,ui}.md、模板 `_templates/review.md`。
- 审阅方式：全部结论基于本会话独立读码 + 亲跑验证，未复述 Developer 自述。

## 独立验证（本会话亲跑）

| 项 | 结果 |
|---|---|
| `pnpm test` | 388 全绿（wal-core 13 / page-core 158 / server 81 / web 136） |
| `pnpm -r typecheck` | 零错误 |
| `pnpm -r build` | 零错误 |
| `pnpm test:integration` | 退出 0；输出 `index-key-decode segment OK: … 10569 leaf/posting tuples == UTC ::text rows, 16 trailing-TID pivots == boundary rows, DESC bits, expression/jsonb degradation`；既有 B-tree/heap/auto-install 段零回退 |
| PG 源码佐证 | dev-notes 引用的 server 头文件存在且与规则一致（`itup.h`「bitmap 空间不随属性数变化」；`nbtree.h` `BT_OFFSET_MASK=0x0FFF`/`BT_PIVOT_HEAP_TID_ATTR=0x1000`）；float 阈值对 stock 16.11 `~/postgres/src/common/{d2s,f2s}.c` 核对：d2s.c:806 `exp >= -4 && exp < 15`、f2s.c:580 `exp >= -4 && exp < 6`，与实现 `maxPlainExp` 14/5 一致 |

## 步进规则核验（对照 dev-notes 规则冻结表逐条读码）

| # | 规则 | 核验结果 |
|---|---|---|
| 1 | null bitmap 固定 4B，数据起点 MAXALIGN(8+4)=16 | ✅ `INDEX_NULL_BITMAP_BYTES=4`、`INDEX_NULL_DATA_OFFSET=16`（btree-decode.ts:29-33）；bitmap 仅读 [8..12) 4 字节；无 nulls 时起点 8 |
| 2 | bitmap 位反转（置 1=有值） | ✅ `(byte & bit) === 0 → null`（解码处）；builder `writeInvertedBitmap` 同步反转；idx-null/null2 oracle + synthetic 双字节（9 列）用例 |
| 3 | 定长列 attalign 对齐、varlena 不对齐 | ✅ 定长走 `alignTo`，varlena 直读 `offset`；align 值逐类型核对 PG typalign（bool c=1、int2 s=2、int4/float4/date i=4、int8/float8/timestamp/timestamptz d=8、**uuid c=1**，与 pg_type 一致）；idx-align 实捕 + synthetic（text 后 int4 7→8 对齐、int2 后 varlena 原位）锁定 |
| 4 | 小端 | ✅ 所有 DataView 读取 `true`；oracle 双证（int8 367 等） |
| 5 | nkeyatts = posid 直读（无 −1） | ✅ `t_tid.offsetNumber & BT_OFFSET_MASK` |
| 6 | 尾 TID 按 `BT_PIVOT_HEAP_TID_ATTR` 位门控，`keyEnd = range.end − 6` | ✅ 位判定后减 6；posting 用 `keyRange.end`；普通元组 end 含尾 pad 仅容忍不消费 |
| 7 | minus-infinity == posid 0 → 全列 null | ✅ nkeyatts=0 → `attnum > 0` 全部落 null 分支；idx-composite-internal lp0 断言 |
| 8 | 截断尾列（attnum > nkeyatts）统一 null | ✅ 含 INCLUDE 列（idx-composite hikey nkeyatts=1 断言） |
| 9 | varlena 1B/4B 头步进、压缩/external 防御 error | ✅ `readVarlenaAt`（`b&1`/低 2 位 `00`/`10`→error）；>127B 实捕（200×C、100×多） |
| 10 | 时间编码与 UTC 呈现 | ✅ 见「时间与数值格式」节 |
| 11–14 | DESC 原样 / INCLUDE / 表达式 indkey=0 / unsupported 级联 | ✅ 读码 + oracle（idx-desc/idx-composite/idx-expr/idx-jsonb）+ 冒烟降级断言 |

**pivot pad 结论核验**：dev-notes「itemlen = MAXALIGN(MAXALIGN(键区)+6)，尾 TID 恒在 [end−6,end)」三点均属实——① `fixture-builder.ts` 确有修复：`maxalign8(maxalign8(dataIndex+key.length)+6)`、TID 写在 `body.length − 6`；② 回归测试 2 例真实存在且断言 pad 场景：`btree-decode.test.ts:260-289`（断言 itemlen=24、TID 起点 18、datum 末端 11 与 TID 之间 5+2 字节 pad 全零）+ `:278`（解码容忍 pad，range 只报 datum）；③ 实库层面 idx-posting-internal oracle + L3 冒烟 16 个尾 TID pivot == 边界行 SQL 值。

## Spec P0 逐项核验

| ID | 落点（独立确认） | 结果 |
|---|---|---|
| P0-1 | 端点守卫链与 pages 路由逐行镜像（NOT_CONNECTED→requirePageinspect→BAD_OID→NOT_INDEX→INDEX_NOT_BTREE→mapPgError）；响应形状 == 合同（含 indnatts=3/indnkeyatts=2+include 例）；`index-columns.test.ts` 12 例 + L3 app.inject 三守卫 | ✅ |
| P0-2 | idx-composite/align leaf oracle + 冒烟 10569 元组 vs ctid 行 | ✅ |
| P0-3 | idx-text 实捕（空格/多字节/>64/4B 头）+ kd_mix（空串/多字节/70+ 长值）；引号包裹、截断注单测 | ✅ |
| P0-4 | idx-date/timestamp/timestamptz/uuid/bool oracle（UTC 会话 `::text` 归一化：空格→T、`+00`→Z）+ 微秒互异种子 + ±infinity 行 | ✅ |
| P0-5 | idx-null/null2 + synthetic bitmap 1B/双字节；位反转语义 | ✅ |
| P0-6 | idx-composite 按序两列 + range 断言 | ✅ |
| P0-7 | idx-bool posting（keyRange 解码）+ kd_dup `expectPosting` | ✅ |
| P0-8 | hikey=右侧首键（idx-composite 断言 maxA+1 且 b/c null）；internal pivot==子页 hikey（idx-composite-internal 递增断言）；尾 TID 不入键区（range.end−6） | ✅ |
| P0-9 | idx-composite leaf 三列（c 带 include 徽标）+ hikey 中 c null | ✅ |
| P0-10 | `hasExpression` → 索引级冻结文案，无行；页面正常（ensureIndexColumns 不入页面状态链） | ✅ |
| P0-11 | idx-jsonb（a value、j unsupported+其后降级）+ 冒烟纯 jsonb 单列全降级 + web 单列索引级 note | ✅ |
| P0-12 | `ensureIndexColumns`：不 await、不 setError、不入 loadState（App.tsx 读码确认）；失败缓存不粘滞可重试；`deriveKeyColumnsState` 失败 note 含 code；单测覆盖 | ✅ |
| P0-13 | `parseBtreePage`/heap `decode.ts`/`/api/tables/*`/HexDump 零改动（diff 确认）；既有测试文件零改动全绿；键值区为纯增量子区块 | ✅ |

P1 抽验：domain 基类型替换（`typtype='d'`→typbasetype，SQL 契约+路由测试+dev-notes 实库探针；L3 冒烟未种 domain 索引，见发现项 R-3）；`↓`/`nulls first` 徽标（仅 key 列，单测）；行点击→hex 高亮（`tuple-{lp}.col-{attnum}` id 复用 onSelectRange）；pivot 尾 TID `(block,offset)`（BT_PIVOT_HEAP_TID_ATTR 门控 + 单测）；BC 年份局限已如实记录于 dev-notes。

## 时间与数值格式（重点核验）

- **BigInt 微秒路径，不经 Date**：`formatTimestamp` 全 BigInt 手工 civil 换算（Howard Hinnant 算法），负值/跨日借位处理正确；grep 确认模块内无 `new Date`/`toISOString`。小数秒尾零裁剪符合 PG `::text` 口径（µs=1370→`.00137`，synthetic+实捕验证）。
- **timestamptz 固定 `Z`**：Spec 裁决落实；oracle 归一化 `+00`→`Z` 仅在对照层，呈现层输出 `Z` 本体。±infinity 哨兵（INT32/INT64 极值）原样输出。
- **float4/float8**：`formatPgFloat` 阈值 5/14 与 stock PG16 `f2s.c:580`/`d2s.c:806` 一致（本会话核对源码）；边界用例钉住（f4: 1e5→`100000`、1e6→`1e+06`；f8: 1e14→定点、1e15→`1e+15`）；最短往返位生成（f4 用 `Math.fround` 判等）；`-0`/NaN/±Infinity 拼写与 PG 一致；L3 种子含 1e7/1e15/1e16/极值/NaN 永久对照实库 `::text`。
- **numeric**：short（0x8000 标记、7 位权重符号扩展、dscale 6 位）/long（0x4000 负号、int16 权重）判别与 `numeric.h` 常量一致（含 0xC000/0xD000/0xF000 specials）；负权重前导零组、dscale 尾零保留正确；L3 22 形状电池（1e±300、1e63/64、π 64 位、NaN/±Inf）对照实库。

## 测试有效性结论

覆盖关键路径、边界与失败情形，且测试可因错误实现而失败（synthetic 布局字节断言 + 实捕 oracle 逐值对照 + L3 实库 SQL 对照三层正交；TDD 先红记录在 dev-notes）。降级路径（表达式/jsonb 混合/纯 jsonb/越界/压缩 external/varlena 越界/尾 pad）均有失败路径断言。开发者验证达到 Plan 最低验证层 L3（本会话独立复跑通过）。测试弱点仅一处卫生问题（发现项 R-2），不影响有效性。

## 文档影响核对

| Plan 声明 | 实现是否一致 | 备注 |
|---|---|---|
| 开发文档：dev-notes.md（规则冻结+证据）、fixtures/README.md（新 oracle 段+场景表） | 一致 | dev-notes T2–T9 完整；15 场景表与提交产物一一对应；规则冻结表 14 条含与 design §3 的偏差标注 |
| 用户文档：README.md / README.zh-CN.md 各补一句 | 一致 | 双语语义一致（类型集/徽标/高亮/降级），置于 Features 索引节 |
| 运维文档：N/A（本地单人调试工具） | 一致 | 无部署/监控变更 |

链接/路径/命令抽检可验证（fixtures README 命令格式与脚本参数一致；dev-notes 引用的 PG 头文件路径存在）。

## 安全影响核对

| 检查项 | 结果 | 备注 |
|---|---|---|
| 敏感信息 | 无发现 | 新增 SQL 均参数化只读 catalog 查询（`$1`）；capture 脚本 identifier 用 `quoteIdent` 转义；10 提交 diff 无凭据/.env/构建产物（grep 复核）；fixture 数据为合成种子值 |
| 认证与授权 | 不触发 | 无认证面变更；columns 端点与既有 pages 端点同会话门禁 |
| 输入与外部访问 | 无新增攻击面 | oid 走既有 `parseOidParam`（unsigned 32-bit 校验）；无外部网络访问 |
| 依赖变更 | 无 | package.json 零变更 |
| 敏感数据 | 无 | 元数据为 catalog 结构信息 |

## UI/UX 核对

| 检查项 | 结果 | 备注 |
|---|---|---|
| 对照 Spec 界面验收 | 通过（代码与单测层面） | 键值区置于 Key bytes hex 之上（ui-design 权威位置）；每列一行 `{attnum} {name} ({typname}) = {display}`；NULL/include/↓/nulls first；metapage 无键值区；hex 块及联动零改动 |
| 对照 `workflow/docs/standards/ui.md` | 通过 | 状态完整（loading/空/成功/错误/部分失败按 ui-design 状态表）；降级文案含原因+code；P1 值行为 `<button>`（Tab/Enter/Space、`:focus-visible` 高对比 outline）；复用既有 CSS 变量不新造色板 |
| 对照 `ui-design.md` | 通过 | 冻结文案逐字核对（Key values/loading column metadata…/expression index —…/column metadata unavailable ({code}) —…/{n} chars total (showing first 64)/unsupported type:/decode error:）；行级降级后省略+laterNote；纯 jsonb 单列索引级 note；max-height≈8 行滚动、word-break |
| 主题/深色（Spec 未要求） | N/A（策略合规） | 单主题策略，复用 light/dark 既有变量；两套主题可读性属手测项 |

**视觉/交互项标注：待 QA 手测**。dev-notes 手测清单 9 项全部如实标注未勾选（浏览器项），未被当作已证证据——符合 Plan「手测证据入 dev-notes」的诚实口径，最终验收归 QA。

## 发现项

无阻塞项。以下均为非阻塞建议/记录：

| ID | 严重度 | 位置 | 问题 | 状态 |
|---|---|---|---|---|
| R-1 | Minor | `packages/page-core/src/btree-decode.ts:152`（`decodeUtf8WithEscapes`） | `new TextDecoder("utf-8",{fatal:true})` 默认剥离开头 U+FEFF（本会话实验证实：`EF BB BF 61` 解码为 `"a"`）。text 值以 BOM 字符开头时展示层丢失该字符（hex 仍为权威）；oracle 未含该种子故未暴露。建议加 `ignoreBOM: true` | 待 Developer 决定（可并入后续小修或 QA 批次） |
| R-2 | Minor | `packages/page-core/tests/btree-decode.test.ts:199-202` | 死代码：构造了带不存在字段 `nullAttnums` 的元组后 `void page` 弃用（真正断言用下方 `presentAttnums` 版本）。测试目录不在 tsc 范围（既有仓库约定）故未报错；建议删除 4 行 | 待 Developer 决定 |
| R-3 | Minor | `apps/server/src/integration-smoke.ts:307`（段注释） | 注释声称覆盖 "domain columns"，但该段未种 domain 索引；domain 替换实际由 L2 SQL 契约/路由测试 + dev-notes T7 实库探针覆盖，L3 无永久对照。建议改注释或补一个 domain 种子（一行 CREATE DOMAIN + 索引） | 待 Developer 决定 |
| R-4 | 记录 | fixtures 场景表 | design 风险 R5 缓解提到「oracle 种子含 char(n)」，实捕场景无 bpchar（bpchar 仅 synthetic 单测覆盖：三种 text 族同字节路径）。Plan T2 完成条件的场景清单本就不含 char(n)，非合同缺口；记录以免误解为已捕 | 记录在案 |
| R-5 | 记录 | `apps/web/src/indexKeyDetail.ts`（截断） | 64 字符截断按 JS `length`（UTF-16 单元）计数，增补平面字符（代理对）计 2；对 BMP（含中日韩）无影响。展示层口径微差，非合同违约 | 记录在案 |
| R-6 | 记录 | `apps/server/src/catalog.ts`（INDEX_COLUMNS_SQL） | 链式 domain（domain over domain）只替换一层基类型，typoid 仍为 domain → 优雅降级为 unsupported（符合降级合同，非错误路径） | 记录在案 |

## 结论

**Approve**

无阻塞项：Spec P0-1..P0-13 逐项有实现、测试与 oracle 证据落点；步进规则与 pivot pad 以 dev-notes 冻结表为准核实（三层证据一致）；降级合同路径与测试双重确认；L2/L3/typecheck/build 由本会话独立复跑通过；文档、安全、Git 检查均无发现。发现项全部为 Minor/记录级，不构成 QA 前置修复条件。

## 必修项

| ID | 位置 | 问题 | 状态 |
|---|---|---|---|
| — | — | 无（发现项均为非阻塞，见下表） | — |

> `Comment` 不得包含阻塞项；阻塞问题须使用 `Request changes`。

## 后续动作与复审范围

1. Manager 可将工作项推进至 QA（Review 门禁满足）。
2. QA 按手测清单执行浏览器手测（9 项，dev-notes 待回填）+ 独立复跑 L3；视觉项验收以 ui-design 为准。
3. R-1/R-2/R-3 若由 Developer 处理：属局部小修（解码器一行参数/测试 4 行/注释或一行种子），修复后仅需对 touched 文件做定向复审，无需全量重审。
4. 本报告不执行任何 git 提交（git.md §1.4：QA Pass 待授权期间不提交）。

# QA Report: index-key-decode

## 轮次

| 轮次 | 日期 | 范围 | 结论 |
|---|---|---|---|
| 1 | 2026-09-01 | 首测（standard；Review Approve：0 阻塞 + 3 Minor） | Pass（见结论节限定） |

## 环境与命令

- 实现版本：分支 `index-key-decode` @ `e80590d`（自 main `a66e2db`，10 提交）；QA 未改动任何业务代码/文档。
- 环境：本地 PostgreSQL 16.11 x86_64（socket /tmp:5432）；真实 server 经根 `.env` PG* 自动连接（postgres@postgres，TCP 127.0.0.1:5432；凭据未打印）并起于 127.0.0.1:8791；Node 24.19 / pnpm 9.15。验后 server 已停、探针 schema 清零。
- 独立探针：前次中断会话遗留 `qa_ixkd`（jason 库，`t_p1` 空表等不完整）已 DROP；QA 于 postgres 库重建 `qa_ixkd`（16 表 + dup 表共 24+1 索引：int2/4/8 极值、bool 重复、text 含空串/空格/多字节/emoji/200 字符 4B varlena/70 字符/中置与前置 BOM、date 含 ±infinity 与 BC 行、timestamp µs 边界 8 例、timestamptz 含 +08/+05:30 偏移输入、uuid 大小写、int8+text+int2 混排 300 行、INCLUDE、DESC/NULLS LAST、2 列与 9 列 NULL、表达式、(int,jsonb) 与纯 jsonb、hash、P1 五型、domain 与链式 domain、3 值×20000 行 dup 触发 posting 分裂）。对照脚本（仓库根临时文件，验后已删）经真实 HTTP 取 columns/pages，`decodeIndexTupleKeys`（page-core 源）解码，逐元组对照 UTC 会话 `::text`。
- 结果：**4328 检查通过 / 1 失败（QA-D1，见缺陷表）/ 1 观察项（BC 局限，与 dev-notes 记录一致）**；2457 leaf/posting 元组、4 页 hikey、23 pivot（含 minus-infinity 与截断尾列）、16 个尾 TID pivot == 边界行 SQL 值。

### L2/L3 复跑（本会话亲跑）

| 命令 | 结果 |
|---|---|
| `pnpm test` | 388 全绿（wal-core 13 / page-core 158 / server 81 / web 136） |
| `pnpm -r typecheck` | 零错误 |
| `pnpm -r build` | 零错误 |
| `pnpm test:integration` | 退出 0；`index-key-decode segment OK: … 10569 leaf/posting tuples == UTC ::text rows, 16 trailing-TID pivots == boundary rows, DESC bits, expression/jsonb degradation`；既有 B-tree/heap/auto-install 段零回退 |

## 覆盖（对照 plan 最低验证层 L3 + spec 验收）

### P0（全部实库 + 真实 server 独立取证，除注明代码级）

| ID | 条目 | 结果 | 证据 |
|---|---|---|---|
| P0-1 | columns 端点形状与守卫链 | ✅ | 实 HTTP：`abc`/`-1`/`2^32`→400 BAD_OID；表 oid→404 NOT_INDEX；hash→400 INDEX_NOT_BTREE。形状：顶层与列字段键集与 Spec 合同逐字段一致（t_inc indnatts=3/indnkeyatts=2、kind key/include、typoid/typmod）；t_desc 位解 `a`=DESC+nullsFirst、`c`=DESC+nullsLast。NOT_CONNECTED/PAGEINSPECT_MISSING 为 L2 路由测试 + 代码（app.ts 守卫序镜像 pages 路由） |
| P0-2 | 整数解码 | ✅ | 探针 int2/int4/int8 全 leaf 元组 == ctid 行 SQL（含 ±32767/±2^31/±(2^63−1) 极值）；hex 区零改动（HexDump.tsx 零 diff） |
| P0-3 | text 族解码 | ✅（BOM 前置例外→QA-D1） | 空串/空格/中文/emoji/200 字符（4B varlena）/70 字符全对照一致；中置 U+FEFF 正常；前置 BOM 丢失首字符→QA-D1（R-1 实锤） |
| P0-4 | date/timestamp/timestamptz/uuid/bool | ✅ | 全元组 == UTC 会话 `::text`；µs 边界 ≥6 例（.00137 尾零/.123456/.000001/.1/无小数/秒进位×2/负 µs）；tstz 固定 `Z`（+08/+05:30 输入照 Z 呈现）；±infinity 原样；uuid 大小写折叠小写连字符；bool true/false |
| P0-5 | NULL | ✅ | t_null 四组合（含双 NULL）+ t_null9 九列（双字节 bitmap 路径）逐元组一致 |
| P0-6 | 多列 | ✅ | t_mix (int8,text,int2) 300 行混排对齐步进逐元组三列对照 |
| P0-7 | posting | ✅ | t_bool（80 行）与 t_dup（20000 行）posting 元组键 == postingTids 首行 SQL 值（sawPosting 断言） |
| P0-8 | hikey / internal pivot | ✅ | 4 页 hikey == 右兄弟页首个数据元组（按 nkeyatts 前缀）；23 pivot：最左 downlink = minus-infinity 全 NULL、其余 == 左兄弟叶 hikey；16 尾 TID pivot 键 == 尾 TID ctid 行 SQL 值；唯一索引 pivot 零 TID 标志（规则 6） |
| P0-9 | INCLUDE | ✅ | t_inc leaf 三列对照一致；hikey/pivot 截断尾列统一 NULL（trunc 断言） |
| P0-10 | 表达式索引降级 | ✅ | 实端点 hasExpression=true；web 索引级冻结文案/无行/页面正常 = 代码 + 单测（indexKeyDetail.test.ts） |
| P0-11 | 不支持类型降级 | ✅ | 实解码：(a value, j `unsupported type: jsonb` 且其后省略)；纯 jsonb 单列整体 unsupported；链式 domain 同路径优雅降级（呼应 R-6） |
| P0-12 | 元数据失败降级 | ✅（代码级+测试） | App.tsx:296-315 `ensureIndexColumns` fire-and-forget（不 await/不 setError/不入 loadState），失败仅缓存错误态可重试；`column metadata unavailable ({code})` 冻结文案含 code；单测 21 例覆盖缓存/降级时序 |
| P0-13 | 回归 | ✅ | HexDump/btree.ts/decode.ts/parse.ts/`/api/tables` 路由零 diff（`git diff main...HEAD`）；既有测试文件零改动（btree.test.ts 45 例）且 388 全绿；L3 既有段零回退 |

### P1

| 条目 | 结果 | 证据 |
|---|---|---|
| numeric/float4/float8/bytea | ✅ | 实库探针 15 形状/型（NaN/±Infinity/−0/次正规数/1e63 与 1e64 边界/π 64 位/1e±300/dscale 尾零/200B bytea 4B varlena）== UTC `::text` |
| domain 基类型 | ✅ | 实端点 pos_int→int4（typoid 23）且解码一致；链式 domain 单层替换→unsupported 优雅（R-6 行为） |
| ↓ / nulls first 徽标 | ✅（代码级） | indexKeyDetail.ts:156-157 + 单测（视觉呈现未核验，见 UI 节） |
| 键值行点击→hex 高亮 | ✅（代码级） | `<button>`（Tab/Enter/Space）+ `keyRowId` `tuple-{lp}.col-{attnum}` 约定 + 单测；交互视觉未核验 |
| pivot 尾 TID `(block,offset)` | ✅（代码级） | `pivotHeapTidText` 读 [end−6,end) + 单测 |
| README 双语 | ✅ | 双语 Features 索引节各一句，语义一致（类型集/徽标/高亮/降级） |

### Review 发现项处置核对（3 Minor + 3 记录）

| ID | QA 独立核对结果 | 状态 |
|---|---|---|
| R-1（BOM 剥离） | **实锤**：探针 BOM 前置 text 行 decoded `'leading bom'` vs SQL `'\uFEFFleading bom'`（中置 BOM 正常） | 开放，登记为 QA-D1，延续 Review「待 Developer 决定」处置 |
| R-2（测试死代码） | 确认仍在：btree-decode.test.ts:199-202（构造后 `void page` 弃用） | 开放，登记为 QA-D2 |
| R-3（L3 注释虚报 domain） | 确认：integration-smoke.ts 段注释称覆盖 domain 但无 CREATE DOMAIN 种子；domain 行为已由本 QA 实库探针补证 | 开放，登记为 QA-D3（注释或补种子二选一） |
| R-4/R-5/R-6 | 记录级，无行为缺口；R-6 行为经探针实证优雅降级 | 记录在案，无需处置 |

### 其他核对

- BC 年份局限：探针 `'0001-01-01 BC'` 解码 `0000-01-01` vs SQL `0001-01-01 BC`——与 dev-notes「未解决风险」预记录**一致**（超 P0 范围、plan T7 不含，按裁决记录局限，非缺陷）。
- 步进规则冻结表（dev-notes 14 条）：经探针间接全验（NULL bitmap 4B/位反转/定长对齐/varlena 步进/nkeyatts 直读/尾 TID 标志位/minus-inf/截断/unsupported 级联均有实库元组命中）。
- 安全：新增 SQL 均参数化只读 catalog（代码核对）；无凭据打印（.env 仅 source 未回显）；探针仅本库自建对象。
- 遗留清理：前次中断 `qa_ixkd`（不完整）已 DROP 重建；验后 `qa_*`=0（postgres/jason 双库复核）；另清除前期（index-viewer 时代）遗留 `pageview_ikd` debris；`pageview_fx`（jason 库）为先于本项的遗留、非 qa_* 且非本会话产物，超出本项清理范围，仅记录。server 已杀、探针脚本已删、工作区无 QA 侧代码残留。

## UI/UX

| 检查项 | 结果 | 证据 |
|---|---|---|
| Spec 界面相关验收 | 逻辑层通过；**视觉项未核验** | 行模型/文案/徽标/截断注/降级标注/键值区位置（Key bytes 之上）/metapage 无键值区 = 代码 + 单测；实际渲染无浏览器 |
| `workflow/docs/standards/ui.md` 底线 | 逻辑层通过 | 状态完整（loading/空/成功/错误/部分失败按 ui-design 状态表）；P1 行 `<button>` 可聚焦；复用既有 token；焦点轮廓视觉效果未核验 |
| `ui-design.md` 状态与流程 | 逻辑层通过 | 冻结文案逐字（Key values / loading column metadata… / expression index —… / column metadata unavailable ({code}) —… / {n} chars total (showing first 64) 等）代码核对 + 单测 |
| dev-notes 手测清单 9 项 | **未核验-无浏览器**（环境无 chromium/firefox/playwright） | 风险：纯视觉/交互项（两主题可读、焦点轮廓、实际高亮联动等）未获直接证据；恢复条件：具备浏览器后按 dev-notes 清单补测（逻辑层已有单测兜底，预期风险低） |

## 缺陷

| ID | 严重度 | 摘要 | 状态 |
|---|---|---|---|
| QA-D1（=R-1） | Minor | BOM 前置 text 键值展示层丢失首字符 U+FEFF（`TextDecoder` 默认剥离；hex 权威不受影响；P0-3 种子集外边缘输入） | 开放-延后（Review 已裁定非阻塞；建议 `ignoreBOM:true` 一行修复，并入后续小修批次 + 定向复审） |
| QA-D2（=R-2） | Minor | btree-decode.test.ts:199-202 死代码（构造元组后弃用） | 开放-延后（删除 4 行，随 QA-D1 批次） |
| QA-D3（=R-3） | Minor | L3 冒烟段注释声称覆盖 domain 但未种 domain 索引（domain 已由 QA 实库探针补证） | 开放-延后（改注释或补一行种子，随 QA-D1 批次） |

## 结论

- 总体: **Pass**
- 判定依据：Spec P0-1..P0-13 与 P1 全部适用验收项通过——L2/L3 本会话独立复跑全绿；键值解码以自建多类型探针在真实 server + 实库逐元组对照 UTC `::text` oracle（2457 leaf/posting + 4 hikey + 23 pivot + 16 尾 TID pivot + 守卫链 + 形状/位解 + 降级合同），证据独立于 Developer/Reviewer 自述。QA-D1..D3 均为 Review 已裁定非阻塞的 Minor（展示层边缘输入/测试卫生/注释准确性），不影响任何 P0/P1 合同成立；UI 视觉 9 项因无浏览器未核验，已如实记录风险与恢复条件（qa.md §7 精神：未静默跳过）。
- 恢复条件: N/A（Pass）
- 合并: 待用户授权。合并就绪条件：① 用户明确授权合并（git.md 全部前置已满足：QA Pass、Review Approve 与 Plan 确认已持久化、源/目标分支明确）；② 建议（非阻塞）：合并前后具备浏览器时按 dev-notes 9 项清单补测 UI 视觉项；③ 建议（非阻塞）：QA-D1/D2/D3 于后续小修批次处理并定向复审。

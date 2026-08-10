# Spec: wal-viewer

> 需求与规格（Plan 之前完成）。任务拆解见后续同目录 `plan.md`。
>
> **feature-id**：`wal-viewer` · **sub-feature-id**：`wal-viewer`（未拆分）
>
> **确认门禁**：路径等级 `full`。整份 Spec 已于 2026-07-30 批准；同日「Fill → recent ~20 window」经用户「ok」确认。产品共识 7 条及既有裁决（必填 start/end、不盲拉、批次硬错误、按模式扩展校验）仍为合同，**不得标为开放问题**。

## 背景与目标

在现有 pg-page-viewer 上新增 **WAL 模式**：顶部 chrome 切换 **Page / WAL**；两模式 UI 与数据路径分开。

面向开发者与学习者，经 `pg_walinspect`（PG15+）浏览本机 WAL **结构化** record：主视图为一批宽元数据列表（一行一条），非 page 的 32B/行结构图↔hex。

成功标准：可切换至 WAL；在已启用 `pg_walinspect` 的 PG15+ 上加载一批 record、选中单条；含 FPI 默认折叠且展开不渲染 8KB 内容；v1 不以原始字节 hex 呈现 WAL。Page 既有行为（含 `get_raw_page` hex）保持可用。

## 非目标

- WAL v1 **原始字节 hex**（含反向拼装 / 由结构化字段伪造字节流）
- 应用代执行 `CREATE EXTENSION`（`pg_walinspect` 或 `pageinspect`）
- WAL 列表硬套 page **32B/行 grid**
- PG17+ `pg_get_wal_block_info` 及依赖更高版本的 WAL 原始块/FPI 字节渲染
- 独立无关仓库或另起一套部署形态
- 公网托管、多租户、生产级远程连接安全加固
- 本工作项新增 light/dark 主题条款（沿用既有 Page GUI 主题）
- 重写/替换既有 Page 主路径（本项为增量模式）

## 范围与可见行为

### 定位与复用

- 同一 monorepo；允许复用 `apps/server` / `apps/web`。
- WAL 解析/映射可新建专用包（如 `packages/wal-core`）或等价方案；**包边界与命名留给 Design/Plan**。验收要求：WAL 与 Page 数据路径可分离；WAL UI **不得**依赖 page 32B grid 布局合同。

### 模式切换（chrome）

- 顶部 chrome：**Page / WAL** 切换；主工作区展示对应模式 UI。
- **禁止**把 WAL 列表塞进 page 结构图/hex 主布局作为唯一呈现。
- Page 与 WAL **数据请求路径分开**；可共享连接会话，**禁止**用 page 页字节 API 冒充 WAL 数据源。

### 连接与依赖

- WAL 最低：**PostgreSQL 15+** + 已启用 **`pg_walinspect`**；角色须具备扩展函数权限（文档说明特权要求；细则对齐官方，可由 Design 定）。
- **禁止**应用代建扩展；仅提示用户自行 `CREATE EXTENSION pg_walinspect`。
- Page 仍依赖既有 `pageinspect` + `get_raw_page`；不得因本项降级。
- 主版本 < 15：使用 WAL 能力须明确失败；**禁止**静默空列表冒充成功。

### WAL 主视图：record 列表

- 一批 record：**一行一条**。
- 宽元数据行，至少可辨识：start LSN（及数据源提供的 end LSN；prev LSN 由 API 透出即可，**列表行不展示**）、resource manager、record type、record 长度（及可得的 main_data/fpi 长度）、以及 xid（**列表第二列**）/ description / block_ref 等有用摘要（可截断）。字段布局由 `ui-design.md` 定；上述核心列不得缺省到不可辨识。
- **禁止**硬套 page 32B/行 grid。

### 选中与 hex 占位

- 点击一条 record 可**选中**（选中态可见）。
- v1 hex dump **不可用**：占位或说明即可；**禁止**伪造/拼装 WAL 原始字节 hex。
- 数据来自 **`pg_walinspect` 结构化信息**，非应用自解 WAL 文件再拼 hex。

### FPI

- 含 FPI（典型 `fpi_length > 0` 或等价）：
  - **默认折叠**：只显示长度/标记等摘要；**禁止**默认展开未压缩 8KB/整页内容撑爆列表。
  - 展开**仅**元信息（长度、标记、block 引用摘要等）；**禁止**渲染完整 8KB/整页内容。

### Hex 边界（Page vs WAL）

- Page：仍 `get_raw_page` 原始字节 + 既有 hex 联动。
- WAL v1：无原始字节 hex；PG17+ 增强**不在本工作项范围**。

### 查询输入与 Fill 辅助

- 用户须能指定区间：至少 **start LSN** 与 **end LSN**（或 Design 认可的等价起终点控件）；二者**必填**方可 Load。
- **进入 WAL 模式不自动盲拉**；不因切模式自动 Load。
- **Fill**（「填入最近窗口」或等价；**废止**「填入当前 LSN」= 起终点同 tip）（**已确认 2026-07-30**）：
  - **end** = `pg_current_wal_lsn()`（tip）。
  - **start** = 基于 tip 向前推算，约含 **最近 ~20 条** record；不足则有多少给多少。
  - **仅填控件，不自动 Load**；随后 Load 须看到最新约 20 条（或更少），**禁止** tip 点查 Empty batch 冒充成功。
- 加载中 / 空 / 错误须明确呈现（`workflow/docs/standards/ui.md` GUI 底线）。

### 文档影响（需求级）

- README（含中文）须说明：WAL 模式、PG15+、`pg_walinspect`、自行 `CREATE EXTENSION`、WAL v1 无原始 hex。

## 合同

### API / 接口

后端须提供 WAL 结构化查询（路径名为建议；实现可等价命名，语义与数据义务不变）：

| 能力 | 建议接口 | 行为 |
|---|---|---|
| WAL 记录批次 | 如 `GET /api/wal/records`（`startLsn`、`endLsn`） | 基于 `pg_walinspect`（典型 `pg_get_wal_records_info`）返回区间内每条 record 一行结构化字段；**禁止**以 `get_raw_page` 冒充 |
| 最近窗口辅助 | 如 `GET /api/wal/recent-window?limit=20`，或扩展 current-lsn 返回 `{ startLsn, endLsn, count }` | 见下方 **recent-window 行为合同**；路径形状留给 Design |
| （可选）单条 | 如 `GET /api/wal/records/:lsn` | `pg_get_wal_record_info` 或等价；v1 可仅批次接口，但选中所需字段须已在批次载荷中足够 |

**recent-window 行为合同**（`limit` 默认 20；与 Fill 对齐）：

1. **endLsn** = `pg_current_wal_lsn()`（tip）。
2. **startLsn** 由服务端基于 tip **启发式扩窗**向前推算，使结果大约含最近 `limit` 条 record；不足则有多少给多少。
3. 若扩窗后结果 **> limit**：取**尾部** `limit` 条，并将返回的 **startLsn 回填**为该批最早一条 record 的 `start_lsn`。
4. 遵守既有批次硬阈值 **R1≤2000 / R2≤2MiB / R3≤16MiB**；**禁止**截断或部分结果假成功。
5. 已删/不可读 WAL segment 等：返回**可读错误**（原因 + 可执行下一步）；**禁止**静默空成功。

**每条 record 交付义务**：

| 字段（语义） | 要求 |
|---|---|
| start_lsn | 必须 |
| end_lsn / prev_lsn | 数据源提供则必须透出 |
| xid | 数据源提供则必须透出 |
| resource_manager | 必须 |
| record_type | 必须 |
| record_length | 必须 |
| main_data_length | 数据源提供则必须透出 |
| fpi_length | 必须（FPI 折叠判定；无 FPI 时为 0 或等价） |
| description / block_ref | 数据源提供则必须透出（UI 可截断） |

**禁止**：以 WAL 原始字节数组/hex 作为 v1 主载荷义务；应用执行 `CREATE EXTENSION`。

Page 既有接口（connect / tables / `get_raw_page` 等）成功路径语义不变。会话可共享；WAL 检查可在 WAL 请求时强制。

### 数据 / 状态

| 状态 | 含义 |
|---|---|
| `mode = page` \| `mode = wal` | UI 当前模式；chrome 可切换 |
| `wal_idle` | 已入 WAL 模式，尚未成功加载批次 |
| `wal_loading` | 正在请求 WAL 批次 |
| `wal_loaded` | 当前批次已加载可浏览 |
| `wal_record_selected` | 已选中一条（可与 `wal_loaded` 并存） |
| `wal_error` | 最近一次 WAL 失败且错误可见 |

- 数据源：`pg_walinspect` 结构化行；v1 主路径不得依赖自拼原始字节。
- 选中：至多一条；换批次后选中须重置或指向仍存在的 record（Design 定，须可预期）。
- FPI：默认 `collapsed`；可 `expanded` 仅看元信息。
- 主题：沿用既有应用；**不新增**主题合同。

### 错误与约束

| 条件 | 要求 |
|---|---|
| 未连接 | WAL 请求明确错误；不可浏览批次 |
| PG 主版本 < 15 | 明确不支持 WAL；**禁止**进入列表成功态 |
| 缺少/不可用 `pg_walinspect` | 明确提示与自行启用指引；**禁止** `CREATE EXTENSION`；**禁止**伪造成功列表 |
| 权限不足 | 明确权限错误 + 可执行下一步 |
| LSN 无效/区间不可用/已删段/服务端报错 | 原因 + 至少一条可执行下一步；**禁止**仅裸异常/堆栈 |
| 空区间 | 明确空态，不崩溃 |
| 批次过大（触 R1/R2/R3） | **硬错误**；**禁止**截断或部分结果假成功 |
| Page 取页 | 仍 `get_raw_page`；与 WAL 错误域分离 |

安全：与既有一致——密码不落盘、不在 UI 展示；不面向公网。

## 验收（Given-When-Then）

### P0

- **P0-1 模式切换**  
  Given 应用已启动，When 用户在 chrome 选择 WAL（再选回 Page），Then 主工作区切换为对应模式 UI，且两模式入口均可达。

- **P0-2 路径分离**  
  Given 用户处于 WAL 模式并成功加载一批 record，When 检查该批次数据来源，Then 来自 `pg_walinspect` 结构化查询（非 `get_raw_page`、非内置假 WAL）。Given 用户处于 Page 模式并加载某页，When 取页，Then 仍经由 `get_raw_page` 原始字节路径。

- **P0-3 一行一条 + 宽元数据**  
  Given 某 LSN 区间内至少 2 条 WAL record，When 加载该批次，Then 列表一行一条，每行可辨识 LSN、resource manager、record type、长度等元数据，且**未**使用 page 32B/行 grid 作为行布局。

- **P0-4 选中 record**  
  Given 已加载至少一条 record，When 用户点击其中一条，Then 该行进入可见选中态。

- **P0-5 WAL hex 不可用**  
  Given 已选中一条 record，When 查看 hex/字节详情区（或等价位置），Then 仅见占位或「v1 不可用」说明；**禁止** WAL 原始字节 hex dump。

- **P0-6 扩展与代建禁止**  
  Given 目标库未启用 `pg_walinspect`（或角色不可用），When 用户尝试加载 WAL 批次，Then 明确错误/启用指引且不进入列表成功态；全过程无应用发起的 `CREATE EXTENSION`。

- **P0-7 PG15+ 下限**  
  Given 服务端 PostgreSQL 主版本 < 15，When 用户尝试使用 WAL 能力，Then 明确不支持，且不进入 WAL 列表成功态。

- **P0-8 FPI 默认折叠**  
  Given 批次中存在 `fpi_length > 0`（或等价）的 record，When 列表首次渲染，Then 该行 FPI 为折叠摘要（可见长度/标记），且未渲染完整 8KB/整页内容。

- **P0-9 FPI 展开仅元信息**  
  Given 含 FPI 的 record 行，When 用户展开 FPI，Then 仅增加元信息；**禁止**渲染完整 8KB/整页 FPI 或页内容。

- **P0-10 Page hex 不受损**  
  Given 用户在 Page 模式成功加载一页，When 使用既有 hex 视图，Then 仍基于 `get_raw_page` 原始字节可用。

- **P0-11 错误可读**  
  Given WAL 请求因扩展缺失、权限不足、LSN 区间无效或已删段而失败，When 错误呈现，Then 含原因与至少一条可执行下一步；**禁止**仅裸异常码/堆栈。

- **P0-12 monorepo 增量**  
  Given 本工作项交付物，When 审查仓库形态，Then WAL 能力位于同一 monorepo，并复用（或扩展）既有 `apps/server` 与 `apps/web` 运行路径，而非独立无关应用仓库。

### P1

- **P1-1 空批次**  
  Given 合法 LSN 区间内无有效 record，When 加载，Then 明确空态，界面可用且不崩溃。

- **P1-2 Fill 最近 ~20 窗口**（**已确认 2026-07-30**）  
  Given 已连接且 WAL 可用、库中有可读 WAL record，When 用户触发 Fill，Then：**end** = tip（`pg_current_wal_lsn()`）；**start** = 服务端最近窗口起点（约 20 条，不足则更少）；**不**自动 Load。When 用户再点 Load，Then 列表为该窗口最新约 20 条（或更少），**禁止** tip 点查 Empty batch。若 recent-window 因已删段等失败，Then 可读错误，且不得把起终点写成成功窗口。

- **P1-3 模式切换保留连接**  
  Given 已连接成功，When 在 Page 与 WAL 间多次切换，Then 无需重新提交密码即可继续使用两模式（会话仍有效）；仅缺某一扩展时，失败限于对应模式请求，不因此强制断开整会话。

## 开放问题

> **已确认（2026-07-30）**：下列裁决已由当前用户会话批准；合同与验收按此执行。无待确认开放项。

1. **默认 LSN 区间如何预填？** — **已确认（含 2026-07-30 产品变更）**  
   必填 start/end；进入 WAL 不盲拉。Fill = **recent ~20 window**（见「查询输入与 Fill 辅助」）。**废止**起/终点同填 tip。

2. **单次批次大小上限？** — **已确认：硬错误**  
   以用户 `[startLsn, endLsn]` 为准；过大则硬错误，**禁止**截断/部分结果。阈值 **R1≤2000 / R2≤2MiB / R3≤16MiB**（含 recent-window）。

3. **connect 是否同时校验 `pageinspect` 与 `pg_walinspect`？** — **已确认**  
   **不**强制两者皆有；Page → `pageinspect`，WAL → `pg_walinspect` + PG15+。

---

**交接提示（Manager）**：Spec 已与「Fill → recent ~20 window」用户 ok 对齐；无待确认开放项。建议下一状态 **`designing`**：调度 `planner` 轻改 design / ui-design / plan。

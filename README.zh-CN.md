# pg-page-viewer

[English](./README.md) | 中文

在浏览器中浏览 PostgreSQL heap page 与 WAL 记录。本地连接数据库，通过 [`pageinspect`](https://www.postgresql.org/docs/current/pageinspect.html) 拉取原始页面，或通过 [`pg_walinspect`](https://www.postgresql.org/docs/current/pgwalinspect.html)（PostgreSQL 15+）浏览结构化 WAL record。

面向学习或调试的开发者 — **不适合**公开部署到公网。

![界面示意：结构图、十六进制转储与元组详情](./docs/assets/ui-overview.png)

## 功能

### Page 模式

- **结构图** — 每行 32 字节：页头、ItemId 数组、空闲空间、元组
- **十六进制转储** — 同样按 32 字节分行，联动选中与滚动定位
- **元组解码** — 列值、`t_infomask` / `t_infomask2` 位条、HOT/ctid 提示
- **差异高亮** — Refresh 时按字节标出变更

### WAL 模式

- 顶部 **Page | WAL** 切换；独立列表 UI（一行一条宽元数据）
- 必填 start/end LSN；可一键「填入最近窗口」（约最近 20 条；**不会**自动 Load）
- 含 FPI 的记录默认折叠（仅长度/元信息；不渲染原始 8KB 页）
- **v1 不提供 WAL 原始字节 hex** — 仅 `pg_walinspect` 结构化字段
- 批次硬上限（超限失败，禁止截断）：≤2000 条、≤2 MiB JSON、≤16 MiB LSN 跨度

### 共用

- **浅色 / 深色** 主题

## 环境要求

- Node.js 20+、pnpm 9+
- **Page 模式：** 已启用 `pageinspect`；具备 `get_raw_page` 权限的角色（通常为超级用户）
- **WAL 模式：** PostgreSQL **15+** 且已启用 `pg_walinspect`；具备 `pg_get_wal_records_info` / `pg_current_wal_lsn` 权限的角色（通常为超级用户）

```sql
CREATE EXTENSION pageinspect;      -- Page 模式
CREATE EXTENSION pg_walinspect;    -- WAL 模式（PG15+）
```

应用**不会**替你执行 `CREATE EXTENSION`。连接成功不强制两扩展皆有；各模式在请求时校验并给出明确错误。

## 快速开始

```bash
pnpm install
cp .env.example .env   # 可选：服务启动时自动连接
pnpm dev:server        # http://127.0.0.1:8787
pnpm dev:web           # http://127.0.0.1:5173
```

打开 Web UI，连接数据库（或依赖 `.env`），然后使用 **Page**（表 + 块号 + Load）或 **WAL**（start/end LSN + Load）。

## 环境变量

在 `.env` 中配置凭证（切勿提交密钥）：

- `DATABASE_URL`，或 `PGHOST` / `PGPORT` / `PGDATABASE` / `PGUSER` / `PGPASSWORD`
- `HOST`（默认 `127.0.0.1`）、`PORT`（默认 `8787`）

密码只保留在服务端进程内存中 — 不会写入仓库，也不会存入浏览器存储。

## 仓库结构

| 路径 | 说明 |
|---|---|
| `packages/page-core` | 页面解析、元组解码、结构字段推导 |
| `packages/wal-core` | WAL 记录类型、映射、批次阈值校验 |
| `apps/server` | Fastify API 代理（连向 PostgreSQL） |
| `apps/web` | React 界面 |

## 开发

```bash
pnpm --filter page-core test
pnpm --filter wal-core test
pnpm --filter server test
pnpm --filter web test
pnpm -r typecheck
pnpm -r build
pnpm test:integration   # 需要 .env + 一张有数据页的表；Page 路径
```

Fixture 采集：见 `packages/page-core/fixtures/README.md`。

## 范围

- Page 模式仅用户 heap 表（`relkind = r`）
- 标准 8 KB 页面
- 显示 TOAST 指针；不拉取外部 toast 页
- 不含索引、FSM/VM 或系统目录
- WAL v1：仅结构化记录；无原始 WAL hex；不含 PG17+ block-info API

## 故障排查

| 错误 | 处理 |
|---|---|
| `PAGEINSPECT_MISSING` | 以超级用户执行 `CREATE EXTENSION pageinspect;` 后重试 Page |
| `WALINSPECT_MISSING` | 以超级用户执行 `CREATE EXTENSION pg_walinspect;` 后重试 WAL |
| `PG_VERSION_UNSUPPORTED` | WAL 模式需 PostgreSQL 15+ |
| `WAL_BATCH_TOO_LARGE` | 缩小 LSN 区间（≤2000 条 / ≤2 MiB JSON / ≤16 MiB 跨度） |
| Connection refused | 检查 host/port/凭证；确认 Postgres 在本机监听 |
| `BLKNO_OUT_OF_RANGE` | 使用 `blkno` 在 `0 .. relpages-1` 范围内 |
| `get_raw_page` / walinspect 权限不足 | 使用具备权限的角色 |

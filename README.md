# pg-page-viewer

English | [中文](./README.zh-CN.md)

Browse PostgreSQL heap pages in the browser. Connect locally, fetch raw blocks via [`pageinspect`](https://www.postgresql.org/docs/current/pageinspect.html), and inspect structure + hex side by side.

Built for developers learning or debugging heap layout — **not** intended for public deployment.

![UI overview: structure diagram, hex dump, and tuple detail](./docs/assets/ui-overview.png)

## Features

- **Structure diagram** — 32 bytes/row: page header, ItemId array, free space, tuples
- **Hex dump** — same 32B/row layout, linked selection and scroll-to-offset
- **Tuple decode** — column values, `t_infomask` / `t_infomask2` bit strips, HOT/ctid hints
- **Diff highlight** — byte-level changes on Refresh
- **Light / dark** theme

## Requirements

- Node.js 20+, pnpm 9+
- PostgreSQL 16.x with `pageinspect` enabled
- A role that can call `get_raw_page` (often superuser)

```sql
CREATE EXTENSION pageinspect;
```

The app never runs `CREATE EXTENSION` for you.

## Quick start

```bash
pnpm install
cp .env.example .env   # optional: auto-connect on server start
pnpm dev:server        # http://127.0.0.1:8787
pnpm dev:web           # http://127.0.0.1:5173
```

Open the web UI, connect (or rely on `.env`), pick a heap table and block number, then **Load**.

## Environment

Set credentials in `.env` (never commit secrets):

- `DATABASE_URL`, or `PGHOST` / `PGPORT` / `PGDATABASE` / `PGUSER` / `PGPASSWORD`
- `HOST` (default `127.0.0.1`), `PORT` (default `8787`)

Passwords stay in the server process — not in the repo or browser storage.

## Repo layout

| Path | Description |
|---|---|
| `packages/page-core` | Page parser, tuple decoder, structure field derivation |
| `apps/server` | Fastify API proxy to PostgreSQL |
| `apps/web` | React UI |

## Development

```bash
pnpm --filter page-core test
pnpm --filter web test
pnpm -r typecheck
pnpm -r build
pnpm test:integration   # needs .env + a table with blocks
```

Fixture capture: see `packages/page-core/fixtures/README.md`.

## Scope

- Heap user tables only (`relkind = r`)
- Standard 8 KB pages
- TOAST pointers shown; external toast pages not fetched
- No indexes, FSM/VM, or system catalogs

## Troubleshooting

| Error | Fix |
|---|---|
| `PAGEINSPECT_MISSING` | `CREATE EXTENSION pageinspect;` as superuser, reconnect |
| Connection refused | Check host/port/credentials; Postgres listening on localhost |
| `BLKNO_OUT_OF_RANGE` | Use `blkno` in `0 .. relpages-1` |
| `get_raw_page` denied | Use a privileged role |

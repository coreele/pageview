# pg-page-viewer

English | [中文](./README.zh-CN.md)

Browse PostgreSQL heap pages, B-tree index pages, and WAL records in the browser. Connect locally, fetch raw blocks via [pageinspect](https://www.postgresql.org/docs/current/pageinspect.html), or browse structured WAL records via [pg_walinspect](https://www.postgresql.org/docs/current/pgwalinspect.html) (PostgreSQL 15+).

Built for developers learning or debugging — **not** intended for public deployment.

![UI overview: structure diagram, hex dump, and tuple detail](./docs/assets/ui-overview.png)

## Features

### Page mode

- **Structure diagram** — 32 bytes/row: page header (with `pd_flags` bit strip), ItemId array, free space, tuples
- **Hex dump** — same 32B/row layout, linked selection and scroll-to-offset
- **Tuple decode** — column values, `t_infomask` / `t_infomask2` bit strips, HOT/ctid hints
- **Diff highlight** — byte-level changes on Refresh
- **Page nav** — toolbar **Prev** / **Next**: heap uses the displayed `blkno ± 1`; B-tree uses left/right siblings (`btpo_prev` / `btpo_next`). First/last (or leftmost/rightmost) pages disable the button instead of requesting an out-of-range block

### Index pages (B-tree)

- **Index browsing** — table | index switch; the index list shows access method, block count, and owning table; non-B-tree indexes are listed but marked unloadable; invalid indexes flagged (still loadable)
- **Page types** — metapage (`btm_*` incl. `allequalimage` on v4+), internal (child downlinks + level), leaf (heap TIDs); special space `btpo_*` with a `btpo_flags` bit strip
- **Hikey & posting lists** — high-key mark on the first tuple of non-rightmost pages; dedup posting tuples (PG13+) with TID count and full scrollable list
- **Key value decoding** — index tuple keys decoded per column type (int/bool/text/date/timestamp/timestamptz/uuid/numeric/float4/float8/bytea/domains) with NULL, include/↓/nulls-first badges and click-to-highlight column bytes; unsupported types (e.g. jsonb) or expression indexes degrade gracefully to hex-only
- **Block navigation** — load siblings (`btpo_prev`/`btpo_next`), root/fastroot, and child pages with one click; leaf heap TIDs jump straight to the owning table's block
- **Guards** — non-B-tree access methods (hash/gist/spgist/brin/gin) blocked in the UI and by the server (`INDEX_NOT_BTREE`)

### WAL mode

- Chrome switch **Page | WAL**; independent list UI (one wide metadata row per record)
- Query by start/end LSN; optional “Fill recent window” (~20 latest records; does not auto-load)
- FPI rows default collapsed (length/metadata only; no raw 8KB page render)
- **v1 has no WAL raw-byte hex** — structured `pg_walinspect` fields only
- Hard batch limits (fail, never truncate): ≤2000 records, ≤2 MiB JSON, ≤16 MiB LSN span

### Shared

- **Light / dark** theme

## Requirements

- Node.js 20+, pnpm 9+
- **Page mode:** a connect role that can enable `pageinspect` (needs `CREATE` privilege — usually superuser) and call `get_raw_page`; a missing extension is installed automatically on first Page request. Index browsing is B-tree only (PG13+ recommended for dedup posting lists)
- **WAL mode:** PostgreSQL **15+**; a connect role that can enable `pg_walinspect` (`CREATE` privilege) and call `pg_get_wal_records_info` / `pg_current_wal_lsn` (usually superuser); installed automatically when missing

```sql
-- Manual fallback when automatic install fails (missing privilege / extension files)
CREATE EXTENSION pageinspect;      -- Page mode
CREATE EXTENSION pg_walinspect;    -- WAL mode (PG15+)
```

Missing `pageinspect` / `pg_walinspect` are installed automatically when a mode first needs them — the connect role needs `CREATE` privilege (usually superuser). Connect succeeds without either extension; when automatic installation fails (insufficient privilege, missing extension files, …), the mode fails with the server's reason plus the manual steps above.

## Quick start

```bash
pnpm install
cp .env.example .env   # optional: auto-connect on server start
pnpm dev:server        # http://127.0.0.1:8787
pnpm dev:web           # http://127.0.0.1:5173
```

Open the web UI, connect (or rely on `.env`), then use **Page** (table or index + blkno + Load) or **WAL** (start/end LSN + Load).

## Environment

Set credentials in `.env` (never commit secrets):

- `DATABASE_URL`, or `PGHOST` / `PGPORT` / `PGDATABASE` / `PGUSER` / `PGPASSWORD`
- `HOST` (default `127.0.0.1`), `PORT` (default `8787`)

Passwords stay in the server process — not in the repo or browser storage.

## Repo layout

| Path | Description |
|---|---|
| `packages/page-core` | Page parser, tuple decoder, structure field derivation |
| `packages/wal-core` | WAL record types, mapping, batch limit checks |
| `apps/server` | Fastify API proxy to PostgreSQL |
| `apps/web` | React UI |

## Development

```bash
pnpm test                # all unit tests (page-core, wal-core, server, web)
pnpm -r typecheck
pnpm -r build
pnpm test:integration    # needs .env; Page path L3 (heap + self-seeded B-tree oracle smoke)
pnpm test:wal            # needs .env + PG 16+ with pg_walinspect; WAL path L3
```

CI runs both paths on push and pull_request (see `.github/workflows/ci.yml`):
the `unit` job runs typecheck + tests + build without a database; the
`integration` job brings up a `postgres:16` service with both extensions and
runs the two smoke scripts.

Fixture capture: see `packages/page-core/fixtures/README.md`.

## Scope

- Page mode: heap user tables (`relkind = r`) and B-tree indexes only
- Standard 8 KB pages
- TOAST pointers shown; external toast pages not fetched
- No non-B-tree indexes, FSM/VM, or system catalogs
- WAL v1: structured records only; no raw WAL hex; no PG17+ block-info APIs

## Troubleshooting

| Error | Fix |
|---|---|
| `PAGEINSPECT_MISSING` | Automatic install failed (e.g. missing privilege or extension files). Run `CREATE EXTENSION pageinspect;` as superuser — or install the extension files first — then retry Page |
| `WALINSPECT_MISSING` | Automatic install failed (e.g. missing privilege or extension files). Run `CREATE EXTENSION pg_walinspect;` as superuser — or install the extension files first — then retry WAL |
| `PG_VERSION_UNSUPPORTED` | Use PostgreSQL 15+ for WAL mode |
| `WAL_BATCH_TOO_LARGE` | Narrow the LSN range (≤2000 records / ≤2 MiB JSON / ≤16 MiB span) |
| Connection refused | Check host/port/credentials; Postgres listening on localhost |
| `BLKNO_OUT_OF_RANGE` | Use `blkno` in `0 .. relpages-1` |
| `BAD_OID` | Use an oid (integer `1..4294967295`) copied from the table/index list when building the URL |
| `INDEX_NOT_BTREE` | Index pages support B-tree only; pick an index with access method `btree`, or browse its owning table |
| `get_raw_page` / walinspect denied | Use a privileged role |

# Pageview — PostgreSQL heap page viewer

Local tool: connect to PostgreSQL, fetch heap pages via `pageinspect.get_raw_page()`, visualize page layout in the browser.

**Audience:** developers/learners. **Not** for public internet hosting.

## Packages

| Package | Role |
|---|---|
| `packages/page-core` | Pure TS parser/decoder + structure-field derive (browser + Vitest) |
| `apps/server` | Fastify thin proxy (default `127.0.0.1:8787`) |
| `apps/web` | React UI: top chrome controls/context, **32B/row structure diagram**, hex dump (32B/row), theme |

## Scope (v1)

- Heap user tables only (`relkind = r`); no system catalogs, indexes, FSM/VM
- Standard 8KB pages only
- Page controls and required connection/page metadata live in the top chrome (no sidebar)
- Page view: structure diagram aligned to **32 bytes per row** (header → ItemId → foldable free space → tuples); hex matches 32B/row with ≥4-digit offsets and auto-scrolls to the selection; at ≥960px they appear side by side (structure left, hex right), and below 960px they stack
- TOAST pointers shown as TOASTed — external toast pages not fetched

## Prerequisites

- Node.js 20+, pnpm 9+
- Live browsing: PostgreSQL **16.11** (16.x OK) with `pageinspect` and a role that can call `get_raw_page` (often superuser)

Enable the extension yourself — the app **never** runs `CREATE EXTENSION`:

```sql
CREATE EXTENSION pageinspect;
```

## Install & verify (L2)

```bash
pnpm install
cp .env.example .env   # fill locally; never commit secrets
pnpm --filter page-core test
pnpm -r typecheck
pnpm -r build
```

## Run

```bash
pnpm dev:server   # http://127.0.0.1:8787
pnpm dev:web      # http://127.0.0.1:5173 (proxies /api)
```

If env credentials are complete at server start, the process auto-connects (UI form still overrides the session).

## Environment

Keys only in `.env.example`. Prefer `DATABASE_URL`, or `PGHOST` / `PGPORT` / `PGDATABASE` / `PGUSER` / `PGPASSWORD`. Optional: `HOST` (default `127.0.0.1`), `PORT` (default `8787`).

Passwords stay in server process memory — not in repo config, not in frontend `localStorage` (theme preference may use `localStorage['pg-page-viewer.theme']` only).

## Theme

Light / dark. Default follows `prefers-color-scheme` (fallback light). Chrome toggle switches themes; optional cross-session memory via the theme key above.

## Fixture capture (optional L3 assets)

See `packages/page-core/fixtures/README.md`. Example:

```bash
pnpm capture-fixtures -- --rel public.demo --blkno 0 --out packages/page-core/fixtures/demo-blk0
```

## Integration smoke (L3)

```bash
pnpm test:integration
```

Requires configured `.env` and a table with `relpages > 0`. Without credentials the command exits non-zero and prints a block reason (do not treat as L2 failure).

## Failure tips

| Symptom | Next step |
|---|---|
| `PAGEINSPECT_MISSING` | Run `CREATE EXTENSION pageinspect;` as superuser, reconnect |
| Auth / connection refused | Fix host/port/user/password; ensure Postgres is listening on localhost |
| `BLKNO_OUT_OF_RANGE` | Use `blkno` in `0 .. blocks-1` |
| Permission on `get_raw_page` | Use a privileged role or grant as documented by your PG setup |

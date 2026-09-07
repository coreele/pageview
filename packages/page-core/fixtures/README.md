# Fixture capture

## Goal

Produce reproducible heap **and B-tree index** page bytes from **PostgreSQL 16.11** for
`page-core` Vitest (L2). Index captures additionally freeze a pageinspect oracle
(`bt_metap` / `bt_page_stats` / `bt_page_items`) consumed by `tests/btree-oracle.test.ts`.

## Prerequisites

1. PG 16.11 reachable with env credentials (`DATABASE_URL` or `PG*`).
2. `pageinspect` **already enabled** by a human:

```sql
CREATE EXTENSION pageinspect;
```

The capture script and the application **must not** execute `CREATE EXTENSION`.

3. Role able to call `get_raw_page(...)`.

## Steps (heap page)

```bash
# from repo root (deps installed)
pnpm exec tsx scripts/capture-fixtures.ts \
  --rel public.demo \
  --blkno 0 \
  --out packages/page-core/fixtures/demo-blk0
```

Outputs: `.bin`, `.base64.txt`, `.schema.json`, `.meta.json`.

## Steps (B-tree index page + oracle)

```bash
# from repo root (deps installed)
pnpm exec tsx scripts/capture-fixtures.ts \
  --index public.demo_idx \
  --blkno 0 \
  --out packages/page-core/fixtures/btree-meta
```

Outputs: `.bin`, `.base64.txt`, `.meta.json`, plus `.oracle.json` containing
`bt_metap` (captured for blkno 0 only), `bt_page_stats`, and `bt_page_items`
rows. `pageinspect` rejects stats/items on the metapage (`22023 block 0 is a
meta page`); the error string is recorded in the oracle JSON instead.

### Index-key-decode oracle additions

For `--index` with `blkno > 0` the oracle JSON additionally contains

- `indexColumns` — index column metadata (`pg_attribute` of the index JOIN
  `pg_type` + `pg_index` meta: `indnatts`/`indnkeyatts`/`indkey`/`indoption`/
  `hasExpression` + per-column `attnum`/`name`/`typoid`/`typname`/`typmod`).
  The two SQL statements mirror `INDEX_META_SQL` / `INDEX_COLUMNS_SQL` in
  `apps/server/src/catalog.ts` — keep them in sync.
- `tableRows` — owning-table row values per tuple (UTC session, `::text`
  casts), keyed by `itemoffset`. Leaf tuples use `htid` (or the first posting
  TID); internal/leaf pivot tuples use the trailing heap TID (`htid`) when
  stored — it points at the boundary ("firstright") row. A pivot `ctid` is a
  downlink or self-reference and is never used for row lookup.

These are consumed by `tests/btree-oracle.test.ts` (decode assertions) and
freeze the key-area layout rules recorded in
`workflow/archive/2026/index-key-decode/dev-notes.md`.

### Captured B-tree scenes (committed)

| Fixture | Seed | blkno | What it freezes |
|---|---|---|---|
| `btree-meta` | `pageview_fx.demo_uniq_k_idx` (50000 distinct ints) | 0 | v4 metapage: magic 0x053162, root/level, fastroot/fastlevel, allequalimage (v4) |
| `btree-internal` | same | 3 | root internal (level 1): minus-infinity hikey, downlink t_tid child pointers |
| `btree-leaf` | same | 1 | plain leaf: hikey (non-rightmost), int key tuples, special space |
| `btree-posting` | `pageview_fx.demo_dup_k_idx` (30000 rows, `k = i % 50`) | 1 | dedup leaf: posting tuples with 100+ TID lists |
| `idx-composite` | `pageview_ikd.t_comp_idx` on `(a int, b text) INCLUDE (c int)`, 3000 rows | 1 | multi-column leaf: per-column attalign of fixed-length cols, packed varlena, hikey with nkeyatts=1 suffix truncation |
| `idx-composite-internal` | same | 3 | root internal: pivots nkeyatts=1 (b/c truncated), no trailing heap TID (boundary keys differ) |
| `idx-posting-internal` | `pageview_ikd.t_dup_k_idx` (`k = i % 50`, 30000 rows) | 3 | root internal of a high-dup non-unique index: pivots with BT_PIVOT_HEAP_TID_ATTR + trailing 6B heap TID |
| `idx-align` | `pageview_ikd.t_align_idx` on `(a int, b text, c int)` with varied text lengths + NULLs | 1 | fixed-length column alignment vs packed varlena; NULL bitmap (inverted bits) |
| `idx-desc` | `pageview_ikd.t_comp_desc_idx` on `(a DESC, b)` | 1 | DESC column: bytes stored plain (indoption only), descending key order |
| `idx-bool` | `pageview_ikd.t_bool_idx` | 1 | bool 1B values; posting tuples via dedup |
| `idx-date` | `pageview_ikd.t_date_idx` (incl. ±infinity, year 1) | 1 | date int32 days since 2000-01-01, ±infinity sentinels |
| `idx-timestamp` | `pageview_ikd.t_ts_idx` (microsecond-distinct, ±infinity) | 1 | timestamp int64 µs since 2000-01-01, ±infinity sentinels |
| `idx-timestamptz` | `pageview_ikd.t_tstz_idx` (varied offsets) | 1 | timestamptz int64 µs (UTC instant); UTC-session `::text` oracle |
| `idx-uuid` | `pageview_ikd.t_uuid_idx` | 1 | uuid 16 raw bytes, lowercase display |
| `idx-null` | `pageview_ikd.t_null_idx` (nullable int with NULLs) | 1 | single-column NULL bitmap; garbage LP_NORMAL entry toleration |
| `idx-null2` | `pageview_ikd.t_null2_idx` on `(a int, b text)` with NULL combinations | 1 | bitmap-4B-allocation + data at MAXALIGN(8+4)=16; inverted null bits |
| `idx-text` | `pageview_ikd.t_text_idx` (short / >64 chars / multibyte / 200×C / 100×多) | 1 | 1B vs 4B varlena headers (>127B total ⇒ 4B), UTF-8 payloads, control chars |
| `idx-expr` | `pageview_ikd.t_expr_idx` on `lower(name)` | 1 | expression index: indkey=[0], pg_attribute row typed by expression result |
| `idx-jsonb` | `pageview_ikd.t_mixed_idx` on `(a int, j jsonb)` | 1 | mixed supported/unsupported columns: a decodes, jsonb degrades |

Seed sketch for the original `pageview_fx` scenes (btree-meta/internal/leaf/posting;
operator runs manually; the capture script never does):

```sql
CREATE SCHEMA pageview_fx;
CREATE TABLE pageview_fx.demo_dup (k int);
INSERT INTO pageview_fx.demo_dup SELECT i % 50 FROM generate_series(1, 30000) i;
CREATE INDEX demo_dup_k_idx ON pageview_fx.demo_dup (k);
CREATE TABLE pageview_fx.demo_uniq (k int);
INSERT INTO pageview_fx.demo_uniq SELECT i FROM generate_series(1, 50000) i;
CREATE INDEX demo_uniq_k_idx ON pageview_fx.demo_uniq (k);
ANALYZE pageview_fx.demo_dup; ANALYZE pageview_fx.demo_uniq;
-- find pages via bt_metap(...).root / bt_page_stats(...)
```

`btree-posting` requires PG13+ deduplication: highly duplicated keys (and
`ANALYZE` to let the dedup path see duplicates) produce posting tuples.

Seed sketch for the `pageview_ikd` scenes (operator runs manually; the capture
script never does — see `workflow/archive/2026/index-key-decode/dev-notes.md`
for the frozen rules these captures verify):

```sql
CREATE SCHEMA pageview_ikd;
CREATE TABLE pageview_ikd.t_comp (a int NOT NULL, b text NOT NULL, c int NOT NULL);
INSERT INTO pageview_ikd.t_comp
SELECT i, 'b' || lpad(((i * 37) % 100)::text, 3, '0'), i % 7 FROM generate_series(1, 3000) i;
CREATE INDEX t_comp_idx ON pageview_ikd.t_comp (a, b) INCLUDE (c);
CREATE INDEX t_comp_desc_idx ON pageview_ikd.t_comp (a DESC, b);
-- t_bool / t_date / t_ts / t_tstz / t_uuid / t_null / t_null2 / t_text / t_expr /
-- t_mixed / t_align / t_dup: single-purpose small seeds, see fixture table
CREATE INDEX t_dup_k_idx ON pageview_ikd.t_dup (k);  -- k = i % 50, 30000 rows
ANALYZE pageview_ikd.*;
```

## Suggested scenes (heap)

| Fixture | How to prepare |
|---|---|
| Sparse page | Few rows in a wide table so free space dominates |
| Common types | Columns covering bool/int/text/uuid/timestamp/… |
| HOT / REDIRECT | `UPDATE` without key change; inspect with `heap_page_items` |
| Cross-block ctid | Update that forces a new page version pointing off-block |

## Suggested scenes (B-tree)

| Fixture | How to prepare |
|---|---|
| metapage | Any btree index, blkno 0 |
| internal | Enough rows for a multi-level tree; use `bt_metap(...).root` |
| leaf | Any non-root leaf block (`bt_page_stats` `type='l'`) |
| posting leaf | Repeated-key int column + `ANALYZE` (dedup, PG13+) |
| pivot with trailing TID | High-duplication non-unique key, capture the root/internal page |

## Repo baseline

Synthetic fixtures generated by `buildSparsePage` / `buildBtreePage` are committed
under `packages/page-core/fixtures/` so L2 works without a live database, along
with the real-capture B-tree scenes above. Replace/augment with fresh real
captures when PG is available.

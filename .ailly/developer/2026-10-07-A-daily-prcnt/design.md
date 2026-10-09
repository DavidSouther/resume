# Design: DAILY_PRCNT view

## Purpose

hw4 queries need each symbol's daily percentage gain or loss. Raw `cts` closes are unadjusted, so a split date shows a false 50 percent drop and dividends are invisible. `DAILY_PRCNT(TDATE, SYMBOL, PRCNT)` gives a read-only relation where `PRCNT` is a total return with split and dividend effects accounted for.

## Prior Art

- CRSP daily returns: a return after a missing price is computed from the last available price, and the consumer filters by gap. Cumulative adjustment factors apply every split dated between two price rows to the later row.
- Index providers (Nasdaq): corporate actions apply on the ex-date and carry the adjusted price through suspensions.
- Local: hw1 holds index and timing scripts (`create_indexes.sql`, `perf_scan.py`); hw4 `db/` holds `schema.sql`, `load.sh`, and captured `*.out`.

## User Journey and Metrics

1. A student loads the database with `db/load.sh`.
2. They run `select * from daily_prcnt where symbol = 'AAPL' and tdate = '2000-06-21'` and see `9.89`, not `-49`.
3. For repeated or whole-table queries they use a materialized copy indexed on `(symbol, tdate)`.

Metrics: known-answer rows match to two decimals (feature test). Single-symbol lookups through the view finish in seconds. A one-time materialization of 44M rows is timed and recorded in a `db/*.out` file.

## Specification

Schema: `DAILY_PRCNT(TDATE date, SYMBOL text, PRCNT numeric)`, in that order.

Meaning of a row: for each `cts` row with a positive close that has an earlier positive-close row for the same symbol, `PRCNT` is `100 * (value today per old share / previous positive close - 1)`.

- Value today per old share is `(close + dividends) * post / pre`. Dividends and splits are ex-date events.
- `PRCNT` is a percent: 5.73 means +5.73 percent.
- Zero-close rows are placeholders. They produce no row and never serve as a previous close.
- A symbol's first positive-close row produces no row.
- Gaps: decided by the human on 2026-10-09 (compute across gaps, apply orphaned events). The previous close is the symbol's last positive close, however old. No row is dropped for a gap. Gap length is not in this relation.
- Orphaned events: every split and dividend dated after the previous price row and up to and including the current row applies to the current row. Several splits in one interval multiply; several dividends sum. Events dated after a symbol's last price row apply to nothing.
- Splits with `post = pre` are no-ops. Splits with a null or zero `pre` are ignored.
- Source outliers (for example AAC 2009-01-15) are left as is. No clamping, no flag column.

Deliverables:

- `db/daily_prcnt.sql` creates view `daily_prcnt`, a materialized copy `daily_prcnt_mat` with an index on `(symbol, tdate)`, and a second view `daily_prcnt_gap(tdate, symbol, gap_days)` exposing days since the previous positive close so a consumer can filter. Re-running the file is safe.
- Supporting indexes and `CLUSTER` guidance are optional and timed with `EXPLAIN (ANALYZE, BUFFERS)`.

Failure modes: the file errors visibly on a missing table; division by zero cannot occur because zero closes are excluded; a missing event table row is the neutral element (`post/pre = 1`, `dividend = 0`).

Manual verification: compare AAPL 2000-06-21 against a published adjusted close series, and spot check one orphaned split.

## Alternatives

- Use an adjusted-close vendor feed: not available offline in this dataset, and the homework requires computing it from `splits` and `dividend`.
- Stored table instead of a view: duplicates 44M rows and goes stale; the view is the definition and a materialized copy is the cache.
- Drop rows beyond a gap limit, or emit NULL: rejected in favor of CRSP-style practice; the gap view serves filtering.
- Drop orphaned events (equality joins only): simpler and faster, but ignores 852 splits and 8,640 dividends.

## Summary

Single SQL file defining `daily_prcnt` as the specification, a materialized copy for speed, and a gap view. Deferred: choice of a gap limit by consumers, outlier flagging, and whether to cluster `cts`.

### Open Artifact Decisions

**`db/daily_prcnt.sql`:** file holding all three objects; alternative is one file per object. Proposed: one file, matching `space.sql` style.

**`daily_prcnt_mat` and `daily_prcnt_gap`:** names of the materialized copy and gap view. Proposed: as written.

**`db/test_daily_prcnt.sh`:** shell script running SQL assertions through `docker exec` against `cts-pg`; alternative is a vitest test. Proposed: shell, because the repo's vitest suite does not otherwise depend on docker or the 44M-row dataset.

## Feature Test

Path: [pages/course/cisc_7510/hw4/db/test_daily_prcnt.sh](../../../pages/course/cisc_7510/hw4/db/test_daily_prcnt.sh). Run from `hw4/` with `sh db/test_daily_prcnt.sh`.

Story: given the loaded database, when a student applies `daily_prcnt.sql`, then split-day, dividend-day, and orphaned-split returns match known answers (AAPL 1987-06-16 +5.73, 2000-06-21 +9.89, 2005-02-28 +0.82, 2012-08-09 +0.57; KO 2012-08-13 -0.24; AA-V 2009-04-01 -12.50 from a 1:10 reverse split dated 2009-03-31 with no price row), no row exists for a first date or a zero-close date, keys are unique, and the columns are exactly `tdate, symbol, prcnt`.

Currently red: it fails because `db/daily_prcnt.sql` does not exist.

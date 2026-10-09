# Plan: DAILY_PRCNT view (quick loop)

1. Write `db/daily_prcnt.sql`: indexes on `cts`, `splits`, `dividend` by `(symbol, tdate)`; view `daily_prcnt` with window `lag` over positive closes and lateral aggregates of orphaned events; view `daily_prcnt_gap`; materialized copy `daily_prcnt_mat` with index. Idempotent.
2. Run `sh db/test_daily_prcnt.sh` from `hw4/` until green.

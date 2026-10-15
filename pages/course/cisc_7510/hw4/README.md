# HW4: DAILY_PRCNT

`db/daily_prcnt.sql` defines `DAILY_PRCNT(TDATE, SYMBOL, PRCNT)`, a daily total return in percent for each symbol, adjusted for splits and dividends. This file records how the solution was reached, what went wrong along the way, and what remains unverified.

## Use

```sh
sh db/load.sh                  # start Postgres in docker and load the data
sh db/test_daily_prcnt.sh      # apply daily_prcnt.sql and run known-answer checks
```

The first run builds three indexes and a 44M-row materialized copy, and took about 3.5 minutes. Later runs reuse them.

Objects created:

| Object | Purpose |
|---|---|
| `daily_prcnt` | View. The definition of the relation. |
| `daily_prcnt_gap` | View of `(tdate, symbol, gap_days)`. Days since a symbol's previous positive close, for filtering. |
| `daily_prcnt_mat` | Materialized copy of `daily_prcnt`, indexed on `(symbol, tdate)`. Drop it to rebuild. |
| `daily_prcnt_gap_base` | Helper view that both public views read from. |

## Row Semantics

`PRCNT = 100 * (value today per old share / previous positive close - 1)`, where value today per old share is `(close + dividends) * post / pre`.

- 5.73 means +5.73 percent change in value.
- Zero closes are placeholders. They produce no row and never serve as a previous close.
- A symbol's first positive close is not a Daily Percent change..
- The previous close is a symbol's last positive close, however old. Gap length is in `daily_prcnt_gap`.
- Splits and dividends dated after the previous price row, up to and including the current row, apply to the current row. A split on a non-trading day still adjusts the next trading day. Several splits multiply; several dividends sum.
- Source outliers are left as is. No clamping.

## Steps from course notes to solution

1. **Notes to prompt.** Lecture material on analytic functions, joins, views, indexes and bulk loads, plus a request for a relation that accounts for splits and dividends.
2. **Research.** Measured the loaded database: 44M price rows, 8.5k splits, 321k dividends. Mapped notes concepts to Postgres features: `lag` for a previous close, a left join to `splits` and `dividend`, `COALESCE` for missing events, a materialized view for caching. Validated a prototype on AAPL and KO.
3. **Decisions.** Total return with ex-date dividends added back, percent units, a plain view as the specification plus a materialized copy, no outlier clamping. Gaps and orphaned events were checked against CRSP and Nasdaq index methodology, and the decision was to compute across gaps and apply orphaned events to the next price row.
4. **Design.** A specification and a feature test with known answers, written to fail first because `daily_prcnt.sql` did not exist.
5. **Intent review.** Four questions against the original prompt: orphaned events, gaps, the materialized copy, and the gap view.
6. **Plan and build.** Write the SQL file, run the feature test. It passed on the first run.

## Challenges

- **Notes written for Oracle.** `NVL`, `NULLIF` and `LAST_VALUE ... IGNORE NULLS` need Postgres equivalents. `IGNORE NULLS` is not implemented, so forward-fill needs a different approach.
- **Unadjusted prices.** A split date shows a false 50 percent drop. AAPL 2000-06-21 reads about -49 percent without adjustment and +9.89 percent with it.
- **Dirty data.**
  - 231k zero-close placeholder rows.
  - 852 splits and 8,640 dividends dated on days with no price row.
  - 101 splits with `post = pre`.
  - Large post-adjustment outliers, such as AAC 2009-01-15 and ABCB 2009-12-29.
- **Scale.** A whole-table window sort over 44M rows makes index and materialization choices matter.

## Failure steps

- **Assumptions falsified by data.** Prices are not already adjusted. Dividend dates are ex-dates, not pay dates. The previous row is not the previous trading day, only the previous row for that symbol.
- **Naive prototype.** `close / lag(close) - 1` gives false drops on split dates. Joining only on an exact `(tdate, symbol)` silently drops orphaned events.
- **Gap decision.** The design cited a gap decision that research still listed as open. The design review flagged that no human confirmation was documented, and the decision was recorded afterward.
- **Intent drift.** The materialized copy and gap view go beyond the literal three-column request. They were accepted as additions and not re-confirmed.

## Departures from the research

- **Join strategy.** Research warned that range joins at 44M rows force nested loop or merge plans, and preferred a `UNION ALL` stream with window carry. The solution uses `LEFT JOIN LATERAL` range lookups against the small `splits` and `dividend` tables, backed by `(symbol, tdate)` indexes. It is simpler and passes, but `EXPLAIN (ANALYZE, BUFFERS)` was not inspected to confirm the plan.
- **Float split factor.** The split product is `exp(sum(ln(post/pre)))` in double precision. It is accurate to well beyond two decimals, but it is not exact.

## Not verified

- Weak invariant: the zero-close check only inspects symbols below 'AB'.
- Whole-table materialization time is not recorded in a `db/*.out` file.
- No comparison against a published adjusted-close series.
- `EXPLAIN` plans for the view and the materialized copy.
- Intent review of the plan and the build diff did not run.

# Research: DAILY_PRCNT view

## Topic and Intent

> pages/course/cisc_7510/hw4 begin research on a daily percent table, a view selection table to read the daily percentage gain or loss accounting for splits and dividends in this dataset.

Follow-up from user: "schema DAILY_PRCNT,  fields: TDATE, SYMBOL, PRCNT".

Goal in own framing: a read-only relation `DAILY_PRCNT(TDATE, SYMBOL, PRCNT)` over `cts`, `splits`, and `dividend` in the hw4 Postgres database, where `PRCNT` is a symbol's daily percentage gain or loss with split and dividend effects removed. "Table" here means a selection (a view or query), not a stored table.

## Search/Expand

Dataset facts, measured against the running `cts-pg` container (Postgres 16, port 5433, loaded by `db/load.sh`).

- `cts`: 44,314,948 rows, 24,424 symbols, 1950-01-03 to 2014-01-14. No duplicate `(tdate, symbol)` keys. No indexes.
- Prices are raw and unadjusted. AAPL closes 101.25 on 2000-06-20 and 55.63 on 2000-06-21, the date of a 2:1 row in `splits`. Same for 1987-06-16 (78.50 to 41.50) and 2005-02-28 (88.99 to 44.86). KO 2012-08-13 and MSFT, IBM, DIS splits show close ratios near `pre/post`. A naive `close / lag(close) - 1` therefore reports false 50 percent drops.
- `splits(tdate, symbol, post, pre)`: 8,471 rows, 3,654 symbols, no duplicate keys, no zero or null ratios. `tdate` is the ex-date (first day of new share count). `post/pre` is new shares per old share. 1,533 rows are reverse splits (`post < pre`). 101 rows have `post = pre` (no-ops, e.g. NPX 1907 rows). 852 rows have no `cts` row on their date.
- `dividend(tdate, symbol, dividend)`: 320,742 rows, 7,331 symbols, no duplicate keys. `tdate` is the ex-date (AAPL 2012-08-09, 2.65). 288 rows have a non-positive amount. 8,640 rows have no `cts` row on their date. Source CSV header names the column `AMOUNT`; schema names it `dividend`.
- `cts.close = 0` on 231,239 rows across 2,388 symbols (value is exactly 0.00, never negative or null). These are placeholders for delisted or untraded periods, and make 230,410 following rows have a zero previous close.
- Before filtering, 205,300 close-to-close moves exceed 40 percent, and only 4,080 coincide with a `splits` row. Most are penny stock or zero-close artifacts.
- Loaded files have no header rows. `*.head` files hold headers separately.

## Libraries & Skills

Before doing any work in this feature, load these skills via the active harness's skill-loading mechanism: none apply. No library skill exists for this surface; that is a finding, not a gap.

- PostgreSQL 16 (docker image `postgres:16`). Window functions (`lag() over (partition by symbol order by tdate)`), `LEFT JOIN`, `CREATE VIEW`, `CREATE MATERIALIZED VIEW`, `CREATE INDEX`. Docs: window function tutorial [1] and `lag` in the Functions chapter [2]; see Outside Learning for `coalesce`, `nullif`, CTE inlining, `EXPLAIN`, `CLUSTER`, and `COPY`. No published SKILL.md, MCP server, or similar worked example found in this repo; hw1 (`../hw1`) holds index and perf scripts in the same style (`create_indexes.sql`, `perf_scan.py`) and is the closest local example.
- Local conventions: `db/schema.sql`, `db/load.sh` (idempotent, applies `db/*.sql`), outputs captured as `db/*.out`. A view file belongs beside them, e.g. `db/daily_prcnt.sql`.

### Learning Path

Learning path from the prompt and lecture-style notes (analytic functions, joins, views, indexes, data loads) to outside references. Each step starts from a symptom a learner would hit, names a likely search, and ends at a PostgreSQL 16 documentation page. Order is the order of encounter.

1. **Previous close.** Symptom: need yesterday's close beside today's. The analytic-function notes already show `lag(tim) over (partition by tdate, symbol order by tim)`. Swap in `lag(close) over (partition by symbol order by tdate)`. No outside source is needed to start. Reference for exact semantics: `lag(value, offset, default)` returns `default` (NULL if omitted) when no earlier row exists, and ignores the frame clause [2]. Add `lag(tdate)` in the same window to measure gaps, which resolves open item 1 without another join.

2. **False 50 percent drop on a split date.** Symptom: AAPL 2000-06-21 shows about -49 percent. Cause is found by looking at data, which points to the `splits` table. The notes' left outer join applies: join on `(tdate, symbol)` and multiply by `post/pre`. Window tutorial for context [1].

3. **Joins return NULL on ordinary days.** Symptom: left join to `splits` and `dividend` makes most rows NULL, because no event exists. Notes are Oracle flavored, so a likely search is "NVL postgres" or "postgres replace null with default". Result: `COALESCE` [3]. Use `coalesce(d.dividend, 0)` and `coalesce(s.post, 1)`, which are neutral elements for add and multiply.

4. **Errors on edge rows.** Symptoms and searches:
   - `division by zero` on rows after a zero close. Search "postgres divide by zero return null". Result: `NULLIF(pclose, 0)` on the same page [3]. Division by NULL yields NULL, so a row survives with NULL `PRCNT` instead of aborting the query.
   - `post / pre` returns 0 or 1. Search "postgres integer division". Result: integer division truncates, so cast one operand to `numeric` [4].

5. **Carry the last positive close across zero rows.** Symptom: the notes use `LAST_VALUE(bid IGNORE NULLS)`; trying it in Postgres gives a syntax error. Search the error text. Result: the window functions page states `IGNORE NULLS` is not implemented [2]. Workaround for forward fill is a running `count(col) over (...)` used as a group id, then `max(col)` per group. Same technique serves orphaned splits and dividends from open item 1, through the notes' merge-then-window approach (`UNION ALL` of rows, then window).

6. **Query is slow on 44M rows.** Notes on indexes and join algorithms say what to expect. Searches and results:
   - "postgres why is my query slow". Result: `EXPLAIN (ANALYZE, BUFFERS)` [5]. Check `Sort Method` for disk spill, hash `Batches` above 1, and that both left joins are hash joins.
   - "postgres clustered index". The notes explain clustered indexes; Postgres names the operation `CLUSTER` [7]. It reorders once, locks the table, needs scratch space near twice table size, and is not maintained afterward. Run `ANALYZE` after.
   - "postgres cache view results". The notes say view results may be cached until invalidated; Postgres makes that explicit as a materialized view [6]. Index it separately.

7. **Reload after changes.** The data load notes cover bulk loading and name PostgreSQL `COPY`. Option lookup only: [8].

Left out as off path: CTE inlining controls, `COPY ... FREEZE`, and `numeric` versus `double precision` speed tradeoffs. Revisit if a plan shows the view not pushing a `symbol` predicate down, or if load time matters.

## Falsification/Refine

Size: single feature, one SQL file. Off-the-shelf: no tool needed; Postgres covers it.

Falsified assumptions:

- "Prices are already split-adjusted." False, shown above.
- "Dividend `tdate` is a pay date." Evidence says ex-date: AAPL 2012-08-09 close 620.73 versus 619.84 the previous day gives +0.57 percent with a 2.65 dividend added back, which is a sane ex-date return.
- "Previous row is previous trading day." Only within a symbol's own rows. Gaps exist in a symbol's history, and `lag` over positive-close rows may span a long gap. Decide whether to cap the gap.

Prototype (temp view, validated on AAPL, KO):

```sql
with l as (
  select tdate, symbol, close,
         lag(close) over (partition by symbol order by tdate) as pclose
  from cts where close > 0
)
select l.tdate, l.symbol,
  100.0 * ((l.close + coalesce(d.dividend, 0))
           * coalesce(s.post, 1)::numeric / coalesce(s.pre, 1) / l.pclose - 1) as prcnt
from l
left join splits   s on s.tdate = l.tdate and s.symbol = l.symbol and s.pre > 0
left join dividend d on d.tdate = l.tdate and d.symbol = l.symbol
where l.pclose is not null;
```

Formula: one old share equals `post/pre` new shares, so value today per old share is `(close + dividend) * post/pre`, compared with yesterday's close. Results: AAPL 1987-06-16 +5.73 percent, 2000-06-21 +9.89 percent, 2005-02-28 +0.82 percent, 2012-08-09 +0.57 percent; KO 2012-08-13 -0.24 percent. All plausible. Dividend amounts are assumed to be in the same share basis as post-ex-date close.

Cost: view over all rows is a full scan plus window sort of 44M rows. A 4.3M-row slice (symbols below 'B') materialized in about 9 seconds; a two-event point lookup through the view ran in about 2 seconds. Whole-table materialization likely needs minutes and an index on `(symbol, tdate)` or a materialized view. A B-tree on `(symbol, tdate)` suits the high-cardinality key; hash indexes cannot serve `order by tdate`. `CLUSTER cts USING <that index>` physically sorts rows in window order, so the partitioned scan can be sequential and the 44M-row sort may disappear [7]. Verify with `EXPLAIN (ANALYZE, BUFFERS)` [5] before and after, and run `ANALYZE` after clustering.

Residual data quality, unresolved by formula: in symbols A through AZ, 26,915 of 4.3M adjusted rows still exceed 40 percent, only 59 on a split date. Some split-date rows stay extreme after adjustment (AAC 2009-01-15, ratio 1:15, -52.9 percent; ABCB 2009-12-29, 93:16, +484 percent), which suggests the ratio is wrong, late, or applied to a thinly traded symbol. This is source data noise, not a formula error.

Smallest version that meets intent: a plain view with the query above, zero-close rows excluded, no stored data.

## Scope

In scope for design:

- `DAILY_PRCNT(TDATE, SYMBOL, PRCNT)` as a view (and optionally a materialized variant) in a new `db/daily_prcnt.sql`.
- Treatment of split ratios, dividends (total return, ex-date), zero closes, first-row-per-symbol, and `post = pre` no-ops.
- A feature test: known-answer rows (AAPL and KO above) plus invariants such as no row for a symbol's first date.
- Optional index and timing notes in the style of hw1.

Out of scope: correcting source data errors, intraday or high/low-based measures, compounding or multi-day returns, dividend reinvestment, and the remaining hw4 questions.

## Resolved Decisions

Resolved by research:

- Prices are unadjusted; the view must adjust.
- Split and dividend dates are ex-dates, matched on the same `(tdate, symbol)` key as the price row.
- Column names are exactly TDATE, SYMBOL, PRCNT, per user.
- Zero closes are placeholders and are excluded from numerator and denominator.

Decided by the human:

- `PRCNT` is total return: split adjusted, with the ex-date dividend added back to today's close, and no reinvestment.
- `PRCNT` is stored as percent (5.73 means +5.73 percent), not a fraction.
- A plain view defines `DAILY_PRCNT` as the specification. A materialized copy, indexed on `(symbol, tdate)`, serves repeated queries.
- Outliers after adjustment are left as is. No clamping and no flag column in `DAILY_PRCNT`; a downstream query may flag them.

### Established practice (financial services)

Researched 2026-10-09 in response to both open items. Sources are vendor and index-provider methodology documents.

- **Gaps in price history.** CRSP, the standard academic daily-return source, does not drop or cap a return after a missing price. It marks missing days with a code (-99.0, no price available) and reports the next available return as a multi-day return; a return after 9 or more missing observations is coded as a one-day return (-66.0) [10]. Guidance for users of CRSP is to keep only one-day returns for daily-frequency estimation, so the consumer filters, not the data source [10]. Compounding daily returns across trading gaps differs from month-end price returns for about 2.2 percent of security-months, because month-end prices go stale [11]. Index providers handle halts by carrying the last price until trading resumes [13]. Practice therefore favors computing the return from the last available price and making the gap visible so a consumer can filter. That is the "compute anyway" option, plus an optional gap indicator derived from `lag(tdate)`.
- **Corporate actions with no price row.** Index providers apply a split or dividend on its ex-date and carry the adjusted price until trading resumes; if a suspension is known in advance, the action is not recognized until trading resumes [13]. CRSP keeps a cumulative adjustment factor that changes whenever a split event falls between observations (`C(t) = C(t-1) * f` if a split event occurs since t-1), so an event dated between two price rows adjusts the later row [11][12]. CRSP sets adjusted values to missing when a gap hides possible split events [11]. Practice therefore favors applying every split and dividend dated after the previous price row and up to the current row. That is the "apply to next trading row" option.
- **Missing return treatment.** CRSP ignores a missing return in compounding, which treats it as 0 [11]. This is a consumer choice, not part of the base return series.

Recommendation: compute across gaps, apply orphaned events to the next trading row, and surface gap length rather than hide rows. A gap column would live outside `DAILY_PRCNT(TDATE, SYMBOL, PRCNT)`, for example in a second view, so the three-column schema stays as specified.

Open for the human (confirm the recommendation above, or choose differently):

1. Gaps and orphaned events. Two parts:
   - Prototype computes across any gap since a symbol's previous positive close. Choose: compute anyway, emit no row beyond a gap limit (limit to be chosen, e.g. 5 calendar days), or emit NULL. Detect a gap with `lag(tdate)` in the same window as `lag(close)`, so no extra join or sort is needed [2].
   - 852 splits and 8,640 dividends fall on dates with no price row and are dropped. Recommended: apply every split and dividend dated after the previous trading row and up to the current row, so a split on a non-trading day still adjusts the next day's return. Preferred mechanism: merge price, split, and dividend rows for a symbol into one ordered stream with `UNION ALL`, then carry values with window functions. Without `IGNORE NULLS` [2], use a running-count group id. This keeps every join an equality, which allows hash joins; a range join (`s.tdate > ptdate and s.tdate <= l.tdate`) forces nested loop or merge join at 44M rows.

## Sources

[1] PostgreSQL Global Development Group, "Window Functions," PostgreSQL 16 Documentation, Tutorial, sec. 3.5. https://www.postgresql.org/docs/16/tutorial-window.html
[2] PostgreSQL Global Development Group, "Window Functions," PostgreSQL 16 Documentation, sec. 9.22. https://www.postgresql.org/docs/16/functions-window.html
[3] PostgreSQL Global Development Group, "Conditional Expressions" (COALESCE, NULLIF), PostgreSQL 16 Documentation, sec. 9.18. https://www.postgresql.org/docs/16/functions-conditional.html
[4] PostgreSQL Global Development Group, "Numeric Types," PostgreSQL 16 Documentation, sec. 8.1. https://www.postgresql.org/docs/16/datatype-numeric.html
[5] PostgreSQL Global Development Group, "Using EXPLAIN," PostgreSQL 16 Documentation, sec. 14.1. https://www.postgresql.org/docs/16/using-explain.html
[6] PostgreSQL Global Development Group, "CREATE MATERIALIZED VIEW," PostgreSQL 16 Documentation. https://www.postgresql.org/docs/16/sql-creatematerializedview.html
[7] PostgreSQL Global Development Group, "CLUSTER," PostgreSQL 16 Documentation. https://www.postgresql.org/docs/16/sql-cluster.html
[8] PostgreSQL Global Development Group, "COPY," PostgreSQL 16 Documentation. https://www.postgresql.org/docs/16/sql-copy.html
[10] "Missing return codes -99.0 and -66.0 and multi-day returns," course assignment notes on CRSP data. https://volweb.utk.edu/~pdaves/599/assignment4.htm
[11] CRSP, "Calculations and Index Methodologies." https://crsp.org/wp-content/uploads/guides/CRSP_Calculations_and_Index_Methodologies.pdf
[12] CRSP, "Calculations: Splits and adjustment factors." https://leiq-dev.bus.umich.edu/docs/crsp_calculations_splits.pdf
[13] Nasdaq Global Indexes, "Corporate Actions and Events Manual, Equities." https://indexes.nasdaqomx.com/docs/Corporate_Actions_and_Events_Manual_Equities.pdf
[9] Measurements from `cts-pg` container, database `cts`, queried 2026-10-07; tables defined in `pages/course/cisc_7510/hw4/db/schema.sql`.

# Intent Review: DAILY_PRCNT Design

Reviewed 2026-10-09

## Original Request

From research.md Topic and Intent:
> begin research on a daily percent table, a view selection table to read the daily percentage gain or loss accounting for splits and dividends in this dataset

Schema specified: `DAILY_PRCNT(TDATE, SYMBOL, PRCNT)`

## Questions Raised

### Question 1: Orphaned Events Coverage (Design Assumption)

**Claim:** As designed and tested, the program applies splits and dividends dated after the previous price row up to and including the current price row. For example, test_daily_prcnt.sh verifies AA-V 2009-04-01 returns -12.50 from a 1:10 reverse split dated 2009-03-31 (no price row on split date).

**Original request:** "accounting for splits and dividends"

**Alignment question:** Does "accounting for splits and dividends" include orphaned events (corporate actions with no price row on their ex-date), or only those on trading dates?

### Question 2: Gap Handling Behavior (Design Assumption)

**Claim:** As designed, the program computes a daily return for any trading day with a previous positive close, regardless of gap length. The specification states: "The previous close is the symbol's last positive close, however old. No row is dropped for a gap." The gap_days column resides in a separate `daily_prcnt_gap` view, not in DAILY_PRCNT itself.

**Original request:** "daily percentage gain or loss"

**Alignment question:** Does "daily" imply returns should be computed only within a trading-day gap limit (e.g., 5 days), or is computing across arbitrarily long gaps the intended behavior? Should gap information be visible in DAILY_PRCNT, or is surfacing it separately acceptable?

### Question 3: Materialized View Scope (Design Assumption)

**Claim:** As designed, the deliverable includes a materialized view `daily_prcnt_mat` indexed on `(symbol, tdate)` alongside the base view `daily_prcnt`. The design notes this is optional for performance on repeated queries but includes it in the SQL file.

**Original request:** "a view selection table"

**Alignment question:** Is the materialized copy part of the required DAILY_PRCNT deliverable, or is it a performance optimization that consumers may choose to materialize separately? Should db/daily_prcnt.sql create both the view and materialized copy, or only the view?

### Question 4: Gap View Scope (Design Assumption)

**Claim:** As designed, a separate view `daily_prcnt_gap(tdate, symbol, gap_days)` is created to expose days since the previous positive close, allowing downstream consumers to filter by gap length.

**Original request:** Schema specified as `DAILY_PRCNT(TDATE, SYMBOL, PRCNT)` (three columns)

**Alignment question:** Is the gap view part of the required deliverable, or an optional supplementary view? The three-column schema specification does not include gap information; the gap view is a separate artifact added to enable filtering behavior mentioned in research but not the original request.

## Deferred to Existing Resolutions

The design's "Open Artifact Decisions" section documents file organization and naming (one file vs. per-object, view names, shell vs. vitest test). These do not affect intent alignment.

## Cross-Reference Notes

Research.md explicitly identifies gap and orphaned-event handling as "Open for the human (confirm the recommendation above, or choose differently)." The design implements research's recommended approach (CRSP-style: compute across gaps, apply orphaned events to next trading row) without documenting human confirmation of this choice.

Test coverage for orphaned splits (AA-V) and gap behavior is comprehensive and consistent with design intent, but the original prompt does not explicitly request these cases.

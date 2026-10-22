#!/bin/sh
# Feature test for DAILY_PRCNT. Run from hw4/ with the cts-pg container up (see load.sh).
# Applies db/daily_prcnt.sql, then asserts known answers and invariants. Exits nonzero on first failure.
set -e
PSQL="docker exec -i cts-pg psql -U postgres -d cts -v ON_ERROR_STOP=1 -tA"
$PSQL -f /db/daily_prcnt.sql >/dev/null

check() { # name, sql returning 't' when the assertion holds
  if [ "$($PSQL -c "$2")" = "t" ]; then echo "ok   $1"; else echo "FAIL $1"; exit 1; fi
}
pct() { # symbol, date -> prcnt rounded to 2 places
  echo "(select round(prcnt, 2) from daily_prcnt where symbol = '$1' and tdate = '$2')"
}

# Split on the trading day: raw close roughly halves, adjusted return does not.
check "AAPL 1987-06-16 2:1 split"        "select $(pct AAPL 1987-06-16) = 5.73"
check "AAPL 2000-06-21 2:1 split"        "select $(pct AAPL 2000-06-21) = 9.89"
check "AAPL 2005-02-28 2:1 split"        "select $(pct AAPL 2005-02-28) = 0.82"
# Dividend ex-date added back to today's close.
check "AAPL 2012-08-09 dividend 2.65"    "select $(pct AAPL 2012-08-09) = 0.57"
check "KO 2012-08-13 split"              "select $(pct KO 2012-08-13) = -0.24"
# Orphaned reverse split 1:10 on 2009-03-31 (no price row); closes 0.04 then 0.35 apply to 2009-04-01.
check "AA-V orphaned split to next row"  "select $(pct AA-V 2009-04-01) = -12.50"
# Invariants.
check "no row on a symbol's first date"  "select not exists (select 1 from daily_prcnt where symbol = 'AAPL' and tdate = (select min(tdate) from cts where symbol = 'AAPL'))"
check "no row on a zero-close date"      "select not exists (select 1 from daily_prcnt d join cts c using (tdate, symbol) where c.close = 0 and d.symbol < 'AB')"
check "one row per symbol and date"      "select count(*) = count(distinct (tdate, symbol)) from daily_prcnt where symbol = 'AAPL'"
check "columns are tdate, symbol, prcnt" "select string_agg(column_name, ',' order by ordinal_position) = 'tdate,symbol,prcnt' from information_schema.columns where table_name = 'daily_prcnt'"
echo "all passed"

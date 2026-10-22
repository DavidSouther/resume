# Trailing stop-loss simulation

Compares a daily and a monthly 20 percent trailing stop-loss on a one-asset portfolio that starts with $10,000. Data is the hw4 `cts` set, which ends 2014-01-14.

## Use

```sh
sh db/load.sh                                          # Postgres in docker with the cts data
docker exec -i cts-pg psql -U postgres -d cts -f /dev/stdin < stop_loss/prep.sql   # build sl_px, about 2 minutes
python3 -m unittest stop_loss.test_simulate            # feature test, no database needed
python3 -m stop_loss.run                               # 3 strategies x 5 starts x {daily, monthly, no stop}, writes results.csv
python3 -m stop_loss.report                            # prints the table below
```

`simulate(db, start, strategy, mode, params)` in `simulate.py` takes a starting date and a purchase strategy, as requested. `mode` is `daily`, `monthly`, or `none` (control).

## Rules

- Buy at the open of the first row after the decision date. Sell at the open of the row after a stop triggers. Reinvest the proceeds at that same open, in the strategy's pick as of the trigger date, excluding the symbol just sold. Volume impact is ignored.
- Peak is the highest daily close since purchase, starting at the purchase price. A stop triggers when a close is below 80 percent of peak. Daily checks every row. Monthly checks only on the first row at or after 30, 60, 90, ... days from the purchase date, and the clock restarts at each purchase.
- Taxes: gains on positions held 365 days or less at 32 percent, longer at 15 percent. Net losses carry forward against later gains. Dividends are taxed at 15 percent on receipt and held as cash until the next purchase. No state tax, no wash-sale rule.
- Final value liquidates the last position at the final close and pays tax on it.
- A position whose price series ends early is sold at its last close and reinvested.
- Prices are split adjusted. Dividends join on the exact ex-date only.

## Purchase strategies

Each ranks eligible symbols with data through the decision date.

| Strategy | Pick |
|---|---|
| momentum | Highest trailing 252-row return. |
| lowvol | Lowest 252-row standard deviation of daily returns, with a floor of 0.8 percent so cash-like ETFs are not chosen. |
| liquid | Highest 60-row average dollar volume. |

Eligible: close at least $5, 60-row average dollar volume at least $5M, 253 rows of history, no gap over 7 days, no one-day spike-and-reverse anywhere in the symbol's history, no dash-suffixed symbols, and no index or foreign-quoted symbols from an explicit list in `prep.sql`.

Start dates: 1995-01-03, 2000-01-03, 2003-01-02, 2007-01-03, 2010-01-04.

## Results (final after-tax value of $10,000)

| Strategy | Start | Daily | Monthly | No stop | Daily stops | Monthly stops | Daily tax | Monthly tax |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| momentum | 1995-01-03 | 393,489 | 1,102,722 | 74,463 | 41 | 23 | 110,302 | 310,656 |
| momentum | 2000-01-03 | 27,256 | 18,637 | 9,275 | 16 | 12 | 3,261 | 1,643 |
| momentum | 2003-01-02 | 47,865 | 55,294 | 94,998 | 3 | 4 | 6,987 | 8,486 |
| momentum | 2007-01-03 | 10,243 | 10,068 | 9,997 | 2 | 2 | 275 | 270 |
| momentum | 2010-01-04 | 13,515 | 4,799 | 28,475 | 6 | 5 | 681 | 9 |
| lowvol | 1995-01-03 | 40,408 | 72,707 | 41,015 | 6 | 4 | 6,927 | 14,714 |
| lowvol | 2000-01-03 | 26,728 | 22,862 | 26,654 | 3 | 2 | 3,985 | 2,663 |
| lowvol | 2003-01-02 | 15,895 | 16,265 | 20,523 | 5 | 3 | 1,813 | 1,997 |
| lowvol | 2007-01-03 | 7,363 | 6,209 | 3,965 | 4 | 3 | 89 | 95 |
| lowvol | 2010-01-04 | 9,644 | 9,644 | 9,644 | 0 | 0 | 3 | 3 |
| liquid | 1995-01-03 | 31,444 | 167,323 | 68,242 | 29 | 11 | 20,715 | 29,661 |
| liquid | 2000-01-03 | 3,752 | 9,898 | 9,181 | 22 | 12 | 50 | 113 |
| liquid | 2003-01-02 | 17,698 | 11,595 | 15,653 | 6 | 5 | 1,365 | 420 |
| liquid | 2007-01-03 | 14,313 | 14,544 | 13,654 | 5 | 3 | 766 | 807 |
| liquid | 2010-01-04 | 16,087 | 16,087 | 16,087 | 0 | 0 | 1,080 | 1,080 |

- Monthly beat daily in 7 of 15 start and strategy pairs.
- Daily beat no stop in 7 of 15; monthly beat no stop in 8 of 15.
- Median final value ratio, monthly over daily: 1.00. Daily over no stop: 1.00. Monthly over no stop: 1.01.

## Reading the results

- Neither rule dominates. Monthly evaluation helps mostly where the stop would have fired on a short-lived dip, because daily evaluation sells and re-enters at a worse price and pays tax each time. Daily evaluation helps when a drop keeps going, as in the 2000, 2003 and 2010 momentum runs.
- Final values from 1995 are dominated by a few holdings during 1998 to 2000 and are sensitive to which stock the strategy picks on each reinvestment. 15 scenarios per mode is too few to call a winner.
- Taxes are a large share of gains in the high-return runs (for example momentum 1995 monthly).

## Not verified

- Eligibility lists were built by inspection of top dollar-volume symbols. Some index, foreign, or ETF symbols may remain, and ETFs are treated as investable.
- Sample trades were not compared with an external adjusted-price source. Symbol PDR trades near 24,500 per share in adjusted units after reverse splits.
- Orphaned dividends are dropped. Tax rates are assumptions, not a tax computation.
- Reinvesting into a stock bought the day the data ends (for example TNA) is an artifact of series ending.

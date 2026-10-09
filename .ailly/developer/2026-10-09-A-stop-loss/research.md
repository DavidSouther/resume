# Research: trailing stop-loss simulation

Quick loop. Source prompt: .ailly/prompts/stop_loss.md.

## Data (hw4 Postgres, container cts-pg, port 5433)

- cts: 1950-01-03 to 2014-01-14, 24k symbols, unadjusted OHLCV. 234k rows have open <= 0 or null. Roughly 1,000 symbols trade by 1987, 2,000 by 1992.
- splits (post, pre) and dividend (ex-date amount) tables. Prices are unadjusted, so splits are folded into an adjustment factor f(t) = product of pre/post for splits dated after t.
- daily_prcnt views from the previous session exist but the simulation needs open prices, so it builds its own adjusted series.
- 2,301 symbols average more than $20M daily dollar volume. That is the investable universe.

## Decisions (made without review, quick loop)

- One asset at a time, all cash invested.
- Peak is the highest daily close since purchase (the purchase price is the initial peak). Daily rule: sell when close < 0.8 * peak. Monthly rule: same peak, evaluated only on the first row at or after each 30 day multiple from purchase. Orders fill at the next row open.
- Taxes: gain held 365 days or less taxed at 32 percent, longer at 15 percent. Net losses carry forward against later gains. Dividends taxed at 15 percent when received. No state tax.
- Strategies rank eligible symbols using data through the decision date: momentum (best trailing 252-row return), low volatility (lowest 252-row return stdev), liquidity (highest 60-row average dollar volume).
- Eligible: price at least $5, 60-row average dollar volume at least $5M, 252 prior rows, positive next open, no one-day spike-and-reverse glitch anywhere in the symbol's history.
- Start dates: 1995-01-03, 2000-01-03, 2003-01-02, 2007-01-03, 2010-01-04. Run until 2014-01-14. A no-stop control per strategy and start date is added for comparison.
- Reinvest: re-run the same strategy at the trigger date, excluding the symbol just sold.

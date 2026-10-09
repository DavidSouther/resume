# Design: trailing stop-loss simulator

Python 3 stdlib program in pages/course/cisc_7510/hw4/stop_loss/. SQL prep builds table sl_px (adjusted daily series with ranking features) in cts-pg. simulate.py takes a start date and a purchase strategy, and runs daily and monthly 20 percent trailing stop-loss variants, writing results.csv and results.md.

Core is pure: simulate(db, start, strategy, mode) where db offers pick(strategy, asof, exclude) and series(symbol). A fake db drives the feature test.

## Feature Test

Path: pages/course/cisc_7510/hw4/stop_loss/test_simulate.py. Run from hw4/ with python3 -m unittest stop_loss.test_simulate.

Story: given a synthetic symbol that rises to 150, then falls to 110 on a day that is not a month end, a daily run sells at the next open after the first close below 120 and a monthly run sells only after the following month-end close. Sale proceeds are taxed at the short-term rate within 365 days and the long-term rate after. Losses carry forward. The proceeds are reinvested in the pick excluding the sold symbol at the same open. A no-stop run never sells. Currently red: simulate.py does not exist.

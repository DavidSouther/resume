"""Trailing stop-loss simulation. One asset held at a time, all cash invested.

db interface: calendar() -> sorted dates, series(symbol) -> [(date, open, close, dividend)]
adjusted for splits, pick(strategy, asof, exclude) -> symbol or None.
mode: "daily" and "monthly" (every 30 days from purchase) evaluate the trailing stop, "none" never sells (control).
"""
from bisect import bisect_left, bisect_right
from dataclasses import dataclass, field
from datetime import date


@dataclass
class Params:
    stop: float = 0.20
    st_rate: float = 0.32
    lt_rate: float = 0.15
    div_rate: float = 0.15
    cash: float = 10_000.0
    long_days: int = 365
    monthly_days: int = 30


@dataclass
class Trade:
    symbol: str
    buy_date: date
    buy_price: float
    sell_date: date
    sell_price: float
    shares: float
    gain: float
    tax: float
    reason: str


@dataclass
class Result:
    trades: list = field(default_factory=list)
    final_value: float = 0.0
    div_tax: float = 0.0

    @property
    def taxes_paid(self):
        return self.div_tax + sum(t.tax for t in self.trades)


def settle(gain, days_held, pool, p):
    """Tax on a realized gain given a loss carryforward pool. Returns (tax, new pool)."""
    if gain <= 0:
        return 0.0, pool - gain
    used = min(pool, gain)
    rate = p.lt_rate if days_held > p.long_days else p.st_rate
    return (gain - used) * rate, pool - used


def simulate(db, start, strategy, mode, p):
    cal = db.calendar()
    end = cal[-1]
    res = Result()
    cash, pool, asof, exclude = p.cash, 0.0, start, set()
    while True:
        bought = None
        for d in cal[bisect_left(cal, asof):]:
            if d >= end:
                break
            sym = db.pick(strategy, d, exclude)
            if sym is None:
                continue
            rows = db.series(sym)
            i = bisect_right([r[0] for r in rows], d)
            if i < len(rows):
                bought = (sym, rows, i)
                break
        if bought is None:
            res.final_value = cash
            return res
        sym, rows, i = bought
        buy_date, buy_price = rows[i][0], rows[i][1]
        shares, cost, cash, peak = cash / buy_price, cash, 0.0, buy_price
        checks = 1  # monthly mode evaluates on the first row at or after buy_date + checks * monthly_days
        sell = None
        for j in range(i, len(rows)):
            d, o, c, div = rows[j]
            if j > i and div:
                net = shares * div * (1 - p.div_rate)
                cash += net
                res.div_tax += shares * div * p.div_rate
            peak = max(peak, c)
            if j == len(rows) - 1:
                sell = (d, c, "end" if d >= end else "delisted")
                break
            due = (d - buy_date).days >= checks * p.monthly_days
            if due:
                checks = (d - buy_date).days // p.monthly_days + 1
            if mode != "none" and (mode == "daily" or due) and c < peak * (1 - p.stop):
                sell = (rows[j + 1][0], rows[j + 1][1], "stop")
                trigger = d
                break
        sell_date, sell_price, reason = sell
        proceeds = shares * sell_price
        gain = proceeds - cost
        tax, pool = settle(gain, (sell_date - buy_date).days, pool, p)
        cash += proceeds - tax
        res.trades.append(Trade(sym, buy_date, buy_price, sell_date, sell_price, shares, gain, tax, reason))
        if reason == "end":
            res.final_value = cash
            return res
        asof = trigger if reason == "stop" else sell_date
        exclude = {sym}

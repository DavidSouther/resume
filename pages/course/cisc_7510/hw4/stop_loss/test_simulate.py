import unittest
from datetime import date

from stop_loss.simulate import Params, settle, simulate

D = lambda m, d: date(2020, m, d)

AAA = [
    (D(1, 3), 100, 100, 0),
    (D(1, 10), 100, 150, 0),
    (D(1, 15), 150, 150, 0),
    (D(1, 16), 149, 119, 0),
    (D(1, 17), 118, 118, 0),
    (D(1, 31), 117, 117, 0),
    (D(2, 3), 116, 116, 0),
    (D(2, 28), 116, 117, 0),
]
BBB = [(d, 50, 50, 0) for d in (D(1, 17), D(1, 31), D(2, 3), D(2, 28))]
CAL = [D(1, 2)] + sorted({r[0] for r in AAA})


class FakeDb:
    def __init__(self, series, order):
        self._series, self._order = series, order

    def calendar(self):
        return CAL

    def series(self, symbol):
        return self._series[symbol]

    def pick(self, strategy, asof, exclude):
        for s in self._order:
            if s not in exclude:
                return s
        return None


class SettleTest(unittest.TestCase):
    def test_short_long_and_carryforward(self):
        p = Params()
        self.assertEqual(settle(1000, 30, 0, p), (320, 0))
        self.assertEqual(settle(1000, 366, 0, p), (150, 0))
        self.assertEqual(settle(-500, 30, 0, p), (0, 500))
        self.assertEqual(settle(1000, 30, 500, p), (160, 0))


class SimulateTest(unittest.TestCase):
    def run_mode(self, mode, series=None, order=("AAA", "BBB")):
        db = FakeDb(series or {"AAA": AAA, "BBB": BBB}, order)
        return simulate(db, D(1, 2), "any", mode, Params())

    def test_daily_sells_at_next_open_and_reinvests(self):
        r = self.run_mode("daily")
        t = r.trades[0]
        self.assertEqual((t.symbol, t.sell_date, t.sell_price), ("AAA", D(1, 17), 118))
        self.assertAlmostEqual(t.tax, 576)
        self.assertEqual(r.trades[1].symbol, "BBB")
        self.assertEqual(r.trades[1].buy_price, 50)
        self.assertAlmostEqual(r.final_value, 11224)

    def test_monthly_waits_thirty_days_from_purchase(self):
        r = self.run_mode("monthly")
        t = r.trades[0]
        self.assertEqual((t.sell_date, t.sell_price), (D(2, 28), 116))
        self.assertAlmostEqual(r.final_value, 11088)

    def test_no_stop_holds_to_end(self):
        r = self.run_mode("none", order=("AAA",))
        self.assertEqual(len(r.trades), 1)
        self.assertAlmostEqual(r.final_value, 11156)

    def test_dividend_taxed_at_fifteen_percent(self):
        c = [(D(1, 3), 100, 100, 0), (D(1, 10), 100, 100, 1), (D(2, 28), 100, 100, 0)]
        r = self.run_mode("none", series={"AAA": c}, order=("AAA",))
        self.assertAlmostEqual(r.final_value, 10085)


if __name__ == "__main__":
    unittest.main()

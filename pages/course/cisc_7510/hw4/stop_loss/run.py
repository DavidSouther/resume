"""Run 3 strategies x 5 start dates x {daily, monthly} stop-loss, plus a no-stop control. Writes results.csv."""
import csv
import sys
from datetime import date

from stop_loss.pgdb import PgDb
from stop_loss.simulate import Params, simulate

STRATEGIES = ["momentum", "lowvol", "liquid"]
STARTS = [date(1995, 1, 3), date(2000, 1, 3), date(2003, 1, 2), date(2007, 1, 3), date(2010, 1, 4)]
MODES = ["daily", "monthly", "none"]


def main(out="stop_loss/results.csv"):
    db, p = PgDb(), Params()
    rows = []
    for strategy in STRATEGIES:
        for start in STARTS:
            for mode in MODES:
                r = simulate(db, start, strategy, mode, p)
                stops = [t for t in r.trades if t.reason == "stop"]
                rows.append({
                    "strategy": strategy, "start": start, "mode": mode,
                    "final_value": round(r.final_value, 2), "taxes_paid": round(r.taxes_paid, 2),
                    "trades": len(r.trades), "stops": len(stops),
                    "first_symbol": r.trades[0].symbol if r.trades else "",
                    "symbols": " ".join(t.symbol for t in r.trades[:12]),
                })
                print(rows[-1], flush=True)
    with open(out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)


if __name__ == "__main__":
    main(*sys.argv[1:])

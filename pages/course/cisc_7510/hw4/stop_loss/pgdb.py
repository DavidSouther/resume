"""Postgres adapter for simulate.py. Talks to the cts-pg container through docker exec psql."""
import csv
import io
import subprocess
from datetime import date

WHERE = {"lowvol": "AND vol >= 0.008"}  # floor excludes cash-like ETFs, so the strategy picks low volatility equities
ORDER = {
    "momentum": "mom DESC",
    "lowvol": "vol ASC",
    "liquid": "adv60 DESC",
}


def query(sql):
    out = subprocess.run(
        ["docker", "exec", "-i", "cts-pg", "psql", "-U", "postgres", "-d", "cts", "-X", "-v", "ON_ERROR_STOP=1",
         "-c", f"COPY ({sql}) TO STDOUT WITH CSV"],
        check=True, capture_output=True, text=True,
    ).stdout
    return list(csv.reader(io.StringIO(out)))


class PgDb:
    def __init__(self):
        self._series, self._cal, self._picks = {}, None, {}

    def calendar(self):
        if self._cal is None:
            self._cal = [date.fromisoformat(r[0]) for r in query("SELECT DISTINCT tdate FROM sl_px ORDER BY 1")]
        return self._cal

    def series(self, symbol):
        if symbol not in self._series:
            rows = query(f"SELECT tdate, o, c, d FROM sl_px WHERE symbol = '{symbol}' ORDER BY tdate")
            self._series[symbol] = [(date.fromisoformat(a), float(o), float(c), float(d)) for a, o, c, d in rows]
        return self._series[symbol]

    def pick(self, strategy, asof, exclude):
        key = (strategy, asof, tuple(sorted(exclude)))
        if key not in self._picks:
            ex = ",".join(f"'{s}'" for s in exclude) or "''"
            rows = query(
                f"SELECT symbol FROM sl_px WHERE tdate = '{asof}' AND ok AND symbol NOT IN ({ex}) {WHERE.get(strategy, '')} "
                f"ORDER BY {ORDER[strategy]}, symbol LIMIT 1"
            )
            self._picks[key] = rows[0][0] if rows else None
        return self._picks[key]

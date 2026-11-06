#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = ["duckdb>=1.4", "numpy>=2"]
# ///
"""Build <out>/elections.duckdb from the pulled CSVs in <data> and write the answer CSVs under <data>/answers/.

Run: `uv run analyze.py` after `uv run pull.py`.
The SQL lives in sql/, one file per view or answer, and each file runs by hand in the DuckDB CLI against the built database.
Question 2 is fit here with numpy, on the incumbency_input view from sql/30_incumbency_view.sql.
"""

import argparse
import math
import sys
import time
from collections.abc import Sequence
from pathlib import Path
from typing import Any

import duckdb
import numpy as np
from numpy.typing import NDArray

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from lib.output import write_csvs  # noqa: E402

SQL = HERE / "sql"
DATA = HERE / "data"
MIN_SEATS = 5
FIRST_YEAR = 2014
LAST_YEAR = 2026

SETUP_SQL = ("00_views.sql", "10_seat_prior.sql", "30_incumbency_view.sql", "40_turnout_k.sql")
ANSWER_SQL = {
    "seat_change_2026.csv": "20_seat_change_2026.sql",
    "seat_change_2026_by_lean.csv": "22_seat_change_by_lean.sql",
    "turnout_k.csv": "45_turnout_plausibility.sql",
    "dummymander.csv": "50_dummymander.sql",
}
LEANS = {
    "presidential_lean": ("incumbency_presidential_lean", ("red", "blue", "swing")),
}
OFFICES = ("house", "senate", "governor")

Row = dict[str, Any]
Matrix = NDArray[np.float64]


def build_database(out: Path, data: Path = DATA) -> duckdb.DuckDBPyConnection:
    """Opens `<out>/elections.duckdb`, loads the CSVs from `data` and `data/overrides`, and creates the views of the setup SQL files."""
    out.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(out / "elections.duckdb"))
    con.execute(f"set file_search_path = '{_quote(data.resolve())},{_quote((data / "overrides").resolve())}'")
    for name in SETUP_SQL:
        con.execute((SQL / name).read_text())
    return con


def run_sql_answer(con: duckdb.DuckDBPyConnection, sql_file: Path, answer: Path) -> None:
    """Writes the select in `sql_file` to the CSV `answer`, with a header, lowercase booleans, and empty cells for nulls."""
    select = sql_file.read_text().strip().rstrip(";")
    answer.parent.mkdir(parents=True, exist_ok=True)
    con.execute(f"copy ({select}) to '{_quote(answer)}' (header, delimiter ',')")


def fit_incumbency(rows: Sequence[Row], min_seats: int = MIN_SEATS) -> list[Row]:
    """Fits the incumbency regression for one office, lean group, and year scope, and returns the DEM, REP, and ALL rows.

    Each row of `rows` holds year, dem_share and prior_dem_share (points of the two party vote), prior_winner_dem, inc_dem, inc_rep,
    and incumbent_party. With more than one year among the rows the fit has year effects, so the caller's pooled scope gets them.
    The dependent variable is dem_share, on an intercept, prior_dem_share, prior_winner_dem, the year effects, and the two incumbent
    indicators, so open seats are the baseline. regression_bonus is in the incumbent party's own sign: beta_D for DEM, minus beta_R
    for REP, and the signed term's coefficient (+1 Democratic incumbent, minus 1 Republican incumbent) from a second fit for ALL.
    A row below `min_seats` seats has a null bonus and cross check. The Wald test of equal bonuses compares the DEM and REP bonuses
    (wald_diff is the DEM bonus minus the REP bonus), is repeated on all three rows, and is null when either party row is null.
    """
    inc_dem = np.array([bool(r["inc_dem"]) for r in rows], dtype=np.float64)
    inc_rep = np.array([bool(r["inc_rep"]) for r in rows], dtype=np.float64)
    seats = {"DEM": int(inc_dem.sum()), "REP": int(inc_rep.sum())}
    seats["ALL"] = seats["DEM"] + seats["REP"]
    result: dict[str, Row] = {
        party: {
            "incumbent_party": party,
            "regression_bonus": None,
            "cross_check_bonus": None,
            "seats": seats[party],
            "races": len(rows),
            "wald_diff": None,
            "wald_se": None,
            "wald_p": None,
        }
        for party in ("DEM", "REP", "ALL")
    }
    if rows:
        y = np.array([float(r["dem_share"]) for r in rows], dtype=np.float64)
        controls = _controls(rows)
        split = _ols(y, [*controls, ("inc_dem", inc_dem), ("inc_rep", inc_rep)])
        signed = _ols(y, [*controls, ("signed", inc_dem - inc_rep)])
        if split is not None:
            beta, cov = split
            if "inc_dem" in beta:
                result["DEM"]["regression_bonus"] = beta["inc_dem"]
            if "inc_rep" in beta:
                result["REP"]["regression_bonus"] = -beta["inc_rep"]
            if "inc_dem" in beta and "inc_rep" in beta and cov is not None:
                diff = beta["inc_dem"] + beta["inc_rep"]  # the DEM bonus minus the REP bonus
                variance = cov[("inc_dem", "inc_dem")] + cov[("inc_rep", "inc_rep")] + 2 * cov[("inc_dem", "inc_rep")]
                se = math.sqrt(max(variance, 0.0))
                p = math.erfc(abs(diff / se) / math.sqrt(2)) if se > 0 else (1.0 if diff == 0 else 0.0)
                for row in result.values():
                    row.update(wald_diff=diff, wald_se=se, wald_p=p)
        if signed is not None and "signed" in signed[0]:
            result["ALL"]["regression_bonus"] = signed[0]["signed"]
        crosses = _cross_checks(rows)
        for party, row in result.items():
            row["cross_check_bonus"] = crosses[party]
    for row in result.values():
        if row["seats"] < min_seats:
            row["regression_bonus"] = None
            row["cross_check_bonus"] = None
    if result["DEM"]["regression_bonus"] is None or result["REP"]["regression_bonus"] is None:
        for row in result.values():
            row.update(wald_diff=None, wald_se=None, wald_p=None)
    return [result["DEM"], result["REP"], result["ALL"]]


def write_incumbency(con: duckdb.DuckDBPyConnection, data: Path) -> None:
    """Writes `<data>/answers/incumbency_presidential_lean.csv`.

    Every office, lean group, incumbent party, and year scope has a row: `pooled` fits 2014 to 2026 with year effects, and each
    election year (every even year, plus the odd years with governor races) fits that year alone.
    """
    cursor = con.execute("select * from incumbency_input")
    names = [d[0] for d in cursor.description]
    rows: list[Row] = [dict(zip(names, values, strict=True)) for values in cursor.fetchall()]
    for column, (name, groups) in LEANS.items():
        table: list[object] = []
        for office in OFFICES:
            in_office = [r for r in rows if r["office"] == office]
            years = sorted({*range(FIRST_YEAR, LAST_YEAR + 1, 2), *(int(r["year"]) for r in in_office)})
            for lean in groups:
                group = [r for r in in_office if r[column] == lean]
                scopes: list[tuple[str, list[Row]]] = [("pooled", group), *((str(y), [r for r in group if r["year"] == y]) for y in years)]
                for scope, scoped in scopes:
                    for fitted in fit_incumbency(scoped):
                        table.append({"office": office, "lean": lean, "year_scope": scope, **fitted})
        write_csvs(data / "answers", **{name: table})


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build elections.duckdb and the answer CSVs from the pulled CSVs.")
    parser.add_argument("--data", type=Path, default=DATA, help="folder holding the pulled CSVs and overrides/; the answers are written to its answers/ (default data/)")
    parser.add_argument("--out", type=Path, default=HERE / "out", help="folder for elections.duckdb (default out/)")
    args = parser.parse_args(argv)
    out: Path = args.out
    started = time.monotonic()
    try:
        con = build_database(out, args.data)
    except duckdb.IOException as e:
        print(f"analyze.py: cannot read the pulled CSVs in {args.data} ({e}). Run `uv run pull.py --data {args.data}` first.", file=sys.stderr)
        return 1
    try:
        for answer, sql_file in ANSWER_SQL.items():
            run_sql_answer(con, SQL / sql_file, args.data / "answers" / answer)
        write_incumbency(con, args.data)
    finally:
        con.close()
    print(f"{out / 'elections.duckdb'} and {len(ANSWER_SQL) + len(LEANS)} answer files in {time.monotonic() - started:.1f}s")
    return 0


def _controls(rows: Sequence[Row]) -> list[tuple[str, Matrix]]:
    columns: list[tuple[str, Matrix]] = [
        ("intercept", np.ones(len(rows), dtype=np.float64)),
        ("prior_dem_share", np.array([float(r["prior_dem_share"]) for r in rows], dtype=np.float64)),
        ("prior_winner_dem", np.array([bool(r["prior_winner_dem"]) for r in rows], dtype=np.float64)),
    ]
    years = sorted({int(r["year"]) for r in rows})
    for year in years[1:]:
        columns.append((f"year_{year}", np.array([int(r["year"]) == year for r in rows], dtype=np.float64)))
    return columns


def _ols(y: Matrix, columns: list[tuple[str, Matrix]]) -> tuple[dict[str, float], dict[tuple[str, str], float] | None] | None:
    """Ordinary least squares on the columns that add rank, in order, so a collinear column drops out instead of breaking the fit.

    Returns the coefficients by column name and their covariance (null with no residual degrees of freedom), or None with no rows.
    """
    if len(y) == 0:
        return None
    kept: list[tuple[str, Matrix]] = []
    for name, column in columns:
        trial = np.column_stack([c for _, c in kept] + [column])
        if np.linalg.matrix_rank(trial) > len(kept):
            kept.append((name, column))
    x = np.column_stack([c for _, c in kept])
    beta, *_ = np.linalg.lstsq(x, y, rcond=None)
    coefficients = {name: float(b) for (name, _), b in zip(kept, beta, strict=True)}
    dof = len(y) - len(kept)
    if dof <= 0:
        return coefficients, None
    residual = y - x @ beta
    sigma2 = float(residual @ residual) / dof
    inverse = np.linalg.inv(x.T @ x) * sigma2
    covariance = {(a, b): float(inverse[i, j]) for i, (a, _) in enumerate(kept) for j, (b, _) in enumerate(kept)}
    return coefficients, covariance


def _cross_checks(rows: Sequence[Row]) -> dict[str, float | None]:
    """The mean change in the defending party's two party share with its incumbent running, minus the mean for its open seats."""

    def change(r: Row) -> float:
        delta = float(r["dem_share"]) - float(r["prior_dem_share"])
        return delta if r["incumbent_party"] == "DEM" else -delta

    def gap(running: list[Row], open_: list[Row]) -> float | None:
        if not running or not open_:
            return None
        return sum(map(change, running)) / len(running) - sum(map(change, open_)) / len(open_)

    open_seats = [r for r in rows if not r["inc_dem"] and not r["inc_rep"]]
    by_party = {party: ([r for r in rows if r["inc_dem" if party == "DEM" else "inc_rep"]], [r for r in open_seats if r["incumbent_party"] == party]) for party in ("DEM", "REP")}
    return {
        "DEM": gap(*by_party["DEM"]),
        "REP": gap(*by_party["REP"]),
        "ALL": gap(by_party["DEM"][0] + by_party["REP"][0], by_party["DEM"][1] + by_party["REP"][1]),
    }


def _quote(path: Path) -> str:
    return str(path).replace("'", "''")


if __name__ == "__main__":
    sys.exit(main())

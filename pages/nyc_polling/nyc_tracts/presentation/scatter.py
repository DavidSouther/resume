"""Data for the poverty by distance scatter page: one point per tract district and the regression curves.

The page draws it with Plotly. Fitting stays here, so the page only plots numbers."""

import csv
import json
import os
from collections.abc import Sequence
from typing import Any

from ..disparity_hypotheses.hypotheses import poverty_regression
from ..geography.tract_district import TractDistrict

OUT = "nyc_scatter.json"
CSV_OUT = "nyc_tract_districts.csv"
CSV_COLUMNS = ["geoid", "borough", "election_district", "site", "site_in_tract", "miles", "poverty_pct", "poverty_moe_pct", "median_income_usd", "population"]
LABELS = {1: "Linear", 2: "Quadratic", 3: "Cubic"}
CURVE_POINTS = 101


def build_scatter(pieces: Sequence[TractDistrict]) -> dict[str, Any]:
    pov = [s for s in pieces if s.tract.poverty is not None]
    regression = poverty_regression([s.observation() for s in pov])
    x_max = max([100.0, *(s.tract.poverty for s in pov if s.tract.poverty is not None)])
    xs = [round(x_max * i / (CURVE_POINTS - 1), 2) for i in range(CURVE_POINTS)]
    return {
        "n": regression.n,
        "points": {
            "geoid": [s.tract.geoid for s in pov],
            "electDist": [s.elect_dist for s in pov],
            "poverty": [round(s.tract.poverty, 1) for s in pov if s.tract.poverty is not None],
            "miles": [round(s.miles, 3) for s in pov],
        },
        "fits": [
            {
                "degree": f.degree,
                "label": LABELS[f.degree],
                "r2": f.r2,
                "adjR2": f.adj_r2,
                "bic": f.bic,
                "vertex": f.vertex,
                "x": xs,
                "y": [round(f.predict(x), 4) for x in xs],
            }
            for f in regression.fits
        ],
        "tests": regression.tests,
        "bestByBic": regression.best_by_bic,
    }


def write_scatter(pieces: Sequence[TractDistrict], out_dir: str) -> int:
    """Write nyc_scatter.json to out_dir and return its number of points."""
    data = build_scatter(pieces)
    with open(os.path.join(out_dir, OUT), "w", encoding="utf-8") as fh:
        json.dump(data, fh, separators=(",", ":"))
    return data["n"]


def csv_rows(pieces: Sequence[TractDistrict]) -> list[list[object]]:
    """One row per tract district, in tract and election district order. A missing value is an empty cell."""

    def cell(v: object) -> object:
        return "" if v is None else v

    return [
        [
            s.tract.geoid,
            cell(s.tract.borough),
            s.elect_dist,
            s.site.name,
            int(s.site_in_tract),
            round(s.miles, 4),
            cell(s.tract.poverty),
            cell(s.tract.poverty_moe),
            cell(None if s.tract.income is None else round(s.tract.income)),
            cell(None if s.tract.population is None else round(s.tract.population)),
        ]
        for s in sorted(pieces, key=lambda s: (s.tract.geoid, s.elect_dist))
    ]


def write_csv(pieces: Sequence[TractDistrict], out_dir: str) -> int:
    """Write nyc_tract_districts.csv to out_dir, for download, and return its number of rows."""
    rows = csv_rows(pieces)
    with open(os.path.join(out_dir, CSV_OUT), "w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(CSV_COLUMNS)
        writer.writerows(rows)
    return len(rows)

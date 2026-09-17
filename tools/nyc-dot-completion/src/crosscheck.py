"""Step 4: cross-check the bike-route-inventory-derived protected-lane
figure against DOT testimony, and note the TransAlt tracker gap.

Never picks one figure over another — every mismatch (or unit mismatch)
is a printed warning, left for a human (or build_table.py's confidence
column) to resolve. Uses DuckDB SQL for the by-year aggregation; no
pandas.
"""

from __future__ import annotations

from pathlib import Path

import duckdb
import yaml

from aggregate import load_config

CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "output"


def bike_route_derived_counts_by_year() -> dict[int, float] | None:
    """Protected bike-lane segment count per calendar year, independent of
    administration-window bucketing, so it can be matched against a
    testimony figure stated per calendar year. Unit is segments, NOT
    miles — testimony reports miles, so any match here is a trend sanity
    check, never a unit-for-unit comparison; main() prints that caveat
    on every line."""
    classified_path = OUTPUT_DIR / "bike_routes_classified.csv"
    if not classified_path.exists():
        return None

    config = load_config()
    date_field = config["datasets"]["bike_routes"]["date_field"]

    con = duckdb.connect()
    rows = con.execute(
        f"""
        SELECT extract(year FROM {date_field}::DATE) AS yr, count(*) AS n
        FROM read_csv_auto('{classified_path}')
        WHERE category = 'bike_lane_install'
        GROUP BY yr
        ORDER BY yr
        """
    ).fetchall()
    return {int(yr): float(n) for yr, n in rows}


def main() -> None:
    testimony = yaml.safe_load((CONFIG_DIR / "testimony.yaml").read_text(encoding="utf-8"))
    by_year = bike_route_derived_counts_by_year()

    if by_year is None:
        print(
            "No classified bike route data cached yet — run "
            "pull_bike_routes.py and classify.py before cross-checking "
            "against testimony."
        )
    else:
        for doc_key, doc in testimony["documents"].items():
            if not doc.get("url_verified"):
                print(
                    f"WARNING: {doc['filename']} URL not verified to resolve "
                    f"— confirm before citing ({doc['url']})."
                )
            for figure in doc.get("figures", []):
                year = figure.get("calendar_year")
                if year is None:
                    print(
                        f"  {doc_key}: '{figure['metric']}' figure "
                        f"({figure['value_mi']} mi) has no calendar year — "
                        f"cannot be matched against a bike-route-derived "
                        f"total. {figure.get('note', '')}"
                    )
                    continue
                derived_value = by_year.get(year)
                if derived_value is None:
                    print(
                        f"  {doc_key}, {year}: testimony says "
                        f"{figure['value_mi']} mi; no bike-route-derived "
                        f"figure available for that year in the current "
                        f"cache."
                    )
                    continue
                print(
                    f"  [unit mismatch — trend check only] {doc_key}, {year}: "
                    f"testimony={figure['value_mi']} mi installed, "
                    f"bike-route-inventory-derived={derived_value:.0f} "
                    f"protected segments installed. Different units (miles "
                    f"vs. segment count), not directly comparable — this "
                    f"pipeline does not compute a lane-mile figure (see "
                    f"sources.yaml bike_routes.role)."
                )

    print(
        "\nTransAlt tracker cross-check: unavailable. "
        "No public API was found for projects.transalt.org as of authoring "
        "and no scraper has been implemented — see config/sources.yaml "
        "secondary_sources.transalt_tracker for the check to run before "
        "building one."
    )


if __name__ == "__main__":
    main()

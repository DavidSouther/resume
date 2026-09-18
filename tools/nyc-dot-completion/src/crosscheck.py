"""Step 4: cross-check the bike-route-inventory-derived protected-lane
mileage against DOT testimony, and note the TransAlt tracker gap.

Never picks one figure over another — every mismatch beyond the
configured variance threshold prints as a warning, left for a human (or
build_table.py's confidence column) to resolve. Uses DuckDB SQL (incl.
the spatial extension for geometry-derived length) for the by-year
aggregation; no pandas.
"""

from __future__ import annotations

from pathlib import Path

import duckdb
import yaml

from aggregate import FEET_PER_MILE, load_config

CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"
CACHE_DIR = Path(__file__).resolve().parent.parent / "cache"


def bike_route_derived_miles_by_year() -> dict[int, float] | None:
    """On-street protected-lane mileage per calendar year, independent of
    administration-window bucketing, so it can be matched against a
    testimony figure stated per calendar year. Computed the same way as
    aggregate.py's bike_lane_miles_metric (geometry -> EPSG:2263 length,
    deduplicated, on-street only) so this is a real mile-for-mile
    comparison, not a unit mismatch."""
    config = load_config()
    dataset = config["datasets"]["bike_routes"]
    cache_dir = CACHE_DIR / dataset["dataset_id"]
    if not (cache_dir / "manifest.json").exists():
        return None

    date_field = dataset["date_field"]
    status_field = dataset["status_field"]
    active_value = dataset["active_status_value"]

    con = duckdb.connect()
    con.execute("INSTALL spatial")
    con.execute("LOAD spatial")
    cache_glob = str(cache_dir / "page_*.json")
    rows = con.execute(
        f"""
        SELECT extract(year FROM inst_date) AS yr, sum(length_ft) / {FEET_PER_MILE} AS mi
        FROM (
          SELECT DISTINCT
            {date_field}::DATE AS inst_date, onoffst,
            ST_Length(ST_Transform(
              ST_GeomFromGeoJSON(to_json(the_geom)), 'EPSG:4326', 'EPSG:2263'
            )) AS length_ft
          FROM read_json_auto('{cache_glob}')
          WHERE {status_field} = '{active_value}'
            AND (ft_facilit = 'Protected' OR tf_facilit = 'Protected')
            AND onoffst = 'ON'
        )
        GROUP BY yr
        ORDER BY yr
        """
    ).fetchall()
    return {int(yr): float(mi) for yr, mi in rows}


def main() -> None:
    testimony = yaml.safe_load((CONFIG_DIR / "testimony.yaml").read_text(encoding="utf-8"))
    by_year = bike_route_derived_miles_by_year()

    if by_year is None:
        print(
            "No cached bike route pull yet — run pull_bike_routes.py "
            "before cross-checking against testimony."
        )
    else:
        cross_check_cfg = testimony["cross_check"]["protected_bike_lane_miles"]
        threshold = cross_check_cfg["variance_warn_threshold_pct"]

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
                derived_mi = by_year.get(year)
                if derived_mi is None:
                    print(
                        f"  {doc_key}, {year}: testimony says "
                        f"{figure['value_mi']} mi; no bike-route-derived "
                        f"mileage available for that year in the current "
                        f"cache."
                    )
                    continue
                variance_pct = (
                    abs(derived_mi - figure["value_mi"]) / figure["value_mi"] * 100
                )
                flag = "WARNING" if variance_pct > threshold else "ok"
                print(
                    f"  [{flag}] {doc_key}, {year}: testimony="
                    f"{figure['value_mi']:.1f} mi, "
                    f"bike-route-inventory-derived={derived_mi:.1f} mi "
                    f"on-street, variance={variance_pct:.1f}% "
                    f"(warn threshold {threshold}%). Both are miles, but a "
                    "~10x gap this large (inventory HIGHER than testimony) "
                    "is not explained by the on-street/greenway split — "
                    "that would only push testimony above the inventory "
                    "figure, not below it. The likelier cause: this "
                    "dataset's own field description says instdate is set "
                    "on installation OR MODIFICATION of a facility, so a "
                    "pre-existing lane that was merely restriped/upgraded "
                    "gets counted here as a same-year 'install', which "
                    "DOT's own new-mileage figure would not count. Treat "
                    "this as an open discrepancy to investigate, not a "
                    "resolved one — do not average or split the "
                    "difference between the two figures."
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

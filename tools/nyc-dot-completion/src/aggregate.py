"""Step 3: aggregate classified bike routes (+ pedestrian plazas, +
pedestrian space added) into per-administration-window metrics.

Produces a list of metric dicts, each carrying enough provenance
(segment-count vs. capital-project-count, installed-vs-in-place, FY-vs-
exact-date) that build_table.py can assign an honest confidence label
without re-deriving any of this logic itself.

Every grouping/date-bucketing query here runs as DuckDB SQL directly
against the cached JSON / classified CSV files — no pandas.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from pathlib import Path

import duckdb
import yaml

CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "output"
CACHE_DIR = Path(__file__).resolve().parent.parent / "cache"

FEET_PER_MILE = 5280.0


@dataclass
class Metric:
    key: str
    label: str
    unit: str
    adams_total: float | None
    mamdani_to_date_total: float | None
    mamdani_annualized: float | None
    basis: str  # "inventory_count" | "capital_project_count" | "none"
    completion_semantics: str  # "installed" | "in_place_as_of_extraction" | "unknown"
    notes: str = ""


def load_config() -> dict:
    return yaml.safe_load((CONFIG_DIR / "sources.yaml").read_text(encoding="utf-8"))


def window_sql(admins: dict, key: str, extraction_date: date, field: str) -> str:
    start = admins[key]["start"]
    end = admins[key].get("end") or extraction_date.isoformat()
    return f"{field} BETWEEN DATE '{start}' AND DATE '{end}'"


def annualize(to_date_total: float, admins: dict, extraction_date: date) -> float:
    mamdani_start = date.fromisoformat(admins["mamdani"]["start"])
    elapsed_days = max((extraction_date - mamdani_start).days, 1)
    return to_date_total * (365.25 / elapsed_days)


def bike_lane_metric(
    con: duckdb.DuckDBPyConnection, config: dict, extraction_date: date
) -> Metric:
    dataset = config["datasets"]["bike_routes"]
    admins = config["administrations"]
    classified_path = OUTPUT_DIR / "bike_routes_classified.csv"
    if not classified_path.exists():
        return Metric(
            key="bike_lane",
            label="Protected bike lane",
            unit="unknown",
            adams_total=None,
            mamdani_to_date_total=None,
            mamdani_annualized=None,
            basis="inventory_count",
            completion_semantics="installed",
            notes="Not pulled/classified yet — run pull_bike_routes.py and classify.py.",
        )

    date_field = dataset["date_field"]
    status_field = dataset["status_field"]
    active_value = dataset["active_status_value"]

    con.execute(
        f"CREATE OR REPLACE VIEW bike_lanes AS "
        f"SELECT * FROM read_csv_auto('{classified_path}')"
    )

    adams_where = window_sql(admins, "adams", extraction_date, date_field)
    mamdani_where = window_sql(admins, "mamdani", extraction_date, date_field)

    adams_n, mamdani_n = con.execute(
        f"""
        SELECT
          count(*) FILTER (
            WHERE category = 'bike_lane_install'
              AND {status_field} = '{active_value}'
              AND {adams_where}
          ) AS adams_n,
          count(*) FILTER (
            WHERE category = 'bike_lane_install'
              AND {status_field} = '{active_value}'
              AND {mamdani_where}
          ) AS mamdani_n
        FROM bike_lanes
        """
    ).fetchone()

    mamdani_annualized = annualize(float(mamdani_n), admins, extraction_date)

    return Metric(
        key="bike_lane",
        label="Protected bike lane",
        unit="segments",
        adams_total=float(adams_n),
        mamdani_to_date_total=float(mamdani_n),
        mamdani_annualized=mamdani_annualized,
        basis="inventory_count",
        completion_semantics="installed",
        notes=(
            "As-built segment count from DOT/DCP's own bike route inventory "
            f"({dataset['dataset_id']}), status='Current' only, install date "
            f"({date_field}) bucketed by administration window. Counts "
            "segments, not miles — no reliable per-segment length field "
            "exists without computing one from geometry, and this pipeline "
            "does not guess a units-bearing figure. Caveat confirmed via "
            "crosscheck.py (a ~10x gap against DOT's own testimony mileage, "
            "in the direction this dataset overcounts): the field's own "
            f"description says {date_field} is set on install OR "
            "MODIFICATION of a facility, so a pre-existing lane that was "
            "only restriped/upgraded can show up as a same-year 'install' "
            "here. This likely inflates both administrations' totals to "
            "some degree — not verified whether the inflation rate has "
            "shifted between them."
        ),
    )


def bike_lane_miles_metric(
    con: duckdb.DuckDBPyConnection, config: dict, extraction_date: date
) -> Metric:
    """On-street protected-lane mileage, computed from each segment's own
    geometry (DuckDB's spatial extension, reprojected to EPSG:2263 — NY
    State Plane feet — for an accurate planar length), not guessed from a
    units-bearing field that doesn't exist on this dataset. Segment count
    alone hides a real trend: recent installs skew shorter (see notes),
    so a raw count can understate how much the actual pace has slowed.

    on-street only (onoffst='ON'): off-street greenway/park paths are
    real bike infrastructure but a handful of them are 3-15 mile single
    geometries (e.g. the Shore Pkwy Greenway), and folding those into a
    "protected bike lane" pace figure would let one park-path digitization
    swing the whole number. Reported separately in notes instead.
    """
    dataset = config["datasets"]["bike_routes"]
    admins = config["administrations"]
    dataset_id = dataset["dataset_id"]
    cache_dir = CACHE_DIR / dataset_id
    if not (cache_dir / "manifest.json").exists():
        return Metric(
            key="bike_lane_miles",
            label="Protected bike lane (on-street)",
            unit="unknown",
            adams_total=None,
            mamdani_to_date_total=None,
            mamdani_annualized=None,
            basis="inventory_length",
            completion_semantics="installed",
            notes="Not pulled yet — run pull_bike_routes.py.",
        )

    con.execute("INSTALL spatial")
    con.execute("LOAD spatial")
    cache_glob = str(cache_dir / "page_*.json")
    date_field = dataset["date_field"]
    status_field = dataset["status_field"]
    active_value = dataset["active_status_value"]

    # SELECT DISTINCT: same source duplicate-row issue as classify.py —
    # see that file's comment. Deduplicate here too since this reads the
    # raw cache directly, not the classified CSV (whose CSV-serialized
    # the_geom column isn't valid GeoJSON — see git history for why this
    # function reads geometry from the cache instead).
    con.execute(
        f"""
        CREATE OR REPLACE VIEW bike_geom AS
        SELECT DISTINCT
          {date_field}::DATE AS inst_date, onoffst, grnwy,
          ST_Length(ST_Transform(
            ST_GeomFromGeoJSON(to_json(the_geom)), 'EPSG:4326', 'EPSG:2263'
          )) AS length_ft
        FROM read_json_auto('{cache_glob}')
        WHERE {status_field} = '{active_value}'
          AND (ft_facilit = 'Protected' OR tf_facilit = 'Protected')
        """
    )

    adams_where = window_sql(admins, "adams", extraction_date, "inst_date")
    mamdani_where = window_sql(admins, "mamdani", extraction_date, "inst_date")

    adams_ft, mamdani_ft, adams_off_ft, mamdani_off_ft = con.execute(
        f"""
        SELECT
          sum(length_ft) FILTER (WHERE onoffst = 'ON' AND {adams_where}),
          sum(length_ft) FILTER (WHERE onoffst = 'ON' AND {mamdani_where}),
          sum(length_ft) FILTER (WHERE onoffst = 'OFF' AND {adams_where}),
          sum(length_ft) FILTER (WHERE onoffst = 'OFF' AND {mamdani_where})
        FROM bike_geom
        """
    ).fetchone()

    adams_mi = (adams_ft or 0.0) / FEET_PER_MILE
    mamdani_mi = (mamdani_ft or 0.0) / FEET_PER_MILE
    adams_off_mi = (adams_off_ft or 0.0) / FEET_PER_MILE
    mamdani_off_mi = (mamdani_off_ft or 0.0) / FEET_PER_MILE
    mamdani_annualized = annualize(mamdani_mi, admins, extraction_date)

    return Metric(
        key="bike_lane_miles",
        label="Protected bike lane (on-street)",
        unit="mi",
        adams_total=round(adams_mi, 2),
        mamdani_to_date_total=round(mamdani_mi, 2),
        mamdani_annualized=round(mamdani_annualized, 2),
        basis="inventory_length",
        completion_semantics="installed",
        notes=(
            f"Miles computed from each segment's own geometry "
            f"({dataset_id}), reprojected to EPSG:2263 for planar length "
            "— not a guessed units-bearing field. On-street only "
            "(onoffst='ON'); off-street greenway/park paths installed in "
            f"the same windows total {adams_off_mi:.1f} mi (Adams) and "
            f"{mamdani_off_mi:.1f} mi (Mamdani to date), reported "
            "separately because a few multi-mile park-path geometries "
            "would otherwise swing an on-street pace figure. Recent "
            "installs skew shorter per segment than earlier years' — this "
            "mileage figure falls faster than the plain segment count "
            "above, not slower; see the segment-count row's install-year "
            "breakdown for the underlying trend."
        ),
    )


def daylighting_metric(config: dict) -> Metric:
    note = (config.get("daylighting", {}).get("note") or "").strip()
    return Metric(
        key="daylighting",
        label="Daylighted intersections",
        unit="unknown",
        adams_total=None,
        mamdani_to_date_total=None,
        mamdani_annualized=None,
        basis="none",
        completion_semantics="unknown",
        notes=(
            f"{note} DOT testimony is the only source, and the most recent "
            "(first Mamdani-era) testimony gives no intersection count at "
            "all — see config/testimony.yaml fy27_executive."
        ).strip(),
    )


def plaza_metric(
    con: duckdb.DuckDBPyConnection, config: dict, extraction_date: date
) -> Metric:
    plaza_dataset = config["datasets"]["pedestrian_plazas"]
    space_dataset = config["datasets"]["pedestrian_space_added"]

    plaza_cache = CACHE_DIR / plaza_dataset["dataset_id"]
    space_cache = CACHE_DIR / space_dataset["dataset_id"]

    if not (plaza_cache / "manifest.json").exists() or not (
        space_cache / "manifest.json"
    ).exists():
        return Metric(
            key="plazas",
            label="Pedestrian plazas / Open Streets",
            unit="unknown",
            adams_total=None,
            mamdani_to_date_total=None,
            mamdani_annualized=None,
            basis="capital_project_count",
            completion_semantics="in_place_as_of_extraction",
            notes="Not pulled yet — run pull_plazas.py and pull_pedestrian_space.py.",
        )

    total_plazas = con.execute(
        f"SELECT count(*) FROM read_json_auto('{plaza_cache}/page_*.json')"
    ).fetchone()[0]

    fy_field = space_dataset["fiscal_year_field"]
    con.execute(
        f"CREATE OR REPLACE VIEW space_added AS "
        f"SELECT * FROM read_json_auto('{space_cache}/page_*.json')"
    )
    fy_rows = con.execute(
        f"SELECT {fy_field}::INT AS fy, count(*) AS n_projects "
        f"FROM space_added GROUP BY {fy_field} ORDER BY fy"
    ).fetchall()
    fy_counts = {int(fy): int(n) for fy, n in fy_rows}

    # NYC fiscal year runs Jul 1 - Jun 30. Adams (Jan 2022 - Dec 2025) does
    # not line up cleanly with any set of whole fiscal years: FY22 (Jul
    # 2021-Jun 2022) is half de Blasio, and FY26 (Jul 2025-Jun 2026) is
    # half Mamdani. Both boundary years are disclosed approximations, never
    # silently absorbed into one administration's total.
    adams_fys = [2022, 2023, 2024, 2025]
    present_adams_fys = [fy for fy in adams_fys if fy in fy_counts]
    missing_adams_fys = [fy for fy in adams_fys if fy not in fy_counts]
    adams_total = sum(fy_counts[fy] for fy in present_adams_fys) if present_adams_fys else None

    mamdani_fy = 2026
    mamdani_total = fy_counts.get(mamdani_fy)

    notes_parts = [
        f"Polygon inventory ({plaza_dataset['dataset_id']}) total as of "
        f"extraction: {total_plazas} plazas citywide; that dataset has no "
        "install-date field, so it alone supports no year split.",
        f"Adams/Mamdani totals here instead come from Pedestrian Space "
        f"Added ({space_dataset['dataset_id']}) project counts, bucketed by "
        "NYC fiscal year (not exact calendar date) — a capital-project "
        "count, not a plaza count.",
    ]
    if missing_adams_fys:
        fy_list = ", ".join(f"FY{fy}" for fy in missing_adams_fys)
        notes_parts.append(
            f"{fy_list} absent from the dataset (not yet published, or a "
            "genuine reporting gap) — excluded from the Adams total below "
            "rather than counted as zero."
        )
    if mamdani_total is None:
        notes_parts.append(
            "FY2026 (the fiscal year spanning the Adams/Mamdani transition) "
            "has not been published in this dataset as of extraction — "
            "Mamdani to-date total is unavailable, not zero."
        )
    notes_parts.append(
        "FY22 (Jul 2021-Jun 2022) and FY26 (Jul 2025-Jun 2026) each "
        "straddle an administration transition; this fiscal-year bucketing "
        "is a disclosed approximation, not an exact administration-window "
        "split."
    )

    mamdani_annualized = (
        annualize(float(mamdani_total), config["administrations"], extraction_date)
        if mamdani_total is not None
        else None
    )

    return Metric(
        key="plazas",
        label="Pedestrian plazas / Open Streets",
        unit="projects/FY",
        adams_total=float(adams_total) if adams_total is not None else None,
        mamdani_to_date_total=(
            float(mamdani_total) if mamdani_total is not None else None
        ),
        mamdani_annualized=mamdani_annualized,
        basis="capital_project_count",
        completion_semantics="in_place_as_of_extraction",
        notes=" ".join(notes_parts),
    )


def run(extraction_date: date | None = None) -> list[Metric]:
    config = load_config()
    extraction_date = extraction_date or date.today()
    con = duckdb.connect()
    return [
        bike_lane_metric(con, config, extraction_date),
        bike_lane_miles_metric(con, config, extraction_date),
        daylighting_metric(config),
        plaza_metric(con, config, extraction_date),
    ]


if __name__ == "__main__":
    for m in run():
        print(m)

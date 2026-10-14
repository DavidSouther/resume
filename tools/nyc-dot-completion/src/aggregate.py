"""Step 3: aggregate classified permits (+ capital projects, + plazas)
into per-administration-window metrics.

Produces a list of metric dicts, each carrying enough provenance
(permit-count vs. length-summed, completed-vs-issued, date-available vs
not) that build_table.py can assign an honest confidence label without
re-deriving any of this logic itself.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

import pandas as pd
import yaml

from socrata import load_cached

CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "output"

FEET_PER_MILE = 5280.0


@dataclass
class Metric:
    key: str
    label: str
    unit: str
    adams_total: float | None
    mamdani_to_date_total: float | None
    mamdani_annualized: float | None
    basis: str  # "permit_count" | "permit_length" | "capital_project" | "inventory_count"
    completion_semantics: str  # "issued" | "completed" | "in_place_as_of_extraction"
    notes: str = ""


def _parse_date(value: str) -> date:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).date()


def load_config() -> dict:
    return yaml.safe_load((CONFIG_DIR / "sources.yaml").read_text(encoding="utf-8"))


def window_bounds(admins: dict, key: str, extraction_date: date) -> tuple[date, date]:
    start = _parse_date(admins[key]["start"])
    end_raw = admins[key].get("end")
    end = _parse_date(end_raw) if end_raw else extraction_date
    return start, end


def bucket_by_window(
    dates: pd.Series, admins: dict, extraction_date: date
) -> pd.Series:
    """Returns a Series of window keys ('adams' | 'mamdani' | None) aligned
    to `dates`. None means the date fell outside every configured window."""
    adams_start, adams_end = window_bounds(admins, "adams", extraction_date)
    mamdani_start, mamdani_end = window_bounds(admins, "mamdani", extraction_date)

    def bucket(d: date) -> str | None:
        if adams_start <= d <= adams_end:
            return "adams"
        if mamdani_start <= d <= mamdani_end:
            return "mamdani"
        return None

    return dates.apply(bucket)


PERMIT_CATEGORY_SPECS = [
    ("bike_lane_install", "Protected bike lane", "bike_lane"),
    ("daylighting", "Daylighted intersections", "daylighting"),
]


def _unpulled_permit_metrics() -> list[Metric]:
    return [
        Metric(
            key=key,
            label=label,
            unit="unknown",
            adams_total=None,
            mamdani_to_date_total=None,
            mamdani_annualized=None,
            basis="permit_count",
            completion_semantics="issued",
            notes="Not pulled yet — run pull_permits.py and classify.py.",
        )
        for _category, label, key in PERMIT_CATEGORY_SPECS
    ]


def permit_metrics(config: dict, extraction_date: date) -> list[Metric]:
    permits_path = OUTPUT_DIR / "permits_classified.csv"
    if not permits_path.exists():
        return _unpulled_permit_metrics()

    dataset = config["datasets"]["street_construction_permits"]
    admins = config["administrations"]

    df = pd.read_csv(permits_path)
    dates = pd.to_datetime(df[dataset["date_field"]]).dt.date
    df = df.assign(_window=bucket_by_window(dates, admins, extraction_date))
    df = df[df["_window"].notna()]

    metrics = []
    for category, label, key in PERMIT_CATEGORY_SPECS:
        subset = df[df["category"] == category]
        by_window = subset.groupby("_window").size()
        adams_n = int(by_window.get("adams", 0))
        mamdani_n = int(by_window.get("mamdani", 0))

        # length_field, when set, is a bike-lane linear measurement — it
        # has no meaning for other permit categories (e.g. daylighting is
        # always counted, never measured in miles).
        length_field = dataset.get("length_field") if category == "bike_lane_install" else None
        if length_field:
            unit_factor = 1.0 if dataset.get("length_unit") == "miles" else 1 / FEET_PER_MILE
            by_window_len = subset.groupby("_window")[length_field].sum() * unit_factor
            adams_total = float(by_window_len.get("adams", 0.0))
            mamdani_total = float(by_window_len.get("mamdani", 0.0))
            unit = "mi"
            basis = "permit_length"
        else:
            adams_total = float(adams_n)
            mamdani_total = float(mamdani_n)
            unit = "permits"
            basis = "permit_count"

        mamdani_start, _ = window_bounds(admins, "mamdani", extraction_date)
        elapsed_days = max((extraction_date - mamdani_start).days, 1)
        annualized = mamdani_total * (365.25 / elapsed_days)

        metrics.append(
            Metric(
                key=key,
                label=label,
                unit=unit,
                adams_total=adams_total,
                mamdani_to_date_total=mamdani_total,
                mamdani_annualized=annualized,
                basis=basis,
                completion_semantics="issued",
                notes=(
                    "Permit-ISSUED count, not verified completion."
                    if basis == "permit_count"
                    else "Permit-ISSUED length, not verified completion."
                ),
            )
        )
    return metrics


def plaza_metric(config: dict, extraction_date: date) -> Metric:
    dataset = config["datasets"]["pedestrian_plazas"]
    try:
        rows = load_cached("pedestrian_plazas")
    except FileNotFoundError:
        return Metric(
            key="plazas",
            label="Pedestrian plazas / Open Streets",
            unit="plazas",
            adams_total=None,
            mamdani_to_date_total=None,
            mamdani_annualized=None,
            basis="inventory_count",
            completion_semantics="in_place_as_of_extraction",
            notes="Not pulled yet — run pull_plazas.py.",
        )

    date_field = dataset.get("date_field")
    if date_field:
        admins = config["administrations"]
        dates = pd.to_datetime(pd.DataFrame(rows)[date_field]).dt.date
        windows = bucket_by_window(dates, admins, extraction_date)
        return Metric(
            key="plazas",
            label="Pedestrian plazas / Open Streets",
            unit="plazas",
            adams_total=float((windows == "adams").sum()),
            mamdani_to_date_total=float((windows == "mamdani").sum()),
            mamdani_annualized=None,  # a plaza count isn't a flow rate
            basis="inventory_count",
            completion_semantics="in_place_as_of_extraction",
            notes="",
        )

    return Metric(
        key="plazas",
        label="Pedestrian plazas / Open Streets",
        unit="plazas",
        adams_total=None,
        mamdani_to_date_total=None,
        mamdani_annualized=None,
        basis="inventory_count",
        completion_semantics="in_place_as_of_extraction",
        notes=(
            f"Dataset carries no install/opening date field. Total count "
            f"as of extraction ({extraction_date.isoformat()}): {len(rows)}. "
            f"No year-over-year split is possible from this dataset alone."
        ),
    )


def run(extraction_date: date | None = None) -> list[Metric]:
    config = load_config()
    extraction_date = extraction_date or date.today()
    metrics = permit_metrics(config, extraction_date)
    metrics.append(plaza_metric(config, extraction_date))
    return metrics


if __name__ == "__main__":
    for m in run():
        print(m)

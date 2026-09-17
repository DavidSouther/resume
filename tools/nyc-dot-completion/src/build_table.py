"""Step 5: assemble the final comparison table.

Columns: metric, unit, adams_total, mamdani_to_date_total,
mamdani_annualized_total, confidence, completion_semantics, notes.

Confidence values, in the order the pipeline prefers them:
inventory-verified (sourced from DOT/DCP's own as-built bike route
inventory) > api-verified (sourced directly from another City Open Data
API, e.g. the pedestrian-space-added dataset) > unavailable (no public
dataset source — reported as an empty cell with a reason, never a guess).
"""

from __future__ import annotations

import csv
from pathlib import Path

from aggregate import Metric, run as run_aggregate
from crosscheck import bike_route_derived_counts_by_year

CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "output"


def confidence_for(metric: Metric) -> str:
    if metric.adams_total is None and metric.mamdani_to_date_total is None:
        return "unavailable"
    if metric.basis == "inventory_count":
        return "inventory-verified"
    return "api-verified"


def annotate_bike_lane_crosscheck(metric: Metric) -> None:
    """If an inventory-derived figure exists, note whether it was checked
    against testimony — build_table never silently drops that context."""
    if metric.key != "bike_lane" or metric.adams_total is None:
        return
    by_year = bike_route_derived_counts_by_year()
    if by_year:
        metric.notes = (
            metric.notes
            + " Cross-checked against DOT testimony — see crosscheck.py "
            "output (unit mismatch: miles vs. segment count, trend check "
            "only)."
        ).strip()


def build_rows() -> list[dict]:
    metrics = run_aggregate()
    for m in metrics:
        annotate_bike_lane_crosscheck(m)

    rows = []
    for m in metrics:
        rows.append(
            {
                "metric": m.label,
                "unit": m.unit,
                "adams_total": "" if m.adams_total is None else round(m.adams_total, 2),
                "mamdani_to_date_total": (
                    "" if m.mamdani_to_date_total is None else round(m.mamdani_to_date_total, 2)
                ),
                "mamdani_annualized_total": (
                    "" if m.mamdani_annualized is None else round(m.mamdani_annualized, 2)
                ),
                "confidence": confidence_for(m),
                "completion_semantics": m.completion_semantics,
                "notes": m.notes,
            }
        )
    return rows


def main() -> None:
    rows = build_rows()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / "final_table.csv"

    fieldnames = [
        "metric",
        "unit",
        "adams_total",
        "mamdani_to_date_total",
        "mamdani_annualized_total",
        "confidence",
        "completion_semantics",
        "notes",
    ]
    with out_path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {out_path}\n")
    print(f"{'metric':<32}{'unit':<14}{'Adams':<10}{'Mamdani':<10}{'Mam/yr':<10}{'confidence':<20}notes")
    for row in rows:
        print(
            f"{row['metric']:<32}{row['unit']:<14}"
            f"{str(row['adams_total']):<10}{str(row['mamdani_to_date_total']):<10}"
            f"{str(row['mamdani_annualized_total']):<10}{row['confidence']:<20}{row['notes']}"
        )


if __name__ == "__main__":
    main()

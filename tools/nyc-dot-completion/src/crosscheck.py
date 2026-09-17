"""Step 4: cross-check the permit-derived bike lane figure against DOT
testimony and the TransAlt tracker for the same calendar years.

Never picks one figure over another — every mismatch is a printed
warning, left for a human (or build_table.py's confidence column) to
resolve.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import yaml

from aggregate import FEET_PER_MILE, load_config

CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "output"


def permit_derived_miles_by_year() -> dict[int, float] | None:
    """Bike-lane length (or count, if no length field) per calendar year,
    independent of administration-window bucketing, so it can be matched
    against a testimony figure that's stated per calendar year."""
    permits_path = OUTPUT_DIR / "permits_classified.csv"
    if not permits_path.exists():
        return None

    config = load_config()
    dataset = config["datasets"]["street_construction_permits"]
    df = pd.read_csv(permits_path)
    df = df[df["category"] == "bike_lane_install"]
    years = pd.to_datetime(df[dataset["date_field"]]).dt.year

    length_field = dataset.get("length_field")
    if length_field:
        unit_factor = 1.0 if dataset.get("length_unit") == "miles" else 1 / FEET_PER_MILE
        return (df[length_field] * unit_factor).groupby(years).sum().to_dict()
    return years.value_counts().to_dict()


def main() -> None:
    testimony = yaml.safe_load((CONFIG_DIR / "testimony.yaml").read_text(encoding="utf-8"))
    permit_by_year = permit_derived_miles_by_year()

    if permit_by_year is None:
        print(
            "No classified permit data cached yet — run pull_permits.py and "
            "classify.py before cross-checking against testimony."
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
                        f"cannot be matched against a permit-derived total. "
                        f"{figure.get('note', '')}"
                    )
                    continue
                permit_value = permit_by_year.get(year)
                if permit_value is None:
                    print(
                        f"  {doc_key}, {year}: testimony says "
                        f"{figure['value_mi']} mi; no permit-derived figure "
                        f"available for that year in the current cache."
                    )
                    continue
                variance_pct = abs(permit_value - figure["value_mi"]) / figure["value_mi"] * 100
                flag = "WARNING" if variance_pct > threshold else "ok"
                print(
                    f"  [{flag}] {doc_key}, {year}: testimony="
                    f"{figure['value_mi']} mi, permit-derived={permit_value:.1f} "
                    f"(unit assumed mi if length_field is set, else raw permit "
                    f"count — check units before trusting this number), "
                    f"variance={variance_pct:.1f}%"
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

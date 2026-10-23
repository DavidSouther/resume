"""Step 1a: pull Street Construction Permits (tqtj-sjs8) for both
administration windows in one request, filtered by issue_date so we never
pull permits older than the pipeline needs.

Run this only after inspect_schema.py has confirmed `date_field` in
config/sources.yaml actually matches the dataset's real column name.
"""

from __future__ import annotations

from pathlib import Path

import requests
import yaml

from socrata import fetch_all

CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"


def main() -> None:
    config = yaml.safe_load((CONFIG_DIR / "sources.yaml").read_text(encoding="utf-8"))
    dataset = config["datasets"]["street_construction_permits"]
    admins = config["administrations"]

    date_field = dataset["date_field"]
    if not date_field:
        raise SystemExit(
            "config/sources.yaml: street_construction_permits.date_field is "
            "unset. Run inspect_schema.py, confirm the real date column "
            "name, and set it before pulling."
        )

    # Covers Adams' start through "now" — Mamdani's window has no end date,
    # so we pull everything from the earliest admin start onward and let
    # aggregate.py bucket by window at read time, rather than re-pulling
    # per window.
    earliest_start = min(a["start"] for a in admins.values())
    where = f"{date_field} >= '{earliest_start}T00:00:00'"

    session = requests.Session()
    rows = fetch_all(
        dataset["resource_url"],
        dataset["dataset_id"],
        where=where,
        order_by=date_field,
        page_size=config["socrata"]["page_size"],
        session=session,
    )
    print(f"Pulled {len(rows)} permit rows since {earliest_start} into cache.")


if __name__ == "__main__":
    try:
        main()
    except requests.RequestException as exc:
        raise SystemExit(f"Pull failed: {exc}") from exc

"""Step 1b: pull Street and Highway Capital Reconstruction Projects
(97nd-ff3i) — the spatial capital-project cross-check dataset.

No date filter is applied by default: config/sources.yaml's date_field for
this dataset starts as null because the brief doesn't name a confirmed
completion/last-modified column. Run inspect_schema.py first; if it finds
one, set date_field and add a $where clause the same way pull_permits.py
does before re-running this for a large dataset. Until then this pulls
the full table.
"""

from __future__ import annotations

from pathlib import Path

import requests
import yaml

from socrata import fetch_all

CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"


def main() -> None:
    config = yaml.safe_load((CONFIG_DIR / "sources.yaml").read_text(encoding="utf-8"))
    dataset = config["datasets"]["capital_reconstruction_projects"]

    where = None
    if dataset.get("date_field"):
        earliest_start = min(a["start"] for a in config["administrations"].values())
        where = f"{dataset['date_field']} >= '{earliest_start}T00:00:00'"

    session = requests.Session()
    rows = fetch_all(
        dataset["resource_url"],
        dataset["dataset_id"],
        where=where,
        order_by=dataset.get("date_field"),
        page_size=config["socrata"]["page_size"],
        session=session,
    )
    print(f"Pulled {len(rows)} capital-project rows into cache.")
    if not dataset.get("date_field"):
        print(
            "NOTE: no date_field configured — this is the full table, "
            "unfiltered. Confirm a completion/status field via "
            "inspect_schema.py before using this for cross-checking."
        )


if __name__ == "__main__":
    try:
        main()
    except requests.RequestException as exc:
        raise SystemExit(f"Pull failed: {exc}") from exc

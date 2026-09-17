"""Step 1c: pull Street and Highway Capital Reconstruction Projects
(97nd-ff3i) — the spatial capital-project cross-check dataset.

date_field (construc_2, "date project completed") was confirmed via
inspect_schema.py's metadata output on 2026-09-17 and is filtered here.
Not yet consumed by aggregate.py's metrics — cached for a future
cross-check, same as the original design.
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

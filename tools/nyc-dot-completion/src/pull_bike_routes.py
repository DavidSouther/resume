"""Step 1a: pull NYC Bike Routes (mzxg-pwib) — the primary source for the
protected-bike-lane metric.

Pulled as a full table: at ~30k segment rows this comfortably fits in one
page at the configured page size, so no date filter is needed up front —
aggregate.py buckets by `instdate` (and filters to `status == "Current"`)
at read time.
"""

from __future__ import annotations

from pathlib import Path

import requests
import yaml

from socrata import fetch_all

CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"


def main() -> None:
    config = yaml.safe_load((CONFIG_DIR / "sources.yaml").read_text(encoding="utf-8"))
    dataset = config["datasets"]["bike_routes"]

    session = requests.Session()
    rows = fetch_all(
        dataset["resource_url"],
        dataset["dataset_id"],
        order_by=dataset["date_field"],
        page_size=config["socrata"]["page_size"],
        session=session,
    )
    print(f"Pulled {len(rows)} bike route segment rows into cache.")


if __name__ == "__main__":
    try:
        main()
    except requests.RequestException as exc:
        raise SystemExit(f"Pull failed: {exc}") from exc

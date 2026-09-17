"""Step 1c: pull NYC DOT Pedestrian Plazas (k5k6-6jex), a polygon dataset.

Pulled as a full table (no date filter): per the task brief, this dataset
may not carry an install/opening date at all. inspect_schema.py's field
list is what settles that, not an assumption made here.
"""

from __future__ import annotations

from pathlib import Path

import requests
import yaml

from socrata import fetch_all

CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"


def main() -> None:
    config = yaml.safe_load((CONFIG_DIR / "sources.yaml").read_text(encoding="utf-8"))
    dataset = config["datasets"]["pedestrian_plazas"]

    session = requests.Session()
    rows = fetch_all(
        dataset["resource_url"],
        dataset["dataset_id"],
        page_size=config["socrata"]["page_size"],
        session=session,
    )
    print(f"Pulled {len(rows)} pedestrian plaza rows into cache.")


if __name__ == "__main__":
    try:
        main()
    except requests.RequestException as exc:
        raise SystemExit(f"Pull failed: {exc}") from exc

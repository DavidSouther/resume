"""Step 1d: pull DOT's Pedestrian Space Added (uebm-cmjr).

The only pedestrian-plaza-adjacent dataset that carries a time axis (NYC
fiscal year, not an exact date) — see sources.yaml's pedestrian_space_added
role for why the polygon plaza dataset alone can't support an
Adams/Mamdani split. Pulled as a full table; it is a small, project-level
dataset (a few hundred rows across two decades).
"""

from __future__ import annotations

from pathlib import Path

import requests
import yaml

from socrata import fetch_all

CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"


def main() -> None:
    config = yaml.safe_load((CONFIG_DIR / "sources.yaml").read_text(encoding="utf-8"))
    dataset = config["datasets"]["pedestrian_space_added"]

    session = requests.Session()
    rows = fetch_all(
        dataset["resource_url"],
        dataset["dataset_id"],
        page_size=config["socrata"]["page_size"],
        session=session,
    )
    print(f"Pulled {len(rows)} pedestrian-space-added project rows into cache.")


if __name__ == "__main__":
    try:
        main()
    except requests.RequestException as exc:
        raise SystemExit(f"Pull failed: {exc}") from exc

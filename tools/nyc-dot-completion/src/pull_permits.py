"""Step 1b (audit only): record why Street Construction Permits (tqtj-sjs8)
is not used for classification, without caching its raw rows.

Schema inspection (2026-09-17) confirmed this dataset carries no bike-lane
or daylighting category — see sources.yaml's street_construction_permits
role for the finding. It is also far too large to reasonably cache
row-by-row: >3M permits since 2022-01-01 (confirmed via a $select=count(1)
query below), which would mean gigabytes of raw JSON committed to this
repo for a dataset this pipeline doesn't even use. socrata.fetch_all's
full-page caching (used by every other puller here) is deliberately NOT
used for this one — instead this script records the row count and the
confirmed-absent categorical fields as a small JSON summary, which is
audit trail enough for "we checked, and here's what's there."
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import requests
import yaml

CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"
CACHE_DIR = Path(__file__).resolve().parent.parent / "cache"

# Categorical fields schema inspection found on this dataset — none of
# which carry a bike-lane or daylighting value (see sources.yaml).
CHECKED_FIELDS = [
    "permittypedesc",
    "applicationtypeshortdesc",
    "permitseriesshortdesc",
    "equipmenttypedesc",
]


def main() -> None:
    config = yaml.safe_load((CONFIG_DIR / "sources.yaml").read_text(encoding="utf-8"))
    dataset = config["datasets"]["street_construction_permits"]
    admins = config["administrations"]

    date_field = dataset["date_field"]
    earliest_start = min(a["start"] for a in admins.values())
    where = f"{date_field} >= '{earliest_start}T00:00:00'"

    session = requests.Session()
    resp = session.get(
        dataset["resource_url"],
        params={"$select": "count(1) as n", "$where": where},
        timeout=60,
    )
    resp.raise_for_status()
    row_count = int(resp.json()[0]["n"])

    summary = {
        "dataset_id": dataset["dataset_id"],
        "resource_url": dataset["resource_url"],
        "where": where,
        "row_count": row_count,
        "checked_fields": CHECKED_FIELDS,
        "finding": (
            "None of checked_fields carries a bike-lane-install or "
            "daylighting category. This dataset is a general street-"
            "opening/construction permit feed (utility work, refuse "
            "containers, sidewalk repair, etc.), not an infrastructure "
            "installation log. Not used for classification."
        ),
        "not_cached_reason": (
            f"{row_count} rows since {earliest_start} is too large to "
            "cache raw (multiple GB of JSON) for a dataset this pipeline "
            "doesn't use for any metric — see finding above."
        ),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }

    out_dir = CACHE_DIR / dataset["dataset_id"]
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "audit_summary.json").write_text(
        json.dumps(summary, indent=2), encoding="utf-8"
    )
    print(f"Confirmed {row_count} permit rows since {earliest_start}; not cached (see finding).")
    print(f"Wrote {out_dir / 'audit_summary.json'}")


if __name__ == "__main__":
    try:
        main()
    except requests.RequestException as exc:
        raise SystemExit(f"Pull failed: {exc}") from exc

"""Step 2: apply config/classification.yaml's human-reviewed mapping to
cached permit rows.

Refuses to proceed if any permit's category field value has no entry in
the mapping (or maps to the placeholder "UNCLASSIFIED") — printing every
unmapped value with its row count so a human can add it to
classification.yaml, rather than silently dropping or guessing at rows.
"""

from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

import pandas as pd
import yaml

from socrata import load_cached

CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "output"

VALID_CATEGORIES = {"bike_lane_install", "daylighting", "other", "ambiguous"}


def load_classification() -> dict:
    classification = yaml.safe_load(
        (CONFIG_DIR / "classification.yaml").read_text(encoding="utf-8")
    )
    mapping = classification.get("mapping") or {}
    unknown_categories = set(mapping.values()) - VALID_CATEGORIES
    if unknown_categories:
        raise SystemExit(
            f"classification.yaml maps to unrecognized categories: "
            f"{sorted(unknown_categories)}. Valid categories: "
            f"{sorted(VALID_CATEGORIES)}."
        )
    return classification


def classify_row(row: dict, source_fields: list[str], mapping: dict[str, str]) -> str | None:
    for field in source_fields:
        value = row.get(field)
        if value is None or value == "":
            continue
        return mapping.get(str(value))  # None if not yet mapped
    return None  # no source field had any value at all


def main() -> None:
    classification = load_classification()
    source_fields = classification["source_fields"]
    mapping = classification["mapping"]

    rows = load_cached("street_construction_permits")
    print(f"Loaded {len(rows)} cached permit rows.")

    unmapped: Counter = Counter()
    classified = []
    for row in rows:
        category = classify_row(row, source_fields, mapping)
        if category is None or category == "UNCLASSIFIED":
            value_seen = next(
                (row.get(f) for f in source_fields if row.get(f)), "<no value>"
            )
            unmapped[str(value_seen)] += 1
            continue
        classified.append({**row, "category": category})

    if unmapped:
        print(
            "\nRefusing to proceed: the following values have no mapping "
            "(or are still UNCLASSIFIED) in config/classification.yaml:",
            file=sys.stderr,
        )
        for value, n in sorted(unmapped.items(), key=lambda kv: -kv[1]):
            print(f"  {value!r:50} {n:>8} rows", file=sys.stderr)
        print(
            "\nAdd these to classification.yaml's `mapping` (see "
            "classification.generated.yaml from inspect_schema.py) and "
            "re-run.",
            file=sys.stderr,
        )
        raise SystemExit(1)

    df = pd.DataFrame(classified)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / "permits_classified.csv"
    df.to_csv(out_path, index=False)
    print(f"Classified {len(df)} rows -> {out_path}")
    print(df["category"].value_counts())


if __name__ == "__main__":
    main()

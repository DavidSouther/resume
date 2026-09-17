"""Step 2: classify NYC Bike Routes (mzxg-pwib) segments via
config/classification.yaml's human-reviewed ft_facilit/tf_facilit mapping.

Refuses to proceed (exit 1) if any segment's facility-class value, in
EITHER direction, has no entry in the mapping — printing every unmapped
value with its row count so a human can add it to classification.yaml,
rather than silently dropping or guessing at rows.

Every aggregation here runs as DuckDB SQL directly against the cached
JSON pages (no pandas): read_json_auto scans the cache glob, a small
mapping table is joined in to classify, and the classified rows are
written out with COPY.
"""

from __future__ import annotations

import sys
from pathlib import Path

import duckdb
import yaml

CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "output"
CACHE_DIR = Path(__file__).resolve().parent.parent / "cache"

VALID_CATEGORIES = {"bike_lane_install", "other", "ambiguous"}

# Priority order when a segment's two direction fields disagree — a
# protected facility in either direction makes the segment count as a
# protected bike lane, even if the other direction is merely painted.
CATEGORY_PRIORITY = ["bike_lane_install", "ambiguous", "other"]


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


def main() -> None:
    classification = load_classification()
    source_fields: list[str] = classification["source_fields"]
    mapping: dict[str, str] = classification["mapping"]

    dataset_id = "mzxg-pwib"  # bike_routes — kept in sync with sources.yaml
    cache_dir = CACHE_DIR / dataset_id
    if not (cache_dir / "manifest.json").exists():
        raise SystemExit(
            f"No cached pull for bike_routes at {cache_dir}. "
            f"Run pull_bike_routes.py first."
        )

    con = duckdb.connect()
    cache_glob = str(cache_dir / "page_*.json")
    con.execute(f"CREATE VIEW segments AS SELECT * FROM read_json_auto('{cache_glob}')")

    con.execute("CREATE TABLE category_map (value VARCHAR, category VARCHAR)")
    if mapping:
        con.executemany("INSERT INTO category_map VALUES (?, ?)", list(mapping.items()))

    joins = "\n".join(
        f"LEFT JOIN category_map m_{i} ON s.{field} = m_{i}.value"
        for i, field in enumerate(source_fields)
    )

    unmapped_sql = " UNION ALL ".join(
        f"""
        SELECT s.{field} AS value, count(*) AS n
        FROM segments s
        LEFT JOIN category_map m ON s.{field} = m.value
        WHERE s.{field} IS NOT NULL AND m.category IS NULL
        GROUP BY s.{field}
        """
        for field in source_fields
    )
    unmapped = con.execute(unmapped_sql).fetchall()
    if unmapped:
        print(
            "\nRefusing to proceed: the following values have no mapping "
            "in config/classification.yaml:",
            file=sys.stderr,
        )
        for value, n in sorted(unmapped, key=lambda r: -r[1]):
            print(f"  {value!r:50} {n:>8} rows", file=sys.stderr)
        print(
            "\nAdd these to classification.yaml's `mapping` (see "
            "classification.generated.yaml from inspect_schema.py) and "
            "re-run.",
            file=sys.stderr,
        )
        raise SystemExit(1)

    priority_case = "\n".join(
        f"WHEN {' OR '.join(f'm_{i}.category = {cat!r}' for i in range(len(source_fields)))} "
        f"THEN {cat!r}"
        for cat in CATEGORY_PRIORITY
    )

    con.execute(
        f"""
        CREATE TABLE classified AS
        SELECT s.*, CASE {priority_case} ELSE NULL END AS category
        FROM segments s
        {joins}
        """
    )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / "bike_routes_classified.csv"
    con.execute(
        f"COPY (SELECT * FROM classified WHERE category IS NOT NULL) "
        f"TO '{out_path}' (HEADER, DELIMITER ',')"
    )

    total = con.execute(
        "SELECT count(*) FROM classified WHERE category IS NOT NULL"
    ).fetchone()[0]
    counts = con.execute(
        "SELECT category, count(*) AS n FROM classified "
        "WHERE category IS NOT NULL GROUP BY category ORDER BY n DESC"
    ).fetchall()

    print(f"Classified {total} rows -> {out_path}")
    for category, n in counts:
        print(f"  {category:<20}{n}")


if __name__ == "__main__":
    main()

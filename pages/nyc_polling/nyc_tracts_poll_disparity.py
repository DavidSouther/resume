#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = [
#   "shapely>=2.0",       # tract geometry, point in polygon, centroids
#   "jinja2>=3.1",        # report template
#   "httpx>=0.27",        # sources are downloaded through the cache
#   "tenacity>=8.2",      # retries for httpx
# ]
# ///
"""Disparate impact tests: are higher poverty NYC census tracts more likely to have no early voting poll site inside the tract?

Loads the sources (see nyc_tracts/dataset.py; borough layers only, the low and zero population layers are excluded). The downloads come
from the cache, so a rerun needs no network access and no API keys. Writes nyc_tracts_poll_disparity.report.json and .report.md next to this script.

Run with `uv run nyc_tracts_poll_disparity.py`; tests with `uv run run_tests.py`.
Code lives in the nyc_tracts package (dataset, domain, stats, hypotheses, report).
"""

import argparse
import json
import os
from pathlib import Path

from nyc_tracts.dataset import add_dataset_arguments, load_from_args
from nyc_tracts.hypotheses import analyze
from nyc_tracts.report import render_md


def main() -> None:
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(description=(__doc__ or "").split("\n")[0])
    add_dataset_arguments(ap, Path(here) / ".cache")
    ap.add_argument("--out-dir", default=here)
    args = ap.parse_args()
    report = analyze(load_from_args(args))
    with open(os.path.join(args.out_dir, "nyc_tracts_poll_disparity.report.json"), "w", encoding="utf-8") as fh:
        json.dump(report.to_json(), fh, indent=2)
    md = render_md(report)
    with open(os.path.join(args.out_dir, "nyc_tracts_poll_disparity.report.md"), "w", encoding="utf-8") as fh:
        fh.write(md)
    print(md)


if __name__ == "__main__":
    main()

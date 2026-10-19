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
"""Do higher poverty NYC census tracts have differential access to early voting poll sites?

One question, several access measures: the site BOE assigns a tract's election district to is outside the tract, or more than a quarter, half, or whole mile away.
Loads the sources (see nyc_tracts/assembly/dataset.py; borough layers only, the low and zero population layers are excluded), downloads the BOE assignments (needs `pdftotext`
from poppler) and election district polygons, and splits tracts along district boundaries. Downloads come from the cache, so a rerun needs no network access and no API keys.
Writes nyc_tracts_poll_access.report.json and .report.md next to this script.

Run with `uv run nyc_tracts_poll_access.py`; tests with `uv run run_tests.py`.
Code lives in the nyc_tracts package (geography, disparity_hypotheses, presentation).
"""

import argparse
import json
import os
from pathlib import Path

from nyc_tracts.assembly.dataset import add_dataset_arguments, load_from_args
from nyc_tracts.disparity_hypotheses.access import analyze_access, distinct_sites
from nyc_tracts.geography.boe import assigned_sites, read_assignments, read_election_districts
from nyc_tracts.geography.tract_district import overlay_tracts
from nyc_tracts.presentation.report import render_md


def main() -> None:
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(description=(__doc__ or "").split("\n")[0])
    add_dataset_arguments(ap, Path(here) / ".cache")
    ap.add_argument("--out-dir", default=here)
    args = ap.parse_args()
    data = load_from_args(args)
    districts = read_election_districts()
    site_of = assigned_sites(districts, read_assignments(), data.sites())
    tracts = data.tracts()
    divided = overlay_tracts(tracts, districts, site_of)
    report = analyze_access(tracts, divided, distinct_sites(site_of))
    with open(os.path.join(args.out_dir, "nyc_tracts_poll_access.report.json"), "w", encoding="utf-8") as fh:
        json.dump(report.to_json(), fh, indent=2)
    md = render_md(report)
    with open(os.path.join(args.out_dir, "nyc_tracts_poll_access.report.md"), "w", encoding="utf-8") as fh:
        fh.write(md)
    print(md)


if __name__ == "__main__":
    main()

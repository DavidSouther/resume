#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = [
#   "shapely>=2.0",       # tract and election district overlay
#   "jinja2>=3.1",        # report template
#   "httpx>=0.27",        # downloads the BOE PDFs and the election district layer
#   "tenacity>=8.2",      # retries for httpx
# ]
# ///
"""Disparate impact tests against the real early voting assignment: is a higher poverty tract more likely to be assigned to a site in a different tract?

Downloads (into the .cache/ source cache, see --refresh) the five BOE early voting poll site list PDFs, which assign every
election district to one early voting site, and the DCP election district polygons, and joins them to the tracts and poll sites
(see nyc_tracts/dataset.py). Needs the `pdftotext` command line tool (poppler). Writes nyc_tracts_poll_assignment.report.json and .report.md
next to this script.

Run with `uv run nyc_tracts_poll_assignment.py`.
"""

import argparse
import json
import os
from dataclasses import asdict
from pathlib import Path

from nyc_tracts.assignment import analyze_assignment, read_election_districts
from nyc_tracts.dataset import add_dataset_arguments, load_from_args
from nyc_tracts.early_voting import read_assignments
from nyc_tracts.hypotheses import ALPHA, HIGH_POVERTY
from nyc_tracts.report import environment, summarize


def main() -> None:
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(description=(__doc__ or "").split("\n")[0])
    add_dataset_arguments(ap, Path(here) / ".cache")
    ap.add_argument("--out-dir", default=here)
    args = ap.parse_args()
    data = load_from_args(args)
    report, extras, _ = analyze_assignment(data.tracts(), read_election_districts(), read_assignments(), data.sites())
    with open(os.path.join(args.out_dir, "nyc_tracts_poll_assignment.report.json"), "w", encoding="utf-8") as fh:
        json.dump({**report.to_json(), "assignment": asdict(extras)}, fh, indent=2)
    md = environment().get_template("assignment.md.j2").render(r=report, x=extras, s=summarize(report), ALPHA=ALPHA, HIGH_POVERTY=HIGH_POVERTY)
    with open(os.path.join(args.out_dir, "nyc_tracts_poll_assignment.report.md"), "w", encoding="utf-8") as fh:
        fh.write(md)
    print(md)


if __name__ == "__main__":
    main()

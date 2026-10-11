#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = ["shapely>=2.0", "jinja2>=3.1", "httpx>=0.27", "tenacity>=8.2"]
# ///
"""Write nyc_assignment.geojson and nyc_poll_sites.geojson to public/nyc_polling/, the only files the web map loads.

Loads the sources (see nyc_tracts/dataset.py), assigns every election district piece of a tract to its early voting site, and writes the
pieces and the located poll sites as GeoJSON. Needs `pdftotext` (poppler) for the BOE assignment PDFs.

Run with `uv run nyc_tracts_geojson.py`.
"""

import argparse
import os
from pathlib import Path

from nyc_tracts.assignment import analyze_assignment, assigned_sites, read_election_districts, subdivide
from nyc_tracts.dataset import add_dataset_arguments, load_from_args
from nyc_tracts.early_voting import read_assignments
from nyc_tracts.geojson import build


def main() -> None:
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(description=(__doc__ or "").split("\n")[0])
    add_dataset_arguments(ap, Path(here) / ".cache")
    ap.add_argument("--out-dir", default=os.path.join(here, "..", "..", "public", "nyc_polling"), help="where the GeoJSON is written, and shipped from")
    ap.add_argument("--precision", type=int, default=5, help="coordinate decimals (default 5)")
    args = ap.parse_args()
    data = load_from_args(args)
    districts, assignments = read_election_districts(), read_assignments()
    _, _, pieces = analyze_assignment(data.tracts(), districts, assignments, data.sites())
    low = subdivide(data.excluded_tracts().get("low population", []), districts, assigned_sites(districts, assignments, data.sites())).subdivisions
    os.makedirs(args.out_dir, exist_ok=True)
    for name, n in build(data, pieces, low, args.out_dir, args.precision).items():
        print(f"{name}: {n} features")


if __name__ == "__main__":
    main()

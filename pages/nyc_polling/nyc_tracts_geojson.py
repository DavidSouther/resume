#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = ["shapely>=2.0", "jinja2>=3.1", "httpx>=0.27", "tenacity>=8.2"]
# ///
"""Write nyc_assignment.geojson, nyc_poll_sites.geojson and nyc_scatter.json and nyc_tract_districts.csv to public/nyc_polling/, the only files the web pages load.

Loads the sources (see nyc_tracts/dataset.py), assigns every election district piece of a tract to its early voting site, and writes the
pieces and the located poll sites as GeoJSON. Needs `pdftotext` (poppler) for the BOE assignment PDFs.

Run with `uv run nyc_tracts_geojson.py`.
"""

import argparse
import os
from pathlib import Path

from nyc_tracts.assembly.dataset import add_dataset_arguments, load_from_args
from nyc_tracts.geography.boe import assigned_sites, read_assignments, read_election_districts
from nyc_tracts.geography.tract_district import overlay_tracts
from nyc_tracts.presentation.geojson import build
from nyc_tracts.presentation.scatter import CSV_OUT, write_csv, write_scatter
from nyc_tracts.presentation.scatter import OUT as SCATTER_OUT


def main() -> None:
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(description=(__doc__ or "").split("\n")[0])
    add_dataset_arguments(ap, Path(here) / ".cache")
    ap.add_argument("--out-dir", default=os.path.join(here, "..", "..", "public", "nyc_polling"), help="where the GeoJSON is written, and shipped from")
    ap.add_argument("--precision", type=int, default=5, help="coordinate decimals (default 5)")
    args = ap.parse_args()
    data = load_from_args(args)
    districts, assignments = read_election_districts(), read_assignments()
    site_of = assigned_sites(districts, assignments, data.sites())
    pieces = overlay_tracts(data.tracts(), districts, site_of).tract_districts
    low = overlay_tracts(data.excluded_tracts().get("low population", []), districts, site_of).tract_districts
    os.makedirs(args.out_dir, exist_ok=True)
    for name, n in build(data, pieces, low, args.out_dir, args.precision).items():
        print(f"{name}: {n} features")
    print(f"{SCATTER_OUT}: {write_scatter(pieces, args.out_dir)} points")
    print(f"{CSV_OUT}: {write_csv(pieces, args.out_dir)} rows")


if __name__ == "__main__":
    main()

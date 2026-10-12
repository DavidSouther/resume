#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = [
#   "shapely>=2.0",    # point in polygon for poll sites
#   "httpx>=0.27",     # HTTP
#   "tenacity>=8.2",   # retries
# ]
# ///
"""Load the Census, tract boundary, and early voting poll site sources and write the load report.

Tracts (NYC DCP 2020 vintage) carry ACS 2024 5-year poverty rate, median household income, and population. Poll sites come from a public
Google My Maps layer and are geocoded with the Google Geocoding API when the source has no Point; each is placed in the census tract that
contains it. The report, nyc_tracts_poll_sites.report.json next to this script, lists joins, geocoded sites, failures, and exclusions.

Run with `uv run nyc_tracts_poll_sites.py`. The Census Data API requires a free key (https://api.census.gov/data/key_signup.html): pass
--census-key or set CENSUS_API_KEY. Geocoding needs a Google Geocoding API key: pass --google-key or set GOOGLE_MAPS_API_KEY. Both are needed only for
sources that are not in the cache (see --cache-dir, --refresh).
"""

import argparse
import json
import os
import sys
from pathlib import Path

from nyc_tracts.assembly.dataset import add_dataset_arguments, load_from_args
from nyc_tracts.generic.net import MissingKeyError


def main() -> None:
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(description=(__doc__ or "").split("\n")[0])
    ap.add_argument("--skip-polls", action="store_true", help="tracts only")
    add_dataset_arguments(ap, Path(here) / ".cache")
    args = ap.parse_args()
    try:
        data = load_from_args(args, skip_polls=args.skip_polls)
    except (MissingKeyError, RuntimeError, ValueError) as e:
        sys.exit(str(e))
    with open(os.path.join(here, "nyc_tracts_poll_sites.report.json"), "w", encoding="utf-8") as fh:
        json.dump(data.report, fh, indent=2)


if __name__ == "__main__":
    main()

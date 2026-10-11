"""The data the analyses and the map share: tracts with their ACS facts and located poll sites, loaded straight from the sources.

Nothing is written between steps. Every script calls `load_dataset`, and the HTTP cache (see net.py) keeps the downloads, including
the geocoder answers, so a rerun is fast, offline, and does not call a paid API again.
"""

import argparse
import os
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import NotRequired, TypedDict

from . import net
from .boundaries import TractFeature, fetch_tracts, fetch_tracts_shoreline
from .census import COUNTIES, AcsRow, fetch_acs
from .domain import Site, Tract
from .geo import PointLocator
from .layers import LOW_POPULATION, TractLayers, build_layers
from .poll_sites import POLL_URL, Excluded, Geocoded, GeocodeFailure, PollSite, election_flag, geocode_sites, parse_poll_sites


class FlaggedSite(TypedDict):
    name: str
    borough: str | None
    flag: str


class LoadReport(TypedDict):
    """Written to nyc_tracts_poll_sites.report.json. The poll site keys are absent with --skip-polls."""

    warnings: list[str]
    boundary_without_acs: list[str]
    acs_without_boundary: list[str]
    low_population_cutoff: int
    tracts_zero_population: list[dict[str, object]]
    tracts_low_population: list[dict[str, object]]
    tracts_written: int
    tracts_by_borough: dict[str, int]
    poverty_class_counts: dict[str, int]
    source_placemarks: NotRequired[int]
    poll_sites_in_source: NotRequired[int]
    poll_sites_located: NotRequired[int]
    with_source_point: NotRequired[int]
    geocoded: NotRequired[list[Geocoded]]
    sites_without_tract: NotRequired[list[str]]
    geocode_failed: NotRequired[list[GeocodeFailure]]
    excluded: NotRequired[list[Excluded]]
    election_field_flagged: NotRequired[list[FlaggedSite]]


@dataclass(frozen=True)
class LoadOptions:
    census_key: str = ""
    google_key: str | None = None
    skip_polls: bool = False
    counties: tuple[str, ...] = tuple(COUNTIES)
    boundaries: str = "shoreline"  # or "tiger"
    low_population: int = LOW_POPULATION

    def validate(self) -> None:
        bad = [c for c in self.counties if c not in COUNTIES]
        if bad:
            raise ValueError(f"unknown county codes: {bad}")


@dataclass
class Dataset:
    layers: TractLayers
    polls: list[PollSite] = field(default_factory=list[PollSite])  # located poll sites, with their tract
    report: LoadReport | None = None

    def tracts(self) -> list[Tract]:
        """The tracts the analyses use: the borough layers."""
        return sorted((t for ts in self.layers.by_borough.values() for t in ts), key=lambda t: t.geoid)

    def sites(self) -> list[Site]:
        return [Site(p.name, p.lonlat[0], p.lonlat[1]) for p in self.polls if p.lonlat]

    def excluded_tracts(self) -> dict[str, list[Tract]]:
        """Zero and low population layers, which are outside the analysis."""
        return {k: v for k, v in {"zero population": self.layers.zero, "low population": self.layers.low}.items() if v}


def locate_sites(sites: list[PollSite], feats: list[TractFeature], acs: dict[str, AcsRow]) -> tuple[list[PollSite], list[str]]:
    """Attach the containing tract and its ACS row to each located site. Returns (sites, names of sites in no tract)."""
    locator = PointLocator([f.geometry() for f in feats])
    out: list[PollSite] = []
    no_tract: list[str] = []
    for s in sites:
        if s.lonlat is None:
            out.append(s)
            continue
        i = locator.find(*s.lonlat)
        geoid = feats[i].geoid if i is not None else None
        out.append(replace(s, geoid=geoid, acs=acs.get(geoid) if geoid else None))
        if geoid is None:
            no_tract.append(s.name)
    return out, no_tract


def load_dataset(opts: LoadOptions) -> Dataset:
    opts.validate()
    counties = list(opts.counties)
    print("Loading ACS 2024 5-year S1701/S1901 ...")
    acs = {g: r for g, r in fetch_acs(opts.census_key).items() if g[2:5] in counties}
    print(f"  ACS rows: {len(acs)}")
    print(f"Loading 2020 tract boundaries ({opts.boundaries}) ...")
    feats = fetch_tracts_shoreline(counties) if opts.boundaries == "shoreline" else fetch_tracts(counties)
    print(f"  Boundary features: {len(feats)}")

    boundary_ids = {f.geoid for f in feats}
    boundary_without_acs = sorted(boundary_ids - acs.keys())
    acs_without_boundary = sorted(acs.keys() - boundary_ids)
    print(f"  Boundaries with no ACS row: {len(boundary_without_acs)} {boundary_without_acs[:10]}")
    print(f"  ACS rows with no boundary: {len(acs_without_boundary)} {acs_without_boundary[:10]}")

    layers = build_layers(feats, acs, opts.low_population)
    report: LoadReport = {
        "warnings": [],
        "boundary_without_acs": boundary_without_acs,
        "acs_without_boundary": acs_without_boundary,
        "low_population_cutoff": opts.low_population,
        "tracts_zero_population": layers.zero_report,
        "tracts_low_population": layers.low_report,
        "tracts_written": layers.mapped,
        "tracts_by_borough": {b: len(v) for b, v in layers.by_borough.items()},
        "poverty_class_counts": layers.class_count_report(),
    }
    print(f"  Zero population: {len(layers.zero_report)}; low population (under {opts.low_population}): {len(layers.low_report)}")
    print(f"  Tracts mapped: {layers.mapped}; by class: {report['poverty_class_counts']}")
    data = Dataset(layers, report=report)
    if opts.skip_polls:
        return data

    print("Loading poll sites ...")
    sites, excluded, total = parse_poll_sites(net.get(POLL_URL).content)
    print(f"  Source placemarks: {total}; poll sites: {len(sites)}; excluded: {len(excluded)}")
    flagged: list[FlaggedSite] = [{"name": s.name, "borough": s.ext.get("Borough"), "flag": flag} for s in sites if (flag := election_flag(s.ext.get("Election", "")))]
    sites, geocoded, failed = geocode_sites(sites, opts.google_key)
    if failed and not opts.google_key:
        first = failed[0]
        raise RuntimeError(
            f"{len(failed)} poll sites are not in the source cache and need a Google Geocoding API key (--google-key or GOOGLE_MAPS_API_KEY), for example {first['name']!r}: {first['reason']}"
        )
    sites, no_tract = locate_sites(sites, feats, acs)
    data.polls = [s for s in sites if s.lonlat]
    report["source_placemarks"] = total
    report["poll_sites_in_source"] = len(sites)
    report["poll_sites_located"] = len(data.polls)
    report["with_source_point"] = sum(1 for s in sites if s.source == "kml")
    report["geocoded"] = geocoded
    report["sites_without_tract"] = no_tract
    report["geocode_failed"] = failed
    report["excluded"] = excluded
    report["election_field_flagged"] = flagged
    print(f"  Source points: {report['with_source_point']}; geocoded: {len(geocoded)}; sites outside tracts: {len(no_tract)}; geocode failures: {len(failed)}")
    print(f"  Election field flagged: {len(flagged)}; poll sites located: {len(data.polls)}")
    return data


def add_dataset_arguments(ap: argparse.ArgumentParser, cache_dir: Path) -> None:
    """The source options every script shares."""
    ap.add_argument("--counties", default=",".join(COUNTIES), help="comma-separated county codes (default all five)")
    ap.add_argument(
        "--boundaries", choices=["shoreline", "tiger"], default="shoreline", help="shoreline: NYC DCP tracts clipped to the shoreline (default); tiger: TIGERweb full extent, including water"
    )
    ap.add_argument(
        "--low-population", type=int, default=LOW_POPULATION, help=f"tracts whose poverty universe is below this are low population (default {LOW_POPULATION}, the Census standard tract minimum)"
    )
    ap.add_argument("--census-key", default=os.environ.get("CENSUS_API_KEY", ""), help="needed only when the ACS download is not in the cache")
    ap.add_argument("--google-key", default=os.environ.get("GOOGLE_MAPS_API_KEY"), help="Google Geocoding API key, needed only for poll sites not in the cache")
    net.add_cache_arguments(ap, cache_dir)


def load_from_args(args: argparse.Namespace, skip_polls: bool = False) -> Dataset:
    net.use_cache_from(args)
    return load_dataset(
        LoadOptions(
            census_key=args.census_key,
            google_key=args.google_key,
            skip_polls=skip_polls,
            counties=tuple(c.strip() for c in args.counties.split(",") if c.strip()),
            boundaries=args.boundaries,
            low_population=args.low_population,
        )
    )

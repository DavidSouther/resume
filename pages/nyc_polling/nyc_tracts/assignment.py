"""Tract by election district subdivisions, each tested against how far they are from the early voting site their district is assigned to.

`hypotheses.py` tests whether a poll site lies inside a tract. Here the unit of analysis is the
subdivision: the overlap of one census tract with one election district (ED). BOE assigns every ED to
one early voting site, so each subdivision has exactly one assigned site. A tract inside a single ED is
one subdivision; a tract that spans EDs is split along the district boundaries. A subdivision keeps
its tract's poverty rate and income, on the assumption that they hold across both sides of the split.

The adverse outcome is an assigned site more than a quarter mile away, a walk that is hard for people with
limited mobility in NYC. Whether the assigned site is inside the subdivision's own tract is a related test.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import cast

from shapely import Point, STRtree, make_valid
from shapely.geometry import shape
from shapely.geometry.base import BaseGeometry

from . import net
from .domain import Observation, Site, Tract
from .early_voting import EdAssignment, normalize_address, sites_by_assignment
from .hypotheses import HIGH_POVERTY, run_hypotheses, site_tracts
from .poverty import POVERTY_LABELS, class_index
from .results import Hypothesis, Report

ED_URL = "https://data.cityofnewyork.us/resource/wwxk-38u4.geojson?$limit=5000"  # DCP election districts, shoreline clipped
# Tract and district boundaries disagree by a few meters along shared edges. Those overlaps are thin
# slivers (under 5 m wide, 0.06% of the area), not real subdivisions, so pieces narrower than this are dropped.
SLIVER_WIDTH_M = 10.0
METERS_PER_DEGREE = 98_000  # between a degree of latitude (111 km) and of longitude (84 km) at NYC's latitude

QUARTER_MILE = 0.25
DISTANCE_TESTS = (("H3", 0.5), ("H4", 1.0))
CUTOFFS_MI = (QUARTER_MILE, 0.5, 1.0)
QUESTIONS = {
    "H0": "Higher poverty subdivisions are more likely to be assigned, by election district, to an early voting site more than a quarter mile away (from the subdivision's centroid).",
    "H1": "Collapsing to two groups ({cut}% poverty cut), high poverty subdivisions are assigned to a site more than a quarter mile away more often.",
    "H2": "The H1 gap persists inside each borough (not an artifact of borough composition). Mantel-Haenszel across boroughs.",
    "H3": "Higher poverty subdivisions are assigned to a site more than {miles} mile away (from the subdivision's centroid).",
    "H5": "Higher poverty subdivisions are more likely to be assigned to an early voting site in a different tract (the in-tract test).",
    "H6": "Lower median household income subdivisions (quintiles) are assigned to a site more than a quarter mile away more often; tests whether the baseline depends on the poverty measure.",
}


@dataclass(frozen=True)
class ElectionDistrict:
    elect_dist: int  # AD * 1000 + ED
    geometry: BaseGeometry


@dataclass(frozen=True)
class Subdivision:
    """One tract within one election district."""

    tract: Tract
    elect_dist: int
    geometry: BaseGeometry
    site: Site  # the early voting site the election district is assigned to
    site_in_tract: bool
    miles: float  # centroid of the subdivision to its assigned site

    def observation(self) -> Observation:
        return Observation(self.tract, self.site_in_tract, self.miles)


@dataclass(frozen=True)
class Subdivided:
    subdivisions: list[Subdivision]
    uncovered: list[Tract]  # tracts that overlap no election district
    slivers_dropped: int
    sliver_area_share: float


@dataclass
class AssignmentExtras:
    tracts: int
    split_tracts: int  # tracts that span more than one election district
    subdivisions: int
    tracts_without_district: int
    slivers_dropped: int
    sliver_area_share: float
    far_area_share_by_class: list[dict[str, object]]  # poverty class, subdivisions, share of their area over a quarter mile from the assigned site
    far_rates_by_class: list[dict[str, object]]  # poverty class, subdivisions, then the share of subdivisions over each cutoff in CUTOFFS_MI


def read_election_districts() -> list[ElectionDistrict]:
    features = cast(list[dict[str, dict[str, object]]], cast(dict[str, object], net.get_json(ED_URL, timeout=180))["features"])
    return [ElectionDistrict(int(str(f["properties"]["elect_dist"])), make_valid(shape(f["geometry"]))) for f in features]


def _is_sliver(piece: BaseGeometry) -> bool:
    """Width of a thin shape is about twice its area over its perimeter."""
    return piece.length == 0 or 2 * piece.area / piece.length * METERS_PER_DEGREE < SLIVER_WIDTH_M


def subdivide(tracts: Sequence[Tract], districts: Sequence[ElectionDistrict], site_of: Mapping[int, Site]) -> Subdivided:
    tree = STRtree([d.geometry for d in districts])
    kept: list[Subdivision] = []
    uncovered: list[Tract] = []
    slivers, sliver_area, total_area = 0, 0.0, 0.0
    for t in tracts:
        geometry = make_valid(t.geometry)  # source rings can self touch
        before = len(kept)
        for i in tree.query(geometry, predicate="intersects"):
            district = districts[int(i)]
            piece = geometry.intersection(district.geometry)
            if piece.is_empty or piece.area == 0:
                continue
            total_area += piece.area
            if _is_sliver(piece):
                slivers += 1
                sliver_area += piece.area
                continue
            site = site_of[district.elect_dist]
            kept.append(Subdivision(t, district.elect_dist, piece, site, geometry.contains(Point(site.lon, site.lat)), site.miles_to(piece.centroid.x, piece.centroid.y)))
        if len(kept) == before:
            uncovered.append(t)
    return Subdivided(kept, uncovered, slivers, sliver_area / total_area if total_area else 0.0)


def _far(o: Observation) -> bool:
    return o.nearest_mi > QUARTER_MILE


def _far_rates_by_class(obs: Sequence[Observation]) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for idx, label in enumerate(POVERTY_LABELS):
        group = [o for o in obs if o.tract.poverty is not None and class_index(o.tract.poverty) == idx]
        rows.append({"group": label, "subdivisions": len(group), "rates": [sum(1 for o in group if o.nearest_mi > m) / len(group) if group else None for m in CUTOFFS_MI]})
    return rows


def _far_area_share_by_class(subs: Sequence[Subdivision]) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for idx, label in enumerate(POVERTY_LABELS):
        group = [s for s in subs if s.tract.poverty is not None and class_index(s.tract.poverty) == idx]
        area = sum(s.geometry.area for s in group)
        far = sum(s.geometry.area for s in group if s.miles > QUARTER_MILE)
        rows.append({"group": label, "subdivisions": len(group), "far_area_share": far / area if area else None})
    return rows


def _requestion(h: Hypothesis, cut: float) -> None:
    """Replace the in-tract wording of a hypothesis question with the assignment wording."""
    key = h.name.split()[0]
    if key in ("H3", "H4"):
        h.question = QUESTIONS["H3"].format(miles=h.name.split()[-2])
    elif key in QUESTIONS:
        h.question = QUESTIONS[key].format(cut=f"{cut:.0f}")


def assigned_sites(districts: Sequence[ElectionDistrict], assignments: Sequence[EdAssignment], sites: Sequence[Site]) -> dict[int, Site]:
    """The early voting site each election district is assigned to."""
    by_address = sites_by_assignment(assignments, sites)
    site_of = {a.elect_dist: by_address[normalize_address(a.site_address)] for a in assignments}
    missing = {d.elect_dist for d in districts} - site_of.keys()
    if missing:
        raise RuntimeError(f"{len(missing)} election districts have no assigned early voting site, for example {sorted(missing)[:5]}")
    return site_of


def analyze_assignment(
    tracts: Sequence[Tract], districts: Sequence[ElectionDistrict], assignments: Sequence[EdAssignment], sites: Sequence[Site]
) -> tuple[Report, AssignmentExtras, list[Subdivision]]:
    by_address = sites_by_assignment(assignments, sites)
    site_of = assigned_sites(districts, assignments, sites)
    divided = subdivide(tracts, districts, site_of)
    obs = [s.observation() for s in divided.subdivisions]
    baseline, related = run_hypotheses(obs, _far, DISTANCE_TESTS, out_of_tract_test=True)
    for h in [baseline, *related]:
        _requestion(h, HIGH_POVERTY)
    used = list(by_address.values())
    outside = [s for s, t in zip(used, site_tracts(tracts, used), strict=True) if t is None]
    pov = [o for o in obs if o.tract.poverty is not None]
    report = Report(
        tracts_loaded=len(tracts),
        tracts_analyzed=len(pov),
        tracts_with_income=sum(1 for o in pov if o.tract.income is not None),
        poll_sites=len(used),
        poll_sites_outside_tracts=len(outside),
        sites_in_excluded_layers={},
        outside_sites=[s.name for s in outside],
        tracts_with_site=sum(1 for o in pov if not _far(o)),  # here: within a quarter mile of the assigned site
        baseline=baseline,
        related=related,
    )
    per_tract: dict[str, int] = {}
    for s in divided.subdivisions:
        per_tract[s.tract.geoid] = per_tract.get(s.tract.geoid, 0) + 1
    extras = AssignmentExtras(
        tracts=len(per_tract),
        split_tracts=sum(1 for n in per_tract.values() if n > 1),
        subdivisions=len(divided.subdivisions),
        tracts_without_district=len(divided.uncovered),
        slivers_dropped=divided.slivers_dropped,
        sliver_area_share=divided.sliver_area_share,
        far_area_share_by_class=_far_area_share_by_class(divided.subdivisions),
        far_rates_by_class=_far_rates_by_class(obs),
    )
    return report, extras, divided.subdivisions

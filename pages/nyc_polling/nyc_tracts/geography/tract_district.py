"""Find overlap of election districts and census tracts. Each overlap is a TractDistrict: one census tract within one election district.

The BOE assigns every ED to one early voting site. A census tract spans one or more election districts
(and vice versa).  A tract that spans EDs is split along the district boundaries. A tract district keeps
the tract's poverty rate and income, on the assumption that they hold across both sides of the split.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass

from shapely import Point, STRtree, make_valid
from shapely.geometry.base import BaseGeometry

from ..kernel.domain import Observation, Site, Tract
from .boe import ElectionDistrict

# Tract and district boundaries disagree by a few meters along shared edges. Those overlaps are thin
# slivers (under 5 m wide, 0.06% of the area), not real tract districts, so pieces narrower than this are dropped.
SLIVER_WIDTH_M = 10.0
METERS_PER_DEGREE = 98_000  # between a degree of latitude (111 km) and of longitude (84 km) at NYC's latitude


@dataclass(frozen=True)
class TractDistrict:
    """One tract within one election district."""

    tract: Tract
    elect_dist: int
    geometry: BaseGeometry
    site: Site  # the early voting site the election district is assigned to
    site_in_tract: bool
    miles: float  # centroid of the tract district to its assigned site

    def observation(self) -> Observation:
        return Observation(self.tract, self.site_in_tract, self.miles)


@dataclass(frozen=True)
class TractDistricts:
    tract_districts: list[TractDistrict]
    uncovered: list[Tract]  # tracts that overlap no election district
    slivers_dropped: int
    sliver_area_share: float


def _is_sliver(piece: BaseGeometry) -> bool:
    """Width of a thin shape is about twice its area over its perimeter."""
    return piece.length == 0 or 2 * piece.area / piece.length * METERS_PER_DEGREE < SLIVER_WIDTH_M


def overlay_tracts(tracts: Sequence[Tract], districts: Sequence[ElectionDistrict], site_of: Mapping[int, Site]) -> TractDistricts:
    tree = STRtree([d.geometry for d in districts])
    kept: list[TractDistrict] = []
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
            kept.append(TractDistrict(t, district.elect_dist, piece, site, geometry.contains(Point(site.lon, site.lat)), site.miles_to(piece.centroid.x, piece.centroid.y)))
        if len(kept) == before:
            uncovered.append(t)
    return TractDistricts(kept, uncovered, slivers, sliver_area / total_area if total_area else 0.0)

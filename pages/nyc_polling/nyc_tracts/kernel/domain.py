"""Domain types for NYC tract and poll site analysis."""

import math
from collections.abc import Sequence
from dataclasses import dataclass
from typing import NewType

from shapely.geometry.base import BaseGeometry

GeoId = NewType("GeoId", str)
Borough = NewType("Borough", str)

EARTH_RADIUS_MI = 3958.8


def haversine_mi(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_MI * math.asin(math.sqrt(a))


@dataclass(frozen=True)
class Site:
    name: str
    lon: float
    lat: float

    def miles_to(self, lon: float, lat: float) -> float:
        return haversine_mi(lon, lat, self.lon, self.lat)


@dataclass(frozen=True)
class Tract:
    geoid: GeoId
    borough: Borough | None
    poverty: float | None
    income: float | None
    geometry: BaseGeometry
    centroid: tuple[float, float]  # (lon, lat), area weighted in a local equirectangular projection
    population: float | None = None  # people for whom poverty status is determined
    poverty_moe: float | None = None  # 90% margin of error, in percentage points
    income_moe: float | None = None

    def nearest_site_mi(self, sites: Sequence[Site]) -> float:
        return min(s.miles_to(*self.centroid) for s in sites)


@dataclass(frozen=True)
class Observation:
    """One unit of analysis: a tract (or a piece of it) with the early voting site its voters are assigned to."""

    tract: Tract
    site_in_tract: bool  # the assigned site lies inside the tract
    miles: float  # centroid to the assigned site

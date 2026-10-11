"""Point in polygon lookups."""

import math
from collections.abc import Sequence

from shapely import Point, STRtree
from shapely.affinity import scale
from shapely.geometry import MultiPolygon
from shapely.geometry.base import BaseGeometry


class PointLocator:
    """Finds which geometry contains a point. Where geometries overlap, the earliest one wins."""

    def __init__(self, geometries: Sequence[BaseGeometry]):
        self._tree = STRtree(list(geometries))

    def find(self, lon: float, lat: float) -> int | None:
        hits = self._tree.query(Point(lon, lat), predicate="intersects")
        return int(min(hits)) if len(hits) else None


def centroid_of(geom: MultiPolygon) -> tuple[float, float]:
    """Area weighted centroid, computed with longitude scaled by cos(latitude) so degrees are comparable."""
    cos0 = math.cos(math.radians(sum(g.exterior.coords[0][1] for g in geom.geoms) / len(geom.geoms)))
    c = scale(geom, xfact=cos0, yfact=1, origin=(0, 0)).centroid
    return c.x / cos0, c.y

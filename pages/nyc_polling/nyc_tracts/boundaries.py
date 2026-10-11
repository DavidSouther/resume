"""2020 census tract boundaries (NYC DCP shoreline-clipped, or TIGERweb full extent)."""

import urllib.parse
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal, NotRequired, TypedDict, cast

from shapely import Polygon
from shapely.geometry import MultiPolygon

from . import net
from .census import STATE

# Layer 10 is "Census Tracts; 2020 Census - January 1, 2020 vintage". Layer 0 is the
# current (2026) vintage, which can drift from ACS 2024 geography.
TIGER_URL = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer/10/query"
# NYC DCP "2020 Census Tracts", clipped to the shoreline (no harbor or river water). It omits
# tracts that are entirely under water. Same 2020 tract geography and GEOIDs as TIGERweb.
SHORELINE_URL = "https://data.cityofnewyork.us/resource/63ge-mke6.geojson"


class PolygonGeometry(TypedDict):
    type: Literal["Polygon"]
    coordinates: list[list[list[float]]]  # rings of [lon, lat] positions


class MultiPolygonGeometry(TypedDict):
    type: Literal["MultiPolygon"]
    coordinates: list[list[list[list[float]]]]


Geometry = PolygonGeometry | MultiPolygonGeometry


class TigerProperties(TypedDict):
    GEOID: str
    NAME: str
    COUNTY: str


class TigerFeature(TypedDict):
    properties: TigerProperties
    geometry: Geometry


class TigerPage(TypedDict):
    features: NotRequired[list[TigerFeature]]
    error: NotRequired[object]
    exceededTransferLimit: NotRequired[bool]


class ShorelineProperties(TypedDict):
    geoid: str
    ctlabel: str


class ShorelineFeature(TypedDict):
    properties: ShorelineProperties
    geometry: Geometry


class ShorelinePage(TypedDict):
    features: list[ShorelineFeature]


Ring = list[tuple[float, float]]
RingSet = list[Ring]  # [outer, hole, ...]


@dataclass(frozen=True)
class TractFeature:
    geoid: str
    name: str
    county: str
    polygons: list[RingSet]

    def geometry(self) -> MultiPolygon:
        return MultiPolygon([Polygon(rings[0], rings[1:]) for rings in self.polygons])


def signed_area(ring: Sequence[tuple[float, float]]) -> float:
    return sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(ring, [*ring[1:], ring[0]], strict=True)) / 2


def polygons_of(geom: Geometry) -> list[RingSet]:
    """Return a list of polygons, each [outer, hole, ...]. Rings in a GeoJSON Polygon
    with the same winding as the first ring are treated as separate outer rings."""
    kind = cast(str, geom["type"])  # the payload is untrusted, so the Literal may be wrong at runtime
    if geom["type"] == "Polygon":
        raw = [geom["coordinates"]]
    elif geom["type"] == "MultiPolygon":
        raw = geom["coordinates"]
    else:
        raise ValueError(f"unsupported geometry {kind}")
    out: list[RingSet] = []
    for rings in raw:
        if not rings:
            continue
        clean = [[(p[0], p[1]) for p in ring] for ring in rings]
        first = signed_area(clean[0]) >= 0
        for ring in clean:
            if (signed_area(ring) >= 0) == first:
                out.append([ring])
            elif out:
                out[-1].append(ring)
    return out


def feature(geoid: str, name: str, county: str, geometry: Geometry) -> TractFeature:
    return TractFeature(geoid, name, county, polygons_of(geometry))


def fetch_tracts(counties: Sequence[str], page: int = 500) -> list[TractFeature]:
    feats: list[TractFeature] = []
    for county in counties:
        offset = 0
        while True:
            qs = urllib.parse.urlencode(
                {
                    "where": f"STATE='{STATE}' AND COUNTY='{county}'",
                    "outFields": "GEOID,NAME,COUNTY",
                    "outSR": "4326",
                    "f": "geojson",
                    "geometryPrecision": "7",
                    "orderByFields": "GEOID",
                    "resultOffset": str(offset),
                    "resultRecordCount": str(page),
                }
            )
            data = cast(TigerPage, net.get_json(f"{TIGER_URL}?{qs}"))
            if "error" in data:
                raise RuntimeError(f"TIGERweb error: {data['error']}")
            got = data.get("features", [])
            feats.extend(feature(f["properties"]["GEOID"], f["properties"]["NAME"], f["properties"]["COUNTY"], f["geometry"]) for f in got)
            if not got or not (data.get("exceededTransferLimit") or len(got) == page):
                break
            offset += len(got)
    return feats


def fetch_tracts_shoreline(counties: Sequence[str]) -> list[TractFeature]:
    raw: list[ShorelineFeature] = []
    for offset in range(0, 100000, 1000):
        url = f"{SHORELINE_URL}?{urllib.parse.urlencode({'$limit': 1000, '$offset': offset, '$order': 'geoid'})}"
        data = cast(ShorelinePage, net.get_json(url, timeout=30))
        raw.extend(data["features"])
        if len(data["features"]) < 1000:
            break
    return [feature(f["properties"]["geoid"], f"Census Tract {f['properties']['ctlabel']}", f["properties"]["geoid"][2:5], f["geometry"]) for f in raw if f["properties"]["geoid"][2:5] in counties]

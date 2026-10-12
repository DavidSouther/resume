"""GeoJSON for the web map, built from the dataset and the assignment pieces.

Features carry raw numbers (population, poverty rate, income, miles), not HTML. The page builds its cards from them.
"""

import json
import os
import re
from collections.abc import Sequence
from typing import Any

from shapely import MultiPolygon, Polygon
from shapely.geometry.base import BaseGeometry
from shapely.geometry.polygon import orient

from ..assembly.dataset import Dataset
from ..geography.tract_district import TractDistrict
from ..kernel.domain import Tract
from ..kernel.poverty import CLASSES, MISSING_COLOR, MISSING_LABEL, ZERO_POP_COLOR, class_index
from ..poll_site_registry.poll_sites import PollSite
from .bands import BANDS, band_index
from .combined import cells, combined_fill

LOW = "Low population"
ZERO = "Zero population"
OUT = {"assignment": "nyc_assignment.geojson", "polls": "nyc_poll_sites.geojson"}


def _polygons(geom: BaseGeometry) -> list[Polygon]:
    """Polygons of a shapely geometry. Lines and points left by an intersection are dropped."""
    if isinstance(geom, Polygon):
        parts = [geom]
    elif isinstance(geom, MultiPolygon):
        parts = list(geom.geoms)
    else:
        parts = [g for g in getattr(geom, "geoms", []) if isinstance(g, Polygon)]
    return [p for p in parts if not p.is_empty]


def polygon_geometry(geom: BaseGeometry) -> dict[str, Any]:
    polys = [orient(p) for p in _polygons(geom)]
    return {"type": "MultiPolygon", "coordinates": [[[list(c) for c in ring.coords] for ring in (p.exterior, *p.interiors)] for p in polys]}


def _whole(n: float | None) -> int | None:
    return None if n is None else round(n)


def _centroid(geom: BaseGeometry) -> list[float]:
    """[lon, lat] where the page opens a popup for this shape."""
    c = geom.centroid
    return [c.x, c.y]


def _clean(props: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in props.items() if v is not None}


def _poverty_fill(poverty: float | None) -> str:
    i = class_index(poverty)
    return CLASSES[i][1] if i is not None else MISSING_COLOR


def piece_feature(s: TractDistrict, layer: str, low_population: bool = False) -> dict[str, Any]:
    t, (ad, ed) = s.tract, divmod(s.elect_dist, 1000)
    band = band_index(s.miles)
    props = {
        "name": f"{t.geoid} / AD {ad} ED {ed:03d}",
        "centroid": _centroid(s.geometry),
        "layer": layer,
        "kind": "piece",
        "geoid": str(t.geoid),
        "site": s.site.name,
        "miles": round(s.miles, 2),
        "population": _whole(t.population),
        "povertyPct": t.poverty,
        "incomeUsd": _whole(t.income),
        "lowPopulation": True if low_population else None,
        "povertyFill": _poverty_fill(t.poverty),
        "distanceFill": BANDS[band][1],
        "combinedFill": combined_fill(t.poverty, band),
    }
    return {"type": "Feature", "properties": _clean(props), "geometry": polygon_geometry(s.geometry)}


def zero_population_feature(t: Tract) -> dict[str, Any]:
    props = {
        "name": str(t.geoid),
        "layer": ZERO,
        "kind": "tract",
        "geoid": str(t.geoid),
        "centroid": _centroid(t.geometry),
        "population": 0,
        "povertyFill": ZERO_POP_COLOR,
        "distanceFill": ZERO_POP_COLOR,
        "combinedFill": ZERO_POP_COLOR,
    }
    return {"type": "Feature", "properties": props, "geometry": polygon_geometry(t.geometry)}


def site_feature(p: PollSite) -> dict[str, Any]:
    assert p.lonlat is not None
    a = p.acs
    props = {
        "name": p.name,
        "layer": "Poll sites",
        "kind": "site",
        "siteName": p.ext.get("Site Name") or None,
        "geoid": p.geoid,
        "population": _whole(a.pop) if a else None,
        "povertyPct": a.pov if a else None,
        "povertyMoe": a.pov_moe if a else None,
        "incomeUsd": _whole(a.inc) if a else None,
        "incomeMoe": _whole(a.inc_moe) if a else None,
    }
    return {"type": "Feature", "properties": _clean(props), "geometry": {"type": "Point", "coordinates": list(p.lonlat)}}


def legends() -> dict[str, list[dict[str, str]]]:
    zero = [(ZERO_POP_COLOR, "Zero population tract")]
    sets = {
        "poverty": [(c, lb) for _, c, lb in CLASSES] + [(MISSING_COLOR, MISSING_LABEL)] + zero,
        "distance": [(c, lb) for _, c, lb in BANDS] + zero,
        "combined": cells() + zero,
    }
    return {k: [{"color": c, "label": lb} for c, lb in v] for k, v in sets.items()}


def _write(path: str, collection: dict[str, Any], precision: int) -> None:
    text = json.dumps(collection, separators=(",", ":"))
    text = re.sub(rf"(\d+\.\d{{{precision}}})\d+", r"\1", text)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)


def build(dataset: Dataset, pieces: Sequence[TractDistrict], low_pieces: Sequence[TractDistrict], out_dir: str, precision: int = 5) -> dict[str, int]:
    """Write the two files the page loads. Returns feature counts by file.

    `pieces` are the tract by election district pieces the analysis uses.
    `low_pieces` are the same for low population tracts, which the analysis leaves out."""
    feats = [piece_feature(s, str(s.tract.borough)) for s in sorted(pieces, key=lambda s: (str(s.tract.borough), s.tract.geoid, s.elect_dist))]
    feats += [piece_feature(s, LOW, low_population=True) for s in sorted(low_pieces, key=lambda s: (s.tract.geoid, s.elect_dist))]
    feats += [zero_population_feature(t) for t in sorted(dataset.layers.zero, key=lambda t: t.geoid)]
    _write(os.path.join(out_dir, OUT["assignment"]), {"type": "FeatureCollection", "legends": legends(), "features": feats}, precision)
    sites = [site_feature(p) for p in dataset.polls]
    _write(os.path.join(out_dir, OUT["polls"]), {"type": "FeatureCollection", "features": sites}, precision)
    return {OUT["assignment"]: len(feats), OUT["polls"]: len(sites)}

"""Early voting poll sites: parse the public My Maps KML, geocode sites without a Point."""

import re
import time
import urllib.parse
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field, replace
from typing import NotRequired, TypedDict, cast

import httpx

from . import net
from .census import AcsRow

POLL_URL = "https://www.google.com/maps/d/kml?mid=1IDPJI3AG9iMFvYT-1tOGKr8nNSiwSzg&forcekml=1"
GOOGLE_GEOCODER_URL = "https://maps.googleapis.com/maps/api/geocode/json"
# Rough NYC bounding box (south,west,north,east) used to reject Google matches outside the city.
NYC_BOUNDS = (40.47, -74.27, 40.92, -73.68)
K = "{http://www.opengis.net/kml/2.2}"

LonLat = tuple[float, float]


@dataclass(frozen=True)
class PollSite:
    name: str
    address: str | None
    description: str
    ext: dict[str, str] = field(default_factory=dict[str, str])
    lonlat: LonLat | None = None
    source: str | None = None  # "kml" or "google"
    matched: str | None = None  # Google's formatted address
    geoid: str | None = None  # census tract containing the site
    acs: AcsRow | None = None


class GeocoderResult(TypedDict):
    formatted_address: str
    geometry: dict[str, dict[str, float]]  # {"location": {"lat": ..., "lng": ...}}


class GeocoderResponse(TypedDict):
    status: str
    results: NotRequired[list[GeocoderResult]]
    error_message: NotRequired[str]


class Excluded(TypedDict):
    name: str
    reason: str


class Geocoded(TypedDict):
    name: str
    matched: str
    lonlat: LonLat


class GeocodeFailure(TypedDict):
    name: str
    borough: str | None
    reason: str


def parse_poll_sites(kml_bytes: bytes) -> tuple[list[PollSite], list[Excluded], int]:
    """Split the source KML into poll sites and excluded placemarks. Returns (sites, excluded, total)."""
    root = ET.fromstring(kml_bytes)
    sites: list[PollSite] = []
    excluded: list[Excluded] = []
    total = 0
    for folder in root.iter(K + "Folder"):
        for pm in folder.findall(K + "Placemark"):
            total += 1
            name = (pm.findtext(K + "name") or "").strip()
            ext = {d.get("name") or "": (d.findtext(K + "value") or "").strip() for d in pm.iter(K + "Data")}
            if not ext.get("Poll Site ID"):
                kind = "route line" if pm.find(K + "LineString") is not None else "non-poll-site point"
                excluded.append({"name": name, "reason": f"{kind} (no Poll Site ID)"})
                continue
            pt = pm.find(K + "Point/" + K + "coordinates")
            lonlat: LonLat | None = None
            if pt is not None and pt.text:
                lon, lat = pt.text.strip().split(",")[:2]
                lonlat = (float(lon), float(lat))
            sites.append(
                PollSite(
                    name=name,
                    address=(pm.findtext(K + "address") or "").strip() or None,
                    description=pm.findtext(K + "description") or "",
                    ext=ext,
                    lonlat=lonlat,
                    source="kml" if lonlat else None,
                )
            )
    return sites, excluded, total


def election_flag(election: str) -> str | None:
    if not election:
        return "empty Election field"
    if re.match(r"^Tract\b", election):
        return f"tract/poverty text in Election field ({election})"
    return None


def google_queries(site: PollSite) -> list[str]:
    """Address variants for a site, most specific first."""
    zip_code = re.sub(r"\.0$", "", site.ext.get("Zip Code", ""))
    borough = site.ext.get("Borough", "")
    street = re.sub(r"\s+", " ", (site.address or site.name).split(",")[0]).strip()
    prefix = f"{borough}, " if borough else ""
    qs = [f"{street}, {prefix}NY {zip_code}".strip()]
    if site.address and site.name and site.name not in street:
        qs.append(f"{site.name}, {street}, {prefix}NY {zip_code}".strip())
    qs.append(f"{street}, New York, NY {zip_code}".strip())
    return list(dict.fromkeys(qs))


def geocode_google(site: PollSite, key: str) -> tuple[LonLat | None, str]:
    """Returns (lonlat, formatted address) on a match, else (None, reason)."""
    south, west, north, east = NYC_BOUNDS
    last = "no match"
    for q in google_queries(site):
        params = {"address": q, "key": key, "region": "us", "components": "administrative_area:NY|country:US", "bounds": f"{south},{west}|{north},{east}"}
        try:
            data = cast(GeocoderResponse, net.get_json(f"{GOOGLE_GEOCODER_URL}?{urllib.parse.urlencode(params)}"))
        except (httpx.HTTPError, RuntimeError) as e:
            return None, str(e)
        status = data["status"]
        if status in ("REQUEST_DENIED", "OVER_QUERY_LIMIT", "INVALID_REQUEST"):
            return None, f"Google Geocoding {status}: {data.get('error_message', '')}"
        for r in data.get("results", []):
            loc = r["geometry"]["location"]
            if south <= loc["lat"] <= north and west <= loc["lng"] <= east:
                return (loc["lng"], loc["lat"]), str(r["formatted_address"])
        last = f"{status} for {q!r}"
    return None, last


def geocode_sites(sites: list[PollSite], google_key: str | None, pause: float = 0.05) -> tuple[list[PollSite], list[Geocoded], list[GeocodeFailure]]:
    """Locate every site without a Point in the source with the Google Geocoding API (answers are kept in the source cache, so a rerun does not call it again).

    Returns (sites with lonlat filled in where located, geocoded report, failed report)."""
    out: list[PollSite] = []
    geocoded: list[Geocoded] = []
    failed: list[GeocodeFailure] = []
    for s in sites:
        if s.lonlat is not None:
            out.append(s)
            continue
        ll, info = geocode_google(s, google_key or "")
        if ll:
            out.append(replace(s, lonlat=ll, source="google", matched=info))
            geocoded.append({"name": s.name, "matched": info, "lonlat": ll})
        else:
            out.append(s)
            failed.append({"name": s.name, "borough": s.ext.get("Borough"), "reason": info})
        time.sleep(pause)
    return out, geocoded, failed

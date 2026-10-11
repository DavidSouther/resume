"""Synthetic Census, boundary, poll site, and geocoder responses for offline tests."""

import json
import urllib.parse
from collections.abc import Generator
from contextlib import contextmanager
from unittest import mock

import httpx

from nyc_tracts import net

# One square tract per (county, kind). Counties 005 (Bronx) and 061 (Manhattan) get all five kinds.
KINDS = {
    "100": {"pov": "5.0", "inc": "90000", "pop": "4000"},  # class 0
    "200": {"pov": "25.5", "inc": "45000", "pop": "3500"},  # class 2
    "300": {"pov": "-666666666", "inc": "-666666666", "pop": "2000"},  # mapped, no data
    "400": {"pov": "30.0", "inc": "30000", "pop": "500"},  # low population
    "500": {"pov": "0", "inc": "0", "pop": "0"},  # zero population
}
COUNTIES_USED = ("005", "061")


def tract_square(county: str, kind: str) -> list[list[float]]:
    base_x = -74.0 + (0.1 if county == "061" else 0.0)
    base_y = 40.7 + int(kind) / 1000.0
    return [[base_x, base_y], [base_x + 0.01, base_y], [base_x + 0.01, base_y + 0.01], [base_x, base_y + 0.01], [base_x, base_y]]


def acs_response(county: str) -> list[list[str]]:
    from nyc_tracts.census import ACS_VARS

    head = ["NAME", *ACS_VARS, "state", "county", "tract"]
    rows: list[list[str]] = [head]
    for kind, v in KINDS.items():
        d = {code: "-666666666" for code in ACS_VARS}
        d.update(
            {
                "S1701_C03_001E": v["pov"],
                "S1701_C03_001M": "1.5",
                "S1901_C01_012E": v["inc"],
                "S1901_C01_012M": "5000",
                "S1701_C01_001E": v["pop"],
                "S0101_C01_001E": v["pop"],
                "S1901_C01_001E": "1000",
            }
        )
        rows.append([f"Census Tract {kind}, County, New York", *[d[c] for c in ACS_VARS], "36", county, f"000{kind}"[-6:]])
    return rows


def shoreline_response() -> dict[str, object]:
    feats: list[dict[str, object]] = []
    for county in COUNTIES_USED:
        for kind in KINDS:
            geoid = f"36{county}{('000' + kind)[-6:]}"
            feats.append({"type": "Feature", "properties": {"geoid": geoid, "ctlabel": kind}, "geometry": {"type": "Polygon", "coordinates": [tract_square(county, kind)]}})
    return {"features": feats}


def poll_kml() -> bytes:
    def pm(name: str, point: tuple[float, float] | None, site_id: str | None, address: str | None, election: str = "General") -> str:
        data = f'<Data name="Poll Site ID"><value>{site_id}</value></Data>' if site_id else ""
        data += f'<Data name="Borough"><value>Bronx</value></Data><Data name="Zip Code"><value>10451.0</value></Data><Data name="Election"><value>{election}</value></Data>'
        addr = f"<address>{address}</address>" if address else ""
        geom = f"<Point><coordinates>{point[0]},{point[1]},0</coordinates></Point>" if point else ""
        return f"<Placemark><name>{name}</name>{addr}<description>desc {name}</description><ExtendedData>{data}</ExtendedData>{geom}</Placemark>"

    inside_100 = (-73.995, 40.805)
    body = (
        pm("Has Point", inside_100, "1", None)
        + pm("Needs Geocode", None, "2", "1 Main St, Bronx", election="Tract 5; 14.5%")
        + pm("Unlocatable", None, "3", "2 Nowhere Rd", election="")
        + "<Placemark><name>7 minutes</name><LineString><coordinates>0,0</coordinates></LineString></Placemark>"
    )
    return f'<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Folder>{body}</Folder></Document></kml>'.encode()


def geocoder_response(address: str) -> dict[str, object]:
    if "Main St" in address:
        return {"status": "OK", "results": [{"formatted_address": "1 Main St, Bronx, NY", "geometry": {"location": {"lat": 40.905, "lng": -73.895}}}]}
    return {"status": "ZERO_RESULTS", "results": []}


def fake_body(url: str) -> bytes:
    parsed = urllib.parse.urlparse(url)
    q = urllib.parse.parse_qs(parsed.query)
    if "api.census.gov" in url:
        return json.dumps(acs_response(q["in"][0].split("county:")[1])).encode()
    if "data.cityofnewyork.us" in url:
        return json.dumps(shoreline_response()).encode()
    if "google.com/maps/d/kml" in url:
        return poll_kml()
    if "maps.googleapis.com" in url:
        return json.dumps(geocoder_response(q["address"][0])).encode()
    raise AssertionError(f"unexpected url {url}")


def handler(request: httpx.Request) -> httpx.Response:
    return httpx.Response(200, content=fake_body(str(request.url)))


@contextmanager
def fake_http() -> Generator[None]:
    """Route net.get through the synthetic responses."""
    with mock.patch.object(net, "TRANSPORT", httpx.MockTransport(handler)):
        yield

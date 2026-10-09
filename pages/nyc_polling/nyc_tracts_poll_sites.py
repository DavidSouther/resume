#!/usr/bin/env python3
"""Build KML files for Google My Maps: one nyc_tracts_<borough>.kml per borough, nyc_tracts_low_population.kml, nyc_tracts_zero_population.kml, and nyc_poll_sites.kml.

Folder 1: NYC census tracts (TIGERweb 2020 vintage) colored by ACS 2024 5-year
poverty rate, with median household income in each pop-up.
Folder 2: NYC early voting poll sites from a public Google My Maps layer,
geocoded with the Google Geocoding API when the source has no Point. Each site
pop-up lists population, households, poverty rate, and median income of the
census tract containing the site.

Standard library only. The Census Data API requires a free key
(https://api.census.gov/data/key_signup.html): pass --census-key or set
CENSUS_API_KEY. Geocoding poll sites needs a Google Geocoding API key: pass
--google-key or set GOOGLE_MAPS_API_KEY (not needed with --skip-polls).
"""

import argparse
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape

STATE = "36"
COUNTIES = {"005": "Bronx", "047": "Brooklyn", "061": "Manhattan", "081": "Queens", "085": "Staten Island"}
ACS_URL = "https://api.census.gov/data/2024/acs/acs5/subject"
ACS_VARS = [
    "S1701_C03_001E", "S1701_C03_001M",  # percent below poverty level
    "S1901_C01_012E", "S1901_C01_012M",  # households, median income (dollars)
    "S1701_C01_001E", "S1701_C01_001M",  # population for whom poverty status is determined
    "S1701_C02_001E", "S1701_C02_001M",  # population below poverty level
    "S1901_C01_001E", "S1901_C01_001M",  # households, total
    "S1901_C01_013E", "S1901_C01_013M",  # households, mean income (dollars)
    "S0101_C01_001E", "S0101_C01_001M",  # total population
]
# Layer 10 is "Census Tracts; 2020 Census - January 1, 2020 vintage". Layer 0 is the
# current (2026) vintage, which can drift from ACS 2024 geography.
TIGER_URL = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer/10/query"
# NYC DCP "2020 Census Tracts", clipped to the shoreline (no harbor or river water). It omits
# tracts that are entirely under water. Same 2020 tract geography and GEOIDs as TIGERweb.
SHORELINE_URL = "https://data.cityofnewyork.us/resource/63ge-mke6.geojson"
POLL_URL = "https://www.google.com/maps/d/kml?mid=1IDPJI3AG9iMFvYT-1tOGKr8nNSiwSzg&forcekml=1"
GOOGLE_GEOCODER_URL = "https://maps.googleapis.com/maps/api/geocode/json"
# Rough NYC bounding box (south,west|north,east) used to reject Google matches outside the city.
NYC_BOUNDS = (40.47, -74.27, 40.92, -73.68)
SOURCE_LINE = "Source: U.S. Census Bureau, ACS 2024 5-year, tables S1701 and S1901; NYC DCP 2020 census tracts clipped to shoreline."
KML_NS = "http://www.opengis.net/kml/2.2"
K = "{" + KML_NS + "}"

# Fixed breaks (upper bound exclusive), ColorBrewer 5-class Reds, so maps stay comparable across runs.
CLASSES = [
    (10.0, "#fee5d9", "Under 10%"),
    (20.0, "#fcae91", "10% to 20%"),
    (30.0, "#fb6a4a", "20% to 30%"),
    (40.0, "#de2d26", "30% to 40%"),
    (float("inf"), "#a50f15", "40% and over"),
]
MISSING = (None, "#bdbdbd", "No data")
# Census designs a standard tract to hold 1,200 to 8,000 people (optimum 4,000). A tract whose
# poverty universe is under the minimum is not a standard residential tract (institutions, new
# development, mostly non-residential land), and its ACS estimates have very wide margins of error.
LOW_POPULATION = 1200
POLY_ALPHA = "b3"
MAX_PER_FILE = 2000  # My Maps imports only the first 2000 placemarks of a file


def fetch(url, retries=3, timeout=90):
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "nyc_tracts_poll_sites/1.0"})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                final = resp.geturl()
                if "missing_key" in final or "invalid_key" in final:
                    raise RuntimeError(f"Census API rejected request: missing or invalid key (redirected to {final}). A new key must be activated from the confirmation email first.")
                return resp.read()
        except RuntimeError:
            raise
        except (urllib.error.URLError, OSError) as e:
            last = e
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"GET {url} failed after {retries} attempts: {last}")


def fetch_json(url):
    return json.loads(fetch(url))


def clean_number(v):
    """Census sentinels (-666666666, -555555555, ...) and non-numbers become None."""
    if v is None:
        return None
    try:
        n = float(v)
    except (TypeError, ValueError):
        return None
    return None if n < 0 else n


def fetch_acs(key):
    rows = {}
    for county in COUNTIES:
        qs = urllib.parse.urlencode(
            {"get": ",".join(["NAME"] + ACS_VARS), "for": "tract:*", "in": f"state:{STATE} county:{county}", "key": key},
            quote_via=urllib.parse.quote,
        )
        data = fetch_json(f"{ACS_URL}?{qs}")
        head = data[0]
        for r in data[1:]:
            d = dict(zip(head, r))
            geoid = d["state"] + d["county"] + d["tract"]
            rows[geoid] = {
                "name": d["NAME"],
                "pov": clean_number(d["S1701_C03_001E"]),
                "pov_moe": clean_number(d["S1701_C03_001M"]),
                "inc": clean_number(d["S1901_C01_012E"]),
                "inc_moe": clean_number(d["S1901_C01_012M"]),
                "pop": clean_number(d["S1701_C01_001E"]),
                "total_pop": clean_number(d["S0101_C01_001E"]),
                "total_pop_moe": clean_number(d["S0101_C01_001M"]),
                "hh": clean_number(d["S1901_C01_001E"]),
                # Every requested variable as the API returned it, sentinel codes included.
                "raw": {v: d[v] for v in ACS_VARS},
            }
    return rows


def fetch_tracts(counties, page=500):
    feats = []
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
            data = fetch_json(f"{TIGER_URL}?{qs}")
            if "error" in data:
                raise RuntimeError(f"TIGERweb error: {data['error']}")
            got = data.get("features", [])
            feats.extend(got)
            if not got or not (data.get("exceededTransferLimit") or len(got) == page):
                break
            offset += len(got)
    return feats


def fetch_tracts_shoreline(counties):
    feats = []
    for offset in range(0, 100000, 1000):
        data = json.loads(fetch(f"{SHORELINE_URL}?{urllib.parse.urlencode({'$limit': 1000, '$offset': offset, '$order': 'geoid'})}", timeout=30))
        feats.extend(data["features"])
        if len(data["features"]) < 1000:
            break
    out = []
    for f in feats:
        p = f["properties"]
        if p["geoid"][2:5] in counties:
            out.append({"geometry": f["geometry"], "properties": {"GEOID": p["geoid"], "NAME": f"Census Tract {p['ctlabel']}", "COUNTY": p["geoid"][2:5]}})
    return out


def signed_area(ring):
    return sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1])) / 2


def polygons_of(geom):
    """Return a list of polygons, each [outer, hole, ...]. Rings in a GeoJSON Polygon
    with the same winding as the first ring are treated as separate outer rings."""
    if geom["type"] == "Polygon":
        raw = [geom["coordinates"]]
    elif geom["type"] == "MultiPolygon":
        raw = geom["coordinates"]
    else:
        raise ValueError(f"unsupported geometry {geom['type']}")
    out = []
    for rings in raw:
        if not rings:
            continue
        first = signed_area([tuple(p[:2]) for p in rings[0]]) >= 0
        for ring in rings:
            same = (signed_area([tuple(p[:2]) for p in ring]) >= 0) == first
            if same:
                out.append([ring])
            elif out:
                out[-1].append(ring)
    return out


def coords_text(ring, precision, outer):
    pts = [(round(p[0], precision), round(p[1], precision)) for p in ring]
    if pts[0] != pts[-1]:
        pts.append(pts[0])
    # KML convention: outer boundaries counterclockwise, holes clockwise.
    ccw = signed_area(pts[:-1]) > 0
    if ccw != outer:
        pts.reverse()
    fmt = f"{{:.{precision}f}}"
    return " ".join(f"{fmt.format(x)},{fmt.format(y)}" for x, y in pts)


def polygon_kml(geom, precision):
    parts = []
    for rings in polygons_of(geom):
        s = "<Polygon><outerBoundaryIs><LinearRing><coordinates>" + coords_text(rings[0], precision, True)
        s += "</coordinates></LinearRing></outerBoundaryIs>"
        for hole in rings[1:]:
            s += "<innerBoundaryIs><LinearRing><coordinates>" + coords_text(hole, precision, False) + "</coordinates></LinearRing></innerBoundaryIs>"
        parts.append(s + "</Polygon>")
    return parts[0] if len(parts) == 1 else "<MultiGeometry>" + "".join(parts) + "</MultiGeometry>"


def class_index(pov):
    if pov is None:
        return None
    for i, (upper, _, _) in enumerate(CLASSES):
        if pov < upper:
            return i
    return len(CLASSES) - 1


def kml_color(hex_color, alpha):
    r, g, b = hex_color[1:3], hex_color[3:5], hex_color[5:7]
    return f"{alpha}{b}{g}{r}"


def fmt_pct(v, moe):
    if v is None:
        return "not available"
    return f"{v:.1f}%" + (f" (±{moe:.1f})" if moe is not None else "")


def fmt_money(v, moe):
    if v is None:
        return "not available"
    return f"${v:,.0f}" + (f" (±${moe:,.0f})" if moe is not None else "")


def zero_population_popup(geoid, name, borough, acs):
    reason = "no ACS row for this tract" if acs is None else "no population for whom poverty status is determined (parks, water, airports, institutions, and similar)"
    rows = [("Tract", f"{name} ({borough})"), ("GEOID", geoid), ("Why in this layer", reason)]
    body = "".join(f"<b>{html.escape(k)}:</b> {html.escape(v)}<br>" for k, v in rows)
    return body + f"<i>{html.escape(SOURCE_LINE)}</i>"


def tract_popup(geoid, name, borough, acs):
    rows = [
        ("Tract", f"{name} ({borough})"),
        ("GEOID", geoid),
        ("Poverty rate", fmt_pct(acs and acs["pov"], acs and acs["pov_moe"]) if acs else "not available"),
        ("Median household income", fmt_money(acs and acs["inc"], acs and acs["inc_moe"]) if acs else "not available"),
    ]
    body = "".join(f"<b>{html.escape(k)}:</b> {html.escape(v)}<br>" for k, v in rows)
    return body + f"<i>{html.escape(SOURCE_LINE)}</i><br><i>Margins are 90% margins of error.</i>"


def low_population_popup(geoid, name, borough, acs, cutoff):
    raw = acs["raw"]

    def count(code):
        n = clean_number(raw[code])
        return "not available" if n is None else f"{n:,.0f}"

    rows = [
        ("Tract", f"{name} ({borough})"),
        ("GEOID", geoid),
        ("Why in this layer", f"population for whom poverty status is determined is {acs['pop']:,.0f}, under the {cutoff:,} cutoff (Census standard tract minimum)"),
        ("Poverty rate", fmt_pct(acs["pov"], acs["pov_moe"])),
        ("Population for whom poverty status is determined", f"{count('S1701_C01_001E')} (±{count('S1701_C01_001M')})"),
        ("Population below poverty level", f"{count('S1701_C02_001E')} (±{count('S1701_C02_001M')})"),
        ("Households", f"{count('S1901_C01_001E')} (±{count('S1901_C01_001M')})"),
        ("Median household income", fmt_money(acs["inc"], acs["inc_moe"])),
        ("Mean household income", fmt_money(clean_number(raw["S1901_C01_013E"]), clean_number(raw["S1901_C01_013M"]))),
        ("Raw API values", "; ".join(f"{k}={v}" for k, v in raw.items())),
    ]
    body = "".join(f"<b>{html.escape(k)}:</b> {html.escape(v)}<br>" for k, v in rows)
    return body + f"<i>{html.escape(SOURCE_LINE)}</i><br><i>Margins are 90% margins of error. Negative raw values are Census codes for values that were not computed or not available.</i>"


def poll_sites(kml_bytes):
    """Split the source KML into poll sites and excluded placemarks."""
    root = ET.fromstring(kml_bytes)
    sites, excluded, total = [], [], 0
    for folder in root.iter(K + "Folder"):
        for pm in folder.findall(K + "Placemark"):
            total += 1
            name = (pm.findtext(K + "name") or "").strip()
            ext = {d.get("name"): (d.findtext(K + "value") or "").strip() for d in pm.iter(K + "Data")}
            if not ext.get("Poll Site ID"):
                kind = "route line" if pm.find(K + "LineString") is not None else "non-poll-site point"
                excluded.append({"name": name, "reason": f"{kind} (no Poll Site ID)"})
                continue
            pt = pm.find(K + "Point/" + K + "coordinates")
            lonlat = None
            if pt is not None and pt.text:
                lon, lat = pt.text.strip().split(",")[:2]
                lonlat = (float(lon), float(lat))
            sites.append(
                {
                    "name": name,
                    "address": (pm.findtext(K + "address") or "").strip() or None,
                    "description": pm.findtext(K + "description") or "",
                    "ext": ext,
                    "lonlat": lonlat,
                    "source": "kml" if lonlat else None,
                }
            )
    return sites, excluded, total


def election_flag(election):
    if not election:
        return "empty Election field"
    if re.match(r"^Tract\b", election):
        return f"tract/poverty text in Election field ({election})"
    return None


def address_parts(site):
    """(street, borough, zip) for a poll site; the street falls back to the site name."""
    zip_code = re.sub(r"\.0$", "", site["ext"].get("Zip Code", ""))
    return site["address"] or site["name"], site["ext"].get("Borough", ""), zip_code


def google_queries(site):
    """Address variants for a site, most specific first."""
    street, borough, zip_code = address_parts(site)
    street = re.sub(r"\s+", " ", street.split(",")[0]).strip()
    qs = [f"{street}, {borough + ', ' if borough else ''}NY {zip_code}".strip()]
    if site["address"] and site["name"] and site["name"] not in street:
        qs.append(f"{site['name']}, {street}, {borough + ', ' if borough else ''}NY {zip_code}".strip())
    qs.append(f"{street}, New York, NY {zip_code}".strip())
    return list(dict.fromkeys(qs))


def geocode_google(site, key):
    south, west, north, east = NYC_BOUNDS
    last = "no match"
    for q in google_queries(site):
        params = {"address": q, "key": key, "region": "us", "components": "administrative_area:NY|country:US",
                  "bounds": f"{south},{west}|{north},{east}"}
        try:
            data = fetch_json(f"{GOOGLE_GEOCODER_URL}?{urllib.parse.urlencode(params)}")
        except RuntimeError as e:
            return None, str(e)
        status = data.get("status")
        if status in ("REQUEST_DENIED", "OVER_QUERY_LIMIT", "INVALID_REQUEST"):
            return None, f"Google Geocoding {status}: {data.get('error_message', '')}"
        for r in data.get("results", []):
            loc = r["geometry"]["location"]
            if south <= loc["lat"] <= north and west <= loc["lng"] <= east:
                return (loc["lng"], loc["lat"]), r["formatted_address"]
        last = f"{status} for {q!r}"
    return None, last


def geocode_sites(sites, google_key):
    """Locate every site without a KML Point with the Google Geocoding API.

    Sets lonlat, source and matched on each site it locates. Returns (geocoded, failed) report lists."""
    geocoded, failed = [], []
    for s in sites:
        if s["lonlat"] is not None:
            continue
        ll, info = geocode_google(s, google_key)
        if ll:
            s["lonlat"], s["source"], s["matched"] = ll, "google", info
            geocoded.append({"name": s["name"], "matched": info, "lonlat": ll})
        else:
            failed.append({"name": s["name"], "borough": s["ext"].get("Borough"), "reason": info})
        time.sleep(0.05)
    return geocoded, failed


def ring_contains(ring, x, y):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def tract_index(feats):
    """(geoid, bbox, polygons) per tract, for point-in-polygon lookups."""
    out = []
    for f in feats:
        polys = polygons_of(f["geometry"])
        xs = [p[0] for rings in polys for p in rings[0]]
        ys = [p[1] for rings in polys for p in rings[0]]
        out.append((f["properties"]["GEOID"], (min(xs), min(ys), max(xs), max(ys)), polys))
    return out


def tract_at(index, lon, lat):
    for geoid, (x0, y0, x1, y1), polys in index:
        if not (x0 <= lon <= x1 and y0 <= lat <= y1):
            continue
        for rings in polys:
            if ring_contains(rings[0], lon, lat) and not any(ring_contains(h, lon, lat) for h in rings[1:]):
                return geoid
    return None


def fmt_count(v, moe=None):
    if v is None:
        return "not available"
    return f"{v:,.0f}" + (f" (±{moe:,.0f})" if moe is not None else "")


def tract_summary(geoid, acs):
    """Pop-up block describing the census tract a poll site sits in."""
    if geoid is None or geoid not in acs:
        return "<br><b>Census tract:</b> not found (site is outside tract boundaries)<br>"
    a = acs[geoid]
    rows = [
        ("Census tract", f"{a['name'].split(',')[0]} ({COUNTIES[geoid[2:5]]}), GEOID {geoid}"),
        ("Tract population", fmt_count(a["total_pop"], a["total_pop_moe"])),
        ("Tract population with poverty status determined", fmt_count(a["pop"])),
        ("Tract households", fmt_count(a["hh"])),
        ("Tract poverty rate", fmt_pct(a["pov"], a["pov_moe"])),
        ("Tract median household income", fmt_money(a["inc"], a["inc_moe"])),
    ]
    body = "".join(f"<b>{html.escape(k)}:</b> {html.escape(v)}<br>" for k, v in rows)
    return "<br>" + body + f"<i>{html.escape(SOURCE_LINE)} Margins are 90% margins of error.</i>"


def point_kml(site, precision):
    lon, lat = site["lonlat"]
    desc = site["description"]
    if site["source"] == "google":
        desc += f"<br><i>Location geocoded by Google Geocoding API: {html.escape(site['matched'])}</i>"
    desc += site.get("tract_html", "")
    return (
        f"<Placemark><name>{escape(site['name'])}</name><description><![CDATA[{desc.replace(']]>', ']]]]><![CDATA[>')}]]></description>"
        f"<styleUrl>#poll</styleUrl><Point><coordinates>{lon:.{precision}f},{lat:.{precision}f},0</coordinates></Point></Placemark>"
    )


def build_kml(name, folders):
    """folders is a list of (title, [placemark xml]). Only the styles a file uses are emitted."""
    body = "\n".join(pm for _, pms in folders for pm in pms)
    styles = []
    for i, (_, color, _) in enumerate(CLASSES):
        styles.append(f'<Style id="pov{i}"><LineStyle><color>66000000</color><width>0.5</width></LineStyle><PolyStyle><color>{kml_color(color, POLY_ALPHA)}</color></PolyStyle></Style>')
    styles.append(f'<Style id="povNA"><LineStyle><color>66000000</color><width>0.5</width></LineStyle><PolyStyle><color>{kml_color(MISSING[1], POLY_ALPHA)}</color></PolyStyle></Style>')
    styles.append('<Style id="lowpop"><LineStyle><color>ffa04080</color><width>1</width></LineStyle><PolyStyle><color>b3a04080</color></PolyStyle></Style>')
    styles.append('<Style id="zeropop"><LineStyle><color>66000000</color><width>0.5</width></LineStyle><PolyStyle><color>66bdbdbd</color></PolyStyle></Style>')
    styles.append('<Style id="poll"><IconStyle><color>ffd18802</color><scale>1</scale><Icon><href>https://www.gstatic.com/mapspro/images/stock/503-wht-blank_maps.png</href></Icon></IconStyle></Style>')
    styles = [st for st in styles if re.search(r'id="(\w+)"', st).group(1) in {m for m in re.findall(r"<styleUrl>#(\w+)</styleUrl>", body)}]
    legend = "; ".join(f"{label}: {color}" for _, color, label in CLASSES) + f"; No data: {MISSING[1]}"
    out = ['<?xml version="1.0" encoding="UTF-8"?>', f'<kml xmlns="{KML_NS}"><Document>', f"<name>{escape(name)}</name>"]
    out.append(f"<description>{escape(SOURCE_LINE)} Poverty classes: {escape(legend)}.</description>")
    out += styles
    for title, pms in folders:
        out.append(f"<Folder><name>{escape(title)} ({len(pms)})</name>")
        out += pms
        out.append("</Folder>")
    out.append("</Document></kml>")
    return "\n".join(out)


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out-dir", default=os.path.join(here, "..", "..", "public", "nyc_polling"))
    ap.add_argument("--precision", type=int, default=5, help="coordinate decimals (default 5)")
    ap.add_argument("--skip-polls", action="store_true", help="tracts only")
    ap.add_argument("--counties", default=",".join(COUNTIES), help="comma-separated county codes (default all five)")
    ap.add_argument("--boundaries", choices=["shoreline", "tiger"], default="shoreline", help="shoreline: NYC DCP tracts clipped to the shoreline (default); tiger: TIGERweb full extent, including water")
    ap.add_argument("--low-population", type=int, default=LOW_POPULATION, help=f"tracts whose poverty universe is below this go in the low population layer (default {LOW_POPULATION}, the Census standard tract minimum)")
    ap.add_argument("--census-key", default=os.environ.get("CENSUS_API_KEY"))
    ap.add_argument("--google-key", default=os.environ.get("GOOGLE_MAPS_API_KEY"), help="Google Geocoding API key, used to locate poll sites that have no Point in the source")
    ap.add_argument("--cache-dir", default=None, help="directory for cached source downloads (default: none)")
    args = ap.parse_args()

    counties = [c.strip() for c in args.counties.split(",") if c.strip()]
    bad = [c for c in counties if c not in COUNTIES]
    if bad:
        sys.exit(f"unknown county codes: {bad}")
    if not args.census_key:
        sys.exit("A Census API key is required (the API redirects keyless requests to missing_key.html). Get one at https://api.census.gov/data/key_signup.html, then pass --census-key or set CENSUS_API_KEY.")

    if not args.skip_polls and not args.google_key:
        sys.exit("A Google Geocoding API key is required to locate poll sites. Pass --google-key or set GOOGLE_MAPS_API_KEY, or use --skip-polls.")

    report = {"warnings": []}
    print("Fetching ACS 2024 5-year S1701/S1901 ...")
    acs = {g: r for g, r in fetch_acs(args.census_key).items() if g[2:5] in counties}
    print(f"  ACS rows: {len(acs)}")
    print(f"Fetching 2020 tract boundaries ({args.boundaries}) ...")
    feats = fetch_tracts_shoreline(counties) if args.boundaries == "shoreline" else fetch_tracts(counties)
    print(f"  Boundary features: {len(feats)}")

    boundary_ids = {f["properties"]["GEOID"] for f in feats}
    report["boundary_without_acs"] = sorted(boundary_ids - acs.keys())
    report["acs_without_boundary"] = sorted(acs.keys() - boundary_ids)
    print(f"  Boundaries with no ACS row: {len(report['boundary_without_acs'])} {report['boundary_without_acs'][:10]}")
    print(f"  ACS rows with no boundary: {len(report['acs_without_boundary'])} {report['acs_without_boundary'][:10]}")

    dist = {}
    placemarks = {}
    zero_tracts, zero_placemarks, low_tracts, low_placemarks = [], [], [], []
    for f in feats:
        p = f["properties"]
        geoid = p["GEOID"]
        row = acs.get(geoid)
        idx = class_index(row["pov"]) if row else None
        borough = COUNTIES[p["COUNTY"]]
        label = f"{p['NAME']} ({borough})"
        if row is None or not row["pop"]:
            zero_tracts.append({"geoid": geoid, "name": p["NAME"], "borough": borough, "reason": "no ACS row" if row is None else "zero population"})
            zero_placemarks.append(
                f"<Placemark><name>{escape(label)}</name><description><![CDATA[{zero_population_popup(geoid, p['NAME'], borough, row)}]]></description>"
                f"<styleUrl>#zeropop</styleUrl>{polygon_kml(f['geometry'], args.precision)}</Placemark>"
            )
            continue
        if row["pop"] < args.low_population:
            low_tracts.append({"geoid": geoid, "name": p["NAME"], "borough": borough, "population": row["pop"], "poverty": row["pov"], "income": row["inc"], "raw": row["raw"]})
            low_placemarks.append(
                f"<Placemark><name>{escape(label)}</name><description><![CDATA[{low_population_popup(geoid, p['NAME'], borough, row, args.low_population)}]]></description>"
                f"<styleUrl>#lowpop</styleUrl>{polygon_kml(f['geometry'], args.precision)}</Placemark>"
            )
            continue
        # Populated enough to map. A missing poverty rate is grey; a missing median income only shows in the pop-up.
        dist[idx] = dist.get(idx, 0) + 1
        style = f"pov{idx}" if idx is not None else "povNA"
        placemarks.setdefault(borough, []).append(
            f"<Placemark><name>{escape(label)}</name><description><![CDATA[{tract_popup(geoid, p['NAME'], borough, row)}]]></description>"
            f"<styleUrl>#{style}</styleUrl>{polygon_kml(f['geometry'], args.precision)}</Placemark>"
        )
    report["low_population_cutoff"] = args.low_population
    report["tracts_zero_population"] = zero_tracts
    report["tracts_low_population"] = low_tracts
    n_tracts = sum(len(v) for v in placemarks.values())
    report["tracts_written"] = n_tracts
    report["tracts_by_borough"] = {b: len(v) for b, v in placemarks.items()}
    report["poverty_class_counts"] = {(CLASSES[i][2] if i is not None else MISSING[2]): n for i, n in dist.items()}
    print(f"  Zero population: {len(zero_tracts)}; low population (under {args.low_population}): {len(low_tracts)}")
    print(f"  Tracts written: {n_tracts}; by class: {report['poverty_class_counts']}")

    poll_placemarks = None
    if not args.skip_polls:
        print("Fetching poll sites KML ...")
        sites, excluded, total = poll_sites(fetch(POLL_URL))
        print(f"  Source placemarks: {total}; poll sites: {len(sites)}; excluded: {len(excluded)}")
        flagged = [
            {"name": st["name"], "borough": st["ext"].get("Borough"), "flag": flag}
            for st in sites
            if (flag := election_flag(st["ext"].get("Election", "")))
        ]
        geocoded, failed = geocode_sites(sites, args.google_key)
        index = tract_index(feats)
        no_tract = []
        for s in sites:
            if s["lonlat"]:
                geoid = tract_at(index, *s["lonlat"])
                s["tract_html"] = tract_summary(geoid, acs)
                if geoid is None:
                    no_tract.append(s["name"])
        poll_placemarks = [point_kml(s, args.precision) for s in sites if s["lonlat"]]
        report.update(
            source_placemarks=total,
            poll_sites_in_source=len(sites),
            poll_sites_written=len(poll_placemarks),
            with_kml_point=sum(1 for s in sites if s["source"] == "kml"),
            geocoded=geocoded,
            sites_without_tract=no_tract,
            geocode_failed=failed,
            excluded=excluded,
            election_field_flagged=flagged,
        )
        print(f"  KML Points: {report['with_kml_point']}; geocoded: {len(geocoded)}; sites outside tracts: {len(no_tract)}; geocode failures: {len(failed)}")
        print(f"  Election field flagged: {len(flagged)}")
        print(f"  Poll sites written: {len(poll_placemarks)}")

    # My Maps imports only the first 2000 placemarks of a file, so each borough gets its own
    # file (Brooklyn, the largest, has under 800 tracts) and poll sites get a file of their own.
    files = [
        (f"nyc_tracts_{borough.lower().replace(' ', '_')}.kml", f"{borough} census tracts by poverty rate", [(f"{borough} census tracts by poverty rate", placemarks[borough])])
        for borough in COUNTIES.values()
        if borough in placemarks
    ]
    if low_placemarks:
        files.append(("nyc_tracts_low_population.kml", "NYC census tracts with low population", [(f"Low population tracts (under {args.low_population:,})", low_placemarks)]))
    if zero_placemarks:
        files.append(("nyc_tracts_zero_population.kml", "NYC census tracts with zero population", [("Zero population tracts", zero_placemarks)]))
    if poll_placemarks is not None:
        files.append(("nyc_poll_sites.kml", "NYC early voting poll sites", [("Early voting poll sites", poll_placemarks)]))
    report["files"] = {}
    for fname, title, folders in files:
        assert sum(len(pms) for _, pms in folders) <= MAX_PER_FILE
        path = os.path.join(args.out_dir, fname)
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(build_kml(title, folders))
        size = os.path.getsize(path)
        report["files"][fname] = {"bytes": size, "layers": {t: len(pms) for t, pms in folders}}
        print(f"Wrote {path} ({size / 1e6:.2f} MB): " + "; ".join(f"{t} {len(pms)}" for t, pms in folders))
        if size > 5e6:
            msg = f"{fname} exceeds 5 MB; My Maps may refuse it. Rerun with a lower --precision."
            report["warnings"].append(msg)
            print("WARNING: " + msg)
    with open(os.path.join(here, "nyc_tracts_poll_sites.report.json"), "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)


if __name__ == "__main__":
    main()

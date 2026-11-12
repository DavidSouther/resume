"""Build public/deep_field/fields.json: ESA images with known orientation and
spectroscopic redshifts for sources inside their footprint.

Inputs are the ESA/Webb and ESA/Hubble image feeds (AVM spatial metadata) and
three spectroscopic catalogs, in priority order for duplicates:
  DAWN JWST Archive v4.4 (grade 3), DESI DR1 (zwarn 0, primary spectrum) and
  SDSS DR18 (zWarning 0). Stars are excluded.

    uv run python pages/deep_field/catalog/build_fields.py --cache <dir>
"""

import argparse
import ast
import csv
import gzip
import html
import json
import math
import re
import urllib.parse
import urllib.request
from pathlib import Path

FEEDS = {
    "ESA/Webb": "https://esawebb.org/images/json/",
    "ESA/Hubble": "https://esahubble.org/images/json/",
}
DJA = "https://s3.amazonaws.com/msaexp-nirspec/extractions/dja_msaexp_emission_lines_v4.4.csv.gz"
SDSS = "https://skyserver.sdss.org/dr18/SkyServerWS/SearchTools/SqlSearch"
DESI = "https://datalab.noirlab.edu/tap/sync"
MAX_RADIUS_DEG = 0.5
CROSS_ARCSEC = 1.0
MIN_SOURCES = 20
# Images that rolled out of the feeds. Their orientation is read from the AVM
# XMP packet embedded in the image file. They may have few catalog sources.
EXTRA = [
    {
        "id": "potm2301a",
        "source": "ESA/Webb",
        "title": "LEDA 2046648 field (NIRCam)",
        "url": "https://cdn.esawebb.org/archives/images/large/potm2301a.jpg",
        "min_sources": 3,
    }
]
MAX_BYTES = 12e6
DUP_ARCSEC = 0.5
OUT = Path(__file__).resolve().parents[3] / "public" / "deep_field" / "fields.json"


def fetch(url: str, dest: Path) -> Path:
    if not dest.exists():
        req = urllib.request.Request(url, headers={"User-Agent": "deep-field-build"})
        with urllib.request.urlopen(req) as r, open(dest, "wb") as f:
            f.write(r.read())
    return dest


def unbytes(s) -> str:
    s = str(s or "")
    if s.startswith(("b'", 'b"')):
        try:
            return ast.literal_eval(s).decode("utf-8")
        except (ValueError, SyntaxError, UnicodeDecodeError):
            return s[2:-1]
    return s


def catalog(path: Path):
    """Grade 3 sources as (ra, dec, z), duplicates merged, ambiguous ones dropped."""
    rows = []
    with gzip.open(path, "rt") as f:
        for r in csv.DictReader(f):
            try:
                if int(float(r["grade"])) != 3:
                    continue
                z = float(r["z_best"])
                rows.append((float(r["ra"]), float(r["dec"]), z))
            except (ValueError, KeyError):
                continue
    rows = [r for r in rows if r[2] > 0]
    cell = DUP_ARCSEC / 3600
    grid: dict[tuple[int, int], list[list[tuple[float, float, float]]]] = {}
    groups = []
    for ra, dec, z in rows:
        key = (int(dec / cell), int(ra * math.cos(math.radians(dec)) / cell))
        found = None
        for dk in (-1, 0, 1):
            for rk in (-1, 0, 1):
                for g in grid.get((key[0] + dk, key[1] + rk), []):
                    gra, gdec, _ = g[0]
                    if (
                        math.hypot(
                            (ra - gra) * math.cos(math.radians(dec)), dec - gdec
                        )
                        <= cell
                    ):
                        found = g
        if found is None:
            found = [(ra, dec, z)]
            grid.setdefault(key, []).append(found)
            groups.append(found)
        else:
            found.append((ra, dec, z))
    out = []
    for g in groups:
        zs = [x[2] for x in g]
        if max(zs) - min(zs) > 0.01:
            continue
        out.append(
            (
                sum(x[0] for x in g) / len(g),
                sum(x[1] for x in g) / len(g),
                sum(zs) / len(zs),
            )
        )
    return out


def get_json_cached(url: str, dest: Path):
    if not dest.exists():
        req = urllib.request.Request(url, headers={"User-Agent": "deep-field-build"})
        with urllib.request.urlopen(req, timeout=180) as r:
            dest.write_bytes(r.read())
    return dest


def box(ra0, dec0, rad):
    dra = rad / max(math.cos(math.radians(dec0)), 0.05)
    return ra0 - dra, ra0 + dra, dec0 - rad, dec0 + rad


def query_sdss(cache: Path, name: str, ra0, dec0, rad):
    """Good-redshift galaxies and quasars in a box, as (ra, dec, z)."""
    ra_a, ra_b, de_a, de_b = box(ra0, dec0, rad)
    sql = (
        "SELECT ra,dec,z FROM SpecObj WHERE class IN ('GALAXY','QSO') AND zWarning=0"
        f" AND z>0 AND ra BETWEEN {ra_a:.5f} AND {ra_b:.5f}"
        f" AND dec BETWEEN {de_a:.5f} AND {de_b:.5f}"
    )
    url = SDSS + "?" + urllib.parse.urlencode({"cmd": sql, "format": "json"})
    rows = json.loads(get_json_cached(url, cache / f"sdss_{name}.json").read_text())
    return [(r["ra"], r["dec"], r["z"]) for r in rows[0]["Rows"]] if rows and "Rows" in rows[0] else []


def query_desi(cache: Path, name: str, ra0, dec0, rad):
    ra_a, ra_b, de_a, de_b = box(ra0, dec0, rad)
    adql = (
        "SELECT mean_fiber_ra,mean_fiber_dec,z FROM desi_dr1.zpix"
        " WHERE zcat_primary='t' AND zwarn=0 AND spectype IN ('GALAXY','QSO') AND z>0"
        f" AND mean_fiber_ra BETWEEN {ra_a:.5f} AND {ra_b:.5f}"
        f" AND mean_fiber_dec BETWEEN {de_a:.5f} AND {de_b:.5f}"
    )
    url = DESI + "?" + urllib.parse.urlencode(
        {"REQUEST": "doQuery", "LANG": "ADQL", "FORMAT": "csv", "QUERY": adql}
    )
    text = get_json_cached(url, cache / f"desi_{name}.csv").read_text()
    if text.lstrip().startswith("<"):
        (cache / f"desi_{name}.csv").unlink()
        raise RuntimeError(f"DESI query failed for {name}: {text[:200]}")
    return [
        (float(r["mean_fiber_ra"]), float(r["mean_fiber_dec"]), float(r["z"]))
        for r in csv.DictReader(text.splitlines())
    ]


def merge(layers):
    """layers: [(catalog name, [(ra, dec, z)])] in priority order. A source within
    CROSS_ARCSEC of an already kept one is a duplicate and is dropped."""
    kept = []
    for name, rows in layers:
        base = list(kept)
        for ra, dec, z in rows:
            c = math.cos(math.radians(dec))
            if any(
                abs(dec - b[1]) < CROSS_ARCSEC / 3600
                and math.hypot((ra - b[0]) * c, dec - b[1]) < CROSS_ARCSEC / 3600
                for b in base
            ):
                continue
            kept.append((ra, dec, z, name))
    return kept


def sky_to_pixel(w, ra, dec):
    """AVM tangent plane, in reference-image pixels (top-left origin)."""
    ra0, dec0 = w["ref"]
    xi = (ra - ra0) * math.cos(math.radians(dec0))
    eta = dec - dec0
    r = math.radians(w["rot"])
    u = xi * math.cos(r) + eta * math.sin(r)
    v = -xi * math.sin(r) + eta * math.cos(r)
    return (
        w["px"][0] - u / abs(w["scale"][0]),
        w["px"][1] - v / abs(w["scale"][1]),
    )


def avm_from_file(path: Path) -> dict:
    """Read AVM spatial metadata and credit from a JPEG's XMP packet."""
    b = path.read_bytes()
    x = b[b.find(b"<x:xmpmeta") : b.find(b"</x:xmpmeta>")].decode("utf-8", "ignore")

    def seq(k):
        m = re.search(rf"<avm:{k}>(.*?)</avm:{k}>", x, re.S)
        return [float(v) for v in re.findall(r"<rdf:li>([^<]*)</rdf:li>", m.group(1))]

    def attr(k):
        m = re.search(rf'avm:{k}="([^"]*)"', x) or re.search(
            rf"<avm:{k}>([^<]*)</avm:{k}>", x
        )
        return html.unescape(m.group(1)).strip() if m else ""

    if attr("Spatial.CoordsystemProjection") != "TAN":
        raise ValueError(f"{path.name}: not a TAN projection")
    return {
        "ref": seq("Spatial.ReferenceValue"),
        "px": seq("Spatial.ReferencePixel"),
        "dim": seq("Spatial.ReferenceDimension"),
        "scale": seq("Spatial.Scale"),
        "rot": float(attr("Spatial.Rotation")),
        "credit": attr("Credit"),
        "referenceUrl": attr("ReferenceURL"),
    }


def pick_resource(rec):
    best = None
    for r in rec.get("Resources", []):
        if (
            r.get("MediaType") == "Image"
            and str(r["URL"]).lower().endswith((".jpg", ".jpeg", ".png"))
            and r["FileSize"] <= MAX_BYTES
            and max(r["Dimensions"]) >= 1000
            and (best is None or r["FileSize"] > best["FileSize"])
        ):
            best = r
    return best


def sources_in(w, name, cache, dja_cat):
    """Catalog sources inside an image footprint, with per-catalog counts."""
    rad = 0.5 * math.hypot(*w["dim"]) * abs(w["scale"][0]) * 1.05
    if rad > MAX_RADIUS_DEG:
        return None
    ra0, dec0 = w["ref"]
    dra = rad / max(math.cos(math.radians(dec0)), 0.05)
    dja = [c for c in dja_cat if abs(c[1] - dec0) < rad and abs(c[0] - ra0) < dra]
    layers = [
        ("DAWN JWST Archive", dja),
        ("DESI DR1", query_desi(cache, name, ra0, dec0, rad)),
        ("SDSS DR18", query_sdss(cache, name, ra0, dec0, rad)),
    ]
    inside = []
    counts: dict[str, int] = {}
    for ra, dec, z, cname in merge(layers):
        x, y = sky_to_pixel(w, ra, dec)
        if 0 <= x < w["dim"][0] and 0 <= y < w["dim"][1]:
            inside.append([round(ra, 6), round(dec, 6), round(z, 4)])
            counts[cname] = counts.get(cname, 0) + 1
    return inside, counts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", type=Path, required=True)
    args = ap.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    cat = catalog(fetch(DJA, args.cache / "dja_v44.csv.gz"))
    print(f"{len(cat)} unique grade-3 catalog sources")
    fields = []
    for source, url in FEEDS.items():
        feed = json.load(open(fetch(url, args.cache / f"{source.split('/')[1]}.json")))
        for rec in feed:
            if rec.get("Type") != "Observation":
                continue
            if rec.get("Spatial.Quality") != "Full":
                continue
            if rec.get("Spatial.CoordsystemProjection") != "TAN":
                continue
            res = pick_resource(rec)
            if not res:
                continue
            try:
                w = {
                    "ref": [float(x) for x in rec["Spatial.ReferenceValue"]],
                    "px": [float(x) for x in rec["Spatial.ReferencePixel"]],
                    "dim": [float(x) for x in rec["Spatial.ReferenceDimension"]],
                    "scale": [float(x) for x in rec["Spatial.Scale"]],
                    "rot": float(rec["Spatial.Rotation"]),
                }
            except (KeyError, TypeError, ValueError):
                continue
            found = sources_in(w, rec["ID"], args.cache, cat)
            if found is None or len(found[0]) < MIN_SOURCES:
                continue
            inside, counts = found
            fields.append(
                {
                    "id": rec["ID"],
                    "source": source,
                    "title": unbytes(rec.get("Title")),
                    "credit": unbytes(rec.get("Credit")),
                    "referenceUrl": rec.get("ReferenceURL", ""),
                    "url": res["URL"],
                    "size": [res["Dimensions"][0], res["Dimensions"][1]],
                    "wcs": w,
                    "catalogs": counts,
                    "sources": inside,
                }
            )
            print(f"{rec['ID']:12} {len(inside):5} sources {counts}  {unbytes(rec.get('Title'))}")
    for ex in EXTRA:
        if any(f["id"] == ex["id"] for f in fields):
            continue
        img = fetch(ex["url"], args.cache / f"{ex['id']}.jpg")
        w = avm_from_file(img)
        credit, ref = w.pop("credit"), w.pop("referenceUrl")
        found = sources_in(w, ex["id"], args.cache, cat)
        if found is None or len(found[0]) < ex["min_sources"]:
            print(f"{ex['id']}: skipped, {0 if found is None else len(found[0])} sources")
            continue
        inside, counts = found
        fields.append(
            {
                "id": ex["id"],
                "source": ex["source"],
                "title": ex["title"],
                "credit": credit,
                "referenceUrl": ref,
                "url": ex["url"],
                "size": [int(w["dim"][0]), int(w["dim"][1])],
                "wcs": w,
                "catalogs": counts,
                "sources": inside,
            }
        )
        print(f"{ex['id']:12} {len(inside):5} sources {counts}  {ex['title']}")
    fields.sort(key=lambda f: -len(f["sources"]))
    OUT.write_text(json.dumps(fields, separators=(",", ":")) + "\n")
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes, {len(fields)} fields)")


if __name__ == "__main__":
    main()

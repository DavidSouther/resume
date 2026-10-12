"""BOE data: election district geometry and the election district to early voting site assignments.

The Board of Elections publishes one PDF per county ("Poll Site List ... Early Voting <county>") on
https://www.vote.nyc/elections. For each assembly district (AD) it lists the site assigned to every
election district (ED). The PDFs are read with poppler's `pdftotext -bbox-layout`, which gives each
word's position, so the grid of blocks can be rebuilt from x and y coordinates.
"""

import collections
import html
import re
import subprocess
from collections.abc import Sequence
from dataclasses import dataclass
from typing import cast

from shapely import make_valid
from shapely.geometry import shape
from shapely.geometry.base import BaseGeometry

from ..generic import net
from ..kernel.domain import Site

PDF_URL = "https://www.vote.nyc/sites/default/files/pdf/poll_site_list/GE2026/Poll_Site_List_Nov_General_2026_Early_Voting_{county}.pdf"
COUNTIES = {"Bronx": "Bronx", "Kings": "Brooklyn", "New_York": "Manhattan", "Queens": "Queens", "Richmond": "Staten Island"}

WORD = re.compile(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="[\d.]+">([^<]*)</word>')
LEADER = re.compile(r"\s*\.[\s.]*\.\.[\s.]*")  # a run of dots (at least three) with optional spaces between
ORDINAL_SUFFIXES = ("st", "nd", "rd", "th")
COLUMN_SLACK = 2  # points between the "ED" column header and the left edge of an ED number
ROW_TOLERANCE = 3  # words whose top edges are this close (in points) are on one row


@dataclass(frozen=True)
class EdAssignment:
    county: str  # borough name
    ad: int
    ed: int
    site_name: str
    site_address: str

    @property
    def elect_dist(self) -> int:
        """Key of the NYC Open Data election district layer: AD * 1000 + ED."""
        return self.ad * 1000 + self.ed


@dataclass(frozen=True)
class _Word:
    page: int
    x: float
    y: float
    x_max: float
    text: str


def split_site(segment: str) -> tuple[str, str] | None:
    """'NAME ......... ADDRESS' -> (name, address); None when no dot leader separates them."""
    m = LEADER.search(segment)
    if not m:
        return None
    name, address = segment[: m.start()].strip(" ."), segment[m.end() :].strip()
    return (name, address) if name and address else None


def _words(bbox_html: str) -> list[_Word]:
    out: list[_Word] = []
    page = 0
    for m in re.finditer(r"<page |" + WORD.pattern, bbox_html):
        if m.group(0).startswith("<page"):
            page += 1
        else:
            out.append(_Word(page, float(m.group(1)), float(m.group(2)), float(m.group(3)), html.unescape(m.group(4))))
    return out


def parse_county(bbox_html: str, county: str) -> tuple[list[EdAssignment], list[str]]:
    """Assignments from a county's `pdftotext -bbox-layout` output, and the rows that could not be parsed.

    The page is a grid of blocks, one per assembly district, each with ED, SITE NAME and SITE ADDRESS
    columns. An "<n>th Assembly District" label sits above its block's ED column. A page can start new
    labels over some columns while others carry on, so a row's district is the nearest label above it
    in the same column."""
    words = _words(bbox_html)
    columns = sorted({round(w.x) for w in words if w.text == "ED"})
    labels: dict[int, list[tuple[int, float, int]]] = collections.defaultdict(list)  # column -> (page, y, ad)
    for before, suffix, label in zip(words, words[1:], words[2:], strict=False):  # "23" "rd" "Assembly"
        if label.text == "Assembly" and before.text.isdigit() and suffix.text in ORDINAL_SUFFIXES:
            owner = [c for c in columns if c <= before.x + COLUMN_SLACK]
            if owner:
                labels[owner[-1]].append((before.page, before.y, int(before.text)))
    assignments: list[EdAssignment] = []
    problems: list[str] = []
    for w in words:
        if not re.fullmatch(r"\d{3}", w.text) or not columns:
            continue
        column = min(columns, key=lambda c: abs(c - w.x))
        if abs(column - w.x) > COLUMN_SLACK:
            continue  # a house number or other three digit word
        above = [(p, y, ad) for p, y, ad in labels[column] if (p, y) <= (w.page, w.y + 1)]
        right_edge = min((c for c in columns if c > column), default=float("inf"))
        row = [r for r in words if r.page == w.page and abs(r.y - w.y) <= ROW_TOLERANCE and w.x_max <= r.x < right_edge - COLUMN_SLACK]
        segment = " ".join(r.text for r in sorted(row, key=lambda r: r.x))
        site = split_site(segment)
        if not above or site is None:
            problems.append(f"{county} ED {w.text}: {segment!r}")
            continue
        assignments.append(EdAssignment(county, max(above)[2], int(w.text), site[0], site[1]))
    return assignments, problems


def read_assignments() -> list[EdAssignment]:
    """Download (through the net cache) and parse the five county PDFs. Raises when any row cannot be parsed."""
    out: list[EdAssignment] = []
    for county, borough in COUNTIES.items():
        pdf = net.get(PDF_URL.format(county=county), timeout=120).content
        bbox = subprocess.run(["pdftotext", "-bbox-layout", "-", "-"], input=pdf, check=True, capture_output=True).stdout.decode("utf-8")
        parsed, problems = parse_county(bbox, borough)
        if problems:
            raise RuntimeError(f"{len(problems)} unparsed rows in the {borough} PDF, for example {problems[:3]}")
        out += parsed
    return out


# ------------------------------------------------------------- matching sites

STREET_WORDS = {
    "AVE": "AVENUE", "BLVD": "BOULEVARD", "ST": "STREET", "RD": "ROAD", "PKWY": "PARKWAY", "PL": "PLACE", "DR": "DRIVE", "CT": "COURT",
    "LN": "LANE", "HWY": "HIGHWAY", "W": "WEST", "E": "EAST", "N": "NORTH", "S": "SOUTH", "QNS": "QUEENS", "FT": "FORT", "TER": "TERRACE",
    "EXPY": "EXPRESSWAY", "SQ": "SQUARE", "LEX": "LEXINGTON",
}  # fmt: skip
# Addresses the PDF and the poll site map write differently in a way normalization cannot fix.
ADDRESS_ALIASES = {
    "2030 ANTIN PLACE": "2040 ANTIN PLACE",  # the PDF's house number differs from the site map's
    "301 SEABREEZE AVENUE": "301 SEA BREEZE AVENUE",
}


def normalize_address(address: str) -> str:
    """Upper case, no punctuation, 'AVE' spelled out, ordinal suffixes dropped, and '2-07' written '207'."""
    text = re.sub(r"(?<=\d)-(?=\d)", "", address.upper())
    text = re.sub(r"\b(\d+)(?:ST|ND|RD|TH)\b", r"\1", text)
    words = re.sub(r"[^A-Z0-9 ]", " ", text).split()
    key = " ".join(STREET_WORDS.get(w, w) for w in words)
    return ADDRESS_ALIASES.get(key, key)


def sites_by_assignment(assignments: Sequence[EdAssignment], sites: Sequence[Site]) -> dict[str, Site]:
    """Site for each distinct assigned address (normalized). Raises when an address matches no site."""
    by_address = {normalize_address(s.name): s for s in sites}  # a Site's name is its street address
    wanted = {normalize_address(a.site_address) for a in assignments}
    missing = sorted(wanted - by_address.keys())
    if missing:
        raise RuntimeError(f"{len(missing)} assigned early voting addresses match no poll site: {missing}")
    return {k: by_address[k] for k in sorted(wanted)}  # sorted: a set's order changes between runs


# ------------------------------------------------------------- election districts

ED_URL = "https://data.cityofnewyork.us/resource/wwxk-38u4.geojson?$limit=5000"  # DCP election districts, shoreline clipped


@dataclass(frozen=True)
class ElectionDistrict:
    elect_dist: int  # AD * 1000 + ED
    geometry: BaseGeometry


def read_election_districts() -> list[ElectionDistrict]:
    features = cast(list[dict[str, dict[str, object]]], cast(dict[str, object], net.get_json(ED_URL, timeout=180))["features"])
    return [ElectionDistrict(int(str(f["properties"]["elect_dist"])), make_valid(shape(f["geometry"]))) for f in features]


def assigned_sites(districts: Sequence[ElectionDistrict], assignments: Sequence[EdAssignment], sites: Sequence[Site]) -> dict[int, Site]:
    """The early voting site each election district is assigned to."""
    by_address = sites_by_assignment(assignments, sites)
    site_of = {a.elect_dist: by_address[normalize_address(a.site_address)] for a in assignments}
    missing = {d.elect_dist for d in districts} - site_of.keys()
    if missing:
        raise RuntimeError(f"{len(missing)} election districts have no assigned early voting site, for example {sorted(missing)[:5]}")
    return site_of

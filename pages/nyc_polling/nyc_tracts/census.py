"""Census ACS 5-year poverty and income by tract."""

import urllib.parse
from dataclasses import dataclass
from typing import cast

from . import net

STATE = "36"
COUNTIES = {"005": "Bronx", "047": "Brooklyn", "061": "Manhattan", "081": "Queens", "085": "Staten Island"}
ACS_URL = "https://api.census.gov/data/2024/acs/acs5/subject"
ACS_VARS = [
    "S1701_C03_001E",
    "S1701_C03_001M",  # percent below poverty level
    "S1901_C01_012E",
    "S1901_C01_012M",  # households, median income (dollars)
    "S1701_C01_001E",
    "S1701_C01_001M",  # population for whom poverty status is determined
    "S1701_C02_001E",
    "S1701_C02_001M",  # population below poverty level
    "S1901_C01_001E",
    "S1901_C01_001M",  # households, total
    "S1901_C01_013E",
    "S1901_C01_013M",  # households, mean income (dollars)
    "S0101_C01_001E",
    "S0101_C01_001M",  # total population
]  # order is the API request and pop-up order
SOURCE_LINE = "Source: U.S. Census Bureau, ACS 2024 5-year, tables S1701 and S1901; NYC DCP 2020 census tracts clipped to shoreline."


@dataclass(frozen=True)
class AcsRow:
    name: str
    pov: float | None
    pov_moe: float | None
    inc: float | None
    inc_moe: float | None
    pop: float | None  # population for whom poverty status is determined
    total_pop: float | None
    total_pop_moe: float | None
    hh: float | None
    raw: dict[str, str]  # every requested variable as the API returned it, sentinel codes included


def clean_number(v: object) -> float | None:
    """Census sentinels (-666666666, -555555555, ...) and non-numbers become None."""
    if v is None:
        return None
    try:
        n = float(v)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return None if n < 0 else n


def parse_acs_row(d: dict[str, str]) -> AcsRow:
    return AcsRow(
        name=d["NAME"],
        pov=clean_number(d["S1701_C03_001E"]),
        pov_moe=clean_number(d["S1701_C03_001M"]),
        inc=clean_number(d["S1901_C01_012E"]),
        inc_moe=clean_number(d["S1901_C01_012M"]),
        pop=clean_number(d["S1701_C01_001E"]),
        total_pop=clean_number(d["S0101_C01_001E"]),
        total_pop_moe=clean_number(d["S0101_C01_001M"]),
        hh=clean_number(d["S1901_C01_001E"]),
        raw={v: d[v] for v in ACS_VARS},
    )


def fetch_acs(key: str) -> dict[str, AcsRow]:
    rows: dict[str, AcsRow] = {}
    for county in COUNTIES:
        qs = urllib.parse.urlencode(
            {"get": ",".join(["NAME", *ACS_VARS]), "for": "tract:*", "in": f"state:{STATE} county:{county}", "key": key},
            quote_via=urllib.parse.quote,
        )
        data = cast(list[list[str]], net.get_json(f"{ACS_URL}?{qs}"))
        head = data[0]
        for r in data[1:]:
            d = dict(zip(head, r, strict=True))
            rows[d["state"] + d["county"] + d["tract"]] = parse_acs_row(d)
    return rows

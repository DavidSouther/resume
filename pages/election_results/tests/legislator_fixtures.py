"""Small `unitedstates/congress-legislators` payloads for the enrichment tests, in the shape of the published JSON."""

from typing import Any

from lib.legislators import Term, parse_legislators


def person(bioguide: str, first: str, last: str, terms: list[dict[str, Any]], nickname: str | None = None) -> dict[str, Any]:
    name: dict[str, Any] = {"first": first, "last": last, "official_full": f"{nickname or first} {last}"}
    if nickname:
        name["nickname"] = nickname
    return {"id": {"bioguide": bioguide}, "name": name, "terms": terms}


def sen(state: str, cls: int, start: str, end: str, party: str = "Republican", **extra: Any) -> dict[str, Any]:
    return {"type": "sen", "state": state, "class": cls, "start": start, "end": end, "party": party, **extra}


def rep(state: str, district: int, start: str, end: str, party: str = "Republican", **extra: Any) -> dict[str, Any]:
    return {"type": "rep", "state": state, "district": district, "start": start, "end": end, "party": party, **extra}


SENATORS = [
    person("H001104", "Jon", "Husted", [sen("OH", 3, "2025-01-21", "2026-11-03", how="appointment", **{"end-type": "special-election"})]),
    person("M001242", "Bernie", "Moreno", [sen("OH", 1, "2025-01-03", "2031-01-03")]),
    person("V000137", "J. D.", "Vance", [sen("OH", 3, "2023-01-03", "2025-01-10")]),
    person("C001098", "Rafael", "Cruz", [sen("TX", 1, "2013-01-03", "2019-01-03"), sen("TX", 1, "2019-01-03", "2025-01-03")], nickname="Ted"),
    person("C001056", "John", "Cornyn", [sen("TX", 2, "2002-12-02", "2027-01-03")]),
    person("C001035", "Susan", "Collins", [sen("ME", 2, "2009-01-06", "2015-01-03"), sen("ME", 2, "2015-01-06", "2027-01-03")]),
    person(
        "K000383",
        "Angus",
        "King",
        [sen("ME", 1, "2013-01-03", "2019-01-03", "Independent", caucus="Democrat"), sen("ME", 1, "2019-01-03", "2031-01-03", "Independent", caucus="Democrat")],
    ),
    person(
        "S000033",
        "Bernard",
        "Sanders",
        [sen("VT", 1, "2013-01-03", "2019-01-03", "Independent", caucus="Democrat"), sen("VT", 1, "2019-01-03", "2031-01-03", "Independent", caucus="Democrat")],
        nickname="Bernie",
    ),
    person("L000174", "Patrick", "Leahy", [sen("VT", 3, "1975-01-14", "2023-01-03", "Democrat")]),
    person(
        "M001183",
        "Joe",
        "Manchin",
        [
            sen(
                "WV",
                1,
                "2019-01-03",
                "2025-01-03",
                "Independent",
                caucus="Democrat",
                party_affiliations=[
                    {"start": "2019-01-03", "end": "2024-05-31", "party": "Democrat"},
                    {"start": "2024-05-31", "end": "2025-01-03", "party": "Independent", "caucus": "Democrat"},
                ],
            )
        ],
    ),
    person("C001047", "Shelley", "Capito", [sen("WV", 2, "2015-01-03", "2027-01-03")]),
    person("J000300", "Doug", "Jones", [sen("AL", 2, "2018-01-03", "2021-01-03", "Democrat", how="special-election")]),
]

# Pennsylvania 2018: a court ordered map renumbered districts. Rothfus (old 12th) ran in the new 17th against Lamb (old 18th, a 2018
# special election winner), so the new 17th pairs two incumbents. Costello (old 6th) retired, so the new 6th is open with a Republican
# defending it. Dent (old 15th) resigned in May 2018, so on election day the old 15th was vacant.
HOUSE = [
    person("R000598", "Keith", "Rothfus", [rep("PA", 12, "2013-01-03", "2019-01-03")]),
    person("L000588", "Conor", "Lamb", [rep("PA", 18, "2018-04-12", "2019-01-03", "Democrat")]),
    person("C001106", "Ryan", "Costello", [rep("PA", 6, "2015-01-06", "2019-01-03")]),
    person("D000604", "Charles", "Dent", [rep("PA", 15, "2005-01-04", "2018-05-12")], nickname="Charlie"),
    person("F000466", "Brian", "Fitzpatrick", [rep("PA", 8, "2017-01-03", "2019-01-03")]),
    person("M001181", "Timothy", "Murphy", [rep("PA", 18, "2003-01-07", "2017-10-21")], nickname="Tim"),
    person("J000032", "Sheila", "Jackson Lee", [rep("TX", 18, "1995-01-03", "2024-07-19", "Democrat")]),
    person("M001157", "Michael", "McCaul", [rep("TX", 10, "2005-01-04", "2027-01-03")]),
]


def terms(*people: dict[str, Any]) -> list[Term]:
    return parse_legislators([list(people)], "fixture legislators")

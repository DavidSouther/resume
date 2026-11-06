"""`unitedstates/congress-legislators` terms, and matching a person's name against a ballot name.

The JSON files list every member with a `terms` array. Each term carries its type (`rep` or `sen`), state, start and end dates, party,
and either a House district or a Senate class. A member who left early has the term's end set to the departure date. An independent's
term carries `caucus`, and a term with a mid term party switch carries `party_affiliations`.
"""

import re
import unicodedata
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Literal, cast

from .model import Party, SourceFormatError, State

Chamber = Literal["rep", "sen"]
SUFFIXES = {"JR", "SR", "II", "III", "IV"}
EARLIEST_END = date(2000, 1, 1)  # terms ending before this cannot hold a seat on any election day from 2008 on


@dataclass(frozen=True)
class PersonName:
    first: str
    last: str
    nickname: str | None = None
    middle: str | None = None
    official: str = ""

    @property
    def display(self) -> str:
        return self.official or f"{self.nickname or self.first} {self.last}"


@dataclass(frozen=True)
class PartySpan:
    start: date
    end: date
    party: Party  # the caucus party, so an independent who caucuses with Democrats is DEM


@dataclass(frozen=True)
class Term:
    person: str  # bioguide id
    name: PersonName
    chamber: Chamber
    state: State
    district: int | None  # House only, 0 at large
    senate_class: int | None  # Senate only
    start: date
    end: date
    parties: tuple[PartySpan, ...]

    def covers(self, day: date) -> bool:
        return self.start <= day <= self.end

    def party_on(self, day: date) -> Party:
        """The caucus party on `day`, or on the nearest end of the term when `day` is outside it."""
        day = min(max(day, self.start), self.end)
        current = [span for span in self.parties if span.start <= day <= span.end]
        return current[-1].party if current else self.parties[-1].party


def parse_legislators(payloads: list[object], source: str) -> list[Term]:
    """Every House and Senate term in the given legislators JSON payloads. A missing key raises SourceFormatError naming it."""
    terms: list[Term] = []
    for payload in payloads:
        if not isinstance(payload, list):
            raise SourceFormatError(source, "the legislators file is not a list of members")
        for member in cast("list[Any]", payload):
            terms.extend(_member_terms(member, source))
    if not terms:
        raise SourceFormatError(source, "no House or Senate terms")
    return terms


def _member_terms(member: Any, source: str) -> list[Term]:
    who = "a member"
    try:
        bioguide = who = str(member["id"]["bioguide"])
        raw = member["name"]
        name = PersonName(
            first=str(raw["first"]),
            last=str(raw["last"]),
            nickname=raw.get("nickname"),
            middle=raw.get("middle"),
            official=str(raw.get("official_full") or ""),
        )
        out: list[Term] = []
        for term in member["terms"]:
            kind = term["type"]
            if kind not in ("rep", "sen"):
                continue
            start, end = date.fromisoformat(term["start"]), date.fromisoformat(term["end"])
            if end < EARLIEST_END:
                continue  # older terms predate every race read here, and some lack fields such as party
            out.append(
                Term(
                    person=bioguide,
                    name=name,
                    chamber=kind,
                    state=State(str(term["state"])),
                    district=int(term["district"]) if kind == "rep" else None,
                    senate_class=int(term["class"]) if kind == "sen" else None,
                    start=start,
                    end=end,
                    parties=_spans(term, start, end),
                )
            )
        return out
    except KeyError as e:
        raise SourceFormatError(source, f"{who} lacks the key {e}") from e
    except (TypeError, ValueError) as e:
        raise SourceFormatError(source, f"unreadable member: {e}") from e


def _spans(term: dict[str, Any], start: date, end: date) -> tuple[PartySpan, ...]:
    affiliations = term.get("party_affiliations")
    if not affiliations:
        return (PartySpan(start, end, caucus_party(term["party"], term.get("caucus"))),)
    return tuple(PartySpan(date.fromisoformat(a["start"]), date.fromisoformat(a["end"]), caucus_party(a["party"], a.get("caucus"))) for a in affiliations)


def caucus_party(party: str, caucus: str | None) -> Party:
    """`Democrat` is DEM and `Republican` is REP. Any other party takes its caucus, and with no caucus it is OTHER."""
    for label in (party, caucus or ""):
        if label == "Democrat":
            return "DEM"
        if label == "Republican":
            return "REP"
    return "OTHER"


def tokens(name: str) -> list[str]:
    """Upper case ASCII words, with accents, apostrophes, periods, commas, and suffixes removed and hyphens split."""
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    ascii_name = re.sub(r"\([^)]*\)", " ", ascii_name)
    ascii_name = re.sub(r"['.]", "", ascii_name).replace("-", " ")
    words = re.sub(r"[^A-Za-z ]", " ", ascii_name).upper().split()
    return [w for w in words if w not in SUFFIXES]


def name_strength(candidate: str, person: PersonName) -> int:
    """2 when the ballot name holds the last name and the first, nick, or middle name; 1 when it holds the last name and the first initial; else 0."""
    words = tokens(candidate)
    last = tokens(person.last)
    if not last or not any(words[i : i + len(last)] == last for i in range(len(words) - len(last) + 1)):
        return 0
    given = [t for part in (person.first, person.nickname or "", person.middle or "") for t in tokens(part)]
    rest = [w for w in words if w not in last]
    if any(len(g) > 1 and g in rest for g in given):
        return 2
    if rest and any(rest[0][0] == g[0] for g in given):
        return 1
    return 0


def person_from_display(name: str) -> PersonName:
    """A display name such as "Nathan Deal" split into first and last names, with suffixes and parentheses dropped."""
    display = " ".join(re.sub(r"\([^)]*\)", " ", name).split()).strip(" ,")
    words = [w for w in display.replace(",", " ").split() if w.rstrip(".").upper() not in SUFFIXES]
    if not words:
        return PersonName("", "", official=display)
    return PersonName(words[0], words[-1], official=display)


def general_election_day(year: int) -> date:
    """The Tuesday after the first Monday in November."""
    first = date(year, 11, 1)
    monday = first + timedelta(days=(0 - first.weekday()) % 7)
    return monday + timedelta(days=1)

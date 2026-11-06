"""MEDSL Senate and House files to candidate rows.

Both files are comma separated despite the `.tab` name. The House file wraps every data row in one pair of double quotes and writes the
quotes inside a field as `\\"`, so a wrapped row is unwrapped before CSV parsing. The Senate file is ordinary CSV with float vote counts.
"""

import csv
from collections import defaultdict
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

from .model import CandidateRow, Office, Party, Round, SourceFormatError, State
from .names import normalize_name

SOURCE: dict[Office, str] = {
    "senate": "MEDSL U.S. Senate 1976-2024, doi:10.7910/DVN/PEJ5QU",
    "house": "MEDSL U.S. House 1976-2024, doi:10.7910/DVN/IG0UN2",
    "governor": "",
}
COMMON_COLUMNS = ("year", "state_po", "stage", "special", "candidate", "writein", "candidatevotes", "unofficial")
PARTY_COLUMN: dict[Office, str] = {"senate": "party_simplified", "house": "party", "governor": ""}
EXTRA_COLUMNS: dict[Office, tuple[str, ...]] = {"senate": (), "house": ("district",), "governor": ()}

SKIPPED_STAGES = {"pri"}  # primaries, out of scope
STAGES: dict[str, Round] = {"gen": "general", "pre": "general", "runoff": "runoff", "gen runoff": "runoff"}
DEM_LABELS = {"DEMOCRAT", "DEMOCRATIC", "DEMOCRATIC-FARMER-LABOR", "DEMOCRATIC-NONPARTISAN LEAGUE", "DEMOCRATIC-NPL"}
REP_LABELS = {"REPUBLICAN"}
# Rows that count ballots rather than a candidate. They are dropped, so a race's total is the sum of its candidates' votes.
NOT_A_CANDIDATE = {
    "OVER VOTES", "OVER VOTE", "OVERVOTES", "OVERVOTE", "UNDER VOTES", "UNDER VOTE", "UNDERVOTES", "UNDERVOTE",
    "BLANK", "BLANKS", "BLANK VOTE", "BLANK VOTES", "VOID", "VOID VOTE", "VOID VOTES", "BLANK VOTE/VOID VOTE",
}  # fmt: skip
NOT_A_CANDIDATE_PREFIXES = ("BLANK VOTE/", "BLANK/")

# Senate classes by regular election year: class 1 was elected in 2018, class 2 in 2020, class 3 in 2022.
CLASS_BY_YEAR_MOD_6 = {2: 1, 4: 2, 0: 3}
# A special can fill the other seat or the remainder of the seat up the same year, so the class of every special is listed.
SPECIAL_CLASS: dict[tuple[int, str], int] = {
    (2008, "MS"): 1, (2008, "WY"): 1,
    (2010, "DE"): 2, (2010, "IL"): 3, (2010, "NY"): 1, (2010, "WV"): 1,
    (2014, "HI"): 3, (2014, "OK"): 3, (2014, "SC"): 3,
    (2018, "MN"): 2, (2018, "MS"): 2,
    (2020, "AZ"): 3, (2020, "GA"): 3,
    (2022, "CA"): 3, (2022, "OK"): 2,
    (2024, "CA"): 1, (2024, "NE"): 2,
    (2026, "FL"): 3, (2026, "OH"): 3,
}  # fmt: skip
OUTSIDE_STATES = {"DC", "PR", "GU", "VI", "AS", "MP"}


PRESIDENT_COLUMNS = ("year", "state_po", "candidatevotes", "party_simplified")


@dataclass(frozen=True)
class PresidentialResult:
    """One state's presidential vote: the Democratic and Republican tickets and every vote cast for a candidate."""

    year: int
    state: State
    dem: int
    rep: int
    total: int


@dataclass
class _Line:
    year: int
    state: State
    seat: int
    special: bool
    round: Round
    candidate: str
    label: Party
    votes: int
    unofficial: bool


def parse_medsl(path: Path, office: Office, fetched_at: str, min_year: int = 2008) -> list[CandidateRow]:
    """Sums fusion lines per candidate, maps parties to DEM, REP, OTHER, and strips the outer quotes the House file wraps around each data row."""
    source = path.name
    lines = list(_records(path, office, min_year))
    totals: dict[tuple[int, State, int, bool, Round], int] = defaultdict(int)
    merged: dict[tuple[int, State, int, bool, Round, str], list[_Line]] = defaultdict(list)
    for line in lines:
        race = (line.year, line.state, line.seat, line.special, line.round)
        totals[race] += line.votes
        merged[(*race, line.candidate)].append(line)
    rows: list[CandidateRow] = []
    for (year, state, seat, special, round_, candidate), parts in merged.items():
        votes = sum(p.votes for p in parts)
        total = totals[(year, state, seat, special, round_)]
        rows.append(
            CandidateRow(
                year=year,
                state=state,
                office=office,
                seat=seat,
                special=special,
                round=round_,
                candidate=candidate,
                party=_major_party(parts),
                votes=votes,
                total_votes=total,
                pct=round(100.0 * votes / total, 4) if total else 0.0,
                incumbent=False,
                unofficial=any(p.unofficial for p in parts),
                source=f"{SOURCE[office]} ({source})",
                fetched_at=fetched_at,
            )
        )
    if not rows:
        raise SourceFormatError(source, f"no {office} rows from {min_year} on")
    return rows


def _major_party(parts: list[_Line]) -> Party:
    """A fusion candidate takes the major party line carrying the most votes."""
    by_party: dict[Party, int] = defaultdict(int)
    for p in parts:
        by_party[p.label] += p.votes
    majors: list[tuple[int, Party]] = [(v, party) for party, v in by_party.items() if party != "OTHER"]
    return max(majors)[1] if majors else "OTHER"


def _rows(path: Path) -> Iterator[dict[str, str]]:
    text = path.read_text(encoding="utf-8").splitlines()
    if not text:
        raise SourceFormatError(path.name, "empty file")
    header = next(csv.reader([text[0]]))
    for number, raw in enumerate(text[1:], start=2):
        if not raw.strip():
            continue
        fields = next(csv.reader([raw]))
        if len(fields) != len(header) and raw.startswith('"') and raw.endswith('"'):
            fields = [f.replace('\\"', '"') for f in next(csv.reader([raw[1:-1].replace('\\"', '"')]))]
        if len(fields) != len(header):
            raise SourceFormatError(path.name, f"line {number} has {len(fields)} fields, the header has {len(header)}")
        yield dict(zip(header, fields, strict=True))


def _records(path: Path, office: Office, min_year: int) -> Iterator[_Line]:
    source = path.name
    party_column = PARTY_COLUMN[office]
    required = (*COMMON_COLUMNS, party_column, *EXTRA_COLUMNS[office])
    checked = False
    for row in _rows(path):
        if not checked:
            missing = [c for c in required if c not in row]
            if missing:
                raise SourceFormatError(source, f"missing column {', '.join(repr(c) for c in missing)}")
            checked = True
        stage = row["stage"].strip().lower()
        if stage in SKIPPED_STAGES:
            continue
        if stage not in STAGES:
            raise SourceFormatError(source, f"unknown stage {row['stage']!r}")
        round_ = STAGES[stage]
        year = int(row["year"])
        if round_ == "runoff" and year % 2 == 1:
            year -= 1  # a January runoff belongs to the November cycle it decided
        state = State(row["state_po"].strip())
        candidate = row["candidate"].strip()
        if year < min_year or state in OUTSIDE_STATES or _not_a_candidate(candidate):
            continue
        special = _flag(row["special"], source)
        seat = int(row["district"]) if office == "house" else senate_class(year, state, special, source)
        yield _Line(
            year=year,
            state=state,
            seat=seat,
            special=special,
            round=round_,
            candidate=normalize_name(candidate) or "Other",
            label=_party(row[party_column], office),
            votes=int(float(row["candidatevotes"] or 0)),
            unofficial=_flag(row["unofficial"], source),
        )


def _not_a_candidate(name: str) -> bool:
    upper = name.upper()
    return upper in NOT_A_CANDIDATE or upper.startswith(NOT_A_CANDIDATE_PREFIXES)


def _party(label: str, office: Office) -> Party:
    names = {label.strip().upper()} if office == "senate" else {part.strip() for part in label.upper().replace("/", ",").split(",")}
    if names & DEM_LABELS:
        return "DEM"
    if names & REP_LABELS:
        return "REP"
    return "OTHER"


def _flag(value: str, source: str) -> bool:
    v = value.strip().lower()
    if v in ("true", "t", "1"):
        return True
    if v in ("false", "f", "0", "na", ""):
        return False
    raise SourceFormatError(source, f"unreadable flag {value!r}")


def senate_class(year: int, state: str, special: bool, source: str) -> int:
    if special:
        if (year, state) not in SPECIAL_CLASS:
            raise SourceFormatError(source, f"Senate special {state} {year} has no class in SPECIAL_CLASS")
        return SPECIAL_CLASS[(year, state)]
    if year % 6 not in CLASS_BY_YEAR_MOD_6:
        raise SourceFormatError(source, f"regular Senate election {state} {year} is not in an even year")
    return CLASS_BY_YEAR_MOD_6[year % 6]


def parse_medsl_president(path: Path, min_year: int = 2004) -> list[PresidentialResult]:
    """Statewide presidential totals from the MEDSL President file, by `party_simplified`, states only.

    The total is the sum of the candidate rows, write ins included, so the margin is a share of all votes cast for president.
    """
    source = path.name
    totals: dict[tuple[int, State], dict[Party, int]] = defaultdict(lambda: defaultdict(int))
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)  # ordinary CSV, with a quoted line break inside one 2024 write in name
        missing = [c for c in PRESIDENT_COLUMNS if c not in (reader.fieldnames or [])]
        if missing:
            raise SourceFormatError(source, f"missing column {', '.join(repr(c) for c in missing)}")
        rows = list(reader)
    for row in rows:
        year, state = int(row["year"]), State(row["state_po"].strip())
        if year < min_year or state in OUTSIDE_STATES:
            continue
        label = row["party_simplified"].strip().upper()
        party: Party = "DEM" if label == "DEMOCRAT" else "REP" if label == "REPUBLICAN" else "OTHER"
        totals[(year, state)][party] += int(float(row["candidatevotes"] or 0))
    if not totals:
        raise SourceFormatError(source, f"no presidential rows from {min_year} on")
    return [PresidentialResult(year, state, votes["DEM"], votes["REP"], sum(votes.values())) for (year, state), votes in sorted(totals.items())]

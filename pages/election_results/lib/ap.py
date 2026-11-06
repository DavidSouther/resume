"""AP Elections live results (the `metadata.json` and `progress.json` files behind apnews.com) to 2026 candidate rows.

Both files are keyed by AP race id. Metadata names the office, state, seat, status, and candidates; progress holds each candidate's
count, the winner mark, and `eevp`, the percent of the expected vote counted. Only U.S. House, U.S. Senate, and governor races in a
state are read. AP reports the first round of a ranked choice race and the November round of a race headed to a runoff, so both are
stored as `general` rounds and noted in the load report until `data/overrides/result_overrides.csv` adds the deciding round.
"""

import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any, cast

from .model import AT_LARGE_STATES, STATE_CODES, CandidateRow, Office, Party, SourceFormatError, State
from .names import normalize_name
from .wikipedia import GOVERNOR_TITLE, HOUSE_TITLE, SENATE_TITLE

SOURCE = "ap"
OFFICES: dict[str, Office] = {"H": "house", "S": "senate", "G": "governor"}
SPECIAL_RACE_TYPES = {"W"}  # AP raceTypeID for a special general election
BALLOT_LINES = {"blank votes", "over votes", "under votes"}  # AP lines counting ballots, not a candidate
WRITE_IN_TOTAL = "total write-ins"
FULL_COUNT = 100.0
STATES = set(STATE_CODES.values())
PAGE_TITLES: tuple[tuple[re.Pattern[str], int, Office], ...] = ((GOVERNOR_TITLE, 2, "governor"), (SENATE_TITLE, 3, "senate"), (HOUSE_TITLE, 2, "house"))

RaceKey = tuple[int, State, Office, int, bool]


@dataclass(frozen=True)
class ApPull:
    rows: list[CandidateRow] = field(default_factory=lambda: [])
    notes: list[str] = field(default_factory=lambda: [])  # races not read or read only in part, for the load report
    eevp: list[str] = field(default_factory=lambda: [])  # one line per race counted below 100 percent of its expected vote


class _Skip(Exception):
    pass


def parse_ap(metadata: object, progress: object, year: int, fetched_at: str) -> ApPull:
    """The candidate rows of every House, Senate, and governor race in both files, with the load report notes.

    A race AP cannot place (the national House vote total, a missing seat number, or no progress record) is noted and not written.
    """
    meta = _object(metadata, "AP metadata.json")
    prog = _object(progress, "AP progress.json")
    result = ApPull()
    for race_id in sorted(meta):
        race = _object(meta[race_id], f"AP metadata.json {race_id}")
        office = OFFICES.get(str(race.get("officeID")))
        if office is None:
            continue
        try:
            key = _key(race, office, year, race_id)
        except _Skip as e:
            result.notes.append(f"{race_id}: {e}, so it was not read")
            continue
        name = race_name(key)
        if race_id not in prog:
            result.notes.append(f"{name}: no progress record for {race_id}, so it was not read")
            continue
        counts = _object(prog[race_id], f"AP progress.json {race_id}")
        try:
            rows, notes = _race_rows(race, counts, key, fetched_at)
        except _Skip as e:
            result.notes.append(f"{name}: {e}")
            continue
        result.rows.extend(rows)
        result.notes.extend(f"{name}: {note}" for note in notes)
        eevp = _number(counts.get("eevp"))
        if eevp is not None and eevp < FULL_COUNT:
            updated = re.sub(r"\.\d+Z$", "Z", str(counts.get("lastUpdated", "")))
            result.eevp.append(f"{name}: eevp {eevp:g}, last updated {updated}")
    return result


def _object(value: object, source: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise SourceFormatError(source, "not a JSON object")
    return cast("dict[str, Any]", value)


def _number(value: object) -> float | None:
    return float(value) if isinstance(value, int | float) and not isinstance(value, bool) else None


def _key(race: Mapping[str, Any], office: Office, year: int, race_id: str) -> RaceKey:
    state = State(str(race.get("statePostal", "")))
    if state not in STATES:
        raise _Skip(f"AP {office} entry for {state or 'no state'} is not a state race (the national House vote total)")
    special = str(race.get("raceTypeID")) in SPECIAL_RACE_TYPES
    if office == "governor":
        return (year, state, office, 0, special)
    seat = str(race.get("seatNum", ""))
    if not seat.isdigit():
        raise _Skip(f"{year} {state} {office} has no seat number in {race_id}")
    if office == "house":
        return (year, state, office, 0 if state in AT_LARGE_STATES else int(seat), special)
    if int(seat) not in (1, 2, 3):
        raise _Skip(f"{year} {state} senate class {seat} in {race_id} is not 1, 2, or 3")
    return (year, state, office, int(seat), special)


def _race_rows(race: Mapping[str, Any], progress: Mapping[str, Any], key: RaceKey, fetched_at: str) -> tuple[list[CandidateRow], list[str]]:
    people = _object(race.get("candidates", {}), "AP metadata.json candidates")
    lines: list[tuple[str, Party, int, str]] = []  # name, party, votes, winner mark
    for entry in cast("list[object]", progress.get("candidates") or []):
        count = _object(entry, "AP progress.json candidate")
        person = people.get(str(count.get("candidateID")))
        votes = count.get("voteCount")
        if not isinstance(person, dict) or not isinstance(votes, int):
            raise _Skip(f"candidate {count.get('candidateID')} has no metadata or no vote count, so the race was not read")
        person = cast("dict[str, Any]", person)
        name = _name(person)
        if name.lower() in BALLOT_LINES or (name.lower() == WRITE_IN_TOTAL and votes == 0):
            continue
        lines.append((name, party_of(str(person.get("party", ""))), votes, str(count.get("winner") or "")))
    if not lines:
        raise _Skip("AP lists no candidates, so the race was not read")
    total = sum(votes for _, _, votes, _ in lines)
    notes: list[str] = []
    uncounted = total == 0
    if uncounted:
        if len(lines) > 1:
            raise _Skip("AP has counted no votes yet, so the race was not read")
        notes.append("uncontested and not counted, so its votes are null")
    if race.get("rankedChoice") and not uncounted and max(votes for _, _, votes, _ in lines) * 2 <= total:
        notes.append("ranked choice, AP reports the first round only, so it is stored as the general round until result_overrides.csv adds rcv_final")
    advancing = [name for name, _, _, mark in lines if mark == "R"]
    if advancing or race.get("raceCallStatus") == "Runoff":
        between = " and ".join(advancing) or "candidates AP has not named"
        notes.append(f"AP reports a runoff between {between}, so the November round is stored as general until result_overrides.csv adds the runoff")
    elif race.get("numRunoff") and not uncounted and max(votes for _, _, votes, _ in lines) * 2 <= total:
        notes.append("no candidate has a majority in a state with runoffs, so a runoff may follow")
    year, state, office, seat, special = key
    unofficial = race.get("isCertified") is not True
    incumbents = {_name(cast("dict[str, Any]", p)) for p in people.values() if isinstance(p, dict) and cast("dict[str, Any]", p).get("incumbent") is True}
    rows = [
        CandidateRow(
            year=year,
            state=state,
            office=office,
            seat=seat,
            special=special,
            round="general",
            candidate=normalize_name(name),
            party=party,
            votes=None if uncounted else votes,
            total_votes=None if uncounted else total,
            pct=None if uncounted else round(100.0 * votes / total, 4),
            incumbent=name in incumbents,
            unofficial=unofficial,
            source=SOURCE,
            fetched_at=fetched_at,
        )
        for name, party, votes, _ in lines
    ]
    return rows, notes


def _name(person: Mapping[str, Any]) -> str:
    """First name, last name, and suffix, such as "Nick Begich III". A line with no first name, such as a write in total, keeps its label."""
    parts = [str(person.get(k) or "").strip() for k in ("first", "last", "suffix")]
    return " ".join(p for p in parts if p)


def party_of(code: str) -> Party:
    """An AP party code as DEM, REP, or OTHER. An independent keeps OTHER even when AP lists a caucus, as the design's caucus rule asks."""
    return "DEM" if code == "Dem" else "REP" if code == "GOP" else "OTHER"


def race_name(key: RaceKey) -> str:
    """The load report name of a race, matching the Wikipedia parser's names, such as "2026 TX house district 26"."""
    year, state, office, seat, special = key
    district = f" district {seat}" if office == "house" else ""
    return f"{year} {state} {office}{district}{' special' if special else ''}"


def keep_uncovered(rows: list[CandidateRow], notes: list[str], covered: set[RaceKey]) -> tuple[list[CandidateRow], list[str]]:
    """Drops the rows and load report notes of races AP covers, so another source fills only the races AP lacks.

    A note is dropped when it names a covered race, or names a state page (such as "2026 TX house" or a Wikipedia page title) whose
    state and office AP covers.
    """
    names = {race_name(k) for k in covered}
    offices: set[tuple[int, State, Office]] = {(year, state, office) for year, state, office, _, _ in covered}
    kept_rows = [r for r in rows if (r.year, r.state, r.office, r.seat, r.special) not in covered]
    kept_notes = [n for n in notes if not _covered_note(n.split(":", 1)[0], names, offices)]
    return kept_rows, kept_notes


def _covered_note(subject: str, names: set[str], offices: set[tuple[int, State, Office]]) -> bool:
    if subject in names:
        return True
    m = re.match(r"^(\d{4}) ([A-Z]{2}) (house|senate|governor)$", subject)
    if m:
        return (int(m.group(1)), State(m.group(2)), cast("Office", m.group(3))) in offices
    for pattern, group, office in PAGE_TITLES:
        t = pattern.match(subject)
        if t:
            return (int(t.group(1)), STATE_CODES[t.group(group)], office) in offices
    return False


@dataclass(frozen=True)
class RaceProgress:
    eevp: float | None  # percent of the expected vote counted, null when AP gives none
    last_updated: str | None  # AP's lastUpdated, to the second


def progress_by_race(metadata: object, progress: object, year: int) -> dict[RaceKey, RaceProgress]:
    """The counting progress of every House, Senate, and governor race in both files, keyed as `parse_ap` keys its rows.

    A race `parse_ap` skips for its key (the national House vote total, a missing seat number) is left out, and a race with no
    progress record has a null `eevp`.
    """
    meta = _object(metadata, "AP metadata.json")
    prog = _object(progress, "AP progress.json")
    found: dict[RaceKey, RaceProgress] = {}
    for race_id in sorted(meta):
        race = _object(meta[race_id], f"AP metadata.json {race_id}")
        office = OFFICES.get(str(race.get("officeID")))
        if office is None:
            continue
        try:
            key = _key(race, office, year, race_id)
        except _Skip:
            continue
        counts = _object(prog.get(race_id, {}), f"AP progress.json {race_id}")
        updated = counts.get("lastUpdated")
        found[key] = RaceProgress(_number(counts.get("eevp")), re.sub(r"\.\d+Z$", "Z", updated) if isinstance(updated, str) else None)
    return found

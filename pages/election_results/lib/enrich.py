"""Incumbency, redistricting, lean, and delegation lookups for race rows.

Incumbency follows the design's rules. A Senate incumbent has served the seat continuously for the two years before election day, so an
appointee or a recent special election winner is not one. A House incumbent is the member serving on election day, matched to the race
whose ballot carries the member's name, so a member moved to a new district number by a redraw is the incumbent there. A governor
incumbent is the officeholder named in the race page's infobox. An independent who caucuses with a party is an incumbent of that party.
"""

import csv
from collections import defaultdict
from dataclasses import dataclass, replace
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from .legislators import Term, general_election_day, name_strength, person_from_display
from .medsl import PresidentialResult
from .model import AT_LARGE_STATES, CandidateRow, Lean, Office, Party, RaceRow, SourceFormatError, State
from .source_table import SourceTable

REDISTRICTING_COLUMNS = ("state", "first_election_year", "kind", "source_id")
SWING_MARGIN = 5.0  # an absolute presidential margin at or below this is swing

REDISTRICTING_KINDS = ("census", "mid_cycle")
CONTINUOUS_GAP = timedelta(days=31)  # terms of one senator this close together count as continuous service
NAME_SEPARATOR = "; "  # joins the names of paired House incumbents in `incumbent_name`

GovernorKey = tuple[int, State, bool]  # year, state, special
RaceKey = tuple[int, State, Office, int, bool]


@dataclass(frozen=True)
class GovernorIncumbent:
    name: str
    party: Party


@dataclass(frozen=True)
class Redistricting:
    state: State
    first_election_year: int
    kind: str  # census or mid_cycle
    source: str


def senate_incumbency(races: list[RaceRow], candidates: list[CandidateRow], terms: list[Term]) -> list[RaceRow]:
    """Two year continuous service, with the caucus party for independents. Other offices pass through unchanged.

    The seat holder on election day counts as the incumbent only after two years of continuous service in that seat, so an appointee
    or a recent special election winner is not one. The holder's caucus party is still the seat's defending party.
    """
    names = _ballot_names(candidates)
    seats: dict[tuple[State, int], list[Term]] = defaultdict(list)
    for term in terms:
        if term.chamber == "sen" and term.senate_class is not None:
            seats[(term.state, term.senate_class)].append(term)
    out: list[RaceRow] = []
    for race in races:
        if race.office != "senate":
            out.append(race)
            continue
        day = general_election_day(race.year)
        seat_terms = seats.get((race.state, race.seat), [])
        holder = _holder(seat_terms, day)
        if holder is None:
            out.append(replace(race, incumbent_name=None, incumbent_party=None, incumbent_running=False))
            continue
        party = holder.party_on(day)
        if _service_start(holder, seat_terms) > _years_before(day, 2):
            out.append(replace(race, incumbent_name=None, incumbent_party=party, incumbent_running=False))
            continue
        on_ballot = _best_ballot_name(holder, names.get(_key(race), []))
        out.append(replace(race, incumbent_name=on_ballot or holder.name.display, incumbent_party=party, incumbent_running=on_ballot is not None))
    return out


def house_incumbency(races: list[RaceRow], candidates: list[CandidateRow], terms: list[Term]) -> list[RaceRow]:
    """The member holding a seat on election day, followed to the district whose ballot carries the member's name, and a paired flag.

    A member counts as running in the race whose ballot names them, whatever district number they held, so a member moved by a redraw
    is the incumbent of the district they run in. Two members on one ballot set `paired_incumbents`. A race with no member on its ballot
    takes the party of the member holding that district number (or the last one, when the seat is vacant). A special election fills a
    vacancy, so it has no incumbent running and takes the party of the member who left.
    """
    names = _ballot_names(candidates)
    reps = [t for t in terms if t.chamber == "rep" and t.district is not None]
    by_seat: dict[tuple[State, int], list[Term]] = defaultdict(list)
    for term in reps:
        by_seat[(term.state, term.district or 0)].append(term)
    regular = [r for r in races if r.office == "house" and not r.special]
    running = _assign_members(regular, names, reps)
    out: list[RaceRow] = []
    for race in races:
        if race.office != "house":
            out.append(race)
            continue
        day = general_election_day(race.year)
        seat_terms = by_seat.get((race.state, race.seat), [])
        if race.special:
            left = _vacated(seat_terms, race.year, day)
            party = left.party_on(left.end) if left else None
            out.append(replace(race, incumbent_name=left.name.display if left else None, incumbent_party=party, incumbent_running=False))
            continue
        matched = running.get(_key(race), [])
        holder = _holder(seat_terms, day)
        if matched:
            ordered = sorted(matched, key=lambda m: (holder is None or m[0].person != holder.person, m[1]))
            lead = ordered[0][0]
            out.append(
                replace(
                    race,
                    incumbent_name=NAME_SEPARATOR.join(name for _, name in ordered),
                    incumbent_party=lead.party_on(day),
                    incumbent_running=True,
                    paired_incumbents=len(ordered) > 1,
                )
            )
            continue
        out.append(
            replace(
                race,
                incumbent_name=holder.name.display if holder else None,
                incumbent_party=holder.party_on(day) if holder else None,
                incumbent_running=False,
                paired_incumbents=False,
            )
        )
    return out


def governor_incumbency(races: list[RaceRow], candidates: list[CandidateRow], incumbents: dict[GovernorKey, GovernorIncumbent]) -> list[RaceRow]:
    """The officeholder from each race page's infobox, running when a candidate's name matches or the page marks one as incumbent."""
    names = _ballot_names(candidates)
    marked: dict[RaceKey, list[str]] = defaultdict(list)
    for c in candidates:
        if c.office == "governor" and c.incumbent:
            marked[(c.year, c.state, c.office, c.seat, c.special)].append(c.candidate)
    out: list[RaceRow] = []
    for race in races:
        if race.office != "governor":
            out.append(race)
            continue
        incumbent = incumbents.get((race.year, race.state, race.special))
        if incumbent is None:
            out.append(replace(race, incumbent_name=None, incumbent_party=None, incumbent_running=False))
            continue
        person = person_from_display(incumbent.name)
        scored = sorted(((name_strength(n, person), n) for n in names.get(_key(race), [])), reverse=True)
        on_ballot = scored[0][1] if scored and scored[0][0] > 0 else next(iter(marked.get(_key(race), [])), None)
        out.append(replace(race, incumbent_name=on_ballot or incumbent.name, incumbent_party=incumbent.party, incumbent_running=on_ballot is not None))
    return out


def flag_incumbent_candidates(candidates: list[CandidateRow], races: list[RaceRow]) -> list[CandidateRow]:
    """Sets `incumbent` on each candidate row whose name is a running incumbent of its race, and clears it on every other row."""
    running: dict[RaceKey, set[str]] = {_key(r): set((r.incumbent_name or "").split(NAME_SEPARATOR)) for r in races if r.incumbent_running and r.incumbent_name}
    return [replace(c, incumbent=c.candidate in running.get((c.year, c.state, c.office, c.seat, c.special), set())) for c in candidates]


def read_redistricting(path: Path, table: SourceTable) -> list[Redistricting]:
    """The hand maintained redistricting list. A missing column, an unknown kind, or a `source_id` absent from `table` raises SourceFormatError."""
    source = path.name
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        missing = [c for c in REDISTRICTING_COLUMNS if c not in (reader.fieldnames or [])]
        if missing:
            raise SourceFormatError(source, f"missing column {', '.join(repr(c) for c in missing)}")
        rows: list[Redistricting] = []
        for number, row in enumerate(reader, start=2):
            kind = row["kind"].strip()
            if kind not in REDISTRICTING_KINDS:
                raise SourceFormatError(source, f"line {number}: kind {kind!r} is not census or mid_cycle")
            cited = table.get(row["source_id"], f"{source}: line {number}").name
            try:
                rows.append(Redistricting(State(row["state"].strip()), int(row["first_election_year"]), kind, cited))
            except ValueError as e:
                raise SourceFormatError(source, f"line {number}: {e}") from e
    return rows


def mark_redrawn(races: list[RaceRow], redistricting_csv: Path, table: SourceTable) -> list[RaceRow]:
    """House only. True when the state's first election on a new map is the race year. Single district states are always false."""
    new_maps = {(r.state, r.first_election_year) for r in read_redistricting(redistricting_csv, table)}
    return [replace(race, redrawn=race.office == "house" and race.state not in AT_LARGE_STATES and (race.state, race.year) in new_maps) for race in races]


def presidential_lean(results: list[PresidentialResult], years: list[int]) -> list[dict[str, Any]]:
    """State, year, president_year, margin, and lean, from the latest presidential election strictly before each year.

    The margin is the Democratic minus the Republican share of all presidential votes, in percentage points. An absolute margin of 5.0
    or less is swing, so exactly 5.0 is swing.
    """
    by_state: dict[State, dict[int, PresidentialResult]] = defaultdict(dict)
    for result in results:
        by_state[result.state][result.year] = result
    rows: list[dict[str, Any]] = []
    for state in sorted(by_state):
        for year in years:
            prior = [y for y in by_state[state] if y < year]
            if not prior:
                continue
            result = by_state[state][max(prior)]
            margin = round(100.0 * (result.dem - result.rep) / result.total, 4) if result.total else 0.0
            lean: Lean = "swing" if abs(margin) <= SWING_MARGIN else "blue" if margin > 0 else "red"
            rows.append({"state": state, "year": year, "president_year": result.year, "margin": margin, "lean": lean})
    return rows


def senate_delegation(terms: list[Term], elections: list[tuple[State, date]]) -> list[dict[str, Any]]:
    """The two senators serving the day before each election, by caucus, and the lean: red, blue, or purple.

    A seat vacant that day takes its last senator. Independents count with the party they caucus with. A state without two known seats
    has no row.
    """
    seats: dict[State, dict[int, list[Term]]] = defaultdict(lambda: defaultdict(list))
    for term in terms:
        if term.chamber == "sen" and term.senate_class is not None:
            seats[term.state][term.senate_class].append(term)
    rows: list[dict[str, Any]] = []
    for state, election_day in elections:
        day = election_day - timedelta(days=1)
        senators = [(holder, holder.party_on(day)) for cls in sorted(seats.get(state, {})) if (holder := _holder(seats[state][cls], day))]
        if len(senators) != 2:
            continue  # left out rather than guessed; the pull lists it in the load report
        parties = {party for _, party in senators}
        lean: Lean = "red" if parties == {"REP"} else "blue" if parties == {"DEM"} else "purple"
        (first, first_party), (second, second_party) = senators
        rows.append(
            {
                "state": state,
                "year": election_day.year,
                "election_date": election_day.isoformat(),
                "senator1": first.name.display,
                "senator1_party": first_party,
                "senator2": second.name.display,
                "senator2_party": second_party,
                "lean": lean,
            }
        )
    return rows


def _key(race: RaceRow) -> RaceKey:
    return (race.year, race.state, race.office, race.seat, race.special)


def _ballot_names(candidates: list[CandidateRow]) -> dict[RaceKey, list[str]]:
    """Every distinct candidate name of each race, across all rounds."""
    names: dict[RaceKey, list[str]] = defaultdict(list)
    for c in candidates:
        key = (c.year, c.state, c.office, c.seat, c.special)
        if c.candidate not in names[key]:
            names[key].append(c.candidate)
    return names


def _holder(seat_terms: list[Term], day: date) -> Term | None:
    """The term covering `day`, or else the latest term that ended before it (a vacant seat keeps its last holder's party)."""
    covering = [t for t in seat_terms if t.covers(day)]
    if covering:
        return max(covering, key=lambda t: t.start)
    ended = [t for t in seat_terms if t.end < day]
    return max(ended, key=lambda t: t.end) if ended else None


def _service_start(holder: Term, seat_terms: list[Term]) -> date:
    """The start of the holder's continuous service in this seat, joining terms separated by less than a month."""
    own = sorted((t for t in seat_terms if t.person == holder.person and t.start <= holder.start), key=lambda t: t.start)
    start = holder.start
    for term in reversed(own):
        if term.start < start and term.end + CONTINUOUS_GAP >= start:
            start = term.start
    return start


def _years_before(day: date, years: int) -> date:
    try:
        return day.replace(year=day.year - years)
    except ValueError:  # February 29
        return day.replace(year=day.year - years, day=28)


def _best_ballot_name(member: Term, ballot: list[str]) -> str | None:
    scored = sorted(((name_strength(name, member.name), name) for name in ballot), reverse=True)
    return scored[0][1] if scored and scored[0][0] > 0 else None


def _vacated(seat_terms: list[Term], year: int, day: date) -> Term | None:
    """The member whose departure caused a special election: the latest term in the seat ending since the start of the prior year."""
    ended = [t for t in seat_terms if date(year - 1, 1, 1) <= t.end < day]
    return max(ended, key=lambda t: t.end) if ended else _holder(seat_terms, date(year, 1, 1))


def _assign_members(races: list[RaceRow], names: dict[RaceKey, list[str]], reps: list[Term]) -> dict[RaceKey, list[tuple[Term, str]]]:
    """Each member serving on election day, placed in the one race of their state whose ballot names them.

    A full first, nick, or middle name match is preferred over an initial, and an initial counts only in the member's own district
    number, so a retiring member is not mistaken for a namesake elsewhere. Among equal matches the member's own district number wins.
    """
    by_state_year: dict[tuple[int, State], list[RaceRow]] = defaultdict(list)
    for race in races:
        by_state_year[(race.year, race.state)].append(race)
    placed: dict[RaceKey, list[tuple[Term, str]]] = defaultdict(list)
    for (year, state), state_races in by_state_year.items():
        day = general_election_day(year)
        for member in (t for t in reps if t.state == state and t.covers(day)):
            best: tuple[int, bool, RaceRow, str] | None = None
            for race in state_races:
                for name in names.get(_key(race), []):
                    strength = name_strength(name, member.name)
                    if strength == 0 or (strength == 1 and race.seat != member.district):
                        continue  # an initial alone places a member only in their own district number
                    rank = (strength, race.seat == member.district)
                    if best is None or rank > best[:2]:
                        best = (strength, race.seat == member.district, race, name)
            if best is not None:
                placed[_key(best[2])].append((member, best[3]))
    return placed

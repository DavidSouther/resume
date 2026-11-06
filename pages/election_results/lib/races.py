"""Candidate rows to one row per race, and hand entered result overrides."""

import csv
from collections import defaultdict
from dataclasses import replace
from pathlib import Path
from typing import cast, get_args

from .model import ROUND_ORDER, CandidateRow, Office, Party, RaceRow, Round, SourceFormatError, State
from .names import normalize_name
from .source_table import SourceTable

OVERRIDE_COLUMNS = ("year", "state", "office", "seat", "special", "round", "candidate", "party", "votes", "official", "source_id")

RaceKey = tuple[int, State, Office, int, bool]


def collapse_to_races(candidates: list[CandidateRow]) -> list[RaceRow]:
    """One row per race from its deciding round, with the top Democrat and Republican and all other votes.

    The deciding round is the latest one present (a runoff or final ranked choice round over the November general). A race without a
    Democrat or a Republican keeps its row, with that party's fields null. A round with an uncounted candidate (an uncontested seat the
    state left off the ballot) keeps its row with every count and share null, so no count is zero filled. Incumbency and `redrawn` are filled by later enrichment.
    """
    by_race: dict[RaceKey, list[CandidateRow]] = defaultdict(list)
    for c in candidates:
        by_race[(c.year, c.state, c.office, c.seat, c.special)].append(c)
    races: list[RaceRow] = []
    for key in sorted(by_race):
        rows = by_race[key]
        deciding = max(ROUND_ORDER[r.round] for r in rows)
        final = sorted((r for r in rows if ROUND_ORDER[r.round] == deciding), key=lambda r: (-(r.votes or 0), r.candidate))
        total = sum(r.votes for r in final if r.votes is not None) if all(r.votes is not None for r in final) else None
        dem = _top(final, "DEM")
        gop = _top(final, "REP")
        dem_votes, gop_votes = (dem.votes if dem else None), (gop.votes if gop else None)
        year, state, office, seat, special = key
        races.append(
            RaceRow(
                year=year,
                state=state,
                office=office,
                seat=seat,
                special=special,
                round=final[0].round,
                dem_candidate=dem.candidate if dem else None,
                dem_votes=dem_votes,
                dem_pct=_pct(dem_votes, total) if dem_votes is not None and total is not None else None,
                gop_candidate=gop.candidate if gop else None,
                gop_votes=gop_votes,
                gop_pct=_pct(gop_votes, total) if gop_votes is not None and total is not None else None,
                other_votes=total - (dem_votes or 0) - (gop_votes or 0) if total is not None else None,
                total_votes=total,
                winner_party=final[0].party,
                incumbent_name=None,
                incumbent_party=None,
                incumbent_running=False,
                paired_incumbents=False,
                redrawn=False,
                unofficial=any(r.unofficial for r in final),
                source=final[0].source,
                fetched_at=final[0].fetched_at,
            )
        )
    return races


def _top(rows: list[CandidateRow], party: Party) -> CandidateRow | None:
    return next((r for r in rows if r.party == party), None)


def _pct(votes: int, total: int) -> float:
    return round(100.0 * votes / total, 4) if total else 0.0


def apply_overrides(candidates: list[CandidateRow], overrides_csv: Path, table: SourceTable) -> list[CandidateRow]:
    """Replaces every candidate row of a race and round that the overrides file lists with the file's rows for it.

    The file holds final ranked choice rounds, runoffs, and races a source lacks or misreports. A House or Senate runoff dated in an odd
    year (a January runoff) is stored under the November cycle it decided. Shares are recomputed from the listed votes.
    """
    overrides = read_overrides(overrides_csv, table)
    replaced = {(r.year, r.state, r.office, r.seat, r.special, r.round) for r in overrides}
    kept = [c for c in candidates if (c.year, c.state, c.office, c.seat, c.special, c.round) not in replaced]
    return kept + overrides


def read_overrides(path: Path, table: SourceTable) -> list[CandidateRow]:
    """The override rows, each with the source and `fetched_at` (the date it was checked) of its `source_id` in `table`."""
    source = path.name
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        missing = [c for c in OVERRIDE_COLUMNS if c not in (reader.fieldnames or [])]
        if missing:
            raise SourceFormatError(source, f"missing column {', '.join(repr(c) for c in missing)}")
        parsed = [_override(row, source, number, table) for number, row in enumerate(reader, start=2)]
    totals: dict[tuple[int, State, Office, int, bool, Round], int] = defaultdict(int)
    for row in parsed:
        totals[(row.year, row.state, row.office, row.seat, row.special, row.round)] += row.votes or 0  # an override always has a count
    rows: list[CandidateRow] = []
    for row in parsed:
        total = totals[(row.year, row.state, row.office, row.seat, row.special, row.round)]
        rows.append(replace(row, total_votes=total, pct=_pct(row.votes or 0, total)))
    return rows


def _override(row: dict[str, str], source: str, number: int, table: SourceTable) -> CandidateRow:
    try:
        cited = table.get(row["source_id"], f"{source}: line {number}")
        office, round_, party = row["office"].strip(), row["round"].strip(), row["party"].strip()
        if office not in get_args(Office) or round_ not in get_args(Round) or party not in get_args(Party):
            raise ValueError(f"office {office!r}, round {round_!r}, or party {party!r} is not a known value")
        year = int(row["year"])
        if round_ == "runoff" and office in ("house", "senate") and year % 2 == 1:
            year -= 1
        return CandidateRow(
            year=year,
            state=State(row["state"].strip()),
            office=cast("Office", office),
            seat=int(row["seat"]),
            special=_bool(row["special"]),
            round=cast("Round", round_),
            candidate=normalize_name(row["candidate"]),
            party=cast("Party", party),
            votes=int(row["votes"]),
            total_votes=0,
            pct=0.0,
            incumbent=False,
            unofficial=not _bool(row["official"]),
            source=cited.name,
            fetched_at=cited.fetched_at,
        )
    except (ValueError, KeyError, AttributeError) as e:
        raise SourceFormatError(source, f"line {number}: {e}") from e


def _bool(value: str) -> bool:
    v = value.strip().lower()
    if v not in ("true", "false"):
        raise ValueError(f"{value!r} is not true or false")
    return v == "true"

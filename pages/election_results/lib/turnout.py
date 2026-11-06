"""University of Florida Election Lab statewide turnout files to rows.

The 1980 to 2022 file has a `YEAR` column. Each later general election has its own file without one, so the year comes from the caller.
Numbers are written with thousands separators, and an empty cell is a null, never a zero.
"""

import csv
from dataclasses import dataclass
from pathlib import Path

from .model import STATE_CODES, SourceFormatError, State

COLUMNS = ("STATE_ABV", "TOTAL_BALLOTS_COUNTED", "VEP")
STATES = set(STATE_CODES.values())


@dataclass(frozen=True)
class TurnoutRow:
    state: State
    year: int
    vep: int | None
    total_ballots: int | None
    unofficial: bool  # an estimate before the states certify
    source: str


def parse_turnout(path: Path, year: int | None, source: str) -> list[TurnoutRow]:
    """State rows only (the national row and the District of Columbia are left out). `year` is None when the file has a YEAR column."""
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        required = (*COLUMNS, "YEAR") if year is None else COLUMNS
        missing = [c for c in required if c not in (reader.fieldnames or [])]
        if missing:
            raise SourceFormatError(source, f"missing column {', '.join(repr(c) for c in missing)}")
        rows: list[TurnoutRow] = []
        for number, row in enumerate(reader, start=2):
            state = State(row["STATE_ABV"].strip())
            if state not in STATES:
                continue
            try:
                row_year = year if year is not None else int(row["YEAR"])
                rows.append(
                    TurnoutRow(
                        state=state,
                        year=row_year,
                        vep=_count(row["VEP"]),
                        total_ballots=_count(row["TOTAL_BALLOTS_COUNTED"]),
                        unofficial="estimate" in (row.get("SOURCE") or "").lower(),
                        source=source,
                    )
                )
            except ValueError as e:
                raise SourceFormatError(source, f"line {number}: {e}") from e
    if not rows:
        raise SourceFormatError(source, "no state rows")
    return rows


def _count(value: str) -> int | None:
    text = value.replace(",", "").strip()
    return int(float(text)) if text else None

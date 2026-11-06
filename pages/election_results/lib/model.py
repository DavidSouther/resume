"""Row types shared by the pull, the analysis, and the report.

Every parser returns these frozen rows or raises naming the source and the missing column, so later code never sees a half parsed record.
"""

from dataclasses import dataclass
from typing import Literal, NewType

Office = Literal["house", "senate", "governor"]
Party = Literal["DEM", "REP", "OTHER"]
Round = Literal["general", "runoff", "rcv_final"]
Lean = Literal["red", "blue", "swing", "purple"]
State = NewType("State", str)  # two letter postal code
SeatId = tuple[State, Office, int]  # House district (0 at large), Senate class (1 to 3), governor 0

ROUND_ORDER: dict[Round, int] = {"general": 0, "runoff": 1, "rcv_final": 2}

WINDOW_START = 2014  # first year in candidates.csv and races.csv
BASELINE_START = 2008  # first year pulled, so every window race has a prior
LATEST_CYCLE = 2026  # the cycle whose counts are still unofficial; MEDSL stops before it

STATE_CODES: dict[str, State] = {
    name: State(code)
    for name, code in {
        "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA", "Colorado": "CO", "Connecticut": "CT",
        "Delaware": "DE", "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Iowa": "IA",
        "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD", "Massachusetts": "MA", "Michigan": "MI",
        "Minnesota": "MN", "Mississippi": "MS", "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV", "New Hampshire": "NH",
        "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK",
        "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD", "Tennessee": "TN",
        "Texas": "TX", "Utah": "UT", "Vermont": "VT", "Virginia": "VA", "Washington": "WA", "West Virginia": "WV", "Wisconsin": "WI",
        "Wyoming": "WY",
    }.items()
}  # fmt: skip
AT_LARGE_STATES = {State(s) for s in ("AK", "DE", "ND", "SD", "VT", "WY")}  # one House seat each through 2026


class SourceFormatError(ValueError):
    """A source file lacks a column or holds a value the parser cannot read."""

    def __init__(self, source: str, problem: str) -> None:
        super().__init__(f"{source}: {problem}")
        self.source = source


@dataclass(frozen=True)
class CandidateRow:
    year: int
    state: State
    office: Office
    seat: int
    special: bool
    round: Round
    candidate: str
    party: Party
    votes: int | None  # null only for an uncontested candidate the state never counted, so no count is zero filled
    total_votes: int | None
    pct: float | None
    incumbent: bool
    unofficial: bool
    source: str
    fetched_at: str


@dataclass(frozen=True)
class RaceRow:
    year: int
    state: State
    office: Office
    seat: int
    special: bool
    round: Round
    dem_candidate: str | None
    dem_votes: int | None
    dem_pct: float | None
    gop_candidate: str | None
    gop_votes: int | None
    gop_pct: float | None
    other_votes: int | None  # null with total_votes when the deciding round has no counts (an uncounted uncontested race)
    total_votes: int | None
    winner_party: Party
    incumbent_name: str | None
    incumbent_party: Party | None
    incumbent_running: bool
    paired_incumbents: bool  # House only: two incumbents ran for this seat after a redraw
    redrawn: bool
    unofficial: bool
    source: str
    fetched_at: str = ""  # of the deciding round's source, so a race and its candidates cite one row of sources.csv

"""Display strings for findings.json, so the report page interpolates text and never formats a number itself.

Negative numbers use the ASCII hyphen minus (U+002D), so a displayed value parses and copies as a number.
A number that rounds onto a rule's cut point but is not equal to it gains decimals until the shown value falls on the side the rule used.
"""

import math
from collections.abc import Iterable

MINUS = "-"  # U+002D
MISSING = "not available"


def clear_of(x: float, edges: Iterable[float], places: int) -> int:
    """The fewest decimal places, from `places` up to 6, at which `x` does not round onto an edge it differs from."""
    cuts = list(edges)
    for p in range(places, 7):
        shown = round(x, p)
        if not any(shown == e and x != e for e in cuts):
            return p
    return 6


def signed(x: float, places: int, edges: Iterable[float] = ()) -> str:
    """`x` with an explicit sign, such as "+1.23", with a minus sign for a negative, and no sign when it rounds to zero."""
    p = clear_of(x, edges, places)
    text = f"{abs(x):.{p}f}"
    if float(text) == 0:
        return text
    return f"+{text}" if x > 0 else f"{MINUS}{text}"


def points(x: float | None, edges: Iterable[float] = ()) -> str:
    """A margin or bonus in points of the vote, such as "+1.23 points"."""
    return MISSING if x is None else f"{signed(x, 2, edges)} points"


def percent(share: float | None) -> str:
    """A share from 0 to 1 as a percent with one decimal, such as "52.3 percent"."""
    return MISSING if share is None else f"{100 * share:.1f} percent"


def percent_of(value: float | None) -> str:
    """A number already in percent (AP `eevp`), such as "73.8 percent"."""
    return MISSING if value is None else f"{value:.1f} percent"


def p_value(p: float | None, edges: Iterable[float] = ()) -> str:
    """A p value with three decimals, such as "0.018", or "less than 0.001"."""
    if p is None:
        return MISSING
    if p < 0.001:
        return "less than 0.001"
    return f"{p:.{clear_of(p, edges, 3)}f}"


def ratio(x: float | None, edges: Iterable[float] = ()) -> str:
    """A ratio such as the turnout k, with three decimals, such as "1.034"."""
    return MISSING if x is None else f"{x:.{clear_of(x, edges, 3)}f}"


def count(n: float | None) -> str:
    """A whole count or a year, such as "435"."""
    return MISSING if n is None else str(int(n))


# Fixed decimals for the page's number tables, so a column reads at one precision. Kinds name the formatter.
CELL_KINDS: dict[str, str] = {
    "n": "count",
    "excluded": "count",
    "dem_gains": "count",
    "rep_gains": "count",
    "dem_seats": "count",
    "rep_seats": "count",
    "prior_years": "count",
    "plausible": "count",
    "redrawn_races": "count",
    "not_redrawn_races": "count",
    "prior_max_year": "year",
    "median_margin_change": "points",
    "dem_bonus": "points",
    "rep_bonus": "points",
    "wald_diff": "points",
    "bonus_2026": "points",
    "prior_min": "points",
    "prior_max": "points",
    "redrawn_mean": "points",
    "not_redrawn_mean": "points",
    "difference": "points",
    "prior_max_abs": "unsigned_points",
    "difference_2026": "points",
    "excess": "points",
    "p_hist": "p",
    "p_2026": "p",
    "p_excess": "p",
    "share_toward_dem": "percent",
    "share_plausible": "percent",
    "wald_p": "p",
    "median_k": "ratio",
}

# The raw answer columns by kind. Columns not listed (ids, names, booleans, years, seats) are shown verbatim.
RAW_COLUMN_KINDS: dict[str, str] = {
    **dict.fromkeys(
        (
            "prior_dem_pct",
            "dem_pct",
            "dem_pct_change",
            "prior_gop_pct",
            "gop_pct",
            "gop_pct_change",
            "prior_margin",
            "margin",
            "margin_change",
            "lean_margin",
            "regression_bonus",
            "cross_check_bonus",
            "wald_diff",
            "wald_se",
            "mean_change",
            "difference",
            "actual_statewide_vep_turnout_change",
        ),
        "points",
    ),
    **dict.fromkeys(("a", "b", "k", "k_effective"), "ratio"),
    "flip_share": "fraction",
    **dict.fromkeys(
        (
            "d0",
            "r0",
            "d1",
            "r1",
            "required_extra_dem_votes",
            "actual_total_votes_change",
            "actual_statewide_ballots_change",
            "comparison_change",
            "slack",
            "seats",
            "races",
        ),
        "votes",
    ),
    "wald_p": "p_sig",
}

# The unit a table header names for each kind.
KIND_UNITS: dict[str, str] = {
    "points": "points",
    "unsigned_points": "points",
    "percent": "percent",
    "ratio": "ratio",
    "fraction": "fraction",
    "votes": "count",
    "count": "count",
    "p": "p",
    "p_sig": "p",
    "year": "",
}


def _minus(text: str) -> str:
    return f"{MINUS}{text[1:]}" if text.startswith("-") else text


def cell(kind: str, x: float | None) -> str | None:
    """A table cell at a fixed precision for its kind, with no unit (the header names it), or None for a null."""
    if x is None:
        return None
    if kind == "points":
        return _minus(f"{x:+.2f}") if round(x, 2) != 0 else "0.00"
    if kind == "unsigned_points":
        return f"{x:.2f}"
    if kind == "percent":
        return f"{100 * x:.1f}"
    if kind in ("ratio", "fraction"):
        return _minus(f"{x:.3f}")
    if kind in ("count", "votes"):
        return _minus(f"{round(x):,}")
    if kind == "year":
        return str(int(x))
    if kind == "p":
        return "<0.001" if x < 0.001 else f"{x:.3f}"
    if kind == "p_sig":
        places = 0 if x <= 0 else max(0, 2 - math.floor(math.log10(x)))
        return f"{x:.{places}f}"
    raise ValueError(f"unknown cell kind {kind}")


def raw_cell(column: str, value: str) -> str:
    """A raw answer CSV cell for display: rounded by its column's kind, or verbatim for ids, text, and empty cells."""
    kind = RAW_COLUMN_KINDS.get(column)
    if kind is None or value == "":
        return value
    try:
        number = float(value)
    except ValueError:
        return value
    shown = cell(kind, number)
    return value if shown is None else shown

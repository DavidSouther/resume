"""The findings rules: one pure function per selector family, each mapping answer rows to one enumerated value and its claim.

No function here reads a file. findings.py loads the answer CSVs and passes their rows (CSV dicts of strings, an empty string for a
null), and adds the DuckDB evidence rows afterward. Each rule is evaluated in the order of its `rule_text` sentences, and the claim's
`rule` is the sentence of the branch that fired, so a reader can apply the rule by hand from findings.json.
"""

import statistics
from collections.abc import Callable, Mapping, Sequence
from dataclasses import asdict, dataclass
from typing import Any, Literal, NotRequired, TypedDict

from . import findings_format as fmt

Row = Mapping[str, str]
Rows = Sequence[Row]
Number = float | int | None
Office = Literal["house", "senate", "governor"]
LeanDef = Literal["presidential"]
IncParty = Literal["DEM", "REP"]
RaceKeyText = str  # YEAR:STATE:OFFICE:SEAT[:special]

OFFICES: tuple[Office, ...] = ("house", "senate", "governor")
LEAN_DEFS: dict[LeanDef, tuple[str, ...]] = {"presidential": ("red", "blue", "swing")}
LEAN_FILES: dict[LeanDef, str] = {"presidential": "incumbency_presidential_lean.csv"}
PARTIES: tuple[IncParty, ...] = ("DEM", "REP")
PRESIDENTIAL_LEANS: tuple[str, ...] = LEAN_DEFS["presidential"]
BY_LEAN_FILE = "seat_change_2026_by_lean.csv"
YEAR = "2026"
PRIOR_YEARS = range(2014, 2025)  # the years bonus_vs_history compares 2026 against

# Every family's values, in the order of findings.schema.json `$defs.<family>.enum`.
FAMILIES: dict[str, tuple[str, ...]] = {
    "completeness": ("certified", "counting_nearly_complete", "counting_in_progress", "no_2026_data"),
    "seat_shift": ("toward_dem", "toward_rep", "no_clear_shift", "insufficient_data"),
    "party_flips": ("none", "dem_net_gain", "rep_net_gain", "even_exchange", "insufficient_data"),
    "seat_shift_by_lean": ("toward_dem", "toward_rep", "no_clear_shift", "insufficient_data"),
    "party_flips_by_lean": ("none", "dem_net_gain", "rep_net_gain", "even_exchange", "insufficient_data"),
    "incumbency_party_gap": ("rep_lower", "dem_lower", "no_difference", "insufficient_data"),
    "significance": ("p_below_0_05", "p_below_0_10", "p_at_or_above_0_10", "not_tested"),
    "bonus_vs_history": ("below_all_prior_years", "within_prior_range", "above_all_prior_years", "insufficient_data"),
    "turnout_explanation": ("turnout_plausible_majority", "persuasion_needed_majority", "evenly_split", "insufficient_data"),
    "k_direction": ("dem_relative_gain", "rep_relative_gain", "near_parity", "insufficient_data"),
    "dummymander": ("redrawn_incumbents_worse", "redrawn_incumbents_better", "no_clear_difference", "insufficient_data"),
    "dummymander_vs_history": ("largest_gap_on_record", "within_prior_range", "insufficient_data"),
}
SPARSE_VALUES = frozenset({"insufficient_data", "not_tested", "no_2026_data"})

# The display fields of each family. A full value quotes DISPLAY, and a sparse value quotes only SPARSE_DISPLAY (its counts).
DISPLAY: dict[str, tuple[str, ...]] = {
    "completeness": ("races_2026", "unofficial", "eevp_below_95", "eevp_min", "fetched_at"),
    "seat_shift": ("n", "median_margin_change", "share_toward_dem"),
    "party_flips": ("n", "dem_gains", "rep_gains"),
    "seat_shift_by_lean": ("n", "excluded", "median_margin_change", "share_toward_dem"),
    "party_flips_by_lean": ("n", "excluded", "dem_gains", "rep_gains"),
    "incumbency_party_gap": ("dem_bonus", "rep_bonus", "wald_diff", "wald_p", "dem_seats", "rep_seats"),
    "significance": ("wald_p",),
    "bonus_vs_history": ("bonus_2026", "prior_min", "prior_max", "prior_years"),
    "turnout_explanation": ("n", "plausible", "share_plausible"),
    "k_direction": ("n", "median_k"),
    "dummymander": ("redrawn_mean", "not_redrawn_mean", "difference", "redrawn_races", "not_redrawn_races"),
    "dummymander_vs_history": ("difference", "prior_max_abs", "prior_max_year"),
}
SPARSE_DISPLAY: dict[str, tuple[str, ...]] = {
    "completeness": ("races_2026",),
    "seat_shift": ("n",),
    "party_flips": ("n",),
    "seat_shift_by_lean": ("n", "excluded"),
    "party_flips_by_lean": ("n", "excluded"),
    "incumbency_party_gap": ("dem_seats", "rep_seats"),
    "significance": (),
    "bonus_vs_history": ("prior_years",),
    "turnout_explanation": ("n",),
    "k_direction": ("n",),
    "dummymander": ("redrawn_races", "not_redrawn_races"),
    "dummymander_vs_history": ("prior_max_year",),
}


@dataclass(frozen=True)
class Thresholds:
    min_comparable_races: int = 5
    min_seats: int = 5
    shift_points: float = 1.0
    p_tiers: tuple[float, float] = (0.05, 0.10)
    k_parity_band: tuple[float, float] = (0.98, 1.02)
    dummymander_points: float = 1.0
    min_group_races: int = 5
    min_prior_years: int = 3
    nearly_complete_eevp: float = 95.0

    def as_json(self) -> dict[str, Any]:
        values: dict[str, Any] = asdict(self)
        return {k: [*v] if isinstance(v, tuple) else v for k, v in values.items()}


THRESHOLDS = Thresholds()


class Claim(TypedDict):
    value: str
    rule: str
    numbers: dict[str, Number]
    display: dict[str, str]
    trigger_fields: list[str]
    evidence: list[str]
    cells: NotRequired[dict[str, str | None]]  # added by findings.py for the page's number tables


class Counts2026(TypedDict):
    races: int
    ap_races: int
    unofficial: int
    certified: int
    eevp_below_100: int
    eevp_below_95: int
    eevp_unknown: int
    eevp_min: float | None
    eevp_median: float | None
    latest_update: str | None


@dataclass(frozen=True)
class Group:
    """One incumbency fit: a lean definition, an office, and a lean."""

    leandef: LeanDef
    office: Office
    lean: str

    @property
    def key(self) -> str:
        return f"{self.leandef}.{self.office}.{self.lean}"


def selector_keys() -> list[str]:
    """The 69 selector keys findings.json must hold, in the page's order."""
    keys = ["completeness"]
    for office in OFFICES:
        keys += [f"seat_shift.{office}", f"party_flips.{office}", f"turnout_explanation.{office}", f"k_direction.{office}"]
        for lean in PRESIDENTIAL_LEANS:
            keys += [f"seat_shift_by_lean.{office}.{lean}", f"party_flips_by_lean.{office}.{lean}"]
        for group in groups():
            if group.office == office:
                keys += [f"incumbency_party_gap.{group.key}", f"significance.{group.key}"]
                keys += [f"bonus_vs_history.{group.key}.{party}" for party in PARTIES]
    return [*keys, "dummymander.house", "dummymander_vs_history.house"]


def groups() -> list[Group]:
    """Every incumbency group, by office, then lean definition, then lean."""
    return [Group(leandef, office, lean) for office in OFFICES for leandef, leans in LEAN_DEFS.items() for lean in leans]


def rule_text(th: Thresholds = THRESHOLDS) -> dict[str, list[str]]:
    """Each family's rule as sentences in evaluation order, with the thresholds written in."""
    n = th.min_comparable_races
    low, high = th.p_tiers
    k_low, k_high = th.k_parity_band
    d = th.dummymander_points
    return {
        "completeness": [
            "no_2026_data when no 2026 race in races.csv has source ap.",
            "certified when no 2026 race is unofficial.",
            f"counting_nearly_complete when every AP race has an eevp of at least {th.nearly_complete_eevp:g} in progress.json.",
            "counting_in_progress otherwise, including when an AP race has no eevp.",
        ],
        "seat_shift": [
            f"insufficient_data when fewer than {n} comparable 2026 races of the office have a margin_change in seat_change_2026.csv.",
            f"toward_dem when the median margin_change is at least +{th.shift_points:g} point.",
            f"toward_rep when the median margin_change is at most minus {th.shift_points:g} point.",
            "no_clear_shift otherwise.",
        ],
        "party_flips": [
            f"insufficient_data when fewer than {n} comparable 2026 races of the office have both prior_margin and margin in seat_change_2026.csv.",
            "none when no race changed the sign of its margin.",
            "dem_net_gain when more races went from a negative prior_margin to a positive margin than the reverse.",
            "rep_net_gain when more races went from a positive prior_margin to a negative margin than the reverse.",
            "even_exchange when both counts are equal and above zero.",
        ],
        "seat_shift_by_lean": [
            f"insufficient_data when fewer than {n} comparable 2026 races of the office in states of the presidential lean have a margin_change in {BY_LEAN_FILE}.",
            f"toward_dem when the group's median margin_change is at least +{th.shift_points:g} point.",
            f"toward_rep when the group's median margin_change is at most minus {th.shift_points:g} point.",
            "no_clear_shift otherwise.",
        ],
        "party_flips_by_lean": [
            f"insufficient_data when fewer than {n} comparable 2026 races of the office in states of the presidential lean have both prior_margin and margin in {BY_LEAN_FILE}.",
            "none when no race in the group changed the sign of its margin.",
            "dem_net_gain when more races in the group went from a negative prior_margin to a positive margin than the reverse.",
            "rep_net_gain when more races in the group went from a positive prior_margin to a negative margin than the reverse.",
            "even_exchange when both counts are equal and above zero.",
        ],
        "incumbency_party_gap": [
            "insufficient_data when the 2026 year_scope rows of the group have a null wald_p.",
            f"no_difference when wald_p is at least {high:g}.",
            "rep_lower when wald_diff (the DEM bonus minus the REP bonus) is positive.",
            "dem_lower when wald_diff is negative.",
            "no_difference when wald_diff is zero.",
        ],
        "significance": [
            "not_tested when the 2026 year_scope rows of the group have a null wald_p.",
            f"p_below_0_05 when wald_p is below {low:g}.",
            f"p_below_0_10 when wald_p is below {high:g}.",
            f"p_at_or_above_0_10 when wald_p is at least {high:g}.",
        ],
        "bonus_vs_history": [
            f"insufficient_data when the party's 2026 regression_bonus is null, or fewer than {th.min_prior_years} year scopes from {PRIOR_YEARS[0]} to {PRIOR_YEARS[-1]} have one.",
            "below_all_prior_years when the 2026 bonus is below every prior year's bonus.",
            "above_all_prior_years when the 2026 bonus is above every prior year's bonus.",
            "within_prior_range otherwise, including a 2026 bonus equal to a prior extreme.",
        ],
        "turnout_explanation": [
            f"insufficient_data when fewer than {n} 2026 races of the office have a turnout_plausible value in turnout_k.csv.",
            "turnout_plausible_majority when more than half of them are plausible.",
            "persuasion_needed_majority when fewer than half of them are plausible.",
            "evenly_split when exactly half of them are plausible.",
        ],
        "k_direction": [
            f"insufficient_data when fewer than {n} 2026 races of the office have a k in turnout_k.csv.",
            f"dem_relative_gain when the median k is above {k_high:g}.",
            f"rep_relative_gain when the median k is below {k_low:g}.",
            "near_parity otherwise.",
        ],
        "dummymander": [
            f"insufficient_data when the 2026 redrawn or not_redrawn group in dummymander.csv has fewer than {th.min_group_races} races or a null mean_change.",
            f"redrawn_incumbents_worse when the difference (redrawn mean minus not_redrawn mean) is at most minus {d:g} point.",
            f"redrawn_incumbents_better when the difference is at least +{d:g} point.",
            "no_clear_difference otherwise. The comparison is a raw difference of means with no significance test.",
        ],
        "dummymander_vs_history": [
            "insufficient_data when the 2026 dummymander finding is insufficient_data or no earlier year has a difference.",
            "largest_gap_on_record when the absolute 2026 difference exceeds every earlier year's absolute difference.",
            "within_prior_range otherwise.",
        ],
    }


def race_key_of(year: int, state: str, office: str, seat: int, special: bool) -> RaceKeyText:
    """`YEAR:STATE:OFFICE:SEAT`, with `:special` appended for a special election, joining back to races.csv."""
    key = f"{year}:{state}:{office}:{seat}"
    return f"{key}:special" if special else key


def race_key(row: Row) -> RaceKeyText:
    """The race key of a CSV row holding year, state, office, seat, and special."""
    return race_key_of(int(row["year"]), row["state"], row["office"], int(row["seat"]), row.get("special") == "true")


def completeness(counts: Mapping[str, Counts2026], fetched_at: str | None, th: Thresholds = THRESHOLDS) -> Claim:
    """How complete the 2026 counts are, from the per office counts of `counts_2026` and the AP fetch time."""
    rules = rule_text(th)["completeness"]
    rows = list(counts.values())
    eevps = [c["eevp_min"] for c in rows if c["eevp_min"] is not None]
    numbers: dict[str, Number] = {
        "races_2026": sum(c["races"] for c in rows),
        "ap_races": sum(c["ap_races"] for c in rows),
        "unofficial": sum(c["unofficial"] for c in rows),
        "eevp_below_95": sum(c["eevp_below_95"] for c in rows),
        "eevp_unknown": sum(c["eevp_unknown"] for c in rows),
        "eevp_min": min(eevps) if eevps else None,
        "fetched_at": None,
    }
    if not numbers["ap_races"]:
        value, rule = "no_2026_data", rules[0]
    elif not numbers["unofficial"]:
        value, rule = "certified", rules[1]
    elif not numbers["eevp_below_95"] and not numbers["eevp_unknown"]:
        value, rule = "counting_nearly_complete", rules[2]
    else:
        value, rule = "counting_in_progress", rules[3]
    formats: dict[str, str] = {
        "races_2026": fmt.count(numbers["races_2026"]),
        "unofficial": fmt.count(numbers["unofficial"]),
        "eevp_below_95": fmt.count(numbers["eevp_below_95"]),
        "eevp_min": fmt.percent_of(numbers["eevp_min"]),
        "fetched_at": fetched_at or fmt.MISSING,
    }
    return _claim("completeness", value, rule, numbers, formats, [])


def seat_shift(rows: Rows, office: Office, th: Thresholds = THRESHOLDS) -> Claim:
    """The median 2026 margin change of the office's comparable races, from seat_change_2026.csv."""
    rules = rule_text(th)["seat_shift"]
    races = [r for r in _year_office(rows, office) if r.get("comparable") == "true" and _num(r, "margin_change") is not None]
    shifts = [_req(r, "margin_change") for r in races]
    numbers: dict[str, Number] = {"n": len(shifts), "median_margin_change": None, "share_toward_dem": None}
    evidence = [race_key(r) for r in races]
    if len(shifts) < th.min_comparable_races:
        return _claim("seat_shift", "insufficient_data", rules[0], numbers, {"n": fmt.count(len(shifts))}, evidence)
    median = statistics.median(shifts)
    numbers.update(median_margin_change=median, share_toward_dem=sum(s > 0 for s in shifts) / len(shifts))
    edges = (th.shift_points, -th.shift_points)
    if median >= th.shift_points:
        value, rule = "toward_dem", rules[1]
    elif median <= -th.shift_points:
        value, rule = "toward_rep", rules[2]
    else:
        value, rule = "no_clear_shift", rules[3]
    formats = {"n": fmt.count(len(shifts)), "median_margin_change": fmt.points(median, edges), "share_toward_dem": fmt.percent(numbers["share_toward_dem"])}
    return _claim("seat_shift", value, rule, numbers, formats, evidence)


def party_flips(rows: Rows, office: Office, th: Thresholds = THRESHOLDS) -> Claim:
    """Comparable 2026 races of the office whose margin changed sign against the prior election, from seat_change_2026.csv."""
    rules = rule_text(th)["party_flips"]
    races = [r for r in _year_office(rows, office) if r.get("comparable") == "true" and _num(r, "prior_margin") is not None and _num(r, "margin") is not None]
    dem = [r for r in races if _req(r, "prior_margin") < 0 < _req(r, "margin")]
    rep = [r for r in races if _req(r, "prior_margin") > 0 > _req(r, "margin")]
    numbers: dict[str, Number] = {"n": len(races), "dem_gains": len(dem), "rep_gains": len(rep)}
    if len(races) < th.min_comparable_races:
        numbers.update(dem_gains=None, rep_gains=None)
        return _claim("party_flips", "insufficient_data", rules[0], numbers, {"n": fmt.count(len(races))}, [race_key(r) for r in races])
    if not dem and not rep:
        value, rule = "none", rules[1]
    elif len(dem) > len(rep):
        value, rule = "dem_net_gain", rules[2]
    elif len(rep) > len(dem):
        value, rule = "rep_net_gain", rules[3]
    else:
        value, rule = "even_exchange", rules[4]
    formats = {k: fmt.count(v) for k, v in numbers.items()}
    return _claim("party_flips", value, rule, numbers, formats, [race_key(r) for r in dem + rep])


def seat_shift_by_lean(rows: Rows, office: Office, lean: str, th: Thresholds = THRESHOLDS) -> Claim:
    """seat_shift over the office's 2026 races in states of one presidential lean, from seat_change_2026_by_lean.csv."""
    return _by_lean("seat_shift", seat_shift, rows, office, lean, th)


def party_flips_by_lean(rows: Rows, office: Office, lean: str, th: Thresholds = THRESHOLDS) -> Claim:
    """party_flips over the office's 2026 races in states of one presidential lean, from seat_change_2026_by_lean.csv."""
    return _by_lean("party_flips", party_flips, rows, office, lean, th)


def _by_lean(base: str, rule: Callable[[Rows, Office, Thresholds], Claim], rows: Rows, office: Office, lean: str, th: Thresholds) -> Claim:
    """The base family's rule on one lean group, relabeled, with the count of the group's races left out as not comparable."""
    group = [r for r in _year_office(rows, office) if r.get("presidential_lean") == lean]
    excluded = sum(r.get("comparable") != "true" for r in group)
    claim = rule(group, office, th)
    family = f"{base}_by_lean"
    sentence = rule_text(th)[family][rule_text(th)[base].index(claim["rule"])]
    numbers = {**claim["numbers"], "excluded": excluded}
    display = {**claim["display"], "excluded": fmt.count(excluded)}
    return _claim(family, claim["value"], sentence, numbers, display, claim["evidence"])


def incumbency_party_gap(rows: Rows, group: Group, th: Thresholds = THRESHOLDS) -> Claim:
    """Which party's incumbents gained less in the group's 2026 fit, cut at the upper p tier so it agrees with `significance`."""
    rules = rule_text(th)["incumbency_party_gap"]
    fit = _fit(rows, group, YEAR)
    dem, rep = fit.get("DEM", {}), fit.get("REP", {})
    p, diff = _num(dem, "wald_p"), _num(dem, "wald_diff")
    numbers: dict[str, Number] = {
        "dem_bonus": _num(dem, "regression_bonus"),
        "rep_bonus": _num(rep, "regression_bonus"),
        "wald_diff": diff,
        "wald_p": p,
        "dem_seats": int(_num(dem, "seats") or 0),
        "rep_seats": int(_num(rep, "seats") or 0),
    }
    evidence = _row_ids(group, YEAR)
    seat_formats = {"dem_seats": fmt.count(numbers["dem_seats"]), "rep_seats": fmt.count(numbers["rep_seats"])}
    if p is None or diff is None:
        return _claim("incumbency_party_gap", "insufficient_data", rules[0], numbers, seat_formats, evidence)
    high = th.p_tiers[1]
    if p >= high:
        value, rule = "no_difference", rules[1]
    elif diff > 0:
        value, rule = "rep_lower", rules[2]
    elif diff < 0:
        value, rule = "dem_lower", rules[3]
    else:
        value, rule = "no_difference", rules[4]
    formats = {
        "dem_bonus": fmt.points(numbers["dem_bonus"]),
        "rep_bonus": fmt.points(numbers["rep_bonus"]),
        "wald_diff": fmt.points(diff),
        "wald_p": fmt.p_value(p, th.p_tiers),
        **seat_formats,
    }
    return _claim("incumbency_party_gap", value, rule, numbers, formats, evidence)


def significance(rows: Rows, group: Group, th: Thresholds = THRESHOLDS) -> Claim:
    """The p value tier of the group's 2026 Wald test of equal bonuses."""
    rules = rule_text(th)["significance"]
    p = _num(_fit(rows, group, YEAR).get("DEM", {}), "wald_p")
    numbers: dict[str, Number] = {"wald_p": p}
    evidence = _row_ids(group, YEAR)
    if p is None:
        return _claim("significance", "not_tested", rules[0], numbers, {}, evidence)
    low, high = th.p_tiers
    if p < low:
        value, rule = "p_below_0_05", rules[1]
    elif p < high:
        value, rule = "p_below_0_10", rules[2]
    else:
        value, rule = "p_at_or_above_0_10", rules[3]
    return _claim("significance", value, rule, numbers, {"wald_p": fmt.p_value(p, th.p_tiers)}, evidence)


def bonus_vs_history(rows: Rows, group: Group, party: IncParty, th: Thresholds = THRESHOLDS) -> Claim:
    """One party's 2026 incumbency bonus in the group against its bonuses in the prior year scopes."""
    rules = rule_text(th)["bonus_vs_history"]
    bonus = _num(_fit(rows, group, YEAR).get(party, {}), "regression_bonus")
    prior: dict[int, float] = {}
    for r in rows:
        scope = r.get("year_scope", "")
        if r.get("office") == group.office and r.get("lean") == group.lean and r.get("incumbent_party") == party and scope.isdigit() and int(scope) in PRIOR_YEARS:
            value = _num(r, "regression_bonus")
            if value is not None:
                prior[int(scope)] = value
    numbers: dict[str, Number] = {
        "bonus_2026": bonus,
        "prior_min": min(prior.values()) if prior else None,
        "prior_max": max(prior.values()) if prior else None,
        "prior_years": len(prior),
    }
    evidence = [_row_id(group, YEAR, party), *(_row_id(group, str(y), party) for y in sorted(prior))]
    if bonus is None or len(prior) < th.min_prior_years:
        return _claim("bonus_vs_history", "insufficient_data", rules[0], numbers, {"prior_years": fmt.count(len(prior))}, evidence)
    if bonus < min(prior.values()):
        value, rule = "below_all_prior_years", rules[1]
    elif bonus > max(prior.values()):
        value, rule = "above_all_prior_years", rules[2]
    else:
        value, rule = "within_prior_range", rules[3]
    formats = {
        "bonus_2026": fmt.points(bonus),
        "prior_min": fmt.points(numbers["prior_min"]),
        "prior_max": fmt.points(numbers["prior_max"]),
        "prior_years": fmt.count(len(prior)),
    }
    return _claim("bonus_vs_history", value, rule, numbers, formats, evidence)


def turnout_explanation(rows: Rows, office: Office, th: Thresholds = THRESHOLDS) -> Claim:
    """How many 2026 races of the office a turnout change alone could explain, from turnout_k.csv."""
    rules = rule_text(th)["turnout_explanation"]
    races = [r for r in _year_office(rows, office) if r.get("turnout_plausible") in ("true", "false")]
    plausible = sum(r["turnout_plausible"] == "true" for r in races)
    numbers: dict[str, Number] = {"n": len(races), "plausible": plausible, "share_plausible": None}
    evidence = [race_key(r) for r in races]
    if len(races) < th.min_comparable_races:
        numbers["plausible"] = None
        return _claim("turnout_explanation", "insufficient_data", rules[0], numbers, {"n": fmt.count(len(races))}, evidence)
    numbers["share_plausible"] = plausible / len(races)
    if 2 * plausible > len(races):
        value, rule = "turnout_plausible_majority", rules[1]
    elif 2 * plausible < len(races):
        value, rule = "persuasion_needed_majority", rules[2]
    else:
        value, rule = "evenly_split", rules[3]
    formats = {"n": fmt.count(len(races)), "plausible": fmt.count(plausible), "share_plausible": fmt.percent(numbers["share_plausible"])}
    return _claim("turnout_explanation", value, rule, numbers, formats, evidence)


def k_direction(rows: Rows, office: Office, th: Thresholds = THRESHOLDS) -> Claim:
    """The median 2026 turnout ratio k of the office against the parity band, from turnout_k.csv."""
    rules = rule_text(th)["k_direction"]
    races = [r for r in _year_office(rows, office) if _num(r, "k") is not None]
    ks = [_req(r, "k") for r in races]
    numbers: dict[str, Number] = {"n": len(ks), "median_k": None}
    evidence = [race_key(r) for r in races]
    if len(ks) < th.min_comparable_races:
        return _claim("k_direction", "insufficient_data", rules[0], numbers, {"n": fmt.count(len(ks))}, evidence)
    median = statistics.median(ks)
    numbers["median_k"] = median
    low, high = th.k_parity_band
    if median > high:
        value, rule = "dem_relative_gain", rules[1]
    elif median < low:
        value, rule = "rep_relative_gain", rules[2]
    else:
        value, rule = "near_parity", rules[3]
    return _claim("k_direction", value, rule, numbers, {"n": fmt.count(len(ks)), "median_k": fmt.ratio(median, th.k_parity_band)}, evidence)


def dummymander(rows: Rows, th: Thresholds = THRESHOLDS) -> Claim:
    """The 2026 raw difference of mean incumbent share change, redrawn House seats minus the rest, from dummymander.csv."""
    rules = rule_text(th)["dummymander"]
    groups_2026 = _dummy_groups(rows, YEAR)
    redrawn, rest = groups_2026.get("redrawn", {}), groups_2026.get("not_redrawn", {})
    numbers: dict[str, Number] = {
        "redrawn_mean": _num(redrawn, "mean_change"),
        "not_redrawn_mean": _num(rest, "mean_change"),
        "difference": _num(redrawn, "difference"),
        "redrawn_races": int(_num(redrawn, "races") or 0),
        "not_redrawn_races": int(_num(rest, "races") or 0),
    }
    evidence = [f"dummymander.csv:{YEAR},house,{g}" for g in ("redrawn", "not_redrawn") if g in groups_2026]
    race_formats = {"redrawn_races": fmt.count(numbers["redrawn_races"]), "not_redrawn_races": fmt.count(numbers["not_redrawn_races"])}
    diff = numbers["difference"]
    if not _dummy_sufficient(groups_2026, th) or diff is None:
        return _claim("dummymander", "insufficient_data", rules[0], numbers, race_formats, evidence)
    d = th.dummymander_points
    if diff <= -d:
        value, rule = "redrawn_incumbents_worse", rules[1]
    elif diff >= d:
        value, rule = "redrawn_incumbents_better", rules[2]
    else:
        value, rule = "no_clear_difference", rules[3]
    formats = {
        "redrawn_mean": fmt.points(numbers["redrawn_mean"]),
        "not_redrawn_mean": fmt.points(numbers["not_redrawn_mean"]),
        "difference": fmt.points(diff, (d, -d)),
        **race_formats,
    }
    return _claim("dummymander", value, rule, numbers, formats, evidence)


def dummymander_vs_history(rows: Rows, th: Thresholds = THRESHOLDS) -> Claim:
    """The absolute 2026 dummymander difference against every earlier year's, from dummymander.csv."""
    rules = rule_text(th)["dummymander_vs_history"]
    current = dummymander(rows, th)
    prior: dict[int, float] = {}
    for r in rows:
        diff = _num(r, "difference")
        if r.get("office") == "house" and r.get("year", "").isdigit() and int(r["year"]) < int(YEAR) and diff is not None:
            prior[int(r["year"])] = abs(diff)
    top = max(prior, key=lambda y: (prior[y], y)) if prior else None
    diff = current["numbers"]["difference"]
    numbers: dict[str, Number] = {"difference": diff, "prior_max_abs": prior[top] if top is not None else None, "prior_max_year": top}
    evidence = [f"dummymander.csv:{y},house,redrawn" for y in (*sorted(prior), int(YEAR))]
    if current["value"] == "insufficient_data" or top is None or diff is None:
        return _claim("dummymander_vs_history", "insufficient_data", rules[0], numbers, {"prior_max_year": fmt.count(top) if top is not None else "no earlier year"}, evidence)
    if abs(diff) > prior[top]:
        value, rule = "largest_gap_on_record", rules[1]
    else:
        value, rule = "within_prior_range", rules[2]
    formats = {"difference": fmt.points(diff), "prior_max_abs": f"{prior[top]:.2f} points", "prior_max_year": fmt.count(top)}
    return _claim("dummymander_vs_history", value, rule, numbers, formats, evidence)


def _claim(family: str, value: str, rule: str, numbers: dict[str, Number], display: dict[str, str], evidence: list[str]) -> Claim:
    fields = SPARSE_DISPLAY[family] if value in SPARSE_VALUES else DISPLAY[family]
    full = {f: numbers.get(f) for f in DISPLAY[family]} | numbers
    return {"value": value, "rule": rule, "numbers": full, "display": {f: display[f] for f in fields}, "trigger_fields": list(fields), "evidence": evidence}


def _num(row: Mapping[str, str], column: str) -> float | None:
    cell = row.get(column, "")
    return float(cell) if cell not in ("", None) else None


def _req(row: Row, column: str) -> float:
    value = _num(row, column)
    if value is None:
        raise ValueError(f"{column} is null")
    return value


def _year_office(rows: Rows, office: Office) -> list[Row]:
    return [r for r in rows if r.get("year") == YEAR and r.get("office") == office]


def _fit(rows: Rows, group: Group, scope: str) -> dict[str, Row]:
    return {r["incumbent_party"]: r for r in rows if r.get("office") == group.office and r.get("lean") == group.lean and r.get("year_scope") == scope}


def _row_id(group: Group, scope: str, party: str) -> str:
    return f"{LEAN_FILES[group.leandef]}:{group.office},{group.lean},{scope},{party}"


def _row_ids(group: Group, scope: str) -> list[str]:
    return [_row_id(group, scope, party) for party in PARTIES]


def _dummy_groups(rows: Rows, year: str) -> dict[str, Row]:
    return {r["group"]: r for r in rows if r.get("year") == year and r.get("office") == "house"}


def _dummy_sufficient(groups_: Mapping[str, Row], th: Thresholds) -> bool:
    for name in ("redrawn", "not_redrawn"):
        row = groups_.get(name)
        if row is None or _num(row, "mean_change") is None or (_num(row, "races") or 0) < th.min_group_races:
            return False
    return True

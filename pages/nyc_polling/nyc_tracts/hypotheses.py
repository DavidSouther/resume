"""Hypotheses H0 to H6: are higher poverty tracts more likely to have no early voting poll site inside the tract?

A tract "needs an out-of-tract visit" when no poll site point falls inside its polygon. This is a
proxy: voters are assigned to sites by election district, which this data does not include.
"""

from collections.abc import Callable, Sequence

from .census import COUNTIES
from .dataset import Dataset
from .domain import Observation, Site, Tract
from .geo import PointLocator
from .poverty import POVERTY_LABELS, class_index
from .results import BoroughRow, DisparateImpact, ExcludedSite, Group, Hypothesis, Report
from .stats import chi_squared, holm, mantel_haenszel, trend_test

HIGH_POVERTY = 20.0  # "high poverty" group: at or above this rate
ALPHA = 0.05
FOUR_FIFTHS = 0.8

Table = list[list[int]]  # rows = groups, columns = [outcome yes, outcome no]
Outcome = Callable[[Observation], bool]  # the adverse outcome each hypothesis counts


def needs_out(o: Observation) -> bool:
    """Default outcome: the tract has no poll site inside it."""
    return o.needs_out


DISTANCE_TESTS = (("H3", 0.25), ("H4", 0.5), ("H5", 1.0))
HI_LABELS = [f"Poverty {HIGH_POVERTY:.0f}% and over", f"Poverty under {HIGH_POVERTY:.0f}%"]
INCOME_LABELS = ["Income quintile 5 (highest)", "Income quintile 4", "Income quintile 3", "Income quintile 2", "Income quintile 1 (lowest)"]


# ------------------------------------------------------------------ geometry


def site_tracts(tracts: Sequence[Tract], sites: Sequence[Site]) -> list[Tract | None]:
    """Tract containing each site, or None, in site order."""
    locator = PointLocator([t.geometry for t in tracts])
    return [None if (i := locator.find(s.lon, s.lat)) is None else tracts[i] for s in sites]


def observe(tracts: Sequence[Tract], sites: Sequence[Site]) -> tuple[list[Observation], list[Site]]:
    """Observations for each tract, plus the sites that fall in no analyzed tract."""
    containing = site_tracts(tracts, sites)
    with_site = {t.geoid for t in containing if t}
    outside = [s for s, t in zip(sites, containing, strict=True) if t is None]
    return [Observation(t, t.geoid in with_site, t.nearest_site_mi(sites)) for t in tracts], outside


# ---------------------------------------------------------------- tables


def _poverty(o: Observation) -> float:
    """Poverty rate of an observation that run_hypotheses already filtered to tracts with one."""
    assert o.tract.poverty is not None
    return o.tract.poverty


def _income(o: Observation) -> float:
    assert o.tract.income is not None
    return o.tract.income


def poverty_class(p: float) -> int:
    idx = class_index(p)
    assert idx is not None
    return idx


def count_table(obs: Sequence[Observation], group_fn: Callable[[Observation], int], n_groups: int, outcome_fn: Callable[[Observation], bool]) -> Table:
    table: Table = [[0, 0] for _ in range(n_groups)]
    for o in obs:
        table[group_fn(o)][0 if outcome_fn(o) else 1] += 1
    return table


def rate_rows(table: Table, labels: Sequence[str]) -> list[Group]:
    return [{"group": lab, "tracts": a + b, "outcome": a, "rate": a / (a + b) if a + b else None} for lab, (a, b) in zip(labels, table, strict=True)]


def disparate_impact(table_2x2: Table) -> DisparateImpact:
    """Rows [high poverty, lower poverty]; column 0 = needs out-of-tract visit.

    Favorable outcome is having a site in the tract. Ratio below 0.8 fails the four-fifths rule."""
    (hi_out, hi_in), (lo_out, lo_in) = table_2x2
    hi_rate = hi_in / (hi_in + hi_out)
    lo_rate = lo_in / (lo_in + lo_out)
    return {
        "favorable_rate_high": hi_rate,
        "favorable_rate_lower": lo_rate,
        "impact_ratio": hi_rate / lo_rate if lo_rate else None,
        "fails_four_fifths": lo_rate > 0 and hi_rate / lo_rate < FOUR_FIFTHS,
        "risk_ratio_out_of_tract": (hi_out / (hi_out + hi_in)) / (lo_out / (lo_out + lo_in)) if lo_out else None,
    }


def supports_hypothesis(h: Hypothesis) -> bool:
    """True when the observed direction is the hypothesized one: higher poverty (or lower income) means more tracts without a site."""
    if h.trend is not None:
        return h.trend["z"] > 0
    if h.mantel_haenszel is not None:
        return h.mantel_haenszel["common_odds_ratio"] > 1
    assert h.groups is not None
    high, lower = h.groups
    assert high["rate"] is not None and lower["rate"] is not None
    return high["rate"] > lower["rate"]


# ---------------------------------------------------------------- hypotheses


def _testable(table: Table) -> bool:
    """No empty row or column, so chi_squared accepts it."""
    return all(sum(r) > 0 for r in table) and all(sum(r[j] for r in table) > 0 for j in range(len(table[0])))


def _hypothesis(name: str, question: str, table: Table, labels: Sequence[str]) -> Hypothesis:
    return Hypothesis(name, question, chi_squared(table), groups=rate_rows(table, labels))


def _high_group(o: Observation) -> int:
    return 0 if _poverty(o) >= HIGH_POVERTY else 1


def _two_group(obs: Sequence[Observation], outcome: Outcome) -> Table:
    return count_table(obs, _high_group, 2, outcome)


def _by_poverty_class(o: Observation) -> int:
    return poverty_class(_poverty(o))


def h0_baseline(pov: Sequence[Observation], outcome: Outcome) -> Hypothesis:
    table = count_table(pov, _by_poverty_class, len(POVERTY_LABELS), outcome)
    h = _hypothesis(
        "H0 baseline",
        "Higher poverty tracts are more likely to have no poll site in the tract (so residents visit a site in a different tract).",
        table,
        POVERTY_LABELS,
    )
    h.trend = trend_test(table)
    h.disparate_impact = disparate_impact(_two_group(pov, outcome))
    return h


def h1_two_groups(pov: Sequence[Observation], outcome: Outcome) -> Hypothesis:
    table = _two_group(pov, outcome)
    h = _hypothesis(
        "H1 high vs lower poverty",
        f"Collapsing to two groups ({HIGH_POVERTY:.0f}% poverty cut), high poverty tracts lack an in-tract site more often.",
        table,
        HI_LABELS,
    )
    h.chi_squared_yates = chi_squared(table, correction=True)
    return h


def h2_within_borough(pov: Sequence[Observation], outcome: Outcome) -> Hypothesis:
    strata: list[Table] = []
    rows: list[BoroughRow] = []
    for b in COUNTIES.values():
        tb = _two_group([o for o in pov if o.tract.borough == b], outcome)
        strata.append(tb)
        rows.append({"borough": b, "groups": rate_rows(tb, HI_LABELS), "chi_squared": chi_squared(tb) if _testable(tb) else None})
    cmh = mantel_haenszel(strata)
    return Hypothesis(
        "H2 within borough",
        "The H1 gap persists inside each borough (not an artifact of borough composition). Mantel-Haenszel across boroughs.",
        {"chi2": cmh["chi2"], "df": 1, "p": cmh["p"]},
        by_borough=rows,
        mantel_haenszel=cmh,
    )


def h_distance(pov: Sequence[Observation], hnum: str, miles: float) -> Hypothesis:
    table = count_table(pov, _by_poverty_class, len(POVERTY_LABELS), lambda o: o.nearest_mi > miles)
    h = _hypothesis(
        f"{hnum} distance over {miles:g} mile",
        f"Higher poverty tracts have a centroid more than {miles:g} mile from the nearest poll site (a travel burden even when a site exists nearby).",
        table,
        POVERTY_LABELS,
    )
    h.trend = trend_test(table)
    return h


def h_out_of_tract(pov: Sequence[Observation], hnum: str) -> Hypothesis:
    """Poverty classes against no site (or, for assignments, no assigned site) inside the tract."""
    table = count_table(pov, _by_poverty_class, len(POVERTY_LABELS), needs_out)
    h = _hypothesis(f"{hnum} out of tract", "Higher poverty tracts are more likely to have no poll site inside the tract.", table, POVERTY_LABELS)
    h.trend = trend_test(table)
    return h


def h6_income(with_income: Sequence[Observation], outcome: Outcome) -> Hypothesis:
    ranked = sorted(with_income, key=_income)
    # Row 0 is the highest income quintile, so rows run in order of increasing disadvantage like the poverty classes
    # and a positive trend supports the hypothesis.
    row = {id(o): 4 - min(4, i * 5 // len(ranked)) for i, o in enumerate(ranked)}  # by identity: a tract can appear in several observations
    table = count_table(with_income, lambda o: row[id(o)], 5, outcome)
    h = _hypothesis(
        "H6 income instead of poverty",
        "Lower median household income tracts (quintiles) lack an in-tract site more often; tests whether the baseline depends on the poverty measure.",
        table,
        INCOME_LABELS,
    )
    h.trend = trend_test(table)
    return h


def run_hypotheses(
    obs: Sequence[Observation], outcome: Outcome = needs_out, distance_tests: Sequence[tuple[str, float]] = DISTANCE_TESTS, out_of_tract_test: bool = False
) -> tuple[Hypothesis, list[Hypothesis]]:
    """H0 to H6 on `outcome` (default: no poll site inside the tract).

    `distance_tests` are the (name, miles) distance hypotheses. `out_of_tract_test` adds the in-tract test
    as one more related hypothesis, for runs whose outcome is something else."""
    pov = [o for o in obs if o.tract.poverty is not None]
    with_income = [o for o in pov if o.tract.income is not None]
    baseline = h0_baseline(pov, outcome)
    related = [h1_two_groups(pov, outcome), h2_within_borough(pov, outcome)]
    related += [h_distance(pov, h, m) for h, m in distance_tests]
    if out_of_tract_test:
        related.append(h_out_of_tract(pov, f"H{len(related) + 1}"))
    related.append(h6_income(with_income, outcome))
    for h in [baseline, *related]:
        h.direction_supports_hypothesis = supports_hypothesis(h)
    for h, adj in zip(related, holm([h.chi_squared["p"] for h in related]), strict=True):
        h.holm_p = adj
        h.significant_after_holm = adj < ALPHA
    return baseline, related


def analyze(repo: Dataset) -> Report:
    tracts, sites = repo.tracts(), repo.sites()
    obs, outside = observe(tracts, sites)
    excluded: dict[str, list[ExcludedSite]] = {}
    for layer, layer_tracts in repo.excluded_tracts().items():
        for s, t in zip(outside, site_tracts(layer_tracts, outside), strict=True):
            if t:
                excluded.setdefault(layer, []).append({"site": s.name, "geoid": t.geoid})
    covered = {e["site"] for v in excluded.values() for e in v}
    outside = [s for s in outside if s.name not in covered]
    baseline, related = run_hypotheses(obs)
    pov = [o for o in obs if o.tract.poverty is not None]
    return Report(
        tracts_loaded=len(tracts),
        tracts_analyzed=len(pov),
        tracts_with_income=sum(1 for o in pov if o.tract.income is not None),
        poll_sites=len(sites),
        poll_sites_outside_tracts=len(outside),
        sites_in_excluded_layers=excluded,
        outside_sites=[s.name for s in outside],
        tracts_with_site=sum(1 for o in pov if o.has_site),
        baseline=baseline,
        related=related,
    )

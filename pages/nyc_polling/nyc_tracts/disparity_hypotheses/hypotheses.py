"""The tests that ask whether higher poverty tract districts have differential access to early voting.

A test takes observations and one access measure (see measures.py), whose adverse outcome it counts. The same four tests run on every measure:

- gradient: five poverty classes, chi-squared and a trend test, plus disparate impact of high against lower poverty
- two_group: high poverty (at or above HIGH_POVERTY) against lower, Yates corrected
- within_borough: the two group gap inside each borough, Mantel-Haenszel across them
- income: median household income quintiles in place of poverty, to check the result does not depend on the poverty measure
"""

from collections.abc import Callable, Sequence
from itertools import pairwise

from ..generic.geo import PointLocator
from ..generic.stats import chi_squared, holm, mantel_haenszel, nested_f_test, polyfit, trend_test
from ..geography.census import COUNTIES
from ..kernel.domain import Observation, Site, Tract
from ..kernel.poverty import POVERTY_LABELS, class_index
from .measures import MEASURES, PRIMARY, AccessMeasure
from .results import BoroughRow, DisparateImpact, Group, Hypothesis, Regression

MAX_DEGREE = 3  # linear, quadratic, cubic
HIGH_POVERTY = 20.0  # "high poverty" group: at or above this rate
ALPHA = 0.05
FOUR_FIFTHS = 0.8

Table = list[list[int]]  # rows = groups, columns = [adverse, not adverse]

HI_LABELS = [f"Poverty {HIGH_POVERTY:.0f}% and over", f"Poverty under {HIGH_POVERTY:.0f}%"]
INCOME_LABELS = ["Income quintile 5 (highest)", "Income quintile 4", "Income quintile 3", "Income quintile 2", "Income quintile 1 (lowest)"]
KIND_LABELS = {"gradient": "Poverty gradient", "two_group": "High vs lower poverty", "within_borough": "Within borough", "income": "Income quintiles"}


def site_tracts(tracts: Sequence[Tract], sites: Sequence[Site]) -> list[Tract | None]:
    """Tract containing each site, or None, in site order."""
    locator = PointLocator([t.geometry for t in tracts])
    return [None if (i := locator.find(s.lon, s.lat)) is None else tracts[i] for s in sites]

    # ---------------------------------------------------------------- tables


def _poverty(o: Observation) -> float:
    """Poverty rate of an observation that run_tests already filtered to tracts with one."""
    assert o.tract.poverty is not None
    return o.tract.poverty


def _income(o: Observation) -> float:
    assert o.tract.income is not None
    return o.tract.income


def poverty_class(p: float) -> int:
    idx = class_index(p)
    assert idx is not None
    return idx


def count_table(obs: Sequence[Observation], group_fn: Callable[[Observation], int], n_groups: int, adverse: Callable[[Observation], bool]) -> Table:
    table: Table = [[0, 0] for _ in range(n_groups)]
    for o in obs:
        table[group_fn(o)][0 if adverse(o) else 1] += 1
    return table


def rate_rows(table: Table, labels: Sequence[str]) -> list[Group]:
    return [{"group": lab, "n": a + b, "adverse": a, "rate": a / (a + b) if a + b else None} for lab, (a, b) in zip(labels, table, strict=True)]


def disparate_impact(table_2x2: Table) -> DisparateImpact:
    """Rows [high poverty, lower poverty]; column 0 = adverse outcome.

    Favorable outcome is not being adverse. Ratio below 0.8 fails the four-fifths rule."""
    (hi_bad, hi_ok), (lo_bad, lo_ok) = table_2x2
    hi_rate = hi_ok / (hi_ok + hi_bad)
    lo_rate = lo_ok / (lo_ok + lo_bad)
    return {
        "favorable_rate_high": hi_rate,
        "favorable_rate_lower": lo_rate,
        "impact_ratio": hi_rate / lo_rate if lo_rate else None,
        "fails_four_fifths": lo_rate > 0 and hi_rate / lo_rate < FOUR_FIFTHS,
        "risk_ratio_adverse": (hi_bad / (hi_bad + hi_ok)) / (lo_bad / (lo_bad + lo_ok)) if lo_bad else None,
    }


def supports_hypothesis(h: Hypothesis) -> bool:
    """True when the observed direction is the hypothesized one: higher poverty (or lower income) means more adverse outcomes."""
    if h.trend is not None:
        return h.trend["z"] > 0
    if h.mantel_haenszel is not None:
        return h.mantel_haenszel["common_odds_ratio"] > 1
    assert h.groups is not None
    high, lower = h.groups
    assert high["rate"] is not None and lower["rate"] is not None
    return high["rate"] > lower["rate"]

    # ---------------------------------------------------------------- tests


def _testable(table: Table) -> bool:
    """No empty row or column, so chi_squared accepts it."""
    return all(sum(r) > 0 for r in table) and all(sum(r[j] for r in table) > 0 for j in range(len(table[0])))


def _test(kind: str, m: AccessMeasure, question: str, table: Table, labels: Sequence[str]) -> Hypothesis:
    return Hypothesis(f"{KIND_LABELS[kind]}: {m.short}", question, chi_squared(table), kind, m.key, groups=rate_rows(table, labels))


def _two_group(obs: Sequence[Observation], m: AccessMeasure) -> Table:
    return count_table(obs, lambda o: 0 if _poverty(o) >= HIGH_POVERTY else 1, 2, m.adverse)


def poverty_gradient(pov: Sequence[Observation], m: AccessMeasure) -> Hypothesis:
    table = count_table(pov, lambda o: poverty_class(_poverty(o)), len(POVERTY_LABELS), m.adverse)
    h = _test("gradient", m, f"Are higher poverty tract districts more likely to be assigned {m.phrase}?", table, POVERTY_LABELS)
    h.trend = trend_test(table)
    h.disparate_impact = disparate_impact(_two_group(pov, m))
    return h


def two_group(pov: Sequence[Observation], m: AccessMeasure) -> Hypothesis:
    table = _two_group(pov, m)
    h = _test("two_group", m, f"Collapsing to two groups ({HIGH_POVERTY:.0f}% poverty cut), are high poverty tract districts more likely to be assigned {m.phrase}?", table, HI_LABELS)
    h.chi_squared_yates = chi_squared(table, correction=True)
    return h


def within_borough(pov: Sequence[Observation], m: AccessMeasure) -> Hypothesis:
    strata: list[Table] = []
    rows: list[BoroughRow] = []
    for b in COUNTIES.values():
        tb = _two_group([o for o in pov if o.tract.borough == b], m)
        strata.append(tb)
        rows.append({"borough": b, "groups": rate_rows(tb, HI_LABELS), "chi_squared": chi_squared(tb) if _testable(tb) else None})
    cmh = mantel_haenszel(strata)
    return Hypothesis(
        f"{KIND_LABELS['within_borough']}: {m.short}",
        f"Does the high against lower poverty gap in being assigned {m.phrase} persist inside each borough, so it is not an artifact of borough composition? Mantel-Haenszel across boroughs.",
        {"chi2": cmh["chi2"], "df": 1, "p": cmh["p"]},
        "within_borough",
        m.key,
        by_borough=rows,
        mantel_haenszel=cmh,
    )


def income_gradient(with_income: Sequence[Observation], m: AccessMeasure) -> Hypothesis:
    ranked = sorted(with_income, key=_income)
    # Row 0 is the highest income quintile, so rows run in order of increasing disadvantage like the poverty classes
    # and a positive trend supports the hypothesis.
    row = {id(o): 4 - min(4, i * 5 // len(ranked)) for i, o in enumerate(ranked)}  # by identity: a tract can appear in several observations
    table = count_table(with_income, lambda o: row[id(o)], 5, m.adverse)
    h = _test(
        "income",
        m,
        f"Are lower median household income tract districts (quintiles) more likely to be assigned {m.phrase}? Tests whether the result depends on the poverty measure.",
        table,
        INCOME_LABELS,
    )
    h.trend = trend_test(table)
    return h


def poverty_regression(obs: Sequence[Observation]) -> Regression:
    """Distance to the assigned site against poverty rate, fit as a line, a quadratic, and a cubic.

    The class table is not monotonic (the middle classes are closest), which a line cannot show, so the degrees
    compete: each nested F test asks whether the extra term earns its place, and BIC and adjusted R-squared pick one."""
    pov = [o for o in obs if o.tract.poverty is not None]
    x = [_poverty(o) for o in pov]
    y = [o.miles for o in pov]
    fits = [polyfit(x, y, d) for d in range(1, MAX_DEGREE + 1)]
    return Regression(
        len(pov),
        fits,
        [nested_f_test(a, b) for a, b in pairwise(fits)],
        min(fits, key=lambda f: f.bic).degree,
        max(fits, key=lambda f: f.adj_r2).degree,
    )


def run_tests(obs: Sequence[Observation], measures: Sequence[AccessMeasure] = MEASURES, primary: AccessMeasure = PRIMARY) -> tuple[Hypothesis, list[Hypothesis]]:
    """All four tests on every measure. Returns (the primary test, every other test with Holm adjusted p-values).

    The primary test is pre-specified: the poverty gradient on the primary measure. The rest are one family."""
    pov = [o for o in obs if o.tract.poverty is not None]
    with_income = [o for o in pov if o.tract.income is not None]
    lead = poverty_gradient(pov, primary)
    rest: list[Hypothesis] = []
    for m in measures:
        if m is not primary:
            rest.append(poverty_gradient(pov, m))
        rest += [two_group(pov, m), within_borough(pov, m), income_gradient(with_income, m)]
    for h in [lead, *rest]:
        h.direction_supports_hypothesis = supports_hypothesis(h)
    for h, adj in zip(rest, holm([h.chi_squared["p"] for h in rest]), strict=True):
        h.holm_p = adj
        h.significant_after_holm = adj < ALPHA
    return lead, rest

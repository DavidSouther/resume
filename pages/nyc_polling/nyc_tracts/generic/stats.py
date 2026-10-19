"""Statistical tests on count tables, in plain Python (no numpy, scipy, or statsmodels).

tests/test_stats_crosscheck.py compares each function with scipy and statsmodels.
"""

import math
from collections.abc import Sequence

from ..disparity_hypotheses.results import ChiSquared, MantelHaenszel, NestedTest, PolynomialFit, Trend

Table = Sequence[Sequence[float]]


def _gamma_q(a: float, x: float) -> float:
    """Regularized upper incomplete gamma Q(a, x): a series below a + 1, a continued fraction above."""
    if x <= 0:
        return 1.0
    ln_prefix = -x + a * math.log(x) - math.lgamma(a)
    if x < a + 1:
        term = total = 1.0 / a
        n = a
        for _ in range(1000):
            n += 1
            term *= x / n
            total += term
            if abs(term) < abs(total) * 1e-15:
                break
        return max(0.0, 1.0 - total * math.exp(ln_prefix))
    tiny = 1e-300
    b = x + 1 - a
    c = 1 / tiny
    d = 1 / b
    h = d
    for i in range(1, 1000):
        an = -i * (i - a)
        b += 2
        d = an * d + b
        d = tiny if abs(d) < tiny else d
        c = b + an / c
        c = tiny if abs(c) < tiny else c
        d = 1 / d
        delta = d * c
        h *= delta
        if abs(delta - 1) < 1e-15:
            break
    return min(1.0, math.exp(ln_prefix) * h)


def chi2_sf(x: float, df: int) -> float:
    """Chi-squared survival function."""
    return _gamma_q(df / 2.0, x / 2.0)


def normal_sf(z: float) -> float:
    """Standard normal survival function."""
    return 0.5 * math.erfc(z / math.sqrt(2))


def chi_squared(table: Table, correction: bool = False) -> ChiSquared:
    """Pearson chi-squared test of independence on an r x c table of counts.

    An empty row or column is an error: the test has nothing to compare there, and a silently smaller table
    would report the wrong degrees of freedom. `correction` applies Yates' continuity correction, to 2 x 2 tables only."""
    rows = [list(r) for r in table]
    if not rows or not rows[0] or any(len(r) != len(rows[0]) for r in rows):
        raise ValueError("chi-squared needs a rectangular table with at least one row and one column")
    if any(sum(r) <= 0 for r in rows) or any(sum(r[j] for r in rows) <= 0 for j in range(len(rows[0]))):
        raise ValueError(f"chi-squared table has an empty row or column: {rows}")
    keep = list(range(len(rows[0])))
    n = sum(map(sum, rows))
    row_totals = [sum(r) for r in rows]
    col_totals = [sum(r[j] for r in rows) for j in range(len(keep))]
    two_by_two = len(rows) == 2 and len(keep) == 2
    chi2 = 0.0
    min_expected = float("inf")
    for i, r in enumerate(rows):
        for j, observed in enumerate(r):
            expected = row_totals[i] * col_totals[j] / n
            min_expected = min(min_expected, expected)
            diff = abs(observed - expected)
            if correction and two_by_two:
                diff = max(0.0, diff - 0.5)
            chi2 += diff * diff / expected
    df = (len(rows) - 1) * (len(keep) - 1)
    k = min(len(rows), len(keep)) - 1
    return {
        "chi2": chi2,
        "df": df,
        "p": chi2_sf(chi2, df) if df else 1.0,
        "n": int(n),
        "cramers_v": math.sqrt(chi2 / (n * k)) if df else 0.0,
        "min_expected": min_expected,
    }


def trend_test(table: Table, scores: Sequence[float] | None = None) -> Trend:
    """Cochran-Armitage test for a trend in column 0 proportions across ordered rows.

    Rows are ordered groups, columns are [outcome, no outcome]. The one-sided p is for the
    outcome proportion increasing with group order."""
    scores = list(scores) if scores else list(range(len(table)))
    rows = [(s, r[0], r[0] + r[1]) for s, r in zip(scores, table, strict=True) if r[0] + r[1] > 0]
    n = sum(t for _, _, t in rows)
    p = sum(a for _, a, _ in rows) / n
    t_stat = sum(s * (a - t * p) for s, a, t in rows)
    var = p * (1 - p) * (sum(t * s * s for s, _, t in rows) - sum(t * s for s, _, t in rows) ** 2 / n)
    z = t_stat / math.sqrt(var) if var > 0 else 0.0
    return {"z": z, "p_one_sided": normal_sf(z)}


def mantel_haenszel(strata: Sequence[Table]) -> MantelHaenszel:
    """Common odds ratio and continuity corrected CMH chi-squared (1 df) over 2x2 strata [[a, b], [c, d]]."""
    num = den = sum_a = sum_e = sum_v = 0.0
    for (a, b), (c, d) in strata:
        n = a + b + c + d
        if n < 2:
            continue
        num += a * d / n
        den += b * c / n
        row1, col1 = a + b, a + c
        sum_a += a
        sum_e += row1 * col1 / n
        sum_v += row1 * (c + d) * col1 * (b + d) / (n * n * (n - 1))
    chi2 = (abs(sum_a - sum_e) - 0.5) ** 2 / sum_v if sum_v > 0 else 0.0
    return {"common_odds_ratio": num / den if den else math.inf, "chi2": chi2, "df": 1, "p": chi2_sf(chi2, 1)}


def holm(pvals: Sequence[float]) -> list[float]:
    """Holm-Bonferroni adjusted p-values, in input order."""
    order = sorted(range(len(pvals)), key=lambda i: pvals[i])
    adjusted = [0.0] * len(pvals)
    running = 0.0
    for rank, i in enumerate(order):
        running = max(running, min(1.0, (len(pvals) - rank) * pvals[i]))
        adjusted[i] = running
    return adjusted


def _betacf(a: float, b: float, x: float) -> float:
    """Continued fraction for the incomplete beta function (modified Lentz)."""
    tiny = 1e-300
    qab, qap, qam = a + b, a + 1, a - 1
    c = 1.0
    d = 1 - qab * x / qap
    d = 1 / (tiny if abs(d) < tiny else d)
    h = d
    for m in range(1, 1000):
        m2 = 2 * m
        for an in (m * (b - m) * x / ((qam + m2) * (a + m2)), -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))):
            d = 1 + an * d
            d = 1 / (tiny if abs(d) < tiny else d)
            c = 1 + an / c
            c = tiny if abs(c) < tiny else c
            delta = d * c
            h *= delta
        if abs(delta - 1) < 1e-15:
            break
    return h


def betainc(a: float, b: float, x: float) -> float:
    """Regularized incomplete beta function I_x(a, b)."""
    if x <= 0:
        return 0.0
    if x >= 1:
        return 1.0
    ln_front = math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b) + a * math.log(x) + b * math.log1p(-x)
    if x < (a + 1) / (a + b + 2):
        return math.exp(ln_front) * _betacf(a, b, x) / a
    return 1 - math.exp(ln_front) * _betacf(b, a, 1 - x) / b


def f_sf(f: float, df1: int, df2: int) -> float:
    """F distribution survival function."""
    if f <= 0:
        return 1.0
    return betainc(df2 / 2, df1 / 2, df2 / (df2 + df1 * f))


def _solve(a: list[list[float]], b: list[float]) -> list[float]:
    """Solve a x = b by Gaussian elimination with partial pivoting."""
    n = len(b)
    m = [[*row, v] for row, v in zip(a, b, strict=True)]
    for col in range(n):
        pivot = max(range(col, n), key=lambda r: abs(m[r][col]))
        if abs(m[pivot][col]) < 1e-12:
            raise ValueError("singular design matrix: too few distinct x values for this degree")
        m[col], m[pivot] = m[pivot], m[col]
        for r in range(col + 1, n):
            factor = m[r][col] / m[col][col]
            for k in range(col, n + 1):
                m[r][k] -= factor * m[col][k]
    x = [0.0] * n
    for r in range(n - 1, -1, -1):
        x[r] = (m[r][n] - sum(m[r][k] * x[k] for k in range(r + 1, n))) / m[r][r]
    return x


def polyfit(x: Sequence[float], y: Sequence[float], degree: int) -> PolynomialFit:
    """Ordinary least squares polynomial of `degree` through (x, y).

    The fit is in z = (x - mean) / scale so the normal equations stay well conditioned. `vertex` is the x
    where a quadratic turns, in the units of x, or None for any other degree."""
    n = len(x)
    if n != len(y) or n <= degree + 1:
        raise ValueError(f"degree {degree} needs more than {degree + 1} points, got {n}")
    mean = sum(x) / n
    scale = math.sqrt(sum((v - mean) ** 2 for v in x) / n) or 1.0
    z = [(v - mean) / scale for v in x]
    powers = [sum(v**k for v in z) for k in range(2 * degree + 1)]
    gram = [[powers[i + j] for j in range(degree + 1)] for i in range(degree + 1)]
    moments = [sum(yv * v**k for v, yv in zip(z, y, strict=True)) for k in range(degree + 1)]
    coefficients = _solve(gram, moments)
    fit = PolynomialFit(degree, coefficients, mean, scale, n, 0.0, 0.0, 0.0, 0.0, 0.0, None)
    ybar = sum(y) / n
    rss = sum((yv - fit.predict(xv)) ** 2 for xv, yv in zip(x, y, strict=True))
    tss = sum((yv - ybar) ** 2 for yv in y)
    k = degree + 1
    fit.rss = rss
    fit.r2 = 1 - rss / tss if tss else 0.0
    fit.adj_r2 = 1 - (rss / (n - k)) / (tss / (n - 1)) if tss else 0.0
    fit.aic = n * math.log(rss / n) + 2 * k if rss > 0 else -math.inf
    fit.bic = n * math.log(rss / n) + k * math.log(n) if rss > 0 else -math.inf
    if degree == 2 and coefficients[2] != 0:
        fit.vertex = mean + scale * (-coefficients[1] / (2 * coefficients[2]))
    return fit


def nested_f_test(small: PolynomialFit, large: PolynomialFit) -> NestedTest:
    """Does the higher degree polynomial fit significantly better than the lower one it contains?"""
    df1 = large.degree - small.degree
    df2 = large.n - large.degree - 1
    f = ((small.rss - large.rss) / df1) / (large.rss / df2) if large.rss > 0 else math.inf
    return {"degrees": f"{small.degree} to {large.degree}", "f": f, "df1": df1, "df2": df2, "p": f_sf(f, df1, df2) if math.isfinite(f) else 0.0}

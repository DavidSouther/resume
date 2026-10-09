#!/usr/bin/env python3
"""Disparate impact tests: are higher poverty NYC census tracts more likely to have no early voting poll site inside the tract?

Reads the KML files that nyc_tracts_poll_sites.py wrote to public/nyc_polling/ (tract
polygons with poverty rate and median household income in each pop-up, plus poll site
points). Only the borough layers are analyzed: the low population and zero population layers are excluded. No network access and no Census API key are needed. Standard library only.

A tract "needs an out-of-tract visit" when no poll site point falls inside its polygon. This is a
proxy: voters are assigned to sites by election district, which this data does not include.

Baseline (H0): poverty class (5 classes) is associated with needing an out-of-tract visit.
Related hypotheses H1 to H6 probe the baseline's robustness and mechanism. Related p-values get a
Holm correction; the baseline is reported on its own.

Writes nyc_tracts_poll_disparity.report.json and .report.md next to this script.
"""

import argparse
import html
import json
import math
import os
import re
import xml.etree.ElementTree as ET

from nyc_tracts_poll_sites import ring_contains

KML_NS = "http://www.opengis.net/kml/2.2"
K = "{" + KML_NS + "}"
BOROUGH_FILES = {
    "Bronx": "nyc_tracts_bronx.kml",
    "Brooklyn": "nyc_tracts_brooklyn.kml",
    "Manhattan": "nyc_tracts_manhattan.kml",
    "Queens": "nyc_tracts_queens.kml",
    "Staten Island": "nyc_tracts_staten_island.kml",
}
POLL_FILE = "nyc_poll_sites.kml"
EXCLUDED_FILES = {"zero population": "nyc_tracts_zero_population.kml", "low population": "nyc_tracts_low_population.kml"}

# Same breaks as nyc_tracts_poll_sites.py CLASSES (upper bound exclusive).
POVERTY_BREAKS = [10.0, 20.0, 30.0, 40.0]
POVERTY_LABELS = ["Under 10%", "10% to 20%", "20% to 30%", "30% to 40%", "40% and over"]
HIGH_POVERTY = 20.0  # "high poverty" group: at or above this rate
EARTH_RADIUS_MI = 3958.8
ALPHA = 0.05
FOUR_FIFTHS = 0.8


# ---------------------------------------------------------------- statistics


def _gamma_q(a, x):
    """Regularized upper incomplete gamma Q(a, x) (series below a+1, continued fraction above)."""
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


def chi2_sf(x, df):
    return _gamma_q(df / 2.0, x / 2.0)


def normal_sf(z):
    return 0.5 * math.erfc(z / math.sqrt(2))


def chi_squared(table, correction=False):
    """Pearson chi-squared test of independence on an r x c table of counts."""
    rows = [r for r in table if sum(r) > 0]
    cols = [j for j in range(len(rows[0])) if sum(r[j] for r in rows) > 0]
    rows = [[r[j] for j in cols] for r in rows]
    n = sum(sum(r) for r in rows)
    row_t = [sum(r) for r in rows]
    col_t = [sum(r[j] for r in rows) for j in range(len(cols))]
    chi2 = 0.0
    min_expected = float("inf")
    for i, r in enumerate(rows):
        for j, o in enumerate(r):
            e = row_t[i] * col_t[j] / n
            min_expected = min(min_expected, e)
            diff = abs(o - e)
            if correction and len(rows) == 2 and len(cols) == 2:
                diff = max(0.0, diff - 0.5)
            chi2 += diff * diff / e
    df = (len(rows) - 1) * (len(cols) - 1)
    return {
        "chi2": chi2,
        "df": df,
        "p": chi2_sf(chi2, df) if df else 1.0,
        "n": n,
        "cramers_v": math.sqrt(chi2 / (n * min(len(rows) - 1, len(cols) - 1))) if df else 0.0,
        "min_expected": min_expected,
    }


def trend_test(table, scores=None):
    """Cochran-Armitage test for a trend in column 0 proportions across ordered rows.

    table rows are ordered groups, columns are [outcome, no outcome]. Returns z and the one-sided p
    for the proportion with the outcome increasing with group order."""
    scores = scores or list(range(len(table)))
    rows = [(s, r[0], r[0] + r[1]) for s, r in zip(scores, table) if r[0] + r[1] > 0]
    n = sum(t for _, _, t in rows)
    x = sum(a for _, a, _ in rows)
    p = x / n
    t_stat = sum(s * (a - t * p) for s, a, t in rows)
    var = p * (1 - p) * (sum(t * s * s for s, _, t in rows) - sum(t * s for s, _, t in rows) ** 2 / n)
    z = t_stat / math.sqrt(var) if var > 0 else 0.0
    return {"z": z, "p_one_sided": normal_sf(z)}


def mantel_haenszel(strata):
    """Common odds ratio and CMH chi-squared (1 df) over 2x2 strata [[a, b], [c, d]]."""
    num = den = 0.0
    sum_a = sum_e = sum_v = 0.0
    for (a, b), (c, d) in strata:
        n = a + b + c + d
        if n < 2:
            continue
        num += a * d / n
        den += b * c / n
        r1, c1 = a + b, a + c
        sum_a += a
        sum_e += r1 * c1 / n
        sum_v += r1 * (c + d) * c1 * (b + d) / (n * n * (n - 1))
    chi2 = (abs(sum_a - sum_e) - 0.5) ** 2 / sum_v if sum_v > 0 else 0.0
    return {"common_odds_ratio": num / den if den else float("inf"), "chi2": chi2, "df": 1, "p": chi2_sf(chi2, 1)}


def holm(pvals):
    """Holm-Bonferroni adjusted p-values, in input order."""
    order = sorted(range(len(pvals)), key=lambda i: pvals[i])
    adj = [0.0] * len(pvals)
    running = 0.0
    for rank, i in enumerate(order):
        running = max(running, min(1.0, (len(pvals) - rank) * pvals[i]))
        adj[i] = running
    return adj


# ------------------------------------------------------------------ geometry


def parse_ring(text):
    pts = []
    for tok in text.split():
        lon, lat = tok.split(",")[:2]
        pts.append((float(lon), float(lat)))
    return pts


def parse_polygons(pm):
    """Placemark -> list of polygons, each a list of rings [outer, hole, ...] of (lon, lat)."""
    polys = []
    for poly in pm.iter(K + "Polygon"):
        rings = [parse_ring(poly.findtext(K + "outerBoundaryIs/" + K + "LinearRing/" + K + "coordinates"))]
        for inner in poly.findall(K + "innerBoundaryIs"):
            rings.append(parse_ring(inner.findtext(K + "LinearRing/" + K + "coordinates")))
        polys.append(rings)
    return polys


def polygon_contains(poly, x, y):
    return ring_contains(poly[0], x, y) and not any(ring_contains(h, x, y) for h in poly[1:])


def centroid(polys):
    """Area-weighted centroid (lon, lat) of outer rings, using a local equirectangular projection."""
    lat0 = math.radians(sum(p[0][0][1] for p in polys) / len(polys))
    cos0 = math.cos(lat0)
    area_sum = cx_sum = cy_sum = 0.0
    for poly in polys:
        for k, ring in enumerate(poly):
            sign = 1 if k == 0 else -1
            pts = [(lon * cos0, lat) for lon, lat in ring]
            a = cx = cy = 0.0
            for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]):
                cross = x1 * y2 - x2 * y1
                a += cross
                cx += (x1 + x2) * cross
                cy += (y1 + y2) * cross
            if a == 0:
                continue
            area = abs(a) / 2
            cx_sum += sign * area * (cx / (3 * a))
            cy_sum += sign * area * (cy / (3 * a))
            area_sum += sign * area
    if area_sum == 0:
        pts = [p for poly in polys for p in poly[0]]
        return sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)
    return cx_sum / area_sum / cos0, cy_sum / area_sum


def haversine_mi(lon1, lat1, lon2, lat2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_MI * math.asin(math.sqrt(a))


# ---------------------------------------------------------------------- data


def _field(desc, label):
    m = re.search(r"<b>" + re.escape(label) + r":</b>\s*([^<]*)<br>", desc)
    return html.unescape(m.group(1)).strip() if m else None


def parse_tracts(path, borough):
    tracts = []
    for pm in ET.parse(path).getroot().iter(K + "Placemark"):
        desc = pm.findtext(K + "description") or ""
        geoid = _field(desc, "GEOID")
        pov = re.match(r"([\d.]+)%", _field(desc, "Poverty rate") or "")
        inc = re.match(r"\$([\d,]+)", _field(desc, "Median household income") or "")
        polys = parse_polygons(pm)
        xs = [p[0] for poly in polys for p in poly[0]]
        ys = [p[1] for poly in polys for p in poly[0]]
        tracts.append(
            {
                "geoid": geoid,
                "borough": borough,
                "poverty": float(pov.group(1)) if pov else None,
                "income": float(inc.group(1).replace(",", "")) if inc else None,
                "polys": polys,
                "bbox": (min(xs), min(ys), max(xs), max(ys)),
                "centroid": centroid(polys),
            }
        )
    return tracts


def parse_sites(path):
    sites = []
    for pm in ET.parse(path).getroot().iter(K + "Placemark"):
        lon, lat = pm.findtext(K + "Point/" + K + "coordinates").strip().split(",")[:2]
        sites.append({"name": (pm.findtext(K + "name") or "").strip(), "lon": float(lon), "lat": float(lat)})
    return sites


def load(data_dir):
    tracts = []
    for borough, fname in BOROUGH_FILES.items():
        tracts += parse_tracts(os.path.join(data_dir, fname), borough)
    return tracts, parse_sites(os.path.join(data_dir, POLL_FILE))


def tract_containing(tracts, lon, lat):
    for t in tracts:
        x0, y0, x1, y1 = t["bbox"]
        if x0 <= lon <= x1 and y0 <= lat <= y1 and any(polygon_contains(p, lon, lat) for p in t["polys"]):
            return t
    return None


def assign_sites(tracts, sites):
    """Set `needs_out` (no poll site inside) and `nearest_mi` (centroid to nearest site) on each tract.

    Returns the sites that fall in no analyzed tract."""
    with_site = set()
    outside = []
    for s in sites:
        t = tract_containing(tracts, s["lon"], s["lat"])
        if t:
            with_site.add(t["geoid"])
        else:
            outside.append(s)
    for t in tracts:
        clon, clat = t["centroid"]
        t["nearest_mi"] = min(haversine_mi(clon, clat, s["lon"], s["lat"]) for s in sites)
        t["needs_out"] = t["geoid"] not in with_site
    return outside


def classify_excluded_sites(data_dir, sites):
    """Group sites that are outside the analysis by the excluded layer (zero or low population) that holds them."""
    found = {}
    for layer, fname in EXCLUDED_FILES.items():
        path = os.path.join(data_dir, fname)
        if not os.path.exists(path):
            continue
        excluded_tracts = parse_tracts(path, None)
        for s in sites:
            t = tract_containing(excluded_tracts, s["lon"], s["lat"])
            if t:
                found.setdefault(layer, []).append({"site": s["name"], "geoid": t["geoid"]})
    return found


# ---------------------------------------------------------------- hypotheses


def poverty_class(p):
    return sum(1 for b in POVERTY_BREAKS if p >= b)


def count_table(tracts, group_fn, n_groups, outcome_fn):
    """Rows = groups, columns = [outcome yes, outcome no]."""
    table = [[0, 0] for _ in range(n_groups)]
    for t in tracts:
        g = group_fn(t)
        table[g][0 if outcome_fn(t) else 1] += 1
    return table


def rate_rows(table, labels):
    return [{"group": lab, "tracts": a + b, "outcome": a, "rate": a / (a + b) if a + b else None} for lab, (a, b) in zip(labels, table)]


def disparate_impact(table_2x2):
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


def hypothesis_result(name, question, table, labels, **extra):
    res = {"name": name, "question": question, "groups": rate_rows(table, labels), "chi_squared": chi_squared(table)}
    res.update(extra)
    return res


def supports_hypothesis(r):
    """True when the observed direction is the hypothesized one: higher poverty (or lower income) means more tracts without a site."""
    if "trend" in r:
        return r["trend"]["z"] > 0
    if "mantel_haenszel" in r:
        return r["mantel_haenszel"]["common_odds_ratio"] > 1
    high, lower = r["groups"]
    return high["rate"] > lower["rate"]


def run_hypotheses(tracts):
    pov = [t for t in tracts if t["poverty"] is not None]
    inc = [t for t in pov if t["income"] is not None]
    out = lambda t: t["needs_out"]
    hi = lambda t: 0 if t["poverty"] >= HIGH_POVERTY else 1
    hi_labels = [f"Poverty {HIGH_POVERTY:.0f}% and over", f"Poverty under {HIGH_POVERTY:.0f}%"]

    cls_table = count_table(pov, lambda t: poverty_class(t["poverty"]), len(POVERTY_LABELS), out)
    baseline = hypothesis_result(
        "H0 baseline",
        "Higher poverty tracts are more likely to have no poll site in the tract (so residents visit a site in a different tract).",
        cls_table,
        POVERTY_LABELS,
        trend=trend_test(cls_table),
    )
    base2 = count_table(pov, hi, 2, out)
    baseline["disparate_impact"] = disparate_impact(base2)

    related = []

    related.append(
        hypothesis_result(
            "H1 high vs lower poverty",
            f"Collapsing to two groups ({HIGH_POVERTY:.0f}% poverty cut), high poverty tracts lack an in-tract site more often.",
            base2,
            hi_labels,
            chi_squared_yates=chi_squared(base2, correction=True),
        )
    )

    strata, by_borough = [], []
    for b in BOROUGH_FILES:
        tb = count_table([t for t in pov if t["borough"] == b], hi, 2, out)
        strata.append(tb)
        by_borough.append({"borough": b, "groups": rate_rows(tb, hi_labels), "chi_squared": chi_squared(tb) if min(sum(r) for r in tb) else None})
    cmh = mantel_haenszel(strata)
    related.append(
        {
            "name": "H2 within borough",
            "question": "The H1 gap persists inside each borough (not an artifact of borough composition). Mantel-Haenszel across boroughs.",
            "by_borough": by_borough,
            "mantel_haenszel": cmh,
            "chi_squared": {"chi2": cmh["chi2"], "df": 1, "p": cmh["p"]},
        }
    )

    for hnum, miles in (("H3", 0.25), ("H4", 0.5), ("H5", 1.0)):
        table = count_table(pov, lambda t: poverty_class(t["poverty"]), len(POVERTY_LABELS), lambda t, m=miles: t["nearest_mi"] > m)
        related.append(
            hypothesis_result(
                f"{hnum} distance over {miles:g} mile",
                f"Higher poverty tracts have a centroid more than {miles:g} mile from the nearest poll site (a travel burden even when a site exists nearby).",
                table,
                POVERTY_LABELS,
                trend=trend_test(table),
            )
        )

    by_income = sorted(inc, key=lambda t: t["income"])
    # Row 0 is the highest income quintile, so rows run in order of increasing disadvantage like the poverty classes.
    quintile_row = {t["geoid"]: 4 - min(4, i * 5 // len(by_income)) for i, t in enumerate(by_income)}
    # Rows ordered by increasing disadvantage (highest income first), like poverty classes, so a positive trend supports the hypothesis.
    inc_labels = ["Income quintile 5 (highest)", "Income quintile 4", "Income quintile 3", "Income quintile 2", "Income quintile 1 (lowest)"]
    inc_table = count_table(inc, lambda t: quintile_row[t["geoid"]], 5, out)
    related.append(
        hypothesis_result(
            "H6 income instead of poverty",
            "Lower median household income tracts (quintiles) lack an in-tract site more often; tests whether the baseline depends on the poverty measure.",
            inc_table,
            inc_labels,
            trend=trend_test(inc_table),
        )
    )

    for r in [baseline] + related:
        r["direction_supports_hypothesis"] = supports_hypothesis(r)
    adj = holm([r["chi_squared"]["p"] for r in related])
    for r, a in zip(related, adj):
        r["holm_p"] = a
        r["significant_after_holm"] = a < ALPHA
    return baseline, related


# -------------------------------------------------------------------- report


def fmt_p(p):
    return "<0.0001" if p < 1e-4 else f"{p:.4f}"


def direction(r):
    return "as hypothesized" if r["direction_supports_hypothesis"] else "opposite"


def executive_summary(report):
    b = report["baseline"]
    di = b["disparate_impact"]
    c = b["chi_squared"]
    first, last = b["groups"][0], b["groups"][-1]
    supported = b["direction_supports_hypothesis"] and b["trend"]["p_one_sided"] < ALPHA
    rel = {r["name"].split()[0]: r for r in report["related"]}
    opposite = [k for k, r in rel.items() if not r["direction_supports_hypothesis"] and r["significant_after_holm"]]
    toward = [k for k, r in rel.items() if r["direction_supports_hypothesis"] and r["significant_after_holm"]]
    manhattan = next(bb for bb in rel["H2"]["by_borough"] if bb["borough"] == "Manhattan")
    mh, ml = manhattan["groups"]
    verdict = (
        "The baseline hypothesis is supported: higher poverty tracts are more likely to have no poll site inside the tract."
        if supported
        else "The baseline hypothesis is not supported: higher poverty tracts are not more likely to have no poll site inside the tract."
        + (" The association runs the opposite way." if not b["direction_supports_hypothesis"] and c["p"] < ALPHA else "")
    )
    L = [
        "## Executive summary",
        "",
        f"**Question.** Are higher poverty NYC census tracts more likely to have no early voting poll site inside the tract, so that residents must visit a site in a different tract? ({report['tracts_analyzed']} tracts, {report['poll_sites']} poll sites.)",
        "",
        f"**Answer.** {verdict}",
        "",
        f"- Across the five poverty classes, {first['rate']:.1%} of {first['group'].lower()} tracts lack an in-tract site, against {last['rate']:.1%} of {last['group'].lower()} tracts. "
        f"Chi-squared = {c['chi2']:.2f}, p = {fmt_p(c['p'])}, but the effect is small (Cramér's V = {c['cramers_v']:.3f}) and the trend test points the other direction (one-sided p = {fmt_p(b['trend']['p_one_sided'])}).",
        f"- Disparate impact: tracts at {HIGH_POVERTY:.0f}% poverty or above have an in-tract site {di['favorable_rate_high']:.1%} of the time, tracts below that {di['favorable_rate_lower']:.1%}. "
        f"The impact ratio is {di['impact_ratio']:.2f}, which {'fails' if di['fails_four_fifths'] else 'passes'} the four-fifths rule.",
        "- Most tracts of every kind lack an in-tract site. The overall rate is "
        f"{1 - report['tracts_with_site'] / report['tracts_analyzed']:.1%}, so a visit to another tract is the norm, not a burden that falls on poor tracts.",
        f"- Related tests that are significant after Holm correction and contradict the hypothesis: {', '.join(opposite) or 'none'}. Significant and consistent with it: {', '.join(toward) or 'none'}.",
        "- Distance (H3 to H5, centroid to nearest site at a quarter, half, and one mile): higher poverty tracts are "
        + ("farther from" if rel["H3"]["direction_supports_hypothesis"] else "closer to")
        + " a poll site than lower poverty tracts.",
        f"- By borough, Manhattan shows the largest gap: {mh['rate']:.1%} of high poverty tracts lack an in-tract site against {ml['rate']:.1%} of lower poverty tracts"
        + (f" (p = {fmt_p(manhattan['chi_squared']['p'])})" if manhattan["chi_squared"] else "")
        + "; no other borough differs significantly on its own.",
        "",
        "**Caution.** Tract containment is a proxy for the real assignment (election districts). Neighboring tracts are not independent, so p-values are probably too small. See Limits.",
        "",
    ]
    return L


def excluded_sites_text(report):
    ex = report["sites_in_excluded_layers"]
    parts = [f"{len(v)} in {k} tracts" for k, v in ex.items()]
    left = report["poll_sites_outside_tracts"]
    if left:
        parts.append(f"{left} in no tract")
    return ", ".join(parts) + "; none of these serve an analyzed tract" if parts else "all inside analyzed tracts"


def render_md(report):
    b = report["baseline"]
    L = [
        "# NYC poll site disparate impact tests",
        "",
        *executive_summary(report),
        f"Tracts analyzed: {report['tracts_analyzed']} with a poverty rate ({report['tracts_with_income']} also with median income). "
        f"Poll sites: {report['poll_sites']} ({excluded_sites_text(report)}). "
        f"Tracts with a site inside: {report['tracts_with_site']}. Outcome: no poll site inside the tract, so voters visit a site in a different tract.",
        "",
        "## " + b["name"],
        "",
        b["question"],
        "",
        "| Poverty class | Tracts | No site in tract | Rate |",
        "|---|---:|---:|---:|",
    ]
    L += [f"| {g['group']} | {g['tracts']} | {g['outcome']} | {g['rate']:.1%} |" for g in b["groups"]]
    c, tr, di = b["chi_squared"], b["trend"], b["disparate_impact"]
    L += [
        "",
        "### H0' (complement): tracts with a poll site inside",
        "",
        "| Poverty class | Tracts | Has site in tract | Rate |",
        "|---|---:|---:|---:|",
    ]
    L += [f"| {g['group']} | {g['tracts']} | {g['tracts'] - g['outcome']} | {1 - g['rate']:.1%} |" for g in b["groups"]]
    L += [
        "",
        f"Verdict: direction {direction(b)}. A significant chi-squared only shows association; it supports the hypothesis only when the direction matches.",
        f"Chi-squared = {c['chi2']:.2f}, df = {c['df']}, p = {fmt_p(c['p'])}, Cramér's V = {c['cramers_v']:.3f} (minimum expected count {c['min_expected']:.1f}).",
        f"Cochran-Armitage trend (higher poverty, more out-of-tract): z = {tr['z']:.2f}, one-sided p = {fmt_p(tr['p_one_sided'])}.",
        f"Disparate impact, poverty {HIGH_POVERTY:.0f}% and over vs under: in-tract site rate {di['favorable_rate_high']:.1%} vs {di['favorable_rate_lower']:.1%}, "
        f"impact ratio {di['impact_ratio']:.2f} ({'fails' if di['fails_four_fifths'] else 'passes'} the four-fifths rule), "
        f"out-of-tract risk ratio {di['risk_ratio_out_of_tract']:.2f}.",
        "",
        "## Related hypotheses",
        "",
        f"Holm correction over {len(report['related'])} tests, alpha = {ALPHA}.",
        "",
        "| Hypothesis | Chi-squared | df | p | Holm p | Significant | Direction |",
        "|---|---:|---:|---:|---:|---|---|",
    ]
    for r in report["related"]:
        c = r["chi_squared"]
        L.append(f"| {r['name']} | {c['chi2']:.2f} | {c['df']} | {fmt_p(c['p'])} | {fmt_p(r['holm_p'])} | {'yes' if r['significant_after_holm'] else 'no'} | {direction(r)} |")
    for r in report["related"]:
        L += ["", f"### {r['name']}", "", r["question"], ""]
        if "groups" in r:
            L += ["| Group | Tracts | Outcome | Rate |", "|---|---:|---:|---:|"]
            L += [f"| {g['group']} | {g['tracts']} | {g['outcome']} | {g['rate']:.1%} |" for g in r["groups"]]
        if "trend" in r:
            L += ["", f"Trend z = {r['trend']['z']:.2f}, one-sided p = {fmt_p(r['trend']['p_one_sided'])}."]
        if "chi_squared_yates" in r:
            L += ["", f"With continuity correction: chi-squared = {r['chi_squared_yates']['chi2']:.2f}, p = {fmt_p(r['chi_squared_yates']['p'])}."]
        if "by_borough" in r:
            L += ["| Borough | High-poverty rate | Lower-poverty rate | p |", "|---|---:|---:|---:|"]
            for bb in r["by_borough"]:
                hi_g, lo_g = bb["groups"]
                p = fmt_p(bb["chi_squared"]["p"]) if bb["chi_squared"] else "n/a"
                f = lambda g: f"{g['rate']:.1%} ({g['outcome']}/{g['tracts']})" if g["tracts"] else "n/a"
                L.append(f"| {bb['borough']} | {f(hi_g)} | {f(lo_g)} | {p} |")
            m = r["mantel_haenszel"]
            L += ["", f"Mantel-Haenszel common odds ratio of no in-tract site (high vs lower poverty) = {m['common_odds_ratio']:.2f}, chi-squared = {m['chi2']:.2f}, p = {fmt_p(m['p'])}."]
    L += [
        "",
        "## Limits",
        "",
        "- Voters are assigned to sites by election district, not tract. Tract containment is a proxy for a short, local trip.",
        "- 146 of 157 poll sites were located by the Google Geocoding API from their addresses (see nyc_tracts_poll_sites.report.json). A site placed on the wrong parcel can land in a neighboring tract.",
        "- Sites inside zero or low population tracts are outside the analysis; they do not serve an analyzed tract. A site in a low population tract is a site a nearby analyzed tract may visit, which the in-tract outcome counts as out-of-tract.",
        "- Poverty rates are ACS 5-year estimates with margins of error; tracts near a class boundary can be misclassified.",
        "- Tracts are not independent (neighbors share sites), so p-values are likely too small. Read effect sizes alongside them.",
        "- The poll site list is early voting only; Election Day sites differ.",
        "",
    ]
    return "\n".join(L)


def analyze(data_dir):
    tracts, sites = load(data_dir)
    outside = assign_sites(tracts, sites)
    excluded = classify_excluded_sites(data_dir, outside)
    outside = [s for s in outside if s["name"] not in {e["site"] for v in excluded.values() for e in v}]
    baseline, related = run_hypotheses(tracts)
    pov = [t for t in tracts if t["poverty"] is not None]
    return {
        "tracts_loaded": len(tracts),
        "tracts_analyzed": len(pov),
        "tracts_with_income": sum(1 for t in pov if t["income"] is not None),
        "poll_sites": len(sites),
        "poll_sites_outside_tracts": len(outside),
        "sites_in_excluded_layers": excluded,
        "outside_sites": [s["name"] for s in outside],
        "tracts_with_site": sum(1 for t in pov if not t["needs_out"]),
        "baseline": baseline,
        "related": related,
    }


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--data-dir", default=os.path.join(here, "..", "..", "public", "nyc_polling"))
    ap.add_argument("--out-dir", default=here)
    args = ap.parse_args()
    report = analyze(args.data_dir)
    with open(os.path.join(args.out_dir, "nyc_tracts_poll_disparity.report.json"), "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)
    md = render_md(report)
    with open(os.path.join(args.out_dir, "nyc_tracts_poll_disparity.report.md"), "w", encoding="utf-8") as fh:
        fh.write(md)
    print(md)


if __name__ == "__main__":
    main()

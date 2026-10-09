# NYC poll site disparate impact tests

## Executive summary

**Question.** Are higher poverty NYC census tracts more likely to have no early voting poll site inside the tract, so that residents must visit a site in a different tract? (2158 tracts, 157 poll sites.)

**Answer.** The baseline hypothesis is not supported: higher poverty tracts are not more likely to have no poll site inside the tract. The association runs the opposite way.

- Across the five poverty classes, 94.7% of under 10% tracts lack an in-tract site, against 93.8% of 40% and over tracts. Chi-squared = 11.04, p = 0.0262, but the effect is small (Cramér's V = 0.072) and the trend test points the other direction (one-sided p = 0.9918).
- Disparate impact: tracts at 20% poverty or above have an in-tract site 8.6% of the time, tracts below that 5.8%. The impact ratio is 1.49, which passes the four-fifths rule.
- Most tracts of every kind lack an in-tract site. The overall rate is 93.3%, so a visit to another tract is the norm, not a burden that falls on poor tracts.
- Related tests that are significant after Holm correction and contradict the hypothesis: H1, H3, H4, H5. Significant and consistent with it: none.
- Distance (H3 to H5, centroid to nearest site at a quarter, half, and one mile): higher poverty tracts are closer to a poll site than lower poverty tracts.
- By borough, Manhattan shows the largest gap: 81.8% of high poverty tracts lack an in-tract site against 92.8% of lower poverty tracts (p = 0.0065); no other borough differs significantly on its own.

**Caution.** Tract containment is a proxy for the real assignment (election districts). Neighboring tracts are not independent, so p-values are probably too small. See Limits.

Tracts analyzed: 2158 with a poverty rate (2143 also with median income). Poll sites: 157 (6 in zero population tracts, 5 in low population tracts; none of these serve an analyzed tract). Tracts with a site inside: 144. Outcome: no poll site inside the tract, so voters visit a site in a different tract.

## H0 baseline

Higher poverty tracts are more likely to have no poll site in the tract (so residents visit a site in a different tract).

| Poverty class | Tracts | No site in tract | Rate |
|---|---:|---:|---:|
| Under 10% | 694 | 657 | 94.7% |
| 10% to 20% | 777 | 729 | 93.8% |
| 20% to 30% | 369 | 341 | 92.4% |
| 30% to 40% | 206 | 182 | 88.3% |
| 40% and over | 112 | 105 | 93.8% |

### H0' (complement): tracts with a poll site inside

| Poverty class | Tracts | Has site in tract | Rate |
|---|---:|---:|---:|
| Under 10% | 694 | 37 | 5.3% |
| 10% to 20% | 777 | 48 | 6.2% |
| 20% to 30% | 369 | 28 | 7.6% |
| 30% to 40% | 206 | 24 | 11.7% |
| 40% and over | 112 | 7 | 6.2% |

Verdict: direction opposite. A significant chi-squared only shows association; it supports the hypothesis only when the direction matches.
Chi-squared = 11.04, df = 4, p = 0.0262, Cramér's V = 0.072 (minimum expected count 7.5).
Cochran-Armitage trend (higher poverty, more out-of-tract): z = -2.40, one-sided p = 0.9918.
Disparate impact, poverty 20% and over vs under: in-tract site rate 8.6% vs 5.8%, impact ratio 1.49 (passes the four-fifths rule), out-of-tract risk ratio 0.97.

## Related hypotheses

Holm correction over 6 tests, alpha = 0.05.

| Hypothesis | Chi-squared | df | p | Holm p | Significant | Direction |
|---|---:|---:|---:|---:|---|---|
| H1 high vs lower poverty | 5.94 | 1 | 0.0148 | 0.0445 | yes | opposite |
| H2 within borough | 4.79 | 1 | 0.0286 | 0.0571 | no | opposite |
| H3 distance over 0.25 mile | 19.24 | 4 | 0.0007 | 0.0028 | yes | opposite |
| H4 distance over 0.5 mile | 55.05 | 4 | <0.0001 | <0.0001 | yes | opposite |
| H5 distance over 1 mile | 39.38 | 4 | <0.0001 | <0.0001 | yes | opposite |
| H6 income instead of poverty | 8.69 | 4 | 0.0693 | 0.0693 | no | opposite |

### H1 high vs lower poverty

Collapsing to two groups (20% poverty cut), high poverty tracts lack an in-tract site more often.

| Group | Tracts | Outcome | Rate |
|---|---:|---:|---:|
| Poverty 20% and over | 687 | 628 | 91.4% |
| Poverty under 20% | 1471 | 1386 | 94.2% |

With continuity correction: chi-squared = 5.49, p = 0.0191.

### H2 within borough

The H1 gap persists inside each borough (not an artifact of borough composition). Mantel-Haenszel across boroughs.

| Borough | High-poverty rate | Lower-poverty rate | p |
|---|---:|---:|---:|
| Bronx | 91.7% (198/216) | 94.1% (112/119) | 0.4139 |
| Brooklyn | 93.0% (264/284) | 94.5% (449/475) | 0.3808 |
| Manhattan | 81.8% (63/77) | 92.8% (193/208) | 0.0065 |
| Queens | 93.5% (87/93) | 95.4% (544/570) | 0.4303 |
| Staten Island | 94.1% (16/17) | 88.9% (88/99) | 0.5131 |

Mantel-Haenszel common odds ratio of no in-tract site (high vs lower poverty) = 0.65, chi-squared = 4.79, p = 0.0286.

### H3 distance over 0.25 mile

Higher poverty tracts have a centroid more than 0.25 mile from the nearest poll site (a travel burden even when a site exists nearby).

| Group | Tracts | Outcome | Rate |
|---|---:|---:|---:|
| Under 10% | 694 | 600 | 86.5% |
| 10% to 20% | 777 | 666 | 85.7% |
| 20% to 30% | 369 | 299 | 81.0% |
| 30% to 40% | 206 | 155 | 75.2% |
| 40% and over | 112 | 92 | 82.1% |

Trend z = -3.61, one-sided p = 0.9998.

### H4 distance over 0.5 mile

Higher poverty tracts have a centroid more than 0.5 mile from the nearest poll site (a travel burden even when a site exists nearby).

| Group | Tracts | Outcome | Rate |
|---|---:|---:|---:|
| Under 10% | 694 | 386 | 55.6% |
| 10% to 20% | 777 | 416 | 53.5% |
| 20% to 30% | 369 | 150 | 40.7% |
| 30% to 40% | 206 | 65 | 31.6% |
| 40% and over | 112 | 49 | 43.8% |

Trend z = -6.33, one-sided p = 1.0000.

### H5 distance over 1 mile

Higher poverty tracts have a centroid more than 1 mile from the nearest poll site (a travel burden even when a site exists nearby).

| Group | Tracts | Outcome | Rate |
|---|---:|---:|---:|
| Under 10% | 694 | 88 | 12.7% |
| 10% to 20% | 777 | 77 | 9.9% |
| 20% to 30% | 369 | 15 | 4.1% |
| 30% to 40% | 206 | 4 | 1.9% |
| 40% and over | 112 | 5 | 4.5% |

Trend z = -5.81, one-sided p = 1.0000.

### H6 income instead of poverty

Lower median household income tracts (quintiles) lack an in-tract site more often; tests whether the baseline depends on the poverty measure.

| Group | Tracts | Outcome | Rate |
|---|---:|---:|---:|
| Income quintile 5 (highest) | 428 | 403 | 94.2% |
| Income quintile 4 | 429 | 400 | 93.2% |
| Income quintile 3 | 428 | 404 | 94.4% |
| Income quintile 2 | 429 | 405 | 94.4% |
| Income quintile 1 (lowest) | 429 | 387 | 90.2% |

Trend z = -1.76, one-sided p = 0.9609.

## Limits

- Voters are assigned to sites by election district, not tract. Tract containment is a proxy for a short, local trip.
- 146 of 157 poll sites were located by the Google Geocoding API from their addresses (see nyc_tracts_poll_sites.report.json). A site placed on the wrong parcel can land in a neighboring tract.
- Sites inside zero or low population tracts are outside the analysis; they do not serve an analyzed tract. A site in a low population tract is a site a nearby analyzed tract may visit, which the in-tract outcome counts as out-of-tract.
- Poverty rates are ACS 5-year estimates with margins of error; tracts near a class boundary can be misclassified.
- Tracts are not independent (neighbors share sites), so p-values are likely too small. Read effect sizes alongside them.
- The poll site list is early voting only; Election Day sites differ.

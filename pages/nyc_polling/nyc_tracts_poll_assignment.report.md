# NYC early voting site distance disparate impact tests, by tract and election district subdivision

## Executive summary

**Question.** Are higher poverty parts of NYC more likely to be assigned, by election district, to an early voting site more than a quarter mile away? The unit is a subdivision, the overlap of one tract with one election district, which keeps its tract's poverty rate. (7748 subdivisions from 2158 tracts, 157 early voting sites.)

**Answer.** The baseline hypothesis is not supported: higher poverty subdivisions are not more likely to be assigned to a site more than a quarter mile away. The association runs the opposite way.

- Across the five poverty classes, 85.7% of under 10% subdivisions are assigned to a site over a quarter mile away, against 85.2% of 40% and over subdivisions. Chi-squared = 50.00, p = <0.0001, Cramér's V = 0.080, trend test one-sided p = 1.0000.
- Disparate impact: subdivisions at 20% poverty or above are assigned to a site within a quarter mile 19.1% of the time, those below that 14.1%. The impact ratio is 1.36, which passes the four-fifths rule.
- Most subdivisions of every kind are more than a quarter mile from their assigned site. The overall rate is 84.3%.
- Related tests that are significant after Holm correction and contradict the hypothesis: H1, H2, H3, H4, H5, H6. Significant and consistent with it: none.
- Distance (H3 and H4, centroid to the assigned site at a half and one mile): higher poverty subdivisions are assigned to sites closer than lower poverty subdivisions. H5 repeats the test for an assigned site in a different tract.

**Caution.** Neighboring subdivisions are not independent, and subdivisions of one tract share a poverty rate, so p-values are probably too small. Subdivisions are counted equally whatever their size or population. See Limits.

Subdivisions analyzed: 7748 with a poverty rate (7708 also with median income), from 2158 tracts. 2077 tracts span more than one election district and are split; the rest are one subdivision. 0 tracts overlap no election district. Overlaps narrower than 10 meters, where tract and district boundaries disagree, are dropped: 3800 slivers, 0.1% of the overlap area. 11 of the 157 assigned sites lie outside every analyzed tract.

## H0 baseline

Higher poverty subdivisions are more likely to be assigned, by election district, to an early voting site more than a quarter mile away (from the subdivision's centroid).

| Poverty class | Subdivisions | Over a quarter mile | Rate |
|---|---:|---:|---:|
| Under 10% | 2478 | 2124 | 85.7% |
| 10% to 20% | 2784 | 2395 | 86.0% |
| 20% to 30% | 1319 | 1083 | 82.1% |
| 30% to 40% | 782 | 599 | 76.6% |
| 40% and over | 385 | 328 | 85.2% |

### Over a quarter, half, and one mile

| Poverty class | Subdivisions | Over 1/4 mile | Over 1/2 mile | Over 1 mile |
|---|---:|---:|---:|---:|
| Under 10% | 2478 | 85.7% | 55.6% | 18.0% |
| 10% to 20% | 2784 | 86.0% | 56.1% | 13.9% |
| 20% to 30% | 1319 | 82.1% | 46.7% | 8.0% |
| 30% to 40% | 782 | 76.6% | 38.5% | 4.2% |
| 40% and over | 385 | 85.2% | 56.6% | 9.9% |

### H0' (complement): subdivisions within a quarter mile of their assigned site

| Poverty class | Subdivisions | Within a quarter mile | Rate |
|---|---:|---:|---:|
| Under 10% | 2478 | 354 | 14.3% |
| 10% to 20% | 2784 | 389 | 14.0% |
| 20% to 30% | 1319 | 236 | 17.9% |
| 30% to 40% | 782 | 183 | 23.4% |
| 40% and over | 385 | 57 | 14.8% |

### Share of area over a quarter mile from the assigned site

| Poverty class | Subdivisions | Share of area |
|---|---:|---:|
| Under 10% | 2478 | 92.0% |
| 10% to 20% | 2784 | 88.5% |
| 20% to 30% | 1319 | 85.0% |
| 30% to 40% | 782 | 78.3% |
| 40% and over | 385 | 87.2% |

Verdict: direction opposite.
Chi-squared = 50.00, df = 4, p = <0.0001, Cramér's V = 0.080 (minimum expected count 60.6).
Cochran-Armitage trend (higher poverty, more over a quarter mile): z = -4.75, one-sided p = 1.0000.
Disparate impact, poverty 20% and over vs under: within-a-quarter-mile rate 19.1% vs 14.1%, impact ratio 1.36 (passes the four-fifths rule), over-a-quarter-mile risk ratio 0.94.

## Related hypotheses

Holm correction over 6 tests, alpha = 0.05.

| Hypothesis | Chi-squared | df | p | Holm p | Significant | Direction |
|---|---:|---:|---:|---:|---|---|
| H1 high vs lower poverty | 32.18 | 1 | <0.0001 | <0.0001 | yes | opposite |
| H2 within borough | 13.14 | 1 | 0.0003 | 0.0003 | yes | opposite |
| H3 distance over 0.5 mile | 106.60 | 4 | <0.0001 | <0.0001 | yes | opposite |
| H4 distance over 1 mile | 141.80 | 4 | <0.0001 | <0.0001 | yes | opposite |
| H5 out of tract | 42.56 | 4 | <0.0001 | <0.0001 | yes | opposite |
| H6 income instead of poverty | 67.25 | 4 | <0.0001 | <0.0001 | yes | opposite |

### H1 high vs lower poverty

Collapsing to two groups (20% poverty cut), high poverty subdivisions are assigned to a site more than a quarter mile away more often.

| Group | Subdivisions | Outcome | Rate |
|---|---:|---:|---:|
| Poverty 20% and over | 2486 | 2010 | 80.9% |
| Poverty under 20% | 5262 | 4519 | 85.9% |


### H2 within borough

The H1 gap persists inside each borough (not an artifact of borough composition). Mantel-Haenszel across boroughs.

| Borough | High-poverty rate | Lower-poverty rate | p |
|---|---:|---:|---:|
| Bronx | 82.2% (620/754) | 84.1% (355/422) | 0.4076 |
| Brooklyn | 81.6% (816/1000) | 85.1% (1420/1668) | 0.0165 |
| Manhattan | 64.7% (225/348) | 73.3% (669/913) | 0.0026 |
| Queens | 91.2% (301/330) | 91.3% (1688/1848) | 0.9385 |
| Staten Island | 88.9% (48/54) | 94.2% (387/411) | 0.1382 |

Mantel-Haenszel common odds ratio of an assigned site over a quarter mile away (high vs lower poverty) = 0.78, chi-squared = 13.14, p = 0.0003.

### H3 distance over 0.5 mile

Higher poverty subdivisions are assigned to a site more than 0.5 mile away (from the subdivision's centroid).

| Group | Subdivisions | Outcome | Rate |
|---|---:|---:|---:|
| Under 10% | 2478 | 1379 | 55.6% |
| 10% to 20% | 2784 | 1563 | 56.1% |
| 20% to 30% | 1319 | 616 | 46.7% |
| 30% to 40% | 782 | 301 | 38.5% |
| 40% and over | 385 | 218 | 56.6% |


Trend z = -6.54, one-sided p = 1.0000.

### H4 distance over 1 mile

Higher poverty subdivisions are assigned to a site more than 1 mile away (from the subdivision's centroid).

| Group | Subdivisions | Outcome | Rate |
|---|---:|---:|---:|
| Under 10% | 2478 | 446 | 18.0% |
| 10% to 20% | 2784 | 388 | 13.9% |
| 20% to 30% | 1319 | 106 | 8.0% |
| 30% to 40% | 782 | 33 | 4.2% |
| 40% and over | 385 | 38 | 9.9% |


Trend z = -10.75, one-sided p = 1.0000.

### H5 out of tract

Higher poverty subdivisions are more likely to be assigned to an early voting site in a different tract (the in-tract test).

| Group | Subdivisions | Outcome | Rate |
|---|---:|---:|---:|
| Under 10% | 2478 | 2333 | 94.1% |
| 10% to 20% | 2784 | 2614 | 93.9% |
| 20% to 30% | 1319 | 1219 | 92.4% |
| 30% to 40% | 782 | 688 | 88.0% |
| 40% and over | 385 | 366 | 95.1% |


Trend z = -3.70, one-sided p = 0.9999.

### H6 income instead of poverty

Lower median household income subdivisions (quintiles) are assigned to a site more than a quarter mile away more often; tests whether the baseline depends on the poverty measure.

| Group | Subdivisions | Outcome | Rate |
|---|---:|---:|---:|
| Income quintile 5 (highest) | 1541 | 1269 | 82.3% |
| Income quintile 4 | 1542 | 1373 | 89.0% |
| Income quintile 3 | 1541 | 1321 | 85.7% |
| Income quintile 2 | 1542 | 1313 | 85.1% |
| Income quintile 1 (lowest) | 1542 | 1217 | 78.9% |


Trend z = -3.66, one-sided p = 0.9999.

## Limits

- Assignments come from the BOE early voting poll site list PDFs for the 2026 General Election ("subject to change"), joined to DCP election district polygons (shoreline clipped) by AD * 1000 + ED.
- Distance is from the subdivision's centroid to its assigned site in a straight line, not a walking route. A quarter mile is a rule of thumb for limited mobility.
- Tracts and election districts do not nest, so a tract spanning districts is split. Each piece keeps the whole tract's poverty rate and income, which assumes the rate holds on both sides of the split. Pieces are counted equally; they differ in area and population.
- Early voting sites were located with the Google Geocoding API from their addresses. A site placed on the wrong parcel can change which tract it sits in.
- Poverty rates are ACS 5-year estimates with margins of error; tracts near a class boundary can be misclassified.
- Subdivisions are not independent (neighbors share sites and pieces of a tract share a poverty rate), so p-values are likely too small. Read effect sizes alongside them.

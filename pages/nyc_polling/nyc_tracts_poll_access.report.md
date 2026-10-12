# Do higher poverty parts of NYC have differential access to early voting sites?

## Executive summary

**Question.** Are higher poverty parts of NYC more likely to be assigned, by election district, to an early voting site that is harder to reach? The unit is a tract district, the overlap of one tract with one election district, which keeps its tract's poverty rate. (7748 tract districts from 2158 tracts, 157 early voting sites.) Access is measured 4 ways: "site in another tract", "over 1/4 mile", "over 1/2 mile", "over 1 mile". These are variants of one question, not separate studies.

**Answer.** Not on the primary measure (over 1/4 mile): higher poverty tract districts are not more likely to be assigned to a site more than a quarter mile away. The association runs the opposite way.
- Primary measure, across the five poverty classes: 85.7% of under 10% tract districts are assigned to a site more than a quarter mile away, against 85.2% of 40% and over tract districts. Chi-squared = 50.00, p = <0.0001, Cramér's V = 0.080, trend test one-sided p = 1.0000.
- Disparate impact: tract districts at 20% poverty or above avoid that outcome 19.1% of the time, those below 14.1%. The impact ratio is 1.36, which passes the four-fifths rule.
- Overall, 93.2% of tract districts have "site in another tract", 84.3% of tract districts have "over 1/4 mile", 52.6% of tract districts have "over 1/2 mile", 13.0% of tract districts have "over 1 mile".
- Of the other 15 tests (Holm corrected together), 0 are significant and consistent with the hypothesis, 15 are significant and contradict it, and 0 are not significant. See All other tests.

**Caution.** Neighboring tract districts are not independent, and tract districts of one tract share a poverty rate, so p-values are probably too small. Tract districts are counted equally whatever their size or population. See Limits.

## Access by poverty class

Share of tract districts with each adverse outcome.

| Poverty class | Tract districts | Site in another tract | Over 1/4 mile | Over 1/2 mile | Over 1 mile |
|---|---:|---:|---:|---:|---:|
| Under 10% | 2478 | 94.1% | 85.7% | 55.6% | 18.0% |
| 10% to 20% | 2784 | 93.9% | 86.0% | 56.1% | 13.9% |
| 20% to 30% | 1319 | 92.4% | 82.1% | 46.7% | 8.0% |
| 30% to 40% | 782 | 88.0% | 76.6% | 38.5% | 4.2% |
| 40% and over | 385 | 95.1% | 85.2% | 56.6% | 9.9% |

Share of area with each adverse outcome.

| Poverty class | Tract districts | Site in another tract | Over 1/4 mile | Over 1/2 mile | Over 1 mile |
|---|---:|---:|---:|---:|---:|
| Under 10% | 2478 | 92.2% | 92.0% | 72.4% | 36.1% |
| 10% to 20% | 2784 | 91.9% | 88.5% | 63.7% | 22.5% |
| 20% to 30% | 1319 | 92.5% | 85.0% | 55.3% | 17.1% |
| 30% to 40% | 782 | 82.3% | 78.3% | 43.1% | 5.4% |
| 40% and over | 385 | 95.2% | 87.2% | 65.2% | 23.1% |

## Primary test: Poverty gradient: Over 1/4 mile

Are higher poverty tract districts more likely to be assigned to a site more than a quarter mile away?

| Poverty class | Tract districts | Adverse | Rate |
|---|---:|---:|---:|
| Under 10% | 2478 | 2124 | 85.7% |
| 10% to 20% | 2784 | 2395 | 86.0% |
| 20% to 30% | 1319 | 1083 | 82.1% |
| 30% to 40% | 782 | 599 | 76.6% |
| 40% and over | 385 | 328 | 85.2% |

Verdict: direction opposite.
Chi-squared = 50.00, df = 4, p = <0.0001, Cramér's V = 0.080 (minimum expected count 60.6).
Cochran-Armitage trend (higher poverty, more adverse): z = -4.75, one-sided p = 1.0000.
Disparate impact, poverty 20% and over vs under: favorable rate 19.1% vs 14.1%, impact ratio 1.36 (passes the four-fifths rule), adverse risk ratio 0.94.

## All other tests

Holm correction over 15 tests, alpha = 0.05. The tests are one battery run on every access measure.

| Test | Chi-squared | df | p | Holm p | Significant | Direction |
|---|---:|---:|---:|---:|---|---|
| Poverty gradient: Site in another tract | 42.56 | 4 | <0.0001 | <0.0001 | yes | opposite |
| High vs lower poverty: Site in another tract | 17.72 | 1 | <0.0001 | <0.0001 | yes | opposite |
| Within borough: Site in another tract | 18.69 | 1 | <0.0001 | <0.0001 | yes | opposite |
| Income quintiles: Site in another tract | 20.90 | 4 | 0.0003 | 0.0006 | yes | opposite |
| High vs lower poverty: Over 1/4 mile | 32.18 | 1 | <0.0001 | <0.0001 | yes | opposite |
| Within borough: Over 1/4 mile | 13.14 | 1 | 0.0003 | 0.0006 | yes | opposite |
| Income quintiles: Over 1/4 mile | 67.25 | 4 | <0.0001 | <0.0001 | yes | opposite |
| Poverty gradient: Over 1/2 mile | 106.60 | 4 | <0.0001 | <0.0001 | yes | opposite |
| High vs lower poverty: Over 1/2 mile | 71.21 | 1 | <0.0001 | <0.0001 | yes | opposite |
| Within borough: Over 1/2 mile | 23.69 | 1 | <0.0001 | <0.0001 | yes | opposite |
| Income quintiles: Over 1/2 mile | 196.99 | 4 | <0.0001 | <0.0001 | yes | opposite |
| Poverty gradient: Over 1 mile | 141.80 | 4 | <0.0001 | <0.0001 | yes | opposite |
| High vs lower poverty: Over 1 mile | 113.40 | 1 | <0.0001 | <0.0001 | yes | opposite |
| Within borough: Over 1 mile | 33.86 | 1 | <0.0001 | <0.0001 | yes | opposite |
| Income quintiles: Over 1 mile | 189.25 | 4 | <0.0001 | <0.0001 | yes | opposite |

### Poverty gradient: Site in another tract

Are higher poverty tract districts more likely to be assigned to a site outside their own tract?

| Group | Tract districts | Adverse | Rate |
|---|---:|---:|---:|
| Under 10% | 2478 | 2333 | 94.1% |
| 10% to 20% | 2784 | 2614 | 93.9% |
| 20% to 30% | 1319 | 1219 | 92.4% |
| 30% to 40% | 782 | 688 | 88.0% |
| 40% and over | 385 | 366 | 95.1% |

Trend z = -3.70, one-sided p = 0.9999.

### High vs lower poverty: Site in another tract

Collapsing to two groups (20% poverty cut), are high poverty tract districts more likely to be assigned to a site outside their own tract?

| Group | Tract districts | Adverse | Rate |
|---|---:|---:|---:|
| Poverty 20% and over | 2486 | 2273 | 91.4% |
| Poverty under 20% | 5262 | 4947 | 94.0% |


### Within borough: Site in another tract

Does the high against lower poverty gap in being assigned to a site outside their own tract persist inside each borough, so it is not an artifact of borough composition? Mantel-Haenszel across boroughs.

| Borough | High-poverty rate | Lower-poverty rate | p |
|---|---:|---:|---:|
| Bronx | 91.9% (693/754) | 92.9% (392/422) | 0.5458 |
| Brooklyn | 93.3% (933/1000) | 95.2% (1588/1668) | 0.0370 |
| Manhattan | 84.8% (295/348) | 92.6% (845/913) | <0.0001 |
| Queens | 91.2% (301/330) | 94.9% (1754/1848) | 0.0073 |
| Staten Island | 94.4% (51/54) | 89.5% (368/411) | 0.2562 |

Mantel-Haenszel common odds ratio of the adverse outcome (high vs lower poverty) = 0.65, chi-squared = 18.69, p = <0.0001.

### Income quintiles: Site in another tract

Are lower median household income tract districts (quintiles) more likely to be assigned to a site outside their own tract? Tests whether the result depends on the poverty measure.

| Group | Tract districts | Adverse | Rate |
|---|---:|---:|---:|
| Income quintile 5 (highest) | 1541 | 1453 | 94.3% |
| Income quintile 4 | 1542 | 1433 | 92.9% |
| Income quintile 3 | 1541 | 1453 | 94.3% |
| Income quintile 2 | 1542 | 1442 | 93.5% |
| Income quintile 1 (lowest) | 1542 | 1399 | 90.7% |

Trend z = -3.22, one-sided p = 0.9993.

### High vs lower poverty: Over 1/4 mile

Collapsing to two groups (20% poverty cut), are high poverty tract districts more likely to be assigned to a site more than a quarter mile away?

| Group | Tract districts | Adverse | Rate |
|---|---:|---:|---:|
| Poverty 20% and over | 2486 | 2010 | 80.9% |
| Poverty under 20% | 5262 | 4519 | 85.9% |


### Within borough: Over 1/4 mile

Does the high against lower poverty gap in being assigned to a site more than a quarter mile away persist inside each borough, so it is not an artifact of borough composition? Mantel-Haenszel across boroughs.

| Borough | High-poverty rate | Lower-poverty rate | p |
|---|---:|---:|---:|
| Bronx | 82.2% (620/754) | 84.1% (355/422) | 0.4076 |
| Brooklyn | 81.6% (816/1000) | 85.1% (1420/1668) | 0.0165 |
| Manhattan | 64.7% (225/348) | 73.3% (669/913) | 0.0026 |
| Queens | 91.2% (301/330) | 91.3% (1688/1848) | 0.9385 |
| Staten Island | 88.9% (48/54) | 94.2% (387/411) | 0.1382 |

Mantel-Haenszel common odds ratio of the adverse outcome (high vs lower poverty) = 0.78, chi-squared = 13.14, p = 0.0003.

### Income quintiles: Over 1/4 mile

Are lower median household income tract districts (quintiles) more likely to be assigned to a site more than a quarter mile away? Tests whether the result depends on the poverty measure.

| Group | Tract districts | Adverse | Rate |
|---|---:|---:|---:|
| Income quintile 5 (highest) | 1541 | 1269 | 82.3% |
| Income quintile 4 | 1542 | 1373 | 89.0% |
| Income quintile 3 | 1541 | 1321 | 85.7% |
| Income quintile 2 | 1542 | 1313 | 85.1% |
| Income quintile 1 (lowest) | 1542 | 1217 | 78.9% |

Trend z = -3.66, one-sided p = 0.9999.

### Poverty gradient: Over 1/2 mile

Are higher poverty tract districts more likely to be assigned to a site more than half a mile away?

| Group | Tract districts | Adverse | Rate |
|---|---:|---:|---:|
| Under 10% | 2478 | 1379 | 55.6% |
| 10% to 20% | 2784 | 1563 | 56.1% |
| 20% to 30% | 1319 | 616 | 46.7% |
| 30% to 40% | 782 | 301 | 38.5% |
| 40% and over | 385 | 218 | 56.6% |

Trend z = -6.54, one-sided p = 1.0000.

### High vs lower poverty: Over 1/2 mile

Collapsing to two groups (20% poverty cut), are high poverty tract districts more likely to be assigned to a site more than half a mile away?

| Group | Tract districts | Adverse | Rate |
|---|---:|---:|---:|
| Poverty 20% and over | 2486 | 1135 | 45.7% |
| Poverty under 20% | 5262 | 2942 | 55.9% |


### Within borough: Over 1/2 mile

Does the high against lower poverty gap in being assigned to a site more than half a mile away persist inside each borough, so it is not an artifact of borough composition? Mantel-Haenszel across boroughs.

| Borough | High-poverty rate | Lower-poverty rate | p |
|---|---:|---:|---:|
| Bronx | 45.1% (340/754) | 55.2% (233/422) | 0.0009 |
| Brooklyn | 45.7% (457/1000) | 52.1% (869/1668) | 0.0014 |
| Manhattan | 23.6% (82/348) | 30.2% (276/913) | 0.0189 |
| Queens | 66.4% (219/330) | 66.8% (1234/1848) | 0.8839 |
| Staten Island | 68.5% (37/54) | 80.3% (330/411) | 0.0461 |

Mantel-Haenszel common odds ratio of the adverse outcome (high vs lower poverty) = 0.77, chi-squared = 23.69, p = <0.0001.

### Income quintiles: Over 1/2 mile

Are lower median household income tract districts (quintiles) more likely to be assigned to a site more than half a mile away? Tests whether the result depends on the poverty measure.

| Group | Tract districts | Adverse | Rate |
|---|---:|---:|---:|
| Income quintile 5 (highest) | 1541 | 710 | 46.1% |
| Income quintile 4 | 1542 | 979 | 63.5% |
| Income quintile 3 | 1541 | 924 | 60.0% |
| Income quintile 2 | 1542 | 773 | 50.1% |
| Income quintile 1 (lowest) | 1542 | 659 | 42.7% |

Trend z = -4.98, one-sided p = 1.0000.

### Poverty gradient: Over 1 mile

Are higher poverty tract districts more likely to be assigned to a site more than a mile away?

| Group | Tract districts | Adverse | Rate |
|---|---:|---:|---:|
| Under 10% | 2478 | 446 | 18.0% |
| 10% to 20% | 2784 | 388 | 13.9% |
| 20% to 30% | 1319 | 106 | 8.0% |
| 30% to 40% | 782 | 33 | 4.2% |
| 40% and over | 385 | 38 | 9.9% |

Trend z = -10.75, one-sided p = 1.0000.

### High vs lower poverty: Over 1 mile

Collapsing to two groups (20% poverty cut), are high poverty tract districts more likely to be assigned to a site more than a mile away?

| Group | Tract districts | Adverse | Rate |
|---|---:|---:|---:|
| Poverty 20% and over | 2486 | 177 | 7.1% |
| Poverty under 20% | 5262 | 834 | 15.8% |


### Within borough: Over 1 mile

Does the high against lower poverty gap in being assigned to a site more than a mile away persist inside each borough, so it is not an artifact of borough composition? Mantel-Haenszel across boroughs.

| Borough | High-poverty rate | Lower-poverty rate | p |
|---|---:|---:|---:|
| Bronx | 5.2% (39/754) | 15.6% (66/422) | <0.0001 |
| Brooklyn | 6.0% (60/1000) | 8.2% (136/1668) | 0.0390 |
| Manhattan | 1.7% (6/348) | 1.0% (9/913) | 0.2797 |
| Queens | 16.4% (54/330) | 24.6% (455/1848) | 0.0011 |
| Staten Island | 33.3% (18/54) | 40.9% (168/411) | 0.2875 |

Mantel-Haenszel common odds ratio of the adverse outcome (high vs lower poverty) = 0.59, chi-squared = 33.86, p = <0.0001.

### Income quintiles: Over 1 mile

Are lower median household income tract districts (quintiles) more likely to be assigned to a site more than a mile away? Tests whether the result depends on the poverty measure.

| Group | Tract districts | Adverse | Rate |
|---|---:|---:|---:|
| Income quintile 5 (highest) | 1541 | 170 | 11.0% |
| Income quintile 4 | 1542 | 328 | 21.3% |
| Income quintile 3 | 1541 | 250 | 16.2% |
| Income quintile 2 | 1542 | 161 | 10.4% |
| Income quintile 1 (lowest) | 1542 | 92 | 6.0% |

Trend z = -7.75, one-sided p = 1.0000.

## Data

7748 tract districts with a poverty rate (7708 also with median income), from 2158 tracts. 2077 tracts span more than one election district and are split; the rest are one tract district. 0 tracts overlap no election district. Overlaps narrower than 10 meters, where tract and district boundaries disagree, are dropped: 3800 slivers, 0.1% of the overlap area. 11 of the 157 assigned sites lie outside every analyzed tract.

## Limits

- Assignments come from the BOE early voting poll site list PDFs for the 2026 General Election ("subject to change"), joined to DCP election district polygons (shoreline clipped) by AD * 1000 + ED.
- Distance is from the tract district's centroid to its assigned site in a straight line, not a walking route. A quarter mile is a rule of thumb for limited mobility.
- Tracts and election districts do not nest, so a tract spanning districts is split. Each piece keeps the whole tract's poverty rate and income, which assumes the rate holds on both sides of the split. Pieces are counted equally; they differ in area and population.
- Early voting sites were located with the Google Geocoding API from their addresses. A site placed on the wrong parcel can change which tract it sits in.
- Poverty rates are ACS 5-year estimates with margins of error; tracts near a class boundary can be misclassified.
- Tract districts are not independent (neighbors share sites and pieces of a tract share a poverty rate), so p-values are likely too small. Read effect sizes alongside them.

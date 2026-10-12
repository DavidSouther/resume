# Research: domain review of NYC polling

Quick loop. Scope: pages/nyc_polling, src/components/nyc_polling.

## Central thesis

Higher poverty census tracts are assigned, by Board of Elections election district, to early voting sites that are farther away. Evidence needs two geographies that were never designed to align:

- Census: 2020 tracts with ACS poverty and income.
- BOE: election districts, each assigned to exactly one early voting site.

Overlaying them yields a Tract district (tract within election district). Its poverty comes from the tract, its assigned site from the election district. Hypotheses H0 to H6 test poverty class and income against distance bands to the assigned site, plus the in-tract question.

## Supporting capabilities found

| Capability | Modules | Kind |
| --- | --- | --- |
| Source acquisition: HTTP, retry, on-disk cache | net.py | Generic |
| Statistics: chi squared, trend, Mantel-Haenszel, Holm | stats.py | Generic (cross-checked against scipy and statsmodels) |
| Point in polygon, haversine | geo.py, domain.haversine_mi | Generic |
| Census geography: ACS, tract boundaries, layers | census.py, boundaries.py, layers.py | Supporting |
| Poll site registry: KML parse, geocode | poll_sites.py | Supporting |
| BOE assignment: PDF to ED to site address | early_voting.py | Supporting |
| Dataset assembly | dataset.py | Supporting |
| Map and report output | geojson.py, combined.py, bands.py, report.py, client.ts, cards.ts | Presentation |

## Language findings

1. Observation is overloaded. `has_site` and `nearest_mi` mean "site inside tract" and "nearest site" for hypotheses.py, but "assigned site in tract" and "miles to assigned site" for assignment.py. The field names carry the first analysis meaning; assignment.py patches question text with `_requestion`.
2. Hypothesis ids are not stable. DISTANCE_TESTS is defined twice with different miles, and H5 is a distance test in one analysis and the in-tract test in the other.
3. Three words for one thing: Site, PollSite, early voting site. Tract district in code, "piece" in geojson and UI.
4. `Group.tracts` counts tract districts in the assignment analysis.
5. poverty.py and bands.py mix classification (domain) with colors (presentation). QUARTER_MILE duplicates BANDS[0] upper bound. poverty.py docstring still mentions a KML writer.

## Dependency findings

- generic/stats.py imports result TypedDicts from disparity_hypotheses/results.py. Only rank violation.
- assignment.py downloads election districts itself (`read_election_districts`), a source acquisition concern inside a Core module.
- Everything else flows Generic, Kernel, Supporting, Core, Presentation.

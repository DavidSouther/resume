# Design: domain map and enforced boundaries

Quick loop. Output is documentation plus one executable feature test. No production code moves.

## Decisions

1. Record domain map in docs/ddd (DRAFT, needs human sign-off per Change Cadence Gate).
2. One Core context, disparity-hypotheses. Geography (census, boe, layers, tract district) is Supporting data modelling, per the 2026-10-12 review: splitting tracts is distinct from testing hypotheses.
3. Shared kernel: domain.py (Site, Tract, Observation) and poverty.py classes.
4. Feature test: tests/test_context_boundaries.py parses imports of every module in nyc_tracts and asserts a module only imports from its own layer or lower. Layers: generic 0, kernel 1, supporting 2, core 3, presentation 4. Known debt (stats imports results) is listed explicitly and asserted exactly, so fixing it forces removal from the list.
5. Every module must be classified, so a new module fails the test until placed in a context.

## 2026-10-12 revisions

- Geocoder interface and GoogleGeocoder own the API key.
- Geography folder holds census, boe, layers, and the tract by election district split.
- One question, one analysis: access measures replace the separate in-tract and assignment runs and the H0 to H6 numbering. The nearest-site-per-tract proxy analysis is removed because voters are assigned by election district. Observation fields are now `site_in_tract` and `miles`.

## Deferred (TASKS.md)

- Move result TypedDicts for stats into stats.py.
- Separate class and band definitions from colors.
- Group into subpackages once debt is cleared.

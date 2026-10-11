# nyc-polling quick loop (2026-10-08)

Quick loop, no review waiver. Artifacts minimal.

Findings (research): draft script absent, wrote fresh; Census API needs key; TIGERweb layer 10 is 2020 vintage; poll KML has 11 Points of 157 poll sites; 26 non-poll placemarks excluded.

Feature test: `python3 pages/nyc_polling/nyc_tracts_poll_sites.py` with a key writes a well formed KML with ~2327 colored tracts and ~146 poll points. Key run done and passing.

Plan: script (done), page.ts embed (done), README (done), key run + spot checks (done).

## Block 2: disparate impact tests (2026-10-09, quick loop)

Research: no Census key in env, so the analysis reads the generated KMLs in public/nyc_polling/ (tract polygons, poverty and income from pop-ups, poll site points). No scipy; chi-squared p-values use a stdlib incomplete gamma.

Design: outcome is "no poll site point inside the tract" (proxy for a visit to a different tract). Baseline H0 is a 5 class poverty by outcome chi-squared, plus Cochran-Armitage trend and a four-fifths impact ratio. Related, Holm corrected: H1 two group collapse, H2 within borough (Mantel-Haenszel), H3 and H4 centroid distance over 0.5 and 1 mile, H5 income quintiles.

Feature test: `python3 -m unittest` in pages/nyc_polling (stats checked against known critical values, report built from generated KML). Green.

Intent review: the prompt asks to test the hypothesis, not confirm it. Result is reported with a direction column. Baseline direction is opposite (higher poverty tracts are slightly more likely to contain a site), so the hypothesis is not supported under this proxy.

Refinement: the 4 poll sites outside every analyzed tract are in zero-population tracts (36061031100, 36061014300, 36081024600, 36081038302), confirmed against DCP 2020 tracts. Report wording corrected; they do not bias results.

# early voting assignment (2026-10-09, quick loop)

Research: BOE publishes early voting sites per election district as five county PDFs (vote.nyc/elections, GE2026). DCP publishes ED polygons (Open Data wwxk-38u4, key elect_dist = AD*1000+ED). No tabular ED-to-site file exists. The BOE locator API is not used.

Design: parse PDFs with pdftotext -bbox-layout (word x, y), repartition tracts by ED polygons with shapely (tract x district subdivisions, each keeping its tract's poverty and income; slivers under 10 m dropped). Unit of analysis = subdivision; outcome = assigned site lies in the subdivision's own tract; distance = subdivision centroid to its assigned site. Reuse run_hypotheses unchanged; assignment wording in nyc_tracts/assignment.py and templates/assignment.md.j2.

Feature test: `uv run nyc_tracts_poll_assignment.py` writes the report; `uv run run_tests.py` green (43 tests, synthetic PDF words and squares for the overlay).

Intent review: prompt asked for early voting site assignment geometry. Result: assignment is derivable exactly from BOE PDFs. Baseline direction opposite (p < 0.0001 on 7,751 subdivisions); all of H1 to H6 significant and opposite. 7 PDF addresses differed from the map's spelling; 2 need aliases (2030 vs 2040 Antin Place, Seabreeze).

Correction: the first build used tract-level outcomes with area weighted overlap. The prompt asked for the tract x district subdivision as the unit; rebuilt.

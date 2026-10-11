# nyc_tracts refactor, research (2026-10-09, quick loop)

Prompt: apply patterns to pages/nyc_polling/nyc_tracts*, suggest libraries for statistics and KML processing, pull hypotheses and report out to modules, uv and inline comments (PEP 723) for project management, jinja for report templating.

Findings:
- nyc_tracts_poll_disparity.py (633 lines) mixes a hand-rolled stats library, KML parsing with dict records, hypotheses, and string-built markdown. It imports ring_contains from the sites script.
- nyc_tracts_poll_sites.py is a stdlib-only fetch/build script; it stays stdlib (dependencies = []).
- uv 0.11 is installed. scipy, statsmodels, shapely, jinja2 resolve.

Library suggestions:
| Need | Library | Replaces |
|---|---|---|
| chi-squared, normal tail | scipy.stats | _gamma_q, chi2_sf, normal_sf, chi_squared |
| Holm, Mantel-Haenszel | statsmodels (multipletests, StratifiedTable) | holm, mantel_haenszel |
| Cochran-Armitage | none in a library; keep a 10 line function on scipy.stats.norm | trend_test |
| Geometry, point in polygon, centroid | shapely (STRtree) | ring_contains, polygon_contains, centroid |
| KML read | stdlib ElementTree for pop-up HTML fields; fastkml or pyogrio (GDAL) if styles/folders matter later | parse_ring, parse_polygons |
| KML write | simplekml or fastkml, if the sites script ever needs more than string templates | build_kml |
| Reports | jinja2 | list-of-strings markdown |

# nyc_tracts refactor, design (2026-10-09)

Patterns (patterns:using-patterns):
- newtype: `GeoId`, `Borough` are distinct types.
- domain-objects: `Tract` (frozen dataclass, shapely geometry, poverty, income) and `Site` carry data and `contains`/`distance` behavior; hypotheses are free functions (domain services).
- parse-dont-validate: `nyc_tracts_kml.py` parses KML into `Tract`/`Site` once at the boundary; no dict records downstream.
- repository: `KmlRepository(data_dir)` yields tracts and sites; analysis never touches paths or XML.
- bootstrap-and-service: `nyc_tracts_poll_disparity.py` is a thin entry script (PEP 723 header, argparse, wiring).
- arrange-act-assert: tests restructured.

Modules (pages/nyc_polling/):
- nyc_tracts_model.py: types.
- nyc_tracts_kml.py: repository + parsing.
- nyc_tracts_stats.py: thin wrappers over scipy/statsmodels plus Cochran-Armitage.
- nyc_tracts_hypotheses.py: H0 to H6 and Holm; returns plain dicts (same JSON schema as before).
- nyc_tracts_report.py + templates/disparity.md.j2: jinja2 rendering; narrative decisions computed in a `summarize` function.
- nyc_tracts_poll_disparity.py: entry script.

Feature test: new report.json matches the pre-refactor report.json (counts exact, statistics within 1e-6), and `uv run` of the unit tests is green.

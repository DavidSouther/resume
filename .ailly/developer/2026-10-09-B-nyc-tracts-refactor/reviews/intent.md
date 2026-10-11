# Intent review (end of quick loop)
- "apply patterns": newtype, domain-objects, parse-dont-validate, repository, bootstrap-and-service, arrange-act-assert applied to the disparity analysis. nyc_tracts_poll_sites.py (fetch/build script) was not restructured; only given a PEP 723 header. Question: should it be split into modules too?
- "suggest libraries": table in research.md. KML parsing still uses stdlib ElementTree because pop-up HTML fields are the data source; fastkml/pyogrio suggested for later.
- "pull hypotheses and report out to modules": done (hypotheses, report modules).
- "uv & inline comments": PEP 723 headers on all three scripts, no pyproject.
- "jinja": templates/disparity.md.j2. Output differs from before only by 5 extra blank lines.
- Regression: report.json matches pre-refactor values (tolerance 1e-6); unit tests green (6).

## Round 2 (poll_sites split, nyc_tracts package, tests, types, ruff)
- nyc_tracts_poll_sites.py is now a thin entry script over nyc_tracts.poverty_map. Output verified byte-identical to the pre-refactor script on synthetic offline inputs (all five KML kinds and the report JSON). It was not re-run against live APIs.
- Removed the unused --cache-dir flag. Point in polygon for poll sites now uses shapely (adds a shapely dependency to the sites script); boundary points count as inside.
- 33 offline tests, mypy --strict clean, ruff format and check clean.

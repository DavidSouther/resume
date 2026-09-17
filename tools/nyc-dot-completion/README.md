# NYC DOT completion pipeline — Adams vs. Mamdani

A reproducible pull → classify → aggregate → cross-check → report
pipeline comparing NYC DOT project completion across three categories
(protected bike lanes, daylighted intersections, pedestrian plazas /
Open Streets) between the Adams administration (Jan 1 2022 – Dec 31
2025) and the Mamdani administration (Jan 1 2026 – present).

## Current status

**Run against live data on 2026-09-17.** `data.cityofnewyork.us` and
`projects.transalt.org` are reachable from this environment;
`www.nyc.gov` (the DOT testimony PDF host) returns 403 to a bare `curl`,
so those three URLs remain `url_verified: false` in
`config/testimony.yaml` — verify them in a browser before citing a
testimony figure.

Schema inspection also found that the original assumption — that
Street Construction Permits (`tqtj-sjs8`) carries `permit_type`/
`work_type` fields with bike-lane and daylighting categories — was
wrong: that dataset has neither field, and none of its real categorical
fields carry either category. The pipeline was re-pointed at NYC's Bike
Routes inventory (`mzxg-pwib`) for protected bike lanes (an as-built
record with a real install date, not an issued permit) and at
Pedestrian Space Added (`uebm-cmjr`) for the plazas/Open Streets
Adams-vs-Mamdani split (the plazas polygon dataset itself has no
install-date field). No public dataset was found for daylighted
intersections at all — see `config/sources.yaml`'s `daylighting.note`
— so that metric is `unavailable`, honestly, rather than derived from
unrelated permit free-text. See each dataset's `role` in
`config/sources.yaml` for the full reasoning.

`output/final_table.csv` now carries real numbers for protected bike
lanes and a real (FY-approximated) number for plazas/Open Streets;
daylighting remains `unavailable` because no source exists for it.

## Setup

```
pip install -r requirements.txt
```

## Running it

The one manual gate is classification review — do not skip it.

```
cd src

# Step 0: inspect real schemas and distinct categorical values.
python inspect_schema.py
# Writes ../config/classification.generated.yaml.

# --- STOP: human review ---
# Open classification.generated.yaml, copy each ft_facilit/tf_facilit
# value into ../config/classification.yaml's `mapping`, assigning it to
# bike_lane_install / other / ambiguous. Also check the printed field
# lists for:
#   - bike_routes: does a real per-segment length field exist? If so,
#     consider whether a lane-mile figure is worth adding — the current
#     pipeline deliberately reports a segment count instead of guessing
#     a units-bearing figure from geometry.
#   - capital_reconstruction_projects: is there a status field and a
#     completed value? Set status_field/completed_values.
#   - pedestrian_plazas: is there an install/opening date field? Set
#     date_field if so; leave null if not (the pipeline then correctly
#     reports a total count with no year-over-year split).
# Do not guess any of these — leave them null/empty if unconfirmed.

# Steps 1-5: pull, classify, aggregate, build the table, cross-check.
python run_pipeline.py
```

Or run the individual steps directly (`pull_bike_routes.py`,
`pull_permits.py`, `pull_capital_projects.py`, `pull_plazas.py`,
`pull_pedestrian_space.py`, `classify.py`, `build_table.py`,
`crosscheck.py`) — `run_pipeline.py` is just a thin sequencer around
them.

`classify.py` refuses (exit 1) and prints every unmapped value if
`classification.yaml` still has gaps — it will not guess a category or
silently drop rows.

## What's committed vs. what's derived

- `config/sources.yaml`, `config/classification.yaml`,
  `config/testimony.yaml` — reviewable by hand, committed, and the only
  place dataset IDs / field names / category mappings / testimony
  figures live. No script hardcodes any of these.
- `cache/<dataset_id>/page_*.json` + `manifest.json` — raw, unmodified
  Socrata responses, committed so the pull is independently auditable
  against the final numbers. The one exception is
  `cache/tqtj-sjs8/audit_summary.json` (Street Construction Permits):
  that dataset has 3M+ rows since 2022, far too large to cache raw for
  a dataset this pipeline doesn't use for any metric, so its cache is a
  small row-count-and-finding summary instead — see `pull_permits.py`.
- `output/bike_routes_classified.csv`, `output/final_table.csv` —
  derived; regenerate by re-running the pipeline rather than
  hand-editing.

## Design notes / constraints this pipeline follows

- A bike route segment is counted only when `status == 'Current'` — a
  retired/removed facility does not count as a still-installed lane.
  The `instdate` field is DOT/DCP's own as-built install date, not an
  issued permit date, which is a stronger completion signal than a
  permit record.
- Bike lane figures are a **segment count**, not mileage — no reliable
  per-segment length field exists without computing one from geometry,
  and this pipeline does not guess a units-bearing figure to manufacture
  a miles total.
- The pedestrian plazas dataset has no install/opening date field, so it
  contributes only a total count as of extraction — never a fabricated
  Adams/Mamdani split. That split instead comes from Pedestrian Space
  Added, bucketed by NYC fiscal year; see `aggregate.py`'s `plaza_metric`
  for the disclosed FY22/FY26 administration-boundary approximation.
- No public dataset tracks daylighted intersections as of this pipeline's
  last catalog search (2026-09-17) — see `sources.yaml`'s `daylighting`
  block. That metric is reported `unavailable` rather than derived from
  unrelated permit free-text (a `LIKE '%DAYLIGHT%'` match on permit
  stipulation text returns ~4,000 rows, but that's boilerplate curb
  language, not a reliable signal of daylighting projects).
- `crosscheck.py` never picks a "winning" number between the bike-route
  inventory, DOT testimony, and the TransAlt tracker — every mismatch
  (including a unit mismatch, e.g. miles vs. segment count) prints as a
  warning, not a silently resolved comparison.
- Mamdani's window has no end date. `mamdani_annualized_total` in the
  final table extrapolates `mamdani_to_date_total` to a full year using
  the elapsed fraction of the window at extraction time — it is clearly
  a separate column from the to-date total, never conflated with it.
- The DOT testimony PDF URLs in `config/testimony.yaml` are transcribed
  from the task brief and have **not** been verified to resolve in this
  environment (`url_verified: false` on every entry). `crosscheck.py`
  prints a warning for each unverified URL on every run. Verify them
  before citing any testimony figure in published output.
- The TransAlt tracker (`projects.transalt.org/bikelanes`) has no known
  public API as of authoring. No scraper is implemented; `crosscheck.py`
  reports the TransAlt comparison as unavailable rather than skip it
  silently. Check the network tab and `robots.txt` again before building
  a scraper, and rate-limit if scraping turns out to be the only option.

## Publishing

The site page at `pages/nyc-dot-completion/page.ts` reads
`output/final_table.csv` at build time and renders it, along with the
methodology above. If the CSV is missing or every row is `unavailable`,
the page says so — it does not fall back to placeholder numbers.

# NYC DOT completion pipeline — Adams vs. Mamdani

A reproducible pull → classify → aggregate → cross-check → report
pipeline comparing NYC DOT project completion across three categories
(protected bike lanes, daylighted intersections, pedestrian plazas /
Open Streets) between the Adams administration (Jan 1 2022 – Dec 31
2025) and the Mamdani administration (Jan 1 2026 – present).

## Current status

**Not yet run against live data.** This pipeline was authored in a
sandbox whose network egress policy blocks `data.cityofnewyork.us`,
`www.nyc.gov`, and `projects.transalt.org`. Every script below is
written and smoke-tested against synthetic fixtures, but `cache/` and
`output/final_table.csv` in this repo reflect a pipeline that has never
touched real Socrata/DOT data. `output/final_table.csv` currently shows
every metric as `unavailable` with a stated reason — that is the
correct, honest state for a pipeline that hasn't run, not a bug.

Run it for real from an environment that can reach those three hosts.

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
# Open classification.generated.yaml, copy each permit_type/work_type
# value into ../config/classification.yaml's `mapping`, assigning it to
# bike_lane_install / daylighting / other / ambiguous. Also check the
# printed field lists for:
#   - street_construction_permits: does length_field exist (a linear
#     measurement on bike lane permits)? If so, set
#     sources.yaml -> street_construction_permits.length_field/length_unit.
#   - capital_reconstruction_projects: is there a status field and a
#     completed value? Set status_field/completed_values.
#   - pedestrian_plazas: is there an install/opening date field? Set
#     date_field if so; leave null if not (the pipeline then correctly
#     reports a total count with no year-over-year split).
# Do not guess any of these three — leave them null/empty if unconfirmed.

# Steps 1-5: pull, classify, aggregate, build the table, cross-check.
python run_pipeline.py
```

Or run the individual steps directly (`pull_permits.py`,
`pull_capital_projects.py`, `pull_plazas.py`, `classify.py`,
`build_table.py`, `crosscheck.py`) — `run_pipeline.py` is just a thin
sequencer around them.

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
  against the final numbers.
- `output/permits_classified.csv`, `output/final_table.csv` — derived;
  regenerate by re-running the pipeline rather than hand-editing.

## Design notes / constraints this pipeline follows

- A permit row is an **issued** record, not a verified completion. Every
  permit-derived metric says so in its `completion_semantics` /`notes`
  column rather than being labeled a completion count.
- `length_field` (bike-lane linear measurement) defaults to `null` — a
  permit **count** is reported, not miles, until a real length-bearing
  field is confirmed via `inspect_schema.py`. Guessing a units-bearing
  field to manufacture a miles figure is exactly the failure mode this
  guards against.
- The pedestrian plazas dataset may have no install/opening date. If so,
  the pipeline reports a single total count as of extraction, states
  that plainly, and does not fabricate an Adams/Mamdani split.
- `crosscheck.py` never picks a "winning" number between the permit
  pull, DOT testimony, and the TransAlt tracker — every mismatch beyond
  the configured variance threshold (`testimony.yaml` ->
  `cross_check.*.variance_warn_threshold_pct`) prints as a warning.
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

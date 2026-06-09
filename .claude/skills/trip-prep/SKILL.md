---
name: trip-prep
description: Use when authoring or refreshing the "before you go" entry/customs prep for a trip in this template — solicits traveler nationality and document status, researches current entry requirements for the trip's countries, computes the Schengen 90/180 rolling window, and writes meta.travelers + trip_prep into the trip's enrichment.yaml. Keeps volatile entry facts (ETA/ETIAS/EES, customs allowances) fresh and linked rather than hardcoded in the static prompt.
---

# trip-prep

Author the advisory `meta.travelers` registry and `trip_prep` "before you go"
block for one trip, keeping the volatile entry/customs specifics fresh and linked
to authoritative government sources rather than baked into the static enrichment
prompt (which would rot).

**Inputs:** a trip id — its `trips/<id>/itinerary.yaml` and `trips/<id>/enrichment.yaml`.

**Schema:** the shapes you write are defined in `src/lib/trip-enrichment.d.ts`
(`Traveler`, `TravelDocument`, `PrepItem`, `TripPrep`, and `meta.travelers`). The
shape-and-contract rules also live in the enrichment prompt
(`trips/enrichment.prompt.txt`): `meta.travelers` holds passport_country + document
STATUS only; each rule-bearing `trip_prep` item must link its authoritative
government source and must not restate the rule as settled fact.

**Privacy contract (load-bearing):** `trips/<id>/*.yaml` are read at build time and
rendered into the deployed, publicly committed static site. The committed file holds
**status and metadata only** — never a raw passport / visa / ETA reference number,
never an exact date of birth, and `valid_until` only at month granularity
(`"YYYY-MM"`). Raw numbers, if recorded at all, go ONLY to the gitignored sidecar
`trips/<id>/documents.local.yaml`, which the renderer never imports.

## Process

A forward-backward path from the current state to a written, lint-clean `trip_prep`.

### 1. Read the itinerary and derive the borders

Read `trips/<id>/itinerary.yaml`. Extract the ordered set of countries and the
border-crossing legs. Classify each crossing as an **external** entry/exit versus an
**internal** movement (e.g. Schengen→Schengen). Identify the **first Schengen entry**
and the **last Schengen exit**, and keep distinct regimes (e.g. UK vs. Schengen)
separate. (For Hvar: one Schengen entry at Vienna, one exit at Split, Vienna→Split is
an internal Schengen flight; the UK legs are a separate regime.)

### 2. Solicit traveler details interactively

For each traveler, ask:

- **Passport country** (drives the entry-rule set).
- **Document status** — passport expiry month, and whether each required
  authorization (ETA / ETIAS / visa / trusted-traveler) is already held.
- **Recent Schengen presence** — entry/exit dates in the **180 days before the first
  Schengen entry**, needed for the 90/180 window in step 3.
- **EES enrolment** — whether the traveler was already biometrically enrolled by EES
  on an entry after 10 Apr 2026.

Record passport_country and document STATUS in the registry. If the traveler wants to
keep raw numbers, offer to record them ONLY in the gitignored
`trips/<id>/documents.local.yaml` — never in `enrichment.yaml`.

### 3. Research current requirements

Use `research:public` for the (country-set × nationality) pair: entry authorizations
and their **live** status, the passport-validity rule, and customs allowances per
direction. Compute the **Schengen 90/180 against the rolling window**: sum the
solicited prior-180-day Schengen days with this trip's Schengen days — not this trip
alone — and confirm the running total stays under 90. The count is time-relative, so
derive it now and let `checked_on` (step 4) date it; do **not** store a static number
that will rot. Cite official sources for every rule.

### 4. Synthesize meta.travelers + trip_prep

Write:

- `meta.travelers` — the status registry (passport_country + document status/metadata).
- `trip_prep` — `summary`, a `checklist` of `PrepItem`s, `notes`, `sources`, and
  `checked_on` stamped with today's verification date. Every rule-bearing item carries
  a `url` to its `*.gov` / `*.gov.uk` / `europa.eu` source and states the rule as
  advisory, not as settled fact. Use `lead_time_days` / `warn_lead_days` for items with
  a deadline (e.g. apply for an ETA at least N days before departure).

### 5. Write and lint

Write the block into `trips/<id>/enrichment.yaml`. Then RUN the authoring guardrail to
assert no secret-pattern value leaked and every rule-bearing item links a source:

```
node scripts/enrichment-lint.ts <id>
```

(or `mise exec -- npx vitest run scripts/enrichment-lint.feature.test.ts`). It exits
non-zero and prints each finding if a passport/visa number, an exact DOB, a full-day
`valid_until`, or a rule item missing a `url` was written. Fix every finding before
finishing; the write is only complete when the lint reports no findings.

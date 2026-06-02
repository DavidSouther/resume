A self-contained, single-page that renders a **high-end personal-travel itinerary** from plain YAML, in a quiet-luxury editorial style modeled on Navan's day-grouped booking view.

This project page collects the reusable pieces — the two schemas, two worked example datasets, the template HTML page, and prompts for generating new trips.

## What it is

You describe a trip in two YAML files and open one HTML file. The page groups everything by day, shows flights, hotels, ground transport, and activities on a vertical timeline, renders a skyline cover and per-city dividers, and ends each day with a line stating where the traveler sleeps that night.

## Architecture: two layers

**1. Primary itinerary (must load).** Flights, hotels (rendered as separate check-in / check-out events plus a nightly "overnight" line), ground transport, and daily events. This renders synchronously from the itinerary dataset alone — no network required.

**2. Enrichment (progressive, failure-silent).** Skyline title cards, flight-status + live-tracker links, hotel pages, booking-search links, Google Maps car/transit transfers between airport and hotel, and inline Wikipedia cards (photo + first paragraph). Every piece loads independently; if any fetch fails, that piece simply does not appear and the rest of the itinerary is untouched.

## Data model

Two schemas, joined at render time:

- **Itinerary schema** — the booking facts (flights, hotels, ground, events). Times are stored as local wall-clock time **plus an IANA timezone**, so the app derives the displayed zone label (e.g. EDT → BST) and the "+1 day" overnight flag itself.
- **Enrichment schema** — a pure display layer that never restates facts. It joins to the itinerary by **city**, **flight code** (`<airline_code><flight_number>`), **hotel name**, and **event title**.

Every reservation carries a `status` of `confirmed` or `to_book`. A reservation is only `confirmed` when a confirmation email (or explicit traveler confirmation) backs it; otherwise it renders as a dashed `to_book` placeholder.

## Template page

`itinerary.html` is fully data-driven — it contains **no** itinerary. It loads the two YAML files at runtime: relative paths when hosted next to them, `?trip=…&enrich=…` URL overrides, or a drag-and-drop file picker when opened locally. It parses with js-yaml's `CORE_SCHEMA` so date/time scalars stay strings rather than being coerced to `Date` objects.

**Design:** warm ivory paper, ink text, brass accent, Fraunces display + Spectral body; a single-column timeline that reads identically on phone and desktop, with full-bleed skyline title cards.

## How to use it

1. Author an **itinerary dataset** for the trip (conform to the itinerary schema).
2. Optionally author an **enrichment dataset** (conform to the enrichment schema; same join keys).
3. Host both YAML files next to `itinerary.html`, or open the page and drag the files in.

## Contents of this project

- **Itinerary Schema** — the booking-facts schema
- **Enrichment Schema** — the display-layer schema
- **Example — Trip Dataset** — a worked itinerary (London · Vienna · Hvar)
- **Example — Enrichment Dataset** — its matching enrichment layer
- **Template — Itinerary HTML (with loaders)** — the data-driven viewer
- **Sample Prompts** — for generating itinerary + enrichment datasets for other trips

This is the **reusable template** version of the itinerary viewer: `itinerary.html`. Unlike the embedded build, it contains **no trip data**. It loads two YAML files at runtime and renders the itinerary.

## How it loads data

1. **Hosted next to the YAML files** — on load it fetches `trip-annie-david-europe.yaml` and `trip-annie-david-enrichment.yaml` from the same folder (relative paths).
2. **URL overrides** — pass `?trip=<url>&enrich=<url>` to point at any two files.
3. **File picker fallback** — if the fetch fails (opened from `file://` or a sandbox with no network), it shows an elegant drag-and-drop picker. Only the trip file is required; enrichment is optional.

## Design + behavior

- Single-column quiet-luxury timeline (Fraunces + Spectral), identical on phone and desktop, modeled on Navan's day-grouped booking view.
- **Primary itinerary renders synchronously**; every piece of enrichment (skyline images, Wikipedia cards, status/booking links) is fetched independently and is failure-silent.
- YAML is parsed with js-yaml `CORE_SCHEMA` so dates stay strings (avoids the `Date`-coercion bug).
- Synthesizes airport↔hotel ground legs with Google Maps car + transit links; to-book hotels get IHG search links; activities get Brave search links; activities show an inline Wikipedia photo + first paragraph on expand.
# NYC tracts and early voting poll sites

Census tract poverty and early voting poll sites for NYC, as a web map at `/nyc_polling/` and as disparate impact tests. Every script loads the sources straight into typed objects (`nyc_tracts/dataset.py`) and nothing is written between steps: no KML, no intermediate files. The map loads two GeoJSON files, `nyc_assignment.geojson` and `nyc_poll_sites.geojson`, in `public/nyc_polling/`.

## Run

```sh
export CENSUS_API_KEY=...        # free: https://api.census.gov/data/key_signup.html
export GOOGLE_MAPS_API_KEY=...   # Geocoding API; locates poll sites
uv run nyc_tracts_geojson.py            # the map: writes public/nyc_polling/*.geojson
uv run nyc_tracts_poll_disparity.py     # in-tract tests: writes the report next to the script
uv run nyc_tracts_poll_assignment.py    # assignment tests: writes the report next to the script
uv run nyc_tracts_poll_sites.py         # source load report (joins, geocoded sites, failures, exclusions)
```

Every script takes `--counties` (005 Bronx, 047 Brooklyn, 061 Manhattan, 081 Queens, 085 Staten Island), `--boundaries`, `--low-population`, `--census-key`, `--google-key`, and the cache flags (see Source cache). The keys are needed only for sources that are not in the cache yet: the first run downloads and geocodes, and later runs need no network and no keys. `nyc_tracts_poll_sites.py` also takes `--skip-polls`. Its gitignored `nyc_tracts_poll_sites.report.json` lists joins, geocoded sites, failures, and exclusions.

## Sources

| Data | Source | Vintage |
| --- | --- | --- |
| Poverty rate and margin | Census API `acs/acs5/subject`, `S1701_C03_001E` / `S1701_C03_001M` | ACS 2024 5-year |
| Median household income and margin | `S1901_C01_012E` / `S1901_C01_012M` (label "Households, Median income"; verified in variable metadata) | ACS 2024 5-year |
| Tract boundaries | NYC DCP "2020 Census Tracts" (Socrata `63ge-mke6`), clipped to the shoreline, GeoJSON, paginated. `--boundaries tiger` uses TIGERweb `Tracts_Blocks` MapServer **layer 10** (full extent, includes water) | 2020 tracts |
| Poll sites | Public My Maps KML `mid=1IDPJI3AG9iMFvYT-1tOGKr8nNSiwSzg` | Early voting 10-24-26 to 11-1-26 |
| Geocoding | Google Geocoding API, restricted to NY and a NYC bounding box, several address variants per site | live |
| Tract population and households | `S0101_C01_001E` (total population), `S1701_C01_001E`, `S1901_C01_001E` | ACS 2024 5-year |

Poverty classes use fixed ColorBrewer Reds breaks: under 10%, 10-20%, 20-30%, 30-40%, 40% and over. Missing data is grey. Census negative sentinels (for example -666666666) become null.

## Changes from the expected sources

- **Census API key is required.** Keyless requests, even `for=state:36`, are redirected (302) to `https://api.census.gov/data/missing_key.html` with header `X-DataWebAPI-KeyError: 1`. The script fails with a clear message instead of working around it.
- **TIGERweb layer IDs moved.** Layer 0 is now the current (January 2026) tract vintage. Layer 10 is the 2020 Census vintage and matches ACS 2024 geography, so the script uses layer 10. Fields `GEOID`, `NAME`, `COUNTY` are unchanged.
- **The poll site KML has almost no Points.** Of 183 placemarks, only 11 poll sites carry a `<Point>`. The rest have an address element (or only a name) and must be geocoded.
- **The source KML mixes in non-poll-site content.** It contains 19 LineString route lines (names like "7 minutes"), one empty placemark ("Morgan, Lewis, and Bockius"), and a second folder, "Untitled layer", with 6 personal points. All 26 are excluded because they have no Poll Site ID.

## Tract layers

- **Borough layers:** every tract whose poverty universe (population for whom poverty status is determined) is at least the low population cutoff. A tract with residents but no median household income is mapped here, colored by poverty rate, with income shown as "not available" on its card. A tract with no poverty rate is grey.
- **Low population:** poverty universe above 0 and under 1,200 (`--low-population` to change). 1,200 is the Census Bureau minimum for a standard tract (optimum 4,000, maximum 8,000), so a tract below it is not a standard residential tract, often an institution or a mostly non-residential area, and its ACS estimates carry very wide margins of error. The map draws these tracts split by election district like the rest, and faded.
- **Zero population:** no residents in the poverty universe (parks, water, airports, and similar), or no ACS row.

## Output counts (full run, 2026-10-09)

Layers: 2158 borough-layer tracts (Bronx 335, Brooklyn 759, Manhattan 285, Queens 663, Staten Island 116), 81 low population tracts, 86 zero population tracts, and 157 poll sites. The full list is in the load report.

- Tract boundaries (NYC DCP, clipped to the shoreline, so no harbor or river water): 2325. ACS rows: 2327. The 2 ACS rows with no boundary (36047990100, 36081990100) are tracts entirely under water.
- Class distribution: under 10% 694, 10-20% 777, 20-30% 369, 30-40% 206, 40% and over 112.
- Low population (under 1,200 in the poverty universe): 81 tracts, 16 of them under 100 people. Zero population: 86 tracts.
- Margins of error that Census reports as sentinels (for example -333333333 on a top-coded income of $250,001) are shown as absent.
- Source placemarks: 183. Poll sites in source: 157. With KML Point: 11. Google geocoded: 146. Geocode failures: 0. Poll sites located: 157. Sites in no tract: 0.

### Geocoding

The Census Geocoder is no longer used. It matched 135 of the 146 sites without a Point and missed 11: 3000 Emmons Avenue, 8301 Shore Road, 400 Irving Avenue, 1065 Elton Street (Brooklyn); 4-31 Beach 129 Street, 110-00 Rockaway Boulevard, 79-25 Winchester Boulevard, 120-55 Queens Boulevard, 65-30 Kissena Boulevard, 80-00 Utopia Parkway, 1 Court Square (Queens). The Google Geocoding API located all 146 in the 2026-10-09 run. Against the earlier Census coordinates, 6 sites moved more than 0.1 mile, the most by 0.2 mile (6541 Hylan Boulevard). Pop-ups say each site was located by Google. A site that fails to geocode is listed under `geocode_failed` in the report and left off the map.

- **Google My Maps could not hold this data**, so the map is MapLibre over GeoJSON. My Maps caps a map at 10,000 features and 50,000 vertices, and imports at most 2,000 placemarks per file; the tracts alone are 174,000 vertices.

## Known data issues

- 23 poll site rows have tract/poverty text or nothing in the Election field (for example `Tract 261; 14.5%`). They are kept, and listed under `election_field_flagged` in the report.
- "153 35th Street" and "1 Court Square" have no address element and no styleUrl. They are geocoded from the name, borough, and zip.
- Tract polygons are TIGERweb full extent, so they include harbor and river water. Coloring tints water near the shore.

## Web map

`uv run nyc_tracts_geojson.py` writes `nyc_assignment.geojson` and `nyc_poll_sites.geojson` to `public/nyc_polling/`, the only files the page loads, from the objects `load_dataset` builds and the BOE assignment (`nyc_tracts/geojson.py`). `page.ts` renders `/nyc_polling/` with MapLibre GL JS (pinned CDN version) over the OpenFreeMap positron basemap, and `src/components/nyc_polling/client.ts` draws a full-page map of the tract by election district pieces and poll sites, with a Poverty / Distance / Combined toggle. Combined gives every poverty class by distance band cell its own color, 5 x 4 = 20 (`nyc_tracts/combined.py`, colors computed in Python): darker is higher poverty, and blue through violet and amber to red runs from the nearest to the farthest band. Low population tracts are split by election district like the rest, colored normally, and faded so they recede; they are left out of the analysis. Zero population tracts are drawn whole in a blue grey. Features carry raw numbers, not HTML, and the cards are built in the page (`src/components/nyc_polling/cards.ts`): a population row always, and the poverty rate and income rows unless the population is 0. Data sources and definitions are listed once, in the map's info box (the `SOURCES` list in the client module).

The GeoJSON in `public/nyc_polling/` is untracked, so the live site shows the map only after it is committed.

## Code layout

The scripts (PEP 723 inline metadata, so `uv` builds the environment on demand; no pyproject.toml) call the `nyc_tracts` package.

```sh
uv run run_tests.py                   # unit tests, offline (fake Census, boundary, poll site, and geocoder responses); also cross-checks stats against scipy and statsmodels
uvx ruff format . && uvx ruff check . # ruff.toml sets line length 200
uv run --with pyright --with shapely --with jinja2 --with httpx --with tenacity --with types-shapely pyright   # pyrightconfig.json: strict
```

| Module | Role |
| --- | --- |
| `net` | `httpx` GET with `tenacity` retries (tests set `net.TRANSPORT` to an `httpx.MockTransport`) |
| `census`, `boundaries`, `poll_sites` | Sources: `AcsRow`, `TractFeature`, `PollSite` and their fetch/parse/geocode functions |
| `poverty` | Class breaks and colors, shared by the map and the analysis |
| `layers`, `dataset` | Borough, low, and zero population layers as `Tract` objects; `load_dataset` loads every source into a `Dataset` (tracts, located poll sites, load report), the one entry point for every script |
| `bands`, `combined`, `geojson` | Distance bands, the 5 x 4 combined palette, and the GeoJSON the page loads |
| `geo` | `PointLocator`: point in polygon over shapely geometries |
| `domain` | Analysis types (`GeoId`, `Borough`, `Tract`, `Site`, `Observation`) |
| `stats`, `hypotheses`, `results`, `report` + `templates/disparity.md.j2` | Tests in plain Python (chi-squared, Cochran-Armitage, Mantel-Haenszel, Holm; no scipy or statsmodels), H0 to H6, typed results (`Hypothesis`, `Report`), jinja2 rendering |

## Disparate impact tests

`nyc_tracts_poll_disparity.py` loads the dataset (from the cache, so no network and no keys on a rerun). Baseline H0: higher poverty tracts are more likely to have no poll site inside the tract. H1 to H6 (two group collapse, within borough, centroid distance over 0.25, 0.5 and 1 mile, income quintiles) are Holm corrected. Dependencies: statsmodels (brings scipy and numpy), shapely, jinja2, httpx, tenacity.

## Early voting site assignment

The in-tract tests above use a site inside the tract as a proxy for assignment. BOE assigns every election district (ED) to one early voting site and publishes the assignments as one PDF per county ("Poll Site List ... Early Voting", linked from https://www.vote.nyc/elections). `uv run nyc_tracts_poll_assignment.py` downloads them (once, into `.cache/`; needs `pdftotext` from poppler), reads each row's AD, ED, site name and address from word positions (`pdftotext -bbox-layout`), downloads the DCP election district polygons (shoreline clipped, key `elect_dist` = AD * 1000 + ED), and repartitions the tracts along the district boundaries. The unit of analysis is the subdivision, one tract within one election district. A tract inside one district is one subdivision; a tract spanning districts is split, and every piece keeps the whole tract's poverty rate and income. Each subdivision is assigned its district's site, and its outcome is whether that site lies in its own tract. Overlaps under 10 meters wide, where tract and district boundaries disagree by a few meters, are dropped as slivers (0.1% of the overlap area). The same H0 to H6 tests run on subdivisions, written to `nyc_tracts_poll_assignment.report.md` and `.report.json`.

Parsing covers all 4,285 EDs (the water-included district layer; the shoreline layer has 4,214) and 157 distinct sites, the same sites as the poll site map. Two PDF addresses are aliased to the map's spelling (`ADDRESS_ALIASES` in `nyc_tracts/early_voting.py`); the run stops with a list when any assigned address matches no site.

### Subdivision pieces

`nyc_tracts_geojson.py` writes each tract by election district subdivision as a piece of the map, with its distance to the assigned early voting site (bands: within 1/4 mile, 1/4 to 1/2, 1/2 to 1, over 1 mile). Low population tracts are split the same way but left out of the analysis, and zero population tracts are drawn whole. Slivers under 10 meters wide are dropped, so the piece count (about 7,750 analyzed) moves by a few with geometry precision.

## Source cache

The sources change rarely (Census tables, tract boundaries, the poll site map, geocoder answers, the BOE PDFs, the DCP election districts), so every download goes through one cache in `nyc_tracts/net.py`. Every script loads through it and keeps successful responses in `.cache/` and reuse them for 30 days. Flags: `--cache-dir`, `--max-age-days`, `--refresh` (download everything again and replace the cache), `--no-cache`. An entry is named by a hash of the URL without its `key` parameter, so API keys are never written to disk, and a `.url` file beside each body says what it is. Failed responses are not cached. Delete `.cache/` or pass `--refresh` after BOE posts a revised poll site list ("subject to change").

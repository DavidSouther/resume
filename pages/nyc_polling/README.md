# NYC tracts and early voting poll sites

`nyc_tracts_poll_sites.py` writes eight KML files to `public/nyc_polling/` for Google My Maps: `nyc_tracts_<borough>.kml` for `bronx`, `brooklyn`, `manhattan`, `queens`, and `staten_island`, plus `nyc_tracts_low_population.kml`, `nyc_tracts_zero_population.kml`, and `nyc_poll_sites.kml`. Tracts are colored by poverty rate, one file and one layer per borough.

## Run

```sh
export CENSUS_API_KEY=...   # free: https://api.census.gov/data/key_signup.html
export GOOGLE_MAPS_API_KEY=...   # Geocoding API; locates poll sites (not needed with --skip-polls)
python3 nyc_tracts_poll_sites.py            # tracts + poll sites
python3 nyc_tracts_poll_sites.py --skip-polls
python3 nyc_tracts_poll_sites.py --precision 4 --counties 047   # smaller file, one borough
```

Options: `--out-dir`, `--precision` (default 5), `--skip-polls`, `--counties` (005 Bronx, 047 Brooklyn, 061 Manhattan, 081 Queens, 085 Staten Island), `--census-key`, `--google-key`. A gitignored `nyc_tracts_poll_sites.report.json` next to the script lists joins, geocoded sites, failures, and exclusions. Standard library only.

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

- **Borough layers:** every tract whose poverty universe (population for whom poverty status is determined) is at least the low population cutoff. A tract with residents but no median household income is mapped here, colored by poverty rate, with income shown as "not available" in the pop-up. A tract with no poverty rate is grey.
- **Low population** (`nyc_tracts_low_population.kml`): poverty universe above 0 and under 1,200 (`--low-population` to change). 1,200 is the Census Bureau minimum for a standard tract (optimum 4,000, maximum 8,000), so a tract below it is not a standard residential tract, often an institution or a mostly non-residential area, and its ACS estimates carry very wide margins of error. The pop-up keeps poverty, income, and raw values.
- **Zero population** (`nyc_tracts_zero_population.kml`): no residents in the poverty universe (parks, water, airports, and similar), or no ACS row.

## Output counts (full run, 2026-10-09)

Files: 2158 borough-layer tracts (Bronx 335, Brooklyn 759, Manhattan 285, Queens 663, Staten Island 116), `nyc_tracts_low_population.kml` with 81 tracts, `nyc_tracts_zero_population.kml` with 86 tracts, and `nyc_poll_sites.kml` with 157 points. Sizes are in the report.

- Tract boundaries (NYC DCP, clipped to the shoreline, so no harbor or river water): 2325. ACS rows: 2327. The 2 ACS rows with no boundary (36047990100, 36081990100) are tracts entirely under water.
- Class distribution: under 10% 694, 10-20% 777, 20-30% 369, 30-40% 206, 40% and over 112.
- Low population (under 1,200 in the poverty universe): 81 tracts, 16 of them under 100 people. Zero population: 86 tracts.
- Margins of error that Census reports as sentinels (for example -333333333 on a top-coded income of $250,001) are shown as absent.
- Source placemarks: 183. Poll sites in source: 157. With KML Point: 11. Google geocoded: 146. Geocode failures: 0. Poll sites written: 157. Sites in no tract: 0.

### Geocoding

The Census Geocoder is no longer used. It matched 135 of the 146 sites without a Point and missed 11: 3000 Emmons Avenue, 8301 Shore Road, 400 Irving Avenue, 1065 Elton Street (Brooklyn); 4-31 Beach 129 Street, 110-00 Rockaway Boulevard, 79-25 Winchester Boulevard, 120-55 Queens Boulevard, 65-30 Kissena Boulevard, 80-00 Utopia Parkway, 1 Court Square (Queens). The Google Geocoding API located all 146 in the 2026-10-09 run. Against the earlier Census coordinates, 6 sites moved more than 0.1 mile, the most by 0.2 mile (6541 Hylan Boulevard). Pop-ups say each site was located by Google. A site that fails to geocode is listed under `geocode_failed` in the report and left off the map.

- **My Maps imports only the first 2000 placemarks of a file.** A single KML with 2327 tracts plus poll sites kept 2000 tracts (Queens cut short, no Staten Island) and no poll sites, whether imported as a map or a layer. Output is now one file per borough plus a poll sites file, each under 2000 placemarks, so there is no combined KML.

## Known data issues

- 23 poll site rows have tract/poverty text or nothing in the Election field (for example `Tract 261; 14.5%`). They are kept, and listed under `election_field_flagged` in the report. The original description HTML is preserved in the pop-up unchanged.
- "153 35th Street" and "1 Court Square" have no address element and no styleUrl. They are geocoded from the name, borough, and zip.
- Tract polygons are TIGERweb full extent, so they include harbor and river water. Coloring tints water near the shore.

## Import into My Maps

1. Run the script (it writes to `public/nyc_polling/`), deploy, and note the eight public URLs under `https://davidsouther.com/nyc_polling/`.
2. Google My Maps > Create a new map > Import > upload or paste the URL of one file. Then use "Add layer" > Import for each other file (eight layers in all). Use Import, not "Reimport layer": reimport keeps a layer's existing style and ignores the KML colors.
3. Share > "Anyone with the link can view", then Share > Embed and copy the `mid` into `PUBLISHED_MAP_ID` in `page.ts`.

`page.ts` renders `/nyc_polling/` with that embed and links the eight files.

## Disparate impact tests

`python3 nyc_tracts_poll_disparity.py` reads the generated KML files (no network, no Census key) and writes `nyc_tracts_poll_disparity.report.md` and `.report.json`. Baseline H0: higher poverty tracts are more likely to have no poll site inside the tract. H1 to H6 (two group collapse, within borough, centroid distance over 0.25, 0.5 and 1 mile, income quintiles) are Holm corrected. Tests: `python3 -m unittest` in this folder.

# Design: MapLibre web map for NYC polling (quick loop)

Replace the Google My Maps embed with a MapLibre GL JS page over the OpenFreeMap positron basemap. KML downloads are dropped from the page. Generated files stay local (untracked); committing them is deferred.

- `nyc_tracts/geojson.py` and `nyc_tracts_geojson.py`: convert existing KML layers to three GeoJSON files (tracts, assignment, poll sites) with `layer`, `fill`, `popup`, `name` properties and a `legend`. Pop-up HTML is sanitized with an allowlist.
- `pages/nyc_polling/page.ts` and `src/components/nyc_polling/client.ts`: layer radio (poverty, distance), area checkboxes filtering by `layer`, poll site toggle, legend, click pop-ups. Assignment loads lazily.
- Feature test: `/nyc_polling/` renders tracts, poll sites, toggles, and pop-ups in a browser with no console errors (verified with playwright-cli); `uv run run_tests.py` green (65 tests); `npm run check` clean.

Deferred: PMTiles, committing or generating GeoJSON in deploy, no-JS fallback beyond a notice.

# NYC polling map: sharing options beyond Google My Maps

Research date 2026-10-11. Early voting starts 2026-10-24 (13 days). Facts below carry a source number; items marked **UNVERIFIED** could not be confirmed against a primary source.

## 0. Findings that change the decision

1. **Google My Maps cannot hold this data at current resolution, independent of the 2,000-row import cap.** A map is limited to 10 layers, 2,000 features per layer, 10,000 features per map, and **50,000 total points (vertices) in lines and shapes** per map [1]. Measured from `public/nyc_polling/*.kml` on 2026-10-11:

   | Set | Files | Placemarks | Vertices | KML size |
   |---|---|---|---|---|
   | Tracts | 7 | 2,325 | 174,276 | 4.71 MB |
   | Assignment | 9 | 7,918 | 314,254 | 12.88 MB |
   | Poll sites | 1 | 157 | 157 | 0.14 MB |

   The tract set alone is 3.5x over the 50,000-vertex map cap. Tracts plus sites need 8 layers; assignment plus sites need 10 layers, which is the cap, so the two datasets cannot share one map. Import is also capped at 5 MB unzipped KML/KMZ and 2,000 rows per file [2]. No 2026 change to these limits was found; the help pages fetched on 2026-10-11 state the numbers above [1][2].
2. **The site host supports HTTP range requests.** `.github/workflows/deploy.yml` builds `docs/` and deploys it with `actions/upload-pages-artifact@v3` and `actions/deploy-pages@v4`; `public/CNAME` is `davidsouther.com`. DNS is Cloudflare (NS `wally`/`hans.ns.cloudflare.com`, A records 172.67.196.225 and 104.21.68.162), proxied in front of GitHub Pages (response headers `server: cloudflare`, `x-github-request-id`, Fastly `x-served-by`). Live probes on 2026-10-11:

   | Request | Result |
   |---|---|
   | `Range: bytes=100-199` on `/David_Souther_CV.pdf` with `Accept-Encoding: gzip, br` | `206`, `content-range: bytes 100-199/69619`, no `content-encoding`, `access-control-allow-origin: *` |
   | same on `/dma_1_straight_through.png` | `206`, no encoding |
   | same on `/` (HTML) | `206` but `content-encoding: gzip`, range applies to compressed bytes |

   Consequence: a `.pmtiles` file works only if served uncompressed. `.pmtiles` is not in mime-db, so GitHub Pages serves it as `application/octet-stream` (**UNVERIFIED** by live probe, inferred from mime-db [3] and the binary probes above). Cloudflare does not compress `application/octet-stream` but does compress `application/geo+json` [4]. Cloudflare does not cache `.pmtiles`, `.json`, or `.geojson` by default, so those requests pass through to GitHub Pages [5]. Weak ETags (`W/"..."`) are returned; PMTiles uses ETag to detect archive changes, and weak-ETag interaction is **UNVERIFIED**.
3. **Host limits.** GitHub Pages: published site at most 1 GB, soft bandwidth 100 GB/month, deployment timeout 10 minutes, HTTP 429 on rate limiting [6]. GitHub blocks files over 100 MB in git (**UNVERIFIED** in this pass; the Pages limits page lists only the 1 GB repository recommendation [6]). Cloudflare Free caches files up to 512 MB [5]. The current KML total is 17 MB, so none of these bind.
4. **Current page state.** `pages/nyc_polling/page.ts` embeds `https://www.google.com/maps/d/embed?mid=10uQAlVO5wBkETzGnkm1no2f1LYGmt1w` (the source poll-site map, not the new data) and links 8 KML files. `/nyc_polling/nyc_poll_sites.kml` returns 404 on the live site because `public/nyc_polling/` is untracked.

## 1. Self-hosted static options

### 1.1 Library facts (npm registry, 2026-10-11)

| Package | Latest | Published | License | Size (measured, gzip -9) | Notes |
|---|---|---|---|---|---|
| `maplibre-gl` | 6.13.0 | 2026-10-06 | BSD-3-Clause | `maplibre-gl.mjs` 1.08 MB raw / 285 KB gz; `maplibre-gl-worker.mjs` 508 KB / 144 KB gz; CSS 83 KB / 10 KB gz | ESM-only since 6.0.0; UMD and CSP bundles removed; worker loaded as a real URL relative to `import.meta.url`, auto-loaded for CDN use [7][8]. Types ship at `dist/maplibre-gl.d.ts` (`exports["."].types`). |
| `pmtiles` | 4.5.0 | 2026-08-10 | BSD-3-Clause | ESM 15 KB / 5.5 KB gz | `Protocol` plugs into `maplibregl.addProtocol("pmtiles", protocol.tile)` [9]. |
| `tippecanoe` (CLI) | 2.79.0 | 2025-07-24 | BSD-2-Clause | n/a | Writes `.pmtiles` directly with `-o out.pmtiles`; `-L name:file.json` for named layers; `-zg`, `--coalesce-densest-as-needed`, `--extend-zooms-if-still-dropping` [10][11]. Homebrew bottle 2.79.0. Not installed locally. |
| `go-pmtiles` CLI | 1.31.2 | 2026-07-22 | BSD-3-Clause | n/a | `pmtiles extract` for basemap cutouts [12]. |
| `leaflet` | 1.9.4 stable; 2.0.0-alpha.1 | 2023-05-18; 2025-08-16 | BSD-2-Clause | 1.9.4 UMD 148 KB / 42 KB gz | 2.0 is ESM-first, drops global `L` and factory methods, Pointer Events; still alpha [13]. |
| `leaflet-geojson-vt` | 1.1.0 | 2022-01-05 | MIT | small | Unmaintained for 4 years. |
| `geojson-vt` | 5.0.4 | 2026-09-30 | ISC | small | Used internally by MapLibre for GeoJSON sources. |
| `deck.gl` | 9.4.0 | 2026-09-05 | MIT | standalone `dist.min.js` 2.07 MB / 575 KB gz | Overkill for fills and pop-ups. |
| `@protomaps/basemaps` | 5.7.2 | 2026-03-10 | BSD-3-Clause | n/a | Style layers for Protomaps basemap PMTiles. |
| `@observablehq/plot` | 0.6.17 | 2025-02-14 | ISC | n/a | Static SVG geo; no pan/zoom tiles. |
| `@observablehq/framework` | 1.13.4 | 2026-03-02 | ISC | n/a | Static site generator; hosting terms **UNVERIFIED** (docs returned 429). |

### 1.2 Payload estimate

Coordinates only, rounded to 5 decimals, serialized as compact JSON (measured from current KML): tracts 3.63 MB raw / **0.69 MB gzip**; assignment 6.55 MB raw / **1.10 MB gzip**. Properties add some size; pop-up HTML should be built client-side from numeric properties instead of embedded per feature. Cloudflare compresses `application/geo+json` in transit [4]. A PMTiles archive of the same data would be fetched tile by tile, so first paint costs only the visible tiles.

### 1.3 Option comparison

| Option | First-load cost | 10k polygons on mobile | Build step | Pop-ups / toggles / legend | Fit with this repo |
|---|---|---|---|---|---|
| **A. MapLibre + GeoJSON** | ~440 KB gz JS/CSS + 0.7 to 1.1 MB gz per dataset; lazy-load assignment set on toggle | Good: GeoJSON is tiled in the worker by geojson-vt, rendered by WebGL | Python writes `.geojson` next to KML | `map.on("click", layerId, ...)` + `maplibregl.Popup().setHTML()`; `setLayoutProperty(id, "visibility", ...)` or `setFilter` by borough; legend is plain DOM | Same `clientModules` pattern as `pages/astrolabe/page.ts`; load from CDN via meta-tag specifier like `src/components/mermaid/client.ts` |
| **B. MapLibre + PMTiles (tippecanoe)** | ~445 KB gz JS/CSS + only visible tiles | Best | Add tippecanoe (brew locally; CI install **UNVERIFIED**, so commit the built `.pmtiles` to `public/`) | Same as A; features filtered per tile by `["get","borough"]` | Range requests already work (section 0.2) |
| **C. Leaflet 1.9.4 + GeoJSON** | 42 KB gz JS + full GeoJSON | Weak: ~490k vertices as SVG paths; `preferCanvas` helps; `leaflet-geojson-vt` unmaintained | Same as A | Built-in `bindPopup`, `L.control.layers` toggles | Easy, but slowest on phones |
| **D. deck.gl** | 575 KB gz standalone + data | Good | Same as A | Pop-ups and legend are hand-built | Heavy for no gain |

### 1.4 Basemaps without a key

| Basemap | Key | Limits | Terms | Verdict |
|---|---|---|---|---|
| **OpenFreeMap** public instance | No key, no registration, no cookies | "no limits on the number of map views or requests" | Commercial use allowed; attribution "OpenFreeMap © OpenMapTiles Data from OpenStreetMap"; no SLA stated [14][15] | **Best default.** Style URL `https://tiles.openfreemap.org/styles/positron` |
| **Protomaps basemap PMTiles**, self-hosted | No key | Planet 120 GB; NYC cutout via `pmtiles extract --bbox=... --maxzoom=15`; each zoom roughly doubles size; hotlinking build URLs discouraged [16] | ODbL Produced Work, OSM attribution [16] | Best for full independence; adds one binary file (size for NYC at z15 **UNVERIFIED**, estimate tens of MB) |
| OSM standard raster tiles | No key | Best effort, no SLA, may block heavy use; must send valid Referer; attribution visible [17] | OSMF policy | Acceptable for low traffic; avoid for a press-linked page |
| CARTO basemaps | Page now describes keys restricted by domain | 5M req/month non-commercial, 1M commercial free [18] | Attribution "© OpenStreetMap contributors, © CARTO" | Key requirement makes it worse than OpenFreeMap |
| Stadia Maps | Account | 200,000 credits/month free, non-commercial only [19] | | Not needed |
| MapTiler Cloud | API key | 5k sessions/month free, non-commercial [20] | Logo required | A traffic spike exceeds it |

### 1.5 Recipe A (smallest viable, ship before 2026-10-24)

1. Python: alongside each KML writer, emit `public/nyc_polling/tracts.geojson`, `assignment.geojson`, `poll_sites.geojson` with shapely `mapping()`, coordinates rounded to 5 decimals, properties as numbers plus `borough`, `class` (0 to 4, or -1 for missing), `geoid`. One file per dataset, no 2,000-row split.
2. `page.ts`: replace the iframe with `div({id: "map", role: "region", ariaLabel: "..."})`, a DOM legend (`<ul>` with 6 swatches), a `<fieldset>` of checkboxes for datasets and boroughs, a `<noscript>` and a visible link to the table/report, and `clientModules: ["/src/components/nyc-map/client.ts"]`.
3. Head: `link({rel: "stylesheet", href: "https://cdn.jsdelivr.net/npm/maplibre-gl@6.13.0/dist/maplibre-gl.css"})` and a `meta` carrying the module URL (keeps the specifier a variable so Rollup does not resolve it, the same trick as `src/components/mermaid/client.ts`).
4. `client.ts` (types from `npm i -D maplibre-gl` used as `import type`):

   ```ts
   const ml: typeof import("maplibre-gl") = await import(/* @vite-ignore */ url);
   const map = new ml.Map({ container: "map",
     style: "https://tiles.openfreemap.org/styles/positron",
     bounds: [[-74.26, 40.49], [-73.70, 40.92]], cooperativeGestures: true });
   map.on("load", () => {
     map.addSource("tracts", { type: "geojson", data: "/nyc_polling/tracts.geojson" });
     map.addLayer({ id: "tracts-fill", type: "fill", source: "tracts", paint: {
       "fill-color": ["match", ["get", "class"],
         0, "#fee5d9", 1, "#fcae91", 2, "#fb6a4a", 3, "#de2d26", 4, "#a50f15", "#bdbdbd"],
       "fill-opacity": 0.7 } });
     map.addLayer({ id: "tracts-line", type: "line", source: "tracts",
       paint: { "line-color": "#fff", "line-width": 0.3 } });
     map.on("click", "tracts-fill", (e) => new ml.Popup()
       .setLngLat(e.lngLat).setHTML(renderTract(e.features![0].properties)).addTo(map));
   });
   // borough toggle: map.setFilter("tracts-fill", ["in", ["get","borough"], ["literal", on]])
   // dataset toggle: addSource("assignment", ...) on first check, then setLayoutProperty visibility
   ```

   `renderTract` escapes values and builds the existing table markup from `pages/nyc_polling/nyc_tracts/popups.py` semantics.
5. Verify with `playwright-cli` at phone width; deploy via existing workflow by committing `public/nyc_polling/*.geojson`.

Step count: 5. All code paths use documented APIs [7][8][14].

### 1.6 Recipe B (PMTiles upgrade)

1. `brew install tippecanoe`.
2. `tippecanoe -o public/nyc_polling/nyc.pmtiles -zg --coalesce-densest-as-needed --extend-zooms-if-still-dropping -L tracts:tracts.geojson -L assignment:assignment.geojson -L sites:poll_sites.geojson --force` [10][11].
3. Client: `import { Protocol } from "pmtiles"`; `ml.addProtocol("pmtiles", new Protocol().tile)`; source `{ type: "vector", url: "pmtiles:///nyc_polling/nyc.pmtiles" }` (absolute URL may be required; relative-URL handling **UNVERIFIED**); each layer adds `"source-layer": "tracts"` [9].
4. Probe the deployed file with `curl -H 'Range: bytes=0-126' -D -` and confirm `206` and no `content-encoding`.
5. Optional: replace OpenFreeMap with a Protomaps NYC cutout (`pmtiles extract https://build.protomaps.com/<date>.pmtiles nyc-base.pmtiles --bbox=-74.26,40.49,-73.70,40.92 --maxzoom=15`) and `@protomaps/basemaps` layers [16].

Caveat: tippecanoe simplifies and may drop features at low zoom; a pop-up on a coalesced feature at low zoom can show merged properties. Set `-z` so pop-ups are read at the full-detail zoom, or keep GeoJSON for click lookups.

## 2. Hosted services

| Service | Free tier (2026) | Embed | Data fit (10k polygons, styled, HTML pop-ups) | Scriptable update | Verdict |
|---|---|---|---|---|---|
| **Google My Maps** | Free | iframe | Fails: 50k vertex cap per map, 10 layers, 2,000 per layer [1]; 5 MB/2,000 rows per import [2]; restyle by hand after import | No API | Current pain; infeasible at full resolution |
| **Felt** | Free: 3 seats, 25 viewers, 10k views/month, **embeds not allowed, no API**; Team $199/mo annual has embeds, no API; Business $599/mo annual has REST API [21] | Paid only | Good (uploads GeoJSON/KML, FSL styling) | REST `/maps/{id}/upload`, `/layers/{id}/update_style`; Business or free trial only [22] | Too expensive for a personal page |
| **Mapbox** (Studio + GL JS) | 50,000 web map loads/month free, then $5/1,000; 300 MB console upload; tileset processing free tiers [23][24] | Own page with token | Good | Uploads/MTS APIs | Needs token and account with billing (credit card **UNVERIFIED**); MapLibre gives the same for free |
| **CARTO** | 30-day trial only, no production use [25] | Paid | Good | APIs | No |
| **Datawrapper** locator/choropleth | Free plan, unlimited views, embed [26] | iframe | Fails: custom basemap upload max **2 MB**, recommended under 500 KB [27]; one region set per map | API credit billing from 2026-10-01 [26] | Only for a simplified borough-level summary |
| **Flourish** | Free plan, public projects, attribution, custom GeoJSON regions [28] | iframe | Upload size limits **UNVERIFIED**; 10k polygons unlikely to be smooth | Live data on paid Publisher plan | Weak fit |
| **Kepler.gl** | Free OSS (3.3.0-alpha.16, 2026-10-09) | Export standalone HTML (needs your own Mapbox token) or Dropbox permalink [29] | Good rendering, analyst UI not public-friendly | No hosted API | No |
| **geojson.io** | Free | Link only | `#data=data:text/x-url,<url>` loads CORS GeoJSON; `#id=gist:` loads gists [30]; no class styling legend | URL construction | Useful as a "open raw data" link, not the map |
| **GitHub rendered GeoJSON** | Free | No embed | Files over 10 MB cannot render [31]; simplestyle support **UNVERIFIED** | git push | Not a public map |
| **Google Earth web** | Standard plan 1 GB storage, 250 MB per file [32]; 10,000 features per import, 20,000 per project (third-party summary, **UNVERIFIED** in primary docs) | Share project link, no iframe found | Assignment set (7,918) fits one import | No public API | Heavy UI on mobile |
| **Google Maps Platform** (Maps JS, data-driven styling) | 10,000 free Dynamic Maps events/month, then $7/1,000; API key and billing account required [33] | Own page | Good | Yes | Billing risk on a viral link |
| **ArcGIS Online public account** | Free, personal non-commercial; can share maps and StoryMaps publicly; **cannot publish hosted layers**; 2 GB storage [34] | iframe | Must load data by URL instead of hosting | No | Possible but clumsy |
| **uMap** (umap.openstreetmap.fr) | Free, AGPL-family license (**UNVERIFIED**, repo license file reads "Other"); latest 3.8.1, 2026-08-19 [35] | iframe | Remote data URL (GeoJSON/KML, CORS, optional cache), choropleth layer with ColorBrewer classes, popup templates [35][36] | Remote data URL refreshes from davidsouther.com; map config itself is manual | **Best hosted no-code option**; Leaflet SVG performance with 10k polygons **UNVERIFIED** |

## 3. Accessibility, privacy, no-JS fallback

| Concern | MapLibre self-hosted | Google My Maps iframe |
|---|---|---|
| Keyboard | Built-in KeyboardHandler: arrows pan, `+`/`-` zoom, Shift+arrows rotate/pitch [37]. Polygons are canvas pixels, not focusable; provide a list or search for tract lookup | Google controls; not configurable |
| Screen readers | Canvas content is invisible; give the container `role="region"` and `aria-label`, keep legend and toggles as real HTML, and link a data table | Opaque iframe |
| Mobile gestures | `cooperativeGestures: true` prevents scroll trapping | Google default |
| Third-party requests | OpenFreeMap: no cookies [14]; jsDelivr sees IPs unless MapLibre is self-hosted under `/assets` | Google sets cookies and loads Google scripts in the iframe (**UNVERIFIED** in this pass; standard Google embed behavior) |
| Existing tracking | Site already sends Google Analytics (`ARCHITECTURE.md` line 81) | |

No-JS fallback: `<noscript>` plus an always-visible link to (a) a static HTML table of tracts by borough with poverty class and assigned early voting site, generated from the same Python report data (`nyc_tracts_poll_assignment.report.md` already exists), and (b) the GeoJSON/KML downloads. A static PNG choropleth (rendered once by Python or playwright) can sit in the page as `<img>` with alt text and be replaced by the live map on load.

## 4. Ranking

| Rank | Option | Tradeoffs | Steps | Ship by 2026-10-24 |
|---|---|---|---|---|
| **1** | **MapLibre GL JS 6.13 + GeoJSON + OpenFreeMap positron** | Free, keyless, deployed and reproducible from the repo, one file per dataset, full styling and HTML pop-ups, borough and dataset toggles. Cost: ~440 KB gz library + 0.7 to 1.1 MB gz data per dataset; client code to write; depends on OpenFreeMap uptime (no SLA) | 5 (recipe 1.5) | **Yes** |
| **2** | **MapLibre + tippecanoe PMTiles** (optionally Protomaps basemap cutout) | Fastest on mobile, fully self-contained with basemap cutout; range requests verified on the host. Cost: tippecanoe dependency, binary artifact in git, generalization at low zoom, two extra verification steps | Recipe A + 5 | Yes if A ships first; PMTiles is a drop-in source swap |
| **3** | **uMap with remote data from davidsouther.com GeoJSON** | No client code, iframe embed, choropleth and popup templates, data refreshes from the repo's deployed files. Cost: manual map configuration in a web UI, third-party host, mobile performance with 10k SVG polygons unverified, styling less precise | 4 (emit GeoJSON, deploy, create uMap layers with remote URL + choropleth, embed) | Yes, as a fallback |

Not recommended: Google My Maps (vertex and layer caps make the full dataset impossible without heavy simplification), Felt (embed and API are paid), Datawrapper (2 MB basemap cap), Google Maps Platform and Mapbox (keys and billing for no gain over MapLibre), deck.gl (bundle size).

**Smallest version to ship:** Recipe A with only the tracts dataset, poll-site points, borough filter, legend, pop-ups, and a link to the report table. Add the assignment dataset as a lazy-loaded toggle second. Move to PMTiles after election week if mobile profiling shows jank.

## Sources

[1] Google, "My Maps limits" (help page listing per-map and per-layer limits), https://support.google.com/mymaps/answer/3024837 (accessed 2026-10-11).
[2] Google, "Import map features from a file," https://support.google.com/mymaps/answer/3024836 (accessed 2026-10-11).
[3] jshttp, "mime-db db.json," https://cdn.jsdelivr.net/npm/mime-db/db.json (accessed 2026-10-11).
[4] Cloudflare, "Content compression," https://developers.cloudflare.com/speed/optimization/content/compression/ (accessed 2026-10-11).
[5] Cloudflare, "Default cache behavior," https://developers.cloudflare.com/cache/concepts/default-cache-behavior/ (accessed 2026-10-11).
[6] GitHub, "GitHub Pages limits," https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits (accessed 2026-10-11).
[7] MapLibre, "maplibre-gl-js CHANGELOG (6.0.0 to 6.13.0)," https://github.com/maplibre/maplibre-gl-js/blob/main/CHANGELOG.md (accessed 2026-10-11).
[8] MapLibre, "maplibre-gl-js README," https://github.com/maplibre/maplibre-gl-js ; npm registry https://registry.npmjs.org/maplibre-gl (accessed 2026-10-11).
[9] Protomaps, "PMTiles for Browsers + NodeJS," https://github.com/protomaps/PMTiles/blob/main/js/README.md ; npm https://registry.npmjs.org/pmtiles (accessed 2026-10-11).
[10] Felt, "tippecanoe README," https://github.com/felt/tippecanoe/blob/main/README.md (accessed 2026-10-11).
[11] Felt, "tippecanoe releases (2.79.0, 2025-07-24)," https://github.com/felt/tippecanoe/releases (accessed 2026-10-11).
[12] Protomaps, "go-pmtiles releases (v1.31.2)," https://github.com/protomaps/go-pmtiles/releases (accessed 2026-10-11).
[13] Leaflet, "Leaflet 2.0.0-alpha announcement," https://leafletjs.com/2025/05/18/leaflet-2.0.0-alpha.html ; releases https://github.com/Leaflet/Leaflet/releases (accessed 2026-10-11).
[14] OpenFreeMap, "Home / terms," https://openfreemap.org/ (accessed 2026-10-11).
[15] OpenFreeMap, "Quick start," https://openfreemap.org/quick_start/ (accessed 2026-10-11).
[16] Protomaps, "Basemap downloads," https://docs.protomaps.com/basemaps/downloads ; "Cloud storage," https://docs.protomaps.com/pmtiles/cloud-storage (accessed 2026-10-11).
[17] OpenStreetMap Foundation, "Tile usage policy," https://operations.osmfoundation.org/policies/tiles/ (accessed 2026-10-11).
[18] CARTO, "Basemaps," https://carto.com/basemaps (accessed 2026-10-11).
[19] Stadia Maps, "Pricing," https://stadiamaps.com/pricing (accessed 2026-10-11).
[20] MapTiler, "Cloud pricing," https://www.maptiler.com/cloud/pricing/ (accessed 2026-10-11).
[21] Felt, "Pricing," https://felt.com/pricing (accessed 2026-10-11).
[22] Felt, "REST API getting started," https://developers.felt.com/rest-api/getting-started (accessed 2026-10-11).
[23] Mapbox, "Pricing," https://www.mapbox.com/pricing (accessed 2026-10-11).
[24] Mapbox, "Troubleshooting uploads," https://docs.mapbox.com/help/troubleshooting/uploads/ (accessed 2026-10-11).
[25] CARTO, "Pricing," https://carto.com/pricing (accessed 2026-10-11).
[26] Datawrapper, "Pricing," https://www.datawrapper.de/pricing (accessed 2026-10-11).
[27] Datawrapper Academy, "How to upload your own map," https://www.datawrapper.de/academy/how-to-upload-your-own-map (accessed 2026-10-11).
[28] Flourish, "Pricing," https://flourish.studio/pricing/ (accessed 2026-10-11).
[29] kepler.gl, "Save and export," https://docs.kepler.gl/docs/user-guides/k-save-and-export ; releases https://github.com/keplergl/kepler.gl/releases (accessed 2026-10-11).
[30] Mapbox, "geojson.io API.md," https://github.com/mapbox/geojson.io/blob/main/API.md (accessed 2026-10-11).
[31] GitHub, "Working with non-code files (mapping GeoJSON/TopoJSON)," https://docs.github.com/en/repositories/working-with-files/using-files/working-with-non-code-files (accessed 2026-10-11).
[32] Google, "Manage imported data layers and storage (Google Earth)," https://developers.google.com/maps/documentation/earth/manage-layers-storage (accessed 2026-10-11).
[33] Google, "Google Maps Platform pricing," https://developers.google.com/maps/billing-and-pricing/pricing (accessed 2026-10-11).
[34] Esri, "ArcGIS Online FAQ (public accounts)," https://doc.arcgis.com/en/arcgis-online/reference/faq.htm (accessed 2026-10-11).
[35] uMap, "Changelog (3.8.1)," https://docs.umap-project.org/en/stable/changelog/ ; repo https://github.com/umap-project/umap (accessed 2026-10-11).
[36] Y. Boniface, "uMap diary (choropleth layer, remote data)," https://www.openstreetmap.org/user/ybon/diary/402589 (accessed 2026-10-11; secondary, author is uMap maintainer).
[37] MapLibre, "KeyboardHandler API," https://maplibre.org/maplibre-gl-js/docs/API/classes/KeyboardHandler/ (accessed 2026-10-11).

Repo evidence: `.github/workflows/deploy.yml`, `public/CNAME`, `package.json`, `pages/nyc_polling/page.ts`, `pages/astrolabe/page.ts` (`clientModules`), `src/components/mermaid/client.ts` (CDN specifier via meta tag), `ARCHITECTURE.md` line 81, live `curl` probes of https://davidsouther.com on 2026-10-11.

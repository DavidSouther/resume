# Developer Tasks

- **Astrolabe project** (`.ailly/developer/2026-06-14-A-astrolabe/`) — **Phase: Implement.** All three features built behind the dark `/astrolabe/` gate (F1 `2026-06-14-B-astrolabe-shell/`, F2 `2026-06-14-C-astrolabe-dial/`, F3 `2026-06-14-D-astrolabe-motion/`). 233/233 tests green; thesis test (Earth pinned at 3 o'clock) green and runtime-confirmed under animation; six-section `#debug` panel via the contributed-section registry. The Closing Bell has NOT been run (deliberately deferred). Refinement queue for upcoming sessions:
  - **Layout / responsive fill.** The watch renders small and pinned top-left; the design wants a portrait watch that fills the width (and the dial filling the width on a phone). Top visual refinement.
  - **Zodiac band geometry.** Sign glyphs sit at varying radii rather than a clean ring at the outer radius; tighten to a true rim band.
  - **Hands.** Confirm hour/minute hands render in Realtime and hide in Fast (not visually verified this session).
  - **`astronomia` CDN precision validation** against the Meeus snapshot (F2 deferred).
  - **Deferred spec controls** (from the project design Summary): sign hover/tap info cards, device-tilt parallax, sign-wedge colour blending for crowded signs, conjunction line + tightness, sign dividers + highlight, global reset.
  - **Run the Closing Bell** (`closing-bell.md`) once the above land, then retire the release flag: add `"/astrolabe"` to `staticRoutes` in `scripts/sitemap.ts::buildSitemap` and link it from nav.
  - **Commit.** The entire project is uncommitted on `main`; the controlling agent did not commit (awaiting explicit permission). Attribute commits `Co-Authored-By: "Ailly <developer@ailly.dev>"`.

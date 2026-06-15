# F2: Dial & Finish — Feature Design

*Draft 2026-06-14*

Feature of the Astrolabe Watch project. This is **F2**, the heaviest feature: it
carries the thesis (Earth pinned at 3 o'clock), the ephemeris math, and the
guilloché finish. It populates the empty dial F1 shipped, and contributes the
guilloché and per-body color #debug panels through the F1 controls registry.

## Purpose

F1 ships a platinum case wrapping an **empty** dial container
(`[data-astrolabe-dial]`). A reader who opens `/astrolabe/` sees a watch with no
sky. F2 fills that dial: the Sun at center, the eight planets on a fixed
log-radial ring, and the Moon riding the Earth marker — with **Earth held still
at 3 o'clock**, the geocentric thesis that makes this watch unusual. F2 also
gives the dial its luxury finish (a prebaked guilloché texture under midnight
lacquer, with a twilight dead-zone wedge) and the debug surface that later
sessions use to tune the look (guilloché sliders, per-body color pickers).

## Prior Art

See the project design (`.ailly/developer/2026-06-14-A-astrolabe/design.md`) and
the settled shared contracts in the project plan
(`.ailly/developer/2026-06-14-A-astrolabe/plan.md` §"Shared contracts"). Do not
repeat them here; this design only records F2's slice and how it binds to those
contracts.

In-repo idioms F2 follows:

- **SVG authoring via jiffies factories** — `src/components/trip/icons.ts`:
  `svg(...)` from `@davidsouther/jiffies/dom/svg.ts`, with `el.innerHTML` for raw
  glyph path strings. F2 uses the same factory set (`svg`, `g`, `circle`,
  `path`, `defs`, `use`, `image`, and the `fe*` filter primitives — all confirmed
  exported from `@davidsouther/jiffies/dom/svg.ts`).
- **F1 controls registry** — `src/components/astrolabe/controls.ts`
  (`registerControlsSection`, `ControlsSection`) and the contribution idiom in
  `src/components/astrolabe/material-section.ts`. F2 contributes two more
  sections the same way; the client re-registration idiom is
  `src/components/astrolabe/controls-client.ts`.
- **Build scripts** — `scripts/sitemap.ts`, `scripts/enrichment-lint.ts`:
  plain-ASCII kebab-case `.ts`, invoked `node script.ts` on Node 24 (no
  strip-types flag).

## User Journey & Metrics

A reader opens `/astrolabe/` cold. Where F1 showed an empty platinum dial, they
now see a populated geocentric sky: a warm Sun at center, the planets ringed
outward by distance, the Moon clinging to Earth, and **Earth fixed at the 3
o'clock position** — the watch's signature. The dial ground reads as engine-
turned metal under deep midnight lacquer, with a darker twilight wedge. A reader
who appends `#debug` to the URL gets guilloché sliders and per-body color
pickers to refine the finish.

Metrics (Closing Bell tasks this feature advances):

- **T1 — recognize it / dial legibility (primary):** bodies render distinctly on
  the case; the finish reads as a luxury dial.
- **T2 — read a position (primary):** each body is an identifiable
  `[data-body]` marker at its geocentric direction and log-radial distance.
- **T4 — read togetherness (secondary):** the guilloché sightlines and the
  twilight wedge read off the same Earth-centered conjunction system.
- **T5, color half (secondary):** per-body color pickers under `#debug` write the
  Contract 3 color tokens.

The single executable acceptance test (below) encodes the date-invariant core of
T1/T2 and the thesis. Finish quality (T4) and live token repaint (T5) are
browser-verified during the build phase, not unit-asserted — they are visual.

## Specification

F2's components and files, and how each produces or consumes a shared contract.
All paths are under `pages/astrolabe/`, `src/components/astrolabe/`, `src/lib/`,
and `scripts/`.

### Coordinate math — `src/lib/astro-math.ts` (PRODUCES Contract 1)

The Contract-1 surface: `PLANET_ORDER`, `SEMI_MAJOR_AXIS_AU`, `R_INNER`,
`R_OUTER`, `BodyPosition`, `logRadius`, `geocentricTransform`,
`geocentricPositions`.

**Reconciliation with F1 (load-bearing):** the project plan's Contract 1 lists
`BodyName` as exported from `astro-math.ts`, but F1 **already declares** the
`BodyName` type and `bodyColorVar` in `src/lib/astro-tokens.ts`. `astro-math.ts`
MUST NOT redeclare `BodyName`; it imports it from `astro-tokens.ts` and
**re-exports** it (`export type { BodyName } from "./astro-tokens.ts"`) so the
Contract-1 import site (`import { BodyName } from astro-math`) still resolves to
a single source of truth. `SEMI_MAJOR_AXIS_AU` is keyed by that `BodyName`.

`logRadius` is the date-independent log10(AU) → `[R_INNER, R_OUTER]` map.
`geocentricTransform(angleRad, radius)` applies the constant rotation that pins
Earth on the +x ray and returns `{x, y}` in SVG space (+x right, +y down).
`geocentricPositions(date)` returns one `BodyPosition` per body; the Sun is at
radius 0, the Moon's `(x,y)` is offset from Earth's anchor (not center). The
F2 plan tunes the deferred constants (`R_INNER`/`R_OUTER`, Moon offset, Meeus
term set).

### Ephemeris — `src/components/astrolabe/ephemeris.ts` (PRODUCES Contract 1)

Wraps `geocentricPositions`: computes inline from the low-precision Meeus
formulae (self-sufficient base), falls back to the build snapshot
(`src/lib/astro-snapshot.ts`), with the optional `astronomia` CDN override. The
snapshot and CDN are freshness/precision layers; the inline base means the dial
is never empty even if a generator is absent at runtime.

### Dial component — `src/components/astrolabe/dial.ts` (CONSUMES Contracts 1, 3, 4)

Builds the `<svg viewBox="-500 -500 1000 1000">` and the body `<g
data-body="…" transform="translate(x,y)">` groups from `geocentricPositions`,
the guilloché `<image>`/filter, and the twilight wedge `<path>`. Body fills
reference the Contract-3 color tokens via `fill="var(--color-<body>)"`
(consuming Contract 3); the guilloché lacquer references the Contract-4 finish
tokens (consuming Contract 4). Kept under ~800 lines; split a guilloché-builder
helper out if it grows.

### Top-level wiring — `src/components/astrolabe/astrolabe.ts` (CONSUMES Contract 1)

F1's `Astrolabe()` builds an empty `DialContainer()`. F2 populates it so that
`mount(Astrolabe())` renders the SVG and body groups in the tree (the feature
test mounts `Astrolabe()`). The dial SVG is appended into the
`[data-astrolabe-dial]` host at build time; the change is additive — the F1
shell structure (figure, case, controls host) is preserved. Existing F1 tests
(`shell.feature.test.ts`) must stay green; F1 asserted "no `[data-body]`", so the
F2 build phase updates that single F1 assertion as part of the contracted
hand-off (the F1 test documents the empty slot as F2's to fill).

### Debug sections (CONSUME Contracts 2, 3, 4)

Registered through `registerControlsSection` (Contract 2), gated `debugOnly:
true`, mirroring `material-section.ts`:

- `src/components/astrolabe/guilloche-section.ts` — the five sliders (density,
  pitch, relief, glint, lacquer) plus a **flat-finish** alternative toggle. Live
  values drive the SVG filter / swap to flat. Comprehensive and well-organized,
  per the session's debug-panel emphasis.
- `src/components/astrolabe/color-section.ts` — per-body color pickers writing
  `element.style.setProperty(bodyColorVar(body), value)` (Contract 3). Both
  re-registered client-side in `controls-client.ts` so they appear live under
  `#debug`.

### Client hydration (CONSUMES Contracts 1, 2)

The dial SVG and the new debug sections need a browser surface. F2 extends the
F1 `clientModules` hook on `pages/astrolabe/page.ts` (currently
`["/src/components/astrolabe/controls-client.ts"]`) with the dial hydration
module, and re-registers the guilloché/color sections client-side. The exact
hydration mechanism (a new client module vs. extending `controls-client.ts`) is
deferred to the F2 plan.

### Build scripts (PRODUCE the prebaked literals)

- `scripts/update-ephemeris-snapshot.ts` → writes `src/lib/astro-snapshot.ts`.
- `scripts/render-guilloche.ts` → writes `src/lib/guilloche-image.ts` (the
  prebaked finish data-URI). **Plain-ASCII filenames** (no diacritics), per the
  plan's F2 note, for `node script.ts` and import-path consistency.

Both must run **before** the jiffies SSG render (`page.ts` imports the generated
literals). Whether they extend `prebuild` or become an early `build` step ahead
of the SSG is deferred to the F2 plan, decided against the real build chain
(`css:bundle && sitemap.ts && jiffies SSG`). A generator failure fails the build
loudly rather than shipping stale positions.

### Release gate

F2 does NOT touch `scripts/sitemap.ts` and adds no nav link. `/astrolabe/` stays
dark — built into `docs/` unlisted.

## Alternatives (feature-local)

- **Where the SVG is assembled — in `Astrolabe()` vs. a dedicated `dial.ts`.**
  Chosen: a dedicated `dial.ts` that `Astrolabe()` mounts into the F1 dial host.
  Keeps `astrolabe.ts` a thin composer (its F1 role) and the SVG-heavy code in
  one focused, splittable module. Inlining into `astrolabe.ts` would bloat the
  composer and tangle F1's shell wiring with F2's dial.
- **Redeclare `BodyName` in `astro-math.ts` (as the literal Contract-1 text
  suggests) vs. re-export from `astro-tokens.ts`.** Chosen: re-export. F1 already
  shipped `BodyName` in `astro-tokens.ts`; a second declaration would be two
  sources of truth that drift. Re-export satisfies the Contract-1 import site
  with one canonical type.
- **Guilloché as a live SVG filter in production vs. a prebaked `<image>`.**
  Chosen (per project plan): prebaked `<image>` in production for performance and
  determinism, with the live `feTurbulence`/`feDisplacementMap` builder only
  under `#debug`. F2 honors this split rather than re-deciding it.

## Summary

F2 fills the F1 dial with the geocentric sky and its finish, producing the
Contract-1 coordinate implementation that F3 animates, and contributing the
guilloché and color #debug sections through the F1 registry.

**Feature test:** `src/components/astrolabe/astrolabe.feature.test.ts` — the
project's **thesis** feature test (F2 owns it). Four date-invariant assertions on
`mount(Astrolabe())`: one `<svg>` with `[data-body="sun"]` at center; all
nine bodies present as `[data-body]` groups; Earth's translate on the +x ray
(y≈0, x>0); the eight planet ring radii monotonic by `PLANET_ORDER`.

**Deferred to the F2 plan:** exact `R_INNER`/`R_OUTER` and Moon-offset constants;
Meeus term set; guilloché filter parameters; the client-hydration mechanism;
`astronomia` CDN precision validation; whether the generators extend `prebuild`
or become an early `build` step. **Deferred past F2:** the zodiac band, motion,
and parallax (all F3).

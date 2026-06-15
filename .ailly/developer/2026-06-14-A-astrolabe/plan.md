# Project Plan: Astrolabe Watch

**Closing Bell:** `.ailly/developer/2026-06-14-A-astrolabe/closing-bell.md`

**User story:** A reader opens `/astrolabe/` cold on a phone or laptop, recognizes a luxury astronomical watch showing the current sky with Earth held still at 3 o'clock, reads roughly where the planets are, sets it running into the future, and changes how it looks — all from the page itself.

This is a PROJECT plan: a bounded set of FEATURES, not a feature plan's 3–7 red-green-refactor increments. Each feature below later runs its own design → plan → build → cleanup cycle in its own session folder. This document enumerates the features, settles the shared contracts (the project "Step 0"), and ties each feature to the Closing Bell tasks it advances. Per `developer/references/project-cycle.md`, the project releases only when all three features land and the Closing Bell passes; until then `/astrolabe/` ships dark behind the release gate.

## Features

- [x] **F1: Shell & case** (`astrolabe-shell`) — no dependencies, can start now. Parallel with: none. **Built 2026-06-14** (`2026-06-14-B-astrolabe-shell/`).
- [x] **F2: Dial & finish** (`astrolabe-dial`) — Depends on: F1 (the coordinate container and the controls registration API). Parallel with: none. **Built 2026-06-14** (`2026-06-14-C-astrolabe-dial/`); thesis test green.
- [x] **F3: Motion & sky** (`astrolabe-motion`) — Depends on: F2 (the body groups and the dial geometry). Parallel with: none. **Built 2026-06-14** (`2026-06-14-D-astrolabe-motion/`).

The cut is fully sequential by design choice. It trades concurrency for a legible demo at each step: a shell, then a populated dial, then a moving sky. F2 is the heaviest feature because it carries the thesis, the ephemeris math, and the finish, so its sub-plan will hold the most steps.

```text
[F1 shell] --> [F2 dial & finish] --> [F3 motion & sky]
```

---

## F1: Shell & case

- **Session slug:** `astrolabe-shell`
- **Session folder:** `2026-06-14-B-astrolabe-shell/`
- **Dependencies:** none (can start now). Parallel with: none.
- **Owns thesis:** no.

**What it builds (scoped to the research MVP boundary):**

- `pages/astrolabe/page.ts` — the `/astrolabe/` route as a `PageModule` (`head` + `default`), generated statically.
- The portrait watch wrapper as an HTML `<figure>`: `[strap] / [platinum case] / [empty dial container] / [strap]`. A prebaked static image carries the strap/case decoration; the empty dial container is where F2 mounts the SVG.
- Cormorant Garamond (display) and DM Mono (labels/readouts) Google Fonts `<link>` tags added in `head()`, alongside the standard `pageHead` output.
- The always-visible controls sheet and the `#debug` panel harness, built from a **contributed-section registration API** (F1 owns the registry; see Shared Contract 2). F1 contributes the material section.
- Debug case and strap material options (the F1 controls section), writing the F1 material tokens via `element.style.setProperty`.
- The finish and material CSS tokens (platinum case/bezel, mahogany cordovan strap) declared once here (Shared Contract 4).
- The color-token names declared once here so every later feature consumes a single source (Shared Contract 3).

No bodies and no astronomy.

**Closing Bell tasks advanced:** T1 (recognize it — case presence and portrait framing), and the case/material half of T5 (change the look — material toggles under `#debug`). It stands up the controls sheet that T5 depends on across all three features.

**Shared contracts produced:** (2) Controls-sheet registration (F1 owns the registry and finalizes the section type), (3) Color tokens (names declared), (4) Finish and material tokens. It also stands up the empty dial container at the (1) Coordinate-system contract so F2 can fill it.

**Shared contracts consumed:** none — F1 settles them.

**Deferred to the F1 feature plan:**

- The exact controls-sheet registration field details, finalized in the F1 design before F2 builds against it (the design parks "the controls-sheet registration type, finalized in the F1 design before F2 builds").

---

## F2: Dial & finish

- **Session slug:** `astrolabe-dial`
- **Session folder:** `2026-06-14-C-astrolabe-dial/`
- **Dependencies:** Depends on: F1. Parallel with: none. It mounts the dial into the F1 case and registers its debug panels through the F1 controls harness. The dependency is the coordinate container and the registration API.
- **Owns thesis:** **YES.**

**What it builds (scoped to the research MVP boundary):**

- The SVG dial populated against the coordinate contract (Shared Contract 1): one `<svg viewBox="-500 -500 1000 1000">` with the Sun at center, the eight planets, and the Moon as `<g data-body="…">` groups, Earth pinned at 3 o'clock.
- `src/lib/astro-math.ts` — the log-radial map, the geocentric transform, and angle utilities (Shared Contract 1 signatures).
- `src/components/astrolabe/ephemeris.ts` — `geocentricPositions(date)`, computing inline from the low-precision Meeus formulae, falling back to the build snapshot, with the optional `astronomia` CDN override.
- `scripts/update-ephemeris-snapshot.ts` → `src/lib/astro-snapshot.ts`, and `scripts/render-guilloché.ts` → `src/lib/guilloché-image.ts` (the prebaked finish data-URI). Both run before the SSG render (see SSG Integration below).
- The guilloché finish: prebaked image in production, a live builder under `#debug`. The twilight dead-zone wedge, reading off the same Earth-centered conjunction system as the guilloché.
- Tabler zodiac `<symbol>` definitions are NOT F2's scope — the zodiac band lands in F3. F2 inlines only what the dial needs.
- Debug guilloché sliders (the five: density, pitch, relief, glint, lacquer; plus the flat-finish alternative) and per-body color pickers (writing the Shared Contract 3 color tokens).

**F2 owns the thesis feature test:** `astrolabe.feature.test.ts`, `@vitest-environment jsdom`, `mount(Astrolabe())`. Its four assertions on the rendered tree:

1. one `<svg>` dial, with `[data-body="sun"]` at center;
2. all of `mercury, venus, earth, moon, mars, jupiter, saturn, uranus, neptune` present as `[data-body]` groups;
3. the Earth `translate` is on the +x ray (y near 0, x greater than 0) — the thesis;
4. the eight planet ring radii are monotonic by semi-major axis.

Every assertion is date-invariant under the coordinate contract, so the test needs no date fixture and no snapshot file.

**Closing Bell tasks advanced:** T1 (dial legibility), T2 (read a position — body placement and identifiability), T4 (read togetherness — the guilloché sightlines and twilight wedge; secondary), and the color half of T5 (per-body color pickers under `#debug`; secondary).

**Shared contracts produced:** (1) Coordinate-system implementation (`astro-math.ts` and `geocentricPositions`) that F3 animates. It contributes the guilloché and color sections through the F1 registry.

**Shared contracts consumed:** (1) Coordinate system (fills the F1 dial container at this contract), (2) Controls-sheet registration (appends the guilloché and color sections), (3) Color tokens (writes them from the debug pickers), (4) Finish and material tokens (the guilloché sits on the F1 platinum/cordovan case).

**Deferred to the F2 feature plan:**

- Exact guilloché filter parameters (`feTurbulence` and `feDisplacementMap` tuning).
- The client-hydration mechanism (an inline module script against jiffies `hydrate`).
- `astronomia` CDN precision validation against the Meeus snapshot.
- Whether the two generator scripts extend `prebuild` or become an early `build` step.
- The guilloché generator/output file names. The non-ASCII `é` in `render-guilloché.ts` / `guilloché-image.ts` is legal but diverges from the existing plain-ASCII kebab-case scripts (`update-ephemeris-snapshot.ts`, `sitemap.ts`, `enrichment-lint.ts`) and risks import/path friction on some toolchains and the `node script.ts` invocation. The F2 plan should prefer `render-guilloche.ts` / `guilloche-image.ts` for consistency.

---

## F3: Motion & sky

- **Session slug:** `astrolabe-motion`
- **Session folder:** `2026-06-14-D-astrolabe-motion/`
- **Dependencies:** Depends on: F2. Parallel with: none. It animates the body transforms F2 places and rings the F2 dial with the zodiac band at the outer radius. The dependency is the body groups and the dial geometry.
- **Owns thesis:** no.

**What it builds (scoped to the research MVP boundary):**

- A single `requestAnimationFrame` loop driving all motion, re-applying body `transform` translates from `geocentricPositions(simulatedDate)`.
- **The Realtime/Fast button on the case, outside the controls sheet** — a two-state toggle. Fast runs at roughly one year per minute. This is the **sanctioned deviation** from the visual spec's exponential slider (see Deviation note below). Hands are hidden in Fast.
- Desktop `mousemove` parallax (outer-body groups shift less). Device-tilt parallax is deferred past the MVP.
- The twelve-sign tropical zodiac band at the outer radius, with Tabler stroke-path `<symbol>` glyphs inlined in `<defs>`, and the occupancy highlight (a sign lights when a body is in it; the Moon is not counted as an occupant).
- The geocentric-against-orbital render-mode switch in the always-visible controls (its correctness is verified by browser observation during F3, not by the geocentric thesis test).
- Debug toggles for motion, parallax (on/off and strength), and zodiac/twilight.

**Closing Bell tasks advanced:** T3 (run time forward — the Realtime/Fast control), with contributions to T2/T4 (live motion and zodiac occupancy reinforce position reading) and the visibility/toggle half of T5 (motion, parallax, and zodiac toggles under `#debug`; the geocentric/orbital switch and per-body toggles always visible).

**Shared contracts produced:** none — F3 consumes the existing contracts.

**Shared contracts consumed:** (1) Coordinate system (animates the body transforms and adds the rim at the outer radius), (2) Controls-sheet registration (appends the motion and zodiac sections), (3) Color tokens (zodiac occupancy blends body colors), (4) Finish and material tokens (the moving dial sits on the stable F1 case).

**Deferred to the F3 feature plan:**

- Sign hover/tap info cards (an F3 follow-up).
- Device-tilt parallax (`DeviceOrientationEvent.requestPermission` on iOS).
- Sign-wedge color blending for crowded signs.

---

## Shared contracts (the project "Step 0")

Per `developer/references/project-cycle.md`, the shared interfaces are settled before the dependent features build. Although the features are sequential rather than parallel, F2 and F3 build against these fixed surfaces, so they are pinned here. **Signatures only — no function bodies.** Where the design defers a detail, it is recorded as deferred-to-feature-plan rather than invented.

### Contract 1 — Coordinate & position contract

The dial is one `<svg viewBox="-500 -500 1000 1000">`, center at `(0,0)`, with `+x` at 3 o'clock (screen right) and `+y` downward (SVG convention). Each body is a `<g data-body="…" transform="translate(x,y)">`.

A body position has two independent parts. The **angle** is the body's geocentric ecliptic direction and depends on the date. The **radius** is a fixed log scaling of the body's heliocentric semi-major axis and does not depend on the date. The mapping is linear in `Math.log10(a)` from `a = 0.387 AU` (Mercury) to `a = 30.1 AU` (Neptune), onto the annulus between `r_inner` and `r_outer`. Earth at `log10(1) = 0` anchors a fixed ring. The Sun sits at center (radius 0). The Moon rides the Earth marker as a geocentric satellite and is excluded from the planetary ring ordering.

```typescript
// src/lib/astro-math.ts

/** The bodies rendered on the dial. The eight planets, the Sun, and the Moon. */
export type BodyName =
  | "sun"
  | "mercury"
  | "venus"
  | "earth"
  | "moon"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune";

/** The eight planets, in semi-major-axis order — the ring ordering. Excludes sun and moon. */
export const PLANET_ORDER: readonly BodyName[];

/** Heliocentric semi-major axis, in AU, keyed by body. Mercury 0.387 … Neptune 30.1. */
export const SEMI_MAJOR_AXIS_AU: Readonly<Record<BodyName, number>>;

/** Inner and outer dial radii (SVG user units) bounding the orbit annulus. */
export const R_INNER: number;
export const R_OUTER: number;

/** A rendered body position in SVG user space, the value placed in the <g> transform. */
export interface BodyPosition {
  body: BodyName;
  /** SVG x; positive is toward 3 o'clock. */
  x: number;
  /** SVG y; positive is downward (SVG convention). */
  y: number;
  /** Geocentric ecliptic direction used to derive (x, y), in radians. Date-dependent. */
  angle: number;
  /** Fixed log-radial distance from center; 0 for the Sun. Date-independent. */
  radius: number;
}

/**
 * Fixed log-radial map: semi-major axis (AU) onto [R_INNER, R_OUTER], linear in log10(a).
 * Date-independent. The Sun (radius 0) is handled by the caller, not by this map.
 */
export function logRadius(semiMajorAxisAu: number): number;

/**
 * Geocentric display transform: an ecliptic direction (radians) plus a radius into
 * an (x, y) point, applying the constant rotation that pins Earth on the +x ray.
 * In orbital mode the caller omits/removes that rotation (F3 render-mode switch).
 */
export function geocentricTransform(angleRad: number, radius: number): { x: number; y: number };

/**
 * Per-date body positions for the whole dial. Computed inline from the low-precision
 * Meeus formulae; the snapshot and the optional CDN are freshness/precision layers over
 * this self-sufficient base. The Moon's (x, y) is offset from Earth's anchor, not center.
 */
export function geocentricPositions(date: Date): BodyPosition[];
```

**Deferred to the F2 feature plan:** the exact `r_inner`/`r_outer` numeric values, the Moon's satellite offset magnitude, and the Meeus term set. The signatures above are fixed; the constants are tuned in F2.

### Contract 2 — Controls-sheet registration

F1 owns the registry. The controls component accepts an ordered list of named control-group sections. Later features **append** sections rather than mutate F1 markup. The `Node | Node[]` return lets a section render a fragment.

```typescript
// src/components/astrolabe/controls.ts  (F1 owns; F2 and F3 call register)

/** One contributed control-group section in the controls sheet. */
export interface ControlsSection {
  /** Stable id, used for ordering and de-duplication (e.g. "material", "guilloche", "motion"). */
  id: string;
  /** Human-facing section title shown in the sheet header. */
  title: string;
  /** Renders the section body. A fragment (Node[]) is allowed. */
  render(): Node | Node[];
  /** When true, the section appears only with the #debug URL hash. */
  debugOnly: boolean;
}

/**
 * Append a section to the controls registry. F1 contributes the material section;
 * F2 appends guilloché and color sections; F3 appends motion and zodiac sections.
 * Sections render in registration order. Idempotent on id (re-registering replaces).
 */
export function registerControlsSection(section: ControlsSection): void;

/**
 * Build the always-visible controls sheet from the registered sections, showing
 * debugOnly sections only when the #debug hash is present.
 */
export function ControlsSheet(): Element;
```

**Field details finalized here:** the section shape is exactly `{ id: string; title: string; render(): Node | Node[]; debugOnly: boolean }`, as the design specifies. F1 finalizes any remaining harness wiring (registration ordering, `#debug` gating) in the F1 design before F2 builds.

### Contract 3 — Color tokens

Every body color is a CSS custom property, defined once and consumed everywhere. Debug pickers write them with `element.style.setProperty`.

```css
/* Declared once in F1 (src/global.css or an astrolabe stylesheet). */
:root {
  --color-sun;       /* warm gold */
  --color-mercury;
  --color-venus;
  --color-earth;
  --color-moon;
  --color-mars;
  --color-jupiter;
  --color-saturn;
  --color-uranus;
  --color-neptune;
}
```

```typescript
/** The CSS custom-property name for a body's color, e.g. bodyColorVar("mars") === "--color-mars". */
export function bodyColorVar(body: BodyName): `--color-${BodyName}`;
```

The F2 per-body color pickers and the F3 zodiac occupancy blend both read/write these tokens. A debug picker writes via `element.style.setProperty(bodyColorVar(body), value)`.

### Contract 4 — Finish & material tokens

Platinum case/bezel and mahogany cordovan strap, declared once as CSS tokens in F1 so the F2 guilloché and F3 motion sit on a stable case.

```css
/* Declared once in F1. */
:root {
  --case-platinum;        /* cool white metal, case + bezel */
  --strap-cordovan;       /* mahogany shell cordovan */
  --strap-stitch;         /* tonal stitching */
  --dial-midnight;        /* deep near-black sapphire/midnight dial ground */
  --lacquer-depth;        /* translucent midnight-blue lacquer over the guilloché */
}
```

The F1 debug material section writes `--case-platinum`, `--strap-cordovan`, and the related tokens via `element.style.setProperty`. The exact token values and any additional material tokens are finalized in the F1 design; the names above are the fixed surface F2/F3 consume.

---

## SSG integration / build scripts

`/astrolabe/` is `pages/astrolabe/page.ts` (a `PageModule` with `head` and `default`), generated statically. "Self-contained HTML" means, in this SSG, no database, no SSR data, and all runtime behavior client-side.

Two build scripts run during F2 so the page ships current:

- `scripts/update-ephemeris-snapshot.ts` → writes `src/lib/astro-snapshot.ts` (positions for the build date).
- `scripts/render-guilloché.ts` → writes `src/lib/guilloché-image.ts` (the prebaked finish data-URI literal).

Both must run **before** the SSG renders the page, because `page.ts` imports those generated literals. Today `prebuild` runs `npm run check` (typecheck + Biome) and `build` is a four-part chain: `npm run css:bundle && node scripts/sitemap.ts && node node_modules/@davidsouther/jiffies/lib/esm/ssg/main.js --out docs` (css:bundle → sitemap.ts → the jiffies SSG). The two generators join that build-time sequence; whether they extend `prebuild` or become an early `build` step ahead of the jiffies SSG is settled in the F2 plan, decided against the real four-part chain. **If a generator fails, the build fails loudly** rather than shipping absent or stale positions. As a runtime safety net, `geocentricPositions(date)` computes inline from the Meeus formulae, so the snapshot and the CDN are freshness/precision layers over a self-sufficient base. Both scripts are invoked as `node script.ts` on Node 24 with no strip-types flag, per AGENTS.md.

## Release gate stays dark

`/astrolabe/` ships dark: built into `docs/` but unlisted, with no nav link and no sitemap entry. `scripts/sitemap.ts::buildSitemap` builds its URL set from a `staticRoutes` array (`const staticRoutes = ["/", "/blog"]`, line 14) plus the post routes appended from `getPostPaths()`, so a route is advertised only once its string is added to that array. There is no separate allowlist construct or file: advertising `/astrolabe/` means adding the `"/astrolabe"` string to the `staticRoutes` array in `buildSitemap()`. The gate lifts when the Closing Bell passes, at which point `/astrolabe/` is linked from nav and its string is added to `staticRoutes`. This is the single project-level release flag; no feature-step earns its own, because none changes what users see on its own while the route is dark.

## Decision flagged for the gate

The **animation control** is the one sanctioned deviation from the visual spec, surfaced for the Review gate. The spec specifies a continuous exponential animation-speed slider (real time at rest up to one Saturn orbit per ten minutes). The research user decision replaces it with a **two-state Realtime/Fast button on the case** (Fast ≈ one year per minute), outside the controls sheet. This plan follows the research decision and builds it in F3. Confirm or override at the gate.

(The controls-as-a-contributed-registry is an implementation structure, not a user-visible change, so it is not a gate decision.)

## Stop condition

This is a project plan, not implementation. Do not write tests or production code. When this draft is cleared, each feature runs its own design → plan → build → cleanup cycle in the session folder named in its section, starting with F1 (`2026-06-14-B-astrolabe-shell/`).

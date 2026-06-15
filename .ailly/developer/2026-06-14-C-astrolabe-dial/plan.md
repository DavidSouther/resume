# Implementation Plan: F2 — Dial & Finish

**Feature test:** `src/components/astrolabe/astrolabe.feature.test.ts`
**User story:** A reader opens `/astrolabe/` cold and sees a populated geocentric
sky — one `<svg>` dial with the Sun at center, the eight planets ringed outward
by log-radial distance, the Moon riding Earth, and **Earth held still at 3
o'clock** — on a guilloché-finished midnight dial, with guilloché sliders and
per-body color pickers under `#debug`.

**Steps:**
- [ ] Step 0: API surface area
- [ ] Step 1: Coordinate math — `astro-math.ts` (Contract 1)
- [ ] Step 2: Ephemeris — inline Meeus + snapshot fallback
- [ ] Step 3: Dial component — the populated SVG (passes the feature test)
- [ ] Step 4: Guilloché finish + twilight wedge (prebaked + live builder)
- [ ] Step 5: Debug sections — guilloché sliders + color pickers (Contracts 2/3)
- [ ] Step 6: Client hydration + build scripts (SSG integration)

Six steps. Steps 0–3 take the feature test from RED to GREEN. Steps 4–6 layer
the finish, the debug surface, and the build-time generators on a green test, and
each leaves `npm run check` clean and the feature test still green.

---

## Contract-binding notes (read before any step)

These facts are load-bearing and were verified against the F1 code and the
installed jiffies package. Re-confirm during build; do not re-derive from memory.

- **`BodyName` has one source.** F1 already declares `BodyName` and `bodyColorVar`
  in `src/lib/astro-tokens.ts`. `astro-math.ts` MUST `export type { BodyName }
  from "./astro-tokens.ts"` (re-export) and MUST NOT redeclare it. The feature
  test imports `BodyName` from `astro-tokens.ts` directly and `PLANET_ORDER` /
  `SEMI_MAJOR_AXIS_AU` from `astro-math.ts`; both must agree on the same nine
  names.
- **SVG attributes need `setAttribute`.** The jiffies SVG factories are typed
  `DenormAttrs<SVG…Element>` (the element's own IDL properties). `transform`,
  `viewBox`, and `data-body` are NOT IDL properties, so set them with
  `el.setAttribute(...)` after construction — exactly the idiom F1 uses in
  `dial-container.ts` (`host.setAttribute("data-astrolabe-dial", "")`) and
  `material-section.ts` (`control.setAttribute("data-token", token)`). Passing
  `transform` in the attrs object will be dropped or rejected.
- **Contract 3/4 tokens already exist.** `src/global.css` already declares
  `--color-<body>` for all nine bodies (lines 89–98) and the material tokens
  (lines 102–106). Body fills reference them as `fill="var(--color-<body>)"`; no
  new token names are coined in F2.
- **F1 hand-off (single assertion edit).** `shell.feature.test.ts` currently
  asserts the dial is empty: `dial.querySelector("svg")` is null,
  `dial.querySelector("[data-body]")` is null, and
  `container.querySelector("[data-body]")` is null (lines 53–55). Populating the
  dial breaks those three lines. The design names this the contracted hand-off:
  the step that populates the dial (Step 3) updates `shell.feature.test.ts` so it
  asserts the slot is now filled (one `<svg>` present, bodies present) instead of
  empty. This is the ONLY F1-test change F2 makes; the rest of F1's structure
  stays untouched.
- **Release gate.** Do NOT touch `scripts/sitemap.ts`, do NOT add `/astrolabe`
  to `staticRoutes`, do NOT add a nav link. The route ships dark.
- **Node 24.** Invoke `.ts` scripts as `node script.ts` (no strip-types flag).
  Generator filenames are PLAIN ASCII: `render-guilloche.ts`,
  `guilloche-image.ts` (no diacritics).
- **Verify each step.** `npm run format` then `npm run check` (typecheck +
  biome, TABS) must be clean; `npx vitest run` green. The feature test may stay
  RED through Step 2 and must be GREEN from Step 3 on.

---

## Step 0: API surface area

New types and function signatures (stubs only, no bodies). After Step 0 the
project typechecks and the feature test's imports resolve (it will still FAIL its
assertions because the dial is empty and the stubs return placeholder data — that
is the intended RED). All Step-0 stubs are exercised by the feature test once the
later steps fill the bodies.

```typescript
// src/lib/astro-math.ts  (PRODUCES Contract 1)

// One source of truth for BodyName — re-export, do NOT redeclare.
export type { BodyName } from "./astro-tokens.ts";
import type { BodyName } from "./astro-tokens.ts";

/** The eight planets, in semi-major-axis order — the ring ordering. Excludes sun and moon. */
export const PLANET_ORDER: readonly BodyName[]; // ["mercury","venus","earth","mars","jupiter","saturn","uranus","neptune"]

/** Heliocentric semi-major axis, in AU, keyed by body. Mercury 0.387 … Neptune 30.1. */
export const SEMI_MAJOR_AXIS_AU: Readonly<Record<BodyName, number>>;

/** Inner and outer dial radii (SVG user units) bounding the orbit annulus. */
export const R_INNER: number;
export const R_OUTER: number;

/** A rendered body position in SVG user space — the value placed in the <g> transform. */
export interface BodyPosition {
	body: BodyName;
	x: number; // SVG x; positive toward 3 o'clock
	y: number; // SVG y; positive downward (SVG convention)
	angle: number; // geocentric ecliptic direction (radians), date-dependent
	radius: number; // fixed log-radial distance; 0 for the Sun
}

/** Fixed log-radial map: semi-major axis (AU) onto [R_INNER, R_OUTER], linear in log10(a). */
export function logRadius(semiMajorAxisAu: number): number;

/** Ecliptic direction (radians) + radius → (x, y), pinning Earth on the +x ray. */
export function geocentricTransform(
	angleRad: number,
	radius: number,
): { x: number; y: number };

/** Per-date body positions for the whole dial. Sun at radius 0; Moon offset from Earth. */
export function geocentricPositions(date: Date): BodyPosition[];
```

```typescript
// src/components/astrolabe/ephemeris.ts  (PRODUCES Contract 1)
import type { BodyPosition } from "../../lib/astro-math.ts";

/** Body positions for a date: inline Meeus base, snapshot/CDN as freshness layers. */
export function ephemerisPositions(date: Date): BodyPosition[];
```

```typescript
// src/components/astrolabe/dial.ts  (CONSUMES Contracts 1, 3, 4)
/** The populated <svg viewBox="-500 -500 1000 1000"> dial: bodies + finish + twilight wedge. */
export function Dial(date?: Date): Element;
```

```typescript
// src/components/astrolabe/guilloche-section.ts  (CONSUMES Contract 4)
import type { ControlsSection } from "./controls.ts";
/** The #debug guilloché panel: density/pitch/relief/glint/lacquer + flat-finish toggle. */
export const guillocheSection: ControlsSection;
```

```typescript
// src/components/astrolabe/color-section.ts  (CONSUMES Contract 3)
import type { ControlsSection } from "./controls.ts";
/** The #debug per-body color pickers, writing bodyColorVar tokens via setProperty. */
export const colorSection: ControlsSection;
```

```typescript
// scripts/render-guilloche.ts → writes src/lib/guilloche-image.ts
//   export const GUILLOCHE_IMAGE: string;   (a data: URI literal)
// scripts/update-ephemeris-snapshot.ts → writes src/lib/astro-snapshot.ts
//   export const ASTRO_SNAPSHOT: { date: string; positions: BodyPosition[] };
```

`Astrolabe()` (in `astrolabe.ts`) gains no new exported signature — it is edited
in Step 3 to mount `Dial()` into the F1 `[data-astrolabe-dial]` host and to
register the two new debug sections. Its public shape `(): Element` is unchanged.

---

## Step 1: Coordinate math — `astro-math.ts` (Contract 1)

**Enables:** Feature-test imports `PLANET_ORDER` / `SEMI_MAJOR_AXIS_AU` resolve,
and assertion 4's *axes guard* (`SEMI_MAJOR_AXIS_AU` strictly increasing across
`PLANET_ORDER`). It also gives Step 3 the `geocentricTransform` /
`logRadius` it composes. The full feature test stays RED (no dial yet), but the
module no longer throws on import.

Fill the Step-0 stubs in `astro-math.ts` with their date-independent bodies.
`PLANET_ORDER` is the eight planets sorted by `SEMI_MAJOR_AXIS_AU` (Mercury 0.387
… Neptune 30.1). `logRadius(a)` maps `log10(a)` linearly from `log10(0.387)`
(Mercury → `R_INNER`) to `log10(30.1)` (Neptune → `R_OUTER`).
`geocentricTransform(angle, radius)` converts polar (angle, radius) to Cartesian
with the constant rotation that puts angle 0 on the +x ray, returning
`{x: radius*cos(θ), y: radius*sin(θ)}` after the pinning rotation. Pick concrete
`R_INNER` / `R_OUTER` inside the ±500 viewBox (e.g. ~140 and ~440) — these are
the deferred constants this plan tunes; keep them off the rim so the F3 zodiac
band has room.

**Tests** — `src/lib/astro-math.test.ts` (unit, no jsdom needed; pure math).

```
test "logRadius is monotonic and bounded":
  for each body in PLANET_ORDER, r = logRadius(SEMI_MAJOR_AXIS_AU[body])
  assert r values strictly increasing
  assert logRadius(0.387) ≈ R_INNER and logRadius(30.1) ≈ R_OUTER

test "geocentricTransform pins angle 0 on the +x ray":
  {x, y} = geocentricTransform(0, R_OUTER)
  assert x > 0 and |y| ≈ 0
```

- Edge: `geocentricTransform(0, 0)` returns `{0, 0}` (Sun at center).
- Edge: a quarter turn lands on a perpendicular axis (verify rotation sign /
  +y-down convention, so 3 o'clock is x>0,y≈0 not x≈0).
- Edge: `PLANET_ORDER` excludes `sun` and `moon` (length 8).

**Implementation Outline**

```
SEMI_MAJOR_AXIS_AU = { sun:0, mercury:0.387, venus:0.723, earth:1,
  moon:1 /* radius unused; Moon offset from Earth */, mars:1.524,
  jupiter:5.203, saturn:9.537, uranus:19.191, neptune:30.07 }
PLANET_ORDER = eight planets sorted ascending by axis
logRadius(a):
  t = (log10(a) - log10(0.387)) / (log10(30.1) - log10(0.387))
  return R_INNER + t * (R_OUTER - R_INNER)
geocentricTransform(angle, radius):
  θ = angle + EARTH_PIN_ROTATION   // constant that lands Earth's angle on +x
  return { x: radius*cos(θ), y: radius*sin(θ) }
```

Leave `geocentricPositions` as the Step-0 stub (Step 2 fills it). If a stub body
is required for `check` to pass, return `[]` — the dial isn't wired yet, so
nothing renders from it.

---

## Step 2: Ephemeris — inline Meeus + snapshot fallback

**Enables:** `geocentricPositions(date)` returns real per-body positions and
`ephemerisPositions(date)` wraps it. This is what Step 3's dial reads to place
each `<g>`, so it is the data behind assertions 1–4 (Sun at center, nine bodies,
Earth on +x ray, monotonic radii). The feature test is still RED until Step 3
renders, but every position the test inspects now has a correct source.

Fill `geocentricPositions(date)` in `astro-math.ts`: compute each body's
geocentric ecliptic longitude with the low-precision Meeus formulae (chapter 33
truncated series — degree-level accuracy is fine; the test is date-invariant and
only inspects radius ordering and Earth's pinned angle). Subtract Earth's
heliocentric position from each planet's to get geocentric direction; the Sun's
geocentric direction is opposite Earth's heliocentric direction. Each planet's
`radius` is `logRadius(SEMI_MAJOR_AXIS_AU[body])` (date-independent); `(x,y)` is
`geocentricTransform(angle, radius)`. The Sun is `radius 0`, `(0,0)`. **Earth is
the special case: its angle is the pin angle so `geocentricTransform` lands it on
the +x ray (x>0, y≈0) for every date** — this is the thesis encoded in data.
The Moon's `(x,y)` is Earth's anchor plus a small satellite offset (a deferred
constant; pick ~25–40 units so it reads as riding Earth, distinct from it).

`ephemeris.ts::ephemerisPositions(date)` calls `geocentricPositions(date)` as the
self-sufficient inline base, then prefers the build snapshot
(`src/lib/astro-snapshot.ts`, generated in Step 6) when present, with the
optional `astronomia` CDN override left as a documented seam (validated in the
build phase, not unit-tested). Until Step 6 generates the snapshot, import it
defensively so `check` stays green if the literal isn't written yet.

**Tests** — extend `src/lib/astro-math.test.ts` (same unit class; this is one
production module, so one unit test class — do not spin a second).

```
test "geocentricPositions pins Earth on the +x ray for any date":
  for date in [epoch, build-date, a future date]:
    earth = positions.find(p => p.body === "earth")
    assert earth.x > 0 and |earth.y| < 0.5

test "geocentricPositions places the Sun at center and returns all bodies":
  assert positions has all 10 BodyName entries
  sun = find "sun"; assert sun.x ≈ 0 and sun.y ≈ 0
```

- Edge: Moon's `(x,y)` ≠ Earth's `(x,y)` (offset applied) and ≠ center.
- Edge: planet radii equal `logRadius` of their axis (radius is date-invariant).
- Edge: two different dates give the SAME radii but DIFFERENT planet angles
  (proves angle is date-driven, radius is not).

**Implementation Outline**

```
geocentricPositions(date):
  T = julianCenturies(date)
  earthHelio = meeusHeliocentric("earth", T)   // longitude, radius
  for body in all BodyName:
    if body == "sun":  push {sun, x:0,y:0, angle: sunAngle, radius:0}; continue
    if body == "earth": push {earth, geocentricTransform(PIN_ANGLE, earthRadius)} ; continue
    if body == "moon": offset from earth anchor; continue
    helio = meeusHeliocentric(body, T)
    geoAngle = atan2(helio.y - earthHelio.y, helio.x - earthHelio.x)
    radius = logRadius(SEMI_MAJOR_AXIS_AU[body])
    push { body, ...geocentricTransform(geoAngle, radius), angle: geoAngle, radius }
```

---

## Step 3: Dial component — the populated SVG (feature test GREEN)

**Enables:** ALL FOUR feature-test assertions. This is the step that takes the
test from RED to GREEN: one `<svg>` with `[data-body="sun"]` at center; all nine
`[data-body]` groups present; Earth's translate on the +x ray; planet radii
monotonic by `PLANET_ORDER`.

Build `src/components/astrolabe/dial.ts::Dial(date?)`: an `<svg>` (set
`viewBox="-500 -500 1000 1000"` via `setAttribute`), containing one
`<g data-body="…" transform="translate(x,y)">` per `BodyPosition` from
`ephemerisPositions(date ?? new Date())`. Each group's `data-body` and
`transform` are set with `setAttribute` (the IDL-property caveat). Inside each
group put a `<circle>` body marker filled `var(--color-<body>)` via
`bodyColorVar` (Contract 3) — fill is an SVG IDL-ish attr; set it with
`setAttribute("fill", …)` to be safe, matching the F1 idiom. Then edit
`astrolabe.ts`: after building the F1 `DialContainer()`, append `Dial()` into it
(the dial host is the `[data-astrolabe-dial]` element) so `mount(Astrolabe())`
renders the SVG in the tree. Keep `astrolabe.ts` a thin composer — all SVG-heavy
code lives in `dial.ts`. Keep `dial.ts` under ~800 lines; if the guilloché
helper (Step 4) pushes it over, split a `guilloche-builder.ts` out.

**Contracted F1 hand-off (do this in THIS step):** update
`src/components/astrolabe/shell.feature.test.ts` lines 53–55. The slot is no
longer empty — F2 fills it. Change those three assertions from "dial is empty"
(no `<svg>`, no `[data-body]`) to "dial is now populated" (one `<svg>` present,
`[data-body]` groups present). This is the single F1-test edit the design
sanctions; leave the rest of `shell.feature.test.ts` (figure, controls registry,
no Realtime/Fast button) intact and green.

**Tests** — the project feature test
(`src/components/astrolabe/astrolabe.feature.test.ts`) is the acceptance test for
this step; it must go GREEN. A small `dial.test.ts` functional class (jsdom) is
warranted only for dial-specific structure the feature test does not assert
(e.g. each body group carries a `fill` referencing its color token) — one
functional test class at most, no per-body test multiplication.

```
test "Dial renders one svg with a [data-body] group per body":
  el = mount(Dial(new Date()))
  assert el.querySelectorAll("svg").length === 1
  for body in all 10 BodyName: assert el.querySelector(`[data-body="${body}"]`)

test "each body group fills with its color token":
  earthCircle = el.querySelector('[data-body="earth"] circle')
  assert earthCircle.getAttribute("fill").includes("--color-earth")
```

- Edge: `Astrolabe()` mounts exactly ONE `<svg>` (no duplicate dial on
  re-render) — the F1 shell test's figure/controls assertions still pass.
- Edge: Sun group's transform is `translate(0,0)` or absent (test treats both as
  center; assertion 1 tolerates `|x|,|y| < 0.5`).
- Edge: a body with a translate is set via `setAttribute` (not the attrs object),
  so the rendered `transform` attribute is actually present and parseable by the
  test's `translateOf` regex.

**Implementation Outline**

```
Dial(date = new Date()):
  positions = ephemerisPositions(date)
  groups = positions.map(p => {
    c = circle({ r: bodyRadius(p.body) })
    c.setAttribute("fill", `var(${bodyColorVar(p.body)})`)
    grp = g({}, c)
    grp.setAttribute("data-body", p.body)
    if (p.x || p.y) grp.setAttribute("transform", `translate(${p.x},${p.y})`)
    return grp
  })
  s = svg({}, ...groups)
  s.setAttribute("viewBox", "-500 -500 1000 1000")
  return s

// astrolabe.ts: dial host = DialContainer(); host.append(Dial()); caseFigure = WatchCase(host)
```

---

## Step 4: Guilloché finish + twilight wedge

**Enables:** No new feature-test assertion (finish is visual, browser-verified).
It must NOT regress the feature test — the `<svg>` count stays 1, body groups
stay addressable, and the guilloché `<image>`/filter and twilight `<path>` are
NOT `[data-body]` groups. Advances Closing Bell T1 (luxury finish) and T4
(guilloché sightlines + twilight wedge off the same Earth-centered system).

Add to `dial.ts` (or a split `guilloche-builder.ts` if size demands): a prebaked
guilloché layer rendered as an `<image>` referencing `GUILLOCHE_IMAGE` (the
data-URI literal generated in Step 6; import defensively so `check` passes before
the literal exists) behind the body groups, under a midnight-lacquer overlay that
reads `--lacquer-depth` (Contract 4). Under `#debug`, build the live alternative:
an SVG `<filter>` with `feTurbulence` + `feDisplacementMap` whose parameters the
Step-5 sliders drive. Add the twilight dead-zone `<path>` wedge centered on the
Sun's display position, sized to the ~10–12° solar-glare cone, reading off the
same geocentric system as the bodies. Layer order: guilloché image →
lacquer overlay → twilight wedge → body groups (bodies on top, addressable).

**Tests** — extend the `dial.test.ts` functional class (no new class).

```
test "the dial carries a guilloché image and a twilight wedge without adding bodies":
  el = mount(Dial(new Date()))
  assert el.querySelector("image") not null
  assert el.querySelectorAll("[data-body]").length === 10  // unchanged
```

- Edge: the twilight wedge is a `<path>`, not a `[data-body]` group (count
  invariant holds).
- Edge: the guilloché `<image>` and lacquer sit BEHIND the bodies in document
  order (bodies remain queryable/clickable for F3).
- Browser-verify (build phase, not unit): finish reads as engine-turned metal
  under lacquer; flat-finish toggle swaps cleanly.

**Implementation Outline**

```
buildFinish(debug):
  if debug: defs(filter("guilloche-relief", feTurbulence(...), feDisplacementMap(...)))
            + a live-rendered guilloché path group
  else:     image referencing GUILLOCHE_IMAGE (data URI)
  + rect/overlay fill var(--lacquer-depth)
twilightWedge(sunPos): path describing the ±~11° cone around the Sun direction
Dial: svg(buildFinish, twilightWedge, ...bodyGroups)  // bodies last = on top
```

---

## Step 5: Debug sections — guilloché sliders + color pickers (Contracts 2/3)

**Enables:** No feature-test assertion (debug surface is browser-verified). It
must not regress the test. Delivers the session's emphasis: a comprehensive,
well-organized `#debug` panel. Advances the color half of Closing Bell T5.

Build two `ControlsSection`s mirroring `material-section.ts`:

- `guilloche-section.ts::guillocheSection` (`id: "guilloche"`, `debugOnly: true`)
  — five sliders (density, pitch, relief, glint, lacquer) plus a **flat-finish**
  toggle, grouped with `FormGroup` + `PropertySheet` (and `Accordion` is applied
  by `ControlsSheet`). Slider `input` events drive the Step-4 live filter
  parameters (or swap to flat). Use `<input type="range">` rows; address each by
  a `data-param` hook set via `setAttribute`, mirroring `material-section.ts`'s
  `data-token` idiom.
- `color-section.ts::colorSection` (`id: "color"`, `debugOnly: true`) — one
  `<input type="color">` per `BodyName`, each writing
  `document.documentElement.style.setProperty(bodyColorVar(body), value)` on
  `input` (Contract 3) — identical mechanism to `material-section.ts::applyToken`.

Register both in `astrolabe.ts` via `registerControlsSection(...)` alongside the
F1 `materialSection` (idempotent on id, so re-render is safe).

**Tests** — one unit/functional class per new section module is the ceiling;
prefer a single `debug-sections.test.ts` covering both (jsdom), since they share
the setProperty-on-input behaviour.

```
test "color picker writes the body color token on input":
  el = mount(colorSection.render())
  marsInput = el.querySelector('[data-body="mars"] input, input[data-body="mars"]')
  fire input with value "#ff0000"
  assert document.documentElement.style.getPropertyValue("--color-mars") === "#ff0000"

test "guilloché flat-finish toggle is present and debugOnly":
  assert guillocheSection.debugOnly === true
  el = mount(guillocheSection.render()); assert el contains the five sliders + flat toggle
```

- Edge: re-registering a section by id REPLACES it (no duplicate panels) — relies
  on the F1 registry's idempotent-on-id behaviour.
- Edge: both sections are `debugOnly: true`, so they are absent without `#debug`
  (covered by the F1 registry gating; assert the flag, don't re-test gating).
- Edge: the color picker seeds from a sensible default swatch but the LIVE token
  is whatever the user picks (mirror `material-section.ts`).

**Implementation Outline**

```
colorSection.render():
  return BODYNAMES.map(body => {
    inp = input({ type: "color", value: defaultSwatch(body),
      events: { input: e => documentElement.style.setProperty(
        bodyColorVar(body), e.target.value) } })
    inp.setAttribute("data-body", body)
    return labeledRow(body, inp)
  })
guillocheSection.render():
  sliders for density/pitch/relief/glint/lacquer + a flat-finish Switch
  each input event → update the live filter params (Step 4) / toggle flat
```

---

## Step 6: Client hydration + build scripts (SSG integration)

**Enables:** No feature-test assertion. Closes the contract: the dial and debug
sections work in the running browser, and the page ships current. Must not
regress the feature test or `npm run check`.

Two build-time generators (PLAIN-ASCII names), each writing a TS literal exactly
as `scripts/sitemap.ts` writes its output with `writeFileSync` under
`import.meta.main`:

- `scripts/update-ephemeris-snapshot.ts` → `src/lib/astro-snapshot.ts`: computes
  `geocentricPositions(new Date())` for the build date and writes
  `export const ASTRO_SNAPSHOT = { date, positions } as const;`.
- `scripts/render-guilloche.ts` → `src/lib/guilloche-image.ts`: renders the
  spiral field once at default slider values and writes
  `export const GUILLOCHE_IMAGE = "data:image/…" as const;`.

Wire them into the build BEFORE the jiffies SSG render. `build` today is
`css:bundle && node scripts/sitemap.ts && <jiffies SSG>`; insert
`node scripts/update-ephemeris-snapshot.ts && node scripts/render-guilloche.ts`
ahead of the SSG step (they generate the literals `page.ts`'s import chain pulls
in). A generator failure must fail the build loudly — do not catch-and-continue.
Document the choice (extend `build` vs `prebuild`) in the commit; the deferred
decision resolves here against the real four-part chain.

Client hydration: extend `pages/astrolabe/page.ts` `clientModules` (currently
`["/src/components/astrolabe/controls-client.ts"]`) so the dial and the new debug
sections have a browser surface. Re-register `guillocheSection` and `colorSection`
client-side the way `controls-client.ts` re-registers `materialSection` (the
browser registry starts empty), and hydrate the dial if it needs live behaviour
(the static `Dial()` is inert SVG; if the `astronomia` CDN override or live
guilloché needs a client pass, add a small `dial-client.ts` and append its
specifier — do NOT inline DOM logic into `page.ts`).

**Tests** — feature-test each generator the way `scripts/sitemap.feature.test.ts`
and `scripts/enrichment-lint.feature.test.ts` test theirs: import the PURE
builder (no file write on import; the write is guarded by `import.meta.main`) and
assert on the returned literal/string. One feature-test class per script.

```
test "ephemeris snapshot builder returns positions for all bodies":
  snap = buildSnapshot(new Date("2026-06-14"))
  assert snap.positions has all 10 bodies
  assert snap.date is an ISO date string

test "guilloché renderer returns a data URI":
  uri = buildGuillocheImage(defaults)
  assert uri.startsWith("data:image/")
```

- Edge: importing either script has NO filesystem side effect (write is under
  `import.meta.main`) — mirror the sitemap test's purity invariant.
- Edge: the generated `astro-snapshot.ts` / `guilloche-image.ts` typecheck and
  match the `BodyPosition` shape `ephemeris.ts` imports (run `npm run check`
  after a real generation).
- Edge: client re-registration is idempotent on id (no duplicate `#debug`
  panels after hydration) — relies on the F1 registry contract.

**Implementation Outline**

```
// scripts/update-ephemeris-snapshot.ts
export function buildSnapshot(date): { date: string; positions: BodyPosition[] } {
  return { date: date.toISOString().slice(0,10), positions: geocentricPositions(date) }
}
if (import.meta.main) writeFileSync("src/lib/astro-snapshot.ts",
  `export const ASTRO_SNAPSHOT = ${JSON.stringify(buildSnapshot(new Date()))} as const;\n`)

// scripts/render-guilloche.ts
export function buildGuillocheImage(params): string { /* spiral → canvas → data URI */ }
if (import.meta.main) writeFileSync("src/lib/guilloche-image.ts",
  `export const GUILLOCHE_IMAGE = ${JSON.stringify(buildGuillocheImage(DEFAULTS))} as const;\n`)
```

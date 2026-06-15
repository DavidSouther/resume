# Implementation Plan: F3 — Motion & Sky

**Feature test:** `src/components/astrolabe/motion.feature.test.ts`
**User story:** A reader on the populated F2 dial runs the sky forward with a Realtime/Fast button on the case, watches the twelve tropical zodiac signs light as bodies enter them, and flips the always-visible geocentric/orbital switch — with motion, parallax, and zodiac toggles under `#debug`.

**Design:** `.ailly/developer/2026-06-14-D-astrolabe-motion/design.md`
**Project plan / shared contracts:** `.ailly/developer/2026-06-14-A-astrolabe/plan.md`

**Steps:**
- [ ] Step 0: API surface area
- [ ] Step 1: Pure sign math (`astro-zodiac.ts`)
- [ ] Step 2: Glyph map + zodiac band (`zodiac-glyphs.ts`, `zodiac.ts`) wired into the dial
- [ ] Step 3: Render-mode switch (`render-mode.ts`) — the always-visible geocentric/orbital control
- [ ] Step 4: Speed toggle on the case (`speed-toggle.ts`) + Astrolabe composition — flips the feature test GREEN
- [ ] Step 5: Motion engine (`motion.ts`) — the tickable core, no rAF
- [x] Step 6: Behavior wiring & debug panels (`parallax.ts`, `motion-section.ts`, `zodiac-section.ts`, `motion-client.ts`, CSS) + browser verification

---

## Orientation (read before building)

This feature consumes four settled contracts; it produces none. The relevant fixed surfaces:

- **Contract 1** — `BodyPosition { body, x, y, angle, radius }`, `geocentricTransform(angleRad, radius)`, `R_OUTER` (440), `BodyName` (ten names: sun, eight planets, moon) live in `src/lib/astro-math.ts` / `src/lib/astro-tokens.ts`. `ephemerisPositions(date): BodyPosition[]` lives in `src/components/astrolabe/ephemeris.ts`. The zodiac reads `BodyPosition.angle` (a geocentric ecliptic direction in radians, `[0, 2π)`).
- **Contract 2** — `registerControlsSection(section: ControlsSection)` and the `ControlsSection { id, title, render(): Node | Node[], debugOnly }` shape in `src/components/astrolabe/controls.ts`. F3 **appends** sections; it never edits F1/F2 markup. The client re-registers the same sections in `motion-client.ts` exactly as `controls-client.ts` does for F1/F2 (the browser registry starts empty).
- **Contract 3** — `bodyColorVar(body): "--color-${BodyName}"` in `src/lib/astro-tokens.ts`; the `--color-<body>` tokens are declared in `src/global.css`.
- **Contract 4** — material tokens; F3 reads none directly.

**Invariants F3 must not break (owned by F1/F2 tests, must stay GREEN every step):**

- One `<svg>` dial (`astrolabe.feature.test.ts`, `dial.test.ts`). The zodiac band and its `<symbol>` defs go INSIDE the existing single `<svg>` in `dial.ts` — no second `<svg>`.
- The nine `[data-body]` groups + Sun at center, Earth on the +x ray (`astrolabe.feature.test.ts`). A `[data-sign]` group must NEVER carry `data-body`.

**Expected cross-feature test flip (Step 4):** `shell.feature.test.ts` currently asserts `Astrolabe()` ships NO Realtime/Fast button (`expect(buttonText).not.toMatch(/realtime|fast/)`, lines 58–62). F3 adds that button to the composed `Astrolabe()`, so that single F1 assertion must flip in Step 4. The design records this as a normal feature progression. F1's *registry* assertions and F2's *thesis* assertions stay untouched. Update the F1 assertion in the SAME step that adds the button; leaving it broken violates zero-tolerance-for-failing-tests.

**Idiom anchors:** glyph inlining — `src/components/trip/icons.ts` (`ICON` raw-path map + `el.innerHTML`). Debug section — `src/components/astrolabe/guilloche-section.ts` / `material-section.ts` (the `ControlsSection` object, `data-*` hooks set post-construction, no-op when the dial is absent). Client re-registration — `src/components/astrolabe/controls-client.ts`. SVG attrs that are not IDL properties (`data-sign`, `data-occupied`, `transform`, `viewBox`, `href`) are set with `setAttribute` after construction (the `dial.ts` idiom).

---

## Step 0: API surface area

New types and public signatures established as STUBS (no bodies) so the project typechecks and the feature test's imports resolve. After Step 0, `npm run check` is GREEN and the feature test fails on assertions/runtime (the `occupantsBySign`/`Astrolabe` rendering), not on import resolution.

The feature test imports exactly two names from `../../lib/astro-zodiac.ts`: `ZODIAC_SIGNS` and `occupantsBySign`. It reads `sign.id` off each entry of `ZODIAC_SIGNS`. Everything else in this step is internal surface the later steps build against.

```typescript
// src/lib/astro-zodiac.ts — PURE sign math, no DOM. Consumes Contract 1 (BodyPosition.angle, BodyName).
import type { BodyName, BodyPosition } from "./astro-math.ts";

/** A tropical zodiac sign's stable id, Aries→Pisces. */
export type ZodiacSignId =
  | "aries" | "taurus" | "gemini" | "cancer" | "leo" | "virgo"
  | "libra" | "scorpio" | "sagittarius" | "capricorn" | "aquarius" | "pisces";

/** One tropical sign: id, human label, and the start of its 30° ecliptic arc (radians, [0, 2π)). */
export interface ZodiacSign {
  id: ZodiacSignId;
  label: string;
  /** Start of the sign's 30° arc, radians from the +x ray, increasing with angle. */
  startAngle: number;
}

/** The twelve signs in order Aries→Pisces, each anchored to its 30° arc start. */
export const ZODIAC_SIGNS: readonly ZodiacSign[]; // STUB

/** The sign whose 30° arc contains a geocentric ecliptic direction (radians). */
export function signOf(angleRad: number): ZodiacSignId; // STUB

/**
 * Occupants per sign from a set of body positions, keyed by ZodiacSignId.
 * The Moon is NEVER an occupant (excluded). The Sun and planets are placed by
 * BodyPosition.angle. Signs with no occupant are absent or map to [].
 */
export function occupantsBySign(
  positions: BodyPosition[],
): Map<ZodiacSignId, BodyName[]>; // STUB
```

```typescript
// src/components/astrolabe/zodiac-glyphs.ts — inlined Tabler stroke-path glyphs (icons.ts idiom).
import type { ZodiacSignId } from "../../lib/astro-zodiac.ts";

/** Raw stroke-path markup for each sign's Tabler "Zodiac" glyph (inner <path> content). */
export const ZODIAC_GLYPH: Record<ZodiacSignId, string>; // STUB

/** The <defs> block of one <symbol id="zodiac-<id>"> per sign, ready to <use>. */
export function zodiacSymbolDefs(): Element; // STUB
```

```typescript
// src/components/astrolabe/zodiac.ts — the zodiac band <g> at the outer radius. Consumes Contracts 1 & 3.
import type { BodyPosition } from "../../lib/astro-math.ts";

/**
 * The <g data-zodiac-band> of twelve <g data-sign="<id>"> wedges, each holding a
 * <use> of its glyph symbol, lit with data-occupied per occupantsBySign(positions).
 * Renders INSIDE the existing single <svg> (dial.ts), so it adds no second <svg>
 * and no [data-body] group.
 */
export function ZodiacBand(positions: BodyPosition[]): Element; // STUB

/** Re-apply data-occupied to each [data-sign] from current positions (no rebuild). */
export function refreshOccupancy(band: Element, positions: BodyPosition[]): void; // STUB
```

```typescript
// src/components/astrolabe/render-mode.ts — the always-visible geocentric/orbital switch (Contract 2).
import type { ControlsSection } from "./controls.ts";

export type RenderMode = "geocentric" | "orbital";

/** Attribute on the watch root the motion engine reads to apply/drop the Earth-pin. */
export const RENDER_MODE_ATTR = "data-render-mode";

/** Always-visible contributed section (debugOnly: false) holding the StaticTabList switch. */
export const renderModeSection: ControlsSection; // STUB

/** Read the current render mode off the watch root (defaults to "geocentric"). */
export function currentRenderMode(root: ParentNode): RenderMode; // STUB
```

```typescript
// src/components/astrolabe/speed-toggle.ts — the Realtime/Fast button on the case (the sanctioned deviation).
export type Speed = "realtime" | "fast";

/** Attribute on the watch root: present + "fast" hides hands and runs the loop fast. */
export const FAST_ATTR = "data-fast";

/** Real-seconds-per-simulated-... factors. Fast ≈ one year per minute. */
export const SPEED_FACTOR: Readonly<Record<Speed, number>>;

/** The <button data-speed-toggle> rendered onto the case (OUTSIDE the controls sheet). */
export function SpeedToggle(): HTMLButtonElement; // STUB
```

```typescript
// src/components/astrolabe/motion.ts — the tickable motion engine (Contract 1). rAF lives in start()/stop().
import type { Speed } from "./speed-toggle.ts";

/** Real-time → simulated-time mapping with a speed factor. Pure; no timers. */
export class SimulatedClock {
  constructor(start: Date, speed: Speed); // STUB
  setSpeed(speed: Speed): void; // STUB
  /** Simulated Date for an elapsed real-millisecond reading. */
  simulatedAt(realElapsedMs: number): Date; // STUB
}

/** Re-applies body transforms + zodiac occupancy from a simulated date. */
export class MotionEngine {
  constructor(root: ParentNode, clock: SimulatedClock); // STUB
  /** Pure per-frame update: re-query [data-body], re-apply transforms, refresh occupancy. */
  tick(simulated: Date): void; // STUB
  start(): void; // STUB (wraps tick in requestAnimationFrame)
  stop(): void; // STUB
}
```

```typescript
// src/components/astrolabe/parallax.ts — desktop mousemove parallax.
/** Outer groups shift less: a pure shift for a ring radius and a pointer offset. */
export function parallaxShift(
  radius: number,
  pointer: { x: number; y: number },
  strength: number,
): { dx: number; dy: number }; // STUB

/** Bind a mousemove handler that shifts body groups; returns an unbind. */
export function bindParallax(root: ParentNode): () => void; // STUB
```

```typescript
// src/components/astrolabe/motion-section.ts & zodiac-section.ts — #debug ControlsSections (Contract 2).
import type { ControlsSection } from "./controls.ts";
export const motionSection: ControlsSection; // STUB (motion on/off, parallax on/off + strength)
export const zodiacSection: ControlsSection; // STUB (zodiac band on/off, twilight on/off)
```

```typescript
// src/components/astrolabe/motion-client.ts — the F3 client entry (controls-client.ts analogue).
export function startMotionClient(): void; // STUB
```

**Tested by:** the feature test (imports + `ZODIAC_SIGNS`/`occupantsBySign` shape). Step 0 has no unit tests of its own — stubs throw or return placeholder shapes only enough to typecheck.

---

## Step 1: Pure sign math (`astro-zodiac.ts`)

**Enables:** the feature test's import of `ZODIAC_SIGNS` and `occupantsBySign` (line 27), assertion group 3 (`ZODIAC_SIGNS` has twelve entries with `.id`), and assertion group 4's reference math — `occupantsBySign(ephemerisPositions(new Date()))` must return a real Map so the test can compute `occupiedSignIds` and assert the Moon is never present. After this step the feature test still fails (no band rendered), but its `occupantsBySign(...)` call and the `ZODIAC_SIGNS` loop run against real values.

Fill the three stubs. `ZODIAC_SIGNS` is the twelve tropical signs Aries→Pisces, each `startAngle = i * (π/6)`, anchored so Aries starts at the +x ray (angle 0) — consistent with Contract 1's `+x` = 0 rad convention used by `geocentricTransform`. `signOf` normalizes the angle into `[0, 2π)` and floors by 30° arcs. `occupantsBySign` walks the positions, skips `moon`, and buckets each remaining body by `signOf(position.angle)`.

**Tests** — `src/lib/astro-zodiac.test.ts` (one unit test class for this pure module; the ceiling per the parsimony rule):

```
test "occupantsBySign buckets bodies by sign and excludes the Moon":
  positions <- [ {body:"mars", angle: 0.1, ...}, {body:"moon", angle: 0.1, ...} ]
  result <- occupantsBySign(positions)
  assert result.get("aries") == ["mars"]      // mars in Aries' arc
  assert no sign's list contains "moon"
```

- Edge cases: angle exactly on an arc boundary (`0`, `π/6`) lands in the higher sign deterministically; negative angle and angle ≥ 2π normalize correctly; empty positions → empty/all-empty Map; a sign with multiple occupants returns both (order-stable); the Sun IS counted (only the Moon is excluded). `ZODIAC_SIGNS.length === 12` and ids are unique and Aries→Pisces ordered.
- Assertion-correctness: derive the expected sign for a known angle by hand (e.g. `angle = 7*π/6` → "libra", the 7th sign) rather than trusting `signOf` against itself.

**Implementation Outline**

```
ZODIAC_SIGNS = twelve {id,label,startAngle: i*π/6}, Aries..Pisces
signOf(a): n = normalize(a) into [0,2π); return ZODIAC_SIGNS[floor(n / (π/6))].id
occupantsBySign(positions):
  map = new Map()
  for p in positions where p.body != "moon":
    push p.body into map[signOf(p.angle)]
  return map
```

---

## Step 2: Glyph map + zodiac band, wired into the dial

**Enables:** assertion group 2 (a `[data-zodiac-band]` rings the dial AND `svgs.length === 1` still holds) and assertion group 3 (all twelve `[data-sign="<id>"]` groups present, none also `[data-body]`) and assertion group 4 (each sign's `data-occupied` matches the occupancy math). After this step the feature test's groups 2–4 pass; groups 1 (speed button) and 5 (render-mode text) still fail.

Fill `ZODIAC_GLYPH` (twelve Tabler "Zodiac" stroke-path strings, the `icons.ts` raw-path idiom) and `zodiacSymbolDefs()` (a `<defs>` of `<symbol id="zodiac-<id>" viewBox="0 0 24 24">` per sign, glyph via `el.innerHTML`). Fill `ZodiacBand(positions)`: a `<g data-zodiac-band>` containing twelve `<g data-sign="<id>">`, each placed at the outer radius (`R_OUTER`) at the center of its 30° arc, holding a `<use href="#zodiac-<id>">`. Compute occupancy once via `occupantsBySign(positions)` and `setAttribute("data-occupied", "")` on each occupied sign's group; blend the occupant colors via `bodyColorVar` (MVP: a representative occupant color is sufficient per the design's deferred multi-occupant blending). `refreshOccupancy(band, positions)` re-applies/clears `data-occupied` from a fresh positions set (used later by the motion engine).

Then change `dial.ts`: append `zodiacSymbolDefs()` and `ZodiacBand(positions)` into the existing single `svg(...)` call — placed BEFORE the body groups so bodies still paint last and on top (the F2 invariant). The band and defs are not `[data-body]` and add no second `<svg>`.

**Tests** — `src/components/astrolabe/zodiac.test.ts` (`// @vitest-environment jsdom`, `mount`/`resetDom`, one functional test class):

```
test "ZodiacBand renders twelve [data-sign] groups, lit per occupancy, none a [data-body]":
  positions <- ephemerisPositions(fixedDate)
  band <- mount(ZodiacBand(positions))
  assert band has data-zodiac-band
  for each ZODIAC_SIGNS sign: assert [data-sign=id] present and NOT [data-body]
  expected <- signs occupiedByMath(positions)
  for each sign: assert hasAttribute("data-occupied") == expected.includes(sign.id)
```

- Edge cases: a sign with zero occupants carries no `data-occupied`; a sign with an occupant carries it; `refreshOccupancy` flips a sign's lit-state when given different positions (off→on and on→off); the band contains exactly twelve `[data-sign]` and zero `[data-body]`.
- Regression guard: after this change, `npx vitest run astrolabe.feature.test.ts dial.test.ts` still passes (one `<svg>`, nine `[data-body]`, Earth on +x).

**Implementation Outline**

```
zodiacSymbolDefs(): defs( ...ZODIAC_SIGNS.map(s => symbol#zodiac-<id> with innerHTML ZODIAC_GLYPH[s.id]) )
ZodiacBand(positions):
  occ = occupantsBySign(positions)
  band = g[data-zodiac-band]
  for s in ZODIAC_SIGNS:
    mid = s.startAngle + π/12
    (x,y) = (R_OUTER*cos mid, R_OUTER*sin mid)   // +x = 0 rad, +y down
    sg = g[data-sign=s.id] at translate(x,y) holding use(#zodiac-<id>)
    if occ.get(s.id)?.length: sg.setAttribute("data-occupied",""); tint via bodyColorVar(occ[0])
  return band
dial.ts: svg( ...zodiacSymbolDefs(), ZodiacBand(positions), ...guillocheFinish, lacquer, wedge, ...bodyGroups )
```

---

## Step 3: Render-mode switch (`render-mode.ts`)

**Enables:** assertion group 5 — the always-visible controls text contains both "geocentric" and "orbital" (`sheetText` matches `/geocentric/` and `/orbital/` with no `#debug` hash). After this step group 5 passes once `renderModeSection` is registered (registration happens in Step 4's `Astrolabe()` edit, so group 5 fully lands in Step 4; this step builds the section so its render output carries both words).

Fill `renderModeSection` as a `ControlsSection { id: "render-mode", title: "Render mode", debugOnly: false }` whose `render()` returns a `StaticTabList` (jiffies `@davidsouther/jiffies/components/index.ts`) with two tabs labeled "Geocentric" and "Orbital". Its `onSelect`/change writes `RENDER_MODE_ATTR` onto the watch root (`document.querySelector(".astrolabe")` or `document.documentElement`) — geocentric default, orbital releases Earth. `currentRenderMode(root)` reads the attribute back, defaulting to `"geocentric"`. The section is presentational + a single attribute write; the motion engine (Step 5) reads the attribute to apply/drop the Earth-pin rotation. Confirm `StaticTabList`'s exact prop shape from `node_modules/@davidsouther/jiffies/lib/esm/components/tabs.d.ts` (`{ name, tabs: { id, label, selected? }[] }`) before importing.

**Tests** — `src/components/astrolabe/render-mode.test.ts` (`// @vitest-environment jsdom`):

```
test "renderModeSection renders a geocentric/orbital switch and writes the root attribute":
  el <- mount(renderModeSection.render())
  assert el.textContent matches /geocentric/i and /orbital/i
  // simulate selecting Orbital
  assert currentRenderMode(root) reads "orbital" after the orbital input is checked
```

- Edge cases: `debugOnly` is `false` (always-visible); `currentRenderMode` defaults to `"geocentric"` when the attribute is absent; selecting Geocentric again restores the default attribute. No assertion on the actual Earth-release transform (that is browser-verified per the design).

**Implementation Outline**

```
renderModeSection = { id:"render-mode", title:"Render mode", debugOnly:false, render(): StaticTabList({name:"render-mode", tabs:[{id:"geocentric",label:"Geocentric",selected:true},{id:"orbital",label:"Orbital"}]}) + change handler -> root.setAttribute(RENDER_MODE_ATTR, id) }
currentRenderMode(root): (root.querySelector(".astrolabe") ?? root).getAttribute(RENDER_MODE_ATTR) ?? "geocentric"
```

---

## Step 4: Speed toggle on the case + Astrolabe composition (flips the feature test GREEN)

**Enables:** assertion group 1 (a `<button data-speed-toggle>` whose text matches `/realtime|fast/i`, present and NOT contained by `[data-astrolabe-controls]`) and finalizes group 5 (registering `renderModeSection` puts "geocentric"/"orbital" into the rendered controls). With Steps 1–3 done, this step makes the WHOLE feature test pass.

Fill `SpeedToggle()`: a jiffies `button(...)` with `data-speed-toggle` (set via `setAttribute`), initial text "Realtime", a click handler that toggles between Realtime/Fast and writes/removes `FAST_ATTR` on the watch root (the loop and CSS read it; the motion engine wires `setSpeed` in Step 6). Fill `SPEED_FACTOR` (realtime = 1; fast = the factor giving ≈ one year per minute — i.e. `31_557_600 s/yr ÷ 60 s/min ≈ 525_960×`).

Then edit `astrolabe.ts`:
- `registerControlsSection(renderModeSection)` alongside the F1/F2 sections (idempotent on id).
- Render `SpeedToggle()` onto the case figure OUTSIDE the `ControlsHost()` — append it into the `WatchCase` figure (or wrap the figure and the button together) so `[data-astrolabe-controls]` does NOT contain it. The feature test asserts `controlsHost.contains(toggle) === false`, so the button must be a sibling of (or inside the case, not inside) the controls host.

Update `shell.feature.test.ts` (the recorded cross-feature flip): the F1 button-absence assertion (lines 58–62) must invert — `Astrolabe()` now ships the Realtime/Fast button. Change that single assertion to expect the button present (or move the absence check to a frozen F1-only fixture if one exists). Leave F1's registry assertion and F2's thesis assertions untouched.

**Tests** — `src/components/astrolabe/speed-toggle.test.ts` (`// @vitest-environment jsdom`):

```
test "SpeedToggle is a Realtime/Fast button that toggles the root data-fast attribute":
  btn <- mount(SpeedToggle()) ; root <- the watch root
  assert btn.tagName == "button" and btn has data-speed-toggle
  assert btn.textContent matches /realtime/i
  click(btn)
  assert root has FAST_ATTR and btn.textContent matches /fast/i
  click(btn)
  assert root lacks FAST_ATTR
```

- Edge cases: two clicks return to Realtime (attribute removed); `SPEED_FACTOR.realtime === 1`; `SPEED_FACTOR.fast` is the year-per-minute value; the button is NOT inside `[data-astrolabe-controls]` when rendered by `Astrolabe()`.
- Regression: `npx vitest run` — the FULL suite is GREEN here, including the updated `shell.feature.test.ts` and the now-passing `motion.feature.test.ts`. This is the step where the feature test goes green; no later step may regress it.

**Implementation Outline**

```
SPEED_FACTOR = { realtime: 1, fast: 31_557_600/60 }   // ≈ 525_960
SpeedToggle(): btn = button({events:{click}}, "Realtime"); btn.setAttribute("data-speed-toggle","")
  click: speed = toggle; root.setAttribute/removeAttribute(FAST_ATTR); btn.textContent = speed=="fast"?"Fast":"Realtime"
astrolabe.ts: registerControlsSection(renderModeSection)
  caseFigure = WatchCase(dial); div(.astrolabe, caseFigure, SpeedToggle(), controls)  // toggle NOT inside controls host
```

---

## Step 5: Motion engine (`motion.ts`) — the tickable core

**Enables:** no new feature-test assertion (the feature test is already green and is structural, not timer-bound, per the design). This step builds the runtime motion the browser-verification phase exercises. It must keep `npm run check` and the full suite GREEN.

Fill `SimulatedClock`: holds a start `Date` and a `Speed`, maps a real-elapsed-ms reading to a simulated `Date` via `SPEED_FACTOR`; `setSpeed` re-anchors so the simulated time is continuous across a speed change (capture current simulated time, reset start). Fill `MotionEngine`: `tick(simulated)` calls `ephemerisPositions(simulated)`, re-applies each `[data-body]` group's `transform` from the position (reading `currentRenderMode(root)` to apply or drop the Earth-pin rotation), and calls `refreshOccupancy(band, positions)`. `start()` wraps `tick` in a `requestAnimationFrame` loop; `stop()` cancels it. Keep `tick` pure of rAF so it is unit-testable in jsdom (jsdom has no real rAF cadence).

**Tests** — `src/components/astrolabe/motion.test.ts` (`// @vitest-environment jsdom`, one functional test class):

```
test "MotionEngine.tick re-applies body transforms and refreshes occupancy for a simulated date":
  root <- mount(Astrolabe())
  engine <- new MotionEngine(root, new SimulatedClock(d0, "realtime"))
  before <- transform of [data-body=mars]
  engine.tick(dFuture)          // a date months later
  after <- transform of [data-body=mars]
  assert before != after        // Mars moved
  assert occupied [data-sign] set == occupantsBySign(ephemerisPositions(dFuture))

test "SimulatedClock maps elapsed real time by the speed factor, continuous across setSpeed":
  clock <- new SimulatedClock(d0, "fast")
  assert clock.simulatedAt(60_000) ≈ d0 + ~1 year      // fast ≈ 1 yr/min
  clock.setSpeed("realtime")                            // simulated time does not jump
```

- Edge cases: `setSpeed` does not discontinuously jump simulated time; `tick` is a no-op-safe when the band/bodies are absent (engine usable in isolation); orbital vs geocentric mode changes the Earth group's transform (assert Earth moves off +x when `data-render-mode=orbital`, stays on +x when geocentric — the only mode assertion that is cheaply unit-testable; full orbital correctness is browser-verified); `stop()` after `start()` cancels cleanly (guard against double-cancel).
- Assertion-correctness: use a fixed future date with a known nonzero Mars motion; do not assert exact coordinates (derive "moved" from inequality, and occupancy from the same pure `occupantsBySign`).

**Implementation Outline**

```
SimulatedClock(start, speed): { start, speed, anchor=now }
  simulatedAt(realMs): new Date(start + realMs * SPEED_FACTOR[speed] * 1000... )  // scale: real-sec→sim-sec
  setSpeed(s): start = simulatedAt(elapsedNow); anchor = now; speed = s
MotionEngine(root, clock):
  band = root.querySelector("[data-zodiac-band]")
  tick(sim):
    pos = ephemerisPositions(sim)
    mode = currentRenderMode(root)
    for p in pos: group=[data-body=p.body]; group.transform = translate(applyMode(mode,p))
    refreshOccupancy(band, pos)
  start(): raf loop -> tick(clock.simulatedAt(perf.now()-t0)); stop(): cancelAnimationFrame
```

---

## Step 6: Behavior wiring & debug panels + browser verification

**Enables:** no new feature-test assertion. Completes the feature: parallax, the `#debug` motion/zodiac sections, the client entry, the CSS, and the browser-verified behaviors the design defers (60fps motion, parallax shift, hands hidden in Fast, orbital-mode correctness). Keeps the full suite GREEN.

Fill `parallax.ts`: `parallaxShift(radius, pointer, strength)` returns a per-group offset that scales DOWN with radius (outer groups shift less) — e.g. `factor = strength * (1 - radius / R_OUTER)`. `bindParallax(root)` attaches a `mousemove` handler that applies the shift to each `[data-body]`/band group and returns an unbind. Fill `motionSection` (`debugOnly: true`, id `"motion"`): `Switches` (jiffies `@davidsouther/jiffies/dom/form/form.ts`) for motion on/off and parallax on/off, plus a strength range — driving `MotionEngine.start/stop`, `bindParallax`, and the strength. Fill `zodiacSection` (`debugOnly: true`, id `"zodiac"`): switches for zodiac band on/off and twilight wedge on/off (toggling `data-*` the CSS reads). Confirm `Switches(legendText, options)` shape from the `.d.ts` before importing. Fill `motion-client.ts`: re-register `renderModeSection`, `motionSection`, `zodiacSection` (the browser registry starts empty — mirror `controls-client.ts`), wire the rendered `SpeedToggle` to `engine.setSpeed`, instantiate the `MotionEngine` against the rendered dial, `bindParallax`, and `start()` — guarded by `prefers-reduced-motion`. Add `/src/components/astrolabe/motion-client.ts` to `pages/astrolabe/page.ts` `clientModules` alongside `controls-client.ts`. Add CSS in `src/global.css` (the astrolabe `@layer user` block): `[data-fast]` hides the hands, `[data-occupied]` lights a sign, `[data-render-mode]`/zodiac/twilight toggles drive visibility. CSS only, no new tokens.

**Tests** — extend the existing functional suites (do not add a class per tiny module, per parsimony):

```
test "parallaxShift scales down with radius":
  inner <- parallaxShift(R_INNER, {x:10,y:0}, 1)
  outer <- parallaxShift(R_OUTER, {x:10,y:0}, 1)
  assert abs(inner.dx) > abs(outer.dx)

test "motionSection / zodiacSection are debugOnly sections with the expected toggles":
  // reuse the debug-sections.test.ts pattern: render under #debug, assert the switches present
```

- Edge cases: `parallaxShift` at `radius == R_OUTER` → ~zero shift; strength 0 → zero shift; `bindParallax`'s unbind removes the listener; `motion-client.startMotionClient` is a no-op when the dial is absent (SSR-safe import); CSS toggles do not affect the `[data-body]` count (regression on the thesis test).
- Browser verification (design §Summary — `playwright-cli` against `node scripts/serve.ts --port 8080 --watch`, page at `http://127.0.0.1:8080/astrolabe/`): (1) ~60fps motion under the rAF loop; (2) the mousemove parallax shifts outer groups less; (3) hands hide when Fast is engaged (`data-fast`); (4) orbital mode releases Earth from 3 o'clock and re-pins the Sun at center, geocentric restores the thesis; (5) the `#debug` motion/zodiac switches drive their toggles live. Record screenshots. This is the live-target probe; the route is dark but served locally for verification.

**Implementation Outline**

```
parallaxShift(r, ptr, s): f = s * (1 - r/R_OUTER); return { dx: ptr.x*f, dy: ptr.y*f }
bindParallax(root): on mousemove -> for each group apply parallaxShift(group.radius, ptr, strength); return ()=>off
motionSection / zodiacSection: ControlsSection debugOnly:true with Switches + range; handlers drive engine/bind/data-attrs
motion-client: register sections; engine=new MotionEngine(dial, clock); toggle.onClick->engine.setSpeed; bindParallax; if !reducedMotion engine.start()
page.ts: clientModules: [...controls-client.ts, "/src/components/astrolabe/motion-client.ts"]
global.css @layer user: [data-fast] .hands{display:none}; [data-sign][data-occupied]{...}; render-mode/zodiac/twilight visibility
```

---

## Verification per step

Every step ends with `npm run format` then `npm run check` (typecheck + Biome, TABS) GREEN, and `npx vitest run` with zero failures (the FULL suite — F1/F2 invariants must not regress). The feature test (`motion.feature.test.ts`) may stay RED through Step 3 and MUST be GREEN from Step 4 onward. Step 6 adds the `playwright-cli` browser verification the design defers from the structural feature test.

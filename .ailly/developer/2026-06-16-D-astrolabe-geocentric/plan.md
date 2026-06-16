# Implementation Plan: Astrolabe Ptolemaic (geocentric) third Earth mode

*Draft 2026-06-16* (QUICK-LOOP: this draft marker auto-clears; it is not a blocking gate.)

**Feature test:** `src/lib/astrolabe/ptolemaic.feature.test.ts`
**User story:** A reader presses **Ptolemaic** and an outer planet (Mars) tracks forward against the fixed zodiac, slows, reverses near opposition (apparent retrograde), then resumes — the retrograde emerging for free from the geocentric sight line at a fixed dial radius, with no epicycles.

**Steps:**
- [ ] Step 0: API surface area
- [x] Step 1: `geoDirection` pure seam (GREEN GATE — makes the feature test pass)
- [x] Step 2: `EarthMode` tri-state + math.ts signatures (manual)
- [x] Step 3: `radialSpokes` generator (manual)
- [x] Step 4: Render branch — center swap, Sun disc, body angle, zodiac continuity (manual)
- [x] Step 5: Controls, drag routing, RA ephemeris seed (manual)

Coverage: **Step 1** is the only step the deterministic feature test exercises and is the green gate. Steps 2–5 are taken to MANUAL verification (DOM and browser harness), matching the testing split of prior sessions A–C. They are sequenced after the seam is green; each leaves `check` + the vitest suite passing.

Test runner: `mise exec -- npx vitest run src/lib/astrolabe/ptolemaic.feature.test.ts`. Invoke any `.ts` script as `node script.ts` (no `--experimental-strip-types`). Value imports inside `src` must be relative `.ts` paths; `~/` resolves only for erased `import type`.

## Step 0: API surface area

New types and function signatures (stubs only, no bodies). `geoDirection` is the only symbol the feature test imports; the rest are the design's broader wiring.

```typescript
// src/lib/astrolabe/types.ts — replace the boolean with a tri-state
export const PTOLEMAIC = 1;
export const GALILEAN = 2;
export const KEPLERIAN = 3;
export type EarthMode =
  | typeof PTOLEMAIC
  | typeof GALILEAN
  | typeof KEPLERIAN;
// Config.earthFixed: boolean  ->  Config.earthMode: EarthMode

// src/lib/astrolabe/geocentric.ts — the tested pure seam (NEW MODULE)
import type { Body } from "./types.ts";

// Geocentric direction of `body` as seen from Earth, in display degrees, as a
// pure function of simulated time. Earth/Sun/Moon special-cased per the design.
export function geoDirection(body: Body, simT: number): number;

// Straight radial-spoke endpoints (dial coordinates) for the Ptolemaic guilloche.
export function radialSpokes(
  inner: number, rInner: number, rMid: number, rOuter: number,
): { x1: number; y1: number; x2: number; y2: number }[];

// src/lib/astrolabe/math.ts — signatures accept EarthMode (or a derived boolean)
export function displayedRate(body: Body, mode: EarthMode): number;
export function dialRotation(mode: EarthMode, aE: number, caseOffset: number): number;
export function caseOffsetPreservingRot(
  mode: EarthMode, aE: number, caseOffset: number,
): number;
```

## Step 1: `geoDirection` pure seam — GREEN GATE

**Enables:** Both assertions in `ptolemaic.feature.test.ts`. The import on line 7 currently throws (module missing); once this module exports `geoDirection`, the suite resolves and both tests evaluate. The retrograde test (`maxStep > 0 && minStep < 0`) passes because the Earth-relative sight line to Mars is non-monotonic across a synodic period.

Create `src/lib/astrolabe/geocentric.ts`. Reproduce `setGeo`'s formula exactly ([animation.ts:419-443](../../../src/components/astrolabe/animation.ts#L419)): build Earth's Cartesian components from `aE = helioA(EARTH, simT)`, build the body's from `aP = helioA(body, simT)` scaled by `au`, and take `atan2` of the Earth→body vector. Special-case the Moon (its own `helioA`, already Earth-orbiting in the model) and the Sun (`aE + 180`). Earth itself returns the Sun direction (`geo.earth = geo.sun` in the source). Import `EARTH`, `helioA` from relative `.ts` paths.

**Tests**

The feature test is the acceptance. The step's own happy-path unit check confirms the formula matches `setGeo` for an arbitrary outer body at a fixed time.

```text
test "geoDirection of mars equals setGeo's geocentric formula":
  t <- 0.5 * EARTH_YEAR
  aE <- helioA(EARTH, t); aP <- helioA(mars, t)
  expected <- degrees(atan2(mars.au*sin(aP) - sin(aE), mars.au*cos(aP) - cos(aE)))
  assert geoDirection(mars, t) ≈ expected
```

- Sun: `geoDirection(sun-like body, t)` returns `aE + 180` (caller special-case; the lib may accept a `sun` key or leave the Sun to the caller — re-derive which during build).
- Moon: returns its own `helioA(moon, t)`, not the Earth→body vector.
- Earth: returns the Sun direction (or is excluded; match the source's `geo.earth = geo.sun`).
- Angle continuity: output stays within `(-180, 180]`-equivalent range; wrapping is the test's `deltas` concern, not the seam's.

**Implementation Outline**

```text
function geoDirection(body, simT):
  if body.moon: return helioA(body, simT)
  if body is sun: return wrap(helioA(EARTH, simT) + 180)
  aE_rad <- radians(helioA(EARTH, simT))
  aP_rad <- radians(helioA(body, simT))
  au <- body.au ?? 1
  return degrees(atan2(au*sin(aP_rad) - sin(aE_rad),
                       au*cos(aP_rad) - cos(aE_rad)))
```

After this step `mise exec -- npx vitest run src/lib/astrolabe/ptolemaic.feature.test.ts` is GREEN. Remaining steps must keep it green.

## Step 2: `EarthMode` tri-state + math.ts signatures (manual)

**Enables:** No feature-test assertion. Replaces `Config.earthFixed: boolean` with `Config.earthMode: EarthMode` and threads the enum through `displayedRate`, `dialRotation`, `caseOffsetPreservingRot`. `GALILEAN` carries the old `earthFixed === true` behavior; `KEPLERIAN` carries `false`; `PTOLEMAIC` is the new path.

Update every reader of `earthFixed` (math.ts, animation.ts drag routing, controls.ts, page.ts). Where only the two Sun-centered states matter, derive a boolean (`mode === GALILEAN`) at the call site rather than widening the math.

**Tests**

Unit-update the existing math tests to pass `EarthMode` values; assert `displayedRate(body, GALILEAN)` equals the old `displayedRate(body, true)` and `KEPLERIAN` equals `false`.

- `PTOLEMAIC` in `displayedRate`/`dialRotation`: decide and pin the dial-rotation value (zodiac fixed ⇒ rotation contribution like KEPLERIAN's `0`); re-derive during build.
- All existing math unit tests still pass after the signature change.

**Implementation Outline**

```text
displayedRate(body, mode): rateOf(body) - (mode === GALILEAN ? rateOf(EARTH) : 0)
dialRotation(mode, aE, caseOffset): earthFixed-term applies only when mode === GALILEAN
```

## Step 3: `radialSpokes` generator (manual)

**Enables:** No feature-test assertion. Adds `radialSpokes(inner, rInner, rMid, rOuter)` to `geocentric.ts`: `inner` spokes (120) from `rInner` to `rMid`, doubling to `2*inner` (240) from `rMid` (Mars orbit, dial radius 197.5) outward, mirroring the heliocentric guilloche's density doubling. Returns line segments in dial coordinates; rendering stays in the component.

**Tests**

```text
test "radialSpokes density doubles at the mid ring":
  segs <- radialSpokes(120, R_SUN, 197.5, MAX_R)
  inner <- segs ending at-or-before rMid; outer <- segs beyond rMid
  assert count(inner) == 120 and count(outer) == 240
```

- Endpoints lie on rays from center `CX,CY`; inner segments span `rInner..rMid`, outer span `rMid..rOuter`.
- Even angular spacing within each band.

**Implementation Outline**

```text
for k in 0..inner:   angle = k * 360/inner;  segment(rInner..rMid at angle)
for k in 0..2*inner: angle = k * 360/(2*inner); segment(rMid..rOuter at angle)
```

## Step 4: Render branch — center swap, Sun disc, body angle, zodiac continuity (manual)

**Enables:** No feature-test assertion; verified in the browser via `playwright-cli`. In Ptolemaic: render Earth at the center spindle (radius 0); introduce a Sun disc/hit orbiting at radius 168.4 (hidden in the Sun-centered frames, where the center glow returns); place each disc at `b.r` rotated to `geoDirection(b, simT)` instead of `helioA + rot`; swap the log-curve guilloche for `radialSpokes(120, R_SUN, 197.5, MAX_R)` rendered as `<line>`s; capture and preserve the zodiac band's screen rotation on entering/leaving Ptolemaic so the sky does not spin.

**Tests**

Manual. Visual checks via the served `docs/` page: press Ptolemaic, confirm Earth at center, Sun disc on the 1 AU ring, radial spokes, and Mars showing angular retrograde over fast time. Confirm the zodiac does not jump on mode switch.

- Does not crash twilight cone, parallax, occupancy, tooltips, or hands in Ptolemaic.
- Switching back to Keplerian/Galilean restores Sun-centered placement without spinning the zodiac.

**Implementation Outline**

```text
if mode === PTOLEMAIC:
  earth.transform = center (r=0); sun.disc.visible = true at r=168.4
  for each body: place at b.r, angle = geoDirection(body, simT)
  guilloche = radialSpokes(...)
  preserve zodiac rotation (analogue of caseOffsetPreservingRot)
else: existing heliocentric path; sun disc hidden, center glow shown
```

## Step 5: Controls, drag routing, RA ephemeris seed (manual)

**Enables:** No feature-test assertion; verified in the browser. Add the third segmented button (order **Ptolemaic, Galilean, Keplerian**; **Galilean** default and Reset target) with values `PTOLEMAIC | GALILEAN | KEPLERIAN`. Drag routing in Ptolemaic mirrors Keplerian (dragging a body winds simulated time). `applyEphemeris` branches on mode: Ptolemaic seeds each body's `start` from geocentric right ascension (`Equator`), Sun pinned to 3 o'clock; the Sun-centered frames keep the ecliptic-longitude seed. The seed affects only boot; the running simulation stays simplified/circular in every frame.

**Tests**

Manual. The RA seed runs only in the browser (`astronomy-engine` from CDN). Verify: the three buttons toggle, Galilean is default, Reset returns to Galilean, dragging a body in Ptolemaic winds time, and on load the Sun boots near 3 o'clock.

- Selecting each mode does not crash.
- Reset restores `earthMode: GALILEAN` (update `controls.ts` default).

**Implementation Outline**

```text
controls: segmented [Ptolemaic, Galilean, Keplerian], default GALILEAN
drag: if mode === PTOLEMAIC route like KEPLERIAN (wind simT)
applyEphemeris: if mode === PTOLEMAIC seed start from Equator RA (Sun → 3 o'clock)
                else seed from EclipticLongitude (unchanged)
```

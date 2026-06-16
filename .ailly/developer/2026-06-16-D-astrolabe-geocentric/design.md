# Design: Astrolabe Ptolemaic (geocentric) third Earth mode

## Purpose

Add a third Earth frame to the astrolabe: **Ptolemaic** (Earth-centered). The
two existing frames are dial rotations around a fixed Sun-center. Ptolemaic is a
different transform. Earth moves to the center spindle, the Sun replaces Earth on
the 1AU disc, and every body is placed at its current dial radius but at its **geocentric
direction** (the sight line from Earth). Fixed radius plus true geocentric angle
yields visible angular **retrograde** without epicycles. The three frames are
relabeled after their astronomers:

- **Ptolemaic**: the new geocentric frame (new this feature).
- **Galilean**: the current "Stationary" frame (default, unchanged behavior).
- **Keplerian**: the current "Orbital" frame (unchanged behavior).

## Prior Art

- **In-repo, the two existing frames.** "Stationary" holds Earth at a fixed
  screen angle by rotating the whole dial: `dialRotation` adds `360 - aE` when
  `earthFixed` is true. "Orbital" leaves that term at zero
  ([math.ts:81-101](src/lib/astrolabe/math.ts#L81-L101)). Only Ptolemaic
  re-centers the dial.
- **Geocentric directions already computed.** `setGeo`
  ([animation.ts:424-446](src/components/astrolabe/animation.ts#L424-L446)) derives
  each body's Earth-relative screen direction every frame, today used only for
  zodiac occupancy and tooltips. Reusing that quantity as the disc *angle* is the
  whole mechanism. This feature extracts it to a pure function.
- **Retrograde from relative motion.** For an outer planet on a simplified
  circular orbit, the geocentric ecliptic direction advances, then briefly
  reverses near opposition, then advances again. This is the textbook apparent
  retrograde, and it falls out of the existing geometry for free.
- **`astronomy-engine`** ([page.ts:19-20](pages/astrolabe/page.ts#L19-L20)) already
  supplies geocentric ephemeris (`Equator` for right ascension); no new
  dependency. Prior sessions A/B/C established the testing split this design
  follows: pin acceptance to a pure lib seam, take DOM and visual harness to
  manual verification.

## User Journey and Metrics

A reader opens the astrolabe in the default **Galilean** frame, unchanged from
today. They press **Ptolemaic**. The center spindle becomes Earth; the Sun
appears as a disc orbiting at 1 AU (dial radius 168.4); the zodiac band holds its
current orientation rather than spinning. As simulated time advances, an outer
planet (e.g. Mars) tracks forward against the zodiac, slows, reverses for a
stretch near opposition, then resumes forward. This is apparent retrograde,
visible on the dial. The guilloche becomes straight radial spokes: 120 from the
center out to Mars orbit (dial radius 197.5), doubling to 240 beyond Mars, as the
heliocentric guilloche does today. Dragging a body winds simulated time, as in
Keplerian. Pressing **Keplerian** or **Galilean** returns to the Sun-centered
frames; the zodiac orientation is preserved across the switch so only the bodies
re-place, not the whole sky.

**Metrics / acceptance constraints.**

- In Ptolemaic, an outer planet's geocentric direction is non-monotonic over a
  synodic period (a retrograde reversal is present). In the Sun-centered frames
  the same body's dial angle is monotonic. This contrast is the feature test.
- Switching frames does not spin the zodiac band: its screen rotation is
  continuous across any mode switch.
- No frame crashes the twilight cone, parallax, occupancy, tooltips, or hands.
  Beyond "does not crash," their geocentric correctness is out of scope.

## Specification

### Mode type (replaces the boolean)

`Config.earthFixed: boolean` becomes a tri-state in
[types.ts](src/lib/astrolabe/types.ts):

```typescript
export const PTOLEMAIC = 1;
export const GALILEAN = 2;
export const KEPLERIAN = 3;
export type EarthMode = PTOLEMAIC | GALILEAN | KEPLERIAN;
// Config.earthFixed: boolean  ->  Config.earthMode: EarthMode
```

Every current reader of `earthFixed` will be updated. `GALILEAN` will carry
today's `earthFixed === true` behavior; `KEPLERIAN` will carry
`earthFixed === false`; `PTOLEMAIC` takes the new placement path. The functions
`displayedRate`, `dialRotation`, and `caseOffsetPreservingRot`
([math.ts:26-101](src/lib/astrolabe/math.ts#L26-L101)) will accept `EarthMode`,
or, where only the two Sun-centered states matter, a boolean derived from it,
instead of the bare boolean.

### Geocentric placement seam (the tested core)

New pure module **`src/lib/astrolabe/geocentric.ts`**:

```typescript
// Geocentric direction of a body as seen from Earth, in display degrees, as a
// pure function of simulated time. Extracted from setGeo. au-scaled vector from
// Earth (unit circle) to the body (radius = au); the quantity that produces
// apparent retrograde. Earth and Sun are special-cased by the caller.
export function geoDirection(body: Body, simT: number): number;

// Straight radial spoke endpoints for Ptolemaic guilloche: `inner` spokes from
// rInner to rMid, doubling to 2*inner from rMid (Mars orbit, dial radius 197.5)
// outward, matching the heliocentric guilloche's density doubling at Mars.
// Returns line segments in dial coordinates; rendering/DOM lives in the component.
export function radialSpokes(
  inner: number, rInner: number, rMid: number, rOuter: number,
): { x1: number; y1: number; x2: number; y2: number }[];
```

`geoDirection` reproduces `setGeo`'s formula exactly. With
`aP = helioA(body, simT)` and `aE = helioA(EARTH, simT)` both in degrees, convert
to radians and form the vector from Earth (on the unit circle) to the body (at
radius `au`):

```text
geoDirection = degrees( atan2( au·sin(aPrad) − sin(aErad),
                               au·cos(aPrad) − cos(aErad) ) )
```

`sin(aErad)` and `cos(aErad)` are Earth's Cartesian components (the `eyh` and
`exh` of `setGeo`), not functions of a degree value. The caller special-cases two
bodies: the Moon keeps its own `helioA` (it already orbits Earth in the model),
and the Sun's geocentric direction is `aE + 180`.

### Rendering (animation.ts + planets.ts + dial.ts), manual verification

- **Center swap.** In Ptolemaic, Earth's disc renders at the center spindle
  (radius 0) and a **Sun disc** orbits at radius 168.4. The Sun is not currently
  a disc ([dial.ts:148-162](src/components/astrolabe/dial.ts#L148-L162) draws only
  a static center glow); Ptolemaic introduces a Sun disc/hit so it can occupy a
  zodiac sign and show a tooltip. In the Sun-centered frames the Sun disc is
  hidden and the center glow returns.
- **Body angle.** In Ptolemaic each disc is placed at its `b.r` (Sun at 168.4,
  Earth at 0) and rotated to `geoDirection(b, simT)` rather than `helioA + rot`.
- **Radial guilloche.** In Ptolemaic the log-curve guilloche is replaced by
  `radialSpokes(120, R_SUN, R_MARS, MAX_R)` (R_MARS = 197.5) rendered as straight
  `<line>`s.
- **Zodiac continuity.** On entering or leaving Ptolemaic, capture and preserve
  the zodiac band's current screen rotation (an analogue of
  `caseOffsetPreservingRot`) so the sky does not spin; only bodies re-place.

### Controls (page.ts + controls.ts)

- The `earthMode` segmented control gains a third button. Button order:
  **Ptolemaic, Galilean, Keplerian** (historical model order); **Galilean** is
  the default active value. Values: `PTOLEMAIC | GALILEAN | KEPLERIAN` (the old
  `fixed | orbital` values are renamed).
- `controls.ts` default becomes `earthMode: GALILEAN`; Reset restores it.
- Drag routing in Ptolemaic mirrors Keplerian: dragging a body winds simulated
  time.

### Ephemeris seed (animation.ts), manual verification

`applyEphemeris` ([animation.ts:218-245](src/components/astrolabe/animation.ts#L218-L245))
branches on mode: Ptolemaic seeds each body's `start` from geocentric **right
ascension** (`Equator`) so bodies boot at their true sky position as seen from
Earth, with the Sun seeded to the 3 o'clock position; the Sun-centered frames
keep the ecliptic-longitude seed. This affects only the boot seed; the running
simulation uses the simplified circular model in every frame. Not covered by the
deterministic feature test (ephemeris runs only in the browser).

## Alternatives

- **Two booleans (`earthFixed` + `geocentric`).** Re-admits the illegal
  `fixed && geocentric` state the research ruled out; rejected for the tri-state
  enum.
- **Ptolemaic as a post-pass overlay** that overwrites the heliocentric frame's
  disc transforms. No math-signature refactor, but a "compute then clobber" flow
  entangled in animation.ts with no pure seam for the retrograde test; rejected.
- **True deferent + epicycle Ptolemaic.** Astronomically literal, but the user
  explicitly wants retrograde to emerge from the existing relative geometry, not
  from epicycle radii; rejected as out of proportion.
- **Off-the-shelf.** No general tool renders this bespoke watch-face astrolabe;
  `astronomy-engine` already covers the ephemeris half.

## Summary

One feature, tri-state mode plus a pure geocentric seam. The retrograde property
is pinned to `geoDirection` in an executable feature test; center swap, Sun disc,
radial spokes, zodiac continuity, drag routing, and the RA seed are wired in the
components and taken to manual visual verification, the same split sessions A–C
used. No new runtime dependency.

**Feature test:** `src/lib/astrolabe/ptolemaic.feature.test.ts`. In Ptolemaic
mode Mars's geocentric direction reverses over a synodic period (retrograde),
while its heliocentric dial angle over the same window is monotonic.

**Deferred / out of scope.**

- Geocentric correctness of the twilight cone, parallax, occupancy beyond
  "does not crash."
- Survey-accurate geocentric positions; the running model stays simplified and
  circular (RA only seeds the boot positions).
- Persisting the chosen frame across reloads.
- Animating the center-swap transition beyond existing CSS transitions.
- The `animation.ts` refactor to drive transforms via Jiffies FCs (existing
  TASKS.md item), now larger because bodies re-place in Ptolemaic.

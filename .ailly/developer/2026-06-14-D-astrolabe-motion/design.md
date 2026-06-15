# F3: Motion & Sky — Feature Design

**Phase:** Review
**Type:** Feature (project loop F3 of `astrolabe`; see `2026-06-14-A-astrolabe/`)
**Session slug:** `astrolabe-motion`
**Depends on:** F2 (`2026-06-14-C-astrolabe-dial/`) — the populated `<svg>` dial, the `[data-body]` groups, and the coordinate geometry. Parallel with: none.
**Release gate:** `/astrolabe/` stays DARK. F3 does NOT touch `scripts/sitemap.ts` and adds NO nav link.
**Feature test:** `src/components/astrolabe/motion.feature.test.ts`

---

## Purpose

The F2 dial is a frozen snapshot of the current sky. F3 makes it move and ring it with meaning. A single `requestAnimationFrame` loop re-applies every body's `transform` from `ephemerisPositions(simulatedDate)`, a Realtime/Fast button on the case lets the reader run time forward (~one year per minute in Fast), the twelve tropical zodiac signs ring the outer radius and light up as bodies enter them, and the always-visible controls gain a geocentric/orbital render-mode switch. Desktop `mousemove` parallax gives the field depth. This is the feature that turns a populated dial into the living instrument the brief describes, and it advances Closing Bell task **T3 (run time forward)** directly.

## Prior Art

The project design (`2026-06-14-A-astrolabe/design.md`) and the resolved research (`research.md`) carry the full prior art; this feature does not repeat it. The load-bearing references for F3 specifically:

- **Project design / research** — the `requestAnimationFrame` single-loop model, the two-state Realtime/Fast button (the **sanctioned deviation** from the visual spec's exponential slider), Fast ≈ 1 year/min, hands hidden in Fast, desktop `mousemove` parallax (device-tilt deferred), Tabler "Zodiac" stroke-path glyphs inlined as `<symbol>` (chosen over Unicode for iOS color-emoji rendering), and the geocentric-vs-orbital render-mode toggle.
- **In-repo idiom for inlined glyphs** — `src/components/trip/icons.ts` (`ICON` raw-path map + `el.innerHTML`), the pattern F3's zodiac glyph map follows.
- **The four consumed contracts** — fixed as concrete TS signatures in `2026-06-14-A-astrolabe/plan.md`; consumed here, produced by F1/F2 (see Specification).

## User Journey & Metrics

**This feature's slice of the end-to-end journey.** A reader on the populated dial taps the **Realtime/Fast button on the case** (sitting on the case, outside the controls sheet). The system wheels forward in time, the hands hiding past a few times real speed, and the twelve zodiac signs on the rim light as bodies enter their arcs. Moving the mouse over the dial gives the field a small parallax depth (outer rings drift less). In the always-visible controls the reader flips the **geocentric/orbital switch** and watches Earth release from 3 o'clock onto its orbit. With `#debug` the reader gets motion, parallax (on/off + strength), and zodiac/twilight toggles to tune the piece in a later session.

**Closing Bell tasks advanced.** T3 (run time forward — the Realtime/Fast control, the primary deliverable); contributions to T2/T4 (live motion and zodiac occupancy reinforce reading a position and reading togetherness); and the visibility/toggle half of T5 (motion, parallax, and zodiac toggles under `#debug`; the geocentric/orbital switch and per-body toggles always visible).

**Acceptable operating constraints (this feature's metrics).**

- **Motion holds frame rate.** The single rAF loop holds ~60fps on desktop. Verified by browser observation in the build phase, not by the feature test.
- **Render-mode correctness.** Orbital mode releases Earth from 3 o'clock and re-pins the Sun at center; geocentric mode restores the thesis. Verified by browser observation in the build phase (the geocentric thesis is owned and tested by F2; F3 must not regress it).
- **Zodiac occupancy correctness.** A sign lights when and only when a (non-Moon) body's geocentric ecliptic direction falls in its 30° arc. The Moon is never counted as an occupant. The pure sign math is unit-testable; the lit-state rendering is structurally asserted by the feature test.
- **First paint carries content.** The zodiac band and the Realtime/Fast button ship in the statically generated HTML; motion and parallax attach client-side without a blank first frame.

## Specification

F3 adds motion, a zodiac band, a render-mode switch, parallax, and three debug surfaces on top of the F2 dial. The design favors small composable modules: a pure sign-math lib, a pure inlined-glyph map, presentational SVG builders, and behavior modules (the motion engine, parallax) whose tickable cores are separable from `requestAnimationFrame` so they are testable and so the debug panel can drive them.

### New files

| File | Responsibility |
|---|---|
| `src/lib/astro-zodiac.ts` | **Pure sign math.** `ZODIAC_SIGNS` (the twelve signs, ordered Aries→Pisces with arc starts), `signOf(angleRad): ZodiacSign`, and `occupantsBySign(positions): Map<sign, BodyName[]>` (the Moon excluded). No DOM. Reads `BodyPosition.angle` (Contract 1). |
| `src/components/astrolabe/zodiac-glyphs.ts` | **Inlined Tabler glyph map** (`icons.ts` idiom): `ZODIAC_GLYPH: Record<ZodiacSign, string>` of stroke-path markup, and a `zodiacSymbolDefs(): Element` building the `<defs>`/`<symbol>` set the band `<use>`s. |
| `src/components/astrolabe/zodiac.ts` | **The zodiac band** at the outer radius: a `<g data-zodiac-band>` of twelve sign wedges, each a `<g data-sign="…">` with a `<use>` glyph, plus the occupancy highlight that adds `data-occupied` to lit signs from `occupantsBySign`. Consumes Contracts 1 (outer radius geometry) & 3 (occupancy blends body colors via `bodyColorVar`). |
| `src/components/astrolabe/motion.ts` | **The motion engine.** A `SimulatedClock` (real→simulated time with a speed factor) and a `MotionEngine` whose pure `tick(date)` re-queries the dial's `[data-body]` groups and re-applies their `transform` from `ephemerisPositions(date)` and refreshes zodiac occupancy. `start()`/`stop()` wrap `tick` in `requestAnimationFrame`; the toggle and the debug section drive `setSpeed`. Consumes Contract 1 (`ephemerisPositions`, `geocentricTransform`). |
| `src/components/astrolabe/speed-toggle.ts` | **The Realtime/Fast button on the case** (a `<button data-speed-toggle>` rendered by `astrolabe.ts` onto the case, OUTSIDE the controls sheet). Two-state; Fast adds `data-fast` to the watch root so hands hide and the loop runs at the Fast factor. The sanctioned deviation from the visual spec slider. |
| `src/components/astrolabe/render-mode.ts` | **The geocentric/orbital switch** (`StaticTabList`), an **always-visible** contributed `ControlsSection` (`debugOnly: false`). Flipping it sets `data-render-mode` on the watch root; the motion engine reads it to apply or drop the Earth-pin rotation. Consumes Contract 2. |
| `src/components/astrolabe/parallax.ts` | **Desktop `mousemove` parallax.** Binds a pointer handler that shifts body groups by a depth factor derived from ring radius (outer groups shift less). A pure `parallaxShift(radius, pointer)` core; on/off + strength driven by the debug section. |
| `src/components/astrolabe/motion-section.ts` | **`#debug` motion + parallax `ControlsSection`** (`debugOnly: true`): motion on/off, parallax on/off, parallax strength. Consumes Contract 2. |
| `src/components/astrolabe/zodiac-section.ts` | **`#debug` zodiac + twilight `ControlsSection`** (`debugOnly: true`): zodiac band on/off, twilight wedge on/off. Consumes Contract 2. |
| `src/components/astrolabe/motion-client.ts` | **The F3 client entry** (the `motion.ts` analogue of F1's `controls-client.ts`): instantiates the `MotionEngine`, wires the speed toggle and parallax to the rendered dial, re-registers F3's two debug sections client-side, and starts the loop. Added to `pages/astrolabe/page.ts` `clientModules` alongside `controls-client.ts`. |

### Changed files

| File | Change |
|---|---|
| `src/components/astrolabe/astrolabe.ts` | Register `renderMode`, `motionSection`, `zodiacSection` through `registerControlsSection` (alongside F1/F2 sections, idempotent on id). Render the `SpeedToggle()` button onto the case (outside `ControlsHost`). The dial composition stays in `dial.ts`. |
| `src/components/astrolabe/dial.ts` | Append the `ZodiacBand(...)` `<g>` and the zodiac `<symbol>` `<defs>` into the single `<svg>` at the outer radius (still ONE `<svg>`, bodies still painted last and on top — the F2 thesis test invariant is preserved). |
| `pages/astrolabe/page.ts` | Add `/src/components/astrolabe/motion-client.ts` to `clientModules`. No `head()` change. |
| `src/global.css` (astrolabe `@layer`) | `data-fast` hides hands; `data-occupied` lights a sign; `data-render-mode`/zodiac/twilight toggles drive visibility. CSS only, no new tokens. |

### How F3 produces / consumes the shared contracts

- **Produces:** none. F3 consumes the existing four contracts.
- **Contract 1 (coordinate system).** Animates the body transforms: the motion engine re-applies each `[data-body]` group's `transform` from `ephemerisPositions(simulatedDate)`, and adds the zodiac rim at the outer radius (`R_OUTER` and the angle of each `BodyPosition`). Render-mode applies or drops the Earth-pin rotation via `geocentricTransform`.
- **Contract 2 (controls registration).** Appends sections via `registerControlsSection`: `renderMode` (always-visible), `motionSection` and `zodiacSection` (`debugOnly`). F3 never mutates F1/F2 markup; it appends, and re-registers client-side in `motion-client.ts` exactly as `controls-client.ts` does for F1/F2.
- **Contract 3 (color tokens).** Zodiac occupancy reads `bodyColorVar(body)` so a lit sign blends its occupants' colors. F3 writes no new tokens.
- **Contract 4 (finish/material tokens).** The moving dial sits on the stable F1 case; F3 reads no material tokens directly and adds none. Hands hiding in Fast is a CSS visibility change, not a token change.

### Invariants F3 must not break (owned by F1/F2 tests)

- **One `<svg>` dial** and the **ten `[data-body]` groups** — the zodiac band and `<symbol>` defs add NO second `<svg>` and are NOT `[data-body]` groups (F2 thesis test, `astrolabe.feature.test.ts`).
- **Earth at 3 o'clock in geocentric mode** — render-mode's orbital branch must be the only thing that releases it; the default render keeps the thesis (F2).
- **F1 shows no Realtime/Fast button** is F1's assertion against F1's own shell; F3's button is added by `astrolabe.ts`, which the F2/F3 tests render — the F1 shell test stays green because it asserts the *absence wording* on the shell it builds, and `astrolabe.ts` is the composed top-level both F2 and F3 extend. (The F1 shell test's button-absence assertion targets the F1 end state; once F3 lands, the button is expected — this is a normal feature-progression flip recorded here so the plan phase confirms it.)

## Alternatives (feature-local)

- **CSS/SMIL animation instead of a rAF loop.** Rejected: the visual spec and project research fix a single `requestAnimationFrame` loop, and SMIL cannot re-derive geocentric positions per frame from `ephemerisPositions`. The rAF loop is the contracted motion model.
- **One monolithic `motion.ts` owning clock + parallax + zodiac + toggle.** Rejected against the deliverable emphasis (clean, composable modules). Splitting into a pure sign-math lib, a pure glyph map, presentational SVG builders, and tickable behavior cores keeps each file small (<800 lines), keeps the debug panel able to drive each axis independently, and keeps the feature test structural rather than timer-bound.
- **Continuous exponential speed slider (the visual spec).** Replaced by the two-state Realtime/Fast button per the research user decision — the project's single sanctioned deviation, already surfaced for the Review gate in the project plan. F3 builds the button.
- **Zodiac occupancy by render-time geometry vs. pure math.** Chosen: a pure `occupantsBySign(positions)` over `BodyPosition.angle`, so occupancy is unit-testable and the band rendering stays presentational. The lit-state DOM is what the feature test asserts.
- **Unicode zodiac code points.** Rejected (iOS color-emoji), per research — Tabler stroke-path `<symbol>` glyphs inlined in `<defs>`.

## Summary

**Deferred (parked to `TASKS.md` at cleanup):**

- Sign hover/tap info cards (F3 follow-up).
- Device-tilt parallax (`DeviceOrientationEvent.requestPermission` on iOS) — MVP ships desktop `mousemove` only.
- Sign-wedge color blending for crowded signs (multiple occupants) — MVP lights a sign and blends at most a representative occupant color; full multi-occupant blending is deferred.
- The deferred spec controls (conjunction line/tightness, sign dividers, global reset).

**Browser-verified, not unit-tested (build phase):** ~60fps motion, the parallax shift, hands hiding in Fast, and orbital-mode correctness. The feature test is jsdom-friendly and structural; the truly visual/motion behavior is confirmed with `playwright-cli` against the dev server in the build phase.

**Feature test:** `src/components/astrolabe/motion.feature.test.ts` — currently RED because the F3 modules and markup do not exist yet.

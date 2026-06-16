# Research — Astrolabe geocentric (Earth-centered) third mode

## Topic and Intent

Add a third Earth mode to the astrolabe: **geocentric**. In the user's framing:

- The zodiac is fixed. Earth is the center arbor.
- The Sun orbits Earth at the same distance Earth currently orbits the Sun (1 AU = dial radius 168.4).
- Moon, Mercury, Venus orbit the center arbor (Earth) at their current distances.
- Rotation now shows **retrograde motion**.
- The guilloche becomes straight radial lines — 120 at the center, doubling at the same Mars orbit as current.
- Simulation stays coarse and incorrect, but **resets on page load from ephemeris positions as right ascension from Earth**. On load the Sun starts at the 3 o'clock position, and every body's angle is its right ascension from Earth at that instant.

## Search/Expand (general lens)

The general lens is thin and the user has explicitly chosen "coarse and incorrect," so the engineering prior art matters more than the astronomy.

- **Geocentric / Ptolemaic rendering.** A true Ptolemaic model places Earth at center with each body on a deferent + epicycle. Retrograde emerges from the epicycle. The user does not want epicycles; they want retrograde to emerge for free from the relative geometry the dial already knows.
- **Retrograde from relative motion.** Apparent retrograde is the well-known consequence of viewing a planet's heliocentric motion from a moving Earth. The geocentric *direction* (ecliptic longitude / right ascension as seen from Earth) advances and then briefly reverses near opposition (outer planets) or conjunction (inner planets). The codebase already derives this exact quantity each frame in `setGeo`/`geo` ([animation.ts:418-446](../../../src/components/astrolabe/animation.ts#L418-L446)) but currently only uses it for zodiac occupancy and tooltips, not for placing the disc. Reusing that direction as the disc's *angle* — at a fixed radius — produces visible angular retrograde without epicycles.
- **Right ascension from Earth.** `astronomy-engine` (already loaded from CDN, [page.ts:19-20](../../../pages/astrolabe/page.ts#L19-L20)) exposes geocentric ecliptic longitude (`EclipticLongitude`, `EclipticGeoMoon`) and equatorial RA (`Equator`). The existing `applyEphemeris` ([animation.ts:218-245](../../../src/components/astrolabe/animation.ts#L218-L245)) already seeds heliocentric `start` from `EclipticLongitude`; a geocentric seed needs the Earth-relative direction instead.
- **Off-the-shelf?** No general tool renders this bespoke watch-face astrolabe. `astronomy-engine` already supplies all ephemeris needed; nothing else off-the-shelf applies.

## Falsification/Refine (specific lens)

### Current architecture (verified against the code)

- **Heliocentric model.** Sun is a static glow + core at center `CX,CY` ([dial.ts:148-162](../../../src/components/astrolabe/dial.ts#L148-L162)); it is **not** in `BODIES` and has **no disc group** ([planets.ts](../../../src/components/astrolabe/planets.ts), [bodies.ts:6-98](../../../src/lib/astrolabe/bodies.ts#L6-L98)). Every body including Earth orbits the center at radius `b.r`.
- **The two existing modes are frame rotations, not re-centerings.** `earthFixed` (Stationary) holds Earth at a fixed screen angle by rotating the whole dial via `dialRotation` ([math.ts:81-87](../../../src/lib/astrolabe/math.ts#L81-L87)); Orbital sets that rotation to 0. Neither moves the center. A true Earth-center mode is a new kind of transform the code has never done.
- **Geocentric directions already exist.** `setGeo` computes each body's Earth-relative screen direction from the heliocentric positions every frame ([animation.ts:424-446](../../../src/components/astrolabe/animation.ts#L424-L446)). The Sun's geocentric direction is `aE + 180`; the Moon's is its own `helioA` (the Moon already orbits Earth in the model).
- **`Config.earthFixed` is a boolean** ([types.ts:19](../../../src/lib/astrolabe/types.ts#L19)). A third mode forces a tri-state. The boolean is read in `displayedRate`, `dialRotation`, `caseOffsetPreservingRot`, the drag-target routing ([animation.ts:332-361](../../../src/components/astrolabe/animation.ts#L332-L361)), and the `earthMode` segmented control ([controls.ts:161-163](../../../src/components/astrolabe/controls.ts#L161-L163), [page.ts:108-117](../../../pages/astrolabe/page.ts#L108-L117)).
- **Guilloche is a heliocentric log-projection** ([guilloche.ts](../../../src/components/astrolabe/guilloche.ts)), with its own density doubling at Mars orbit. Geocentric mode needs a **separate radial-spoke generator** (straight lines from center, 120 inside 1 AU, 240 outside).

### Size, off-the-shelf, smallest version

- **Size: a single feature.** One coherent capability — a third mode — touching `types`, `bodies`/`math`, `guilloche`, `animation`, `controls`, `page`. It is more than a bug and less than a project; no independently shippable sub-features.
- **Off-the-shelf: no.** Bespoke rendering. `astronomy-engine` already covers the ephemeris half.
- **Smallest version that meets the intent:**
  1. `earthMode` gains a third value (`geocentric`); `Config` carries a tri-state instead of `earthFixed: boolean`.
  2. In geocentric mode the center swaps: Earth disc renders at `CX,CY`, a Sun disc orbits at radius 168.4. (Sun must become a renderable disc.)
  3. Each body's **angle** is its geocentric direction (RA / ecliptic longitude from Earth, the existing `setGeo` quantity), at a **fixed radius** (its current `b.r`; Sun at 168.4). Fixed-radius + true geocentric angle = visible angular retrograde, no epicycles.
  4. Zodiac is fixed (earth-frame rotation = 0; user case re-aim via `caseOffset` may still apply).
  5. Guilloche switches to radial spokes: 120 from center to the 1 AU ring, 240 from there outward.
  6. On page load, seed each body's angle from its Earth-relative RA via `astronomy-engine`, rotated so the Sun lands at 3 o'clock (screen east).

## Scope

**In scope for design:**

- Promoting the earth-frame to a tri-state mode and threading it through the math + animation + controls.
- A geocentric render branch in `animation.ts`: Earth at center, Sun as an orbiting disc, all bodies placed by geocentric angle at fixed radius.
- A radial-spoke guilloche generator selected when the mode is geocentric.
- An ephemeris reset that seeds Earth-relative RA with the Sun pinned to 3 o'clock.
- A third segmented button in the `earthMode` control.

**Out of scope:**

- Astronomical accuracy / true epicycles / correct geocentric distances. Explicitly coarse.
- Reworking the heliocentric two modes beyond the boolean→tri-state change.
- Persisting the chosen mode across reloads (consistent with the existing materials follow-up in TASKS.md).
- Twilight cone, parallax, occupancy, and watch-hand behavior beyond making them not crash in the new mode.

## Resolved Decisions

**Answered by research:**

- Retrograde mechanism: reuse the already-computed geocentric direction as the disc *angle* at a fixed radius. No epicycle radii. (Confirmed the quantity exists in `setGeo`.)
- The Sun is not currently a disc; geocentric mode must introduce a Sun disc and move Earth to center.
- The earth-frame must become tri-state; `earthFixed: boolean` is insufficient.
- `astronomy-engine` already provides Earth-relative ephemeris; no new dependency.

**Resolved with the human (2026-06-16):**

1. **Outer planets (Mars, Jupiter, Saturn, Uranus, Neptune) in geocentric mode.** Keep all bodies, place each by its geocentric angle at its current `b.r`. (Confirmed.)
2. **Retrograde look.** Angular back-and-forth on a fixed-radius ring, no radial looping. (Confirmed.)
3. **Third button label.** "Geocentric". (Confirmed.)
4. **Drag behavior in geocentric mode.** Dragging a body winds simulated time, as in Orbital. (Confirmed.)
5. **Sun at 3 o'clock on load.** Only the boot rotation; the zodiac is fixed thereafter and time advance moves the Sun off 3 o'clock. (Confirmed.)
6. **RA vs ecliptic longitude.** Split by mode: geocentric mode uses **right ascension** (sight lines from Earth, now the center spindle); the existing Sun-center modes (Stationary / Orbital) keep **ecliptic longitude**. The ephemeris seed must therefore branch on mode.

## Sources

[1] Codebase, `src/components/astrolabe/animation.ts` (lines 218-245, 332-361, 418-446) — ephemeris seed, drag routing, geocentric-direction computation. Checked out at branch `astrolabe_static`, 2026-06-16.

[2] Codebase, `src/components/astrolabe/dial.ts` (lines 148-162) — static center Sun glow/core.

[3] Codebase, `src/components/astrolabe/planets.ts`; `src/lib/astrolabe/bodies.ts` (lines 6-98) — body table and disc construction; Sun absent.

[4] Codebase, `src/lib/astrolabe/math.ts` (lines 26-101); `src/lib/astrolabe/types.ts` (line 19) — `displayedRate`, `dialRotation`, `caseOffsetPreservingRot`, `earthFixed` boolean.

[5] Codebase, `src/components/astrolabe/guilloche.ts` — heliocentric log-projection guilloche generator.

[6] astronomy-engine 2.1.19 (CDN), `EclipticLongitude`, `EclipticGeoMoon`, `Equator` — geocentric ephemeris. Loaded at [pages/astrolabe/page.ts:19-20](../../../pages/astrolabe/page.ts#L19-L20).

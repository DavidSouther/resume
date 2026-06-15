# Astrolabe Watch: Project Design

**Phase:** Implement (F1/F2/F3 built behind the dark gate as of 2026-06-14; Closing Bell not yet run)
**Type:** Project (a feature topic promoted to a project loop; see `developer/references/project-cycle.md`)
**Closing Bell:** `.ailly/developer/2026-06-14-A-astrolabe/closing-bell.md`
**Research:** `.ailly/developer/2026-06-14-A-astrolabe/research.md`
**Visual spec:** `.ailly/prompts/astrolabe`
**Release gate:** `/astrolabe/` ships dark. It is built into `docs/` but stays unlisted, with no nav link and no entry in the sitemap. `scripts/sitemap.ts` builds its URL set from an allowlist (`["/", "/blog"]` plus post routes), so a route is advertised only once it is added. The gate lifts when the Closing Bell passes, at which point `/astrolabe/` is linked from nav and added to that allowlist.

---

## Purpose

An interactive astronomical wristwatch at `/astrolabe/`. It is a heliocentric orrery, Sun centered with planets on their orbits, rendered in a geocentric frame with haute-horology craft, opening on the real current sky. Its defining decision, the thesis of the whole piece, is that Earth holds a fixed 3 o'clock position while the system wheels around it. A geocentric reading riding a heliocentric mechanism is what makes it more than another planetarium.

The three features deliver value only together. A shell without a dial is an empty case, a dial without motion is a frozen snapshot, and motion without finish or zodiac is a tech demo rather than the luxury instrument the brief describes. Each feature is independently demoable as a visibly more complete watch, yet only the union is releasable. That is why this is one project gated by a single Closing Bell rather than three separately released pages.

## Prior Art

- **Patek Philippe 4997/200G.** The finish reference. Translucent midnight-blue lacquer over engine-turned (guilloché) relief, subtle and never loud.
- **Jean Meeus, *Astronomical Algorithms* (2nd ed.).** Low-precision geocentric position formulae (planetary positions ch. 33, the Moon ch. 47), degree-level and dependency-free. The `astronomia` CDN bundle (commenthol) supplies the arc-second upgrade.
- **Tabler Icons "Zodiac" category.** Twelve stroke-path glyphs, inlined as `<symbol>`. Chosen over Unicode zodiac code points because iOS renders those as color emoji, which is a named gotcha rather than a preference.
- **In-repo conventions.** The `pages/*/page.ts` `PageModule` shape, `src/lib/page-head.ts` (`pageHead` returns `Node[]`), the `Layout` wrapper, jiffies SVG factories (`@davidsouther/jiffies/dom/svg.ts`), jiffies CSS components (`@davidsouther/jiffies/components/*`, with `Switches` from `@davidsouther/jiffies/dom/form/form.ts`), and the `*.feature.test.ts` plus `src/components/test-dom.ts` (`mount` and `resetDom`) testing convention shown in `src/components/trip/clock.feature.test.ts`.

## User Journey and Metrics

**End-to-end journey across all three features.** A reader navigates to `/astrolabe/`. A portrait watch fills the width, a mahogany cordovan strap above and below a platinum case (F1). Inside the case a deep midnight dial carries a warm gold Sun at center, Earth pinned at 3 o'clock, and all eight planets and the Moon along their true current geocentric directions at fixed log-scaled orbit radii, the whole field engine-turned under dark lacquer (F2). The reader taps the Realtime/Fast button on the case and the system wheels forward in time, the hands hiding past a few times real speed, the twelve tropical zodiac signs on the rim lighting as bodies enter them (F3). They open the controls sheet below the case to toggle bodies and to switch geocentric against orbital. With the `#debug` hash they tune case and strap materials, guilloché sliders, per-body colors, and motion and zodiac toggles.

**Measure of done.** The Closing Bell usability study (path above), run once near completion against a build with the release gate on while production keeps `/astrolabe/` dark. It is the project acceptance gate. No automated test replaces it at project altitude.

**Acceptable operating constraints (metrics).**

- **Thesis invariant.** In geocentric mode, Earth renders on the 3 o'clock ray for any date. F2 owns and tests this.
- **First paint carries content.** The statically generated HTML ships the case (F1), and once F2 lands it also ships body markers at build-time positions, so there is no blank dial before client JS runs.
- **Freshness.** Positions stay within low-precision Meeus tolerance for dates near the build. The optional `astronomia` CDN layer upgrades to arc-second accuracy when it loads. The build snapshot is the offline fallback.
- **Repaint cost.** Guilloché is a prebaked image with O(1) repaint. The animation loop is built to hold 60fps on desktop, confirmed by browser observation in F3.
- **Reach.** Mobile and desktop Safari and Chrome. The dial fills the width on a phone.
- **Orbital mode.** The geocentric-against-orbital switch is a render-mode toggle. Its correctness is verified by browser observation during F3, not by the geocentric thesis test.

## Specification

The project is three sequential features. Each is a full design to plan to build to cleanup cycle in its own session folder. Each feature is independently demoable, and the project releases only when all three land and the Closing Bell passes.

### Coordinate and position contract

One contract underlies the whole dial, and every feature depends on it.

- The dial is one `<svg viewBox="-500 -500 1000 1000">`, center at (0,0), with +x at 3 o'clock (screen right) and +y downward (SVG convention).
- Each body is a `<g data-body="…" transform="translate(x,y)">`.
- A body position has two independent parts. The **angle** is the body geocentric ecliptic direction, which depends on the date. The **radius** is a fixed log scaling of the body heliocentric semi-major axis, which does not depend on the date. The mapping is linear in `Math.log10(a)` from `a` = 0.387 AU (Mercury) to `a` = 30.1 AU (Neptune), onto the annulus between an inner radius `r_inner` and an outer radius `r_outer` (the dial interior out to the zodiac rim). Earth at `log10(1) = 0` anchors a fixed ring. A planet therefore rides a fixed orbit ring, and only its angular position changes over time.
- The Sun sits at center (radius 0). The Moon rides the Earth marker as a geocentric satellite and is excluded from the planetary ring ordering.

This angle-and-radius split is what makes the thesis test date-invariant. Earth is pinned because the geocentric rotation fixes its angle, every planet ring radius is fixed by semi-major axis, and the set of bodies present never changes with the date.

### Feature set

| # | Feature (session slug) | Scope and what it delivers | Owns thesis? |
|---|---|---|---|
| **F1** | **Shell & case** (`astrolabe-shell`) | The `/astrolabe/` route and `PageModule`; the portrait `[strap]/[platinum case]/[empty dial container]/[strap]` via an HTML `<figure>`; Cormorant Garamond and DM Mono fonts in `head()`; the always-visible controls sheet and the `#debug` panel harness with a contributed-section registration API; debug case and strap material options. No bodies and no astronomy. | no |
| **F2** | **Dial & finish** (`astrolabe-dial`) | The SVG dial populated. `astro-math` (log-radial map, geocentric transform, angle utilities) and `ephemeris` (`geocentricPositions(date)`); the Sun, eight planets, and Moon as `data-body` groups at the coordinate contract above, Earth pinned at 3 o'clock; the guilloché finish (prebaked image plus a `#debug` live builder); the twilight dead-zone wedge, which reads off the same Earth-centered conjunction system as the guilloché; the build snapshot and optional CDN override; debug guilloché sliders and per-body color pickers. | **YES** |
| **F3** | **Motion & sky** (`astrolabe-motion`) | A single `requestAnimationFrame` loop; the Realtime/Fast button on the case, outside the controls sheet; hands hidden in Fast; desktop `mousemove` parallax; the twelve-sign zodiac band with occupancy highlight; debug toggles for motion, parallax, and zodiac. | no |

F2 carries the thesis feature test (drafted in the original feature design, now owned by F2): `astrolabe.feature.test.ts`, `@vitest-environment jsdom`, `mount(Astrolabe())`. It asserts on the rendered tree:

1. one `<svg>` dial, with `[data-body="sun"]` at center;
2. all of `mercury, venus, earth, moon, mars, jupiter, saturn, uranus, neptune` present as `[data-body]` groups;
3. the Earth `translate` is on the +x ray (y near 0, x greater than 0), which is the thesis;
4. the eight planet ring radii are monotonic by semi-major axis.

Every assertion is date-invariant under the coordinate contract, so the test needs no date fixture and no snapshot file.

### Dependency relationships

```text
[F1 shell] --> [F2 dial & finish] --> [F3 motion & sky]
```

- **F2.** `Depends on: F1`. `Parallel with: none`. It mounts the dial into the F1 case and registers its debug panels through the F1 controls harness. The dependency is the coordinate container and the registration API.
- **F3.** `Depends on: F2`. `Parallel with: none`. It animates the body transforms F2 places and rings the F2 dial with the zodiac band at the outer radius. The dependency is the body groups and the dial geometry.
- The layered cut is fully sequential by choice. It trades concurrency for a legible demo at each step. F2 is the heaviest, because it carries the thesis, the ephemeris math, and the finish, so its sub-plan holds the most steps.

### Shared contracts (the project "Step 0", settled before F2 and F3 build)

1. **Coordinate system.** As specified above. F1 stands up the empty dial container at this contract, F2 fills it, F3 animates the transforms and adds the rim at the outer radius.
2. **Controls-sheet registration.** F1 owns the registry. The controls component accepts an ordered list of named control-group sections, each shaped `{ id: string, title: string, render(): Node | Node[], debugOnly: boolean }`. The `Node | Node[]` return lets a section render a fragment. F1 contributes the material section, F2 contributes the guilloché and color sections, F3 contributes the motion and zodiac sections. Later features append sections rather than mutate F1 markup. F1 finalizes any remaining field details when it builds the harness, before F2 builds against it.
3. **Color tokens.** `--color-sun` through `--color-neptune`, plus case and strap material tokens, defined once and consumed everywhere. Debug pickers write them with `element.style.setProperty`.
4. **Finish and material tokens.** Platinum for case and bezel, mahogany cordovan for strap, expressed as CSS tokens in F1 so the F2 guilloché and F3 motion sit on a stable case.

### Controls inventory against the visual spec

The visual spec Controls section enumerates a long control list. This project scopes that list to the research MVP boundary, recorded here so the divergence is explicit rather than silent.

- **MVP, always visible:** the geocentric-against-orbital switch, the per-body toggles, and the Realtime/Fast control (rendered as a button on the case, see the deviation note below).
- **MVP, under `#debug` only:** case and strap materials (F1); the five guilloché sliders, the flat finish alternative, and per-body color pickers (F2); motion, parallax on and off and strength, and the zodiac and twilight toggles (F3).
- **Deferred past the MVP:** the sign info card, the conjunction-line and conjunction-tightness controls, the sign-divider and sign-highlight toggles, device-tilt enable, and a global reset. These are parked in the deferred list below.

### Deviations from the visual spec (sanctioned by research, surfaced for the Review gate)

The research refine pass recorded user decisions that depart from the visual spec. They are listed here so the Review gate sees them instead of discovering them during build.

- **Animation control.** The spec specifies a continuous exponential animation-speed slider, from real time at rest up to one Saturn orbit per ten minutes. The research user decision replaces it with a two-state Realtime and Fast button on the case, Fast running at roughly one year per minute. This design follows the research decision. Confirm or override it at the gate.
- **Controls as a contributed registry.** The spec describes one controls sheet. This design keeps that sheet but builds it from a per-feature registration API so each feature contributes its own section. This is an implementation structure, not a user-visible change.

### SSG integration

`/astrolabe/` is `pages/astrolabe/page.ts` (`PageModule` with `head` and `default`), generated statically. The brief phrase "self-contained HTML" means, in this SSG, no database, no SSR data, and all runtime behavior client-side. Two build scripts run during F2 so the page ships current. `scripts/update-ephemeris-snapshot.ts` writes `src/lib/astro-snapshot.ts`, and `scripts/render-guilloché.ts` writes the guilloché data-URI literal. They must run before the SSG renders the page, because `page.ts` imports those generated literals. Today `prebuild` runs `npm run check` (typecheck and lint) and `build` runs the SSG, so the generators are added to that build-time sequence. Whether they extend `prebuild` or become an early `build` step is settled in the F2 plan. If a generator fails, the build fails loudly rather than shipping absent or stale positions. As a runtime safety net, `geocentricPositions(date)` computes inline from the Meeus formulae, so the snapshot and the CDN are freshness and precision layers over a self-sufficient base. Both scripts are invoked as `node script.ts` on Node 24 with no strip-types flag, per AGENTS.md.

## Alternatives

- **Decomposition, two-way (static against interactive).** Rejected as too coarse. It loses the per-layer debug structure the user wants.
- **Decomposition, by subsystem (shell, astronomy-core, ornament, motion).** Rejected. It is more size-balanced but has worse demo cadence, because the watch does not read as the piece until ornament lands. The chosen horizontal-by-stack cut keeps a legible watch at every step.
- **Guilloché in F3 with the other ornament.** Rejected. The user wants the finish sooner, and the guilloché spiral is the Earth-centered conjunction graticule, so it belongs with the position system in F2.
- **Ship `astronomia` locally.** Rejected for bundle weight. The CDN-optional layer plus the inline Meeus fallback covers it.
- **Live guilloché in production.** Rejected for repaint cost. The MVP prebakes an image and runs the live builder only under `#debug`.
- **Unicode zodiac glyphs.** Rejected for iOS color-emoji rendering.
- **Off-the-shelf at project scale.** No library renders geocentric framing, a log dial, a guilloché finish, and jiffies DOM integration as one unit. `astronomia` covers only the math layer, so a build is justified.

## Summary

Deferred decisions, to be parked to `TASKS.md` at cleanup.

- Sign hover and tap info cards (an F3 follow-up).
- Device-tilt parallax (`DeviceOrientationEvent.requestPermission` on iOS). The MVP ships desktop `mousemove` parallax only.
- Sign-wedge color blending for crowded signs.
- The deferred spec controls listed above (sign info card, conjunction line and tightness, sign dividers and highlight, device-tilt enable, global reset).
- Exact guilloché filter parameters (`feTurbulence` and `feDisplacementMap` tuning), settled in the F2 plan.
- The client-hydration mechanism (an inline module script against jiffies `hydrate`), settled in the F2 plan.
- The controls-sheet registration type, finalized in the F1 design before F2 builds.
- `astronomia` CDN precision validation against the Meeus snapshot, in the F2 plan.
- Release-flag retirement once the Closing Bell passes: link `/astrolabe/` from nav and add it to the sitemap allowlist.

**On a failed Closing Bell.** A failing critical task reopens the feature that owns the failed behavior. Recognition or position reading reopens F2, running time forward reopens F3, and a control-discovery failure reopens the feature that owns that control. The reopened feature runs another design-to-build pass behind the still-dark gate, then the bell is rerun.

**Feature session folders, created when each cycle starts:** `2026-06-14-B-astrolabe-shell/`, `2026-06-14-C-astrolabe-dial/`, `2026-06-14-D-astrolabe-motion/`. This project doc and `research.md` stay in `2026-06-14-A-astrolabe/`.

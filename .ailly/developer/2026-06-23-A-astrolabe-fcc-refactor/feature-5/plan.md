# Implementation Plan: Feature 5 — Dial view becomes an FCC; delete the DOM-handle seam

**Design:** `dial-redesign.md` (decided: stage-rooted, full rework). **Supersedes Feature 4.**

**Thesis:** `astrolabeView` is a handle-fed free function and `Dial()`/`buildStage()` hand out
interior-element bags — DOM handles across API boundaries, which is forbidden. Rework so the dial
is an `AstrolabeView` FCC (boundary = `<svg id="dial">`) owning its subsystems, the `#stage-wrap`
component owns composition + overlays + controls and takes merged `{state}` / `{scene}` payloads,
and nothing holds anything but a root component instance it built.

**Feature test:** `frame-render.feature.test.ts` (rewritten to the no-handle contract). Guards held
green: `no-raw-dom`, `frame-roundtrip`, `astrolabe`(SSG), `control-menu`, `controls-apply`,
`persistence`.

**Stages (each keeps the suite green before moving on):**

- [x] Stage 1 — **Dial → `AstrolabeView` FCC.** Fold `Dial()` + `astrolabeView()` into one
      `FCC<{scene; events?}, DialInternals>` whose boundary IS the svg. Ctor builds the skeleton +
      subsystem FCCs once into `[State]`; `update(scene)` fans slices and returns the same
      instances. The mode class is `up(el, {class})` in its **own** render (no `DialRoot`). Each
      visibility leaf owns its **own** boundary's display (Spokes/Hands/SunCenter become FCCs;
      SunDisc already does) — **delete `Visibility`/`DialRoot`**. Events ride `scene`/`events` in
      `update`; the disc/sun/zodiac leaves forward their map to their own `.hit`/zhit child
      (leaf-internal, non-`events` key). Keep `buildStage` returning the dial instance for now.
- [x] Stage 2 — **Drop `DialHandles`; loop/client hold the instance.** `animation.ts` takes the
      `AstrolabeView` instance (not `svg`+`view`), calls `dial.update(scene)`, passes events via the
      first `update`. `client.ts`/`page.ts` build and hold the instance. Delete the `DialHandles`
      interface and every interior handle. `svg.getBoundingClientRect`/parallax: the loop reads the
      svg element it built (the root instance IS the svg) — that is the held root, not an interior
      handle.
- [x] Stage 3 — **Overlays as FCCs under the stage component.** `Tooltip`, `SignCard`, `Clock`
      become FCCs. Evolve the `#stage-wrap` component (today's `ControlsDrawer`) to place
      `AstrolabeView` + overlay FCCs and accept a merged `scene` payload: render splits into a
      state section (control leaves, as today) and a scene section (`st.dial.update(scene)` + fan
      tip/signcard/clock slices). Delete `OverlayHandles` and the free `astrolabeView`.
- [x] Stage 4 — **`buildStage` + controllers.** `buildStage()` returns the single root instance.
      `initControls` and the animation loop both `.update()` that one instance (`{state,events}` /
      `{scene,events}`). No handle bag anywhere.
- [x] Stage 5 — **Tests to the no-handle contract.** Rewrite `frame-render` to construct the root
      with no element args and assert via rendered nodes (distributed styling on owning leaves;
      events via `update`; clock/tooltip projection). Migrate the controls/SSG guards. Full green.

**Done = `AstrolabeView` is an svg-rooted FCC; the `#stage-wrap` component owns dial+overlays+controls
via merged `{state}`/`{scene}` updates; `DialHandles`/`OverlayHandles`/`astrolabeView`/`Visibility`/
`DialRoot` are gone; no element handle crosses any boundary; events ride `update`; suite green.**

## Risks / watch

- **Stage-rooted merge cadence.** `{state}` (rare) and `{scene}` (60fps) hit the same instance;
  rely on `inputs.attrs` merge so a scene update doesn't drop state and vice-versa. Verify the first
  `{scene}` update after a `{state}` update keeps controls intact (and the reverse).
- **SSG `.update` graft.** Page-emitted root re-parsed by the browser loses its build-time `.update`;
  the registry/hydration path must re-wire it (`getFCC`/`attach`). `frame-roundtrip` guards this —
  keep it green at every stage. ([[jiffies-update-graft-lost-on-ssg-reparse]])
- **`no-raw-dom` scope** now also covers `stage.ts` and any new overlay module — keep them clean.
- **Parallax/layout reads** (`getBoundingClientRect`, `getComputedStyle`) on the held root svg are
  sanctioned reads, not handles — keep them in the loop, off interior elements.

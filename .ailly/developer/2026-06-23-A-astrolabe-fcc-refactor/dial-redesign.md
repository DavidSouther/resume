# Design — Dial: make the view an FCC, delete the DOM-handle seam

*Decided 2026-06-25 — stage-rooted, full rework (supersedes the styling-distribution-only
framing below the line, and the Feature 4 build).*

## The correction

The earlier draft of this doc (and the now-built Feature 4) accepted the dial's
foundation — `Dial()`/`buildStage()` return a `DialHandles` bag of interior element
references, and `astrolabeView(dial, overlays, events)` is a free function that pokes
those handles each frame and exposes a separate `bindEvents`. That foundation is the
entanglement. **DOM handles must not cross an API boundary anywhere**, and the dial
view should be a component, not a handle-fed seam.

The yardstick is the shipped controls half, which already does this right:
`ControlsDrawer` is an `FCC` whose boundary IS `#stage-wrap`. It builds its children
**once** into `[State]` (`buildShell`), and every render fans each slice **plus its
`events` map** to the stashed child and returns the same instances. No handle bag, no
second method, events on the `events` prop. The dial's view is the dial's
`ControlsDrawer`, and it must take the same shape.

## Target architecture

- **`AstrolabeView` is an `FCC<SceneProps, DialInternals>`** whose boundary is
  `<svg id="dial">` (mirroring `ControlsDrawer`'s boundary = `#stage-wrap`). Its ctor
  builds the static skeleton (defs/ground/bezel/clip) and the dynamic subsystem FCCs
  (Zodiac, per-body discs, SunDisc, Spokes, Hands, SunCenter, guilloche, date,
  twilightCone) **once** into `[State]`.
- **`update(scene)` fans each slice to the stashed child** and returns the same
  top-level instances — reconcile is a no-op (verified: already-mounted children are
  left untouched; FCC children are opaque units `patchNode` will not descend into).
  This is the `ControlsDrawer` render body, applied to dial subsystems.
- **No `DialHandles`, no `OverlayHandles`, no element references across any boundary.**
  `Dial()`/`buildStage()` stop returning interior-element bags. The only thing held
  across a boundary is the **root component instance** the holder constructed — exactly
  how `initControls(drawer)` holds the drawer and calls `drawer.update(...)`. The svg
  *is* the `AstrolabeView` instance; `client.ts`/`animation.ts` hold that one instance
  and call `.update(scene)`. Holding a component you built and calling its `update` is
  the FCC contract; reaching into someone else's subtree for child handles is the
  prohibited pattern.
- **Each leaf owns its own boundary's effect** — the model `SunDisc` already follows
  (it maps `visible` to `display` on its *own* boundary). `Spokes` owns its `display`,
  `Hands`/`SunCenter` become FCCs owning their own `visible`, and the **mode class is
  owned by `AstrolabeView` itself** (its boundary IS the svg — `up(el, {class})` in its
  own render). This **deletes the Feature 4 `Visibility`/`DialRoot` detached effect
  carriers**: those existed only to apply effects to passed-in host-group *handles*.
  With real FCC boundaries there is nothing to pass and nothing to carry.
- **Events flow on the `events` prop of `update`**, authored by `animation.ts`, wired
  once (handlers are stable — pass them on the first `update` and omit thereafter; the
  merged `inputs.attrs` keeps them live, and `setListener` is idempotent if re-passed).
  No `bindEvents`. The "components decide whether to re-call their children" selective
  propagation is a *later* optimization — not now; the plain FCC update is enough.
- **The non-bubbling-hover hit-child forwarding stays a leaf-internal concern.** A disc
  FCC receives its `events` map (in its slice) and forwards it to its own `.hit` child;
  this is internal to the leaf, not a seam channel. (Mechanism note still holds: a prop
  literally named `events` wires the boundary; the disc keeps a non-`events` key for the
  map it forwards to the child — that is an internal implementation detail of the leaf,
  not an API-level bare-prop.)

## Decided: stage-rooted, one `#stage-wrap` component

The clocks live inside the controls drawer; the tooltip and sign card are stage siblings
of the dial. None are descendants of the dial svg, so an svg-scoped component can't own
them — and the clocks-in-drawer fact rules out the loop fanning overlays from outside
without a handle. **Resolution: a single stage component at `#stage-wrap`** (the boundary
`ControlsDrawer` already holds). It owns the whole stage and splits ownership explicitly:

- **`AstrolabeView` becomes an FCC whose boundary is `<svg id="dial">`** and owns every
  dial subsystem (Zodiac, discs, SunDisc, Spokes, Hands, SunCenter, guilloche, date,
  twilightCone) + the dial-root **mode class on its own boundary**. `update(scene)` fans
  slices to subsystems stashed in `[State]`. This is the cohesive dial component.
- **The `#stage-wrap` component owns composition + overlays + controls.** It is the
  evolution of today's `ControlsDrawer`: it builds the shell, places `AstrolabeView` (the
  dial svg) and the overlay FCCs (`Tooltip`, `SignCard`, the two `Clock`s in the panel),
  and builds the control leaves. It takes **two merged payloads**: `update({state, events})`
  from the controls controller and `update({scene, events})` from the animation loop
  (`inputs.attrs` merges, so neither clobbers the other). Its render body has an explicit
  split — a controls/state section (fan to control leaves, as today) and a scene section
  (`st.dial.update(scene)`; fan tip/signcard/clock slices to the overlay FCCs).
- **No handles, no `bindEvents`.** Both controllers hold only the one `#stage-wrap` root
  instance they were handed and call `.update(...)`. `DialHandles`/`OverlayHandles` and
  the free `astrolabeView`/`Dial()`-returns-bag shapes are deleted.

## Feature test (defines done)

`frame-render.feature.test.ts` stays the tripwire and is extended/rewritten to assert
the **component** contract, reading rendered nodes by class/id (never a handle):

1. **No handles cross the API.** `AstrolabeView` is constructed with no element
   arguments (it builds its own svg); `buildStage`/client construct it and hold only the
   root instance. (Guarded structurally + by the no-handle shape of the ctor signature.)
2. **Distributed styling, leaf-owned.** Toggling a scene boolean flips the effect on the
   owning leaf's own boundary (spokes `display`, sun-center `display`, the dial-root mode
   class on the svg itself), with the view making no per-element styling poke.
3. **Events via `update`.** Pass an `events` map in `update(scene)`; dispatch a `click`
   on `.disc-mars .hit` and assert the controller-authored handler ran. No `bindEvents`,
   no element `addEventListener`.

**Done = `AstrolabeView` is an FCC built with no element handles; `DialHandles`/
`OverlayHandles` are gone; each leaf owns its own boundary's effect; events ride the
`update` `events` prop; the existing suite (incl. `no-raw-dom`, `frame-roundtrip`, SSG
build) stays green.**

---

## Superseded (kept for the record): styling-distribution-only framing

The original draft argued the state axis was "already aligned" and the only work was
distributing styling out of `view.ts`. That accepted the handle seam as correct. It is
not — see "The correction" above. The styling distribution is still part of the work,
but as a *consequence* of each subsystem becoming a real FCC that owns its boundary, not
as the headline. The Feature 4 build that landed `Visibility`/`DialRoot` detached effect
carriers and kept `astrolabeView` as a handle-fed function is **superseded** by this
design and will be reworked.
